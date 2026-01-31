// INSERT_YOUR_CODE
"use client";

import { useEffect, useState } from "react";
import { SERVER_URL } from "@/const";
import axios from "axios";
import { Folder as FolderIcon, Loader2, ArrowLeft, X } from "lucide-react";
import DeleteFolderPopup from "@/components/popups/DeleteFolder";

type FolderContentItem = {
  id: string;
  title: string;
  owner_id: string;
  created_at?: string;
  parent_id?: string | null;
  folder_id?: string;
  session_id?: string;
  content_json?: Record<string, any>;
  type: "folder" | "chat" | "doc" | "session";
};

export default function FoldersPage() {
  // This stack tracks [folderId, folderTitle]
  const [stack, setStack] = useState<Array<{ id: string; title: string }>>([
    { id: "root", title: "All Folders" }
  ]);
  const currentFolder = stack[stack.length - 1];
  const [content, setContent] = useState<FolderContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [createFolderLoading, setCreateFolderLoading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [folderToDelete,setFolderToDelete] = useState<FolderContentItem|null>()
  async function fetchFolderContent(folderId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${SERVER_URL}/folders/${folderId}/content`, {
        withCredentials: true,
      });
      if (res.status === 200 && res.data?.content) {
        setContent(res.data.content);
      } else {
        setContent([]);
      }
    } catch (e) {
      setError("Failed to fetch folders.");
      setContent([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchFolderContent(currentFolder.id);
  }, [currentFolder.id]);

  async function handleCreateFolder() {
    if (!newFolderTitle.trim()) return;
    setCreateFolderLoading(true);
    setError(null);
    try {
      const res = await axios.post(
        `${SERVER_URL}/folders/`,
        {
          title: newFolderTitle.trim(),
          parent_id: currentFolder.id !== "root" ? currentFolder.id : null,
        },
        { withCredentials: true }
      );
      if (res.status === 200 || res.status === 201) {
        setNewFolderTitle("");
        setCreatingFolder(false);
        setContent(prev => [...prev, { ...res.data, type:'folder' }]);
        // Optionally: refresh folder content
        fetchFolderContent(currentFolder.id);
      }
    } catch (e: any) {
      setError(
        e?.response?.data?.error ||
        "Could not create folder. Please try again."
      );
    }
    setCreateFolderLoading(false);
  }

  // INSERT_YOUR_CODE
  async function handleDeleteFolder(folderId: string) {
    setLoading(true);
    setError(null);
    try {
        console.log('delete folder if', folderId)
      const res = await axios.delete(`${SERVER_URL}/folders/${folderId}`, { withCredentials: true });
      if (res.status === 200 && res.data?.message) {
        // Remove the folder from content list and refresh
        setContent(prev => prev.filter(item => item.id !== folderId));
        setFolderToDelete(null);
       
      } else {
        setError("Failed to delete folder.");
      }
    } catch (e: any) {
      setError(
        e?.response?.data?.error ||
        "Could not delete folder. Please try again."
      );
    }
    setLoading(false);
  }

  function handleEnterFolder(folder: FolderContentItem) {
    setStack(prev => [...prev, { id: folder.id, title: folder.title || "Folder" }]);
  }

  function handleBack() {
    if (stack.length > 1) {
      setStack(prev => prev.slice(0, prev.length - 1));
    }
  }

  return (
    <div className=" mx-auto py-10 p-12">
      {/* popups */}
      {folderToDelete &&(
        <DeleteFolderPopup onDelete={()=>handleDeleteFolder(folderToDelete.id)} folder={folderToDelete} onClose={()=>setFolderToDelete(null)}/>
      )}
      <div className="flex items-center gap-2 mb-4">
        {stack.length > 1 && (
          <button
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-white/10 transition"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
        )}
        <h1 className="text-2xl font-semibold text-white">
          {currentFolder.title}
        </h1>
      </div>

      <div className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-xl mt-4 shadow-lg">
        {error && (
          <div className="mb-3 text-rose-400">{error}</div>
        )}
        {loading ? (
          <div className="flex my-12 items-center justify-center gap-2 text-slate-300">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading folders...
          </div>
        ) : (
          <>
            <div className="mb-4 max-h-[370px] overflow-y-auto rounded-lg bg-white/5 border border-white/10 px-2 py-1">
              {content.length > 0 ? (
                <ul>
                  {content.map(item => (
                    <li key={item.id} className="mb-1">
                      {item.type === "folder" ? (
                        <button
                          type="button"
                          onClick={() => handleEnterFolder(item)}
                          className="w-full flex items-center py-2 gap-3 cursor-pointer hover:bg-white/10 rounded-lg px-2 transition-all text-left min-h-[2.5rem]"
                        >
                          <FolderIcon className="w-5 h-5 flex-shrink-0 text-violet-400" />
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium truncate">{item.title}</div>
                            {item.created_at && (
                              <div className="text-xs text-slate-400 truncate">
                                {new Date(item.created_at).toLocaleString()}
                              </div>
                            )}
                          </div>
                        
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setFolderToDelete(item);
                          }}
                          title="Delete folder"
                          className="ml-2 p-1 rounded hover:bg-red-600/50 transition group"
                          style={{ marginLeft: 8 }}
                        >
                          <X className="h-4 w-4 text-red text-slate-700 font-bold group-hover:text-white transition" />
                         
                        </button>
                        </button>
                      ) : (
                        <div
                          className="flex items-center py-2 gap-3 px-2 rounded-lg bg-slate-700/30 opacity-60 select-none cursor-not-allowed min-h-[2.5rem]"
                          title={`Cannot enter a ${item.type}`}
                        >
                          {/* Simple icon by type */}
                          {item.type === "chat" && (
                            <span className="inline-block w-5 h-5 text-emerald-300">💬</span>
                          )}
                          {item.type === "doc" && (
                            <span className="inline-block w-5 h-5 text-amber-300">📝</span>
                          )}
                          {item.type === "session" && (
                            <span className="inline-block w-5 h-5 text-cyan-400">🎤</span>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-white/70 truncate">{item.title}</div>
                            <div className="text-xs text-slate-400 truncate capitalize">{item.type}</div>
                            {item.created_at && (
                              <div className="text-xs text-slate-500 truncate">
                                {new Date(item.created_at).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-slate-500 text-sm py-8 text-center">
                  No folders found.
                </div>
              )}
            </div>

            <div className="mb-2 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              {creatingFolder ? (
                <div className="flex w-full gap-2 items-center">
                  <input
                    type="text"
                    placeholder="New folder name..."
                    value={newFolderTitle}
                    onChange={e => setNewFolderTitle(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-slate-800 text-white placeholder-slate-400 text-sm focus:outline-none"
                    disabled={createFolderLoading}
                    maxLength={80}
                    autoFocus
                  />
                  <button
                    onClick={handleCreateFolder}
                    className="py-2 px-4 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:pointer-events-none"
                    disabled={!newFolderTitle.trim() || createFolderLoading}
                  >
                    {createFolderLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Create"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setCreatingFolder(false);
                      setNewFolderTitle("");
                    }}
                    className="p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreatingFolder(true)}
                  className="text-sm font-medium rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-violet-200"
                >
                  + Create Folder
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
