import os
import json
import uuid
import datetime
from typing import Optional, Dict, Any, List
from urllib.parse import urlencode

from fastapi import APIRouter, Request, HTTPException, Response, status, Query, BackgroundTasks
from fastapi.responses import JSONResponse, PlainTextResponse, RedirectResponse
import httpx
import requests
from dotenv import load_dotenv

from config.mongo import connect_to_mongo
from models import Profile, ProviderSubscription, TranscriptJob
from helpers.jwt import decode_jwt, encode_jwt
from kafka_pipeline.producer import publish_recording_event
from kafka_pipeline.consumer import process_transcript_job
from kafka_pipeline.config import TOPIC_MEETING_RECORDINGS

load_dotenv()

router = APIRouter(prefix="/teams", tags=["provider_teams"])
connect_to_mongo()

MS_TEAMS_CLIENT_ID = os.environ.get("MS_TEAMS_CLIENT_ID", "")
MS_TEAMS_CLIENT_SECRET = os.environ.get("MS_TEAMS_CLIENT_SECRET", "")
MS_TEAMS_TENANT_ID = os.environ.get("MS_TEAMS_TENANT_ID", "organizations")
SERVER_DOMAIN = os.environ.get("SERVER_DOMAIN", "http://localhost:8000")
MS_TEAMS_REDIRECT_URI = os.environ.get(
    "MS_TEAMS_REDIRECT_URI",
    f"{SERVER_DOMAIN}/providers/teams/oauth/callback"
)
MS_TEAMS_NOTIFICATION_URI =f"{SERVER_DOMAIN}/providers/teams/notifications"

MS_TEAMS_CLIENT_STATE = os.environ.get("MS_TEAMS_CLIENT_STATE", "voicesight_ms_secret_state")
CLIENT_DOMAIN = os.environ.get("CLIENT_DOMAIN", "http://localhost:3000")

MS_AUTH_URL = f"https://login.microsoftonline.com/{MS_TEAMS_TENANT_ID or 'organizations'}/oauth2/v2.0/authorize"
MS_TOKEN_URL = f"https://login.microsoftonline.com/{MS_TEAMS_TENANT_ID or 'organizations'}/oauth2/v2.0/token"
MS_GRAPH_URL = "https://graph.microsoft.com/v1.0"

