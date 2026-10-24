from mongoengine import connect
import os
import logging

logger = logging.getLogger("event-processing.mongo")

def connect_to_mongo():
    try:
        mongo_uri = os.getenv("MONGO_DB_URI", "mongodb://localhost:27017/voiceai")
        connect(host=mongo_uri)
        logger.info(f"Connected to MongoDB at {mongo_uri}")
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {e}")
