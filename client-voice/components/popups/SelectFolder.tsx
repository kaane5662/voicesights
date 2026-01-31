// INSERT_YOUR_CODE
"use client";

import { SERVER_URL } from "@/const";
import axios from "axios";
import { useEffect, useState } from "react";
import { Folder as FolderIcon, Loader2, X } from "lucide-react";

type Folder = {
  id: string;
  title: string;
  parent_id?: string | null;
  created_at?: string;
};

type ResourceType = "session" | "doc" | "chat";

interface SelectFolderProps {
//   open: boolean;
  onClose: () => void;
  selectedResource: {
    resourceType: ResourceType;
    resourceId: string;
  };
  onSuccess?: () => void;
}

// INSERT_YOUR_CODE

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





export default function SelectFolderPopup({
//   open,
  onClose,
  selectedResource,
  onSuccess,
}: SelectFolderProps) {
  const [content, setContent] = useState<FolderContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>('root');
  const [error, setError] = useState<string | null>(null);

  // UI - loading state for move action
  const [moving, setMoving] = useState(false);

  // Fetch folders

  async function fetchFolderContent() {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${SERVER_URL}/folders/${selectedFolderId}/content`, {
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
    
    fetchFolderContent();
  }, [selectedFolderId]);

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [createFolderLoading, setCreateFolderLoading] = useState(false);

  async function handleSelect() {
    if (!selectedFolderId) return;
    setMoving(true);
    setError(null);
    try {
      await axios.post(
        `${SERVER_URL}/folders/add-to-folder`,
        {
          resource_type: selectedResource.resourceType,
          resource_id: selectedResource.resourceId,
          folder_id: selectedFolderId,
        },
        { withCredentials: true }
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      setError(
        e?.response?.data?.error ||
        "Could not move item to folder. Please try again."
      );
    }
    setMoving(false);
  }

  async function handleCreateFolder() {
    if (!newFolderTitle.trim()) return;
    setCreateFolderLoading(true);
    setError(null);
    try {
      const res = await axios.post(
        `${SERVER_URL}/folders/`,
        {
          title: newFolderTitle.trim(),
          parent_id: selectedFolderId,
        },
        { withCredentials: true }
      );
      if (res.status === 200 || res.status === 201) {
        setNewFolderTitle("");
        setCreatingFolder(false);
        setContent(prev => [...prev, { ...res.data.folder, type:'folder' }]);
        // Refresh folder list
        setSelectedFolderId(selectedFolderId); // triggers useEffect
      }
    } catch (e: any) {
      setError(
        e?.response?.data?.error ||
        "Could not create folder. Please try again."
      );
    }
    setCreateFolderLoading(false);
  }

  return (
    <div className=" fixed z-[10000] inset-0 flex items-center justify-center bg-black/40">
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl w-full max-w-sm sm:max-w-md rounded-2xl px-0 pt-5 pb-6 sm:px-7 relative text-white">
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-slate-400 hover:text-white rounded-full p-2 focus:outline-none"
          aria-label="Close popup"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="px-6 sm:px-0">
          <h2 className="text-2xl font-bold mb-3">Move to Folder</h2>
          <p className="mb-5 text-slate-400 text-sm">
            Select a folder where you want to move this item.
          </p>
          {loading ? (
            <div className="flex my-8 items-center justify-center gap-2 text-slate-300">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading folders...
            </div>
          ) : (
            <>
              <div className="mb-4 max-h-56 overflow-y-auto rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                {content.length > 0 ? (
                  <ul>
                    {content.map((item) => (
                      <li key={item.id} className="mb-1">
                        {/* Render folder type */}
                        {item.type === "folder" ? (
                          <button
                            type="button"
                            onClick={() => setSelectedFolderId(item.id)}
                            className={`w-full flex items-center py-2 gap-3 cursor-pointer hover:bg-white/10 rounded-lg px-2 transition-all text-left min-h-[2.5rem]`}
                            disabled={moving}
                          >
                            <FolderIcon className="w-5 h-5 flex-shrink-0 text-violet-400" />
                            <div className="flex-1 min-w-0">
                              <div className="text-white font-medium truncate">{item.title}</div>
                              {item.created_at && <div className="text-xs text-slate-400 truncate">{new Date(item.created_at).toLocaleString()}</div>}
                            </div>
                            <span
                              className={`ml-2 w-3 h-3 rounded-full border-2 ${
                                selectedFolderId === item.id
                                  ? "border-violet-400 bg-violet-400/80"
                                  : "border-white/20 bg-transparent"
                              }`}
                            />
                          </button>
                        ) : (
                          // Render other types (chat, doc, session) - just show type and title, disabled, faded
                          <div
                            className="flex items-center py-2 gap-3 px-2 rounded-lg bg-slate-700/30 opacity-60 select-none cursor-not-allowed min-h-[2.5rem]"
                            title={`Cannot move to a ${item.type}`}
                          >
                            {/* Icon by type */}
                            {item.type === "chat" && <span className="inline-block w-5 h-5 text-emerald-300">💬</span>}
                            {item.type === "doc" && <span className="inline-block w-5 h-5 text-amber-300">📝</span>}
                            {item.type === "session" && <span className="inline-block w-5 h-5 text-cyan-400">🎤</span>}
                            <div className="flex-1 min-w-0">
                              <div className="text-white/70 truncate">{item.title}</div>
                              <div className="text-xs text-slate-400 truncate capitalize">{item.type}</div>
                              {item.created_at && <div className="text-xs text-slate-500 truncate">{new Date(item.created_at).toLocaleString()}</div>}
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
              {/* Create Folder UI */}
              <div className="mb-5 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
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
              {error && (
                <div className="mb-2 text-rose-400 text-sm">{error}</div>
              )}
            </>
          )}
          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 font-medium"
              disabled={loading || moving || createFolderLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleSelect}
              className={`px-5 py-2 rounded-xl font-semibold bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:opacity-90 text-white shadow-md transition-all ${
                !selectedFolderId || loading || moving || createFolderLoading
                  ? "opacity-50 pointer-events-none"
                  : ""
              }`}
              disabled={!selectedFolderId || loading || moving || createFolderLoading}
            >
              {moving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Moving...
                </span>
              ) : (
                "Move"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  
}

