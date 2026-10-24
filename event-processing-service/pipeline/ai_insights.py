import os
from typing import List, Dict, Optional
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

GENERIC_TITLE_PATTERNS = [
    "zoom meeting",
    "personal meeting room",
    "teams meeting",
    "google meet",
    "untitled",
    "voicesight meeting note",
    "voice meeting"
]

def is_generic_title(title: Optional[str]) -> bool:
    if not title or not title.strip():
        return True
    lower = title.strip().lower()
    return any(p in lower for p in GENERIC_TITLE_PATTERNS)

def get_openai_client() -> Optional[OpenAI]:
    api_key = os.environ.get("OPENAI_API_KEY")
    return OpenAI(api_key=api_key) if api_key else None

def generate_insights_for_transcript(
    transcript_text: str,
    provider_title: Optional[str] = None,
    default_title: str = "VoiceSight Meeting Note"
) -> Dict[str, any]:
    """
    Generates meeting overview, summaries, chat suggestions, and doc suggestions.
    Preserves provider native meeting title (e.g. from Zoom/Teams/Meet) unless missing/generic.
    """
    client = get_openai_client()
    
    chosen_title = provider_title if (provider_title and not is_generic_title(provider_title)) else default_title

    result = {
        "title": chosen_title,
        "ai_title": None,
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
                ai_gen_title = line.split(":", 1)[1].strip().strip('"')
                result["ai_title"] = ai_gen_title
                if is_generic_title(result["title"]):
                    result["title"] = ai_gen_title
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
        print(f"[AI Insights] Notice: OpenAI generation note: {e}. Using fallback defaults.")

    return result
