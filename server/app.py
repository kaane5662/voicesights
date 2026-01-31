from fastapi import FastAPI
from routes import sessions,integrations,chats,docs,profiles,stripe,webhooks,folders
from fastapi.middleware.cors import CORSMiddleware



app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

