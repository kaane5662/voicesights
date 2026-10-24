from datetime import datetime
import os
from typing import List, Optional, Any, Dict
from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from models import Profile
from pydantic import BaseModel, Field
import requests
import json
from helpers.jwt import decode_jwt, encode_jwt
from helpers.graphiti import query_graphiti_by_text

LINEAR_CLIENT_ID = os.environ.get("LINEAR_CLIENT_ID", "")
LINEAR_CLIENT_SECRET = os.environ.get("LINEAR_CLIENT_SECRET", "")
LINEAR_REDIRECT_URI = os.environ.get("LINEAR_REDIRECT_URI", "")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
SLACK_API_BASE = "https://slack.com/api"


def _get_user_id(config: RunnableConfig) -> Optional[str]:
    if isinstance(config, dict):
        return config.get("configurable", {}).get("user_id")
    if hasattr(config, "get"):
        return config.get("configurable", {}).get("user_id")
    return getattr(getattr(config, "configurable", None), "user_id", None)


@tool("get_linear_teams", return_direct=True)
def get_linear_teams(config: RunnableConfig) -> dict:
    """
    Fetch teams from a Linear workspace using the connected Linear account.
    Returns structured data listing team names, keys, and IDs.
    """
    user_id = _get_user_id(config)
    profile = Profile.objects(id=user_id).first() if user_id else None
    if not profile:
        return {
            "type": "auth_error",
            "app_id": "linear",
            "app_name": "Linear",
            "message": "User profile not found. Please log in.",
            "auth_url": "/apps"
        }

    linear_app = next((app for app in (profile.apps or []) if app.app_id == 'linear'), None)
    if not linear_app or not linear_app.refresh_token:
        return {
            "type": "auth_error",
            "app_id": "linear",
            "app_name": "Linear",
            "message": "Linear is not connected. Please connect your Linear account to view teams.",
            "auth_url": "/apps"
        }

    linear_index = next((i for i, app in enumerate(profile.apps) if app.app_id == 'linear'), -1)
    try:
        r_token = decode_jwt(linear_app.refresh_token)
        refresh_token_val = r_token['token'] if isinstance(r_token, dict) else r_token
    except Exception as exc:
        return {
            "type": "auth_error",
            "app_id": "linear",
            "app_name": "Linear",
            "message": f"Linear session token expired or invalid ({exc}). Please reconnect Linear.",
            "auth_url": "/apps"
        }

    try:
        token_resp = requests.post(
            "https://api.linear.app/oauth/token",
            data={
                "grant_type": "refresh_token",
                "client_id": LINEAR_CLIENT_ID,
                "client_secret": LINEAR_CLIENT_SECRET,
                "refresh_token": refresh_token_val,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15
        )
        resp = token_resp.json()
    except Exception as exc:
        return {
            "type": "auth_error",
            "app_id": "linear",
            "app_name": "Linear",
            "message": f"Could not refresh Linear token: {exc}",
            "auth_url": "/apps"
        }

    if "error" in resp or "access_token" not in resp:
        return {
            "type": "auth_error",
            "app_id": "linear",
            "app_name": "Linear",
            "message": f"Linear authentication error: {resp.get('error_description', resp.get('error', 'Token refresh failed'))}. Please reconnect Linear.",
            "auth_url": "/apps"
        }

    if "refresh_token" in resp and linear_index != -1:
        new_token = encode_jwt({'token': resp['refresh_token']})
        profile.apps[linear_index].refresh_token = new_token
        profile.save()

    headers = {
        "Authorization": f"Bearer {resp['access_token']}",
        "Content-Type": "application/json"
    }
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
    try:
        response = requests.post("https://api.linear.app/graphql", headers=headers, json={"query": query}, timeout=15)
        resp_data = response.json()
        teams = resp_data.get("data", {}).get("teams", {}).get("nodes", [])
        teams_list = [{"id": team["id"], "name": team["name"], "key": team.get("key", "")} for team in teams]
        readable = "Linear Teams:\n" + "\n".join([f"• {team['name']} ({team.get('key', team['id'])})" for team in teams])
        return {
            "type": "linear_teams",
            "teams": teams_list,
            "message": readable
        }
    except Exception as exc:
        return {
            "type": "linear_teams",
            "teams": [],
            "message": f"Error querying Linear teams: {exc}"
        }


class LinearIssueInput(BaseModel):
    team_id: str = Field(..., description="The Linear team ID where the issue will be created. The team id must be a valid uuid, NOT a label!")
    title: str = Field(..., description="The title of the Linear issue")
    description: str = Field("", description="The description/body of the issue")


@tool("create_linear_issues", return_direct=True)
def create_linear_issues(issues: List[LinearIssueInput], config: RunnableConfig) -> dict:
    """
    Creates one or more Linear issues in specified teams using the user's connected Linear account.
    Returns structured data of created issues and status.
    """
    user_id = _get_user_id(config)
    profile = Profile.objects(id=user_id).first() if user_id else None
    if not profile:
        return {
            "type": "auth_error",
            "app_id": "linear",
            "app_name": "Linear",
            "message": "User profile not found. Please log in.",
            "auth_url": "/apps"
        }

    linear_app = next((app for app in (profile.apps or []) if app.app_id == 'linear'), None)
    if not linear_app or not linear_app.refresh_token:
        return {
            "type": "auth_error",
            "app_id": "linear",
            "app_name": "Linear",
            "message": "Linear is not connected. Please connect your Linear account to create issues.",
            "auth_url": "/apps"
        }

    linear_index = next((i for i, app in enumerate(profile.apps) if app.app_id == 'linear'), -1)
    try:
        r_token = decode_jwt(linear_app.refresh_token)
        refresh_token_val = r_token['token'] if isinstance(r_token, dict) else r_token
    except Exception as exc:
        return {
            "type": "auth_error",
            "app_id": "linear",
            "app_name": "Linear",
            "message": f"Linear session token expired or invalid ({exc}). Please reconnect Linear.",
            "auth_url": "/apps"
        }

    try:
        token_resp = requests.post(
            "https://api.linear.app/oauth/token",
            data={
                "grant_type": "refresh_token",
                "client_id": LINEAR_CLIENT_ID,
                "client_secret": LINEAR_CLIENT_SECRET,
                "refresh_token": refresh_token_val,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15
        )
        resp = token_resp.json()
    except Exception as exc:
        return {
            "type": "auth_error",
            "app_id": "linear",
            "app_name": "Linear",
            "message": f"Could not refresh Linear token: {exc}",
            "auth_url": "/apps"
        }

    if "error" in resp or "access_token" not in resp:
        return {
            "type": "auth_error",
            "app_id": "linear",
            "app_name": "Linear",
            "message": f"Linear authentication error: {resp.get('error_description', resp.get('error', 'Token refresh failed'))}. Please reconnect Linear.",
            "auth_url": "/apps"
        }

    if "refresh_token" in resp and linear_index != -1:
        new_token = encode_jwt({'token': resp['refresh_token']})
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
    created_issues = []
    errors = []
    for issue in issues:
        variables = {
            "input": {
                "teamId": issue.team_id,
                "title": issue.title,
                "description": issue.description,
            }
        }
        try:
            r = requests.post("https://api.linear.app/graphql", headers=headers, json={"query": mutation, "variables": variables}, timeout=15)
            data = r.json()
            if "errors" in data:
                errors.append(str(data["errors"]))
            else:
                issue_node = data.get("data", {}).get("issueCreate", {}).get("issue", {})
                created_issues.append({
                    "id": issue_node.get("id"),
                    "title": issue.title,
                    "description": issue.description,
                    "team_id": issue.team_id,
                    "url": issue_node.get("url")
                })
        except Exception as exc:
            errors.append(str(exc))

    if not created_issues and errors:
        return {
            "type": "linear_issues",
            "issues": [],
            "message": f"Failed to create issues: {', '.join(errors)}"
        }

    return {
        "type": "linear_issues",
        "issues": created_issues,
        "message": f"Successfully created {len(created_issues)} issue(s) in Linear."
    }


class GoogleCalendarEvent(BaseModel):
    summary: str
    start: datetime
    end: datetime
    timeZone: Optional[str] = "UTC"
    description: Optional[str] = None
    location: Optional[str] = None
    attendees: Optional[list] = None
    recurrence: Optional[list] = None


@tool("add_google_calendar_events_rest", return_direct=True)
def add_google_calendar_events_rest(
    calendar_id: str, 
    events: List[GoogleCalendarEvent],
    config: RunnableConfig
) -> dict:
    """
    Adds events to a Google Calendar using the Google Calendar REST API.
    Returns structured data of created events or auth errors.
    """
    user_id = _get_user_id(config)
    profile = Profile.objects(id=user_id).first() if user_id else None
    if not profile:
        return {
            "type": "auth_error",
            "app_id": "google-calendar",
            "app_name": "Google Calendar",
            "message": "User profile not found. Please log in.",
            "auth_url": "/apps"
        }

    calendar_app = next((app for app in (profile.apps or []) if app.app_id == 'google-calendar'), None)
    if not calendar_app or not calendar_app.refresh_token:
        return {
            "type": "auth_error",
            "app_id": "google-calendar",
            "app_name": "Google Calendar",
            "message": "Google Calendar is not connected. Please connect Google Calendar in Apps.",
            "auth_url": "/apps"
        }

    try:
        r_token = decode_jwt(calendar_app.refresh_token)
        refresh_token_val = r_token['token'] if isinstance(r_token, dict) else r_token
    except Exception as exc:
        return {
            "type": "auth_error",
            "app_id": "google-calendar",
            "app_name": "Google Calendar",
            "message": f"Error decoding Google refresh token: {exc}. Please reconnect Google Calendar.",
            "auth_url": "/apps"
        }

    token_resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token_val,
            "grant_type": "refresh_token",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15
    )
    if token_resp.status_code != 200:
        return {
            "type": "auth_error",
            "app_id": "google-calendar",
            "app_name": "Google Calendar",
            "message": f"Failed to refresh Google access token: {token_resp.text}. Please reconnect Google Calendar.",
            "auth_url": "/apps"
        }

    access_token = token_resp.json().get("access_token")
    if not access_token:
        return {
            "type": "auth_error",
            "app_id": "google-calendar",
            "app_name": "Google Calendar",
            "message": "Failed to get Google access token. Please reconnect Google Calendar.",
            "auth_url": "/apps"
        }

    endpoint = f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    added_events = []
    results = []
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
        if event.description:
            event_body["description"] = event.description
        if event.location:
            event_body["location"] = event.location
        if event.attendees:
            event_body["attendees"] = event.attendees
        if event.recurrence:
            event_body["recurrence"] = event.recurrence

        try:
            response = requests.post(endpoint, headers=headers, json=event_body, timeout=15)
            if response.status_code in [200, 201]:
                data = response.json()
                event_id = data.get("id")
                results.append(event_id or "Event added")
                added_events.append({
                    "summary": event.summary,
                    "start": event.start.isoformat(),
                    "end": event.end.isoformat(),
                    "location": event.location or "",
                    "description": event.description or "",
                    "timeZone": event.timeZone or "UTC",
                    "event_id": event_id
                })
            else:
                results.append(f"Failed to add '{event.summary}': {response.text}")
        except Exception as exc:
            results.append(f"Failed to add '{event.summary}': {exc}")

    return {
        "type": "google_calendar_events",
        "calendar_id": calendar_id,
        "events": added_events,
        "results": results,
        "message": f"Successfully scheduled {len(added_events)} event(s) in Google Calendar." if added_events else "Failed to add events to Google Calendar."
    }


@tool("get_google_calendars", return_direct=True)
def get_google_calendars(config: RunnableConfig) -> dict:
    """
    Fetches the user's Google Calendars using the connected Google Calendar account.
    Returns structured list of calendars with their names and IDs.
    """
    user_id = _get_user_id(config)
    profile = Profile.objects(id=user_id).first() if user_id else None
    if not profile:
        return {
            "type": "auth_error",
            "app_id": "google-calendar",
            "app_name": "Google Calendar",
            "message": "User profile not found. Please log in.",
            "auth_url": "/apps"
        }

    calendar_app = next((app for app in (profile.apps or []) if app.app_id == 'google-calendar'), None)
    if not calendar_app or not calendar_app.refresh_token:
        return {
            "type": "auth_error",
            "app_id": "google-calendar",
            "app_name": "Google Calendar",
            "message": "Google Calendar is not connected. Please connect Google Calendar in Apps.",
            "auth_url": "/apps"
        }

    try:
        r_token = decode_jwt(calendar_app.refresh_token)
        refresh_token_val = r_token['token'] if isinstance(r_token, dict) else r_token
    except Exception as exc:
        return {
            "type": "auth_error",
            "app_id": "google-calendar",
            "app_name": "Google Calendar",
            "message": f"Error decoding Google refresh token: {exc}. Please reconnect Google Calendar.",
            "auth_url": "/apps"
        }

    token_resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token_val,
            "grant_type": "refresh_token",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15
    )
    if token_resp.status_code != 200:
        return {
            "type": "auth_error",
            "app_id": "google-calendar",
            "app_name": "Google Calendar",
            "message": f"Failed to refresh Google access token: {token_resp.text}. Please reconnect Google Calendar.",
            "auth_url": "/apps"
        }

    access_token = token_resp.json().get("access_token")
    if not access_token:
        return {
            "type": "auth_error",
            "app_id": "google-calendar",
            "app_name": "Google Calendar",
            "message": "Failed to get Google access token. Please reconnect Google Calendar.",
            "auth_url": "/apps"
        }

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
            calendars_list = [
                {
                    "id": cal.get("id"),
                    "summary": cal.get("summary", "[Untitled Calendar]"),
                    "primary": cal.get("primary", False),
                    "description": cal.get("description", "")
                }
                for cal in calendars
            ]
            readable = "Google Calendars:\n" + "\n".join([f"• {c['summary']} (ID: {c['id']})" for c in calendars_list])
            return {
                "type": "google_calendars",
                "calendars": calendars_list,
                "message": readable
            }
        else:
            return {
                "type": "google_calendars",
                "calendars": [],
                "message": f"Failed to fetch calendars: {response.text}"
            }
    except Exception as exc:
        return {
            "type": "google_calendars",
            "calendars": [],
            "message": f"Exception occurred while fetching calendars: {exc}"
        }


