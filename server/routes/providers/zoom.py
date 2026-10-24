import os
import json
import base64
import hmac
import hashlib
import uuid
import datetime
import asyncio
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

router = APIRouter(prefix="/zoom", tags=["provider_zoom"])
connect_to_mongo()

ZOOM_CLIENT_ID = os.environ.get("ZOOM_CLIENT_ID", "")
ZOOM_CLIENT_SECRET = os.environ.get("ZOOM_CLIENT_SECRET", "")
ZOOM_REDIRECT_URI = os.environ.get(
    "ZOOM_REDIRECT_URI",
    f"{os.environ.get('SERVER_DOMAIN', 'http://localhost:8000')}/providers/zoom/oauth/callback"
)
ZOOM_WEBHOOK_SECRET_TOKEN = os.environ.get("ZOOM_WEBHOOK_SECRET_TOKEN", "")
CLIENT_DOMAIN = os.environ.get("CLIENT_DOMAIN", "http://localhost:3000")

ZOOM_AUTH_URL = "https://zoom.us/oauth/authorize"
ZOOM_TOKEN_URL = "https://zoom.us/oauth/token"
ZOOM_REVOKE_URL = "https://zoom.us/oauth/revoke"
ZOOM_USER_URL = "https://api.zoom.us/v2/users/me"

# ZOOM_DEFAULT_SCOPES = ["recording:read", "user:read"]
ZOOM_DEFAULT_SCOPES = [
    # Lists all cloud recordings for a user.
    "cloud_recording:read:list_user_recordings",
    # Read recording content scope
    "cloud_recording:read:content",
    # Recover meeting recordings
    "cloud_recording:update:recover_meeting_recordings",
    # View a recording
    "cloud_recording:read:recording",
    # View your recordings' meeting transcript
    "cloud_recording:read:meeting_transcript",
    # Existing scopes for backward compatibility
    "recording:read",
    "user:read",
    "meeting:read:search",      # Search and view meetings
    "meeting:read:meeting",     # View a meeting
    "meeting:read:participant", # View a meeting's participant
]


def get_current_user_id(request: Request, query_token: Optional[str] = None) -> Optional[str]:
    """Helper to extract authenticated user_id from cookie, header, or query token."""
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
async def zoom_oauth_login(request: Request, token: Optional[str] = Query(None)):
    """
    Initiates Zoom OAuth 2.0 authorization flow for individual user.
    """
    user_id = get_current_user_id(request, token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required before connecting Zoom account."
        )

    # Encode state containing user_id and CSRF nonce
    state_payload = {"user_id": user_id, "nonce": uuid.uuid4().hex}
    state_str = encode_jwt(state_payload)

    params = {
        "response_type": "code",
        "client_id": ZOOM_CLIENT_ID,
        "redirect_uri": ZOOM_REDIRECT_URI,
        "scope": " ".join(ZOOM_DEFAULT_SCOPES),
        "state": state_str,
    }

    authorization_url = f"{ZOOM_AUTH_URL}?{urlencode(params)}"
    # Return both URL and redirect option
    accept_header = request.headers.get("accept", "")
    if "text/html" in accept_header or request.query_params.get("redirect") == "true":
        return RedirectResponse(url=authorization_url)
    return {"url": authorization_url, "state": state_str}


