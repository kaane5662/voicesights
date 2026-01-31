// INSERT_YOUR_CODE
import { X } from 'lucide-react';
import React from 'react';

interface DeleteFolderProps {
  open?: boolean;
  folder: { 
    id: string;
    title: string;
    created_at?: string;
  } | null;
  onClose: () => void;
  onDelete: (folderId: string) => void;
}

export default function DeleteFolderPopup({
  open,
  folder,
  onClose,
  onDelete
}: DeleteFolderProps) {
  if (!folder) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 rounded-xl shadow-lg max-w-sm w-full p-6 border border-slate-700">
        <h2 className="text-xl font-bold text-red-400 mb-2">
          Delete Folder
        </h2>
        <div className="mb-3">
          <div className="text-base text-slate-200 font-semibold">
            {folder.title}
          </div>
          {folder.created_at && (
            <div className="text-xs text-slate-400">
              Created: {new Date(folder.created_at).toLocaleString()}
            </div>
          )}
        </div>
        <div className="mb-4 bg-red-900/30 p-3 rounded text-red-300 text-sm flex items-center gap-2">
          <div>
            All subfolders and items in "<b>{folder.title}</b>" will also be deleted. This action cannot be undone.
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <button
            className="px-4 py-2 rounded text-slate-200 bg-slate-700 hover:bg-slate-600 transition"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded text-white bg-red-600 hover:bg-red-700 font-semibold transition"
            onClick={() => onDelete(folder.id)}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
