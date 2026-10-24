import os
import json
import uuid
import datetime
import base64
from typing import Optional, Dict, Any
from urllib.parse import urlencode

from fastapi import APIRouter, Request, HTTPException, status, Query, BackgroundTasks
from fastapi.responses import JSONResponse, RedirectResponse
import requests
from dotenv import load_dotenv

from config.mongo import connect_to_mongo
from models import Profile, ProviderSubscription, TranscriptJob
from helpers.jwt import decode_jwt, encode_jwt
from kafka_pipeline.producer import publish_recording_event
from kafka_pipeline.consumer import process_transcript_job
from kafka_pipeline.config import TOPIC_MEETING_RECORDINGS

load_dotenv()

router = APIRouter(prefix="/google-meet", tags=["provider_google_meet"])
connect_to_mongo()

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
SERVER_DOMAIN = os.environ.get("SERVER_DOMAIN", "http://localhost:8000")
GOOGLE_MEET_REDIRECT_URI = os.environ.get(
    "GOOGLE_MEET_REDIRECT_URI",
    f"{SERVER_DOMAIN}/providers/google-meet/oauth/callback"
)
CLIENT_DOMAIN = os.environ.get("CLIENT_DOMAIN", "http://localhost:3000")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

GOOGLE_MEET_SCOPES = [
    "https://www.googleapis.com/auth/meetings.space.readonly",
    "https://www.googleapis.com/auth/meetings.conference.recordings.readonly",
    "https://www.googleapis.com/auth/meetings.conference.transcripts.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "openid",
    "email",
    "profile"
]


def get_current_user_id(request: Request, query_token: Optional[str] = None) -> Optional[str]:
    """Helper to extract user_id from cookie, header, or query token."""
    token = request.cookies.get("auth_token")
    if not token and query_token:
        token = query_token
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        return None
    payload = decode_jwt(token)
    return payload.get("sub") if payload else None


@router.get("/oauth/login")
async def google_meet_oauth_login(request: Request, token: Optional[str] = Query(None)):
    """
    Initiates Google OAuth 2.0 flow for Google Meet recordings and transcripts.
    """
    user_id = get_current_user_id(request, token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required before connecting Google Meet."
        )

    state_payload = {"user_id": user_id, "nonce": uuid.uuid4().hex}
    state_str = encode_jwt(state_payload)

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_MEET_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(GOOGLE_MEET_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state_str,
        "include_granted_scopes": "true",
    }

    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    accept_header = request.headers.get("accept", "")
    if "text/html" in accept_header or request.query_params.get("redirect") == "true":
        return RedirectResponse(url=auth_url)
    return {"url": auth_url, "state": state_str}


