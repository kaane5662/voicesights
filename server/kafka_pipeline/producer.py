import json
import logging
from typing import Dict, Any, Optional
from kafka_pipeline.config import (
    KAFKA_BOOTSTRAP_SERVERS,
    TOPIC_MEETING_RECORDINGS,
    TOPIC_TRANSCRIPT_PROCESSING,
    ensure_kafka_topics
)

logger = logging.getLogger("voicesight.kafka.producer")

import time

_producer_instance = None
_kafka_available = None
_last_retry_time = 0.0

def get_kafka_producer():
    """
    Returns a shared KafkaProducer instance.
    Retries connecting every 10 seconds if previously unavailable.
    """
    global _producer_instance, _kafka_available, _last_retry_time
    if _producer_instance is not None:
        return _producer_instance

    now = time.time()
    if _kafka_available is False and (now - _last_retry_time) < 10.0:
        return None

    _last_retry_time = now
    try:
        from kafka import KafkaProducer
        producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
            retries=3,
            request_timeout_ms=5000,
            api_version_auto_timeout_ms=5000
        )
        _producer_instance = producer
        _kafka_available = True
        logger.info(f"[Kafka Producer] Connected successfully to shared Kafka broker at {KAFKA_BOOTSTRAP_SERVERS}")
        return _producer_instance
    except Exception as e:
        _kafka_available = False
        logger.warning(
            f"[Kafka Producer] Unable to connect to Kafka broker at {KAFKA_BOOTSTRAP_SERVERS}: {e}. "
            "Provider events will be queued locally or processed directly."
        )
        return None

def publish_recording_event(
    provider: str,
    event_type: str,
    job_id: str,
    user_id: Optional[str],
    payload: Dict[str, Any],
    topic: str = TOPIC_MEETING_RECORDINGS
) -> bool:
    """
    Publishes a meeting recording/transcript event to Kafka.
    Returns True if sent to Kafka, False if fell back.
    """
    message = {
        "job_id": job_id,
        "provider": provider,
        "event_type": event_type,
        "user_id": str(user_id) if user_id else None,
        "payload": payload,
    }

    producer = get_kafka_producer()
    if producer:
        try:
            future = producer.send(topic, key=job_id, value=message)
            # Flush asynchronously or let batch handle it
            producer.flush(timeout=2)
            logger.info(f"[Kafka Producer] Published event {event_type} for job {job_id} to topic {topic}")
            return True
        except Exception as e:
            logger.error(f"[Kafka Producer] Failed to send message to topic {topic}: {e}")
            return False
    else:
        logger.info(f"[Kafka Producer] (Offline Mode) Stored event for job {job_id} on provider {provider}")
        return False
