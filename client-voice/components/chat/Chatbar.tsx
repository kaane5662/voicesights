"use client"
import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Play, Pause, Clock, Calendar, MessageSquare, Sparkles, Send, CheckSquare, FileText, ListTodo, Mail, Share2, Download, MoreHorizontal, Search, Bookmark, Zap, Brain, Mic, History } from 'lucide-react';
import { TranscriptEntry } from '@/components/sessions/TranscriptEntry';
import axios from 'axios';
import { useParams } from 'next/navigation';
import { ChatBrowse } from '@/components/popups/ChatBrowse';
import { AiSuggestion, ChatMessage as ChatMessageType, ChatSession } from '@/app/interfaces';
import { SERVER_URL } from '@/const';
import { ChatsList } from './ChatsList';
import {
  AuthErrorView,
  LinearTeamsView,
  LinearIssuesView,
  GoogleCalendarsView,
  GoogleCalendarEventsView,
  GoogleSheetRowsView,
  SlackChannelsView,
  SlackMessageView,
  GraphitiSearchView,
  TextContentView
} from './ChatMessageViews';

const presets = [
    { icon: Calendar, label: 'Add to Calendar', description: 'Create events from items', color: 'cyan' },
    { icon: CheckSquare, label: 'Convert to Tasks', description: 'Extract to todo list', color: 'emerald' },
    { icon: FileText, label: 'Summary Notes', description: 'Generate meeting notes', color: 'violet' },
    { icon: Mail, label: 'Draft Follow-up', description: 'Create follow-up email', color: 'amber' },
    { icon: ListTodo, label: 'Action Items', description: 'List all action items', color: 'rose' },
    { icon: Brain, label: 'Key Insights', description: 'Extract key decisions', color: 'fuchsia' },
  ];


