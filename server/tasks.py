import os
import threading
import logging
from typing import List
from celery_app import celery_app
from config.mongo import connect_to_mongo
from models import Session
from helpers.pinecone import add_pinecone_data
from openai import OpenAI
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel

# Set up basic logging if not yet configured
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PromptInput(BaseModel):
    prompt: str
    title: str


class AiSuggestions(BaseModel):
    chat_suggestions: List[PromptInput]
    doc_suggestions: List[PromptInput]


def _get_openai_client():
    api_key = os.environ.get("OPENAI_API_KEY") or "dummy"
    return OpenAI(api_key=api_key)


def dispatch_celery_task(task_func, *args, **kwargs):
    """
    Safely enqueues a Celery task with automatic background thread fallback
    if the Celery broker (e.g. Redis) is unavailable or encounters connection errors.
    """
    logger.info("yo what is this thing doing")
    try:
        logger.info("Found a worker pool to add the tasks to")
        return task_func.delay(*args, **kwargs)
    except Exception as exc:
        logger.warning(f"Celery broker unavailable ({exc}). Running {task_func.__name__} in background thread fallback.")
        t = threading.Thread(target=task_func, args=args, kwargs=kwargs, daemon=True)
        t.start()
        return None


@celery_app.task(name="tasks.process_transcript_partition_task", bind=True, max_retries=3)
def process_transcript_partition_task(self, session_id: str, user_id: str, partition_entries: list):
    """
    Background Celery task to perform expensive operations for a transcript partition:
    1. Chunk and embed entries in Pinecone vector DB.
    2. Generate partition summary using OpenAI gpt-5-nano.
    3. Append summary to session.summaries in MongoDB.
    """
    connect_to_mongo()
    try:
        session = Session.objects(id=session_id).first()
        if not session:
            logger.warning(f"Session {session_id} not found in partition task")
            return {"status": "session_not_found"}
        logger.info("Found session")
        # 1. Pinecone embedding
        n = len(partition_entries)
        k = 4
        if n > 0:
            chunk_size = max(1, n // k)
            doc_chunks = [partition_entries[i:i + chunk_size] for i in range(0, n, chunk_size)]
            doc_chunks = doc_chunks[:k]
            docs = [' '.join(entry.get('text', '') for entry in chunk) for chunk in doc_chunks]
            add_pinecone_data(docs, session_id, user_id)

        # 2. AI summary generation
        logger.info("Generating summary")
        transcript_text = '\n'.join(s.get('text', '') + ' ' for s in partition_entries)
        if transcript_text.strip():
            client = _get_openai_client()
            summary = client.responses.create(
                model="gpt-5-nano",
                input=f'''
Can you provide a comprehensive summary of the given transcript partition? The summary should cover all the key points and main ideas presented in the original text, while also condensing the information into a concise and easy-to-understand format. Please ensure that the summary includes relevant details and examples that support the main ideas, while avoiding any unnecessary information or repetition. The length of the summary should be appropriate for the length and complexity of the original text, providing a clear and accurate overview without omitting any important information.

Transcript (one whole text): {transcript_text}
'''
            )
            summary_text = getattr(summary, "output_text", str(summary))
            session.reload()
            session.summaries.append(summary_text)
            session.save()
            logger.info("Generated summary")
            return {"status": "success", "summary": summary_text}

        return {"status": "empty_partition"}
    except Exception as exc:
        logger.error(f"Error in process_transcript_partition_task for {session_id}: {exc}")
        if hasattr(self, "retry"):
            raise self.retry(exc=exc, countdown=10)
        raise exc


@celery_app.task(name="tasks.process_finish_session_task", bind=True, max_retries=2)
def process_finish_session_task(self, session_id: str, user_id: str, word_count: int, total_duration: int):
    """
    Background Celery task to finish a session:
    1. Generate title using gpt-5-nano based on transcript summaries.
    2. Generate ai_overview using gpt-5-nano.
    3. Generate chat_suggestions and doc_suggestions using gpt-4.1-mini.
    4. Update session status to 'completed'.
    """
    connect_to_mongo()
    try:
        logger.info('Found task')
        session = Session.objects(id=session_id).first()
        if not session:
            logger.warning(f"Session {session_id} not found in finish task")
            return {"status": "session_not_found"}

        session.status = "processing"
        session.save()

        client = _get_openai_client()

        # 1. Generate session title
        title_response = client.responses.create(
            model="gpt-5-nano",
            input=f'''
Based on the transcript summaries, provide a general title for this recording session. Return only the title     
Summaries:{str([s for s in session.summaries])}
'''
        )
        title_text = getattr(title_response, "output_text", "Meeting Session").strip()

        # 2. Generate AI overview
        overview_response = client.responses.create(
            model="gpt-5-nano",
            input=f'''
Based on the transcript summaries, provide a brief overview of the content and its significance in 2 sentences or less. Return only the summary       
Summaries:{str([s for s in session.summaries])}
'''
        )
        ai_overview_text = getattr(overview_response, "output_text", "").strip()

        # 3. Generate chat & doc suggestions
        llm = ChatOpenAI(
            api_key=os.environ.get('OPENAI_API_KEY') or "dummy",
            model="gpt-4.1-mini",
            temperature=0.5
        )

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
{chr(10).join(session.summaries)}
"""
        result = llm.invoke(prompt)
        suggestions = parser.parse(result.content)

        session.reload()
        session.chat_suggestions = [
            Session.PromptEntry(prompt=item.prompt, title=item.title)
            for item in suggestions.chat_suggestions
        ]
        session.doc_suggestions = [
            Session.PromptEntry(prompt=item.prompt, title=item.title)
            for item in suggestions.doc_suggestions
        ]
        session.title = title_text or session.title
        session.ai_overview = ai_overview_text
        session.word_count = word_count
        session.total_duration = total_duration
        session.finished = True
        session.status = "completed"
        session.save()

        return {
            "status": "completed",
            "title": title_text,
            "suggestions_count": len(session.chat_suggestions)
        }
    except Exception as exc:
        logger.error(f"Error in process_finish_session_task for {session_id}: {exc}")
        session = Session.objects(id=session_id).first()
        if session:
            session.status = "failed"
            session.save()
        if hasattr(self, "retry"):
            raise self.retry(exc=exc, countdown=15)
        raise exc
