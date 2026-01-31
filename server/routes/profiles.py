# INSERT_YOUR_CODE
from fastapi import APIRouter, HTTPException, Request, status, Query, Body
from fastapi.responses import JSONResponse

from openai import OpenAI
from pydantic import BaseModel, Field

from config.mongo import connect_to_mongo

from models import ChatSession, Session, SessionDoc

import os

# from tools import add_google_calendar_events_rest, create_linear_issues, get_google_calendars, get_linear_teams
import stripe

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
router = APIRouter(prefix="/profiles", tags=["profiles"])
connect_to_mongo()





#in client if not chat_session id create new one, and then load it

# INSERT_YOUR_CODE

from pydantic import BaseModel, EmailStr, validator
from fastapi import Depends

from helpers.jwt import encode_jwt, decode_jwt
from helpers.auth import login_required
from models import Profile  # assumes a Profile(user) model is available
import datetime

# Base Pydantic model
class UserBase(BaseModel):
    email: EmailStr
    

class SignupModel(UserBase):
    password: str
    confirm_password: str

    @validator('password')
    def password_min_length(cls, v):
        if len(v) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
        return v

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise HTTPException(status_code=400, detail="Passwords must match")
        return v

class LoginModel(UserBase):
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# INSERT_YOUR_CODE



@router.get("/")
@login_required
async def get_profile(request: Request = None,
    user_id: str = None):
    profile = Profile.objects(id=user_id).first()
    if not profile:
        raise JSONResponse(status_code=404, content={"error":"Profile not found"})

    return JSONResponse(content={'profile':profile.to_dict()})



@router.post("/signup", response_model=TokenResponse)
async def signup(user: SignupModel):
    # Check if user exists
    existing = Profile.objects(email=user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    # JWT-encrypt the password (note: demo only; this should NOT be used in production!)
    hashed_pw = encode_jwt({"pw": user.password, "email": user.email})

    profile = Profile(email=user.email, password=hashed_pw)
    profile.save()
    now = datetime.datetime.utcnow()
    exp_minutes = 60 * 24 * 7  # Token expires in 7 days (adjust as needed)
    exp_time = now + datetime.timedelta(minutes=exp_minutes)
    payload = {
        "sub": str(profile.id),
        "email": profile.email,
        # "iat": int(now.timestamp()),
        # "exp": int(exp_time.timestamp())
    }
    access_token = encode_jwt(payload)
    print(access_token)
    res = JSONResponse(content={"message":"Signup successful"})
    res.set_cookie(
        key="auth_token",
        value=access_token,
        httponly=True,
        secure=False,  # Set True if using HTTPS
        samesite="lax"
    )
    return res
    

@router.post("/login", response_model=TokenResponse)
async def login(user: LoginModel):
    profile = Profile.objects(email=user.email).first()
    if not profile:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    # Decrypt and check password match
    pw_payload = decode_jwt(profile.password)
    if not pw_payload or pw_payload.get("pw") != user.password or pw_payload.get("email") != user.email:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    now = datetime.datetime.utcnow()
    exp_minutes = 60 * 24 * 7  # Token expires in 7 days (adjust as needed)
    exp_time = now + datetime.timedelta(minutes=exp_minutes)
    payload = {
        "sub": str(profile.id),
        "email": profile.email,
        # "iat": int(now.timestamp()),
        # "exp": int(exp_time.timestamp())
    }
    access_token = encode_jwt(payload)
    # INSERT_YOUR_CODE
    # Set cookie auth_token to access token
    res = JSONResponse(content={"message":"Login successful"})
    res.set_cookie(
        key="auth_token",
        value=access_token,
        httponly=True,
        secure=False,  # Set True if using HTTPS
        samesite="lax"
    )
    return res
    
    
@router.post("/logout")
async def logout(request: Request, user=Depends(login_required)):
    # JWT logout: client should delete token. Server can blacklist (not shown).
    return JSONResponse(status_code=200, content={"message": "Logged out successfully."})







@router.get("/statistics")
@login_required
async def get_profile_statistics(request: Request = None,
    user_id: str = None):
    """
    Return the 3 most recent sessions, chat sessions, and notes for a given user.
    """

    print('ifueriu',user_id)
    # INSERT_YOUR_CODE

    # Aggregate stats
    # Use .only to select required fields, then aggregate in Python
    session_qs = Session.objects(owner_id=user_id).only('total_duration', 'word_count')
    total_sessions = session_qs.count()
    total_session_time = sum(s.total_duration or 0 for s in session_qs)
    total_words = sum(s.word_count or 0 for s in session_qs)
    stats = {
        "total_sessions": total_sessions,
        "total_session_time": total_session_time,
        "total_words": total_words
    }
    
    # Get 3 recent sessions
    sessions = (
        Session.objects(owner_id=user_id)
        .order_by("-created_at")
        .limit(3)
    )
    session_list = [s.to_dict() for s in sessions]

    # Get 3 recent chat sessions
    chats = (
        ChatSession.objects(owner_id=user_id)
        .order_by("-created_at")
        .limit(3)
    )
    chat_list = [c.to_dict() for c in chats]

    # Get 3 recent notes (SessionDoc)
    notes = (
        SessionDoc.objects(owner_id=user_id)
        .order_by("-created_at")
        .limit(3)
    )
    note_list = [n.to_dict() for n in notes]

    return {
        "recent_sessions": session_list,
        "recent_chats": chat_list,
        "recent_notes": note_list,
        'stats': stats,
    }

    # INSERT_YOUR_CODE




from fastapi import HTTPException

from pydantic import BaseModel, root_validator

class ResetPasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @root_validator(pre=True)
    def check_passwords(cls, values):
        new_password = values.get('new_password')
        confirm_password = values.get('confirm_password')
        if new_password is not None:
            if len(new_password) < 8:
                raise HTTPException(
                    status_code=400,
                    detail="Password must be at least 8 characters"
                )
        if new_password is not None and confirm_password is not None:
            if new_password != confirm_password:
                raise HTTPException(
                    status_code=400,
                    detail="Confirm password must match new password"
                )
        return values


class ChangeEmailRequest(BaseModel):
    new_email: EmailStr

@router.post("/reset-password")
@login_required
async def reset_password(request: Request, body: ResetPasswordRequest, user_id: str = None):
    profile = Profile.objects(id=user_id).first()
    if not profile:
        return JSONResponse(status_code=404, content={"error": "Failed to find profile"})

    decoded = decode_jwt(profile.password)
    if decoded['pw'] != body.current_password or decoded['email'] != profile.email:
        return JSONResponse(status_code=401, content={"error": "Current password is incorrect"})
    hashed_pw = encode_jwt({"pw": body.new_password, "email": profile.email})
   
    profile.password = hashed_pw
    profile.save()
    return JSONResponse(content={"success": True, "message": "Password changed successfully."})

@router.post("/change-email")
@login_required
async def change_email(request: Request, body: ChangeEmailRequest, user_id: str = None):
    print('ojegojeroj',user_id)
    profile = Profile.objects(id=user_id).first()
    decoded = decode_jwt(profile.password)

    if not profile:
        return JSONResponse(status_code=404, content={"error": "Failed to find profile"})
    decoded['email']= body.new_email
    enc = encode_jwt(decoded)

    # Check if the new email is already used
    if Profile.objects(email=body.new_email).first():
        raise HTTPException(status_code=400, content={"error": "User with email already exists"})

    profile.email = body.new_email
    profile.password = enc
    profile.save()
    return {"success": True, "message": "Email updated successfully.", "new_email": profile.email}


