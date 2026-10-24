"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Video, 
  Radio, 
  Users, 
  RefreshCw, 
  Layers, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Sparkles, 
  Activity, 
  FileText,
  Calendar,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import axios from 'axios';
import Link from 'next/link';

import { SERVER_URL } from '@/const';
import ProviderCard, { ProviderConfig, ProviderStatusData } from '@/components/providers/ProviderCard';
import { TranscriptJobItem } from '@/components/providers/types';

// ==============================================================================
// Modular Provider Configurations
// ==============================================================================
const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: 'zoom',
    name: 'Zoom',
    badge: 'Cloud Recording',
    description: 'Automatically transcribes Zoom cloud recordings upon completion.',
    icon: <Video className="w-6 h-6" />,
    gradient: 'from-blue-600 to-sky-500',
    loginPath: '/providers/zoom/oauth/login',
    statusPath: '/providers/zoom/status',
    disconnectPath: '/providers/zoom/disconnect',
    webhookPath: '/providers/zoom/webhook',
    webhookEvents: ['recording.completed', 'recording.transcript_completed'],
    supportsRenewal: false,
    handshakeType: 'CRC Challenge (HMAC-SHA256)',
  },
  {
    id: 'google-meet',
    name: 'Google Meet',
    badge: 'Workspace Events',
    description: 'Syncs Google Meet recordings and Docs transcripts from Google Drive.',
    icon: <Radio className="w-6 h-6" />,
    gradient: 'from-emerald-600 to-teal-500',
    loginPath: '/providers/google-meet/oauth/login',
    statusPath: '/providers/google-meet/status',
    disconnectPath: '/providers/google-meet/disconnect',
    subscribePath: '/providers/google-meet/subscribe',
    webhookPath: '/providers/google-meet/webhook',
    webhookEvents: ['changes/watch', 'conferenceRecord.recordingEnded'],
    supportsRenewal: true,
    handshakeType: 'Drive Sync Handshake',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    badge: 'Graph Notifications',
    description: 'Subscribes to Microsoft Graph online meeting recording transcripts.',
    icon: <Users className="w-6 h-6" />,
    gradient: 'from-indigo-600 to-violet-600',
    loginPath: '/providers/teams/oauth/login',
    statusPath: '/providers/teams/status',
    disconnectPath: '/providers/teams/disconnect',
    subscribePath: '/providers/teams/subscribe',
    webhookPath: '/providers/teams/webhook',
    webhookEvents: ['onlineMeetings.transcripts.created', 'callRecords.created'],
    supportsRenewal: true,
    handshakeType: 'Plain-Text Validation Token',
  },
];

export default function ProvidersPage() {
  const [statuses, setStatuses] = useState<Record<string, ProviderStatusData | null>>({});
  const [jobs, setJobs] = useState<TranscriptJobItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'all' | 'connected' | 'jobs'>('all');

  const baseServer = SERVER_URL || 'http://localhost:8000';

  // Fetch statuses for all providers
  const fetchStatuses = useCallback(async () => {
    setIsLoading(true);
    const updatedStatuses: Record<string, ProviderStatusData | null> = {};

    await Promise.all(
      PROVIDER_CONFIGS.map(async (config) => {
        try {
          const res = await axios.get(`${baseServer}${config.statusPath}`, {
            withCredentials: true
          });
          updatedStatuses[config.id] = res.data;
        } catch (err) {
          console.error(`Failed to fetch status for ${config.name}:`, err);
          updatedStatuses[config.id] = { connected: false, email: null, scopes: [] };
        }
      })
    );

    // Fetch recent streaming jobs
    try {
      const jobsRes = await axios.get(`${baseServer}/providers/jobs/`, {
        withCredentials: true
      });
      if (jobsRes.data?.jobs) {
        setJobs(jobsRes.data.jobs);
      }
    } catch (err) {
      console.warn('Could not load provider jobs:', err);
    }

    setStatuses(updatedStatuses);
    setIsLoading(false);
    setLastRefreshed(new Date());
  }, [baseServer]);

  useEffect(() => {
    fetchStatuses();
    // Optional periodic refresh every 30 seconds
    const interval = setInterval(fetchStatuses, 30000);
    return () => clearInterval(interval);
  }, [fetchStatuses]);

  const connectedCount = Object.values(statuses).filter((s) => s?.connected).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Voice Meeting Providers
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Configure OAuth connections, subscribe to cloud video recordings, and monitor Kafka streaming.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Kafka Topics Active</span>
          </div>

          <button
            onClick={fetchStatuses}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 text-xs font-medium transition-all"
            title="Refresh statuses"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Connected Providers</p>
            <p className="text-2xl font-bold text-white mt-1">
              {connectedCount} <span className="text-sm font-normal text-slate-500">/ {PROVIDER_CONFIGS.length}</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Event Streaming</p>
            <p className="text-sm font-semibold text-white mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              voice-meeting-recordings
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Apache Kafka Consumer Group</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Status Synced</p>
            <p className="text-xs font-semibold text-slate-200 mt-1">
              {lastRefreshed.toLocaleTimeString()}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Auto-checks every 30s</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Provider Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Integrated Platforms</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-normal">
              3 Available
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {PROVIDER_CONFIGS.map((config) => (
            <ProviderCard
              key={config.id}
              provider={config}
              status={statuses[config.id] || null}
              isLoading={isLoading}
              onRefresh={fetchStatuses}
              serverUrl={baseServer}
            />
          ))}
        </div>
      </div>

      {/* Live Ingestion & Kafka Event Log */}
      <div className="rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-400" />
              <span>Real-Time Ingested Meeting Jobs</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitor incoming webhook recording payloads processed via Kafka and converted into AI meeting sessions.
            </p>
          </div>

          <span className="text-xs text-slate-500">
            {jobs.length} Recent Event{jobs.length === 1 ? '' : 's'}
          </span>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-300">No meeting events received yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Once you connect a provider and a cloud recording finishes, the provider webhook pushes the transcript payload directly into the Kafka pipeline.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="pb-3 font-medium">Provider</th>
                  <th className="pb-3 font-medium">Meeting Topic</th>
                  <th className="pb-3 font-medium">Status & Stage</th>
                  <th className="pb-3 font-medium">Progress</th>
                  <th className="pb-3 font-medium">Received At</th>
                  <th className="pb-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jobs.map((job) => {
                  const sessionId = typeof job.session_id === 'string' 
                    ? job.session_id 
                    : job.session_id?.id;

                  const statusColor = 
                    job.status === 'processed' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                    job.status === 'processing' ? 'text-violet-300 bg-violet-500/20 border-violet-500/30' :
                    job.status === 'failed' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
                    'text-amber-300 bg-amber-500/10 border-amber-500/20';

                  return (
                    <tr key={job.job_id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3">
                        <span className="capitalize font-semibold text-white">
                          {job.provider.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 font-medium text-slate-200">
                        {job.provider_meeting_topic || job.provider_meeting_id || job.job_id}
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${statusColor}`}>
                          <span className="capitalize">{job.status.replace('_', ' ')}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">{job.stage}</span>
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="w-24 bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 text-slate-400">
                        {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 text-right">
                        {sessionId ? (
                          <Link
                            href={`/session/${sessionId}/view`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-xs font-medium transition-all"
                          >
                            <span>View Note</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Processing...</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
