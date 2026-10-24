from fastapi import APIRouter, HTTPException, Request, status, Query, Body
from fastapi.responses import JSONResponse
from typing import List, Dict, Optional, Any
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import StructuredTool
from openai import OpenAI
from pydantic import BaseModel, Field
from bson import ObjectId
from pymongo import message
from config.mongo import connect_to_mongo
from langchain_core.messages import BaseMessage, ChatMessage, ToolMessage, AIMessage
from langchain_openai import ChatOpenAI
from models import ChatSession, Session
from schema import Pagination
from config.rate_limiter import limiter
from tools import (
    append_rows_to_google_sheet,
    get_google_calendars,
    get_linear_teams,
    create_linear_issues,
    add_google_calendar_events_rest,
    query_graphiti_tool,
    slack_list_channels,
    slack_post_message
)

from langchain.agents import create_agent
import os
import json

from helpers.auth import login_required


client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY") or "dummy")
router = APIRouter(prefix="/chats", tags=["chats"])
connect_to_mongo()


def extract_response_schema(result_messages: list, fallback_content: str = "") -> dict:
    """
    Inspects messages produced by the LangChain orchestrator to return a structured output schema:
    - auth_error: when authentication / app connection is needed
    - tool schemas: linear_teams, linear_issues, google_calendars, google_calendar_events,
                    google_sheet_rows, slack_channels, slack_message, graphiti_search
    - text: regular chat message
    """
    # 1. Search backwards for any tool result messages
    for msg in reversed(result_messages):
        is_tool = isinstance(msg, ToolMessage) or getattr(msg, 'type', '') == 'tool'
        if is_tool:
            raw_content = getattr(msg, 'content', '')
            data = None
            if isinstance(raw_content, dict):
                data = raw_content
            elif isinstance(raw_content, str):
                try:
                    data = json.loads(raw_content)
                except Exception:
                    data = None

            if isinstance(data, dict) and 'type' in data:
                msg_type = data['type']
                msg_text = data.get('message') or fallback_content or "Action completed."
                return {
                    'role': 'assistant',
                    'type': msg_type,
                    'content': msg_text,
                    'data': data
                }

            # Check if raw_content contains text-based auth error
            if isinstance(raw_content, str):
                lower_content = raw_content.lower()
                for app_key, app_label in [
                    ('google-calendar', 'Google Calendar'),
                    ('google-sheets', 'Google Sheets'),
                    ('linear', 'Linear'),
                    ('slack', 'Slack')
                ]:
                    if app_label.lower() in lower_content and ("not connected" in lower_content or "connect" in lower_content or "fail" in lower_content):
                        return {
                            'role': 'assistant',
                            'type': 'auth_error',
                            'content': raw_content,
                            'data': {
                                'app_id': app_key,
                                'app_name': app_label,
                                'message': raw_content,
                                'auth_url': '/apps'
                            }
                        }

    # 2. Check last message
    last_message = result_messages[-1] if result_messages else None
    last_content = getattr(last_message, 'content', fallback_content) or fallback_content
    if isinstance(last_content, list):
        last_content = " ".join([b.get("text", "") if isinstance(b, dict) else str(b) for b in last_content])

    lower_last = str(last_content).lower()
    for app_key, app_label in [
        ('google-calendar', 'Google Calendar'),
        ('google-sheets', 'Google Sheets'),
        ('linear', 'Linear'),
        ('slack', 'Slack')
    ]:
        if app_label.lower() in lower_last and ("not connected" in lower_last or "please connect" in lower_last or "need to connect" in lower_last):
            return {
                'role': 'assistant',
                'type': 'auth_error',
                'content': last_content,
                'data': {
                    'app_id': app_key,
                    'app_name': app_label,
                    'message': last_content,
                    'auth_url': '/apps'
                }
            }

    return {
        'role': 'assistant',
        'type': 'text',
        'content': last_content,
        'data': None
    }


