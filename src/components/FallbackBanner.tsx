import { AlertTriangle } from "lucide-react";

const FALLBACK_REASON_COPY: Record<string, string> = {
  missing_api_key: "GEMINI_API_KEY is not configured on the server",
  api_error: "the Gemini API was unreachable or failed after retries",
  demo_requested: "demo mode was explicitly requested",
  unknown: "the analysis engine reported fallback without a reason",
};

export default function FallbackBanner({ reason }: { reason: string }) {
  return (
    <div className="w-full bg-amber-500/15 border border-amber-500/60 text-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-xs font-semibold">
      <AlertTriangle size={16} className="text-amber-400 shrink-0" />
      <span>
        DEMO DATA — this result was NOT produced by Gemini analysis ({FALLBACK_REASON_COPY[reason] || reason}).
        The issues shown are canned examples and do not describe your images.
      </span>
    </div>
  );
}