@router.get("/oauth/callback")
async def zoom_oauth_callback(
    request: Request,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None)
):
    """
    Handles Zoom OAuth 2.0 callback, exchanges auth code for access & refresh tokens,
    and stores ProviderSubscription linked to user profile.
    """
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Zoom authorization failed with error: {error}"
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

    # Exchange authorization code for Zoom tokens
    auth_bytes = f"{ZOOM_CLIENT_ID}:{ZOOM_CLIENT_SECRET}".encode("utf-8")
    basic_auth_header = f"Basic {base64.b64encode(auth_bytes).decode('utf-8')}"

    token_payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": ZOOM_REDIRECT_URI
    }

    token_resp = requests.post(
        ZOOM_TOKEN_URL,
        data=token_payload,
        headers={
            "Authorization": basic_auth_header,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        timeout=10
    )

    if token_resp.status_code != 200:
        logger_error = token_resp.text
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "Failed to exchange Zoom token", "details": logger_error}
        )

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in", 3600)
    scopes = token_data.get("scope", "").split()

    # Retrieve user's Zoom account ID and email
    user_info_resp = requests.get(
        ZOOM_USER_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10
    )
    zoom_user_id = None
    zoom_email = None
    if user_info_resp.status_code == 200:
        u_info = user_info_resp.json()
        zoom_user_id = u_info.get("id")
        zoom_email = u_info.get("email")

    # Upsert ProviderSubscription document
    sub = ProviderSubscription.objects(owner_id=profile, provider="zoom").first()
    if not sub:
        sub = ProviderSubscription(
            owner_id=profile,
            provider="zoom",
            created_at=datetime.datetime.utcnow()
        )

    sub.access_token = access_token
    sub.refresh_token = refresh_token
    sub.token_expires_at = datetime.datetime.utcnow() + datetime.timedelta(seconds=expires_in)
    sub.scopes = scopes
    sub.provider_user_id = zoom_user_id
    sub.provider_account_email = zoom_email
    sub.is_active = True
    sub.updated_at = datetime.datetime.utcnow()
    sub.save()

    # Synchronize Profile.apps for backward compatibility
    existing_app = next((a for a in profile.apps if a.app_id == "zoom"), None)
    if existing_app:
        existing_app.refresh_token = encode_jwt({"token": refresh_token}) if refresh_token else ""
        existing_app.access_token = access_token
        existing_app.permissions = scopes
    else:
        profile.apps.append(
            Profile.AuthorizationToken(
                app_id="zoom",
                permissions=scopes,
                refresh_token=encode_jwt({"token": refresh_token}) if refresh_token else "",
                access_token=access_token
            )
        )
    profile.save()

    redirect_target = f"{CLIENT_DOMAIN}/integrations?zoom=connected&account={zoom_email or ''}"
    return RedirectResponse(url=redirect_target)


