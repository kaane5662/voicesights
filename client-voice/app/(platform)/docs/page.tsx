"use client"

// ============================================
// Note Row Component

import { Note } from "@/app/interfaces";
import SelectFolderPopup from "@/components/popups/SelectFolder";
import Pagination from "@/components/ui/Pagination";
import { SERVER_URL } from "@/const";
import { formatRelativeTime } from "@/utils/dates";
import axios from "axios";
import { FileText, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// ============================================
function NoteRow({ note }: { note: Note }) {

    return (
      <div>

        <Link 
        replace={true}
        href={`/session/${note.session_id}/view?noteId=${note.id}`}
        className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-all">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
            <h3 className="text-md font-medium text-white truncate">{note.title}</h3>
            <p className="text-xs text-slate-500 truncate">{note.content_json[note.content_json.length-1]}</p>
            </div>
            <span className="text-xs text-slate-600 shrink-0">{ formatRelativeTime(note.created_at as string)}</span>
        </Link>
      </div>
    );
}

  export default function NotesPage() {
    const [docs, setDocs] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [pageNumber,setPageNumber] = useState(1)
    const [totalPages,setTotalPages] = useState(1)
    const resultsPerPage = 3
    const [sortBy, setSortBy] = useState('date');
    const [selectedSession, setSelectedSession] = useState(null);
    const [openFolderExplorer, setOpenFolderExplorer] = useState(false)
    const router = useRouter()
  
    
  

    // INSERT_YOUR_CODE

    // Helper function to fetch sessions from the API
    async function fetchDocs() {
      try {
        const res = await axios.post(
          `${SERVER_URL}/docs/`,
          {
            page: pageNumber,
            page_size: resultsPerPage,
          },
          {
            withCredentials: true,
            params:{
              page: pageNumber,
              page_size: resultsPerPage,
              search_query:searchQuery
            }
          }
        );
        if (res.status !== 200) throw new Error("Failed to fetch docs");
        const data = res.data;
        console.log(data)
        setDocs(data.docs);
        setTotalPages(data.pagination.total_pages)
        
      } catch (error) {
        console.error("Error fetching docs:", error);
        return [];
      }
    }

  


    useEffect(()=>{
      fetchDocs()
    },[pageNumber])

    useEffect(()=>{
      setPageNumber(1)
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
                  Notes
                </h1>
                <p className="text-slate-500 mt-1">Browse your notes</p>
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
            {docs.map((doc: Note) => (
              <NoteRow
                key={doc.id}
                note={doc}
              />
            ))}
          </div>
  
          {docs.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                <Search className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-400">No notes found</h3>
              <p className="text-slate-600 mt-1">Try adjusting your search or filters</p>
            </div>
          )}
    
            {/* Pagination Controls */}
            <Pagination totalPages={totalPages} currentPage={pageNumber} onPageChange={(p)=>setPageNumber(p)}></Pagination>
        </div>
      </div>
    );
  }