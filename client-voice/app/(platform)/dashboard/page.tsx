"use client"

import { useState, useEffect } from 'react';
import { Mic, Clock, MessageSquare, ChevronRight, Play, Plus, ArrowUpRight, FileText, Sparkles, Loader } from 'lucide-react';
import axios from 'axios';
import { SERVER_URL } from '@/const';
import { ChatSession, Note, Session } from '@/app/interfaces';
import { formatRelativeTime } from '@/utils/dates';
import LoadingScreen from '@/components/ui/LoadingScreen';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ============================================
// Types
// ============================================
interface StatCard {
  id: string;
  label: string;
  value: string;
  change: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}



// ============================================
// Data
// ============================================

// INSERT_YOUR_CODE
const BASE_STATS: StatCard[] = [
  {
    id: 'sessions',
    label: 'Total Sessions',
    value: '0',
    change: 0,
    icon: Play,
    color: 'violet'
  },
  {
    id: 'duration',
    label: 'Total Session Time',
    value: '0m',
    change: 0,
    icon: Clock,
    color: 'cyan'
  },
  {
    id: 'words',
    label: 'Total Words',
    value: '0',
    change: 0,
    icon: MessageSquare,
    color: 'emerald'
  }
];

// ============================================
// Stat Card Component
// ============================================
function StatCardComponent({ stat }: { stat: StatCard }) {
  const Icon = stat.icon;
  const colorClasses: Record<string, string> = {
    violet: 'from-violet-500/20 to-violet-600/20 text-violet-400',
    cyan: 'from-cyan-500/20 to-cyan-600/20 text-cyan-400',
    emerald: 'from-emerald-500/20 to-emerald-600/20 text-emerald-400',
  };

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClasses[stat.color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="flex items-center gap-1 text-xs text-emerald-400">
          <ArrowUpRight className="w-3 h-3" />{stat.change}%
        </span>
      </div>
      <p className="text-xl font-bold text-white">{stat.value}</p>
      <p className="text-xs text-slate-500">{stat.label}</p>
    </div>
  );
}

// ============================================
// Session Row Component
// ============================================
function SessionRow({ session }: { session: Session }) {
  const formatDuration = (s: number): string => `${Math.floor(s / 60)}m`;

  return (
    <div 

    className="group flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 cursor-pointer transition-all">
      <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
        <Play className="w-4 h-4 text-violet-400" />
      </div>
      <Link
      href={session.finished ? `/session/${session.id}/view` : `/session/${session.id}/record`}
       className="flex-1 min-w-0">
        <h3 className="font-medium text-white truncate group-hover:text-violet-300 transition-colors">{session.title}</h3>
        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
          <span>{session.date}</span>
          <span>•</span>
          <span>{formatDuration(session.total_duration || 0)}</span>
          <span>•</span>
          <span>{session?.word_count?.toLocaleString()} words</span>
        </div>
      </Link>
      <ChevronRight className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// ============================================
// Note Row Component
// ============================================
function NoteRow({ note }: { note: Note }) {
  return (
    <Link 
    href={`/session/${note.session_id}/view?noteId=${note.id}`}
    className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-all">
      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
        <FileText className="w-3.5 h-3.5 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-white truncate">{note.title}</h3>
        <p className="text-xs text-slate-500 truncate">{note.content_json[note.content_json.length-1]}</p>
      </div>
      <span className="text-xs text-slate-600 shrink-0">{ formatRelativeTime(note.created_at as string)}</span>
    </Link>
  );
}

// ============================================
// Chat Row Component
// ============================================
function ChatRow({ chat }: { chat: ChatSession }) {
  return (
    <Link 
    href={`/session/${chat.session_id}/view?chatId=${chat.id}`}
    className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-all">
      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-white truncate">{chat.title}</h3>
        <p className="text-xs text-slate-500 truncate">{chat.messages[chat.messages.length-1].content}</p>
      </div>
      <span className="text-xs text-slate-600 shrink-0">{formatRelativeTime(chat.created_at as string)}</span>
    </Link>
  );
}

// ============================================
// Main Dashboard Component
// ============================================
export default function Dashboard() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  
  

  
  // Demo state for fetched data (replace the default states)
  const [statistics, setStatistics] = useState<StatCard[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [recentChats, setRecentChats] = useState<ChatSession[]>([]);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSession,setCreatingSession] = useState(false)
  const router = useRouter()

  // Replace with the actual user_id as needed
  const fetchStats = async () => {
    setLoading(true);
    try {
      // Replace 'USER_ID' with the actual logged-in user's id
      const res = await axios.get(
        `${SERVER_URL}/profiles/statistics`,
        {withCredentials:true}
      );
      // Map/transform response data as needed for frontend display
      const data = res.data;
      let stats = Object.values(data.stats)
      console.log(data)
    //   console.log(BASE_STATS.map((p,i)=>( {...p,value: data.statistics[i]})           ))
      setStatistics(BASE_STATS.map((p,i)=>( {...p,value: stats[i] as string})           ));

      setRecentSessions(data.recent_sessions);

      setRecentChats(data.recent_chats);

      setRecentNotes(data.recent_notes);
    } catch (err) {
      // You can handle error UI here
      setStatistics([]);
      setRecentSessions([]);
      setRecentChats([]);
      setRecentNotes([]);
    }
    finally{

        setLoading(false);
    }
  };
  async function createNewSession() {
    setCreatingSession(true)
    try {
      const res = await axios.post(
        `${SERVER_URL}/sessions/`,
        {},
        {
          withCredentials: true
        }
      );
      if (res.status !== 200 && res.status !== 201) throw new Error("Failed to create session");
      const data = res.data;
      console.log(data)
   
      router.push(`/session/${data.session.id}/record`)
    } catch (error) {
      console.error("Error creating session:", error);
      return null;
    }finally{
      setCreatingSession(false)
    }
  }


  useEffect(() => {
    
    fetchStats();
  }, []);



  if(loading)
    return <LoadingScreen loadingText='Loading dashboard'></LoadingScreen>

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto p-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{greeting}</h1>
            <p className="text-slate-500 text-sm mt-0.5">Here's your overview</p>
          </div>
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white font-medium text-sm hover:opacity-90 transition-all shadow-lg shadow-violet-500/25 ${creatingSession ? 'opacity-60 cursor-not-allowed' : ''}`}
            onClick={createNewSession}
            disabled={creatingSession}
          >
            {creatingSession ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            New Session
          </button>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {statistics.map((stat) => (
            <StatCardComponent key={stat.id} stat={stat} />
          ))}
        </div>

        {/* Recent Sessions */}
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden mb-6">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="font-semibold text-white">Recent Sessions</h2>
            <button className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-white/5">
            {recentSessions.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </div>
        </div>

        {/* Notes & Chats Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Notes */}
          <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h2 className="font-medium text-white text-sm">Notes</h2>
              <button className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-2 space-y-1">
              {recentNotes.map((note) => (
                <NoteRow key={note.id} note={note} />
              ))}
            </div>
          </div>

          {/* Chats */}
          <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h2 className="font-medium text-white text-sm">AI Chats</h2>
              <button className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-2 space-y-1">
              {recentChats.map((chat) => (
                <ChatRow key={chat.id} chat={chat} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}