@router.post("/webhook")
async def zoom_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Zoom Webhook Endpoint:
    1. Handles Zoom CRC endpoint validation (endpoint.url_validation).
    2. Verifies HMAC-SHA256 signature (x-zm-signature).
    3. Processes 'recording.completed' and 'recording.transcript_completed' events.
    4. Publishes to Kafka topic and initiates TranscriptJob.
    """
    raw_body = await request.body()
    print("Zoom body webhook called")
    print(raw_body)
    try:
        data = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = data.get("event")

    # 1. Zoom CRC Validation Challenge
    if event_type == "endpoint.url_validation":
        plain_token = data.get("payload", {}).get("plainToken", "")
        secret_token = os.environ.get("ZOOM_WEBHOOK_SECRET_TOKEN") or ZOOM_WEBHOOK_SECRET_TOKEN or os.environ.get("ZOOM_CLIENT_SECRET", "")
        if not secret_token:
            return JSONResponse(
                status_code=500,
                content={"error": "ZOOM_WEBHOOK_SECRET_TOKEN not configured"}
            )

        encrypted_token = hmac.new(
            secret_token.encode("utf-8"),
            plain_token.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        return JSONResponse(
            status_code=200,
            content={"plainToken": plain_token, "encryptedToken": encrypted_token}
        )

    # 2. Verify Zoom Request Signature
    signature = request.headers.get("x-zm-signature")
    timestamp = request.headers.get("x-zm-request-timestamp")
    secret_token = os.environ.get("ZOOM_WEBHOOK_SECRET_TOKEN") or ZOOM_WEBHOOK_SECRET_TOKEN or os.environ.get("ZOOM_CLIENT_SECRET", "")

    if secret_token and signature and timestamp:
        message = f"v0:{timestamp}:{raw_body.decode('utf-8')}"
        expected_sig = "v0=" + hmac.new(
            secret_token.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_sig):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Zoom webhook signature verification failed."
            )

    # 3. Process Video Recording & Transcript Completed Events
    if event_type in ["recording.completed", "recording.transcript_completed"]:
        payload = data.get("payload", {})
        obj = payload.get("object", {})
        host_id = obj.get("host_id")
        meeting_id = str(obj.get("id") or obj.get("uuid") or uuid.uuid4().hex[:8])
        topic = obj.get("topic", "Zoom Cloud Recording")

        # Map Zoom host_id to VoiceSight user
        user_id = None
        user_sub = ProviderSubscription.objects(
            provider="zoom",
            provider_user_id=host_id,
            is_active=True
        ).first()
        if user_sub and user_sub.owner_id:
            user_id = str(user_sub.owner_id.id)

        job_id = f"zoom-{meeting_id}-{uuid.uuid4().hex[:6]}"

        # Create TranscriptJob in MongoDB (in_queue)
        job = TranscriptJob(
            job_id=job_id,
            provider="zoom",
            status="in_queue",
            stage="enqueued",
            progress=10,
            provider_meeting_id=meeting_id,
            provider_meeting_topic=topic,
            payload_metadata={"event": event_type, "host_id": host_id, "meeting_id": meeting_id},
            raw_payload=payload,
            created_at=datetime.datetime.utcnow()
        )
        if user_sub and user_sub.owner_id:
            job.owner_id = user_sub.owner_id
        job.save()

        # Publish to Kafka Topic: voice-meeting-recordings
        sent_to_kafka = publish_recording_event(
            provider="zoom",
            event_type=event_type,
            job_id=job_id,
            user_id=user_id,
            payload=payload,
            topic=TOPIC_MEETING_RECORDINGS
        )

        # Fallback direct processing if Kafka cluster is offline
        if not sent_to_kafka:
            background_tasks.add_task(
                process_transcript_job,
                job_id=job_id,
                provider="zoom",
                user_id=user_id,
                payload=payload
            )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "message": "Zoom recording event enqueued successfully",
                "job_id": job_id,
                "status": "in_queue",
                "kafka_published": sent_to_kafka
            }
        )

    return JSONResponse(status_code=200, content={"status": "ignored", "event": event_type})


@router.post("/disconnect")
async def zoom_disconnect(request: Request, token: Optional[str] = Query(None)):
    """
    Disconnects Zoom integration and revokes OAuth token.
    """
    user_id = get_current_user_id(request, token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    sub = ProviderSubscription.objects(owner_id=user_id, provider="zoom", is_active=True).first()
    if not sub:
        return JSONResponse(status_code=404, content={"error": "Active Zoom integration not found"})

    # Attempt token revocation at Zoom
    if sub.access_token:
        try:
            auth_bytes = f"{ZOOM_CLIENT_ID}:{ZOOM_CLIENT_SECRET}".encode("utf-8")
            requests.post(
                ZOOM_REVOKE_URL,
                params={"token": sub.access_token},
                headers={"Authorization": f"Basic {base64.b64encode(auth_bytes).decode('utf-8')}"},
                timeout=5
            )
        except Exception:
            pass

    sub.is_active = False
    sub.save()

    # Remove from Profile.apps
    profile = Profile.objects(id=user_id).first()
    if profile:
        profile.apps = [a for a in profile.apps if a.app_id != "zoom"]
        profile.save()

    return {"message": "Zoom integration successfully disconnected"}


@router.get("/status")
async def zoom_status(request: Request, token: Optional[str] = Query(None)):
    """
    Checks if current user has an active Zoom connection.
    """
    user_id = get_current_user_id(request, token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    sub = ProviderSubscription.objects(owner_id=user_id, provider="zoom", is_active=True).first()
    return {
        "connected": sub is not None,
        "email": sub.provider_account_email if sub else None,
        "scopes": sub.scopes if sub else [],
        "subscription_id": sub.subscription_id if sub else None,
        "expires_at": sub.token_expires_at.isoformat() if sub and sub.token_expires_at else None,
        "subscription_expires_at": sub.subscription_expires_at.isoformat() if sub and sub.subscription_expires_at else None,
        "updated_at": sub.updated_at.isoformat() if sub and sub.updated_at else None
    }
