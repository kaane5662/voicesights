"use client";

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ExternalLink,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Table,
  Hash,
  Send,
  Brain,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldAlert,
  FileSpreadsheet,
  Lock
} from 'lucide-react';
import {
  AuthErrorData,
  LinearTeamsData,
  LinearIssuesData,
  GoogleCalendarsData,
  GoogleCalendarEventsData,
  GoogleSheetRowsData,
  SlackChannelsData,
  SlackMessageData,
  GraphitiSearchData
} from '@/app/interfaces';

/**
 * 1. Auth Error View - Rendered when an app integration needs connection or token re-auth
 */
export function AuthErrorView({ data, message }: { data?: AuthErrorData; message?: string }) {
  const appId = data?.app_id || 'app';
  const appName = data?.app_name || (
    appId === 'google-calendar' ? 'Google Calendar' :
    appId === 'google-sheets' ? 'Google Sheets' :
    appId === 'linear' ? 'Linear' :
    appId === 'slack' ? 'Slack' : 'App'
  );

  const appIcon = 
    appId === 'google-calendar' ? '📅' :
    appId === 'google-sheets' ? '📊' :
    appId === 'linear' ? '📐' :
    appId === 'slack' ? '💬' : '🔌';

  const displayMessage = data?.message || message || `${appName} is not connected. Please connect your account to proceed.`;
  const connectUrl = data?.auth_url || '/apps';

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-3">
      <div className="flex items-center gap-2 text-amber-400">
        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-wider">Authentication Required</span>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-lg shrink-0">
          {appIcon}
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-white">{appName} Not Connected</h4>
          <p className="text-xs text-slate-300 leading-relaxed">{displayMessage}</p>
        </div>
      </div>

      <div className="pt-1 flex items-center gap-2">
        <Link
          href={connectUrl}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-xs font-medium text-slate-950 hover:brightness-110 transition-all shadow-sm"
        >
          <span>Connect {appName}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          href="/apps"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-400 hover:text-white transition-colors border border-white/10"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Manage Apps</span>
        </Link>
      </div>
    </div>
  );
}

/**
 * 2. Linear Teams View
 */
