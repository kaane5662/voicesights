import { useState } from 'react';
import { Search, Clock, Calendar, MessageSquare, Sparkles, ChevronRight, Filter, SortDesc, Mic, MoreHorizontal, Star, StarOff, Trash2, Download, Play, TrendingUp, Hash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Session } from '@/app/interfaces';
import { formatRelativeTime } from '@/utils/dates';
import axios from 'axios';

// ============================================
// Session Card Component
// ============================================
export default function SessionCard({ session, isSelected, onDelete }:{session: Session, isSelected: boolean, onDelete: () => void}) {
  const router = useRouter()
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // const formatTime = (dateStr:string) => {
  //   return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  // };

  const getSentimentColor = (sentiment:string) => {
    switch (sentiment) {
      case 'positive': return 'text-emerald-400';
      case 'negative': return 'text-rose-400';
      default: return 'text-slate-400';
    }
  };

  

  return (
    <div
      
      className={`group p-5 rounded-2xl border transition-all cursor-pointer ${
        isSelected
          ? 'bg-white/10 border-violet-500/50 shadow-lg shadow-violet-500/10'
          : 'bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
          <Play className="w-5 h-5 text-violet-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div
            onClick={()=>router.push( `/session/${session.id}/${session.finished ? 'view':'record'}`)}
            >
              <h3 
              
              className="font-semibold text-lg text-white group-hover:text-violet-300 transition-colors">
                {session.title}
              </h3>
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(session.created_at)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatRelativeTime(session.created_at)}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {session.word_count.toLocaleString()} words
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* <button
                // onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
                className={`p-2 rounded-lg transition-all ${
                  session.starred
                    ? 'text-amber-400 bg-amber-500/20'
                    : 'text-slate-500 hover:text-white hover:bg-white/10'
                }`}
              >
                {session.starred ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
              </button>
              <button className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                <Download className="w-4 h-4" />
              </button> */}
              <button 
              onClick={onDelete}
              className="p-2 rounded-lg text-slate-500 hover:text-red-500 hover:bg-white/10 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 mb-3">
            <Sparkles className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
            <p className="text-sm text-slate-300 leading-relaxed">{session.ai_overview}</p>
          </div>

          {/* <div className="flex items-center gap-2">
            {session.tags.map((tag:string) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400"
              >
                {tag}
              </span>
            ))}
            <span className={`ml-2 text-xs ${getSentimentColor(session.sentiment)}`}>
              • {session.sentiment}
            </span>
          </div>

          {isSelected && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <h4 className="text-sm font-medium text-slate-400 mb-2">Transcript Preview</h4>
              <p className="text-sm text-slate-500 italic">"{session.transcript}"</p>
              <button className="mt-3 text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1">
                View full transcript <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )} */}
        </div>
      </div>
    </div>
  );
}