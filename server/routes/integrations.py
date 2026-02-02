from ast import List
from urllib.parse import urlencode
from fastapi import APIRouter, HTTPException, Request,status,Query
from fastapi.responses import JSONResponse, PlainTextResponse, RedirectResponse
from pydantic import BaseModel, Field
from models import Profile, Session
from openai import OpenAI
import json
import os
import httpx
import requests
from dotenv import load_dotenv
import os
import json
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
import gspread

from config.mongo import connect_to_mongo
from helpers.jwt import decode_jwt, encode_jwt
from schema import TranscriptPartitionModel
from helpers.auth import login_required
load_dotenv()

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
router = APIRouter(prefix="/integrations", tags=["sessions"])
print(os.environ.get("OPENAI_API_KEY"))
Sheets_Scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    # "https://www.googleapis.com/auth/drive.file",

    # "https://www.googleapis.com/auth/drive.file",
    ]

class TokenInput(BaseModel):
    app_id: str = Field(..., description="App integration ID, e.g. 'google-sheets', 'linear'")
    permissions: list[str] = Field(..., description="List of permission strings for the app (e.g. ['read', 'write'])")
    action: str = Field(..., description="Action to take with the token, e.g. 'connect' or 'disconnect'")

connect_to_mongo()

@router.post("/google")
@login_required
async def google_oauth(input:TokenInput,request: Request = None,
    user_id: str = None):
    print(input.permissions)
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": os.environ.get('GOOGLE_CLIENT_ID'),
                "client_secret": os.environ.get('GOOGLE_CLIENT_SECRET'),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri":  "https://oauth2.googleapis.com/token",
               
            }
        },
        scopes=input.permissions,
        state = json.dumps({'user_id': user_id, 'google_type': input.app_id}),
        redirect_uri=os.environ.get("GOOGLE_REDIRECT_URI"),
    )

    auth_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
    )
    
    

    # session["state"] = state
    return {'url':auth_url}

@router.get("/google/callback")
def google_callback(request:Request):
    code = request.query_params.get("code")
    state_data = json.loads(request.query_params.get("state"))
    google_type = state_data["google_type"]
    user_id = state_data["user_id"]
    
    # Correctly parse scopes from query parameters:
    # Handles both multiple ?scope= param and one space-delimited scope string
    raw_scopes = request.query_params.getlist("scope")  # may be one long space-delimited string, or several items if provider sends multiple
    scopes = []
    for entry in raw_scopes:
        if entry:
            # If space-delimited, split; if already single, works as singleton
            scopes.extend(entry.split(" "))
    # Remove any empties in case of double space
    scopes = [s for s in scopes if s]
    print(code)
    print(google_type)
    print(scopes)
    if not code or not state_data:
        return PlainTextResponse("Invalid OAuth callback", status_code=400)

    # scopes_arr = scopes.split("%20")
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": os.environ.get('GOOGLE_CLIENT_ID'),
                "client_secret": os.environ.get('GOOGLE_CLIENT_SECRET'),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri":  "https://oauth2.googleapis.com/token",
                
                
            }
        },
        scopes=scopes,
        redirect_uri=os.environ.get('GOOGLE_REDIRECT_URI'),
    )

    flow.fetch_token(code=code)
    creds = flow.credentials
    
    if not creds.refresh_token:
        return PlainTextResponse(
            "No refresh token issued. Revoke app access and try again.",
            status_code=400,
        )
    print('r_token', creds.refresh_token)
    encrypted_token = encode_jwt({'token':creds.refresh_token})
    profile = Profile.objects(id=user_id).first()
    google_index = next((i for i, app in enumerate(profile.apps) if app.app_id == google_type), -1)
    # Filter profile.integrations (which is a list) to find doc where id is 'google-sheets'
    print('google_index',google_index)
    if google_index !=-1:
        profile.apps[google_index].refresh_token = encrypted_token
        profile.apps[google_index].permissions = creds.scopes
    else:

        new_token = Profile.AuthorizationToken(
            refresh_token=encrypted_token,
            app_id=google_type,
            permissions=creds.scopes
        )
        if profile.apps:
            profile.apps.append(new_token)
        else:
            profile.apps = [new_token]
    
    profile.save()
    
    # ✅ STORE ONLY REFRESH TOKEN
    # USER_DB[user_id] = {
    #     "refresh_token": creds.refresh_token
    # }
    return RedirectResponse("http://localhost:3000/apps")

  
LINEAR_CLIENT_ID = os.environ["LINEAR_CLIENT_ID"]
LINEAR_CLIENT_SECRET = os.environ["LINEAR_CLIENT_SECRET"]
LINEAR_REDIRECT_URI = os.environ["LINEAR_REDIRECT_URI"]
LINEAR_SCOPES = "read,write,issues:create"






