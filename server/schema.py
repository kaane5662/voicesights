from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class TranscriptEntryModel(BaseModel):
    start_duration: int = Field(..., description="Start duration in seconds")
    text: str = Field(..., description="Transcript text")

class TranscriptPartitionModel(BaseModel):
    partition: List[TranscriptEntryModel]



class CallandarEvent(BaseModel):
    summary: str = Field(..., description="Short summary or title for the event")
    start: str = Field(..., description="Event start time in ISO 8601 format")
    end: str = Field(..., description="Event end time in ISO 8601 format")
    description: Optional[str] = Field(None, description="Detailed description of the event")
    location: Optional[str] = Field(None, description="Location of the event")
    attendees: Optional[List[str]] = Field(None, description="List of attendee email addresses")
    

class CallandarEventsList(BaseModel):
    events: List[CallandarEvent]

    # INSERT_YOUR_CODE
class Pagination(BaseModel):
    page: Optional[int] = Field(1, description="Page number for pagination, default is 1.")
    page_size: Optional[int] = Field(10, description="Number of items per page, default is 10.")
    total: Optional[int] = Field(None, description="Total number of items.")
    total_pages: Optional[int] = Field(None, description="Total number of pages.")
