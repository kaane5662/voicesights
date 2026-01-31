
import { useEffect, useState } from 'react';
import { X, Plus, MessageSquare, Clock, ChevronRight, Search, Sparkles, Trash2, MoreHorizontal, Mic, Folder } from 'lucide-react';
import axios from 'axios';
import { ChatSession } from '@/app/interfaces';
import { SERVER_URL } from '@/const';
import SelectFolderPopup from './SelectFolder';

const mockChats = [
  {
    id: 1,
    title: 'Product Roadmap Discussion',
    preview: 'Create Google Calendar events for any meetings or deadlines mentioned...',
    timestamp: '2 min ago',
    messageCount: 12,
    hasAI: true,
  },
  {
    id: 2,
    title: 'Q1 Planning Session',
    preview: 'Extract all action items as a todo list from the transcript...',
    timestamp: '1 hour ago',
    messageCount: 8,
    hasAI: true,
  },
  {
    id: 3,
    title: 'Customer Interview Notes',
    preview: 'What were the main pain points mentioned by the customer?',
    timestamp: '3 hours ago',
    messageCount: 15,
    hasAI: true,
  },
  {
    id: 4,
    title: 'Weekly Standup',
    preview: 'Generate meeting notes with key points and decisions...',
    timestamp: 'Yesterday',
    messageCount: 6,
    hasAI: true,
  },
  {
    id: 5,
    title: 'Design Review Feedback',
    preview: 'Summarize the feedback on the new onboarding flow...',
    timestamp: 'Yesterday',
    messageCount: 9,
    hasAI: true,
  },
  {
    id: 6,
    title: 'Engineering Sync',
    preview: 'List all technical decisions made in this meeting...',
    timestamp: '2 days ago',
    messageCount: 11,
    hasAI: true,
  },
];

function ChatListItem({ chat, onSelect, onDelete, sessionId }) {
  // const [openFolderExplorer, setOpenFolderExplorer] = useState(false);

  return (
    <div
      className="group relative flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all"
      onClick={() => onSelect(chat)}
    >
      
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
        <MessageSquare className="w-5 h-5 text-violet-400" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-white truncate">{chat.title}</h3>
          {chat.hasAI && <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
        </div>
        <p className="text-sm text-slate-500 truncate">{chat.timestamp}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right opacity-100 group-hover:opacity-0 transition-opacity">
          <p className="text-xs text-slate-500">{chat.created}</p>
          <p className="text-xs text-slate-600">{chat.messageCount} messages</p>
        </div>
        
        <div className="absolute right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={()=>setOpenFolderExplorer(true)}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-100 transition-all"
          >
            <Folder className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(chat.id); }}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-500 hover:text-rose-400 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </div>
      </div>
    </div>
  );
}

export function ChatBrowse({ onClose, onSelectChat, onNewChat, sessionId }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState(mockChats);
  const [recentMessages,setRecentMessages] = useState<ChatSession[]>([])
  const [otherMessages, setOtherMessages] = useState<ChatSession[]>([])


  
  // if (!isOpen) return null;

  // const filteredChats = chats.filter(chat =>
  //   chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
  //   chat.preview.toLowerCase().includes(searchQuery.toLowerCase())
  // );

  const handleDelete = (id) => {
    setChats(chats.filter(c => c.id !== id));
  };

  // INSERT_YOUR_CODE
  // Helper function to fetch chat messages by session id (and optionally chat id)
  async function fetchChatMessages() {
    try {
      

      const response = await axios.get(`${SERVER_URL}/chats/${sessionId}`);
      let chatMessages = response.data.chats as ChatSession[]
      let other:ChatSession[] = []
      let recent:ChatSession[] = []
      const minus24Hours = Date.now() - 24 * 60 * 60 * 1000
      for(let c of chatMessages){
        if( new Date(c.created_at).getTime() >= minus24Hours){
          recent.push(c)
        }else{
          other.push(c)
        }
      }
      
      setRecentMessages(recent)
      setOtherMessages(other)
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      return [];
    }
  }

  useEffect(()=>{
    fetchChatMessages()
  },[])


  


  // const groupedChats = {
  //   recent: filteredChats.filter(c => c.timestamp.includes('min') || c.timestamp.includes('hour')),
  //   yesterday: filteredChats.filter(c => c.timestamp === 'Yesterday'),
  //   older: filteredChats.filter(c => c.timestamp.includes('days')),
  // };

  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Chat History</h2>
              <p className="text-sm text-slate-500">Continue a conversation or start fresh</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-400 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New Chat CTA */}
          <button
            onClick={onNewChat}
            className="w-full p-4 rounded-xl bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 hover:border-violet-400/50 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:scale-105 transition-transform">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-white">Start New Chat</h3>
                <p className="text-sm text-slate-400">Begin a fresh conversation with your transcript</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 ml-auto group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        {/* Search */}
        {/* <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-all"
            />
          </div>
        </div> */}

        {/* Chat List */}
        <div className="max-h-96 overflow-y-auto">
          {recentMessages.length > 0 ? (
            <div className="p-2">
              {recentMessages.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Recent</p>
                  {recentMessages.map((chat) => (
                    <ChatListItem
                      key={chat.id}
                      onSelect={()=>onSelectChat(chat)}
                      chat={chat}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
              
              {otherMessages.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Other</p>
                  {otherMessages.map((chat) => (
                    <ChatListItem
                      key={chat.id}
                      chat={chat}
                      onSelect={()=>onSelectChat(chat)}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
              
              {/* {groupedChats.older.length > 0 && (
                <div>
                  <p className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Previous</p>
                  {groupedChats.older.map((chat) => (
                    <ChatListItem
                      key={chat.id}
                      chat={chat}
                      onSelect={onSelectChat}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )} */}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-slate-400">No conversations found</p>
              <p className="text-sm text-slate-600 mt-1">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">{chats.length} conversations</span>
            <button className="text-violet-400 hover:text-violet-300 transition-colors">
              View all history
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}