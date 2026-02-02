from datetime import datetime
import os
from typing import List, Optional
from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from models import Profile
from pydantic import BaseModel, Field
import requests
import asyncio
import httpx

from helpers.jwt import decode_jwt, encode_jwt

# @tool("add_events_to_google_calendar", return_direct=True)
# def add_events_to_google_calendar(events: list) -> str:
    
#     # Placeholder mock implementation: In production, authenticate & call Google Calendar API here.
#     added = 0
#     for event in events:
#         if all(k in event for k in ('summary', 'start', 'end')):
#             # Here you would integrate with Google Calendar's API.
#             # For now, we simply count valid events.
#             added += 1
#         else:
#             continue
#     return f"{added} events added to Google Calendar." if added else "No valid events to add."

# Example test tool
# @tool("echo_sample_data", return_direct=True)
# def echo_sample_data(data: list) -> str:
#     """
#     Return a stringified version of the input list for testing purposes.
#     """
#     return f"You sent: {data}"


LINEAR_CLIENT_ID = os.environ["LINEAR_CLIENT_ID"]
LINEAR_CLIENT_SECRET = os.environ["LINEAR_CLIENT_SECRET"]
LINEAR_REDIRECT_URI = os.environ["LINEAR_REDIRECT_URI"]

@tool("get_linear_teams", return_direct=True)
def get_linear_teams(linear_api_key: str, config:RunnableConfig) -> str:
    """
    Fetch teams from a Linear workspace using the Linear API key. Note this is for the Linear app ONLY.
    Returns a formatted string listing team names and IDs.
    """
    user_id = config["configurable"]["user_id"]
    print('hello')
    profile = Profile.objects(id=user_id).first()
    url = "https://api.linear.app/graphql"
    headers = {
        "Authorization": linear_api_key,
        "Content-Type": "application/json"
    }
    
    linear_app:Profile.AuthorizationToken = next((app for app in profile.apps if app.app_id == 'linear'), None)
    linear_index = next((i for i, app in enumerate(profile.apps) if app.app_id == 'linear'), -1)
    r_token = decode_jwt(linear_app.refresh_token)


    resp = requests.post(
        "https://api.linear.app/oauth/token",
        data={
            "grant_type": "refresh_token",
            "client_id": LINEAR_CLIENT_ID,
            "client_secret": LINEAR_CLIENT_SECRET,
            "refresh_token": r_token['token'],
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    ).json()

    new_token = encode_jwt({'token':resp['refresh_token']})
    profile.apps[linear_index].refresh_token = new_token
    profile.save()

    headers = {
        "Authorization": f"Bearer {resp['access_token']}",
        "Content-Type": "application/json"
    }
    # this a valid query
    query = """
    query {
    teams {
        nodes {
        id
        name
        key
        }
    }
    }
    """
    response = requests.post(
        "https://api.linear.app/graphql",
        headers=headers,
        json={
            "query": query,
            # "variables": {"input": graphql_input}
        }
    )
    resp_data = response.json()
    # INSERT_YOUR_CODE
    teams = resp_data.get("data", {}).get("teams", {}).get("nodes", [])
    readable = 'Select a team: \n'+ "\n".join([f"{team['name']} (ID: {team['id']})" for team in teams])
    return readable
    # if "errors" in resp_data:
    #     return JSONResponse({"error": "Failed to create issue", "details": resp_data["errors"]}, status_code=400)
    # issue = resp_data.get("data", {}).get("issueCreate", {}).get("issue", {})
    print(resp_data)
    return resp_data
    

class LinearIssueInput(BaseModel):
    team_id: str = Field(..., description="The Linear team ID where the issue will be created")
    title: str = Field(..., description="The title of the Linear issue")
    description: str = Field("", description="The description/body of the issue")

# NOTE: Do NOT nest in 'issues'; let @tool's args_schema pass issues as root list argument.
@tool("create_linear_issues", return_direct=True)
def create_linear_issues(issues: List[LinearIssueInput],config:RunnableConfig ) -> str:
    """
    Creates a Linear issue in the specified team. 
    Returns summary info, or error if creation fails.
    """

    user_id = config["configurable"]["user_id"]
    print("hello from tool creating issues", input)
    profile = Profile.objects(id=user_id).first()
    url = "https://api.linear.app/graphql"
    
    
    linear_app:Profile.AuthorizationToken = next((app for app in profile.apps if app.app_id == 'linear'), None)
    linear_index = next((i for i, app in enumerate(profile.apps) if app.app_id == 'linear'), -1)
    r_token = decode_jwt(linear_app.refresh_token)


    resp = requests.post(
        "https://api.linear.app/oauth/token",
        data={
            "grant_type": "refresh_token",
            "client_id": LINEAR_CLIENT_ID,
            "client_secret": LINEAR_CLIENT_SECRET,
            "refresh_token": r_token['token'],
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    ).json()

    new_token = encode_jwt({'token':resp['refresh_token']})
    profile.apps[linear_index].refresh_token = new_token
    profile.save()

    headers = {
        "Authorization": f"Bearer {resp['access_token']}",
        "Content-Type": "application/json"
    }
    mutation = """
    mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
        issue {
            id
            title
            url
        }
        }
    }
    """

    

    results = []
    for issue in issues:
        variables = {
            "input": {
                "teamId": issue.team_id,
                "title": issue.title,
                "description": issue.description,
            }
        }
        response = requests.post(
            "https://api.linear.app/graphql",
            headers=headers,
            json={
                "query": mutation,
                "variables": variables
            }
        )
        resp_data = response.json()
        if "errors" in resp_data:
            details = resp_data.get("errors")
            results.append(f"Failed to create issue: {details}")
        else:
            results.append("Success")
    for res in results:
        if isinstance(res, str) and res.startswith("Failed to create issue"):
            return res
    

    return f"Added issues to linear"
    


class GoogleCalendarEvent(BaseModel):
    summary: str
    start: datetime
    end: datetime
    timeZone: Optional[str] = "UTC"
    description: Optional[str] = None
    location: Optional[str] = None
    attendees: Optional[list] = None
    recurrence: Optional[list] = None

def add_google_calendar_events_rest(
    calendar_id: str, 
    events: List[GoogleCalendarEvent],
    config:RunnableConfig
) -> List[str]:
    """
    Adds events to a Google Calendar using the Google Calendar v3 REST API.

    Args:
        access_token (str): Google OAuth 2.0 access token with calendar.events scope.
        calendar_id (str): The ID of the Google calendar (use "primary" for default).
        events (List[GoogleCalendarEvent]): List of events to add.

    Returns:
        List[str]: List of created event ids or error messages.
    """

    user_id = config["configurable"]["user_id"]
    results = []
    profile = Profile.objects(id=user_id).first()
    
    
    calendar_app:Profile.AuthorizationToken = next((app for app in profile.apps if app.app_id == 'google-calendar'), None)
    if not calendar_app:
        return "Google Calendar not connected for this user."
    r_token = decode_jwt(calendar_app.refresh_token)

    token_resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "refresh_token": r_token['token'] if isinstance(r_token, dict) else r_token,
            "grant_type": "refresh_token",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15
    )
    print("Token response google",token_resp)
    if token_resp.status_code != 200:
        return f"Failed to refresh Google access token: {token_resp.text}"

    access_token = token_resp.json().get("access_token")

    # print("Token response google",access_token)
    endpoint = f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    for event in events:
        event_body = {
            "summary": event.summary,
            "start": {
                "dateTime": event.start.isoformat(),
                "timeZone": event.timeZone or "UTC"
            },
            "end": {
                "dateTime": event.end.isoformat(),
                "timeZone": event.timeZone or "UTC"
            }
        }
        # Add optional fields if provided
        if event.description:
            event_body["description"] = event.description
        if event.location:
            event_body["location"] = event.location
        if event.attendees:
            event_body["attendees"] = event.attendees
        if event.recurrence:
            event_body["recurrence"] = event.recurrence
        
        try:
            response = requests.post(
                endpoint,
                headers=headers,
                json=event_body,
                timeout=15
            )
            if response.status_code == 200 or response.status_code == 201:
                data = response.json()
                results.append(data.get("id", "Event added"))
            else:
                err_txt = response.text
                results.append(f"Failed to add event '{event.summary}': {err_txt}")
        except Exception as exc:
            results.append(f"Failed to add event '{event.summary}': {exc}")
    return results


@tool("get_google_calendars", return_direct=True)
def get_google_calendars(config:RunnableConfig) -> str:
    """
    Fetches the user's Google Calendars using the stored refresh token.
    Note this should be called when the user needs to select a callandar to add events and this is GOOGLE ONLY.
    Returns a formatted string listing calendar names and their IDs.
    """
    user_id = config["configurable"]["user_id"]
    results = []
    # Fetch the user profile
    profile = Profile.objects(id=user_id).first()
    if not profile:
        return "Profile not found."
    
    # Find the Google Calendar app credentials in user's apps
    calendar_app = next((app for app in profile.apps if app.app_id == 'google-calendar'), None)
    if not calendar_app:
        return "Google Calendar not connected for this user."

    try:
        r_token = decode_jwt(calendar_app.refresh_token)
    except Exception as exc:
        return f"Error decoding refresh token: {exc}"

    # To get a Google access token from the refresh token, we must exchange the refresh token for an access token
    # See: https://developers.google.com/identity/protocols/oauth2/web-server#offline
    token_resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "refresh_token": r_token['token'] if isinstance(r_token, dict) else r_token,
            "grant_type": "refresh_token",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15
    )
    print("Token response google",token_resp)
    if token_resp.status_code != 200:
        return f"Failed to refresh Google access token: {token_resp.text}"

    access_token = token_resp.json().get("access_token")
    print("Token response google",access_token)
    if not access_token:
        return "Failed to get Google access token from refresh response."
    
    endpoint = "https://www.googleapis.com/calendar/v3/users/me/calendarList"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    
    
    try:
        response = requests.get(endpoint, headers=headers, timeout=15)
        if response.status_code == 200:
            data = response.json()
            calendars = data.get("items", [])
            if not calendars:
                return "No calendars found for the user."
            for cal in calendars:
                results.append(f"{cal.get('summary', '[No Name]')} (ID: {cal.get('id')})")
            return "\n".join(results)
        else:
            return f"Failed to fetch calendars: {response.text}"
    except Exception as exc:
        return f"Exception occurred while fetching calendars: {exc}"


        # INSERT_YOUR_CODE

