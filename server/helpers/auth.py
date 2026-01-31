# INSERT_YOUR_CODE
from fastapi import Request, HTTPException, status, Depends
from functools import wraps
from helpers.jwt import decode_jwt

def login_required(func):
    @wraps(func)
    async def decorated(*args, **kwargs):
        # Get Request object (FastAPI passes in as a parameter)
        # try to find it in *args or **kwargs
        
        request: Request = kwargs.get("request")
        if request is None:
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
        if request is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Request object missing from route."
            )

        token = request.cookies.get("auth_token")
        print('token',token)
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization token missing or invalid",
                headers={"WWW-Authenticate": "Bearer"},
            )
        payload = decode_jwt(token)
        print(payload)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # Optionally, inject user information into kwargs
        kwargs['user_id'] = payload["sub"]
        return await func(*args, **kwargs)
    return decorated
