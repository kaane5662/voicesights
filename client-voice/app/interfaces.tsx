// INSERT_YOUR_CODE

export interface Profile {
  id: string;
  username: string;
  email: string;
  plan?: string;
  bio?: string;
  stripe_customer_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AiSuggestion {
  prompt: string;
  title: string;
}

export interface Session {
  id: string;
  title: string;
  date: string;
  total_duration?: number;
  word_count?: number;
  speakers: string[];
  starred: boolean;
  finished: boolean;
  status?: 'active' | 'processing' | 'completed' | 'failed' | string;
  tags: string[];
  ai_overview?: string;
  summaries?: string[];
  transcript: TranscriptEntry[];
  owner?: Profile | string;
  created_at?: string;
  updated_at?: string;
  doc_suggestions: AiSuggestion[];
  chat_suggestions: AiSuggestion[];
}

export interface TranscriptEntry {
  start_duration: number;
  text: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  session_id: string | Session;
  owner_id: string | Profile;
  created_at: string;
  last_used: string;
  session?: Session | string;
}

export type ChatMessageType =
  | 'text'
  | 'auth_error'
  | 'linear_teams'
  | 'linear_issues'
  | 'google_calendars'
  | 'google_calendar_events'
  | 'google_sheet_rows'
  | 'slack_channels'
  | 'slack_message'
  | 'graphiti_search';

export interface AuthErrorData {
  app_id: 'google-calendar' | 'google-sheets' | 'linear' | 'slack' | string;
  app_name?: string;
  message?: string;
  auth_url?: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key?: string;
}

export interface LinearTeamsData {
  teams: LinearTeam[];
  message?: string;
}

export interface LinearIssue {
  id?: string;
  team_id?: string;
  title: string;
  description?: string;
  url?: string;
  status?: string;
}

export interface LinearIssuesData {
  issues: LinearIssue[];
  message?: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
  description?: string;
}

export interface GoogleCalendarsData {
  calendars: GoogleCalendar[];
  message?: string;
}

export interface GoogleCalendarEventItem {
  summary: string;
  start: string;
  end: string;
  timeZone?: string;
  description?: string;
  location?: string;
  event_id?: string;
}

export interface GoogleCalendarEventsData {
  calendar_id?: string;
  events: GoogleCalendarEventItem[];
  results?: string[];
  message?: string;
}

export interface GoogleSheetRowsData {
  spreadsheet_id: string;
  sheet_name: string;
  columns?: string[];
  rows?: string[][];
  row_count?: number;
  message?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private?: boolean;
  num_members?: number;
}

export interface SlackChannelsData {
  channels: SlackChannel[];
  message?: string;
}

export interface SlackMessageData {
  channel: string;
  message_text: string;
  message?: string;
}

export interface GraphitiSearchData {
  query: string;
  results: string | any;
  message?: string;
}

export interface ChatMessage {
  id?: string | number;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  type?: ChatMessageType;
  data?: any;
}

export interface Note {
  id: string;
  title: string;
  content_json?: any; // If representable, the content of the note
  owner_id?: string | Profile;
  session_id?: string | Session;
  ai_blocks?: any[];
  created_at?: string;
  session?:Session
}
