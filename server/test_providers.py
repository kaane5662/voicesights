import unittest
import json
import hmac
import hashlib
from fastapi.testclient import TestClient

from app import app
from models import Profile, TranscriptJob, Session, ProviderSubscription
from kafka_pipeline.vtt_parser import parse_webvtt
from kafka_pipeline.consumer import process_transcript_job

client = TestClient(app)

class TestProviderIntegrations(unittest.TestCase):

    def test_zoom_crc_validation(self):
        """Test Zoom CRC challenge verification endpoint."""
        secret = "test_zoom_secret_token"
        plain_token = "abc123xyzToken"
        expected_encrypted = hmac.new(
            secret.encode(), plain_token.encode(), hashlib.sha256
        ).hexdigest()

        # Temporarily set secret
        import os
        os.environ["ZOOM_WEBHOOK_SECRET_TOKEN"] = secret

        response = client.post(
            "/providers/zoom/webhook",
            json={"event": "endpoint.url_validation", "payload": {"plainToken": plain_token}}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["plainToken"], plain_token)
        self.assertEqual(data["encryptedToken"], expected_encrypted)

    def test_teams_validation_token_challenge(self):
        """Test Microsoft Graph webhook validation challenge with plain text response."""
        validation_token = "SecretGraphValidationToken_998877"
        response = client.post(f"/providers/teams/webhook?validationToken={validation_token}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.text, validation_token)
        self.assertIn("text/plain", response.headers.get("content-type", ""))

    def test_google_meet_sync_handshake(self):
        """Test Google Meet / Drive webhook sync handshake."""
        response = client.post(
            "/providers/google-meet/webhook",
            headers={"X-Goog-Resource-State": "sync"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "sync_acknowledged"})

    def test_vtt_parser(self):
        """Test WebVTT parsing with speakers, timestamps, and word count."""
        sample_vtt = """WEBVTT

1
00:00:01.000 --> 00:00:05.500
Alice: Welcome everyone to the quarterly sprint review.

2
00:00:06.000 --> 00:00:12.000
Bob: Thanks Alice! I am excited to share our transcription updates.
"""
        entries, speakers, duration, word_count = parse_webvtt(sample_vtt)
        self.assertEqual(len(entries), 2)
        self.assertIn("Alice", speakers)
        self.assertIn("Bob", speakers)
        self.assertEqual(entries[0]["start_duration"], 1)
        self.assertEqual(entries[1]["start_duration"], 6)
        self.assertGreater(word_count, 10)
        self.assertEqual(duration, 12)

    def test_process_transcript_job_creates_session(self):
        """Test that process_transcript_job creates Session and completes TranscriptJob."""
        job_id = "test-job-unit-12345"
        payload = {
            "transcript_text": "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nCharlie: We finalized the Kafka transcription architecture today.",
            "object": {
                "id": "meeting-999",
                "topic": "Architecture Sync"
            }
        }

        session = process_transcript_job(
            job_id=job_id,
            provider="zoom",
            user_id=None,
            payload=payload
        )
        self.assertIsNotNone(session)
        self.assertEqual(session.provider, "zoom")
        self.assertTrue(len(session.transcript) > 0)

        # Verify job is marked as processed
        job = TranscriptJob.objects(job_id=job_id).first()
        self.assertIsNotNone(job)
        self.assertEqual(job.status, "processed")
        self.assertEqual(job.progress, 100)

        # Clean up test artifacts
        if session:
            session.delete()
        if job:
            job.delete()

    def test_job_polling_endpoint(self):
        """Test polling endpoint for job status."""
        job_id = "test-polling-job-555"
        job = TranscriptJob(
            job_id=job_id,
            provider="teams",
            status="in_queue",
            stage="enqueued",
            progress=15
        )
        job.save()

        response = client.get(f"/providers/jobs/{job_id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["job"]["status"], "in_queue")
        self.assertEqual(data["job"]["progress"], 15)
        self.assertFalse(data["is_complete"])

        job.delete()

if __name__ == "__main__":
    unittest.main()
