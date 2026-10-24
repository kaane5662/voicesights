import os
import sys
import time
import signal
import logging
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("event-processing-worker")

from config.mongo import connect_to_mongo
from pipeline.config import ensure_kafka_topics, KAFKA_BOOTSTRAP_SERVERS
from pipeline.consumer import run_kafka_consumer

_running = True

def handle_shutdown(signum, frame):
    global _running
    logger.info(f"Received termination signal ({signum}). Shutting down worker gracefully...")
    _running = False
    sys.exit(0)

def main():
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    logger.info("==================================================================")
    logger.info("   Starting VoiceSight Event Processing Microservice Worker       ")
    logger.info("   Architecture: Apache Kafka Producer / Consumer Streaming       ")
    logger.info("==================================================================")
    logger.info(f"Kafka Broker Target: {KAFKA_BOOTSTRAP_SERVERS}")

    # 1. Connect to MongoDB
    logger.info("Connecting to MongoDB...")
    connect_to_mongo()

    # 2. Wait for Kafka broker readiness and initialize topics
    max_retries = 30
    retry_delay = 3
    topics_ready = False

    for attempt in range(1, max_retries + 1):
        logger.info(f"Checking Kafka broker readiness (Attempt {attempt}/{max_retries})...")
        if ensure_kafka_topics():
            topics_ready = True
            logger.info("Kafka topics verified and ready.")
            break
        time.sleep(retry_delay)

    if not topics_ready:
        logger.warning("Kafka broker did not respond within timeout. Starting consumer loop with auto-reconnect...")

    # 3. Enter continuous Kafka Consumer event loop
    logger.info("Entering Kafka event consumption loop...")
    while _running:
        try:
            run_kafka_consumer()
        except Exception as e:
            logger.error(f"Kafka consumer error: {e}. Reconnecting in 5 seconds...", exc_info=True)
            time.sleep(5)

if __name__ == "__main__":
    main()
