import datetime
import profile
from bson import timestamp
from mongoengine import DictField, Document, StringField, DateTimeField, ListField, BooleanField, IntField, ReferenceField, EmbeddedDocument, EmbeddedDocumentField
from mongoengine.fields import ObjectId

def mongo_to_dict(doc):
    data = doc.to_mongo().to_dict()
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    
    def serialize(val):
        if isinstance(val, (datetime.datetime, datetime.date)):
            return val.isoformat()
        if isinstance(val, ObjectId):
            return str(val)
        if isinstance(val, dict):
            return {k: serialize(v) for k, v in val.items()}
        if isinstance(val, list):
            return [serialize(item) for item in val]
        return val

    for k, v in list(data.items()):
        data[k] = serialize(v)
        
    return data

class Profile(Document):
    # username = StringField(required=True, unique=True)
    email = StringField(required=True, unique=True)
    password = StringField(required=True)
    plan = StringField(default="free")
    annual = BooleanField(default=False)
    bio = StringField()
    created_at = DateTimeField(default=datetime.datetime.utcnow) 
    updated_at = DateTimeField()
    next_renewal = DateTimeField()
    stripe_customer_id = StringField()
    
    last_requested = StringField()
    subscription_status = StringField()
    # Rate limiting fields
    rate_limit_remaining = IntField(default=10)  # Example: default limit per period
    rate_limit_last = DateTimeField()             # Last request time for rate limiting

    class AuthorizationToken(EmbeddedDocument):
        app_id = StringField(required=True)
        permissions = ListField(StringField())
        refresh_token = StringField(required=True)
        access_token = StringField()
        expires_at = DateTimeField()
        subscription_id = StringField()

    apps = ListField(EmbeddedDocumentField(AuthorizationToken))

    def to_dict(self):
        return mongo_to_dict(self)

class ProviderSubscription(Document):
    """
    Stores OAuth access & refresh tokens and webhook subscription IDs
    for voice meeting providers (Zoom, Google Meet, Microsoft Teams).
    """
    owner_id = ReferenceField(Profile, required=True)
    provider = StringField(required=True, choices=["zoom", "google_meet", "teams"])
    provider_user_id = StringField()
    provider_account_email = StringField()
    access_token = StringField(required=True)
    refresh_token = StringField()
    token_expires_at = DateTimeField()
    scopes = ListField(StringField())

    # Provider webhook subscription identifiers
    subscription_id = StringField() # Microsoft Graph subscription ID, Google watch channel ID, Zoom webhook ID
    subscription_resource = StringField()
    subscription_expires_at = DateTimeField()
    client_state = StringField() # Shared validation secret / client state token

    is_active = BooleanField(default=True)
    metadata = DictField()
    created_at = DateTimeField(default=datetime.datetime.utcnow)
    updated_at = DateTimeField(default=datetime.datetime.utcnow)

    meta = {
        'indexes': [
            {'fields': ['owner_id', 'provider'], 'unique': False},
            {'fields': ['subscription_id'], 'sparse': True},
            {'fields': ['provider_user_id'], 'sparse': True}
        ]
    }

    def to_dict(self):
        return mongo_to_dict(self)

class Folder(Document):
    title = StringField(required=True)
    owner_id = ReferenceField(Profile)
    created_at = DateTimeField(default=datetime.datetime.utcnow) 
    parent_id = ReferenceField("self", null=True)

    def to_dict(self):
        return mongo_to_dict(self)

class TranscriptJob(Document):
    """
    Model for polling whether the transcript is processed, processing, or in queue.
    Used by Apache Kafka event streaming pipeline.
    """
    job_id = StringField(required=True, unique=True)
    provider = StringField(required=True, choices=["zoom", "google_meet", "teams"])
    status = StringField(
        required=True, 
        choices=["in_queue", "processing", "processed", "failed"], 
        default="in_queue"
    )
    stage = StringField(default="enqueued") # e.g. enqueued, fetching_payload, downloading_transcript, generating_insights, saving_session, completed, failed
    progress = IntField(default=0) # 0 to 100 percentage

    owner_id = ReferenceField(Profile)
    session_id = ReferenceField('Session', null=True)

    provider_meeting_id = StringField()
    provider_meeting_topic = StringField()
    provider_recording_id = StringField()

    error_message = StringField()
    payload_metadata = DictField()
    raw_payload = DictField()

    created_at = DateTimeField(default=datetime.datetime.utcnow)
    updated_at = DateTimeField(default=datetime.datetime.utcnow)
    completed_at = DateTimeField(null=True)

    meta = {
        'indexes': [
            {'fields': ['job_id'], 'unique': True},
            {'fields': ['owner_id', 'status']},
            {'fields': ['status', 'created_at']}
        ]
    }

    def to_dict(self):
        return mongo_to_dict(self)

class Session(Document):
    title = StringField(required=True)
    
    # date = DateTimeField(required=True)
    total_duration = IntField()  # in seconds
    word_count = IntField()
    speakers = ListField()
    starred = BooleanField(default=False)
    finished = BooleanField(default=False)
    status = StringField(default="active") # active, processing, completed, failed
    tags = ListField(StringField())
    ai_overview = StringField()
    summaries = ListField(StringField())
    created_at = DateTimeField(default=datetime.datetime.utcnow) 
    share_url = StringField()

    # Provider integration metadata
    provider = StringField() # e.g. "zoom", "google_meet", "teams"
    provider_meeting_id = StringField()
    provider_recording_url = StringField()
    transcript_job = ReferenceField(TranscriptJob, null=True)

    class PromptEntry(EmbeddedDocument):
        prompt = StringField(required=True)
        title = StringField(required=True)

    chat_suggestions = ListField(EmbeddedDocumentField(PromptEntry))
    doc_suggestions = ListField(EmbeddedDocumentField(PromptEntry))

    class TranscriptEntry(EmbeddedDocument):
        start_duration = IntField(required=True)
        text = StringField(required=True)

    transcript = ListField(EmbeddedDocumentField(TranscriptEntry))
    owner_id = ReferenceField(Profile)
    folder_id = ReferenceField(Folder, null=True)
    updated_at = DateTimeField()

    def to_dict(self):
        return mongo_to_dict(self)

class ChatSession(Document):
    title = StringField(required=True)
    class Message(EmbeddedDocument):
        role = StringField()
        content = StringField()
        type = StringField(default="text")
        data = DictField()
        meta = {'strict': False}

    messages = ListField(EmbeddedDocumentField(Message))
    session_id = ReferenceField(Session)
    owner_id = ReferenceField(Profile)
    created_at = DateTimeField(default=datetime.datetime.utcnow) 
    folder_id = ReferenceField(Folder, null=True)

    def to_dict(self):
        return mongo_to_dict(self)

class SessionDoc(Document):
    title = StringField()
    owner_id = ReferenceField(Profile)
    session_id = ReferenceField(Session)
    folder_id = ReferenceField(Folder, null=True)
    # Editor
    content_json = DictField(required=True)

    # AI semantic source (optional but powerful)
    ai_blocks = ListField(DictField())

    created_at = DateTimeField(default=datetime.datetime.utcnow)

    def to_dict(self):
        return mongo_to_dict(self)