@router.get("/oauth/callback")
async def google_meet_oauth_callback(
    request: Request,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None)
):
    """
    Handles Google OAuth 2.0 callback, exchanges auth code for tokens,
    creates/updates ProviderSubscription, and sets up Drive/Workspace watch webhook.
    """
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google Meet authorization failed: {error}"
        )
    if not code or not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing code or state parameters."
        )

    state_data = decode_jwt(state)
    if not state_data or "user_id" not in state_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state token."
        )

    user_id = state_data["user_id"]
    profile = Profile.objects(id=user_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found."
        )

    # Exchange authorization code for Google access & refresh tokens
    token_resp = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": GOOGLE_MEET_REDIRECT_URI
        },
        timeout=10
    )

    if token_resp.status_code != 200:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "Failed to exchange Google OAuth code", "details": token_resp.text}
        )

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in", 3600)
    scopes = token_data.get("scope", "").split()

    # Fetch user info from Google
    userinfo_resp = requests.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10
    )
    google_user_id = None
    google_email = None
    if userinfo_resp.status_code == 200:
        u_info = userinfo_resp.json()
        google_user_id = u_info.get("id")
        google_email = u_info.get("email")

    # Upsert ProviderSubscription document
    sub = ProviderSubscription.objects(owner_id=profile, provider="google_meet").first()
    if not sub:
        sub = ProviderSubscription(
            owner_id=profile,
            provider="google_meet",
            created_at=datetime.datetime.utcnow()
        )

    sub.access_token = access_token
    if refresh_token:
        sub.refresh_token = refresh_token
    sub.token_expires_at = datetime.datetime.utcnow() + datetime.timedelta(seconds=expires_in)
    sub.scopes = scopes
    sub.provider_user_id = google_user_id
    sub.provider_account_email = google_email
    sub.client_state = uuid.uuid4().hex
    sub.is_active = True
    sub.updated_at = datetime.datetime.utcnow()
    sub.save()

    # Optional: Automatically register Google Drive watch webhook for Meet recordings
    try:
        channel_id = str(uuid.uuid4())
        webhook_target = f"{SERVER_DOMAIN}/providers/google-meet/webhook"
        watch_resp = requests.post(
            "https://www.googleapis.com/drive/v3/changes/watch",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "id": channel_id,
                "type": "web_hook",
                "address": webhook_target,
                "token": sub.client_state
            },
            timeout=8
        )
        if watch_resp.status_code == 200:
            watch_data = watch_resp.json()
            sub.subscription_id = watch_data.get("id", channel_id)
            sub.subscription_resource = watch_data.get("resourceId")
            sub.save()
    except Exception as e:
        print(f"[Google Meet] Optional Drive watch setup notice: {e}")

    # Synchronize Profile.apps for backward compatibility
    existing_app = next((a for a in profile.apps if a.app_id == "google_meet"), None)
    if existing_app:
        if refresh_token:
            existing_app.refresh_token = encode_jwt({"token": refresh_token})
        existing_app.access_token = access_token
        existing_app.permissions = scopes
    else:
        profile.apps.append(
            Profile.AuthorizationToken(
                app_id="google_meet",
                permissions=scopes,
                refresh_token=encode_jwt({"token": refresh_token}) if refresh_token else "",
                access_token=access_token
            )
        )
    profile.save()

    redirect_target = f"{CLIENT_DOMAIN}/integrations?google_meet=connected&account={google_email or ''}"
    return RedirectResponse(url=redirect_target)


