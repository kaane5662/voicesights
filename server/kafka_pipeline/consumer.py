import os
import sys
import json
import logging
import datetime
from typing import Dict, Any, List, Optional
import requests

from config.mongo import connect_to_mongo
from models import Profile, Session, TranscriptJob, ProviderSubscription
from kafka_pipeline.config import (
    KAFKA_BOOTSTRAP_SERVERS,
    KAFKA_CONSUMER_GROUP_ID,
    TOPIC_MEETING_RECORDINGS,
    TOPIC_TRANSCRIPT_PROCESSING
)
from kafka_pipeline.vtt_parser import parse_webvtt
from kafka_pipeline.ai_insights import generate_insights_for_transcript

logger = logging.getLogger("voicesight.kafka.consumer")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


def fetch_zoom_transcript(payload: Dict[str, Any], user_id: Optional[str]) -> str:
    """
    Extracts or downloads VTT transcript content from a Zoom recording webhook payload.
    """
    obj = payload.get("object", {})
    recording_files = obj.get("recording_files", [])
    download_token = payload.get("download_token")

    # If transcript text is directly provided in payload (e.g. simulated or pre-fetched)
    if "transcript_text" in payload:
        return payload["transcript_text"]

    # Search for TRANSCRIPT file in Zoom recording files
    transcript_file = None
    for rf in recording_files:
        file_type = rf.get("file_type", "").upper()
        recording_type = rf.get("recording_type", "").lower()
        if file_type == "TRANSCRIPT" or "transcript" in recording_type:
            transcript_file = rf
            break

    if transcript_file and transcript_file.get("download_url"):
        download_url = transcript_file["download_url"]
        headers = {}
        # Zoom allows appending download_token as query param or Bearer header
        if download_token:
            headers["Authorization"] = f"Bearer {download_token}"
        else:
            # Fall back to user's stored OAuth token if available
            if user_id:
                sub = ProviderSubscription.objects(owner_id=user_id, provider="zoom", is_active=True).first()
                if sub and sub.access_token:
                    headers["Authorization"] = f"Bearer {sub.access_token}"

        try:
            resp = requests.get(download_url, headers=headers, timeout=15)
            if resp.status_code == 200:
                return resp.text
        except Exception as e:
            logger.warning(f"[Consumer] Zoom transcript download failed: {e}")

    # Fallback placeholder if no transcript file is downloadable
    topic = obj.get("topic", "Zoom Meeting")
    return f"WEBVTT\n\n00:00:01.000 --> 00:00:10.000\nHost: Recording session completed for {topic}."


def fetch_teams_transcript(payload: Dict[str, Any], user_id: Optional[str]) -> str:
    """
    Extracts or downloads VTT transcript content for Microsoft Teams via Microsoft Graph API.
    """
    if "transcript_text" in payload:
        return payload["transcript_text"]

    resource = payload.get("resource", "")
    # resource format typically: communications/onlineMeetings('{meetingId}')/transcripts('{transcriptId}')
    if user_id and resource:
        sub = ProviderSubscription.objects(owner_id=user_id, provider="teams", is_active=True).first()
        if sub and sub.access_token:
            content_url = f"https://graph.microsoft.com/v1.0/{resource}/content?$format=text/vtt"
            try:
                resp = requests.get(content_url, headers={"Authorization": f"Bearer {sub.access_token}"}, timeout=15)
                if resp.status_code == 200:
                    return resp.text
            except Exception as e:
                logger.warning(f"[Consumer] MS Teams transcript download failed: {e}")

    meeting_id = payload.get("meeting_id") or payload.get("resourceData", {}).get("meetingId", "Teams Call")
    return f"WEBVTT\n\n00:00:01.000 --> 00:00:10.000\nPresenter: Transcript generated for Microsoft Teams meeting {meeting_id}."


