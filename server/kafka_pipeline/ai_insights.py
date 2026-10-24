import os
from typing import List, Dict, Tuple
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

def get_openai_client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    return OpenAI(api_key=api_key) if api_key else None

def generate_insights_for_transcript(
    transcript_text: str,
    default_title: str = "VoiceSight Meeting Note"
) -> Dict[str, any]:
    """
    Generates meeting title, overview, summaries, chat suggestions,
    and doc suggestions from the consolidated transcript text.
    """
    client = get_openai_client()
    
    # Defaults in case of missing API key or error
    result = {
        "title": default_title,
        "ai_overview": "Automatic transcript processed from meeting provider.",
        "summaries": ["Meeting recording and transcript processed."],
        "chat_suggestions": [
            {"prompt": "Summarize the key decisions made during this meeting", "title": "Key Decisions"},
            {"prompt": "Extract action items and assignees from the transcript", "title": "Action Items"},
            {"prompt": "What follow-ups are needed for this project?", "title": "Follow-ups"}
        ],
        "doc_suggestions": [
            {"prompt": "Create an executive meeting brief and summary notes", "title": "Executive Summary"},
            {"prompt": "Draft an email update for attendees and stakeholders", "title": "Follow-up Email"}
        ]
    }

    if not client or not transcript_text.strip():
        return result

    # Truncate text if excessively large for fast inference
    sample_text = transcript_text[:12000]

    try:
        # 1. Generate Title & AI Overview
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI meeting assistant. Generate a concise title (max 7 words) and a 2-sentence summary overview for the following meeting transcript. Format: TITLE: <title>\nOVERVIEW: <overview>"
                },
                {
                    "role": "user",
                    "content": sample_text
                }
            ],
            temperature=0.3,
            max_tokens=200
        )
        content = completion.choices[0].message.content or ""
        lines = content.strip().splitlines()
        for line in lines:
            if line.upper().startswith("TITLE:"):
                result["title"] = line.split(":", 1)[1].strip().strip('"')
            elif line.upper().startswith("OVERVIEW:"):
                result["ai_overview"] = line.split(":", 1)[1].strip()

        # 2. Generate Key Bullet Summaries
        sum_completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Provide 3 to 5 concise bullet points summarizing the key discussions and conclusions from this meeting transcript. Return one bullet per line without numbers or dashes."
                },
                {
                    "role": "user",
                    "content": sample_text
                }
            ],
            temperature=0.4,
            max_tokens=300
        )
        sum_text = sum_completion.choices[0].message.content or ""
        bullets = [b.strip().lstrip("•-* ").strip() for b in sum_text.splitlines() if b.strip()]
        if bullets:
            result["summaries"] = bullets

    except Exception as e:
        print(f"[AI Insights] Warning: OpenAI generation encountered error: {e}. Using fallback defaults.")

    return result
