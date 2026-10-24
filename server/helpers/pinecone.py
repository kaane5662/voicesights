import os
from pinecone import Pinecone, ServerlessSpec
from openai import OpenAI

# Set up clients
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY")
PINECONE_INDEX = os.environ.get("PINECONE_INDEX", "voice-sessions")

client = OpenAI(api_key=OPENAI_API_KEY or "dummy")
pc = Pinecone(api_key=PINECONE_API_KEY or "dummy")

_index = None

def get_index():
    global _index
    if _index is None:
        try:
            _index = pc.Index(PINECONE_INDEX)
        except Exception as e:
            print(f"Warning: could not initialize Pinecone index: {e}")
            return None
    return _index

# Use OpenAI to embed text
def get_embeddings(texts: list[str]) -> list[list[float]]:
    try:
        response = client.embeddings.create(
            input=texts,
            model="text-embedding-3-small",
            dimensions=512
        )
        return [result.embedding for result in response.data]
    except Exception as e:
        print(f"Warning: error generating embeddings: {e}")
        return []

def add_pinecone_data(transcripts: list[str], session_id: str, owner_id: str):
    idx = get_index()
    if not idx:
        return
    embeddings = get_embeddings(transcripts)
    if not embeddings:
        return
    to_upsert = []
    for i, (embedding, t) in enumerate(zip(embeddings, transcripts)):
        metadata = {
            "item_id": session_id,
            "type": 'session',
            "owner_id": owner_id,
            "text": t
        }
        to_upsert.append((
            f"{session_id}_{i}",
            embedding,
            metadata
        ))
    if len(to_upsert) > 0:
        idx.upsert(vectors=to_upsert)

def query_pinecone(query, owner_id, k=5):
    idx = get_index()
    if not idx:
        return []
    embeddings = get_embeddings([query])
    if not embeddings:
        return []
    q_embedding = embeddings[0]
    response = idx.query(
        vector=q_embedding,
        top_k=k,
        include_metadata=True,
        filter={"owner_id": {"$eq": owner_id}}
    )
    entries = []
    for match in response.get("matches", []):
        entries.append({
            "score": match["score"],
            "content": match["metadata"].get("text") if "text" in match["metadata"] else "",
            "metadata": match["metadata"]
        })
    return entries

def query_pinecone_threshold(query, owner_id, k=5, similarity_threshold=0.8):
    idx = get_index()
    if not idx:
        return []
    embeddings = get_embeddings([query])
    if not embeddings:
        return []
    q_embedding = embeddings[0]
    response = idx.query(
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

def reindex_pinecone(item_id, session_id, owner_id, docs, item_type):
    idx = get_index()
    if not idx:
        return
    idx.delete(
        filter={"item_id": {"$eq": item_id}, "item_type": {"$eq": item_type}, "owner_id": {"$eq": owner_id}}
    )
    to_upsert = []
    embeddings = get_embeddings(docs)
    for i, (embedding, doc) in enumerate(zip(embeddings, docs)):
        metadata = {
            "item_id": item_id,
            "item_type": item_type,
            "owner_id": owner_id,
            "session_id": session_id,
            "text": doc
        }
        to_upsert.append((
            f"{item_id}_{i}",
            embedding,
            metadata
        ))
    if to_upsert:
        idx.upsert(vectors=to_upsert)

def delete_docmuents_pinecone(item_id, item_type, owner_id):
    idx = get_index()
    if not idx:
        return
    idx.delete(
        filter={"item_id": {"$eq": item_id}, "item_type": {"$eq": item_type}, "owner_id": {"$eq": owner_id}}
    )
