import datetime
from typing import List
from fastapi import APIRouter, HTTPException, Request,status,Query
from fastapi.responses import JSONResponse
from langchain_core.output_parsers import PydanticOutputParser
from langchain_openai import ChatOpenAI
from pydantic import BaseModel
from models import Session
from helpers.auth import login_required
from openai import OpenAI
import json
import os
import httpx
import requests
from dotenv import load_dotenv
import asyncio
# Use a MongoEngine transaction to ensure atomic deletes of related documents and the session
from mongoengine import get_connection
from mongoengine.context_managers import switch_db
from models import SessionDoc, ChatSession

from config.mongo import connect_to_mongo

# from server.config.mongo import connect_to_mongo
from schema import TranscriptPartitionModel
from helpers.graphiti import add_graphiti_record
from helpers.pinecone import add_pinecone_data, query_pinecone, query_pinecone_threshold
from config.rate_limiter import limiter
load_dotenv()

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
router = APIRouter(prefix="/sessions", tags=["sessions"])
# print(os.environ.get("OPENAI_API_KEY"))

connect_to_mongo()

@router.post("/")
@login_required
@limiter.limit("5/10minutes")
async def create_session(
    request: Request = None,
    user_id: str = None
):
    # Placeholder: use `data` to create a new session
    try:
        session = Session(
            title="Untitled Session",
            created_at=datetime.datetime.utcnow(),
            total_duration=0,
            word_count=0,
            speakers=[],
            # starred=False,
            finished=False,
            tags=[],
            ai_overview="",
            transcript=[],
            owner_id=user_id
            # owner=user['id'],
        )
        session.save()
        data = session.to_dict()
        
        return JSONResponse(content={"message": "Session created", "session": data}, status_code=201)
    except Exception as e:
        # print(e)
        return JSONResponse(content={"error": e}, status_code=500)



class PromptInput(BaseModel):
    prompt: str
    title: str

class AiSuggestions(BaseModel):
    chat_suggestions: List[PromptInput]
    doc_suggestions: List[PromptInput]

@router.post("/{session_id}/finish")
@login_required
async def finish_recording(session_id: str, 
request: Request = None,
    user_id: str = None):
    try:
        data = await request.json()
        session = Session.objects(id=session_id, owner_id=user_id).first()

        if not session:
            return JSONResponse(content={"error": "No valid session"}, status_code=401)
        title = client.responses.create(
        model="gpt-5-nano",
        input=f'''

        Based on the transcript summaries, provide a general title for this recording session. Return only the title     
        Summaries:{str([s for s in session.summaries])}
        
        '''
        )

        ai_overview = client.responses.create(
        model="gpt-5-nano",
        input=f'''

        Based on the transcript summaries, provide a brief overview of the content and its significance in 2 sentences or less. Return only the summary       
        Summaries:{str([s for s in session.summaries])}
        
        '''
        )

        llm = ChatOpenAI(
        api_key=os.environ.get('OPENAI_API_KEY'),
        model="gpt-4.1-mini",
        temperature=0.5
        )

        # Instead of passing List[Block] directly (which causes issubclass TypeError),
        # we parse to concrete Pydantic models for the output parser.
        # Let’s use HeadingBlock, TaskBlock, ParagraphBlock
        # block_types = list(get_args(Block))
        print('here')
        
        parser = PydanticOutputParser(pydantic_object=AiSuggestions)

        prompt = f"""
        
        Generate both document/note editing prompt suggestions and chatting suggestions based on the summaries:

        {parser.get_format_instructions()}

        Document suggestons should be used for creating useful notes or templates such as: key insights, action items, email templates, summaries, overviews, but should be based and applied to the current context of summaries

        Chat suggestions should be used to summarizing key items, like action items, summaries, key insights, and overviews but also provide tools, like add deadlines to google calandar, add tasks to linear, send slack update of talk to users

        Rules:
            - Return ONLY valid JSON
            - Do not include markdown or explanations
            - Chat Suggestions can be actionable
        
        Summaries:
        {'\n'.join(session.summaries)}



        """

        result = llm.invoke(prompt)
        suggestions = parser.parse(result.content)
        
    # print(all_blocks)
        print('suggest',suggestions)


        # Use AiSuggestion embedded document from Session model to store suggestions
        session.chat_suggestions = [
            Session.PromptEntry(prompt=item.prompt, title=item.title)
            for item in suggestions.chat_suggestions
        ]
        session.doc_suggestions = [
            Session.PromptEntry(prompt=item.prompt, title=item.title)
            for item in suggestions.doc_suggestions
        ]
        session.title = title.output_text
        session.ai_overview = ai_overview.output_text
        session.word_count = data['word_count']
        session.total_duration = data['total_duration']
        session.finished=True
        session.save()
        return {'message':"Good boy"}
    except Exception as e:
        return JSONResponse(content={"error": "Unexpected error occured"}, status_code=500)
    
    

