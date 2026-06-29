import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  isDestructive = true,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onCancel}
      />
      
      {/* Modal core card */}
      <div className="relative bg-white rounded-3xl border border-slate-150 shadow-2xl p-6 max-w-md w-full animate-scale-in z-10 space-y-4">
        {/* Header decoration */}
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl shrink-0 ${
            isDestructive 
              ? "bg-rose-50 text-rose-600 border border-rose-100" 
              : "bg-emerald-50 text-emerald-600 border border-emerald-100"
          }`}>
            {isDestructive ? <Trash2 size={22} /> : <AlertTriangle size={22} />}
          </div>
          
          <div className="flex-1 space-y-1">
            <h3 className="text-slate-900 font-sans font-bold text-base leading-snug tracking-tight">
              {title}
            </h3>
            <p className="text-slate-500 text-xs sm:text-[13px] leading-relaxed font-sans font-medium">
              {message}
            </p>
          </div>

          <button 
            type="button" 
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-slate-100/80 hover:bg-slate-150 border border-slate-200/50 text-slate-700 text-xs sm:text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            className={`px-4 py-2 text-white text-xs sm:text-xs font-bold rounded-xl transition-all active:scale-[0.98] cursor-pointer ${
              isDestructive 
                ? "bg-rose-600 hover:bg-rose-700 border border-rose-700/20 hover:shadow-md hover:shadow-rose-100" 
                : "bg-emerald-600 hover:bg-emerald-700 border border-emerald-700/20 hover:shadow-md hover:shadow-emerald-100"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