class AppendRowsInput(BaseModel):
    spreadsheet_id: str
    sheet_name: str = "Sheet1"
    columns: list[str]
    rows: list[list[str]]

def append_rows_to_google_sheet(input: AppendRowsInput, config: RunnableConfig) -> str:
    """
    Appends rows to a Google Sheets worksheet using Google Sheets API v4. This can be applicable to a variety of tasks, such as creating action items,
    creating budget sheets, creating a timeline, creating a to-do list, etc. This tool should be activated only when the user brings up adding to a sheet.
    Makse sure the data is related to the summary and do not make up any data.
    Args:
        input (AppendRowsInput): Object containing spreadsheet_id, sheet_name, columns, and rows.
        config (RunnableConfig): Contains current user's config with apps and tokens.

    Returns:
        str: Status message.
    """
    print('Hello from sheets tool')
    user_id = config["configurable"]["user_id"]
    profile = Profile.objects(id=user_id).first()
    if not profile:
        return "User profile not found."

    sheets_app = next((app for app in profile.apps if app.app_id == 'google-sheets'), None)
    if not sheets_app:
        return "Google Sheets not connected for this user."
    try:
        r_token = decode_jwt(sheets_app.refresh_token)
    except Exception as exc:
        return f"Error decoding refresh token: {exc}"

    # Get fresh Google access token
    token_resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "refresh_token": r_token['token'] if isinstance(r_token, dict) else r_token,
            "grant_type": "refresh_token"
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15
    )
    if token_resp.status_code != 200:
        return f"Failed to refresh Google Sheets access token: {token_resp.text}"
    access_token = token_resp.json().get("access_token")
    if not access_token:
        return "Failed to get Google Sheets access token."

    # Prepare values: rows as 2d list, respecting columns order
    # The Google Sheets API expects 'values' to be a 2D list where each inner list represents a whole row,
    # including all columns (header comes first). However, do NOT flatten each row.
    # If `input.columns` is not empty, add as header. If the rows are already structured as rows of lists,
    # just combine header (if any) and rows.
    values = []
    if input.columns:
        values.append(input.columns)
    values.extend(input.rows)
    print(f"Prepared 2D values to append: {values}", input.spreadsheet_id)

    endpoint = (
        f"https://sheets.googleapis.com/v4/spreadsheets/"
        f"{input.spreadsheet_id}/values/{input.sheet_name or 'Sheet1'}!A1:append"
    )
    params = {
        "valueInputOption": "USER_ENTERED",
        "insertDataOption": "INSERT_ROWS",
        "includeValuesInResponse": "true"
    }
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    body = {
        "majorDimension": "ROWS",
        "values": values
    }



    # If possible, after the append, send a batchUpdate to make the first row inserted bold.
    # The appended row index is last row + 1 before the append, but Sheets API doesn't directly guarantee the index.
    # So, we have to first append, then, if a header row is included, apply formatting on the corresponding range.

    resp = requests.post(endpoint, headers=headers, params=params, json=body, timeout=15)
    if resp.status_code == 200:
        return f"Appended {len(values)} rows to {input.sheet_name}."
    else:
        try:
            json_body = resp.json()
            print(json_body)
            error = json_body.get("error", {}).get("message", resp.text)
        except Exception:
            error = resp.text
            print(error)
        return f"Failed to append rows: {error}"

        # INSERT_YOUR_CODE