class AppendRowsInput(BaseModel):
    spreadsheet_id: str = Field(..., description="The ID of the Google Sheet spreadsheet")
    sheet_name: str = Field("Sheet1", description="Worksheet tab name, defaults to Sheet1")
    columns: list[str] = Field(default_factory=list, description="Column header titles")
    rows: list[list[str]] = Field(..., description="2D list of row values to append")


@tool("append_rows_to_google_sheet", return_direct=True)
def append_rows_to_google_sheet(input: AppendRowsInput, config: RunnableConfig) -> dict:
    """
    Appends rows to a Google Sheets worksheet using the Google Sheets API.
    Returns structured data of appended rows and summary.
    """
    user_id = _get_user_id(config)
    profile = Profile.objects(id=user_id).first() if user_id else None
    if not profile:
        return {
            "type": "auth_error",
            "app_id": "google-sheets",
            "app_name": "Google Sheets",
            "message": "User profile not found. Please log in.",
            "auth_url": "/apps"
        }

    sheets_app = next((app for app in (profile.apps or []) if app.app_id == 'google-sheets'), None)
    if not sheets_app or not sheets_app.refresh_token:
        return {
            "type": "auth_error",
            "app_id": "google-sheets",
            "app_name": "Google Sheets",
            "message": "Google Sheets is not connected. Please connect Google Sheets in Apps.",
            "auth_url": "/apps"
        }

    try:
        r_token = decode_jwt(sheets_app.refresh_token)
        refresh_token_val = r_token['token'] if isinstance(r_token, dict) else r_token
    except Exception as exc:
        return {
            "type": "auth_error",
            "app_id": "google-sheets",
            "app_name": "Google Sheets",
            "message": f"Error decoding Google Sheets refresh token: {exc}. Please reconnect Google Sheets.",
            "auth_url": "/apps"
        }

    token_resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token_val,
            "grant_type": "refresh_token"
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15
    )
    if token_resp.status_code != 200:
        return {
            "type": "auth_error",
            "app_id": "google-sheets",
            "app_name": "Google Sheets",
            "message": f"Failed to refresh Google Sheets access token: {token_resp.text}. Please reconnect Google Sheets.",
            "auth_url": "/apps"
        }

    access_token = token_resp.json().get("access_token")
    if not access_token:
        return {
            "type": "auth_error",
            "app_id": "google-sheets",
            "app_name": "Google Sheets",
            "message": "Failed to get Google Sheets access token. Please reconnect Google Sheets.",
            "auth_url": "/apps"
        }

    values = []
    if input.columns:
        values.append(input.columns)
    values.extend(input.rows)

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

    try:
        resp = requests.post(endpoint, headers=headers, params=params, json=body, timeout=15)
        if resp.status_code == 200:
            return {
                "type": "google_sheet_rows",
                "spreadsheet_id": input.spreadsheet_id,
                "sheet_name": input.sheet_name or "Sheet1",
                "columns": input.columns or [],
                "rows": input.rows or [],
                "row_count": len(input.rows or []),
                "message": f"Successfully appended {len(input.rows or [])} row(s) to Google Sheet ({input.sheet_name or 'Sheet1'})."
            }
        else:
            try:
                error = resp.json().get("error", {}).get("message", resp.text)
            except Exception:
                error = resp.text
            return {
                "type": "google_sheet_rows",
                "spreadsheet_id": input.spreadsheet_id,
                "sheet_name": input.sheet_name or "Sheet1",
                "columns": input.columns or [],
                "rows": [],
                "message": f"Failed to append rows to Google Sheet: {error}"
            }
    except Exception as exc:
        return {
            "type": "google_sheet_rows",
            "spreadsheet_id": input.spreadsheet_id,
            "sheet_name": input.sheet_name or "Sheet1",
            "columns": input.columns or [],
            "rows": [],
            "message": f"Error appending rows to Google Sheet: {exc}"
        }


