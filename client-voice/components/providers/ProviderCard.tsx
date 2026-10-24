"use client";

import React, { useState } from 'react';
import { 
  Check, 
  Copy, 
  ExternalLink, 
  Trash2, 
  RefreshCw, 
  Shield, 
  AlertCircle, 
  Clock, 
  Key, 
  Calendar, 
  Radio, 
  ArrowUpRight 
} from 'lucide-react';
import axios from 'axios';
import { SERVER_URL } from '@/const';

export interface ProviderConfig {
  id: string; // 'zoom' | 'google-meet' | 'teams'
  name: string; // 'Zoom' | 'Google Meet' | 'Microsoft Teams'
  badge: string; // 'Cloud Recording' | 'Workspace Event' | 'Graph Webhook'
  description: string;
  icon: React.ReactNode;
  gradient: string; // e.g. 'from-blue-600 to-sky-500'
  loginPath: string; // '/providers/zoom/oauth/login'
  statusPath: string; // '/providers/zoom/status'
  disconnectPath: string; // '/providers/zoom/disconnect'
  subscribePath?: string; // '/providers/teams/subscribe'
  webhookPath: string; // '/providers/zoom/webhook'
  webhookEvents: string[];
  supportsRenewal?: boolean;
  handshakeType: string; // 'CRC Validation' | 'Validation Token' | 'Sync Handshake'
}

export interface ProviderStatusData {
  connected: boolean;
  email: string | null;
  scopes: string[];
  subscription_id?: string | null;
  expires_at?: string | null;
  subscription_expires_at?: string | null;
  updated_at?: string | null;
}

export interface ProviderCardProps {
  provider: ProviderConfig;
  status: ProviderStatusData | null;
  isLoading?: boolean;
  onRefresh: () => void;
  serverUrl?: string;
}