@router.post("/webhook")
async def google_meet_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Google Meet Webhook Endpoint:
    1. Handles Google Drive/Workspace push notification handshakes ('X-Goog-Resource-State: sync').
    2. Verifies channel token against stored client_state.
    3. Handles change/add events and Cloud Pub/Sub push payloads for recordings & transcripts.
    4. Enqueues event into Kafka topic and initiates TranscriptJob.
    """
    resource_state = request.headers.get("X-Goog-Resource-State")
    channel_id = request.headers.get("X-Goog-Channel-ID")
    channel_token = request.headers.get("X-Goog-Channel-Token")
    resource_id = request.headers.get("X-Goog-Resource-ID")

    # 1. Google Webhook Handshake Check
    if resource_state == "sync":
        # Verification handshake, acknowledge immediately
        return JSONResponse(status_code=200, content={"status": "sync_acknowledged"})

    # Parse potential body (JSON or Cloud Pub/Sub push)
    body = {}
    try:
        raw_body = await request.body()
        if raw_body:
            body = json.loads(raw_body.decode("utf-8"))
    except Exception:
        body = {}

    # Check for Google Cloud Pub/Sub message wrapping
    if "message" in body and "data" in body["message"]:
        try:
            pubsub_data = json.loads(base64.b64decode(body["message"]["data"]).decode("utf-8"))
            body.update(pubsub_data)
        except Exception:
            pass

    # Map Google notification to user subscription
    user_sub = None
    if channel_token:
        user_sub = ProviderSubscription.objects(
            provider="google_meet",
            client_state=channel_token,
            is_active=True
        ).first()

    if not user_sub and channel_id:
        user_sub = ProviderSubscription.objects(
            provider="google_meet",
            subscription_id=channel_id,
            is_active=True
        ).first()

    user_id = str(user_sub.owner_id.id) if user_sub and user_sub.owner_id else None

    space_id = body.get("space_id") or resource_id or uuid.uuid4().hex[:8]
    job_id = f"gmeet-{space_id}-{uuid.uuid4().hex[:6]}"

    # Construct payload metadata
    payload_data = {
        "resource_state": resource_state,
        "channel_id": channel_id,
        "space_id": space_id,
        "body": body
    }

    # Create TranscriptJob record (in_queue)
    job = TranscriptJob(
        job_id=job_id,
        provider="google_meet",
        status="in_queue",
        stage="enqueued",
        progress=10,
        provider_meeting_id=space_id,
        provider_meeting_topic=body.get("title", f"Google Meet {space_id}"),
        payload_metadata=payload_data,
        raw_payload=body,
        created_at=datetime.datetime.utcnow()
    )
    if user_sub and user_sub.owner_id:
        job.owner_id = user_sub.owner_id
    job.save()

    # Publish to Kafka
    sent_to_kafka = publish_recording_event(
        provider="google_meet",
        event_type=resource_state or "google_meet.recording_ended",
        job_id=job_id,
        user_id=user_id,
        payload=payload_data,
        topic=TOPIC_MEETING_RECORDINGS
    )

    # Local fallback background task if Kafka is offline
    if not sent_to_kafka:
        background_tasks.add_task(
            process_transcript_job,
            job_id=job_id,
            provider="google_meet",
            user_id=user_id,
            payload=payload_data
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "status": "queued",
            "job_id": job_id,
            "kafka_published": sent_to_kafka
        }
    )


@router.post("/subscribe")
async def google_meet_subscribe(request: Request, token: Optional[str] = Query(None)):
    """
    Explicitly creates or renews Google Meet/Drive watch channel subscription.
    """
    user_id = get_current_user_id(request, token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    sub = ProviderSubscription.objects(owner_id=user_id, provider="google_meet", is_active=True).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Active Google Meet integration not found")

    channel_id = str(uuid.uuid4())
    client_state = sub.client_state or uuid.uuid4().hex
    webhook_target = f"{SERVER_DOMAIN}/providers/google-meet/webhook"

    resp = requests.post(
        "https://www.googleapis.com/drive/v3/changes/watch",
        headers={"Authorization": f"Bearer {sub.access_token}"},
        json={
            "id": channel_id,
            "type": "web_hook",
            "address": webhook_target,
            "token": client_state
        },
        timeout=10
    )

    if resp.status_code == 200:
        data = resp.json()
        sub.subscription_id = data.get("id", channel_id)
        sub.subscription_resource = data.get("resourceId")
        sub.client_state = client_state
        sub.save()
        return {"message": "Google Meet watch channel subscribed successfully", "channel": data}
    else:
        return JSONResponse(status_code=resp.status_code, content={"error": resp.text})


@router.post("/disconnect")
async def google_meet_disconnect(request: Request, token: Optional[str] = Query(None)):
    """
    Disconnects Google Meet integration, revokes OAuth token, and deactivates subscription.
    """
    user_id = get_current_user_id(request, token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    sub = ProviderSubscription.objects(owner_id=user_id, provider="google_meet", is_active=True).first()
    if not sub:
        return JSONResponse(status_code=404, content={"error": "Active Google Meet integration not found"})

    if sub.access_token:
        try:
            requests.post(
                GOOGLE_REVOKE_URL,
                params={"token": sub.access_token},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=5
            )
        except Exception:
            pass

    sub.is_active = False
    sub.save()

    profile = Profile.objects(id=user_id).first()
    if profile:
        profile.apps = [a for a in profile.apps if a.app_id != "google_meet"]
        profile.save()

    return {"message": "Google Meet integration successfully disconnected"}


@router.get("/status")
async def google_meet_status(request: Request, token: Optional[str] = Query(None)):
    """
    Checks if current user has an active Google Meet connection.
    """
    user_id = get_current_user_id(request, token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    sub = ProviderSubscription.objects(owner_id=user_id, provider="google_meet", is_active=True).first()
    return {
        "connected": sub is not None,
        "email": sub.provider_account_email if sub else None,
        "subscription_id": sub.subscription_id if sub else None,
        "scopes": sub.scopes if sub else [],
        "expires_at": sub.token_expires_at.isoformat() if sub and sub.token_expires_at else None,
        "subscription_expires_at": sub.subscription_expires_at.isoformat() if sub and sub.subscription_expires_at else None,
        "updated_at": sub.updated_at.isoformat() if sub and sub.updated_at else None
    }