@tool('slack_list_channels', return_direct=True)
def slack_list_channels(config: RunnableConfig) -> dict:
    """
    List public Slack channels for the team/workspace associated with the user's connected Slack account.
    Returns structured list of channels.
    """
    user_id = _get_user_id(config)
    profile = Profile.objects(id=user_id).first() if user_id else None
    if not profile:
        return {
            "type": "auth_error",
            "app_id": "slack",
            "app_name": "Slack",
            "message": "User profile not found. Please log in.",
            "auth_url": "/apps"
        }

    slack_app = next((app for app in (profile.apps or []) if app.app_id == 'slack'), None)
    if not slack_app or not slack_app.refresh_token:
        return {
            "type": "auth_error",
            "app_id": "slack",
            "app_name": "Slack",
            "message": "Slack is not connected. Please connect your Slack account in Apps.",
            "auth_url": "/apps"
        }

    try:
        r_token = decode_jwt(slack_app.refresh_token)
        access_token = r_token['token'] if isinstance(r_token, dict) else r_token
    except Exception as exc:
        return {
            "type": "auth_error",
            "app_id": "slack",
            "app_name": "Slack",
            "message": f"Error decoding Slack token: {exc}. Please reconnect Slack.",
            "auth_url": "/apps"
        }

    url = f"{SLACK_API_BASE}/conversations.list"
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"exclude_archived": "true", "types": "public_channel"}

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=15)
        data = resp.json()
        if data.get("ok"):
            channels = data.get("channels", [])
            channels_list = [
                {
                    "id": chan.get("id"),
                    "name": chan.get("name"),
                    "is_private": chan.get("is_private", False),
                    "num_members": chan.get("num_members")
                }
                for chan in channels
            ]
            readable = "Slack Channels:\n" + "\n".join([f"• #{chan['name']} (ID: {chan['id']})" for chan in channels_list])
            return {
                "type": "slack_channels",
                "channels": channels_list,
                "message": readable
            }
        else:
            err = data.get("error", "Unknown error")
            if err in ["not_authed", "invalid_auth", "token_revoked", "account_inactive"]:
                return {
                    "type": "auth_error",
                    "app_id": "slack",
                    "app_name": "Slack",
                    "message": f"Slack session error ({err}). Please reconnect your Slack workspace.",
                    "auth_url": "/apps"
                }
            return {
                "type": "slack_channels",
                "channels": [],
                "message": f"Slack API error: {err}"
            }
    except Exception as e:
        return {
            "type": "slack_channels",
            "channels": [],
            "message": f"Failed to list Slack channels: {e}"
        }