export default function ProviderCard({
  provider,
  status,
  isLoading = false,
  onRefresh,
  serverUrl
}: ProviderCardProps) {
  const [copied, setCopied] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [showWebhookDetails, setShowWebhookDetails] = useState(false);

  const baseServer = serverUrl || SERVER_URL || 'http://localhost:8000';
  const fullWebhookUrl = `${baseServer}${provider.webhookPath}`;

  const isConnected = status?.connected === true;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(fullWebhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await axios.get(`${baseServer}${provider.loginPath}`, {
        withCredentials: true
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      console.error(`Failed to initiate ${provider.name} OAuth:`, err);
      alert(err.response?.data?.detail || `Failed to start ${provider.name} authorization flow.`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${provider.name}? Incoming meetings will no longer be transcribed.`)) {
      return;
    }
    setIsDisconnecting(true);
    try {
      await axios.post(`${baseServer}${provider.disconnectPath}`, {}, {
        withCredentials: true
      });
      onRefresh();
    } catch (err: any) {
      console.error(`Failed to disconnect ${provider.name}:`, err);
      alert(err.response?.data?.detail || `Failed to disconnect ${provider.name}.`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRenew = async () => {
    if (!provider.subscribePath) return;
    setIsRenewing(true);
    try {
      await axios.post(`${baseServer}${provider.subscribePath}`, {}, {
        withCredentials: true
      });
      alert(`${provider.name} subscription successfully renewed!`);
      onRefresh();
    } catch (err: any) {
      console.error(`Failed to renew ${provider.name} subscription:`, err);
      alert(err.response?.data?.detail || `Failed to renew ${provider.name} subscription.`);
    } finally {
      setIsRenewing(false);
    }
  };

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return 'Auto-refreshing via OAuth';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getExpirationStatus = () => {
    const expiryStr = status?.subscription_expires_at || status?.expires_at;
    if (!expiryStr) return { label: 'Active', isUrgent: false };
    const expiryDate = new Date(expiryStr);
    const now = new Date();
    const diffHours = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 0) {
      return { label: 'Expired', isUrgent: true };
    }
    if (diffHours < 24) {
      return { label: `Expires in ${Math.round(diffHours)}h`, isUrgent: true };
    }
    return { label: `Expires in ${Math.round(diffHours / 24)}d`, isUrgent: false };
  };

  const expiryStatus = isConnected ? getExpirationStatus() : null;

  return (
    <div className="rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 p-6 flex flex-col justify-between hover:border-white/20 transition-all shadow-xl group">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${provider.gradient} flex items-center justify-center text-white shadow-lg`}>
              {provider.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{provider.name}</h3>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                  {provider.badge}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{provider.description}</p>
            </div>
          </div>

          <div>
            {isConnected ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs font-medium">
                Disconnected
              </span>
            )}
          </div>
        </div>

        {/* Connected Details Info Box */}
        {isConnected ? (
          <div className="space-y-3 my-4 p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Account:</span>
              <span className="text-white font-medium truncate max-w-[200px]">
                {status?.email || 'Authorized User'}
              </span>
            </div>

            {status?.subscription_id && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Subscription ID:</span>
                <span className="text-slate-300 font-mono text-[11px] truncate max-w-[180px]">
                  {status.subscription_id}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Expiration:
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-300">
                  {formatDateTime(status?.subscription_expires_at || status?.expires_at)}
                </span>
                {expiryStatus && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    expiryStatus.isUrgent 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold' 
                      : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {expiryStatus.label}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-violet-400" /> Handshake:
              </span>
              <span className="text-slate-300 font-medium">
                {provider.handshakeType} Active
              </span>
            </div>

            {status?.scopes && status.scopes.length > 0 && (
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-slate-400">Authorized Scopes:</span>
                  <span className="text-[10px] text-slate-500">{status.scopes.length} permissions</span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                  {status.scopes.map((scope) => (
                    <span 
                      key={scope} 
                      className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/5 text-slate-300 truncate max-w-[260px]"
                      title={scope}
                    >
                      {scope.split('/').pop() || scope}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="my-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-xs text-slate-400 leading-relaxed">
              Connect {provider.name} via OAuth to subscribe to video recording completions, ingest transcripts, and stream events into Kafka.
            </p>
          </div>
        )}

        {/* Webhook Configuration Dropdown */}
        <div className="my-3">
          <button
            onClick={() => setShowWebhookDetails(!showWebhookDetails)}
            className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1.5 transition-colors font-medium"
          >
            <span>{showWebhookDetails ? 'Hide Webhook Details' : 'View Webhook Endpoint'}</span>
            <ArrowUpRight className={`w-3.5 h-3.5 transition-transform ${showWebhookDetails ? 'rotate-90' : ''}`} />
          </button>

          {showWebhookDetails && (
            <div className="mt-2.5 p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Webhook Endpoint URL:</span>
                <button
                  onClick={handleCopyWebhook}
                  className="flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <code className="block p-2 rounded bg-slate-950 text-[11px] text-slate-300 font-mono break-all border border-white/5 select-all">
                {fullWebhookUrl}
              </code>

              <div>
                <span className="text-[11px] text-slate-400">Subscribed Events:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {provider.webhookEvents.map((evt) => (
                    <span key={evt} className="text-[10px] px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                      {evt}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-white/10 flex flex-wrap gap-2">
        {isConnected ? (
          <>
            {provider.supportsRenewal && provider.subscribePath && (
              <button
                onClick={handleRenew}
                disabled={isRenewing}
                className="flex-1 px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-medium hover:bg-violet-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRenewing ? 'animate-spin' : ''}`} />
                <span>Renew Subscription</span>
              </button>
            )}

            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              title="Re-authorize OAuth tokens"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
              <span>Re-auth</span>
            </button>

            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium hover:bg-rose-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </>
        ) : (
          <button
            onClick={handleConnect}
            disabled={isConnecting || isLoading}
            className={`w-full px-4 py-2.5 rounded-xl bg-gradient-to-r ${provider.gradient} text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg`}
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting to {provider.name}...</span>
              </>
            ) : (
              <>
                <Key className="w-3.5 h-3.5" />
                <span>Connect {provider.name}</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
