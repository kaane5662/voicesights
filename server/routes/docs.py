# INSERT_YOUR_CODE
from fastapi import APIRouter, HTTPException, Request, status, Query, Body
from fastapi.responses import JSONResponse
from typing import List, Dict, Literal, Optional
from openai import OpenAI
from pydantic import BaseModel, Field
from bson import ObjectId
from pymongo import message
from config.mongo import connect_to_mongo
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.messages import BaseMessage, ChatMessage
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI
from models import ChatSession, Session, SessionDoc

from langchain.agents import create_agent
import os

from helpers.docs import compile_to_tiptap
from helpers.auth import login_required
from schema import Pagination
from helpers.pinecone import delete_docmuents_pinecone, reindex_pinecone
# from tools import add_google_calendar_events_rest, create_linear_issues, get_google_calendars, get_linear_teams

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
router = APIRouter(prefix="/docs", tags=["docs"])
connect_to_mongo()

# # Example Pydantic model for a chat message and chat thread
# class ChatMessage(BaseModel):
#     sender_id: str
#     content: str
#     timestamp: Optional[str]

# class ChatThread(BaseModel):
#     id: Optional[str]
#     user_id: str
#     messages: List[ChatMessage]

# from pymongo import MongoClient



#in client if not chat_session id create new one, and then load it

# Create a new chat thread for a user
@router.post("/{session_id}")
@login_required
async def create_doc(session_id: str, request:Request, user_id=None):

    data = await request.json()
    session = Session.objects(id=session_id, owner_id=user_id)
    if not session:
        return JSONResponse(status_code=404, content={'error':"No session found"})
    title = client.responses.create(
        model="gpt-5-nano",
        input=f'''

        Based on the the current document content, provide a title initiating what the current conversation is about. No filler words, return ONLY the title.        
        Input:{data['input_html']}
        
        '''
    )
    
    
    doc_session = SessionDoc(
        content_json = data['input_json'],
        title = title.output_text,
        session_id=session_id,
        owner_id=user_id
    )

    doc_session.save()
    return {'doc':doc_session.to_dict()}



@router.post("/")
@login_required
async def get_all_profile_docs(
    pagination: Pagination,
    user_id=None,
    request: Request = None
):
    # Read additional body fields, such as session_id, if provided
    body = await request.json() if request else {}
    session_id = body.get("session_id")

    page = pagination.page or 1
    page_size = pagination.page_size or 10

    skip = (page - 1) * page_size

    query = SessionDoc.objects( owner_id=user_id).only("id", "title", "created_at","session_id").order_by("-created_at")
    total = query.count()
    docs = query.skip(skip).limit(page_size)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    print(docs)
    pagination.total = total
    pagination.total_pages = total_pages

    return {
        'docs': [doc.to_dict() for doc in docs],
        'pagination': pagination.model_dump()
    }

# Fetch all docs threads for a user
@router.get("/{session_id}")
@login_required
async def get_session_docs(session_id: str,request:Request, user_id=None):
    docs = SessionDoc.objects(session_id=session_id,owner_id=user_id).only("id", "title", "created_at").order_by("-created_at")
    # print(chat_sessions)
    
    return {'docs':[doc.to_dict() for doc in docs]}

@router.get("/{session_id}/{doc_id}")
def get_doc(session_id: str, doc_id:str):
    doc = SessionDoc.objects(session_id=session_id, id=doc_id).first()
    if not doc:
        return JSONResponse(status_code=404,content={'error':"Not a valid document found"})
    return {'doc':doc.to_dict()}

@router.post("/{session_id}/{doc_id}/save")
async def save_doc(session_id: str, doc_id:str, request:Request):
    data = await request.json()
    doc = SessionDoc.objects(session_id=session_id, id=doc_id).first()
    # print(data['content_json'])
    if not doc:
        return JSONResponse(status_code=404,content={'error':"Not a valid document found"})
    doc.content_json = data['content_json']
    doc.save()  
    return {'message':"saved successfully"}

@router.delete("/{doc_id}/delete/")
@login_required
async def delete_doc(doc_id:str, request:Request, user_id=None):
    # print(data['content_json'])
    doc = SessionDoc.objects(owner_id=user_id, id=doc_id).first()
    if doc:
        doc.delete()
        delete_docmuents_pinecone(str(doc.id),'doc',user_id)
        return {'message': "deleted successfully"}
    else:
        return JSONResponse(status_code=404, content={'error': "Not a valid document found"})