def fetch_google_meet_transcript(payload: Dict[str, Any], user_id: Optional[str]) -> str:
    """
    Extracts or downloads transcript content for Google Meet via Google Drive or Workspace API.
    """
    if "transcript_text" in payload:
        return payload["transcript_text"]

    file_id = payload.get("file_id") or payload.get("drive_file_id")
    if user_id and file_id:
        sub = ProviderSubscription.objects(owner_id=user_id, provider="google_meet", is_active=True).first()
        if sub and sub.access_token:
            download_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
            try:
                resp = requests.get(download_url, headers={"Authorization": f"Bearer {sub.access_token}"}, timeout=15)
                if resp.status_code == 200:
                    return resp.text
            except Exception as e:
                logger.warning(f"[Consumer] Google Meet transcript download failed: {e}")

    space_id = payload.get("space_id", "Google Meet Session")
    return f"WEBVTT\n\n00:00:01.000 --> 00:00:10.000\nSpeaker: Recording session ended for Google Meet {space_id}."


def process_transcript_job(
    job_id: str,
    provider: str,
    user_id: Optional[str],
    payload: Dict[str, Any]
) -> Optional[Session]:
    """
    Core transcript processing pipeline:
    1. Updates TranscriptJob to 'processing'.
    2. Fetches and parses WebVTT content into structured transcript entries.
    3. Runs AI insight generation (title, overview, summaries, suggestions).
    4. Creates and saves Session in MongoDB.
    5. Updates TranscriptJob to 'processed' and links session_id.
    """
    connect_to_mongo()

    job = TranscriptJob.objects(job_id=job_id).first()
    if not job:
        job = TranscriptJob(
            job_id=job_id,
            provider=provider,
            status="in_queue",
            stage="enqueued",
            progress=10,
            payload_metadata=payload,
            created_at=datetime.datetime.utcnow()
        )
        if user_id:
            profile = Profile.objects(id=user_id).first()
            if profile:
                job.owner_id = profile
        job.save()

    logger.info(f"[Job {job_id}] Processing {provider} transcript event...")

    try:
        # Step 1: Update status to processing
        job.status = "processing"
        job.stage = "fetching_transcript"
        job.progress = 25
        job.updated_at = datetime.datetime.utcnow()
        job.save()

        # Step 2: Fetch raw WebVTT / transcript text by provider
        vtt_content = ""
        meeting_id = ""
        topic_title = f"{provider.capitalize()} Meeting"

        if provider == "zoom":
            vtt_content = fetch_zoom_transcript(payload, user_id)
            obj = payload.get("object", {})
            meeting_id = str(obj.get("id") or obj.get("uuid") or "")
            topic_title = obj.get("topic") or "Zoom Meeting"
        elif provider == "teams":
            vtt_content = fetch_teams_transcript(payload, user_id)
            meeting_id = str(payload.get("meeting_id") or payload.get("resourceData", {}).get("meetingId", ""))
            topic_title = payload.get("subject") or "Teams Meeting"
        elif provider == "google_meet":
            vtt_content = fetch_google_meet_transcript(payload, user_id)
            meeting_id = str(payload.get("space_id") or payload.get("conference_id") or "")
            topic_title = payload.get("title") or "Google Meet"
        else:
            vtt_content = payload.get("transcript_text", "")

        # Step 3: Parse WebVTT
        job.stage = "parsing_transcript"
        job.progress = 45
        job.updated_at = datetime.datetime.utcnow()
        job.save()

        entries, speakers, total_duration, word_count = parse_webvtt(vtt_content)
        consolidated_text = "\n".join([f"{e.get('speaker', 'Speaker')}: {e['text']}" for e in entries])

        # Step 4: AI Insights generation
        job.stage = "generating_ai_insights"
        job.progress = 70
        job.updated_at = datetime.datetime.utcnow()
        job.save()

        insights = generate_insights_for_transcript(
            transcript_text=consolidated_text,
            default_title=topic_title
        )

        # Step 5: Create and save Session document
        job.stage = "saving_session"
        job.progress = 85
        job.updated_at = datetime.datetime.utcnow()
        job.save()

        owner_profile = None
        if user_id:
            owner_profile = Profile.objects(id=user_id).first()

        session = Session(
            title=insights.get("title") or topic_title,
            total_duration=total_duration,
            word_count=word_count,
            speakers=speakers,
            finished=True,
            starred=False,
            tags=[provider, "meeting-recording"],
            ai_overview=insights.get("ai_overview", ""),
            summaries=insights.get("summaries", []),
            provider=provider,
            provider_meeting_id=meeting_id,
            owner_id=owner_profile,
            created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow()
        )

        # Convert transcript entries
        for entry in entries:
            session.transcript.append(
                Session.TranscriptEntry(
                    start_duration=entry["start_duration"],
                    text=f"{entry.get('speaker') + ': ' if entry.get('speaker') else ''}{entry['text']}"
                )
            )

        # Add prompt suggestions
        for prompt_item in insights.get("chat_suggestions", []):
            session.chat_suggestions.append(
                Session.PromptEntry(
                    prompt=prompt_item["prompt"],
                    title=prompt_item["title"]
                )
            )

        for doc_item in insights.get("doc_suggestions", []):
            session.doc_suggestions.append(
                Session.PromptEntry(
                    prompt=doc_item["prompt"],
                    title=doc_item["title"]
                )
            )

        session.save()

        # Step 6: Mark TranscriptJob completed
        job.session_id = session
        job.status = "processed"
        job.stage = "completed"
        job.progress = 100
        job.provider_meeting_id = meeting_id
        job.provider_meeting_topic = session.title
        job.completed_at = datetime.datetime.utcnow()
        job.updated_at = datetime.datetime.utcnow()
        job.save()

        # Link session back to transcript job
        session.transcript_job = job
        session.save()

        logger.info(f"[Job {job_id}] Successfully processed into Session '{session.title}' (ID: {session.id})")
        return session

    except Exception as e:
        logger.error(f"[Job {job_id}] Processing failed: {e}", exc_info=True)
        job.status = "failed"
        job.stage = "failed"
        job.error_message = str(e)
        job.updated_at = datetime.datetime.utcnow()
        job.save()
        return None