MS_TEAMS_SCOPES = [
    "https://graph.microsoft.com/OnlineMeetings.Read",
    "https://graph.microsoft.com/OnlineMeetingRecording.Read.All",
    "https://graph.microsoft.com/OnlineMeetingTranscript.Read.All",
    "https://graph.microsoft.com/User.Read",
    "offline_access",
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
async def teams_oauth_login(request: Request, token: Optional[str] = Query(None)):
    """
    Initiates Microsoft Graph OAuth 2.0 flow for Microsoft Teams meetings and transcripts.
    """
    user_id = get_current_user_id(request, token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required before connecting Microsoft Teams."
        )

    state_payload = {"user_id": user_id, "nonce": uuid.uuid4().hex}
    state_str = encode_jwt(state_payload)

    params = {
        "client_id": MS_TEAMS_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": MS_TEAMS_REDIRECT_URI,
        "response_mode": "query",
        "scope": " ".join(MS_TEAMS_SCOPES),
        "state": state_str,
        "prompt": "consent",
    }

    auth_url = f"{MS_AUTH_URL}?{urlencode(params)}"
    print(f"Teams auth url: {auth_url}")
    accept_header = request.headers.get("accept", "")
    if "text/html" in accept_header or request.query_params.get("redirect") == "true":
        return RedirectResponse(url=auth_url)
    return {"url": auth_url, "state": state_str}


@router.get("/oauth/callback")
async def teams_oauth_callback(
    request: Request,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None)
):
    """
    Handles Microsoft Teams OAuth callback, exchanges code for Graph tokens,
    creates ProviderSubscription, and registers Graph change notification webhook.
    """
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Microsoft Teams authorization failed: {error} - {error_description}"
        )
    if not code or not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing code or state parameters."
        )

    state_data = decode_jwt(state)
    print('oauth callback')
    print(state_data)
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

    # Exchange authorization code for Microsoft Graph tokens
    token_resp = requests.post(
        MS_TOKEN_URL,
        data={
            "client_id": MS_TEAMS_CLIENT_ID,
            "client_secret": MS_TEAMS_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": MS_TEAMS_REDIRECT_URI,
            "scope": " ".join(MS_TEAMS_SCOPES)
        },
        timeout=10
    )
    print("Generated access token respnse")
    print(token_resp.json())
    if token_resp.status_code != 200:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "Failed to exchange Microsoft token", "details": token_resp.text}
        )

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in", 3600)
    scopes = token_data.get("scope", "").split()

    # Retrieve user's Microsoft Graph profile
    user_info_resp = requests.get(
        f"{MS_GRAPH_URL}/me",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10
    )
    print("User info response")
    print(f"{user_info_resp.json()}")
    ms_user_id = None
    ms_email = None
    if user_info_resp.status_code == 200:
        u_info = user_info_resp.json()
        ms_user_id = u_info.get("id")
        ms_email = u_info.get("mail") or u_info.get("userPrincipalName")

    # Upsert ProviderSubscription document
    sub = ProviderSubscription.objects(owner_id=profile, provider="teams").first()
    if not sub:
        sub = ProviderSubscription(
            owner_id=profile,
            provider="teams",
            created_at=datetime.datetime.utcnow()
        )

    client_state_secret = uuid.uuid4().hex
    sub.access_token = access_token
    if refresh_token:
        sub.refresh_token = refresh_token
    sub.token_expires_at = datetime.datetime.utcnow() + datetime.timedelta(seconds=expires_in)
    sub.scopes = scopes
    sub.provider_user_id = ms_user_id
    sub.provider_account_email = ms_email
    sub.client_state = client_state_secret
    sub.is_active = True
    sub.updated_at = datetime.datetime.utcnow()
    sub.save()

    # Automatically register Microsoft Graph Webhook Subscription
    try:
        webhook_target = f"{SERVER_DOMAIN}/providers/teams/webhook"
        # Subscriptions for onlineMeetings expire in max ~4230 minutes (~2.9 days)
        expiration = (datetime.datetime.utcnow() + datetime.timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        print(MS_TEAMS_NOTIFICATION_URI, 'notification uri')
        async with httpx.AsyncClient() as client:
            sub_resp = await client.post(
                f"{MS_GRAPH_URL}/subscriptions",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "changeType": "created",
                    "notificationUrl": webhook_target,
                    "resource": f"/users/{ms_user_id}/onlineMeetings/getAllTranscripts",
                    "expirationDateTime": expiration,
                    "clientState": client_state_secret
                },
            )
   
        
        print("Status:", sub_resp.status_code)
        print("Response:", sub_resp.text)
        sub_resp.raise_for_status()
        print("Successfully subscribed to event")
        print(sub_resp.json())
        if sub_resp.status_code in [200, 201]:
            s_data = sub_resp.json()
            sub.subscription_id = s_data.get("id")
            sub.subscription_resource = s_data.get("resource")
            sub.save()
    except Exception as e:
        print(f"[MS Teams] Graph subscription notice: {e}")

    # Synchronize Profile.apps for backward compatibility
    existing_app = next((a for a in profile.apps if a.app_id == "teams"), None)
    if existing_app:
        if refresh_token:
            existing_app.refresh_token = encode_jwt({"token": refresh_token})
        existing_app.access_token = access_token
        existing_app.permissions = scopes
    else:
        profile.apps.append(
            Profile.AuthorizationToken(
                app_id="teams",
                permissions=scopes,
                refresh_token=encode_jwt({"token": refresh_token}) if refresh_token else "",
                access_token=access_token
            )
        )
    profile.save()

    redirect_target = f"{CLIENT_DOMAIN}/integrations?teams=connected&account={ms_email or ''}"
    return RedirectResponse(url=redirect_target)


@router.api_route("/webhook", methods=["GET", "POST"])
async def teams_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    validationToken: Optional[str] = Query(None)
):
    """
    Microsoft Teams / Graph Webhook Endpoint:
    1. Responds to Graph subscription validation challenge (?validationToken=...) with plain text token.
    2. Verifies 'clientState' token in notification payload.
    3. Handles transcript and meeting recording change notifications.
    4. Enqueues event into Kafka topic and initiates TranscriptJob.
    """
    # 1. Microsoft Graph Validation Token Challenge
    if validationToken:
        print("Valid validation token")
        print(validationToken)
        # Must return plain text HTTP 200 with the exact validation token
        return PlainTextResponse(content=validationToken, status_code=200)

    # Check for body content
    raw_body = await request.body()
    print('Teams Webhook called ')
    print(raw_body)
    if not raw_body:
        return PlainTextResponse(content="OK", status_code=200)

    try:
        data = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    notifications: List[Dict[str, Any]] = data.get("value", [])
    processed_jobs = []

    for item in notifications:
        subscription_id = item.get("subscriptionId")
        client_state = item.get("clientState")
        resource = item.get("resource", "")
        change_type = item.get("changeType", "")
        resource_data = item.get("resourceData", {})

        # Find matching subscription
        user_sub = None
        if subscription_id:
            user_sub = ProviderSubscription.objects(
                provider="teams",
                subscription_id=subscription_id,
                is_active=True
            ).first()

        if not user_sub and client_state:
            user_sub = ProviderSubscription.objects(
                provider="teams",
                client_state=client_state,
                is_active=True
            ).first()

        # Validate clientState if user_sub configured
        if user_sub and user_sub.client_state and client_state:
            if user_sub.client_state != client_state:
                continue

        user_id = str(user_sub.owner_id.id) if user_sub and user_sub.owner_id else None
        meeting_id = resource_data.get("meetingId") or str(uuid.uuid4().hex[:8])
        job_id = f"teams-{meeting_id}-{uuid.uuid4().hex[:6]}"

        payload = {
            "subscription_id": subscription_id,
            "resource": resource,
            "change_type": change_type,
            "resourceData": resource_data,
            "meeting_id": meeting_id
        }

        # Create TranscriptJob record (in_queue)
        job = TranscriptJob(
            job_id=job_id,
            provider="teams",
            status="in_queue",
            stage="enqueued",
            progress=10,
            provider_meeting_id=meeting_id,
            provider_meeting_topic=f"Teams Meeting {meeting_id}",
            payload_metadata=payload,
            raw_payload=item,
            created_at=datetime.datetime.utcnow()
        )
        if user_sub and user_sub.owner_id:
            job.owner_id = user_sub.owner_id
        job.save()

        # Publish to Kafka
        sent_to_kafka = publish_recording_event(
            provider="teams",
            event_type=f"teams.{change_type}",
            job_id=job_id,
            user_id=user_id,
            payload=payload,
            topic=TOPIC_MEETING_RECORDINGS
        )

        # Fallback background execution
        if not sent_to_kafka:
            background_tasks.add_task(
                process_transcript_job,
                job_id=job_id,
                provider="teams",
                user_id=user_id,
                payload=payload
            )

        processed_jobs.append(job_id)

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"status": "accepted", "jobs": processed_jobs}
    )

