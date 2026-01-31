# INSERT_YOUR_CODE
from fastapi import APIRouter, HTTPException, Request, status, Query, Body
from fastapi.responses import JSONResponse
from typing import List, Dict, Optional
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import StructuredTool
from openai import OpenAI
from pydantic import BaseModel
from bson import ObjectId
from pymongo import message
from config.mongo import connect_to_mongo
from langchain_core.messages import BaseMessage, ChatMessage
from langchain_openai import ChatOpenAI
from models import ChatSession, Session
from schema import Pagination
from tools import append_rows_to_google_sheet, get_google_calendars,get_linear_teams,create_linear_issues,add_google_calendar_events_rest, query_graphiti_tool

from langchain.agents import create_agent
import os

from helpers.auth import login_required


client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
router = APIRouter(prefix="/chats", tags=["chats"])
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
@router.post("/")
@login_required
async def get_all_chats(
    pagination: Pagination,
    user_id=None,
    request: Request = None
):
    # Read additional body fields, such as session_id, if provided
    body = await request.json() if request else {}

    page = pagination.page or 1
    page_size = pagination.page_size or 10

    skip = (page - 1) * page_size

    query = ChatSession.objects(owner_id=user_id).only("id", "title", "created_at", 'session_id').order_by("-created_at")
    total = query.count()
    docs = query.skip(skip).limit(page_size)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    pagination.total = total
    pagination.total_pages = total_pages

    return {
        'chats': [doc.to_dict() for doc in docs],
        'pagination': pagination.model_dump()
    }
# Create a new chat thread for a user
@router.post("/{session_id}")
@login_required
async def create_chat_for_user(session_id: str, request:Request, user_id=None):

    data = await request.json()
    session = Session.objects(id=session_id, owner_id=user_id)
    if not session:
    
        return JSONResponse(status_code=404, content={'error':"No session found"})
    title = client.responses.create(
        model="gpt-5-nano",
        input=f'''

        Based on the the current chat message, provide a title initiating what the current conversation is about. No filler words, return ONLY the title.        
        Input:{data['chat_input']}
        
        '''
    )
    
    
    chat_session = ChatSession(
        messages = [ChatSession.Message(role="user", content=data['chat_input'])],
        title = title.output_text,
        session_id=session_id,
        owner_id=user_id
    )

    chat_session.save()
    return {'chat':chat_session.to_dict()}


# Fetch all chat threads for a user
@router.get("/{session_id}")
def get_chats(session_id: str):
    chat_sessions = ChatSession.objects(session_id=session_id).order_by("-created_at")
    # print(chat_sessions)
    if not chat_sessions:
        return JSONResponse(status_code=404,content={'error':"No chat sessions found"})
    return {'chats':[chat_session.to_dict() for chat_session in chat_sessions]}

@router.get("/{session_id}/{chat_id}")
def get_chat(session_id: str, chat_id:str):
    chat_session = ChatSession.objects(session_id=session_id, id=chat_id).first()
    if not chat_session:
        return JSONResponse(status_code=404,content={'error':"Not a valid chat session found"})
    return {'chat':chat_session.to_dict()}


# Fetch all chat threads for a user



# INSERT_YOUR_CODE



# You may already have a router defined as "router"

# Define a message schema

class InputText(BaseModel):
    class Message(BaseModel):
        # id: Optional[str]
        role: str
        content: str
    messages: List[Message]
    new_message: Message
    summaries: List[str]

