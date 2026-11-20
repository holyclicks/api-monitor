import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

export default function ConfirmDeleteModal({
  isOpen,
  title = "Confirm Deletion",
  message = "Are you sure you want to delete this item? This action cannot be undone.",
  warning,
  confirmText = "Delete Permanently",
  loading = false,
  onConfirm,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="bg-gray-850 border border-gray-700 bg-gray-900 rounded-xl max-w-md w-full p-6 text-gray-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-950/80 border border-red-800/80 rounded-lg text-red-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{title}</h3>
              <p className="text-xs text-gray-400 mt-0.5">Permanent action</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed">{message}</p>

        {warning && (
          <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-lg flex items-start gap-2.5 text-xs text-red-300">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{warning}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md text-xs font-medium transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{loading ? "Deleting..." : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
