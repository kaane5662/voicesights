from mongoengine import connect
import os

def connect_to_mongo():
    try:
        mongo_uri = os.getenv("MONGO_DB_URI", "mongodb://localhost:27017/voiceai")
        # Use the full connection string, which may include credentials and options.
        # mongo_uri is assumed to be the complete connection string.
        # No need to use db_name if fully specified in the string.
        connect(host=mongo_uri)
    except Exception as e:
        print("Error occured while connecting: ", e)