# in client if not chat_session id create new one, and then load it
@router.post("/")
@login_required
async def get_all_chats(
    pagination: Pagination,
    user_id=None,
    request: Request = None
):
    body = await request.json() if request else {}

    page = pagination.page or 1
    page_size = pagination.page_size or 10

    skip = (page - 1) * page_size
    search_query = pagination.search_query
    query_obj = {"owner_id": user_id}
    if search_query:
        query_obj["title__icontains"] = search_query
    query = ChatSession.objects(**query_obj).only("id", "title", "created_at", 'session_id').order_by("-created_at")
    total = query.count()
    docs = query.skip(skip).limit(page_size)
    # Fetch docs and their related session details
    parsed_docs = []
    for doc in query.skip(skip).limit(page_size):
        doc_dict = doc.to_dict()
        session = doc.session_id

        if session:
            doc_dict['session'] = {
                'title': session.title,
                'created_at': session.created_at,
            }
        else:
            doc_dict['session'] = None
        
        parsed_docs.append(doc_dict)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    pagination.total = total
    pagination.total_pages = total_pages
    print(parsed_docs)
    return {
        'chats': parsed_docs,
        'pagination': pagination.model_dump()
    }


# Create a new chat thread for a user
@router.post("/{session_id}")
@limiter.limit("5/10minutes")
@login_required
async def create_chat_for_user(session_id: str, request: Request, user_id=None):
    data = await request.json()
    session = Session.objects(id=session_id, owner_id=user_id)
    if not session:
        return JSONResponse(status_code=404, content={'error': "No session found"})

    title = client.responses.create(
        model="gpt-5-nano",
        input=f'''
        Based on the current chat message, provide a title initiating what the current conversation is about. No filler words, return ONLY the title.        
        Input:{data['chat_input']}
        '''
    )

    chat_session = ChatSession(
        messages=[ChatSession.Message(role="user", content=data['chat_input'], type="text", data={})],
        title=title.output_text,
        session_id=session_id,
        owner_id=user_id
    )

    chat_session.save()
    return {'chat': chat_session.to_dict()}


# Fetch all chat threads for a user
@router.get("/{session_id}")
def get_chats(session_id: str):
    chat_sessions = ChatSession.objects(session_id=session_id).order_by("-created_at")
    if not chat_sessions:
        return JSONResponse(status_code=404, content={'error': "No chat sessions found"})
    return {'chats': [chat_session.to_dict() for chat_session in chat_sessions]}


@router.get("/{session_id}/{chat_id}")
def get_chat(session_id: str, chat_id: str):
    chat_session = ChatSession.objects(session_id=session_id, id=chat_id).first()
    if not chat_session:
        return JSONResponse(status_code=404, content={'error': "Not a valid chat session found"})
    return {'chat': chat_session.to_dict()}


@router.delete("/{chat_id}/")
@login_required
async def delete_chat(chat_id: str, request: Request, user_id=None):
    chat_session = ChatSession.objects(owner_id=user_id, id=chat_id).first()
    if chat_session:
        chat_session.delete()
        return {"message": "Chat session deleted successfully"}

    return JSONResponse(status_code=404, content={'error': "Not a valid chat session found"})


class InputText(BaseModel):
    class Message(BaseModel):
        role: str
        content: str
        type: Optional[str] = "text"
        data: Optional[Dict[str, Any]] = None
    messages: List[Message]
    new_message: Message
    summaries: List[str]

model = ChatOpenAI(
            api_key=os.environ.get('OPENAI_API_KEY'),
            model='gpt-5-nano'
        )
agent = create_agent(
    model=model,
    tools=[
        get_google_calendars,
        get_linear_teams,
        create_linear_issues,
        add_google_calendar_events_rest,
        append_rows_to_google_sheet,
        slack_list_channels,
        slack_post_message
    ]
)

