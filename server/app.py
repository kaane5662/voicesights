from fastapi import FastAPI
from routes import sessions,integrations,chats,docs,profiles,stripe,webhooks,folders
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler
import uvicorn


import os

from config.rate_limiter import limiter

app = FastAPI()

app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","https://voicesights.xyz", "https://www.voicesights.xyz"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    SlowAPIMiddleware
)

app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler
)

app.include_router(sessions.router)
app.include_router(integrations.router)
app.include_router(chats.router)
app.include_router(docs.router)
app.include_router(profiles.router)
app.include_router(stripe.router)
app.include_router(webhooks.router)
app.include_router(folders.router)

@app.get("/")
async def read_root():
    return {"message": "Hello, World!"}

if __name__ == "__main__":
    env = os.environ.get("ENV", "dev")
    # If ENV=prod, bind to 0.0.0.0; else default to development mode (localhost)
    if env.lower() == "prod":
        uvicorn.run("app:app", host="0.0.0.0", port=8000)
    else:
        uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)