@router.post("/linear")
@login_required
async def linear_auth(input:TokenInput, request: Request = None,
user_id: str = None):

    if input.app_id != 'linear':
    
        return JSONResponse({"error": "Not found"}, status_code=404)

    if input.action == 'disconnect':
        return JSONResponse(content={'message':"Dusconnecting"})

    perms = ",".join(input.permissions)

    params = {
        "client_id": LINEAR_CLIENT_ID,
        "scope": perms,
        "redirect_uri": LINEAR_REDIRECT_URI,
        "response_type": "code",
        # 'perms': perms
        "state": user_id
    }
    url = "https://linear.app/oauth/authorize?" + urlencode(params)
    return {'url':url}

# ------------------
# 2️⃣ Callback to store refresh token
# ------------------




@router.get("/apps")
@login_required
async def get_app_integrations(request: Request = None,
    user_id: str = None):
    """
    Get the app integrations (OAuth tokens and permissions) from the user's profile.
    Replace the default user_id for production multi-user auth.
    """
    profile = Profile.objects(id=user_id).first()
    if not profile:
        return JSONResponse(content={"error": "Profile not found"}, status_code=404)
    # Return a list of the user's connected apps with permissions (not refresh tokens)
    integrations = []
    for app in profile.apps or []:
        integrations.append({
            "app_id": app.app_id,
            "permissions": app.permissions,
            # Do not expose refresh_token publicly! But you can include the field (masked or omitted)
            # "refresh_token": app.refresh_token
        })
    return {"apps": integrations}


@router.get("/linear/callback")
def linear_callback(request: Request):
    print(request.query_params.items())
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    perms = request._query_params.get('perms')
    if not code:
        return JSONResponse({"error": "invalid callback"}, status_code=400)

    # try:
    #     user_id = decode_state_jwt(state)
    # except Exception:
    #     return JSONResponse({"error": "invalid state"}, status_code=400)

    token_resp = requests.post(
        "https://api.linear.app/oauth/token",
        data=urlencode({
            "grant_type": "authorization_code",
            "client_id": LINEAR_CLIENT_ID,
            "client_secret": LINEAR_CLIENT_SECRET,
            "code": code,
            "redirect_uri": LINEAR_REDIRECT_URI
        }),
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    ).json()
    print(token_resp)
    # print(perms)
    token = token_resp["refresh_token"]
    encrypted_token = encode_jwt({'token':token})
    profile = Profile.objects(id=state).first()
    linear_index = next((i for i, app in enumerate(profile.apps) if app.app_id == 'linear'), -1)
    linear_app = next((app for app in profile.apps if app.app_id == 'linear'), None)
    # Filter profile.integrations (which is a list) to find doc where id is 'linear'
    print('sheets_index',linear_index)
    if linear_index !=-1:
        profile.apps[linear_index].refresh_token = encrypted_token
        profile.apps[linear_index].permissions = token_resp['scope'].split(" ")
    else:

        new_token = Profile.AuthorizationToken(
            refresh_token=encrypted_token,
            app_id='linear',
            permissions=token_resp['scope'].split(" ")
        )
        if profile.apps:
            profile.apps.append(new_token)
        else:
            profile.apps = [new_token]
    
    profile.save()
    # USER_DB[user_id] = {"refresh_token": token_resp["refresh_token"]}
    # INSERT_YOUR_CODE
    return RedirectResponse("http://localhost:3000/apps")
    return JSONResponse({"status": "linear refresh token stored", "user_id": '1'})

# ------------------
# 3️⃣ Test: Create an Issue


# INSERT_YOUR_CODE

# --- Slack OAuth integration ---

SLACK_CLIENT_ID = os.environ.get("SLACK_CLIENT_ID")
SLACK_CLIENT_SECRET = os.environ.get("SLACK_CLIENT_SECRET")
SLACK_REDIRECT_URI = os.environ.get("SLACK_REDIRECT_URI")
SLACK_SCOPES = ["channels:read", "chat:write", "users:read"]  # Default, can be overridden by user request

@router.post("/slack")
@login_required
async def slack_auth(input: TokenInput, request: Request = None, user_id: str = None):
    """
    Begins Slack OAuth.
    """
    if input.app_id != "slack":
        return JSONResponse({"error": "Not found"}, status_code=404)

    if input.action == "disconnect":
        return JSONResponse(content={'message': "Disconnecting"})
    
    scopes = ",".join(input.permissions or SLACK_SCOPES)
    params = {
        "client_id": SLACK_CLIENT_ID,
        "scope": scopes,
        "redirect_uri": SLACK_REDIRECT_URI,
        "state": user_id,
        "user_scope": ""  # Optional: can be populated for user token scopes
    }
    url = "https://slack.com/oauth/v2/authorize?" + urlencode(params)
    return {"url": url}