@router.post("/{session_id}/save")
@login_required
async def save_transcript_partition(session_id: str, data:TranscriptPartitionModel,
request: Request = None,
user_id: str = None
):
    
    # data = await request.json()
    
    session = Session.objects(id=session_id, owner_id=user_id).first()    
    # Session.objects(id=session_id).update(push_all__transcript=data.partition)
    
    if not session:
        return JSONResponse(content={'error':"Cannot find session"},status_code=404)
    # Split data.partition into 4 approximately equal documents and add to pinecone vector DB

    partition_list = list(data.partition)
    n = len(partition_list)
    k=4
    if n > 0:
        chunk_size = max(1, n // k)
        doc_chunks = [partition_list[i:i+chunk_size] for i in range(0, n, chunk_size)]
        # Limit to at most k documents
        doc_chunks = doc_chunks[:k]
        docs = [' '.join(entry.text for entry in chunk) for chunk in doc_chunks]
        add_pinecone_data(docs, session_id, user_id)
    # print(data.partition)
    print('Saving transcript')
    # print(session.transcript)
    # Convert Pydantic TranscriptEntryModel dicts to Mongoengine EmbeddedDocument objects
    for entry in data.partition:
        session.transcript.append(
            session.TranscriptEntry(
                start_duration=entry.start_duration, 
                text=entry.text
            )
        )
    summary = client.responses.create(
    model="gpt-5-nano",
    input=f'''

    Can you provide a comprehensive summary of the given transcript partition? The summary should cover all the key points and main ideas presented in the original text, while also condensing the information into a concise and easy-to-understand format. Please ensure that the summary includes relevant details and examples that support the main ideas, while avoiding any unnecessary information or repetition. The length of the summary should be appropriate for the length and complexity of the original text, providing a clear and accurate overview without omitting any important information.
    
    Transcript (one whole text): {'\n'.join(s.text + ' ' for s in data.partition)}
    
    '''
    )
    
    # await add_graphiti_record(summary.output_text, user_id)
    session.summaries.append(summary.output_text)
    session.save()


@router.get("/token")
async def get_token(request: Request):
    try:
        
        session_config = {
            "session": {
                "type": "transcription",
                "audio": {
                    "input": {
                        "format": {
                            'type': 'audio/pcm',
                            'rate':24000
                            # You could specify format details here if needed, e.g.: "type": "pcm", "sampling_rate": 16000
                        },
                        "transcription": {
                            # "format": "text",
                            "model": 'gpt-4o-mini-transcribe'
                            # Optionally, you could add other config like language, prompt, model, turn_detection, etc.
                        },
                        "turn_detection": {
                            "type": "server_vad",
                            # 'create_response':True,
                            # 'eagerness':'high'
                            "threshold": 0.3,
                            "prefix_padding_ms": 300,
                            "silence_duration_ms": 200,
                            # "idle_timeout_ms": null,
                            "create_response": True,
                            "interrupt_response": True
                        }
                        # "noise_reduction": None,  # optional, can enable/disable as needed
                    },
                    
                },
               
            },
            # "expires_after": { "seconds": 3600 }  # Optional: e.g. 1 hour expiration for the client secret
        }
        
        response = requests.post(
            "https://api.openai.com/v1/realtime/client_secrets",
            headers={
                "Authorization": f"Bearer {os.environ.get('OPENAI_API_KEY')}",
                "Content-Type": "application/json"
            },
            json=session_config,
        )
        data = response.json()
        return JSONResponse(content=data, status_code=response.status_code)
    except Exception as error:
        # print("Token generation error:", error)
        return JSONResponse(
            content={"error": "Failed to generate token"},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )




@router.get("/")
@login_required
async def get_sessions(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Sessions per page"),
    search_query: str = Query(None, description="Search query (optional)"),
    # removed extra query param, as it's redundant and likely a copy-paste error
    request: Request = None,
    user_id: str = None
):
    try:
        print('user_id',user_id)
        skip = (page - 1) * page_size
        # total_sessions = Session.objects.count()
        query = {"owner_id": user_id}
        if search_query:
            # We search both title (case insensitive) and (optionally) other fields.
            query["title__icontains"] = search_query
        sessions_query = (
            Session.objects(**query)
            .order_by("-created_at")
            .skip(skip)
            .limit(page_size)
        )
        
        sessions = [s.to_dict() for s in sessions_query]
        total = Session.objects(owner_id=user_id).count()
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        return {
            "sessions": sessions,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages
            }
        }
        
    except Exception as error:
        # print("Error fetching sessions:", error)
        
        return JSONResponse(
            content={"error": "Failed to fetch sessions"},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.get("/{session_id}")
async def get_session(session_id: str):
    # Placeholder implementation
    try:
        session = Session.objects(id=session_id).first()
        # print(session)
        return {'session': session.to_dict()}
        
    except Exception as e:
        return JSONResponse(
            content={"error": "Failed to fetch session"},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

@router.post("/ai-search/")
@login_required
async def search_transcripts(request:Request,user_id=None):
    # Placeholder implementation
    data = await request.json()
    # print(data)
    try:
        results = query_pinecone(data['query'],user_id,7)
        print('res',data['query'],results)
        return {'results':results}
        
    except Exception as e:
        return JSONResponse(
            content={"error": "Failed to fetch session"},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

  

@router.delete("/{session_id}")
@login_required
async def delete_session(session_id: str, request:Request, user_id=None, ):
    try:
        session = Session.objects(id=session_id, owner_id=user_id).first()
        if not session:
            return JSONResponse(
                content={"error": "Session not found"},
                status_code=404,
            )
        

        connection = get_connection()
        with connection.start_session() as s:
            with s.start_transaction():
                SessionDoc.objects(session_id=session.id).delete()
                ChatSession.objects(session_id=session.id).delete()
                session.delete()
        return {"message": f"Session {session_id} deleted"}
    except Exception as e:
        return JSONResponse(
            content={"error": "Failed to delete session"},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