from langchain.tools import tool
from helpers.graphiti import query_graphiti_by_text



        # INSERT_YOUR_CODE



SLACK_API_BASE = "https://slack.com/api"

@tool('slack_list_channels', return_direct=True)
def slack_list_channels(config: RunnableConfig) -> str:
    """
    List all public Slack channels for the team/workspace associated with the user's connected Slack account.
    Requires channels:read permission. Uses the user's stored Slack app OAuth token.
    Args:
        config: RunnableConfig containing caller's user_id and apps.
    Returns:
        A formatted string listing channel names and IDs, or an error message.
    """
    user_id = config["configurable"]["user_id"]
    profile = Profile.objects(id=user_id).first()
    if not profile:
        return "User profile not found."
    slack_app = next((app for app in profile.apps if app.app_id == 'slack'), None)
    if not slack_app:
        return "Slack not connected for this user."
    try:
        r_token = decode_jwt(slack_app.refresh_token)
    except Exception as exc:
        return f"Error decoding Slack token: {exc}"

    access_token = r_token['token'] if isinstance(r_token, dict) else r_token

    url = f"{SLACK_API_BASE}/conversations.list"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    params = {
        "exclude_archived": "true",
        "types": "public_channel"
    }
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=15)
        data = resp.json()
        if data.get("ok"):
            channels = data.get("channels", [])
            if not channels:
                return "No public channels found."
            result = "Slack Channels:\n"
            for chan in channels:
                result += f"- {chan.get('name')} (ID: {chan.get('id')})\n"
            return result
        else:
            return f"Slack API error: {data.get('error')}"
    except Exception as e:
        return f"Failed to list channels: {e}"