@router.get("/slack/callback")
def slack_callback(request: Request):
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    if not code or not state:
        return JSONResponse({"error": "invalid slack callback"}, status_code=400)
    
    # Exchange code for access token
    token_resp = requests.post(
        "https://slack.com/api/oauth.v2.access",
        data={
            "client_id": SLACK_CLIENT_ID,
            "client_secret": SLACK_CLIENT_SECRET,
            "code": code,
            "redirect_uri": SLACK_REDIRECT_URI
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    ).json()
    print("Slack token_resp", token_resp)
    if not token_resp.get("ok"):
        return JSONResponse({"error": "Slack OAuth error", "details": token_resp}, status_code=400)
    # Slack may not have a refresh_token; store access_token
    access_token = token_resp.get("access_token")
    scope = token_resp.get("scope", "")
    team = token_resp.get("team", {})
    team_id = team.get("id") if isinstance(team, dict) else None

    encrypted_token = encode_jwt({'token': access_token})
    profile = Profile.objects(id=state).first()
    slack_index = next((i for i, app in enumerate(profile.apps) if app.app_id == "slack"), -1)
    print("slack_index", slack_index)
    if slack_index != -1:
        profile.apps[slack_index].refresh_token = encrypted_token
        profile.apps[slack_index].permissions = scope.split(",")
    else:
        new_token = Profile.AuthorizationToken(
            refresh_token=encrypted_token,
            app_id='slack',
            permissions=scope.split(",")
        )
        if profile.apps:
            profile.apps.append(new_token)
        else:
            profile.apps = [new_token]
    profile.save()
    return RedirectResponse("http://localhost:3000/apps")
































# later when trello oauth out

# ATL_CLIENT_ID = os.environ.get("ATL_CLIENT_ID")
# ATL_CLIENT_SECRET = os.environ.get("ATL_CLIENT_SECRET")

# ATL_REDIRECT_URI = os.environ.get("ATL_REDIRECT_URI")
# ATL_SCOPES = "read,write,account"

# @router.post('/trello')
# async def auth_trello():
#     TRELLO_AUTH_URL = "https://trello.com/1/authorize"

#     params = {
#         "response_type": "code",
#         "client_id": ATL_CLIENT_ID,
#         "redirect_uri": ATL_REDIRECT_URI,
#         "scope": ATL_SCOPES,
#         # "state": state_jwt,
#         "prompt": "consent",  # force refresh token
#     }
    
#     auth_url = f"https://auth.atlassian.com/authorize?{urlencode(params)}"
    
    
#     return {"url": auth_url}

# @router.post("/trello/callback")
# async def trello_callback(request: Request):
    
#     code = request.query_params.get("code")
#     state = request.query_params.get("state")

#     if not code or not state:
#         return JSONResponse({"error": "Invalid callback"}, status_code=400)

#     # try:
#     #     user_id = decode_state_jwt(state)
#     # except JWTError:
#     #     return JSONResponse({"error": "Invalid or expired state"}, status_code=400)

#     # Exchange code for access + refresh tokens
#     token_resp = requests.post(
#         "https://auth.atlassian.com/oauth/token",
#         json={
#             "grant_type": "authorization_code",
#             "client_id": ATL_CLIENT_ID,
#             "client_secret": ATL_CLIENT_SECRET,
#             "code": code,
#             "redirect_uri": ATL_REDIRECT_URI,
#         }
#     ).json()
#     if "refresh_token" not in token_resp:
#         return JSONResponse({"error": "No refresh token returned"}, status_code=400)
#     token = token_resp['refresh_token']
#     encrypted_token = encode_jwt({'token':token})
#     profile = Profile.objects(id='695083dc194beb4c817c15e7').first()
#     trello_index = next((i for i, app in enumerate(profile.apps) if app.app_id == 'trello'), -1)
#     # Filter profile.integrations (which is a list) to find doc where id is 'google-sheets'
#     print('trello_index',trello_index)
#     if trello_index !=-1:
#         profile.apps[trello_index].refresh_token = encrypted_token
#     else:

#         new_token = Profile.AuthorizationToken(
#             refresh_token=encrypted_token,
#             app_id='trello',
#             permissions=['read', 'write']
#         )
#         if profile.apps:
#             profile.apps.append(new_token)
#         else:
#             profile.apps = [new_token]
    
#     profile.save()

#     return {"status": "stored"}
