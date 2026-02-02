"use client"
import SessionCard from "@/components/sessions/SessionCard";
import { useEffect, useState } from 'react';
import { Search, Clock, Calendar, MessageSquare, Sparkles, ChevronRight, Filter, SortDesc, Mic, MoreHorizontal, Star, StarOff, Trash2, Download, Play, TrendingUp, Hash, Loader2 } from 'lucide-react';
import { useRouter } from "next/navigation";
import { SERVER_URL } from "@/const";
import axios from "axios";
import Pagination from "@/components/ui/Pagination";



const mockSessions = [
    {
      id: 1,
      title: 'Product Roadmap Discussion',
      date: '2025-01-15T14:30:00',
      duration: 1847,
      word_count: 2453,
      speakers: 1,
      starred: true,
      tags: ['product', 'planning'],
      ai_overview: 'Discussed Q1 priorities including mobile app redesign, API v2 launch timeline, and resource allocation. Key decisions: prioritize auth flow improvements, delay analytics dashboard to Q2.',
      transcript: 'We need to focus on the mobile experience first...',
      sentiment: 'positive'
    },
    {
      id: 2,
      title: 'Weekly Team Standup',
      date: '2025-01-15T09:00:00',
      duration: 923,
      word_count: 1205,
      speakers: 1,
      starred: false,
      tags: ['standup', 'team'],
      ai_overview: 'Covered sprint progress, blockers on payment integration, and upcoming deadlines. Action items: resolve Stripe webhook issue, complete code review for auth module.',
      transcript: 'Good morning everyone, lets go around...',
      sentiment: 'neutral'
    },
    {
      id: 3,
      title: 'Customer Interview - Enterprise',
      date: '2025-01-14T16:00:00',
      duration: 2534,
      word_count: 3872,
      speakers: 1,
      starred: true,
      tags: ['customer', 'research', 'enterprise'],
      ai_overview: 'Enterprise customer feedback session. Main pain points: SSO integration complexity, lack of audit logs, need for custom roles. Strong interest in annual contract with dedicated support.',
      transcript: 'Thank you for taking the time to speak with us...',
      sentiment: 'positive'
    },
    {
      id: 4,
      title: 'Design Review - Onboarding Flow',
      date: '2025-01-14T11:30:00',
      duration: 1456,
      word_count: 1923,
      speakers: 1,
      starred: false,
      tags: ['design', 'ux'],
      ai_overview: 'Reviewed new onboarding mockups. Approved simplified 3-step flow, requested changes to progress indicator, and discussed A/B test strategy for welcome screen variations.',
      transcript: 'Lets walk through the new designs...',
      sentiment: 'positive'
    },
    {
      id: 5,
      title: 'Incident Postmortem - API Outage',
      date: '2025-01-13T15:00:00',
      duration: 2102,
      word_count: 2687,
      speakers: 1,
      starred: false,
      tags: ['incident', 'engineering'],
      ai_overview: 'Analyzed 47-minute API outage caused by database connection pool exhaustion. Root cause: missing connection timeout config. Action items: implement circuit breakers, add monitoring alerts.',
      transcript: 'Lets go through the timeline of events...',
      sentiment: 'negative'
    },
    {
      id: 6,
      title: 'Brainstorm - AI Features',
      date: '2025-01-12T14:00:00',
      duration: 3201,
      word_count: 4102,
      speakers: 1,
      starred: true,
      tags: ['ai', 'brainstorm', 'product'],
      ai_overview: 'Explored AI integration opportunities. Top ideas: smart search with natural language, automated tagging, meeting summarization. Prioritized smart search for MVP with 6-week timeline.',
      transcript: 'What if we could let users just ask questions...',
      sentiment: 'positive'
    }
  ];
  
