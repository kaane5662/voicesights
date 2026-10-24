import datetime
from typing import List
from fastapi import APIRouter, HTTPException, Request, status, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from models import Session, SessionDoc, ChatSession
from helpers.auth import login_required
from openai import OpenAI
import json
import os
import httpx
import requests
from dotenv import load_dotenv
import asyncio
from mongoengine import get_connection
from mongoengine.context_managers import switch_db
from config.mongo import connect_to_mongo
from schema import TranscriptPartitionModel
from helpers.pinecone import query_pinecone, query_pinecone_threshold
from config.rate_limiter import limiter
from tasks import (
    dispatch_celery_task,
    process_transcript_partition_task,
    process_finish_session_task
)

load_dotenv()

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY") or "dummy")
router = APIRouter(prefix="/sessions", tags=["sessions"])

connect_to_mongo()


@router.post("/")
@login_required
@limiter.limit("5/10minutes")
async def create_session(
    request: Request = None,
    user_id: str = None
):
    try:
        session = Session(
            title="Untitled Session",
            created_at=datetime.datetime.utcnow(),
            total_duration=0,
            word_count=0,
            speakers=[],
            finished=False,
            status="active",
            tags=[],
            ai_overview="",
            transcript=[],
            owner_id=user_id
        )
        session.save()
        data = session.to_dict()
        
        return JSONResponse(content={"message": "Session created", "session": data}, status_code=201)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@router.post("/{session_id}/finish")
@login_required
async def finish_recording(
    session_id: str, 
    request: Request = None,
    user_id: str = None
):
    """
    Marks the session as finished and queues the expensive AI operations
    (title, ai_overview, chat & doc suggestions) to a Celery background task.
    """
    try:
        data = await request.json()
        session = Session.objects(id=session_id, owner_id=user_id).first()

        if not session:
            return JSONResponse(content={"error": "No valid session"}, status_code=401)

        word_count = data.get('word_count', session.word_count or 0)
        total_duration = data.get('total_duration', session.total_duration or 0)

        # Mark session finished and processing in DB
        session.finished = True
        session.status = "processing"
        session.word_count = word_count
        session.total_duration = total_duration
        session.save()

        # Offload expensive title, overview, and suggestion generation to Celery task
        dispatch_celery_task(
            process_finish_session_task,
            session_id,
            user_id,
            word_count,
            total_duration
        )

        return JSONResponse(
            content={
                "message": "Session finished and processing queued",
                "status": "processing",
                "session": session.to_dict()
            },
            status_code=200
        )
    except Exception as e:
        print("Error in finish_recording:", e)
        return JSONResponse(content={"error": "Unexpected error occured"}, status_code=500)


@router.post("/{session_id}/save")
@login_required
async def save_transcript_partition(
    session_id: str,
    data: TranscriptPartitionModel,
    request: Request = None,
    user_id: str = None
):
    """
    Appends new transcript entries directly to session.transcript in MongoDB,
    and offloads expensive Pinecone embedding and partition AI summary to a Celery background task.
    """
    session = Session.objects(id=session_id, owner_id=user_id).first()    
    if not session:
        return JSONResponse(content={'error': "Cannot find session"}, status_code=404)

    # Fast path: append transcript entries directly in the API endpoint
    for entry in data.partition:
        session.transcript.append(
            session.TranscriptEntry(
                start_duration=entry.start_duration, 
                text=entry.text
            )
        )
    session.save()

    # Offload Pinecone embedding and AI summary generation to Celery background task
    partition_entries = [
        {"start_duration": entry.start_duration, "text": entry.text}
        for entry in data.partition
    ]
    dispatch_celery_task(
        process_transcript_partition_task,
        session_id,
        user_id,
        partition_entries
    )

    return JSONResponse(
        content={
            "message": "Transcript saved and processing queued",
            "count": len(data.partition)
        },
        status_code=200
    )


@router.get("/token")
async def get_token(request: Request):
    try:
        session_config = {
            "session": {
                "type": "transcription",
                "audio": {
                    "input": {
                        "format": {
                            'type': 'audio/pcm',
                            'rate': 24000
                        },
                        "transcription": {
                            "model": 'gpt-4o-mini-transcribe'
                        },
                        "turn_detection": {
                            "type": "server_vad",
                            "threshold": 0.3,
                            "prefix_padding_ms": 300,
                            "silence_duration_ms": 200,
                            "create_response": True,
                            "interrupt_response": True
                        }
                    },
                },
            },
        }
        
        response = requests.post(
            "https://api.openai.com/v1/realtime/client_secrets",
            headers={
                "Authorization": f"Bearer {os.environ.get('OPENAI_API_KEY')}",
                "Content-Type": "application/json"
            },
            json=session_config,
        )
        data = response.json()
        return JSONResponse(content=data, status_code=response.status_code)
    except Exception as error:
        return JSONResponse(
            content={"error": "Failed to generate token"},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.get("/")
@login_required
async def get_sessions(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Sessions per page"),
    search_query: str = Query(None, description="Search query (optional)"),
    request: Request = None,
    user_id: str = None
):
    try:
        skip = (page - 1) * page_size
        query = {"owner_id": user_id}
        if search_query:
            query["title__icontains"] = search_query
        sessions_query = (
            Session.objects(**query)
            .order_by("-created_at")
            .skip(skip)
            .limit(page_size)
        )
        
        sessions = [s.to_dict() for s in sessions_query]
        total = Session.objects(owner_id=user_id).count()
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        return {
            "sessions": sessions,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages
            }
        }
    except Exception as error:
        return JSONResponse(
            content={"error": "Failed to fetch sessions"},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.get("/{session_id}")
async def get_session(session_id: str):
    try:
        session = Session.objects(id=session_id).first()
        if not session:
            return JSONResponse(
                content={"error": "Session not found"},
                status_code=404,
            )
        return {'session': session.to_dict()}
    except Exception as e:
        return JSONResponse(
            content={"error": "Failed to fetch session"},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.post("/ai-search/")
@login_required
async def search_transcripts(request: Request, user_id=None):
    data = await request.json()
    try:
        results = query_pinecone(data['query'], user_id, 7)
        return {'results': results}
    except Exception as e:
        return JSONResponse(
            content={"error": "Failed to search transcripts"},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.delete("/{session_id}")
@login_required
async def delete_session(session_id: str, request: Request, user_id=None):
    try:
        session = Session.objects(id=session_id, owner_id=user_id).first()
        if not session:
            return JSONResponse(
                content={"error": "Session not found"},
                status_code=404,
            )

        connection = get_connection()
        with connection.start_session() as s:
            with s.start_transaction():
                SessionDoc.objects(session_id=session.id).delete()
                ChatSession.objects(session_id=session.id).delete()
                session.delete()
        return {"message": f"Session {session_id} deleted"}
    except Exception as e:
        return JSONResponse(
            content={"error": "Failed to delete session"},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
