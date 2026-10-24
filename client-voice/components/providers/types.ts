export interface ProviderStatus {
  connected: boolean;
  email: string | null;
  scopes: string[];
  subscription_id?: string | null;
  expires_at?: string | null;
  subscription_expires_at?: string | null;
  updated_at?: string | null;
}

export interface TranscriptJobItem {
  id?: string;
  job_id: string;
  provider: 'zoom' | 'google_meet' | 'teams';
  status: 'in_queue' | 'processing' | 'processed' | 'failed';
  stage: string;
  progress: number;
  provider_meeting_id?: string;
  provider_meeting_topic?: string;
  session_id?: string | { id: string };
  error_message?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface ProviderCardProps {
  status: ProviderStatus | null;
  isLoading: boolean;
  onRefresh: () => void;
  serverUrl?: string;
}
