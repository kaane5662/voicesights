"use client"
import { FileText, Folder, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from "@tiptap/starter-kit";

import Heading from '@tiptap/extension-heading'
import '../../components/tiptap/styles.css'



// import "@tiptap/core/style.css";
// import "@tiptap/starter-kit/dist/style.css";

import Menubar from "../tiptap/Menubar";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import AIGenerate from "../tiptap/AIGenerate";
import { SERVER_URL } from "@/const";
import axios from "axios";
import { formatDate, formatRelativeTime } from "@/utils/dates";
import SelectFolderPopup from "../popups/SelectFolder";

// INSERT_YOUR_CODE

// Helper function to fetch all notes/docs (assumes endpoint /api/notes)
async function fetchNotes(): Promise<Note[]> {
  try {
    const res = await fetch('/api/notes');
    if (!res.ok) {
      throw new Error('Failed to fetch notes');
    }
    const data = await res.json();
    return data.notes || [];
  } catch (err) {
    console.error('Error fetching notes:', err);
    return [];
  }
}

// Helper function to fetch a single note/doc by ID (assumes endpoint /api/notes/:id)
async function fetchNoteById(id: string): Promise<Note | null> {
  try {
    const res = await fetch(`/api/notes/${id}`);
    if (!res.ok) {
      throw new Error('Failed to fetch note');
    }
    const data = await res.json();
    return data.note || null;
  } catch (err) {
    console.error(`Error fetching note ${id}:`, err);
    return null;
  }
}

// Helper function to save/update a note (assumes endpoint /api/notes/:id and PATCH)
async function saveNote(note: Note): Promise<boolean> {
  try {
    const res = await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note),
    });
    return res.ok;
  } catch (err) {
    console.error('Error saving note:', err);
    return false;
  }
}

// Helper function to create a new note (assumes endpoint /api/notes and POST)
async function createNote(note: Omit<Note, 'id' | 'created_at'>): Promise<Note | null> {
  try {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note),
    });
    if (!res.ok) {
      throw new Error('Failed to create note');
    }
    const data = await res.json();
    return data.note || null;
  } catch (err) {
    console.error('Error creating note:', err);
    return null;
  }
}

// Helper function to delete a note (assumes endpoint /api/notes/:id and DELETE)
async function deleteNote(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.error('Error deleting note:', err);
    return false;
  }
}


interface Note {
    id?: string;
    title: string;
    content_json?: string;
    created_at: string;
  }


