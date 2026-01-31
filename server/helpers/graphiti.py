import os
from graphiti_core import Graphiti
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
# Initialize Graphiti with Neo4j connection
neo4j_uri = os.environ.get('NEO4J_URI', 'bolt://localhost:7687')
neo4j_user = os.environ.get('NEO4J_USERNAME', 'neo4j')
neo4j_password = os.environ.get('NEO4J_PASSWORD', 'password')





# Define custom entity types for Graphiti based on your Pydantic models.
from pydantic import BaseModel, Field

# Define pydantic models for entities

class VoiceSession(BaseModel):
    id: str
    title: str
    description: str
    updated_at: str
    user_id: str

class Utterance(BaseModel):
    id: str
    text: str
    start_time: float
    end_time: float
    sentiment: float
    intent: str
    voice_session_id: str
    speaker_id: str

class Speaker(BaseModel):
    id: str
    name: str
    user_id: str

class Topic(BaseModel):
    id: str
    name: str
    description: str
    user_id: str

class Decision(BaseModel):
    id: str
    text: str
    voice_session_id: str
    user_id: str

class Task(BaseModel):
    id: str
    text: str
    assigned_to: str
    due_date: str
    decision_id: str
    user_id: str

class EntityGeneric(BaseModel):
    id: str
    name: str
    type: str
    description: str
    user_id: str

# Register entity-type mapping for Graphiti (mapping names to pydantic models)
entity_types = {
    "VoiceSession": VoiceSession,
    "Utterance": Utterance,
    "Speaker": Speaker,
    "Topic": Topic,
    "Decision": Decision,
    "Task": Task,
    "Entity": EntityGeneric,
}

# Edge types remain unchanged as their config isn't dictated by fields structure in this context.
from pydantic import BaseModel

class UtteranceToSpeaker(BaseModel):
    utterance_id: str
    speaker_id: str

class UtteranceToSession(BaseModel):
    utterance_id: str
    voice_session_id: str

class SessionToTopic(BaseModel):
    voice_session_id: str
    topic_id: str

class SpeakerToTask(BaseModel):
    speaker_id: str
    task_id: str

class SessionToDecision(BaseModel):
    voice_session_id: str
    decision_id: str

class DecisionToTask(BaseModel):
    decision_id: str
    task_id: str

from pydantic import BaseModel

class UtteranceToSpeaker(BaseModel):
    utterance_id: str
    speaker_id: str

class UtteranceToSession(BaseModel):
    utterance_id: str
    voice_session_id: str

class SessionToTopic(BaseModel):
    voice_session_id: str
    topic_id: str

class SpeakerToTask(BaseModel):
    speaker_id: str
    task_id: str

class SessionToDecision(BaseModel):
    voice_session_id: str
    decision_id: str

class DecisionToTask(BaseModel):
    decision_id: str
    task_id: str

# Register edge types
edge_types = {
    "SPOKEN_BY": UtteranceToSpeaker,
    "IN_SESSION": UtteranceToSession,
    "HAS_TOPIC": SessionToTopic,
    "ASSIGNED_TASK": SpeakerToTask,
    "HAS_DECISION": SessionToDecision,
    "GENERATED_TASK": DecisionToTask
}

# Describe valid edges between types (from_type, to_type): [edge_names]
edge_type_map = {
    ("Utterance", "Speaker"): ["SPOKEN_BY"],
    ("Utterance", "VoiceSession"): ["IN_SESSION"],
    ("VoiceSession", "Topic"): ["HAS_TOPIC"],
    ("Speaker", "Task"): ["ASSIGNED_TASK"],
    ("VoiceSession", "Decision"): ["HAS_DECISION"],
    ("Decision", "Task"): ["GENERATED_TASK"],
}

async def connect_graphiti():
    graphiti = Graphiti(neo4j_uri, neo4j_user, neo4j_password)
    try:
        # Initialize the graph database with graphiti's indices. This only needs to be done once.
        await graphiti.build_indices_and_constraints()
        
        # Additional code will go here
        
        return graphiti
    finally:
        # Close the connection
        graphiti.close()
        print('\nConnection closed')
    

async def add_graphiti_record(summary: str, user_id:str):
    try:
        graphiti = Graphiti(neo4j_uri, neo4j_user, neo4j_password)
        await graphiti.add_episode(
            name=f"Session Update By ${user_id}",
            episode_body=f'User id {user_id} said: '+summary,
            source_description="Meeting notes",
            reference_time=datetime.now(),
            group_id='voice-session',
            entity_types=entity_types,
            # excluded_entity_types=["Person"]  # Won't extract Person entities
        )
    except Exception as e:
        print(f"Error in add_graphiti_record: {e}")

async def query_graphiti_by_text(query: str):
    graphiti = Graphiti(neo4j_uri, neo4j_user, neo4j_password)
    def print_facts(edges):
        print("\n".join([edge.fact for edge in edges]))
    # Hybrid Search
    results = await graphiti.search(query, group_ids=['voice-session'])
    return "\n".join([edge.fact for edge in results])