@router.post("/{chat_id}/message")
@login_required
async def create_conversation_with_tools(
    chat_id: str,
    body: InputText,
    request: Request = None,
    user_id: str = None
):
    """
    Creates a conversation with tools using create_agent.
    Extracts structured output schemas for auth errors, tools, and text.
    """
    try:
        init_prompt = f'''
        You are a helpful AI assistant answering the user questions based on the following session summaries.
        You are also given a list of tools for Linear, Google Calendar, Google Sheets, and Slack.
        Do not use tools unless the user explicitly or implicitly asks or states an action for them; maintain a natural conversation.
        Summaries:{chr(10).join(body.summaries)}
        '''

        

        lc_messages = [{'role': "system", 'content': init_prompt}]
        for m in body.messages:
            lc_messages.append({'role': m.role, 'content': m.content})
        lc_messages.append({'role': body.new_message.role, 'content': body.new_message.content})

        result = await agent.ainvoke({
            "messages": lc_messages,
            "user_preferences": {"style": "technical", "verbosity": "detailed"},
        }, config=RunnableConfig(configurable={"user_id": user_id}))

        result_messages = result.get('messages', [])
        formatted_response = extract_response_schema(result_messages, fallback_content="")

        # Save both user message and assistant reply with structured schema to chat history
        ChatSession.objects(id=chat_id).update_one(
            push_all__messages=[
                ChatSession.Message(
                    role=body.new_message.role,
                    content=body.new_message.content,
                    type=body.new_message.type or 'text',
                    data=body.new_message.data or {}
                ),
                ChatSession.Message(
                    role='assistant',
                    content=formatted_response['content'],
                    type=formatted_response['type'],
                    data=formatted_response.get('data') or {}
                )
            ]
        )

        return {'message': formatted_response}
    except Exception as e:
        print("Error in create_conversation_with_tools:", e)
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/knowledge-base/")
@limiter.limit("5/minute")
@login_required
async def ask_knowledgebase(
    body: InputText,
    request: Request = None,
    user_id: str = None
):
    """
    Creates a conversation with tools and Graphiti knowledge base search.
    Extracts structured output schemas.
    """
    try:
        init_prompt = f'''
        You are a helpful assistant for Voicesights. Your primary goal is to provide accurate answers by consulting the provided knowledge base documents.
        **Context:** You have access to a list of voice session transcripts with a variety of use cases meeting summaries, notes, etc.

        **Instructions:**
        1. When a user asks a question, first search the Graphiti knowledge base for relevant information.
        2. Synthesize the information from the documents to form a clear, concise answer.
        3. **Crucially, cite every piece of information taken from the knowledge base.** Use [Source: DocumentName, Page/Section] format.
        4. If the knowledge base does not contain the answer, respond with: "I couldn't find that information in the knowledge base. Please try rephrasing your question or checking."
        5. Maintain a helpful tone.
        '''

        model = ChatOpenAI(
            api_key=os.environ.get('OPENAI_API_KEY'),
            model='gpt-3.5-turbo'
        )
        agent = create_agent(
            model=model,
            tools=[
                get_google_calendars,
                get_linear_teams,
                create_linear_issues,
                add_google_calendar_events_rest,
                append_rows_to_google_sheet,
                query_graphiti_tool
            ]
        )

        lc_messages = [{'role': "system", 'content': init_prompt}]
        for m in body.messages:
            lc_messages.append({'role': m.role, 'content': m.content})
        lc_messages.append({'role': body.new_message.role, 'content': body.new_message.content})

        result = await agent.ainvoke({
            "messages": lc_messages,
            "user_preferences": {"style": "technical", "verbosity": "detailed"},
        }, config=RunnableConfig(configurable={"user_id": user_id}))

        result_messages = result.get('messages', [])
        formatted_response = extract_response_schema(result_messages, fallback_content="")

        return {'message': formatted_response}
    except Exception as e:
        print("Error in ask_knowledgebase:", e)
        return JSONResponse(status_code=500, content={"error": str(e)})
