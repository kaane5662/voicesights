"use client"
import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Play, Pause, Clock, Calendar, MessageSquare, Sparkles, Send, CheckSquare, FileText, ListTodo, Mail, Share2, Download, MoreHorizontal, Search, Bookmark, Zap, Brain, Mic, History, Globe, RefreshCcw } from 'lucide-react';
import { TranscriptEntry } from '@/components/sessions/TranscriptEntry';
import axios from 'axios';
import { useParams } from 'next/navigation';
import { ChatBrowse } from '@/components/popups/ChatBrowse';
import { AiSuggestion, ChatSession } from '@/app/interfaces';
import { SERVER_URL } from '@/const';



function ChatMessage({ message }:{message:any}) {
    const isUser = message.role === 'user';
    
    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[85%] p-3 rounded-2xl ${
          isUser 
            ? 'bg-violet-500/20 border border-violet-500/30 rounded-br-md' 
            : 'bg-white/5 border border-white/10 rounded-bl-md'
        }`}>
          {!isUser && (
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-400">AI Assistant</span>
            </div>
          )}
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }


export default function Chatbar(){
    // const [chatOpen, setChatOpen] = useState(false)
    const [chatInput, setChatInput] = useState('');
    // const [chatId, setChatId] = useState<number>(undefined)
    const [chatSession,setChatSession] = useState<ChatSession |null>()
    const chatScrollRef = useRef<HTMLDivElement>(null)
    const [messages, setMessages] = useState([
        { id: 1, role: 'assistant', content: 'Asks me anything' }
    ]);

    useEffect(()=>{
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    },[messages])

    
    // INSERT_YOUR_CODE
    // Helper function to save (update) the current chat session with new messages
    async function chatConversation() {
        try {

            setChatInput('')
            setMessages((prev)=>[...prev, {role:'user', content:chatInput} as any])
            setIsTyping(true)
            const response = await fetch(`${SERVER_URL}/chats/knowledge-base/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    messages: messages,
                    new_message: {role:"user", content:chatInput},
                    summaries:[]
                }),
            });
            if (!response.ok) throw new Error("Failed to save chat session messages");
            const data = await response.json();
            // Optionally update the local chat session/messages here after successful save
            setMessages(prev=>[...prev, data.message])
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
      
    }


    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef(null);
    return(
        <div className="w-full px-24 text-white h-screen border-l border-white/10 flex flex-col relative z-10 bg-slate-900/50">

        <div className="p-5 border-b border-white/10">
          <div className="flex gap-4 mb-3">
            <Globe className="w-6 h-6 text-violet-400" />
            <div className='flex flex-col gap-1'>
                <h2 className="text-xl font-semibold">Knowledge Base</h2>
                <p className="text-slate-400 text-sm">
                  Ask questions and get answers from your organization's transcripts, meeting notes, and documents—instantly synthesized from your collective knowledge.
                </p>
            </div>
            <button 
            onClick={resetChat}
            className="p-2 ml-auto rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"><RefreshCcw className="w-5 h-5 text-slate-400" /></button>
          </div>
          <div className="overflow-x-scroll [&::-webkit-scrollbar]:h-1 flex gap-2">
            {/* {suggestions.length > 0 && suggestions.map((suggestion, i) => (
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
            ))} */}
          </div>
        </div>

        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg,id) => <ChatMessage key={id} message={msg} />)}
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