@tool('slack_post_message', return_direct=True)
def slack_post_message(channel: str, message: str, config: RunnableConfig) -> str:
    """
    Post a message to a specified Slack channel using the user's connected Slack account.
    Args:
        channel: Channel ID or name (recommend using channel ID from slack_list_channels).
        message: The message text to send.
        config: RunnableConfig containing caller's user_id and apps.
    Returns:
        API response message, or error.
    """
    user_id = config["configurable"]["user_id"]
    profile = Profile.objects(id=user_id).first()
    if not profile:
        return "User profile not found."
    slack_app = next((app for app in profile.apps if app.app_id == 'slack'), None)
    if not slack_app:
        return "Slack not connected for this user."
    try:
        r_token = decode_jwt(slack_app.refresh_token)
    except Exception as exc:
        return f"Error decoding Slack token: {exc}"

    access_token = r_token['token'] if isinstance(r_token, dict) else r_token

    url = f"{SLACK_API_BASE}/chat.postMessage"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    data = {
        "channel": channel,
        "text": message
    }
    try:
        resp = requests.post(url, headers=headers, json=data, timeout=15)
        resp_json = resp.json()
        if resp_json.get("ok"):
            return f"Message posted to {channel}."
        else:
            return f"Slack API error: {resp_json.get('error')}"
    except Exception as e:
        return f"Failed to post message: {e}"

@tool('query_graphiti_tool')
async def query_graphiti_tool(query: str) -> str:
    """Use Graphiti vector/hybrid search to perform semantic and keyword queries over transcripts and knowledge base.
    The query should be a natural language question or search string. Typically the knowledge base should be accessed to track general data or data not found in this session.
    Returns summarization of matching facts/edges."""
    
    try:
        result = await query_graphiti_by_text(query)
        return result.strip() or "No matching facts found in Graphiti."
    except Exception as e:
        return f"Graphiti query failed: {e}"