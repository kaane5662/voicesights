// INSERT_YOUR_CODE

export interface Profile {
  id: string;
  username: string;
  email: string;
  plan?: string;
  bio?: string;
  stripe_customer_id?:string;
  created_at?: string;
  updated_at?: string;
}

export interface AiSuggestion {
  prompt:string,
  title:string
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
  tags: string[];
  ai_overview?: string;
  summaries?: string[];
  transcript: TranscriptEntry[];
  owner?: Profile | string;
  created_at?: string;
  updated_at?: string;
  doc_suggestions: AiSuggestion[]
  chat_suggestions: AiSuggestion[]
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
  last_used:string;
}

export interface ChatMessage {
  role: string;
  content: string;
}


export interface Note {
  id: string;
  title: string;
  content_json?: any; // If representable, the content of the note
  owner_id?: string | Profile;
  session_id?: string | Session;
  ai_blocks?: any[];
  created_at?: string;
}


