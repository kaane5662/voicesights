import React from "react"
import {
  CheckSquare,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Bold,
  Italic,
  Highlighter,
  Strikethrough,
  Sparkles,
  Loader2,
} from "lucide-react"
import { Editor, useEditorState } from "@tiptap/react"

type MenubarProps = {
  editor: Editor,
  onToggleAi:any,
  aiToggled:any,
  savingNote:boolean
}

const Menubar: React.FC<MenubarProps> = ({ editor, onToggleAi, aiToggled, savingNote }) => {
  if (!editor) {
    return null
  }
  const editorState = useEditorState({
    editor,
    selector: ctx => {
      return {
        isBold: ctx.editor.isActive('bold') ?? false,
        canBold: ctx.editor.can().chain().toggleBold().run() ?? false,
        isItalic: ctx.editor.isActive('italic') ?? false,
        canItalic: ctx.editor.can().chain().toggleItalic().run() ?? false,
        isStrike: ctx.editor.isActive('strike') ?? false,
        canStrike: ctx.editor.can().chain().toggleStrike().run() ?? false,
        isCode: ctx.editor.isActive('code') ?? false,
        canCode: ctx.editor.can().chain().toggleCode().run() ?? false,
        canClearMarks: ctx.editor.can().chain().unsetAllMarks().run() ?? false,
        isParagraph: ctx.editor.isActive('paragraph') ?? false,
        isHeading1: ctx.editor.isActive('heading', { level: 1 }) ?? false,
        isHeading2: ctx.editor.isActive('heading', { level: 2 }) ?? false,
        isHeading3: ctx.editor.isActive('heading', { level: 3 }) ?? false,
        isHeading4: ctx.editor.isActive('heading', { level: 4 }) ?? false,
        isHeading5: ctx.editor.isActive('heading', { level: 5 }) ?? false,
        isHeading6: ctx.editor.isActive('heading', { level: 6 }) ?? false,
        isTaskList: ctx.editor.isActive('taskList', { level: 6 }) ?? false,
        isBulletList: ctx.editor.isActive('bulletList') ?? false,
        isOrderedList: ctx.editor.isActive('orderedList') ?? false,
        isCodeBlock: ctx.editor.isActive('codeBlock') ?? false,
        isBlockquote: ctx.editor.isActive('blockquote') ?? false,
        canUndo: ctx.editor.can().chain().undo().run() ?? false,
        canRedo: ctx.editor.can().chain().redo().run() ?? false,
      }
    },
  })

  return (
    <div className="flex items-center self-center gap-1 w-fit justify-center bg-slate-800/70 px-2 py-1 rounded">
      {/* Paragraph */}
      <button
        className={`menubar-btn ${
          editor.isActive("paragraph") ? "bg-emerald-700 text-white" : "text-slate-200"
        } px-2 py-1 rounded`}
        onClick={() => editor.chain().focus().setParagraph().run()}
        aria-label="Paragraph"
        type="button"
      >
        <Pilcrow className="w-4 h-4" />
      </button>

      {/* Headings */}
      <button
        className={`menubar-btn ${
          editorState.isHeading1 ? "bg-emerald-700 text-white" : "text-slate-200"
        } px-2 py-1 rounded`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        aria-label="Heading 1"
        type="button"
      >
        <Heading1 className="w-4 h-4" />
      </button>
      <button
        className={`menubar-btn ${
          editorState.isHeading2 ? "bg-emerald-700 text-white" : "text-slate-200"
        } px-2 py-1 rounded`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        aria-label="Heading 2"
        type="button"
      >
        <Heading2 className="w-4 h-4" />
      </button>
      <button
        className={`menubar-btn ${
          editorState.isHeading3 ? "bg-emerald-700 text-white" : "text-slate-200"
        } px-2 py-1 rounded`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        aria-label="Heading 3"
        type="button"
      >
        <Heading3 className="w-4 h-4" />
      </button>

      {/* Bold */}
      <button
        className={`menubar-btn ${
          editorState.isBold ? "bg-emerald-700 text-white" : "text-slate-200"
        } px-2 py-1 rounded`}
        onClick={() => editor.chain().focus().toggleBold().run()}
        aria-label="Bold"
        type="button"
      >
        <Bold className="w-4 h-4" />
      </button>

      {/* Italic */}
      <button
        className={`menubar-btn ${
          editorState.isItalic ? "bg-emerald-700 text-white" : "text-slate-200"
        } px-2 py-1 rounded`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Italic"
        type="button"
      >
        <Italic className="w-4 h-4" />
      </button>

      {/* Highlight */}
      <button
        className={`menubar-btn ${
          editorState.isStrike ? "bg-yellow-300 text-slate-900" : "text-slate-200"
        } px-2 py-1 rounded`}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        aria-label="Strike"
        type="button"
      >
        <Strikethrough className="w-4 h-4" />
      </button>

      {/* Checkbox List (Task List) */}
      <button
        className={`menubar-btn ${
          editorState.isTaskList ? "bg-emerald-700 text-white" : "text-slate-200"
        } px-2 py-1 rounded`}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        aria-label="Checklist"
        type="button"
      >
        <CheckSquare className="w-4 h-4" />
      </button>
      {/* Ai gen */}
      <button
        className={`menubar-btn   flex gap-2 items-center ${
          aiToggled 
            ? "bg-emerald-700 text-white shadow-md"
            : "text-slate-200"
        } px-2 py-1 rounded`}
        onClick={()=>{onToggleAi(); } }
        aria-label="Checklist"
        type="button"
      >
        <Sparkles className="w-4 h-4" />
      
      </button>
    
    {/* Saving spinner or icon */}
    {savingNote && (
        <span className="ml-2 flex items-center gap-1 text-xs text-slate-400 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin" />
          Saving...
        </span>
    )}
    </div>
  )
}

export default Menubar