function ChatMessageItem({ message }:{message: ChatMessageType}) {
    const isUser = message.role === 'user';
    const msgType = message.type || 'text';

    const renderContent = () => {
      if (isUser) {
        return <TextContentView content={message.content} />;
      }

      switch (msgType) {
        case 'auth_error':
          return <AuthErrorView data={message.data} message={message.content} />;
        case 'linear_teams':
          return <LinearTeamsView data={message.data} message={message.content} />;
        case 'linear_issues':
          return <LinearIssuesView data={message.data} message={message.content} />;
        case 'google_calendars':
          return <GoogleCalendarsView data={message.data} message={message.content} />;
        case 'google_calendar_events':
          return <GoogleCalendarEventsView data={message.data} message={message.content} />;
        case 'google_sheet_rows':
          return <GoogleSheetRowsView data={message.data} message={message.content} />;
        case 'slack_channels':
          return <SlackChannelsView data={message.data} message={message.content} />;
        case 'slack_message':
          return <SlackMessageView data={message.data} message={message.content} />;
        case 'graphiti_search':
          return <GraphitiSearchView data={message.data} message={message.content} />;
        case 'text':
        default:
          return <TextContentView content={message.content} />;
      }
    };

    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[90%] p-3 rounded-2xl ${
          isUser 
            ? 'bg-violet-500/20 border border-violet-500/30 rounded-br-md text-slate-100' 
            : msgType === 'auth_error'
              ? 'bg-transparent border-none p-0 w-full max-w-[95%]'
              : msgType !== 'text'
                ? 'bg-slate-900/90 border border-white/10 rounded-bl-md w-full max-w-[95%]'
                : 'bg-white/5 border border-white/10 rounded-bl-md'
        }`}>
          {!isUser && msgType === 'text' && (
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-400">AI Assistant</span>
            </div>
          )}
          {renderContent()}
        </div>
      </div>
    );
  }


export default function Chatbar({sessionId, sessionSummaries, defaultChatId,suggestions}:
  {sessionId:string, sessionSummaries:string[], defaultChatId?:string,suggestions:AiSuggestion[]}){
    const [chatOpen, setChatOpen] = useState(false)
    const [chatInput, setChatInput] = useState('');
    // const [chatId, setChatId] = useState<number>(undefined)
    const [chatSession,setChatSession] = useState<ChatSession |null>()
    const chatScrollRef = useRef<HTMLDivElement>(null)
    const [messages, setMessages] = useState<ChatMessageType[]>([
        { role: 'assistant', content: 'I\'ve analyzed this transcript. You discussed Q1 priorities, mobile app redesign, and resource allocation. How can I help you with this session?', type: 'text' }
    ]);

    useEffect(()=>{
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    },[messages])

    // Helper function to fetch chat messages for a session by id
    async function fetchSessionMessages(chatData:ChatSession) {
        try {
            const res = await axios.get(`${SERVER_URL}/chats/${sessionId}/${chatData.id}`,{withCredentials:true});
            setChatSession(res.data.chat)
            setMessages(res.data.chat.messages || [])
            setChatOpen(false)
        } catch (error) {
            console.error('Error fetching session messages:', error);
            return [];
        }
    }

    
    useEffect(()=>{
      if(defaultChatId){
        fetchSessionMessages({id:defaultChatId} as any)
      }
      if(chatInput.trim().length > 0)
        chatConversation()
    },[])

    // Helper function to create a new chat session
    async function createChatSession() {
        try {
            const response = await fetch(`${SERVER_URL}/chats/${sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    chat_input:chatInput
                }),
            });
            if (!response.ok) throw new Error("Failed to create chat session");
            const data = await response.json();
            setChatSession(data.chat)
            return data.chat;
        } catch (error) {
            console.error('Error creating chat session:', error);
            return null;
        }
    }  
    
    // Helper function to save (update) the current chat session with new messages
    async function chatConversation() {
        if (!chatInput.trim()) return;
        const currentInput = chatInput;
        try {
            setChatInput('')
            setIsTyping(true)
            setMessages((prev)=>[...prev, {role:'user', content: currentInput, type: 'text'}])
            let created = false;
            let newChat = null
            if(!chatSession){
                newChat = await createChatSession()
                if(!newChat) return
                created = true
            } 
            
            const targetChatId = created ? newChat.id : chatSession?.id;
            const response = await fetch(`${SERVER_URL}/chats/${targetChatId}/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    messages: messages,
                    new_message: {role: "user", content: currentInput, type: "text"},
                    summaries: sessionSummaries || []
                }),
            });
            if (!response.ok) throw new Error("Failed to save chat session messages");
            const data = await response.json();
            if (data?.message) {
              setMessages(prev=>[...prev, data.message])
            }
        } catch (error) {
            console.error('Error saving chat session:', error);
            return null;
        }finally{
          setIsTyping(false)
        }
    }

    async function resetChat(){
      setMessages([])
      setChatSession(null)
      setChatOpen(false)
    }

    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    return(
        <div className="w-full h-screen border-l border-white/10 flex flex-col relative z-10 bg-slate-900/50">

        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-violet-400" />
            <h2 className="font-semibold w-full max-h-5 overflow-hidden whitespace-nowrap">{chatSession?.title || "New Chat"}</h2>
            <div className='relative flex flex-col'>
              <button 
              onClick={()=>setChatOpen(!chatOpen)}
              className="p-2 ml-auto rounded-xl bg-white/5 hover:bg-white/10 border border-white/10">
                <History className="w-5 h-5 text-slate-400" />
              </button>
              {chatOpen&&(
                <ChatsList
                  sessionId={sessionId}
                  onNewChat={resetChat}
                  onSelectChat={fetchSessionMessages}
                  onClose={()=>setChatOpen(false)}
                />
              )}
            </div>
          </div>
          <div className="overflow-x-scroll [&::-webkit-scrollbar]:h-1 flex gap-2">
            {suggestions.length > 0 && suggestions.map((suggestion, i) => (
              <button
                key={i}
                type="button"
                className="px-3 py-2 rounded-lg items-center flex gap-2 bg-slate-800 text-xs text-white hover:bg-violet-700 transition-colors border border-white/10 min-w-[200px] text-left h-14"
                onClick={() => setChatInput(suggestion.prompt || "")}
                title={suggestion.title || suggestion.prompt || ""}
              >
                <Sparkles className=' text-emerald-300' size={15}/>  
                <p>{suggestion.title || suggestion.prompt || `Suggestion ${i+1}`}</p>          
              </button>
            ))}
          </div>
        </div>

        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, id) => <ChatMessageItem key={id} message={msg} />)}
          {isTyping && (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              Thinking...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        
        <div className="p-4 border-t border-white/10">
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && chatInput.trim()) {
                  chatConversation();
                }
              }}
              placeholder="Ask about this transcript..."
              className="flex-1 px-4 py-2 text-sm rounded-xl bg-white/5 border border-white/10 placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
            />
            <button 
              onClick={chatConversation}
              disabled={!chatInput.trim()}
              className="p-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:opacity-90 disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    )
}