@tool('slack_post_message', return_direct=True)
def slack_post_message(channel: str, message: str, config: RunnableConfig) -> dict:
    """
    Post a message to a specified Slack channel using the user's connected Slack account.
    Returns structured confirmation data or auth error.
    """
    user_id = _get_user_id(config)
    profile = Profile.objects(id=user_id).first() if user_id else None
    if not profile:
        return {
            "type": "auth_error",
            "app_id": "slack",
            "app_name": "Slack",
            "message": "User profile not found. Please log in.",
            "auth_url": "/apps"
        }

    slack_app = next((app for app in (profile.apps or []) if app.app_id == 'slack'), None)
    if not slack_app or not slack_app.refresh_token:
        return {
            "type": "auth_error",
            "app_id": "slack",
            "app_name": "Slack",
            "message": "Slack is not connected. Please connect your Slack account in Apps to send messages.",
            "auth_url": "/apps"
        }

    try:
        r_token = decode_jwt(slack_app.refresh_token)
        access_token = r_token['token'] if isinstance(r_token, dict) else r_token
    except Exception as exc:
        return {
            "type": "auth_error",
            "app_id": "slack",
            "app_name": "Slack",
            "message": f"Error decoding Slack token: {exc}. Please reconnect Slack.",
            "auth_url": "/apps"
        }

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
            return {
                "type": "slack_message",
                "channel": channel,
                "message_text": message,
                "message": f"Message posted successfully to #{channel} on Slack."
            }
        else:
            err = resp_json.get("error", "Unknown error")
            if err in ["not_authed", "invalid_auth", "token_revoked", "account_inactive"]:
                return {
                    "type": "auth_error",
                    "app_id": "slack",
                    "app_name": "Slack",
                    "message": f"Slack session error ({err}). Please reconnect your Slack workspace.",
                    "auth_url": "/apps"
                }
            return {
                "type": "slack_message",
                "channel": channel,
                "message_text": message,
                "message": f"Slack error: {err}"
            }
    except Exception as e:
        return {
            "type": "slack_message",
            "channel": channel,
            "message_text": message,
            "message": f"Failed to post Slack message: {e}"
        }


@tool('query_graphiti_tool', return_direct=True)
async def query_graphiti_tool(query: str) -> dict:
    """
    Use Graphiti vector/hybrid search to query knowledge base facts and insights over session transcripts.
    Returns structured results.
    """
    try:
        result = await query_graphiti_by_text(query)
        result_str = result.strip() if isinstance(result, str) else str(result)
        return {
            "type": "graphiti_search",
            "query": query,
            "results": result_str or "No matching facts found in Graphiti.",
            "message": "Retrieved knowledge base insights."
        }
    except Exception as e:
        return {
            "type": "graphiti_search",
            "query": query,
            "results": f"Graphiti query failed: {e}",
            "message": f"Graphiti search error: {e}"
        }
