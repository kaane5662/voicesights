import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Loader, Search, Sparkles, History } from "lucide-react";
import { SERVER_URL } from "@/const";
import { FileText, LayoutDashboard } from "lucide-react";
import Link from "next/link";

interface TranscriptSearchResult {
  content: string;
  metadata: {
    session_id: string;
    owner_id: string;
    [key: string]: any;
  };
  score: number;
}

interface SearchTranscriptsDropdownProps {
  // query: string;
  onSelect?: (result: TranscriptSearchResult) => void;
  onClose:()=>void
}


export const SearchContentDropdown: React.FC<SearchTranscriptsDropdownProps> = ({
  onClose,
  onSelect,
}) => {
  const [results, setResults] = useState<TranscriptSearchResult[]>([]);
  const [query, setQuery] = useState('')
  
  const [loading, setLoading] = useState(false);
  // Specify timer parameter for useRef
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  console.log("wtf")

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length === 0) {
      setResults([]);
      // setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      axios.post(
        `${SERVER_URL}/sessions/ai-search/`,
        { query },
        { withCredentials: true }
      )
        .then(res => {
          setResults(res.data.results || []);
          // setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    // Cleanup on query change
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = (result: TranscriptSearchResult) => {
    
    if (onSelect) onSelect(result);
  };

  // if (!open || (results.length === 0 && !loading)) return null;

  // Center the popup overlay in the middle of the viewport and update results for new schema
  

  // Helper for type-to-icon logic
  const getIconByItemType = (item_type: string) => {
    if (item_type === "doc") return <FileText className="w-5 h-5 text-blue-500" />;
    if (item_type === "session") return <LayoutDashboard className="w-5 h-5 text-violet-500" />;
    return <Sparkles className="w-5 h-5 text-slate-400" />;
  };

  // Helper for type-to-link logic
  const getLinkByItem = (result: TranscriptSearchResult) => {
    console.log(result)
    const { item_type, session_id, item_id } = result.metadata || {};
    if (item_type === "session" && session_id) {
      return `/sessions/${session_id}/view`;
    }
    if (item_type === "doc" && item_id) {
      return `/session/${session_id}/view?noteId=${item_id}`;
    }
    return undefined;
  };

  return (
    // Overlay background
    <div 
    
    onClick={e => {
      // Only trigger onClose if clicking the background, not inside the popup content
      if (e.target === e.currentTarget && onClose) {
        onClose();
      }
    }}
    
    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30">
      {/* Centered popup */}
      <div 
      
      className="bg-white shadow-2xl border border-slate-100 rounded-xl w-full max-w-lg max-h-[80vh] overflow-auto text-black text-sm relative mx-4">

        {/* Search Bar at the top */}
        <div className="top-0 bg-white rounded-t-xl z-10 px-4 py-3 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            // value={query}
            className="flex-1 outline-none border-0 bg-transparent placeholder:text-slate-400 text-sm"
            placeholder="Search transcripts or docs..."
        
            onChange={(e)=>setQuery(e.target.value)}
           
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 p-6 justify-center text-slate-500">
            <Loader className="w-4 h-4 animate-spin" />
            <span>Searching…</span>
          </div>
        ) : (
          <>
            {results.length === 0 ? (
              <div className="p-8 flex flex-col items-center gap-2 justify-center text-slate-400">
                <History className="w-8 h-8" />
                <span className="text-base">No results found.</span>
              </div>
            ) : (
              <div>
              {results.map((result, idx) => {
                const itemType = result.metadata.item_type || "session";
                const link = getLinkByItem(result);
                const shortId =
                  itemType === "session"
                    ? result.metadata.session_id?.slice(0, 8)
                    : (result.metadata.doc_id || "–––––––").slice(0, 8);
                const Icon = getIconByItemType(itemType);

                const content =
                  result.content.length > 80
                    ? result.content.slice(0, 80) + "…"
                    : result.content;

                const cardInner = (
                  <div className="w-full px-5 py-3 hover:bg-violet-50 focus:bg-violet-100 transition text-left flex items-start gap-4">
                    <span className="mt-0.5">{Icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate flex items-center gap-1">
                        <span className="text-xs font-bold rounded bg-slate-100 px-2 py-0.5 mr-2 text-slate-400 uppercase tracking-wide">
                          {itemType}
                        </span>
                        {content}
                      </div>
                      <div className="text-xs text-slate-500 flex justify-between mt-1">
                        <span>
                          {itemType === "session" ? "Session" : "Doc"}:&nbsp;
                          <span className="font-mono text-violet-700">
                            {shortId}
                          </span>
                        </span>
                        <span>
                          Score:&nbsp;
                          <span className="font-mono">{result.score.toFixed(3)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
                console.log('link',link)
                return link ? (
                  <Link
                    href={link}
                    // passHref
                    key={`${itemType}_${shortId}_${idx}`}
                    // className="block"
                  >
                    {cardInner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    tabIndex={0}
                    key={`${itemType}_${shortId}_${idx}`}
                    className="w-full text-left block"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleSelect(result);
                    }}
                  >
                    {cardInner}
                  </button>
                );
              })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SearchContentDropdown;

