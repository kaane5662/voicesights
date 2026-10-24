from fastapi import APIRouter, Request, HTTPException, status, Query
from fastapi.responses import JSONResponse
from typing import Optional
from config.mongo import connect_to_mongo
from models import TranscriptJob, Session, Profile
from helpers.jwt import decode_jwt

router = APIRouter(prefix="/jobs", tags=["provider_jobs"])
connect_to_mongo()


def get_current_user_id(request: Request, query_token: Optional[str] = None) -> Optional[str]:
    """Helper to extract user ID from cookie, Authorization header, or query token."""
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


@router.get("/{job_id}")
async def get_job_status(job_id: str, request: Request, token: Optional[str] = Query(None)):
    """
    Polling endpoint for clients to monitor transcript processing:
    Returns status ('in_queue', 'processing', 'processed', 'failed'), stage, progress, and session details.
    """
    job = TranscriptJob.objects(job_id=job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transcript job '{job_id}' not found."
        )

    job_data = job.to_dict()
    session_data = None
    if job.session_id:
        try:
            session = Session.objects(id=job.session_id.id).first()
            if session:
                session_data = {
                    "id": str(session.id),
                    "title": session.title,
                    "total_duration": session.total_duration,
                    "word_count": session.word_count,
                    "speakers": session.speakers,
                    "ai_overview": session.ai_overview,
                    "summaries": session.summaries,
                }
        except Exception:
            pass

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "job": job_data,
            "session": session_data,
            "is_complete": job.status == "processed",
            "is_failed": job.status == "failed"
        }
    )


@router.get("/")
async def list_user_jobs(
    request: Request,
    token: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(20, le=100)
):
    """
    List all transcript processing jobs for the authenticated user.
    """
    user_id = get_current_user_id(request, token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to view jobs."
        )

    query = {"owner_id": user_id}
    if status_filter:
        query["status"] = status_filter

    jobs = TranscriptJob.objects(**query).order_by("-created_at")[:limit]
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"jobs": [j.to_dict() for j in jobs], "count": len(jobs)}
    )