@router.post("/{chat_id}/message")
@login_required
async def create_conversation_with_tools(chat_id: str, body: InputText, request: Request = None,
    user_id: str = None):
    """
    Creates a conversation with tools using create_react_agent.
    Ensures messages schema is respected.
    """
    
    try:
        # this function is a stand-in, you must implement your actual agent creation logic
        # "create_react_agent" should be an async function/model call that fits your infra
        
        init_prompt = f'''
        You are an helpful AI assistant answer the the user questions based on the following summaries.
        You are also given a list of tools, dont use tools unless the user asks, or states; maintain a regular conversation.
        Summaries:{'\n'.join(body.summaries)}

        '''

        # Use the chat-based model wrapper from langchain_openai for OpenAI chat endpoint
        model = ChatOpenAI(
            api_key=os.environ.get('OPENAI_API_KEY'),
            model='gpt-3.5-turbo'
        )
        agent = create_agent(
            model=model,
            tools = [get_google_calendars,get_linear_teams,create_linear_issues,add_google_calendar_events_rest, append_rows_to_google_sheet, query_graphiti_tool],
            
            # tools=body.tools or []
        )
        # print(body.messages)
        result = agent.invoke({
            "messages": (
                [{'role': "system", 'content': init_prompt}] +
                [m.model_dump() for m in body.messages+[body.new_message] ]
            ),
            "user_preferences": {"style": "technical", "verbosity": "detailed"},
            
        }, config=RunnableConfig(configurable={"user_id": user_id}))
        # print(result)
        
        # Check if the last message of the result is NOT a tool call
        # (assuming result['messages'] is a list and each message may have a 'tool_call' or similar indicator)
        last_message = result['messages'][-1]
        print(last_message)
        # if last_message.get('tool-call'):
        #     print('oog')
        # Add the new user message and the model's response (assistant reply) to chat history
        ChatSession.objects(id=chat_id).update_one(
            push_all__messages=[
                ChatSession.Message(
                    role=body.new_message.role,
                    content=body.new_message.content
                ),
                ChatSession.Message(
                    role='assistant',
                    content=last_message.content
                )
            ]
        )
        # Example: result might have { "messages": [...], "tools": [...] }
        return {'message': {'role':'assistant', 'content':last_message.content}}
    except Exception as e:
        print(e)
        return JSONResponse(status_code=500, content={"error": str(e)})



@router.post("/knowledge-base/")
@login_required
async def ask_knowledgebase(body: InputText, request: Request = None,
    user_id: str = None):
    """
    Creates a conversation with tools using create_react_agent.
    Ensures messages schema is respected.
    """
    
    try:
        # this function is a stand-in, you must implement your actual agent creation logic
        # "create_react_agent" should be an async function/model call that fits your infra
        
        init_prompt = f'''
        You are a a helpful assistant for Voicesights. Your primary goal is to provide accurate answers by consulting the provided knowledge base documents
        **Context:** You have access to a list of voice session transcripts with a variety of use cases meeting summaries, notes, etc.

        **Instructions:**
        1.  When a user asks a question, first search the Graphiti knowledge base for relevant information.
        2.  Synthesize the information from the documents to form a clear, concise answer.
        3.  **Crucially, cite every piece of information taken from the knowledge base.** Use [Source: DocumentName, Page/Section] format.
        4.  If the knowledge base does not contain the answer, respond with: "I couldn't find that information in the knowledge base. Please try rephrasing your question or checking."
        5.  Maintain a helpful tone

        '''

        # Use the chat-based model wrapper from langchain_openai for OpenAI chat endpoint
        model = ChatOpenAI(
            api_key=os.environ.get('OPENAI_API_KEY'),
            model='gpt-3.5-turbo'
        )
        agent = create_agent(
            model=model,
            tools = [get_google_calendars,get_linear_teams,create_linear_issues,add_google_calendar_events_rest, append_rows_to_google_sheet, query_graphiti_tool],
            
            # tools=body.tools or []
        )
        # print(body.messages)
        result = await agent.ainvoke({
            "messages": (
                [{'role': "system", 'content': init_prompt}] +
                [m.model_dump() for m in body.messages+[body.new_message] ]
            ),
            "user_preferences": {"style": "technical", "verbosity": "detailed"},
            
        }, config=RunnableConfig(configurable={"user_id": user_id}))
        # print(result)
        
        # Check if the last message of the result is NOT a tool call
        # (assuming result['messages'] is a list and each message may have a 'tool_call' or similar indicator)
        last_message = result['messages'][-1]
        print(last_message)
        # if last_message.get('tool-call'):
        #     print('oog')
        # Add the new user message and the model's response (assistant reply) to chat history
        # Example: result might have { "messages": [...], "tools": [...] }
        return {'message': {'role':'assistant', 'content':last_message.content}}
    except Exception as e:
        print(e)
        return JSONResponse(status_code=500, content={"error": str(e)})