export default function SessionsPage() {
    const [sessions, setSessions] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [creatingSession,setCreatingSession] = useState(false)
    const [sortBy, setSortBy] = useState('date');
    const [selectedSession, setSelectedSession] = useState(null);
    const [currentPage,setCurrentPage] = useState(1)
    const [totalPages,setTotalPages] = useState(0)
    const resultsPerPage=3
    
    const router = useRouter()
  
    const formatDuration = (seconds:number) => {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      if (hrs > 0) return `${hrs}h ${mins}m`;
      return `${mins}m ${secs}s`;
    };
  
   
    // Helper function to call the POST /sessions API route and get a new session id
    async function createNewSession() {
      try {
        setCreatingSession(true)
        const res = await axios.post(
          `${SERVER_URL}/sessions/`,
          {},
          {
            withCredentials: true,
            
          }
        );
        if (res.status !== 200 && res.status !== 201) throw new Error("Failed to create session");
        const data = res.data;
        console.log(data)
        setSessions(prev=>[(data.session as any),...prev])
        router.push(`/session/${data.session.id}/record`)
      } catch (error) {
        console.error("Error creating session:", error);
        return null;
      }finally{
        setCreatingSession(false)
      }
    }

    // INSERT_YOUR_CODE

    // Helper function to fetch sessions from the API
    async function fetchSessions() {
      try {
        // Call paginated endpoint using query params to match FastAPI
        const res = await axios.get(`${SERVER_URL}/sessions`, {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          },
          params: {
            page: currentPage || 1,
            page_size: resultsPerPage,
            search_query:searchQuery
          }
        });
        if (res.status !== 200) throw new Error("Failed to fetch sessions");
        const data = res.data;
        setCurrentPage(data.pagination.page)
        setTotalPages(data.pagination.total_pages)
        if (Array.isArray(data.sessions)) {
          setSessions(data.sessions);
        }
        return data.sessions;
      } catch (error) {
        console.error("Error fetching sessions:", error);
        return [];
      }
    }

  
    const toggleStar = (id) => {
      setSessions(sessions.map(s => s.id === id ? { ...s, starred: !s.starred } : s));
    };
  
    const filteredSessions = sessions
      .filter(s => {
        if (selectedFilter === 'starred') return s.starred;
        if (selectedFilter !== 'all') return s.tags.includes(selectedFilter);
        return true;
      })
      .filter(s => 
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.ai_overview.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tags.some(t => t.includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => {
        if (sortBy === 'date') return new Date(b.date) - new Date(a.date);
        if (sortBy === 'duration') return b.duration - a.duration;
        return 0;
      });
  
    const allTags = [...new Set(sessions.flatMap(s => s.tags))];
    const totalDuration = sessions.reduce((acc, s) => acc + s.duration, 0);
    const totalWords = sessions.reduce((acc, s) => acc + s.word_count, 0);

    useEffect(()=>{
      fetchSessions()
    },[currentPage])

    useEffect(()=>{
      setCurrentPage(1)
    },[searchQuery])
  
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        {/* Background effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
        </div>
  
        <div className="relative z-10 max-w-6xl mx-auto p-6">
          {/* Header */}
          <header className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  Transcripts
                </h1>
                <p className="text-slate-500 mt-1">Browse and search your voice sessions</p>
              </div>
              <button onClick={createNewSession} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:opacity-90 transition-all font-medium shadow-lg shadow-violet-500/25">
                {creatingSession ? (
                  <span className="animate-spin">
                    <Loader2 className="w-4 h-4" />
                  </span>
                ) : (
                  <Mic className="w-4 h-4" />
                )}
                New Session
              </button>
            </div>
  
            
  
            {/* Search and Filters */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search transcripts, topics, or tags..."
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-all"
                />
                
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
                >
                  <option value="all">All Sessions</option>
                  <option value="starred">Starred</option>
                  {allTags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
                >
                  <option value="date">Recent</option>
                  <option value="duration">Longest</option>
                </select>
              </div>
            </div>
          </header>
  
          {/* Sessions List */}
          {filteredSessions.length > 0 &&(

            <div className="space-y-4">
              {filteredSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isSelected={selectedSession === session.id}
                  onSelect={() => setSelectedSession(selectedSession === session.id ? null : session.id)}
                  onToggleStar={() => toggleStar(session.id)}
                />
              ))}
              <Pagination onPageChange={(p)=>setCurrentPage(p)} totalPages={totalPages} currentPage={currentPage}></Pagination>

            </div>
          )}
  
          {filteredSessions.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                <Search className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-400">No sessions found</h3>
              <p className="text-slate-600 mt-1">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>
    );
  }