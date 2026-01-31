import asyncio
import json
from datetime import datetime

from helpers.graphiti import add_graphiti_record, query_graphiti_by_text

test_data = [
  {
    "summary": "Alice suggested adding a dark mode feature to the mobile app. Task: Create a prototype by Friday. Feature should sync with user preferences.",
    "user_id": "user_001"
  },
  {
    "summary": "Bob reported a bug in the login flow where tokens expire prematurely. Task: Investigate and fix JWT refresh logic by Monday.",
    "user_id": "user_001"
  },
  {
    "summary": "Carol proposed improving search functionality using semantic embeddings. Decision: prioritize this after UI redesign is complete.",
    "user_id": "user_002"
  },
  {
    "summary": "Alice discussed implementing push notifications for key events in the app. Feature: allow users to subscribe/unsubscribe from notifications.",
    "user_id": "user_001"
  },
  {
    "summary": "Bob mentioned latency issues in the payment gateway. Task: benchmark API calls and optimize response times.",
    "user_id": "user_002"
  },
  {
    "summary": "Carol suggested documenting the new Graph RAG API endpoints for internal developers. Task: complete by end of week.",
    "user_id": "user_002"
  },
  {
    "summary": "Alice and Bob decided to delay the release of version 2.1 to address critical bugs in reporting module. Decision: postpone until QA sign-off.",
    "user_id": "user_001"
  },
  {
    "summary": "Bob proposed creating an internal dashboard to monitor microservices health. Feature: include alerts, uptime metrics, and error logging.",
    "user_id": "user_002"
  },
  {
    "summary": "Carol suggested integrating real-time transcription for video meetings using AssemblyAI. Task: evaluate cost and accuracy vs OpenAI Whisper.",
    "user_id": "user_002"
  },
  {
    "summary": "Alice reported an issue with CSV exports where data fields are misaligned. Bug: Fix export formatting for all modules.",
    "user_id": "user_001"
  },
  {
    "summary": "Bob recommended adding multi-language support for the onboarding flow. Decision: support English, Spanish, and French initially.",
    "user_id": "user_002"
  },
  {
    "summary": "Carol proposed a feature to track user session duration in analytics. Task: implement tracking with dashboards for team leads.",
    "user_id": "user_002"
  },
  {
    "summary": "Alice suggested creating a prototype for AI-driven feature recommendations. Task: Use Graph RAG embeddings to analyze user behavior.",
    "user_id": "user_001"
  },
  {
    "summary": "Bob mentioned a bug in the mobile push notifications: messages not received on Android 13. Task: fix ASAP and test on multiple devices.",
    "user_id": "user_002"
  },
  {
    "summary": "Carol discussed a potential partnership with a third-party analytics provider. Decision: schedule a demo next week.",
    "user_id": "user_002"
  }
]


async def bulk_insert():
    for record in test_data:
        await add_graphiti_record(record["summary"], record["user_id"])
    print('finish')
async def search(query):   
    res = await query_graphiti_by_text(query)
    print(res)

# Run the bulk insert
asyncio.run(search("How did we say we can imporve search"))