export function LinearTeamsView({ data, message }: { data?: LinearTeamsData; message?: string }) {
  const teams = data?.teams || [];

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-3.5 space-y-2.5">
      <div className="flex items-center gap-2 text-violet-400">
        <Layers className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">Linear Workspace Teams</span>
      </div>

      {message && <p className="text-xs text-slate-300">{message}</p>}

      {teams.length > 0 ? (
        <div className="grid grid-cols-1 gap-1.5 pt-1">
          {teams.map((team, idx) => (
            <div
              key={team.id || idx}
              className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10 text-xs"
            >
              <span className="font-medium text-white">{team.name}</span>
              <div className="flex items-center gap-2">
                {team.key && (
                  <span className="px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[10px] font-mono">
                    {team.key}
                  </span>
                )}
                <span className="text-slate-500 text-[10px] font-mono">ID: {team.id}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">No teams found in this workspace.</p>
      )}
    </div>
  );
}

/**
 * 3. Linear Issues View
 */
export function LinearIssuesView({ data, message }: { data?: LinearIssuesData; message?: string }) {
  const issues = data?.issues || [];

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 space-y-2.5">
      <div className="flex items-center gap-2 text-emerald-400">
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">Linear Issues Created</span>
      </div>

      {message && <p className="text-xs text-slate-300">{message}</p>}

      {issues.length > 0 && (
        <div className="space-y-2 pt-1">
          {issues.map((issue, idx) => (
            <div
              key={issue.id || idx}
              className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-white">{issue.title}</span>
                {issue.team_id && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                    Team: {issue.team_id}
                  </span>
                )}
              </div>
              {issue.description && (
                <p className="text-slate-400 text-[11px] line-clamp-2">{issue.description}</p>
              )}
              {issue.url && (
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline pt-0.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open in Linear</span>
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 4. Google Calendars View
 */
export function GoogleCalendarsView({ data, message }: { data?: GoogleCalendarsData; message?: string }) {
  const calendars = data?.calendars || [];

  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3.5 space-y-2.5">
      <div className="flex items-center gap-2 text-blue-400">
        <Calendar className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">Google Calendars</span>
      </div>

      {message && <p className="text-xs text-slate-300">{message}</p>}

      {calendars.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {calendars.map((cal, idx) => (
            <div
              key={cal.id || idx}
              className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{cal.summary}</span>
                {cal.primary && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px]">Primary</span>
                )}
              </div>
              <span className="text-slate-500 text-[10px] font-mono truncate max-w-[140px]">{cal.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 5. Google Calendar Events View
 */
export function GoogleCalendarEventsView({ data, message }: { data?: GoogleCalendarEventsData; message?: string }) {
  const events = data?.events || [];

  const formatEventTime = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3.5 space-y-2.5">
      <div className="flex items-center gap-2 text-blue-400">
        <Calendar className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">Calendar Events Scheduled</span>
      </div>

      {message && <p className="text-xs text-slate-300">{message}</p>}

      {events.length > 0 && (
        <div className="space-y-2 pt-1">
          {events.map((evt, idx) => (
            <div
              key={evt.event_id || idx}
              className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs space-y-1.5"
            >
              <span className="font-semibold text-white block">{evt.summary}</span>
              <div className="flex flex-wrap items-center gap-3 text-slate-400 text-[11px]">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400" />
                  {formatEventTime(evt.start)} {evt.end ? `- ${formatEventTime(evt.end)}` : ''}
                </span>
                {evt.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-rose-400" />
                    {evt.location}
                  </span>
                )}
              </div>
              {evt.description && (
                <p className="text-slate-400 text-[11px] line-clamp-2">{evt.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 6. Google Sheet Rows View
 */
export function GoogleSheetRowsView({ data, message }: { data?: GoogleSheetRowsData; message?: string }) {
  const columns = data?.columns || [];
  const rows = data?.rows || [];
  const spreadsheetUrl = data?.spreadsheet_id
    ? `https://docs.google.com/spreadsheets/d/${data.spreadsheet_id}`
    : null;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-400">
          <FileSpreadsheet className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Google Sheets Appended</span>
        </div>
        {spreadsheetUrl && (
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
          >
            <span>Open Sheet</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {message && <p className="text-xs text-slate-300">{message}</p>}

      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
          Tab: {data?.sheet_name || 'Sheet1'}
        </span>
        {data?.row_count !== undefined && (
          <span>{data.row_count} row(s) appended</span>
        )}
      </div>

      {(columns.length > 0 || rows.length > 0) && (
        <div className="overflow-x-auto max-h-48 rounded-lg border border-white/10 bg-black/20 text-xs">
          <table className="w-full text-left border-collapse">
            {columns.length > 0 && (
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-[11px] text-slate-400">
                  {columns.map((col, idx) => (
                    <th key={idx} className="p-2 font-medium">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-white/5 hover:bg-white/5">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-2 text-slate-300">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * 7. Slack Channels View
 */
export function SlackChannelsView({ data, message }: { data?: SlackChannelsData; message?: string }) {
  const channels = data?.channels || [];

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3.5 space-y-2.5">
      <div className="flex items-center gap-2 text-indigo-400">
        <Hash className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">Slack Channels</span>
      </div>

      {message && <p className="text-xs text-slate-300">{message}</p>}

      {channels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {channels.map((ch, idx) => (
            <span
              key={ch.id || idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white"
            >
              {ch.is_private ? <Lock className="w-3 h-3 text-slate-400" /> : <Hash className="w-3 h-3 text-indigo-400" />}
              <span>{ch.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 8. Slack Message View
 */
export function SlackMessageView({ data, message }: { data?: SlackMessageData; message?: string }) {
  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-400">
          <Send className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Slack Message Sent</span>
        </div>
        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Sent
        </span>
      </div>

      {message && <p className="text-xs text-slate-300">{message}</p>}

      {data?.channel && (
        <div className="text-[11px] text-slate-400">
          Channel: <span className="text-indigo-300 font-medium">#{data.channel}</span>
        </div>
      )}

      {data?.message_text && (
        <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 italic border-l-2 border-l-indigo-500">
          &ldquo;{data.message_text}&rdquo;
        </div>
      )}
    </div>
  );
}

/**
 * 9. Graphiti Search View
 */
export function GraphitiSearchView({ data, message }: { data?: GraphitiSearchData; message?: string }) {
  return (
    <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/20 p-3.5 space-y-2.5">
      <div className="flex items-center gap-2 text-fuchsia-400">
        <Brain className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">Knowledge Base Search</span>
      </div>

      {data?.query && (
        <span className="inline-block px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 text-[11px] font-mono">
          Query: {data.query}
        </span>
      )}

      {message && <p className="text-xs text-slate-300">{message}</p>}

      {data?.results && (
        <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
          {typeof data.results === 'string' ? data.results : JSON.stringify(data.results, null, 2)}
        </div>
      )}
    </div>
  );
}

/**
 * 10. Regular Text Message View
 */
export function TextContentView({ content }: { content: string }) {
  return <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{content}</p>;
}
