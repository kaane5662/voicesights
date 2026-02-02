"use client"
import { useState, useRef, useEffect, act } from 'react';
import { ArrowLeft, Play, Pause, Clock, Calendar, MessageSquare, Sparkles, Send, CheckSquare, FileText, ListTodo, Mail, Share2, Download, MoreHorizontal, Search, Bookmark, Zap, Brain, Mic, History, NotebookIcon, Folder } from 'lucide-react';
import { TranscriptEntry } from '@/components/sessions/TranscriptEntry';
import axios from 'axios';
import { notFound, useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChatBrowse } from '@/components/popups/ChatBrowse';
import Chatbar from '@/components/chat/Chatbar';
import { SERVER_URL } from '@/const';
import { Session } from '@/app/interfaces';
import LoadingScreen from '@/components/ui/LoadingScreen';
import NotesSidebar from '@/components/docs/NotesSidebar';
import Resizeable from '@/components/ui/Resizeable';
import SelectFolderPopup from '@/components/popups/SelectFolder';
// import { Session } from 'inspector/promises';
import SessionRecord from '@/components/sessions/SessionRecord';




export default function TranscriptDetail() {
  const {id} = useParams()
  const [searchQuery, setSearchQuery] = useState('');
  const searchParams = useSearchParams();
  const noteId = searchParams.get('noteId');
  const chatId = searchParams.get('chatId');
  const [activeSidebar, setActiveSidebar] = useState<string | null>(() => {
    if (noteId) return 'notes';
    if (chatId) return 'chat';
    return null;
  });
  const [isLoading,setIsLoading] = useState(true)
  const router = useRouter()
  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', content: 'I\'ve analyzed this transcript. You discussed Q1 priorities, mobile app redesign, and resource allocation. How can I help you with this session?' }
  ]);
  const chatEndRef = useRef(null);
  const [session,setSession] = useState<Session>()
  const [openFolderExplorer,setOpenFolderExplorer]= useState(false)
  const [openRecord,setOpenRecord] = useState(false)
  const transcriptScrollRef = useRef<HTMLElement>(null)


  // INSERT_YOUR_CODE
  // Helper function to get the current transcript using axios
  
  const [transcript, setTranscript] = useState([]);

  


  // INSERT_YOUR_CODE
  // Axios function to fetch session by ID
  

  const presets = [
    { icon: Calendar, label: 'Add to Calendar', description: 'Create events from items', color: 'cyan' },
    { icon: CheckSquare, label: 'Convert to Tasks', description: 'Extract to todo list', color: 'emerald' },
    { icon: FileText, label: 'Summary Notes', description: 'Generate meeting notes', color: 'violet' },
    { icon: Mail, label: 'Draft Follow-up', description: 'Create follow-up email', color: 'amber' },
    { icon: ListTodo, label: 'Action Items', description: 'List all action items', color: 'rose' },
    { icon: Brain, label: 'Key Insights', description: 'Extract key decisions', color: 'fuchsia' },
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatDuration = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const toggleBookmark = (id) => {
    setTranscript(transcript.map(e => e.id === id ? { ...e, bookmarked: !e.bookmarked } : e));
  };

  

  const filteredTranscript = transcript.filter(e => 
    e.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchSession = async () => {
    try {
      setIsLoading(true)
      console.log(id, 'grabbing thing')
      const response = await axios.get(`${SERVER_URL}/sessions/${id}`);
      setSession(response.data.session)
      setTranscript(response.data.session.transcript)
    } catch (error) {
      console.error('Failed to fetch session:', error);
      return null;
    } finally {
      setIsLoading(false)
    }
  };

  
  useEffect(() => {
    if (!isLoading && transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcript]);

  useEffect(()=>{
    fetchSession()
  },[])
  

  if (isLoading) {
    return (
      <LoadingScreen loadingText='Loading session details ...'></LoadingScreen>
    )
  }

  if(!session){
    return(
      notFound()
    )
  }

  

  

  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex">
      {/* popups */}
      {openFolderExplorer &&(
        <SelectFolderPopup
          selectedResource={{
            resourceId: session.id,
            resourceType:'session'
        }}
        onClose={()=>setOpenFolderExplorer(false)}
        />
      )}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

     
      {/* Transcript Panel */}
      <div className="flex-1 flex flex-col relative z-10">
        <header className="p-4 border-b border-white/10">
          <div className="flex items-center gap-4 mb-4">
            <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{session.title}</h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(session.created_at)}</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDuration(session.total_duration)}</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />{session.word_count} words</span>
              </div>
            </div>
            <button 
            onClick={()=>setOpenFolderExplorer(true)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"><Folder className="w-5 h-5 text-slate-400" /></button>
            <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"><Share2 className="w-5 h-5 text-slate-400" /></button>
            <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"><Download className="w-5 h-5 text-slate-400" /></button>
            <button 
            onClick={()=>setOpenRecord(!openRecord)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"><Mic className="w-5 h-5 text-slate-400" /></button>
          </div>
          {openRecord &&(
            <div className={` duration-300 border-t-2 border-white/10`}>

            <SessionRecord session={session} onTranscribed={(obj:any)=>setTranscript(prev=>[...prev,obj])}/>
            </div>

          )}
          <div className="flex items-center gap-4">
            {/* <button onClick={() => setIsPlaying(!isPlaying)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 hover:bg-violet-500/30">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span className="text-sm">{isPlaying ? 'Pause' : 'Play'}</span>
            </button> */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transcript..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <button 
            onClick={() => setActiveSidebar(activeSidebar == 'notes' ? null : 'notes')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-400">
              <NotebookIcon className="w-4 h-4" /> Notes
            </button>
            <button 
            onClick={() => setActiveSidebar(activeSidebar == 'chat' ? null : 'chat')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-400">
              <Sparkles className="w-4 h-4" /> Chat
            </button>
          </div>
        </header>

        <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto p-4">
          <div className="w-full mx-auto space-y-1">
            {transcript.map((entry,id) => (
              <TranscriptEntry
                key={id}
                entry={entry}
                isHighlighted={searchQuery && entry.text.toLowerCase().includes(searchQuery.toLowerCase())}
                onBookmark={toggleBookmark}
              />
            ))}
          </div>
        </div>
      </div>

      

      {/* Notes Sidebar */}
      {/* Resizable Notes Sidebar */}
      {/* Notes Sidebar State Logic */}
      {/*
        We'll keep the state for the NotesSidebar open/close here, and handle the sidebar logic.
        For basic open/close, let's use a simple boolean.
      */}
      
          {/* TODO: Implement <ResizableSidebar> or use a normal div for now */}
       

        {activeSidebar === 'notes' && (
          <Resizeable 
          minWidth={400} maxWidth={800} defaultWidth={400}
          className="border-l-2 border-white/10 transition-colors duration-150 hover:border-white/20">
            <NotesSidebar 
            
            docSuggestions={session?.doc_suggestions || []}
              defaultNoteId = {noteId}
              sessionSummaries={session?.summaries || []} 
              sessionId={session.id}
              onClose={() => setActiveSidebar('')} // You can wire this to feed up to parent if wanted
            />
          </Resizeable>
        )}
        {activeSidebar === 'chat' && (
          <Resizeable 
          minWidth={300} maxWidth={500} defaultWidth={400}
          className="border-l-2 border-white/10 transition-colors duration-150 hover:cursor-ew-resize hover:border-white/20">
            <Chatbar 
            
            suggestions={session.chat_suggestions || []}
            defaultChatId={chatId}
            sessionSummaries={session?.summaries || []} sessionId={session.id}/>
          </Resizeable>
        )}
        
       
      
      
    </div>
  );
}