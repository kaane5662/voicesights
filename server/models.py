import datetime
import profile
from bson import timestamp
from mongoengine import DictField, Document, StringField, DateTimeField, ListField, BooleanField, IntField, ReferenceField, EmbeddedDocument, EmbeddedDocumentField
from mongoengine.fields import ObjectId

def mongo_to_dict(doc):
    data = doc.to_mongo().to_dict()
    data["id"] = str(data.pop("_id"))
    
    for k, v in data.items():
        
        if isinstance(v, datetime.datetime):
            # print('wtf')
            data[k] = v.isoformat()
        if v and isinstance(v, ObjectId):
            data[k] = str(v)
    
        
    # print(data)
    return data

class Profile(Document):
    # username = StringField(required=True, unique=True)
    email = StringField(required=True, unique=True)
    password = StringField(required=True)
    plan = StringField(default="free")
    annual = BooleanField(default=False)
    bio = StringField()
    created_at = DateTimeField(default=datetime.datetime.utcnow()) 
    updated_at = DateTimeField()
    next_renewal=DateTimeField()
    stripe_customer_id=StringField()
    
    last_requested = StringField()
    subscription_status = StringField()
    # Rate limiting fields
    rate_limit_remaining = IntField(default=10)  # Example: default limit per period
    rate_limit_last = DateTimeField()             # Last request time for rate limiting
    class AuthorizationToken(EmbeddedDocument):
        app_id = StringField(required=True)
        permissions = ListField(StringField())
        refresh_token = StringField(required=True)

    apps = ListField(EmbeddedDocumentField(AuthorizationToken))

    def to_dict(self):
        return mongo_to_dict(self)

class Folder(Document):
    title = StringField(required=True)
    owner_id = ReferenceField(Profile)
    created_at = DateTimeField(default=datetime.datetime.utcnow()) 
    parent_id = ReferenceField("self", null=True)

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
    tags = ListField(StringField())
    ai_overview = StringField()
    summaries = ListField(StringField())
    created_at = DateTimeField(default=datetime.datetime.utcnow()) 
    share_url= StringField()

    class PromptEntry(EmbeddedDocument):
        prompt= StringField(required=True)
        title = StringField(required=True)

    chat_suggestions = ListField(EmbeddedDocumentField(PromptEntry))
    doc_suggestions = ListField(EmbeddedDocumentField(PromptEntry))

    class TranscriptEntry(EmbeddedDocument):
        start_duration = IntField(required=True)
        text = StringField(required=True)
        

    transcript = ListField(EmbeddedDocumentField(TranscriptEntry))
    # sentiment = StringField()
    owner_id = ReferenceField(Profile)
    folder_id = ReferenceField(Folder, null=True)
    created_at = DateTimeField()
    updated_at = DateTimeField()

    def to_dict(self):
        return mongo_to_dict(self)

class ChatSession(Document):
    title = StringField(required=True)
    class Message(EmbeddedDocument):
        role=StringField()
        content=StringField()

    messages = ListField(EmbeddedDocumentField(Message))
    session_id = ReferenceField(Session)
    owner_id = ReferenceField(Profile)
    created_at = DateTimeField(default=datetime.datetime.utcnow()) 
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

    created_at = DateTimeField(default=datetime.datetime.utcnow())

    def to_dict(self):
        return mongo_to_dict(self)