"use client"

// ============================================
// Note Row Component

import { ChatSession, Note } from "@/app/interfaces";
import { SERVER_URL } from "@/const";
import { formatRelativeTime } from "@/utils/dates";
import axios from "axios";
import { FileText, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// ============================================
// Chat Row Component
// ============================================
function ChatRow({ chat }: { chat: ChatSession }) {
    return (
      <Link 
      replace={true}
      href={`/session/${chat.session_id}/view?chatId=${chat.id}`}
      className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-all">
        <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-4.5 h-4.5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-md font-medium text-white truncate">{chat.title}</h3>
          <p className="text-sm text-slate-500 truncate">{chat?.messages[chat.messages.length-1]?.content}</p>
        </div>
        <span className="text-xs text-slate-600 shrink-0">{formatRelativeTime(chat.created_at as string)}</span>
      </Link>
    );
  }

  export default function NotesPage() {
    const [chats, setChats] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [pageNumber,setPageNumber] = useState(1)
    const [totalPages,setTotalPages] = useState(1)
    const pageSize = 10
    const [sortBy, setSortBy] = useState('date');
    const [selectedSession, setSelectedSession] = useState(null);
    const router = useRouter()
  
    
  

    // INSERT_YOUR_CODE

    // Helper function to fetch sessions from the API
    async function fetchDocs() {
      try {
        const res = await axios.post(
          `${SERVER_URL}/chats/`,
          {
            page: pageNumber,
            page_size: pageSize,
          },
          {
            withCredentials: true,
          }
        );
        if (res.status !== 200) throw new Error("Failed to fetch chats");
        const data = res.data;
        console.log(data)
        setChats(data.chats);
        setTotalPages(data.pagination.total_pages)
        
      } catch (error) {
        console.error("Error fetching docs:", error);
        return [];
      }
    }

  


    useEffect(()=>{
      fetchDocs()
    },[])
  
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
                  AI Chat History
                </h1>
                <p className="text-slate-500 mt-1">Revisit, search, and continue your conversations</p>
              </div>
              
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
              {/* <div className="flex gap-2">
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
              </div> */}
            </div>
          </header>
  
          {/* Notes List */}
          <div className="flex flex-col gap-4">
            {chats.map((chat: ChatSession) => (
              <ChatRow
                key={chat.id}
                chat={chat}
              />
            ))}
          </div>
  
          {chats.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                <Search className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-400">No chats found</h3>
              <p className="text-slate-600 mt-1">Try adjusting your search or filters</p>
            </div>
          )}
    
            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                <button
                    className="px-3 py-1 rounded-xl bg-white/10 text-white font-medium text-sm hover:bg-violet-500/20 transition-all disabled:opacity-40"
                    disabled={pageNumber === 1 || !pageNumber}
                    onClick={() => setPageNumber((prev) => (prev ? prev - 1 : 1))}
                >
                    Previous
                </button>
                {[...Array(totalPages)].map((_, i) => (
                    <button
                    key={i}
                    className={`px-3 py-1 rounded-lg font-medium text-sm ${
                        (pageNumber ?? 1) === i + 1
                        ? "bg-violet-500/40 text-white"
                        : "bg-white/10 text-slate-300 hover:bg-violet-700/30"
                    } transition-all`}
                    onClick={() => setPageNumber(i + 1)}
                    >
                    {i + 1}
                    </button>
                ))}
                <button
                    className="px-3 py-1 rounded-xl bg-white/10 text-white font-medium text-sm hover:bg-violet-500/20 transition-all disabled:opacity-40"
                    disabled={pageNumber === totalPages}
                    onClick={() => setPageNumber((prev) => (prev ? prev + 1 : 2))}
                >
                    Next
                </button>
                </div>
            )}
        </div>
      </div>
    );
  }