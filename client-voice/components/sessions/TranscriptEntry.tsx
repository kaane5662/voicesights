import { formatDuration } from "@/utils/dates";
import { Bookmark } from "lucide-react";

export function TranscriptEntry({ entry, isHighlighted, onBookmark }) {
    return (
      <div className={`group flex gap-4 p-3 rounded-xl transition-all ${
        isHighlighted ? 'bg-violet-500/10 border border-violet-500/30' : 'hover:bg-white/5'
      }`}>
        <div className="text-xs text-slate-500 font-mono w-12 shrink-0 pt-1">
          {formatDuration(entry.start_duration)}
        </div>
        <div className="flex-1">
          <p className="text-slate-300 leading-relaxed">{entry.text}</p>
        </div>
        <button 
          onClick={() => onBookmark(entry.id)}
          className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
            entry.bookmarked ? 'opacity-100 text-amber-400' : 'text-slate-500 hover:text-white'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${entry.bookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>
    );
  }