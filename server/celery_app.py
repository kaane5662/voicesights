import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()


REDIS_HOST = os.environ.get("UPSTASH_REDIS_HOST")
REDIS_PORT = os.environ.get("UPSTASH_REDIS_PORT")
REDIS_PASSWORD = os.environ.get("UPSTASH_REDIS_PASSWORD")
print('redis host',REDIS_HOST)

# Build the TLS Redis URL for Upstash
BROKER_URL = f"rediss://default:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/0"

print(BROKER_URL)

celery_app = Celery("tasks", broker=BROKER_URL, backend=BROKER_URL, broker_transport_options={
        "global_keyprefix": "celery_",
    },)

celery_app.conf.update(
    broker_use_ssl={
        "ssl_cert_reqs": "required",
    },
    redis_backend_use_ssl={
        "ssl_cert_reqs": "required",
    },
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)