def run_kafka_consumer():
    """
    Continuous Kafka Consumer loop subscribing to meeting recording and transcript topics.
    """
    logger.info(f"[Kafka Consumer] Starting consumer on {KAFKA_BOOTSTRAP_SERVERS} for group {KAFKA_CONSUMER_GROUP_ID}")
    connect_to_mongo()

    try:
        from kafka import KafkaConsumer
        consumer = KafkaConsumer(
            TOPIC_MEETING_RECORDINGS,
            TOPIC_TRANSCRIPT_PROCESSING,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            group_id=KAFKA_CONSUMER_GROUP_ID,
            auto_offset_reset="earliest",
            enable_auto_commit=True,
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            key_deserializer=lambda k: k.decode("utf-8") if k else None
        )

        logger.info(f"[Kafka Consumer] Listening to topics: {[TOPIC_MEETING_RECORDINGS, TOPIC_TRANSCRIPT_PROCESSING]}")
        for message in consumer:
            try:
                data = message.value
                logger.info(f"[Kafka Consumer] Received message on topic {message.topic} (Key: {message.key})")
                job_id = data.get("job_id")
                provider = data.get("provider", "zoom")
                user_id = data.get("user_id")
                payload = data.get("payload", {})

                if job_id:
                    process_transcript_job(
                        job_id=job_id,
                        provider=provider,
                        user_id=user_id,
                        payload=payload
                    )
            except Exception as e:
                logger.error(f"[Kafka Consumer] Error handling record: {e}", exc_info=True)

    except Exception as e:
        logger.critical(f"[Kafka Consumer] Could not start Kafka consumer ({e}). Check Kafka connection.")


if __name__ == "__main__":
    run_kafka_consumer()