@router.post("/notifications")
async def teams_notifications(request: Request):
    # Microsoft Graph subscription validation
    validation_token = request.query_params.get("validationToken")
    print(
        "Teams notification received: subscriptionId",
    )

    if validation_token is not None:
        return PlainTextResponse(validation_token, status_code=200)

    return Response(status_code=202)

@router.post("/subscribe")
async def teams_subscribe(request: Request, token: Optional[str] = Query(None)):
    """
    Explicitly creates or renews Microsoft Graph subscription for online meetings/transcripts.
    """
    user_id = get_current_user_id(request, token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    sub = ProviderSubscription.objects(owner_id=user_id, provider="teams", is_active=True).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Active Microsoft Teams integration not found")

    webhook_target = f"{SERVER_DOMAIN}/providers/teams/webhook"
    expiration = (datetime.datetime.utcnow() + datetime.timedelta(minutes=45)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    client_state = sub.client_state or uuid.uuid4().hex
    print(f"Access Token: {sub.access_token}")
    print(f"Provider: {sub.provider_user_id}")
    \
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{MS_GRAPH_URL}/subscriptions",
            headers={
                "Authorization": f"Bearer {sub.access_token}",
                "Content-Type": "application/json"
            },
            json={
                "changeType": "created",
                "notificationUrl": webhook_target,
                "resource": f"/users/{sub.provider_user_id or 'me'}/events",
                # "lifecycleNotificationUrl": webhook_target,
                "expirationDateTime": expiration,
                "clientState": client_state
            }
        )

    print(resp.json())
    if resp.status_code in [200, 201]:
        data = resp.json()
        sub.subscription_id = data.get("id")
        sub.subscription_resource = data.get("resource")
        sub.client_state = client_state
        sub.save()
        return {"message": "Microsoft Graph subscription created successfully", "subscription": data}
    else:
        print(f'error {resp.text}')
        return JSONResponse(status_code=resp.status_code, content={"error": resp.text})


@router.post("/disconnect")
async def teams_disconnect(request: Request, token: Optional[str] = Query(None)):
    """
    Disconnects Microsoft Teams integration, deletes Graph subscription, and deactivates record.
    """
    user_id = get_current_user_id(request, token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    sub = ProviderSubscription.objects(owner_id=user_id, provider="teams", is_active=True).first()
    if not sub:
        return JSONResponse(status_code=404, content={"error": "Active Teams integration not found"})

    # Try deleting subscription from Graph
    if sub.subscription_id and sub.access_token:
        try:
            requests.delete(
                f"{MS_GRAPH_URL}/subscriptions/{sub.subscription_id}",
                headers={"Authorization": f"Bearer {sub.access_token}"},
                timeout=5
            )
        except Exception:
            pass

    sub.is_active = False
    sub.save()

    profile = Profile.objects(id=user_id).first()
    if profile:
        profile.apps = [a for a in profile.apps if a.app_id != "teams"]
        profile.save()

    return {"message": "Microsoft Teams integration successfully disconnected"}


@router.get("/status")
async def teams_status(request: Request, token: Optional[str] = Query(None)):
    """
    Checks if current user has an active Teams connection.
    """
    user_id = get_current_user_id(request, token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    sub = ProviderSubscription.objects(owner_id=user_id, provider="teams", is_active=True).first()
    return {
        "connected": sub is not None,
        "email": sub.provider_account_email if sub else None,
        "subscription_id": sub.subscription_id if sub else None,
        "scopes": sub.scopes if sub else [],
        "expires_at": sub.token_expires_at.isoformat() if sub and sub.token_expires_at else None,
        "subscription_expires_at": sub.subscription_expires_at.isoformat() if sub and sub.subscription_expires_at else None,
        "updated_at": sub.updated_at.isoformat() if sub and sub.updated_at else None
    }
