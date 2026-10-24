import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# Kafka broker settings (Default to 'kafka:9092' for Docker network, fallback to 'localhost:9092')
KAFKA_BOOTSTRAP_SERVERS = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
KAFKA_CONSUMER_GROUP_ID = os.environ.get("KAFKA_CONSUMER_GROUP_ID", "voicesight-transcription-group")

# Kafka topic names
TOPIC_MEETING_RECORDINGS = os.environ.get("KAFKA_MEETING_TOPIC", "voice-meeting-recordings")
TOPIC_TRANSCRIPT_PROCESSING = os.environ.get("KAFKA_TRANSCRIPT_TOPIC", "voice-transcript-processing")
TOPIC_TRANSCRIPT_RESULTS = os.environ.get("KAFKA_RESULTS_TOPIC", "voice-transcript-results")

ALL_TOPICS = [
    TOPIC_MEETING_RECORDINGS,
    TOPIC_TRANSCRIPT_PROCESSING,
    TOPIC_TRANSCRIPT_RESULTS,
]

def ensure_kafka_topics(bootstrap_servers: Optional[str] = None):
    """
    Attempts to create default Kafka topics if they do not exist.
    Fails gracefully if Kafka broker is not accessible.
    """
    servers = bootstrap_servers or KAFKA_BOOTSTRAP_SERVERS
    try:
        from kafka.admin import KafkaAdminClient, NewTopic

        admin_client = KafkaAdminClient(
            bootstrap_servers=servers,
            client_id="voicesight-event-microservice-admin",
            request_timeout_ms=5000,
        )

        existing_topics = set(admin_client.list_topics())
        new_topics = [
            NewTopic(name=topic, num_partitions=3, replication_factor=1)
            for topic in ALL_TOPICS
            if topic not in existing_topics
        ]

        if new_topics:
            admin_client.create_topics(new_topics=new_topics, validate_only=False)
            print(f"[Kafka Microservice] Successfully created topics: {[t.name for t in new_topics]}")
        else:
            print(f"[Kafka Microservice] All topics already exist: {ALL_TOPICS}")

        admin_client.close()
        return True
    except Exception as e:
        print(f"[Kafka Microservice] Notice: KafkaAdminClient topic setup check ({e}). Continuing...")
        return False