export default function NotesSidebar({
  onClose,
  sessionSummaries,
  sessionId,
  docSuggestions,
  defaultNoteId
}: {
  onClose: () => void;
  sessionSummaries: any[];
  docSuggestions: any[];
  sessionId: string;
  defaultNoteId?:string;
}) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [activeNote, setActiveNote] = useState<Note>();
     // Cooldown ref to prevent excessive revectorization
    const revectorizeCooldownRef = useRef<NodeJS.Timeout | null>(null);
    const [selectedNoteId,setSelectedNoteId] = useState('-1')
    const [creatingNote,setCreatingNote] = useState(false)
    const [aiGenerate,setAiGenerate] = useState(false)
    const timerRef = useRef(0)
    const [savingNote,setSavingNote] = useState(false)
    const [openFolderExplorer,setOpenFolderExplorer] = useState(false)
    const editor = useEditor({
        
        //   HEading.configure({ levels: [1, 2, 3] }),
        //   TaskList,
        //   TaskItem.configure({ nested: false }),],
        // content: '<p>Hello World! 🌎️</p>',
        onUpdate: ()=>{
        // INSERT_YOUR_CODE

        // Function to perform revectorization, called after cooldown
        const revectorizeDoc = async () => {
          if (!activeNote?.id) return;
          try {
            const content_json = editor?.getJSON();
            await fetch(`${SERVER_URL}/docs/${sessionId}/${activeNote.id}/vectorize`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ content_json }),
              credentials: "include"
            });
          } catch (err) {
            console.error("Error revectorizing note:", err);
          }
        };

        // On editor update, set cooldown timer
        if (revectorizeCooldownRef.current) {
          clearTimeout(revectorizeCooldownRef.current);
        }
        revectorizeCooldownRef.current = setTimeout(() => {
          revectorizeDoc();
        }, 5000);

        },
        extensions: [
            StarterKit.configure({
                heading: false,   // IMPORTANT: disable built-in heading
              }),
              Heading.configure({
                levels: [1, 2, 3],
              }),
              TaskList,
              TaskItem.configure({
                nested: false,
              }),
        ],
        
        immediatelyRender: false,
        editorProps: {
            attributes: {
              spellcheck: 'true',
            },
          },
       
    }) as Editor

    async function fetchNotes() {
        
        try {
          const res = await fetch(`${SERVER_URL}/docs/${sessionId}`, { credentials: "include" });
          if (!res.ok) {
            throw new Error('Failed to fetch notes');
          }
          const data = await res.json();
          setNotes(data.docs)
        } catch (err) {
          console.error('Error fetching notes:', err);
          return [];
        }
      }
      
    // Helper function to fetch a single note/doc by ID (assumes endpoint /api/notes/:id)
    async function fetchNoteById(id: string) {
    try {
        if(!id) return
        const res = await fetch(`${SERVER_URL}/docs/${sessionId}/${id}`);
        if (!res.ok) {
        throw new Error('Failed to fetch note');
        }
        const data = await res.json();
        setActiveNote(data.doc)
        // INSERT_YOUR_CODE
        if (editor && data.doc && data.doc.content_json) {
        editor.commands.setContent(data.doc.content_json);
        }
    } catch (err) {
        console.error(`Error fetching note ${id}:`, err);
        return null;
    }
    }

    // INSERT_YOUR_CODE
    // Delete note by ID
    async function deleteNoteById(id: string) {
      try {
        if (!id) return false;
        const res = await axios.delete(`${SERVER_URL}/docs/${id}/delete/`, {
          // data: {}, // some backends require this for DELETE with JSON body
          withCredentials: true,
        });
        
        setNotes(prevNotes => prevNotes.filter(note => note.id !== id));
        if (activeNote && activeNote.id === id) setActiveNote(null);
        // return true;
        
      } catch (err) {
        console.error("Error deleting note:", err);
        return false;
      }
    }

    async function createNote() {
        setCreatingNote(true)
        try{
        let created_at = activeNote.created_at
        // INSERT_YOUR_CODE
        // Ensure editor has content, not just whitespace, before creating note
        const html = editor.getHTML && editor.getHTML();
        if (!html || !html.replace(/<[^>]*>/g, '').trim()) {
          // Content is empty or only whitespace/tags
          return false;
        }
        const res = await axios.post(`${SERVER_URL}/docs/${sessionId}`, {
            input_html: editor.getHTML(),
            input_json: editor.getJSON()
        },{withCredentials:true});
        setActiveNote(res.data.doc)
        // INSERT_YOUR_CODE
        setNotes(prevNotes =>
          prevNotes.map(note =>
            note.created_at === created_at ? { ...note, ...res.data.doc } : note
          )
        );
        
            
        }catch (err) {
          console.error('Error saving note:', err);
          return false;
        }finally{setCreatingNote(false)}
    }

    async function saveNote() {

        setSavingNote(true)
        try {
          
          console.log("Saving")
          if(!activeNote || creatingNote) return
          if(!activeNote.id) return createNote()
          
          // INSERT_YOUR_CODE
          // Get the current editor content as tiptap JSON
          const editorContent = editor.getJSON ? editor.getJSON() : editor.getHTML();
          const res = await axios.post(`${SERVER_URL}/docs/${sessionId}/${activeNote.id}/save`, {
            content_json: editorContent
          },{withCredentials:true});
          
        } catch (err) {
          console.error('Error saving note:', err);
          return false;
        } finally{
            setSavingNote(false)
        }
    }



    
    const handleNewNote = () => {
      const newNote: Note = {
        title: 'Untitled Note',
        created_at: (new Date()).toISOString()
      };
      
      // INSERT_YOUR_CODE
      if (editor && editor.commands) {
        editor.commands.setContent('');
        editor.commands.focus();
      }
      setNotes([newNote, ...notes]);
      setActiveNote(newNote);
    };

    useEffect(()=>{
        console.log('summaries',sessionSummaries)
        fetchNotes()
        
    },[])

    useEffect(()=>{
        console.log('new render')
        if(defaultNoteId){
            fetchNoteById(defaultNoteId)
        }
    },[editor])
    
    


    return (
      <div className="w-full h-screen max-h-screen border-r border-white/10 flex flex-col bg-slate-900/50">
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span className="font-medium text-white text-sm">Notes</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleNewNote} className="p-1 rounded hover:bg-white/10 text-slate-400">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* popups */}

  
        {/* Notes List */}
        <div className="p-2 border-b border-white/10 space-y-1 max-h-40 overflow-y-auto">
          {notes.map((note,k) => (
            <button
              key={k}
              onClick={() => fetchNoteById(note.id as any)}
              className={`w-full group flex justify-between relative text-left p-2 rounded-lg transition-all ${
                activeNote?.id === note.id
                  ? 'bg-violet-500/20 border border-violet-500/30'
                  : 'hover:bg-white/5'
              }`}
            >
              <div className="flex flex-col gap-0">

                <p className="text-sm font-medium text-white truncate">{note.title}</p>
                <p className="text-xs text-slate-500">{formatRelativeTime(note.created_at)}</p>
              </div>
              <div className="flex gap-2">
      
                
                <button
                  className="p-1 rounded hover:bg-rose-800/90 transition opacity-0 group-hover:opacity-100"
                  title="Delete note"
                  onClick={e => {
                    e.stopPropagation();
                    deleteNoteById(note.id as any);
                  }}
                >
                  <X size={12} className="text-rose-300" />
                </button>
                
                <button
                  onClick={() =>{ setOpenFolderExplorer(true) ;setSelectedNoteId(activeNote?.id)}}
                  className="p-1 rounded  hover:bg-slate-800 transition"
                  title="Move to folder"
                >
                  <Folder size={12} className="text-violet-300 " />
                </button>
              </div>
              
              {openFolderExplorer &&(
                <SelectFolderPopup
                selectedResource={{
                    resourceId: selectedNoteId as string,
                    resourceType:'doc'
                }}
                onClose={()=>setOpenFolderExplorer(false)}
                />
              )}
            
            </button>
          ))}
        </div>
        {/* Editor Toolbar */}
        {activeNote &&(

          <div
            className="p-4 mt-auto"
            tabIndex={0}
            onKeyDown={e => {
              // Toggle AI Generate on Ctrl+K or Cmd+K
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setAiGenerate(prev => !prev);
              }
            }}
          >
              {aiGenerate &&(
                
                <AIGenerate
                
                 sessionSummaries={sessionSummaries} suggestions={docSuggestions} onClose={()=>setAiGenerate(false)} editor={editor}></AIGenerate>
                
              )}
              <div className="w-full self-center flex items-center justify-center">
                <Menubar savingNote={savingNote} aiToggled={aiGenerate} onToggleAi ={()=>setAiGenerate(!aiGenerate)} editor={editor}></Menubar>
              </div>
              <div className=" h-[400px] overflow-y-scroll">

                  
                    <EditorContent
                      className="editor"
                      editor={editor}
                      onFocus={() => {
                        // Keep track of timerRef in parent component state or a useRef
                        // We'll assume timerRef is defined: const timerRef = useRef<NodeJS.Timeout | null>(null);
                        if (timerRef.current) {
                          clearTimeout(timerRef.current);
                          timerRef.current = null;
                        }
                      }}
                      // Save on "stop typing" (debounce), NOT on blur
                      onKeyUp={e => {
                        if (timerRef.current) {
                          clearTimeout(timerRef.current);
                          timerRef.current = null;
                        }
                        timerRef.current = window.setTimeout(async () => {
                          if (editor && activeNote) {
                            await saveNote();
                          }
                        }, 300);
                      }}
                      onBlur={e => {
                        if (timerRef.current) {
                          clearTimeout(timerRef.current);
                          timerRef.current = null;
                        }
                        timerRef.current = window.setTimeout(async () => {
                          if (editor && activeNote) {
                            await saveNote();
                          }
                        }, 300);
                      }}
                    />
                  
              </div>
          </div>
        )}
  
        
      </div>
    );
  }