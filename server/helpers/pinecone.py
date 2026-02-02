import os
from pinecone import Pinecone, ServerlessSpec
from openai import OpenAI

# Set up clients
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY")
PINECONE_INDEX = os.environ.get("PINECONE_INDEX", "voice-sessions")

client = OpenAI(api_key=OPENAI_API_KEY)
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX)

# Use OpenAI to embed text
def get_embeddings(texts: list[str]) -> list[list[float]]:
    # OpenAI recommends batching for efficiency, but here it's simple call
    response = client.embeddings.create(
        input=texts,
        model="text-embedding-3-small",
        dimensions=512
    )
    # Results are in order
    return [result.embedding for result in response.data]

def add_pinecone_data(transcripts: list[str], session_id: str, owner_id: str):
    embeddings = get_embeddings(transcripts)
    # For Pinecone, the id must be unique
    # We can use a pattern: f"{session_id}_{idx}"
    to_upsert = []
    for idx, (embedding, t) in enumerate(zip(embeddings, transcripts)):
        metadata = {
            "item_id": session_id,
            "type":'session',
            "owner_id": owner_id,
            "text": t
        }
        to_upsert.append((
            f"{session_id}_{idx}",
            embedding,
            metadata
        ))
    if len(to_upsert) > 0:
        index.upsert(vectors=to_upsert)

def query_pinecone(query, owner_id, k=5):
    # Embed the query
    q_embedding = get_embeddings([query])[0]
    # Query only vectors matching owner_id using metadata filter
    response = index.query(
        vector=q_embedding,
        top_k=k,
        include_metadata=True,
        filter={"owner_id": {"$eq": owner_id}}
    )
    entries = []

    for match in response.get("matches", []):
        
        entries.append({
            "score": match["score"],
            "content": match["metadata"].get("text") if "text" in match["metadata"] else "",  # Use "text" if stored in metadata, else blank
            "metadata": match["metadata"]
        })
    # However, in upsert we stored `t` as embedding only,
    # to preserve text, let's also store it as "text" in metadata in upsert.
    return entries

def query_pinecone_threshold(query, owner_id, k=5, similarity_threshold=0.8):
    q_embedding = get_embeddings([query])[0]
    response = index.query(
        vector=q_embedding,
        top_k=k,
        include_metadata=True,
        filter={"owner_id": {"$eq": owner_id}}
    )
    entries = []
    for match in response.get("matches", []):
        if match["score"] >= similarity_threshold:
            entries.append({
                "score": match["score"],
                "content": match["metadata"].get("text") if "text" in match["metadata"] else "",
                "metadata": match["metadata"]
            })
    return entries

def reindex_pinecone(item_id, session_id,owner_id, docs, item_type):
    
    # Find all relevant vector IDs for the session
    # Use query() to get vector ids (since fetch(filter=...) is not correct),
    # and Pinecone queries/deletes require "ids" directly.
    # Don't use vector search to get ids, use metadata-based deletion
    index.delete(
        filter={"item_id": {"$eq": item_id},  "item_type": {"$eq": item_type}, "owner_id": {"$eq": owner_id}}
    )
    # Now upsert new records
    to_upsert = []
    embeddings = get_embeddings(docs)
    for idx, (embedding, doc) in enumerate(zip(embeddings, docs)):
        metadata = {
            "item_id": item_id,
            "item_type":item_type,
            "owner_id": owner_id,

            "session_id":session_id,
            "text": doc
        }
        to_upsert.append((
            f"{item_id}_{idx}",
            embedding,
            metadata
        ))
    if to_upsert:
        index.upsert(vectors=to_upsert)

# INSERT_YOUR_CODE
def delete_docmuents_pinecone(item_id, item_type, owner_id):
    """
    Delete all vectors for a given item_id, item_type, and owner_id from Pinecone.
    """
    index.delete(
        filter={"item_id": {"$eq": item_id}, "item_type": {"$eq": item_type}, "owner_id": {"$eq": owner_id}}
    )

