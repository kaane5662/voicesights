import React, { useEffect, useRef } from "react"
import { Editor, useEditorState } from "@tiptap/react"
import { Sparkle } from "lucide-react"
import axios from "axios"
import { SERVER_URL } from "@/const"
import { createPortal } from "react-dom"

type AIGenerateProps = {
  editor: Editor
  // sessionId: string;
  // docId: string;
  sessionSummaries: string[];
  suggestions:Record<string,string>[]
  onClose:any;
}

const AIGenerate: React.FC<AIGenerateProps> = ({onClose, editor, sessionSummaries,suggestions }) => {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [input, setInput] = React.useState<string>("") // state for prompt
  const [position, setPosition] = React.useState<{ left: number, top: number } | null>(null)
  const divRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get the pixel position under the current cursor (selection) in the editor
  // Use the editor.state to find the position of the cursor and the corresponding DOM node to get the caret position
  function getCaretPositionInEditor(): { left: number, top: number } | null {
    const { from } = editor.state.selection;

    const coords = editor.view.coordsAtPos(from);
    const editorEl = editor.view.dom;
    const editorRect = editor.view.dom.getBoundingClientRect();

  // Popup size
    const popupRect = divRef.current?.getBoundingClientRect() || {width:1};
    let left = Math.max(
      editorRect.left,
      Math.min(coords.left, editorRect.right - popupRect.width)
    );
    return {
      top: coords.bottom,
      left,
    }
  }

  useEffect(() => {
    // Calculate and set position on mount and if the editor changes

    const pos = getCaretPositionInEditor();
    console.log(pos)
    setPosition(pos);

    // Optionally: Update on selection change
    function handleSelectionChange() {
      const pos = getCaretPositionInEditor();
      setPosition(pos);
    }
    if (inputRef.current) inputRef.current.focus();
    handleSelectionChange()
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [editor]);

  async function handleAIGenerate() {
    if (!editor) return
    setLoading(true)
    setError(null)
    try {
      

      const generated = `Here is an AI-generated suggestion for: "${input || "..." }". Replace this with your API output.`
      // INSERT_YOUR_CODE
      // Use axios to call the LLM docs endpoint for content generation
      // (Assumes you have axios installed; don't import here)
      // You may want to pass necessary data such as summaries, input, etc.
      const { $from } = editor.state.selection
      console.log('summary',sessionSummaries)
      const response = await axios.post(`${SERVER_URL}/docs/05i/block`, {
        input,
        summaries: sessionSummaries
        // you may need to provide summaries/context; update as needed
      },{withCredentials:true});

      // This assumes the API returns { result: "..." }
      let content = response.data.content
      // Insert at current position (under cursor)
      editor
        .chain()
        .focus()
        .insertContentAt($from.after(),content)
        .run()
      onClose()
    } catch (err: any) {
      setError(
        typeof err === "string"
          ? err
          : err?.message
            ? err.message
            : "Failed to generate AI text"
      )
    } finally {
      setLoading(false)
    }
  }

  // The AI prompt tab is absolutely positioned under the caret if possible
  return createPortal(
    <div
      ref={divRef}
      className="bg-slate-800"
      style={
        position
          ? {
              position: "absolute",
              left: position.left,
              top: position.top + 8, // some vertical offset
              zIndex: 50,
              
              boxShadow: "0px 3px 24px 0 rgba(0,0,0,0.11)",
              borderRadius: "6px",
              padding: "8px",
              minWidth: "400px",
              maxWidth: "400px"
            }
          : undefined
      }
    >
      <form
        onSubmit={e => {
          e.preventDefault()
          if (!loading) handleAIGenerate()
        }}
        className="flex flex-col text-white w-fit gap-1"
      >
        <input
          ref={inputRef}
          type="text"
          className="border border-gray-600 rounded px-2 py-1 text-xs w-full"
          placeholder="Describe what you want AI to write..."
          value={input}
          disabled={loading}
          onChange={e => setInput(e.target.value)}
        />
        
        {suggestions && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-700 hover:bg-slate-600 text-white text-xs transition-all"
                disabled={loading}
                onClick={() => {
                  setInput(s.prompt || "");
                  inputRef.current?.focus();
                }}
                title={s.prompt}
              >
                <Sparkle size={15} className="text-emerald-400" />
                {s.title || "Suggestion"}
              </button>
            ))}
          </div>
        )}
        <button
          className="px-3 ml-auto mt-4 rounded-full py-1 w-fit flex gap-2 justify-center items-center bg-emerald-600 text-white text-xs disabled:opacity-60"
          disabled={loading || !input.trim()}
          type="submit"
        >
          <Sparkle size={12} />
          {loading ? "Generating..." : "Generate"}
        </button>
      </form>
      {error && <div className="mt-2 text-red-600 text-xs">{error}</div>}
    </div>,
  document.querySelector('body') as any
  )
}
export default AIGenerate