@router.post("/{session_id}/{doc_id}/vectorize")
@login_required
async def vectorize_doc(session_id: str, doc_id:str, request:Request, user_id=None):
    data = await request.json()
    doc = SessionDoc.objects(session_id=session_id, id=doc_id, owner_id=user_id).first()
    # print(data['content_json'])
    if not doc:
        return JSONResponse(status_code=404,content={'error':"Not a valid document found"})
   
    

    # content_json: may be list of blocks, may be dict, may be plain text
    # We'll treat as list of blocks with 'text', or as fallback string.
    # Use the specific schema for extracting text
    blocks = doc.content_json
    # print(blocks)
    texts = []

    # Traverse and extract all text from this specialized tiptap schema
    def extract_texts_from_block(block):
        if isinstance(block, dict):
            txts = []
            # Text leaf
            if block.get('type') == 'text' and 'text' in block:
                txts.append(block['text'])
            # Content array (e.g. paragraph, heading, taskItem, etc)
            if 'content' in block and isinstance(block['content'], list) and 'type' in block and block['type'] != 'heading':
                for child in block['content']:
                    txts.extend(extract_texts_from_block(child))
            # taskItem's paragraph is under 'content'
            return txts
        elif isinstance(block, list):
            txts = []
            for b in block:
                txts.extend(extract_texts_from_block(b))
            return txts
        return []

    # According to schema, main content is under blocks['content']
    if isinstance(blocks, dict) and blocks.get('type') == 'doc' and 'content' in blocks:
        texts = extract_texts_from_block(blocks['content'])
    elif isinstance(blocks, list):
        texts = extract_texts_from_block(blocks)
    else:
        texts = []

    # Concatenate all texts into one string
    joined = " ".join(texts)
    # print('Joined',joined)
    # Use LangChain RecursiveCharacterTextSplitter to split into ~100 character chunks
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=150,
        chunk_overlap=20,
        separators=["\n\n", "\n", ".", "!", "?", " "]
    )
    transcript_chunks = [chunk.strip() for chunk in splitter.split_text(joined) if chunk.strip()]
    print(transcript_chunks)
    item_type = "doc"
    reindex_pinecone(str(doc.id), str(session_id),user_id, transcript_chunks, item_type)
    return {'message':"Reindexed successfully"}




# Fetch all chat threads for a user



# INSERT_YOUR_CODE



# You may already have a router defined as "router"

# Define a message schema

class ParagraphBlock(BaseModel):
    type: Literal["paragraph"]
    text: str


class HeadingBlock(BaseModel):
    type: Literal["heading"]
    text: str
    level: int = Field(ge=1, le=6)


class TaskBlock(BaseModel):
    type: Literal["task"]
    text: str
    completed: bool = False

Block = HeadingBlock | TaskBlock | ParagraphBlock

class AllBlocks(BaseModel):
    blocks: List[Block]


@router.post("/{doc_id}/block")
async def create_doc_block(doc_id: str, request:Request):

    data = await request.json()
    # print(data)
    llm = ChatOpenAI(
        api_key=os.environ.get('OPENAI_API_KEY'),
        model="gpt-4.1-mini",
        temperature=0
    )

    # Instead of passing List[Block] directly (which causes issubclass TypeError),
    # we parse to concrete Pydantic models for the output parser.
    # Let’s use HeadingBlock, TaskBlock, ParagraphBlock
    # block_types = list(get_args(Block))
    print(data['summaries'])
    parser = PydanticOutputParser(pydantic_object=AllBlocks)
    prompt = f"""
    Generate structured document content based on the user input relative to the summaries of the the transcript

    {parser.get_format_instructions()}

    Rules:
    - Return ONLY valid JSON
    - Do not include markdown or explanations
    - Tasks must be actionable
    - Headings must include level if present

    Make sure the elements are returned in sequential order, for instance, if we have a list of action items, we return a Heading or Paragraph block first, then the Task Blocks

    Summaries:
    {
    "\n".join(data['summaries'])
    }

    Input:
    {data['input']}


    """

    result = llm.invoke(prompt)
    all_blocks = parser.parse(result.content)
    # print(all_blocks)
    content = compile_to_tiptap(all_blocks.blocks)
    return {'content':content}





