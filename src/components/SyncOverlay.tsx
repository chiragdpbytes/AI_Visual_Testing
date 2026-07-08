import React, { useEffect } from "react";
import { RefreshCw, X } from "lucide-react";

interface SyncOverlayProps {
  stage: "capturing" | "analyzing";
  targetUrl: string;
  viewportWidth: number;
  onCancel: () => void;
}

// Full-viewport freeze overlay shown while a Sync re-compare is in flight.
// Blocks all pointer and keyboard interaction beneath it; only Cancel works.
export default function SyncOverlay({ stage, targetUrl, viewportWidth, onCancel }: SyncOverlayProps) {
  useEffect(() => {
    const blockKeys = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", blockKeys, true);
    return () => window.removeEventListener("keydown", blockKeys, true);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-6"
      aria-modal="true"
      role="dialog"
    >
      <RefreshCw size={40} className="text-emerald-400 animate-spin" />
      <div className="text-center space-y-2 max-w-md px-6">
        <h3 className="text-slate-100 font-bold text-lg">Re-comparing against live build</h3>
        <p className="text-slate-400 text-sm font-mono break-all">
          {stage === "capturing"
            ? `Capturing ${targetUrl} at ${viewportWidth}px...`
            : "Analyzing with Gemini..."}
        </p>
        <p className="text-slate-500 text-xs">The screen is frozen to prevent interaction during sync.</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 cursor-pointer"
      >
        <X size={13} />
        Cancel Sync
      </button>
    </div>
  );
}
