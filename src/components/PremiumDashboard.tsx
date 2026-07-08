import React, { useState, useEffect } from "react";
import {
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Sliders,
  Figma,
  Globe,
  Upload,
  Play,
  HelpCircle,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  Sparkles,
  Check,
  Copy,
  AlertTriangle,
  Layers,
  ChevronRight,
  Compass,
  Eye,
  BookOpen,
  CheckCircle,
  X,
  Code,
  Trash2,
  Info,
  Key,
  LogOut,
  User,
  Columns,
  RotateCcw,
  Share2,
  FileText,
  Printer,
  Plus,
  Minus,
  RefreshCw
} from "lucide-react";
import { Issue, PresetCase, SeverityType, CategoryType, ComparisonSetup } from "../types";
import { presetCatalog, presetPricing } from "../presets";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import ConfirmationModal from "./ConfirmationModal";
import SyncOverlay from "./SyncOverlay";
import { saveSetup, getSetups, markSynced } from "../lib/setupStore";

// --- IndexedDB for Visual QA history runs to prevent localStorage QuotaExceededError ---
const IDB_NAME = "VeloceVisualQAStore";
const IDB_VERSION = 2;
const STORE_NAME = "runs";

const getIDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("comparisonSetups")) {
        db.createObjectStore("comparisonSetups", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveRunToIDB = async (run: any): Promise<void> => {
  try {
    const db = await getIDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(run);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to save run to IndexedDB", err);
  }
};

const getRunsFromIDB = async (): Promise<any[]> => {
  try {
    const db = await getIDB();
    return new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to get runs from IndexedDB", err);
    return [];
  }
};

const deleteRunFromIDB = async (id: string): Promise<void> => {
  try {
    const db = await getIDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to delete run from IndexedDB", err);
  }
};

const clearIDB = async (): Promise<void> => {
  try {
    const db = await getIDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to clear IndexedDB", err);
  }
};

// Custom type with classification for the premium workspace
export interface PremiumIssue extends Issue {
  classification: "missing" | "misaligned" | "unmatched";
  improvementNote: string;
}

const UrlLinkAndCopy = ({
  label,
  value,
  labelColorClass = "text-slate-400",
  textColorClass = "text-slate-750",
  linkColorClass = "text-emerald-600 hover:text-emerald-700 hover:underline",
  buttonBgClass = "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700"
}: {
  label: string;
  value: string;
  labelColorClass?: string;
  textColorClass?: string;
  linkColorClass?: string;
  buttonBgClass?: string;
}) => {
  const [copied, setCopied] = useState(false);
  const valStr = value || "";
  const isUrl = valStr.startsWith("http://") || valStr.startsWith("https://");

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(valStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between gap-1 w-full overflow-hidden">
      <div className="truncate flex items-center gap-1 flex-1">
        <span className={`${labelColorClass} font-bold mr-1 shrink-0`}>{label}:</span>
        {isUrl ? (
          <a
            href={valStr}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`${linkColorClass} font-medium break-all truncate inline-flex items-center gap-0.5`}
            title={valStr}
          >
            {valStr}
            <span className="inline-block transform scale-90 opacity-70">↗</span>
          </a>
        ) : (
          <span className={`${textColorClass} truncate`}>{valStr}</span>
        )}
      </div>
      {valStr && valStr !== "Uploaded mockup image" && valStr !== "Captured live UI" && (
        <button
          type="button"
          onClick={handleCopy}
          className={`p-0.5 px-1 rounded-md transition-all flex items-center justify-center shrink-0 border-none cursor-pointer ${buttonBgClass}`}
          title="Copy Link"
        >
          {copied ? <Check size={10} className="text-emerald-600 font-bold" /> : <Copy size={10} />}
        </button>
      )}
    </div>
  );
};

const FALLBACK_REASON_COPY: Record<string, string> = {
  missing_api_key: "GEMINI_API_KEY is not configured on the server",
  api_error: "the Gemini API was unreachable or failed after retries",
  demo_requested: "demo mode was explicitly requested",
  unknown: "the analysis engine reported fallback without a reason",
};

function FallbackBanner({ reason }: { reason: string }) {
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

interface PremiumDashboardProps {
  onToggleDemo1: () => void;
}

export default function PremiumDashboard({ onToggleDemo1 }: PremiumDashboardProps) {
  // Input settings
  const [figmaMode, setFigmaMode] = useState<"upload" | "url">("upload");
  const [projectMode, setProjectMode] = useState<"url" | "upload">("upload");

  // Inputs
  const [figmaUrl, setFigmaUrl] = useState("https://figma.com/file/veloce-saas-hero-system-master");
  const [projectUrl, setProjectUrl] = useState("");
  const [figmaToken, setFigmaToken] = useState(() => localStorage.getItem("veloce_figma_token") || "");

  useEffect(() => {
    localStorage.setItem("veloce_figma_token", figmaToken);
  }, [figmaToken]);

  const [uploadedFigmaBase64, setUploadedFigmaBase64] = useState<string | null>(null);
  const [uploadedFigmaName, setUploadedFigmaName] = useState("");
  const [uploadedProjectBase64, setUploadedProjectBase64] = useState<string | null>(null);
  const [uploadedProjectName, setUploadedProjectName] = useState("");

  // Resolution selection
  const [resolution, setResolution] = useState<"4k" | "1920" | "1536" | "1440" | "1366" | "1280" | "1024" | "custom">("1440");
  const [customWidth, setCustomWidth] = useState(1280);
  const [analyzeAllResolutions, setAnalyzeAllResolutions] = useState(false);
  // When true, capture width auto-matches the uploaded/captured design's width instead of a manual breakpoint
  const [autoMatchWidth, setAutoMatchWidth] = useState(true);

  // Nudges the user toward missing inputs when they try to run without both sides set
  const [missingInputsNudge, setMissingInputsNudge] = useState(false);

  // Native raw file states for cropping support
  const [rawFigmaBase64, setRawFigmaBase64] = useState<string | null>(null);
  const [isCroppingFigma, setIsCroppingFigma] = useState(false);
  const [rawProjectBase64, setRawProjectBase64] = useState<string | null>(null);
  const [isCroppingProject, setIsCroppingProject] = useState(false);
  const [cropProcessing, setCropProcessing] = useState(false);

  // Crop parameters (default is 0% to keep image full structure if they want to skip)
  const [cropFigmaX, setCropFigmaX] = useState(0);
  const [cropFigmaY, setCropFigmaY] = useState(0);
  const [cropFigmaW, setCropFigmaW] = useState(100);
  const [cropFigmaH, setCropFigmaH] = useState(100);

  const [cropProjX, setCropProjX] = useState(0);
  const [cropProjY, setCropProjY] = useState(0);
  const [cropProjW, setCropProjW] = useState(100);
  const [cropProjH, setCropProjH] = useState(100);

  // States for interactive cursor crop-drawing zone
  const [isDrawingFigma, setIsDrawingFigma] = useState(false);
  const [figmaStartPos, setFigmaStartPos] = useState({ x: 0, y: 0 });
  const [isDrawingProject, setIsDrawingProject] = useState(false);
  const [projectStartPos, setProjectStartPos] = useState({ x: 0, y: 0 });

  // States
  const [isAuditing, setIsAuditing] = useState(false);
  const [fallbackInfo, setFallbackInfo] = useState<{ reason: string } | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [activeSetup, setActiveSetup] = useState<ComparisonSetup | null>(null);
  const [syncStage, setSyncStage] = useState<"capturing" | "analyzing" | null>(null);
  const syncAbortRef = React.useRef<AbortController | null>(null);
  const leftPaneRef = React.useRef<HTMLDivElement | null>(null);
  const rightPaneRef = React.useRef<HTMLDivElement | null>(null);
  const isSyncingScroll = React.useRef(false);
  const uploadSectionRef = React.useRef<HTMLDivElement | null>(null);
  const [auditProgress, setAuditProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isArchiveFullscreen, setIsArchiveFullscreen] = useState(false);
  const [archiveTab, setArchiveTab] = useState<"active" | "archived">("active");
  const [archiveSearchQuery, setArchiveSearchQuery] = useState("");
  const [archiveResolutionFilter, setArchiveResolutionFilter] = useState("all");
  const [zoomFigma, setZoomFigma] = useState(1);
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null);
  const [isClearingAllRuns, setIsClearingAllRuns] = useState(false);
  const [zoomProject, setZoomProject] = useState(1);

  // Fullscreen Comparison Room calibration and alignment modes
  const [fullscreenCompareMode, setFullscreenCompareMode] = useState<"side-by-side" | "overlapped">("side-by-side");
  const [fullscreenOpacity, setFullscreenOpacity] = useState(0.5);
  const [figmaX, setFigmaX] = useState(0);
  const [figmaY, setFigmaY] = useState(0);
  const [projectXOffsetGlobal, setProjectXOffsetGlobal] = useState(0);
  const [projectYOffsetGlobal, setProjectYOffsetGlobal] = useState(0);
  const [showFullscreenAlignmentControls, setShowFullscreenAlignmentControls] = useState(() => {
    const saved = localStorage.getItem("veloce_show_calibration");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("veloce_show_calibration", showFullscreenAlignmentControls.toString());
  }, [showFullscreenAlignmentControls]);

  // Hydrate the most recently saved comparison setup so Sync can re-compare without re-uploads
  useEffect(() => {
    getSetups().then((all) => {
      if (all.length > 0) setActiveSetup(all[0]);
    }).catch(() => { });
  }, []);

  // Overlapped view specific overrides
  const [overlapScale, setOverlapScale] = useState(1);
  const [overlapXOffset, setOverlapXOffset] = useState(0);
  const [overlapYOffset, setOverlapYOffset] = useState(0);
  const [bgOverlapScale, setBgOverlapScale] = useState(1);
  const [bgOverlapXOffset, setBgOverlapXOffset] = useState(0);
  const [bgOverlapYOffset, setBgOverlapYOffset] = useState(0);
  const [overlapAlignmentTab, setOverlapAlignmentTab] = useState<"foreground" | "background">("foreground");
  const [showAlignmentPopup, setShowAlignmentPopup] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isReuploadModalOpen, setIsReuploadModalOpen] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const handleExportJSON = () => {
    try {
      const activeScore = getDynamicScore();
      const reportData = {
        reportType: "Veloce Visual QA Discrepancy Audit",
        projectName: activeRunTitle,
        exportDate: new Date().toISOString(),
        score: {
          originalScore: score,
          currentAdjustedScore: activeScore,
          resolvedCount: resolvedIssueIds.length,
          totalCount: premiumIssues.length,
          completionPercent: premiumIssues.length > 0 ? Math.round((resolvedIssueIds.length / premiumIssues.length) * 100) : 100
        },
        sandboxSettings: {
          globalXOffset: projectXOffsetGlobal,
          globalYOffset: projectYOffsetGlobal,
          globalZoom: zoomProject,
          foregroundOverlapScale: overlapScale,
          foregroundOverlapX: overlapXOffset,
          foregroundOverlapY: overlapYOffset,
          backgroundOverlapScale: bgOverlapScale,
          backgroundOverlapX: bgOverlapXOffset,
          backgroundOverlapY: bgOverlapYOffset
        },
        discrepancies: premiumIssues.map(issue => ({
          id: issue.id,
          title: issue.title,
          category: issue.category,
          severity: issue.severity,
          classification: issue.classification,
          description: issue.description,
          improvementNote: issue.improvementNote,
          estimatedImpact: issue.estimatedImpact || "",
          coordinates: { xPercent: issue.xPercent, yPercent: issue.yPercent },
          status: resolvedIssueIds.includes(issue.id) ? "resolved" : "active",
          sandboxCorrections: getIssueSliderValues(issue.id),
          customCssOverride: customCssOverrides[issue.id] || ""
        }))
      };

      const jsonStr = JSON.stringify(reportData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Veloce_QA_Report_${activeRunTitle.replace(/\s+/g, "_")}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportFeedback("JSON report downloaded!");
      setTimeout(() => setExportFeedback(null), 3000);
    } catch (err) {
      console.error("Failed to export JSON report:", err);
    }
  };

  const handleExportHTML = () => {
    try {
      const activeScore = getDynamicScore();
      const resolvedCount = resolvedIssueIds.length;
      const totalCount = premiumIssues.length;
      const remainingCount = totalCount - resolvedCount;
      const matchPercent = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 100;
      const dateStr = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

      const discrepanciesList = premiumIssues.map(issue => {
        const isResolved = resolvedIssueIds.includes(issue.id);
        const sliders = getIssueSliderValues(issue.id);
        const customCss = customCssOverrides[issue.id] || "";
        return `
          <div class="issue-card bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-md transition-all ${isResolved ? "border-emerald-800/40 bg-slate-950/40 opacity-80" : ""}">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="space-y-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="px-2 py-0.5 text-[9px] font-mono tracking-widest uppercase font-extrabold rounded ${issue.severity === "critical" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
            issue.severity === "major" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
              "bg-sky-500/10 text-sky-400 border border-sky-500/20"
          }">${issue.severity}</span>
                  <span class="px-2 py-0.5 text-[9px] font-mono tracking-widest uppercase font-extrabold rounded bg-slate-850 text-slate-400 border border-slate-800">${issue.category}</span>
                  <span class="px-2 py-0.5 text-[9px] font-mono tracking-widest uppercase font-extrabold rounded bg-slate-850 text-indigo-400 border border-slate-800">${issue.classification}</span>
                </div>
                <h3 class="text-base font-extrabold text-white mt-1">${issue.title}</h3>
              </div>
              <span class="px-3 py-1 text-xs font-bold rounded-lg ${isResolved ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}">
                ${isResolved ? "✓ Resolved Fix" : "● Correction Active"}
              </span>
            </div>

            <p class="text-slate-300 text-sm leading-relaxed">${issue.description}</p>

            ${issue.estimatedImpact ? `
              <div class="p-3.5 bg-slate-950 rounded-xl border border-slate-850">
                <span class="text-[10px] text-emerald-400 font-mono uppercase tracking-wider block font-bold">Estimated UX Impact</span>
                <p class="text-xs text-slate-400 italic mt-0.5">"${issue.estimatedImpact}"</p>
              </div>
            ` : ""}

            <div class="p-3.5 bg-slate-950 rounded-xl border border-slate-850 space-y-1">
              <span class="text-[10px] text-yellow-400 font-mono uppercase tracking-wider block font-bold">Improvement Instruction</span>
              <p class="text-xs text-slate-300">${issue.improvementNote}</p>
            </div>

            ${issue.cssSuggestion ? `
              <div class="space-y-1.5">
                <span class="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Recommended Correction CSS</span>
                <pre class="bg-slate-950 p-4 rounded-xl text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-900">${issue.cssSuggestion}</pre>
              </div>
            ` : ""}

            ${(sliders.xOffset !== 0 || sliders.yOffset !== 0 || sliders.borderRadius !== 4 || sliders.scaleWidth !== 100 || customCss) ? `
              <div class="pt-3 border-t border-slate-800 space-y-2">
                <span class="text-[10px] text-indigo-400 font-mono uppercase tracking-wider block font-bold">QA Sandbox Overrides Applied</span>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-400 font-mono">
                  ${sliders.xOffset !== 0 ? `<div>X Shift: <b class="text-slate-200">${sliders.xOffset}px</b></div>` : ""}
                  ${sliders.yOffset !== 0 ? `<div>Y Shift: <b class="text-slate-200">${sliders.yOffset}px</b></div>` : ""}
                  ${sliders.borderRadius !== 4 ? `<div>Border Radius: <b class="text-slate-200">${sliders.borderRadius}px</b></div>` : ""}
                  ${sliders.scaleWidth !== 100 ? `<div>Scale Width: <b class="text-slate-200">${sliders.scaleWidth}%</b></div>` : ""}
                </div>
                ${customCss ? `
                  <div class="mt-1">
                    <span class="text-[9px] text-slate-500 font-mono uppercase tracking-wider block">Custom sandbox CSS</span>
                    <pre class="bg-slate-950/80 p-3 rounded-lg text-indigo-300 font-mono text-xs overflow-x-auto border border-slate-900/50">${customCss}</pre>
                  </div>
                ` : ""}
              </div>
            ` : ""}
          </div>
        `;
      }).join("\n");

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Veloce QA Audit Report - ${activeRunTitle}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
    body {
      font-family: 'Inter', sans-serif;
    }
    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }
    @media print {
      body {
        background: white !important;
        color: black !important;
      }
      .no-print {
        display: none !important;
      }
      .print-border {
        border: 1px solid #e2e8f0 !important;
      }
      .issue-card {
        page-break-inside: avoid;
        background: white !important;
        color: black !important;
        border: 1px solid #cbd5e1 !important;
      }
      pre {
        background: #f8fafc !important;
        color: #0f172a !important;
        border: 1px solid #e2e8f0 !important;
      }
      h1, h2, h3, h4, span, p, div, b {
        color: black !important;
      }
    }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen pb-16">
  <div class="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
    
    <!-- Floating Toolbar -->
    <div class="no-print flex justify-between items-center bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-2xl shadow-xl sticky top-4 z-50">
      <div class="flex items-center gap-3">
        <span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span class="text-xs font-mono text-slate-400">Veloce QA Interactive Standalone Report</span>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="window.print()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 cursor-pointer flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4m10 0H4"></svg>
          Print / Save PDF Report
        </button>
      </div>
    </div>

    <!-- Executive Header -->
    <div class="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-850 p-6 sm:p-8 rounded-3xl space-y-6 relative overflow-hidden shadow-2xl">
      <div class="absolute top-0 right-0 p-8 opacity-5">
        <svg class="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
      </div>
      <div class="space-y-2">
        <span class="text-xs font-mono uppercase tracking-widest text-indigo-400 font-bold block">Spec & Boundary Discrepancy Audit</span>
        <h1 class="text-2xl sm:text-3xl font-black text-white tracking-tight">${activeRunTitle}</h1>
        <p class="text-slate-400 text-xs sm:text-sm">Generated on <span class="text-slate-200 font-medium">${dateStr}</span></p>
      </div>

      <!-- Overview Stats Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80">
        <div class="p-4 bg-slate-950/60 rounded-2xl border border-slate-850/80">
          <span class="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Visual Match Score</span>
          <div class="flex items-baseline gap-1 mt-1">
            <span class="text-2xl sm:text-3xl font-black text-white">${activeScore}%</span>
            <span class="text-xs text-slate-500 font-mono">match</span>
          </div>
        </div>
        <div class="p-4 bg-slate-950/60 rounded-2xl border border-slate-850/80">
          <span class="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Total Discrepancies</span>
          <div class="flex items-baseline gap-1 mt-1">
            <span class="text-2xl sm:text-3xl font-black text-white">${totalCount}</span>
            <span class="text-xs text-slate-500 font-mono">items</span>
          </div>
        </div>
        <div class="p-4 bg-slate-950/60 rounded-2xl border border-slate-850/80">
          <span class="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Corrections Resolved</span>
          <div class="flex items-baseline gap-1 mt-1">
            <span class="text-2xl sm:text-3xl font-black text-emerald-400">${resolvedCount}</span>
            <span class="text-xs text-emerald-500/80 font-mono">(${matchPercent}%)</span>
          </div>
        </div>
        <div class="p-4 bg-slate-950/60 rounded-2xl border border-slate-850/80">
          <span class="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Remaining Active</span>
          <div class="flex items-baseline gap-1 mt-1">
            <span class="text-2xl sm:text-3xl font-black ${remainingCount > 0 ? "text-amber-400" : "text-emerald-400"}">${remainingCount}</span>
            <span class="text-xs text-slate-500 font-mono">pending</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main List Section -->
    <div class="space-y-6">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 class="text-lg font-extrabold text-white tracking-tight uppercase flex items-center gap-2">
          <span>Detailed Audit Findings</span>
          <span class="px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 text-xs rounded-full font-mono">${totalCount}</span>
        </h2>
        <div class="no-print flex items-center gap-2 text-xs">
          <button onclick="filterIssues('all')" id="btn-all" class="px-3 py-1 bg-indigo-650 text-white font-bold rounded-lg cursor-pointer">All</button>
          <button onclick="filterIssues('active')" id="btn-active" class="px-3 py-1 text-slate-400 hover:text-white font-bold rounded-lg cursor-pointer">Active</button>
          <button onclick="filterIssues('resolved')" id="btn-resolved" class="px-3 py-1 text-slate-400 hover:text-white font-bold rounded-lg cursor-pointer">Resolved</button>
        </div>
      </div>

      <div class="space-y-4" id="issues-container">
        ${discrepanciesList || `<div class="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-2xl">No discrepancy records present for this session.</div>`}
      </div>
    </div>

    <!-- Footer -->
    <footer class="pt-8 border-t border-slate-900 text-center text-xs text-slate-500 font-mono">
      <p>Report compiled by Veloce Visual QA Platform • Confined Sandbox Context</p>
    </footer>

  </div>

  <script>
    function filterIssues(status) {
      ['all', 'active', 'resolved'].forEach(s => {
        const btn = document.getElementById('btn-' + s);
        if (s === status) {
          btn.classList.remove('text-slate-400', 'hover:text-white');
          btn.classList.add('bg-indigo-650', 'text-white');
        } else {
          btn.classList.add('text-slate-400', 'hover:text-white');
          btn.classList.remove('bg-indigo-650', 'text-white');
        }
      });

      const cards = document.getElementById('issues-container').children;
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (status === 'all') {
          card.style.display = 'block';
        } else if (status === 'active') {
          if (card.innerHTML.includes('Resolved Fix')) {
            card.style.display = 'none';
          } else {
            card.style.display = 'block';
          }
        } else if (status === 'resolved') {
          if (card.innerHTML.includes('Resolved Fix')) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        }
      }
    }
  </script>
</body>
</html>
      `;

      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Veloce_QA_Report_${activeRunTitle.replace(/\s+/g, "_")}_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportFeedback("Interactive HTML report downloaded!");
      setTimeout(() => setExportFeedback(null), 3000);
    } catch (err) {
      console.error("Failed to export HTML report:", err);
    }
  };

  // Results State
  const [selectedScenarioId, setSelectedScenarioId] = useState<"preset-hero" | "preset-pricing">("preset-hero");
  const [score, setScore] = useState(86);
  const [premiumIssues, setPremiumIssues] = useState<PremiumIssue[]>([]);

  // Interactive Corrector States
  const [resolvedIssueIds, setResolvedIssueIds] = useState<string[]>([]);
  const [customCssOverrides, setCustomCssOverrides] = useState<Record<string, string>>({});
  const [patchCopyFeedback, setPatchCopyFeedback] = useState(false);
  const [issueSliders, setIssueSliders] = useState<Record<string, {
    xOffset: number;
    yOffset: number;
    borderRadius: number;
    scaleWidth: number;
    contrast: number;
  }>>({});

  const getIssueSliderValues = (issueId: string) => {
    return issueSliders[issueId] || {
      xOffset: 0,
      yOffset: 0,
      borderRadius: 4,
      scaleWidth: 100,
      contrast: 100
    };
  };

  const updateIssueSlider = (issueId: string, key: string, value: number) => {
    setIssueSliders(prev => ({
      ...prev,
      [issueId]: {
        ...getIssueSliderValues(issueId),
        [key]: value
      }
    }));
  };

  const getDynamicScore = () => {
    if (premiumIssues.length === 0) return score;
    const resolvedCount = resolvedIssueIds.filter(id => premiumIssues.some(i => i.id === id)).length;
    if (resolvedCount === 0) return score;
    const increment = Math.ceil(((100 - score) * resolvedCount) / premiumIssues.length);
    return Math.min(100, score + increment);
  };

  const [currentDesignImage, setCurrentDesignImage] = useState("");
  const [currentSiteImage, setCurrentSiteImage] = useState("");
  const [activeRunTitle, setActiveRunTitle] = useState("SaaS Hero Component Landing");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const handleExportPatch = () => {
    const patchRules = premiumIssues
      .filter(issue => resolvedIssueIds.includes(issue.id))
      .map(issue => {
        const custom = customCssOverrides[issue.id];
        const rule = custom !== undefined ? custom : (issue.cssSuggestion || "");
        return `/* Fix discrepancy: ${issue.title} */\n${rule}`;
      })
      .join("\n\n");

    const fullPatch = `/* ========================================================\n   VELOCE AI COMPILATION CSS ALIGNMENT PATCH\n   Project Theme: ${activeRunTitle}\n   Generated At: ${new Date().toLocaleDateString()}\n   ======================================================== */\n\n${patchRules || "/* No style tokens resolved yet. Try sliders or manual overrides inside the drawer! */"}`;

    navigator.clipboard.writeText(fullPatch);
    setPatchCopyFeedback(true);
    setTimeout(() => setPatchCopyFeedback(false), 2000);
  };

  // Audit run history storage
  const [historyRuns, setHistoryRuns] = useState<any[]>([]);

  const saveHistoryWithQuotaManagement = async (historyList: any[]) => {
    // 1. Save all to IndexedDB with full images intact
    try {
      for (const run of historyList) {
        await saveRunToIDB(run);
      }
    } catch (err) {
      console.error("Failed to sync runs to IndexedDB:", err);
    }

    // 2. Save lightweight (stripped base64 images) version to localStorage as metadata backup
    try {
      const strippedList = historyList.map(item => {
        const stripBase64 = (img: any) => {
          if (typeof img === "string" && img.startsWith("data:")) {
            return ""; // Clear base64 data to fit localStorage limits safely
          }
          return img;
        };
        return {
          ...item,
          designImage: stripBase64(item.designImage),
          siteImage: stripBase64(item.siteImage)
        };
      });
      localStorage.setItem("veloce_premium_history_runs", JSON.stringify(strippedList));
    } catch (e: any) {
      console.warn("Storage write failed even for lightweight metadata:", e);
    }
  };

  // Load history from IndexedDB on mount, and back it up with presets/localStorage if empty
  useEffect(() => {
    const loadFromIndexedDB = async () => {
      try {
        const idbRuns = await getRunsFromIDB();
        if (idbRuns && idbRuns.length > 0) {
          // Sort by startedAt descending
          const sorted = idbRuns.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
          // Ensure older items beyond 20 are marked archived
          const processed = sorted.map((run, idx) => ({
            ...run,
            archived: run.archived !== undefined ? run.archived : idx >= 20
          }));
          setHistoryRuns(processed);
          return;
        }
      } catch (err) {
        console.error("IndexedDB load failed, falling back", err);
      }

      // Fallback to localStorage
      const saved = localStorage.getItem("veloce_premium_history_runs");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const sorted = parsed.sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
          const processed = sorted.map((run: any, idx: number) => ({
            ...run,
            archived: run.archived !== undefined ? run.archived : idx >= 20
          }));
          setHistoryRuns(processed);
          // Sync back to IndexedDB for safety
          for (const run of processed) {
            await saveRunToIDB(run);
          }
        } catch (e) {
          console.error("Failed to parse history runs", e);
        }
      } else {
        const initialRuns = [
          {
            id: "run-preset-hero",
            projectName: "SaaS Landing Page - Hero",
            startedAt: "2026-05-26T08:00:00Z",
            completedAt: "2026-05-26T08:00:02Z",
            designImage: presetCatalog.designImage,
            siteImage: presetCatalog.siteImage,
            score: presetCatalog.score,
            issues: presetCatalog.issues,
            status: "completed",
            resolution: "laptop",
            inputs: {
              mockup: "https://figma.com/file/veloce-saas-hero-system-master",
              staging: "http://localhost:3000/staging/saas-hero-component"
            },
            archived: false
          },
          {
            id: "run-preset-pricing",
            projectName: "SaaS Application - Pricing Suite",
            startedAt: "2026-05-26T08:15:00Z",
            completedAt: "2026-05-26T08:15:01Z",
            designImage: presetPricing.designImage,
            siteImage: presetPricing.siteImage,
            score: presetPricing.score,
            issues: presetPricing.issues,
            status: "completed",
            resolution: "laptop",
            inputs: {
              mockup: "https://figma.com/file/veloce-pricing-system",
              staging: "https://veloceqa.com/pricing"
            },
            archived: false
          }
        ];
        setHistoryRuns(initialRuns);
        saveHistoryWithQuotaManagement(initialRuns);
      }
    };

    loadFromIndexedDB();
  }, []);

  // Dynamic routing with window.location pathname syncing to support loading individual audit results
  useEffect(() => {
    const handleLocationRouting = () => {
      const pathname = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash;

      let targetId = "";

      // Match pathname like /audit/:id
      const pathMatch = pathname.match(/\/audit\/([^/]+)/);
      if (pathMatch) {
        targetId = pathMatch[1];
      } else if (searchParams.has("runId")) {
        targetId = searchParams.get("runId") || "";
      } else if (hash.startsWith("#/audit/") || hash.startsWith("#audit-")) {
        targetId = hash.replace("#/audit/", "").replace("#audit-", "");
      }

      if (targetId) {
        // Rewrite preset shortcuts
        if (targetId === "preset-hero" || targetId === "run-preset-hero") {
          targetId = "run-preset-hero";
        } else if (targetId === "preset-pricing" || targetId === "run-preset-pricing") {
          targetId = "run-preset-pricing";
        }

        // Fetch history directly from localStorage if historyRuns state hasn't loaded yet
        let runs = historyRuns;
        if (!runs || runs.length === 0) {
          const savedStr = localStorage.getItem("veloce_premium_history_runs");
          if (savedStr) {
            try {
              runs = JSON.parse(savedStr);
            } catch {
              runs = [];
            }
          }
        }

        // Only trigger loadHistoryItem if not already showing this individual result to prevent loop
        if (activeRunId !== targetId) {
          const matchedRun = runs.find((r: any) => r.id === targetId);
          if (matchedRun) {
            loadHistoryItem(matchedRun);
          } else {
            // Preset fallback data structure
            const fallbackPresets = [
              {
                id: "run-preset-hero",
                projectName: "SaaS Landing Page - Hero",
                startedAt: "2026-05-26T08:00:00Z",
                completedAt: "2026-05-26T08:00:02Z",
                designImage: presetCatalog.designImage,
                siteImage: presetCatalog.siteImage,
                score: presetCatalog.score,
                issues: presetCatalog.issues,
                status: "completed",
                resolution: "laptop",
                inputs: {
                  mockup: "https://figma.com/file/veloce-saas-hero-system-master",
                  staging: "http://localhost:3000/staging/saas-hero-component"
                }
              },
              {
                id: "run-preset-pricing",
                projectName: "SaaS Application - Pricing Suite",
                startedAt: "2026-05-26T08:15:00Z",
                completedAt: "2026-05-26T08:15:01Z",
                designImage: presetPricing.designImage,
                siteImage: presetPricing.siteImage,
                score: presetPricing.score,
                issues: presetPricing.issues,
                status: "completed",
                resolution: "laptop",
                inputs: {
                  mockup: "https://figma.com/file/veloce-pricing-system",
                  staging: "https://veloceqa.com/pricing"
                }
              }
            ];
            const presetRun = fallbackPresets.find((pr: any) => pr.id === targetId);
            if (presetRun) {
              loadHistoryItem(presetRun);
            }
          }
        }
      } else {
        // If no target ID in pathname, but fullscreen is active, exit fullscreen to match standard expectations
        if (isFullscreen) {
          setIsFullscreen(false);
          setSelectedIssue(null);
          setActiveRunId(null);
        }
      }
    };

    // Listen to popstate event from navigation actions
    window.addEventListener("popstate", handleLocationRouting);

    // Patch pushState & replaceState to capture navigation programmatically inside the Applet frame
    const originalPushState = window.history.pushState;
    window.history.pushState = function (state, unused, url) {
      const res = originalPushState.call(this, state, unused, url);
      handleLocationRouting();
      return res;
    };

    const originalReplaceState = window.history.replaceState;
    window.history.replaceState = function (state, unused, url) {
      const res = originalReplaceState.call(this, state, unused, url);
      handleLocationRouting();
      return res;
    };

    // Trigger router mapping initially
    handleLocationRouting();

    return () => {
      window.removeEventListener("popstate", handleLocationRouting);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [historyRuns, activeRunId, isFullscreen]);

  // Slideover drawer (50% viewport)
  const [selectedIssue, setSelectedIssue] = useState<PremiumIssue | null>(null);
  const [selectedOverlayIssue, setSelectedOverlayIssue] = useState<PremiumIssue | null>(null); // ADDED
  const handleSelectIssue = (issue: PremiumIssue | null) => {
    setSelectedOverlayIssue(issue);
    if (issue) {
      setShowFullscreenAlignmentControls(false);
    }
  };

  // Proportionally mirrors scroll position from one fullscreen compare pane to the other.
  const handlePaneScroll = (source: HTMLDivElement, target: HTMLDivElement | null) => {
    if (!target || isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    const vMax = source.scrollHeight - source.clientHeight;
    const hMax = source.scrollWidth - source.clientWidth;
    if (vMax > 0) {
      target.scrollTop = (source.scrollTop / vMax) * Math.max(0, target.scrollHeight - target.clientHeight);
    }
    if (hMax > 0) {
      target.scrollLeft = (source.scrollLeft / hMax) * Math.max(0, target.scrollWidth - target.clientWidth);
    }
    requestAnimationFrame(() => { isSyncingScroll.current = false; });
  };
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isHoveredIssueId, setIsHoveredIssueId] = useState<string | null>(null);

  // Load standard scenario values
  useEffect(() => {
    loadScenario(selectedScenarioId);
  }, [selectedScenarioId]);

  // Logic to classify the pre-loaded bugs
  const loadScenario = (id: "preset-hero" | "preset-pricing") => {
    setResolvedIssueIds([]);
    setIssueSliders({});
    setCustomCssOverrides({});

    if (id === "preset-hero") {
      setActiveRunTitle("SaaS Landing Page - Hero");
      setScore(presetCatalog.score);
      setCurrentDesignImage(presetCatalog.designImage);
      setCurrentSiteImage(presetCatalog.siteImage);

      const classified: PremiumIssue[] = [
        {
          id: "issue-1",
          severity: "minor",
          category: "layout",
          title: "Header Border Radius Mismatch",
          description: "Figma design utilizes a refined ry=12 border-radius layout, whereas the actual live implementation compiles a straight square header box. This degrades clean aesthetics.",
          xPercent: 50,
          yPercent: 8,
          cssSuggestion: "header-nav {\n  border-radius: 12px;\n  height: 64px;\n}",
          estimatedImpact: "Consistency & edge alignment refinement.",
          classification: "misaligned",
          improvementNote: "Replace the raw 'rounded-none' or square header element with standard Tailwind 'rounded-xl' or CSS 'border-radius: 12px' attribute corresponding to Image A."
        },
        {
          id: "issue-2",
          severity: "minor",
          category: "color",
          title: "Logo Color & Token Mismatch",
          description: "Visual contrast brand logo uses primary Indigo #6366F1 in design frame, but live development renders as a lower-contrast dark purple #4F46E5 which doesn't match design guidelines.",
          xPercent: 12,
          yPercent: 9,
          cssSuggestion: ".logo-accent {\n  background-color: #6366F1;\n}",
          estimatedImpact: "Brand identity enforcement across marketing assets.",
          classification: "unmatched",
          improvementNote: "Sync the theme variables! Use CSS color token '#6366F1' for custom branding accents rather than default Indigo '#4f46e5'. Ensure standard branding assets stay aligned."
        },
        {
          id: "issue-3",
          severity: "major",
          category: "color",
          title: "Hero Subtext Warning Vibe Defect",
          description: "Second line of the hero subtitle utilizes primary brand indigo '#6366F1' in design but utilizes Warning red '#EF4444' in the developed layout, creating an unintended urgent vibe.",
          xPercent: 50,
          yPercent: 41,
          cssSuggestion: ".hero-sub-text {\n  color: #6366F1;\n  font-size: 44px;\n}",
          estimatedImpact: "Aesthetic focus is disrupted on initial page load, and error-vibes decrease brand loyalty.",
          classification: "unmatched",
          improvementNote: "Remove the warning utility background or text colors like '.text-red-500' or '#EF4444' and restore the clean corporate color '#6366F1'."
        },
        {
          id: "issue-4",
          severity: "major",
          category: "layout",
          title: "CTA Button Sizing Compressed",
          description: "The primary 'Get Started' CTA has compressed spatial breathing room. The design defines 180px wide and 48px high with standard 8px rounded borders. Actual live compiles as 160px by 40px and sharp 3px corners.",
          xPercent: 50,
          yPercent: 58,
          cssSuggestion: ".cta-button {\n  width: 180px;\n  height: 48px;\n  border-radius: 8px;\n  padding: 12px 24px;\n}",
          estimatedImpact: "CTA prominence and finger touch accessibility on min-size screen layouts.",
          classification: "misaligned",
          improvementNote: "Increase padding inside the interactive button component. Use Tailwind classes 'px-6 py-3 min-w-[180px]' to restore natural breathing space."
        },
        {
          id: "issue-5",
          severity: "critical",
          category: "layout",
          title: "Metric Cards Grid Symmetry Defect",
          description: "Due to uneven column sizing gaps (Card 3 is stretched excessively), the card outputs are unaligned, and shifted upwards. Spacing gaps look asymmetrical.",
          xPercent: 50,
          yPercent: 82,
          cssSuggestion: ".metric-grid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 24px;\n  margin-top: 40px;\n}",
          estimatedImpact: "Layout collapses on tablet or narrow laptop displays, pushing content off-screen.",
          classification: "missing",
          improvementNote: "Establish a rigid CSS Grid of 3 columns ('grid-cols-3') with uniform gap sizes of 24px. Ensure Card 3 has the same max width as Card 1 and Card 2."
        }
      ];
      setPremiumIssues(classified);
    } else {
      setActiveRunTitle("SaaS Application - Pricing Suite");
      setScore(presetPricing.score);
      setCurrentDesignImage(presetPricing.designImage);
      setCurrentSiteImage(presetPricing.siteImage);

      const classified: PremiumIssue[] = [
        {
          id: "pricing-1",
          severity: "major",
          category: "layout",
          title: "Card Edge Curvature Degradation",
          description: "Design specs detailed luxurious smooth 'rounded-2xl' (16px) corners. Actual website implementation compiles dry rigid inline borders at 4px. This disrupts the soft friendly startup aesthetics.",
          xPercent: 20,
          yPercent: 45,
          cssSuggestion: ".pricing-card {\n  border-radius: 16px;\n  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);\n}",
          estimatedImpact: "Brand feeling and aesthetic warmth in enterprise visual systems.",
          classification: "unmatched",
          improvementNote: "Revise border-radius token settings to 16px. Ensure the outer cards use uniform visual curvature matching Image A specifications."
        },
        {
          id: "pricing-2",
          severity: "critical",
          category: "layout",
          title: "STANDOUT Featured Plan Floating Height Defect",
          description: "The 'Professional' card is designed to float 10px higher with an organic Indigo accent. In staging/production, it sits completely flat alongside other columns, missing its critical interactive hierarchy prominence.",
          xPercent: 50,
          yPercent: 30,
          cssSuggestion: ".pricing-card.featured {\n  transform: translateY(-10px);\n  border: 2.5px solid #6366F1;\n}",
          estimatedImpact: "Featured plan selection rates are likely reduced because visual focus is lost.",
          classification: "misaligned",
          improvementNote: "Inject a translateY translate offset to the center pricing component. Highlight with border accents: border-color indigo-500."
        },
        {
          id: "pricing-3",
          severity: "major",
          category: "color",
          title: "Standout Popularity Badge Miscoloration",
          description: "The centered stand-out tag uses a green badge instead of the design's elegant indigo brand accent. Bad alignment shifts the badge off-center left.",
          xPercent: 50,
          yPercent: 28,
          cssSuggestion: ".popular-badge {\n  background-color: #6366F1;\n  margin: 0 auto;\n  border-radius: 12px;\n}",
          estimatedImpact: "Conversion rate optimization and visual alignment structure.",
          classification: "unmatched",
          improvementNote: "Re-apply correct theme color. Swap the green badge layout layer for indigo theme accents, and center align inside the card hierarchy."
        },
        {
          id: "pricing-4",
          severity: "minor",
          category: "color",
          title: "Paragraph Contrast Ratio Infraction",
          description: "Sub-title text color is compiled as #94A3B8 (grey) which triggers a WCAG Contrast failure on pure white backgrounds, failing design's #64748B specification.",
          xPercent: 50,
          yPercent: 25,
          cssSuggestion: ".pricing-subtitle {\n  color: #64748B;\n  font-size: 15px;\n}",
          estimatedImpact: "Readability for visually impaired accessibility users.",
          classification: "unmatched",
          improvementNote: "Bump subtitle font weight slightly or swap the grey color '#94a3b8' for high-contrast '#64748B' to maintain high visual accessibility standard."
        },
        {
          id: "pricing-5",
          severity: "major",
          category: "layout",
          title: "Annual Billing Toggle Element Absent",
          description: "The Figma design Mockup includes a centered monthly vs annual toggle switch. The staging rendering is completely missing this element, blocking users from activating yearly savings.",
          xPercent: 50,
          yPercent: 12,
          cssSuggestion: ".billing-toggle-container {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 12px;\n  margin-bottom: 32px;\n}",
          estimatedImpact: "Annual recurring revenue generation targets might fail if savings aren't easily toggled.",
          classification: "missing",
          improvementNote: "Rebuild and render the missing toggle switch beneath the main pricing headings. Support active state styling and interactive savings banner labels."
        }
      ];
      setPremiumIssues(classified);
    }
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "figma" | "project"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === "figma") {
        setFigmaMode("upload");
        setRawFigmaBase64(base64);
        setUploadedFigmaBase64(base64); // Default to full uploaded image
        setUploadedFigmaName(file.name);
        setCropFigmaX(0);
        setCropFigmaY(0);
        setCropFigmaW(100);
        setCropFigmaH(100);
        setIsCroppingFigma(true);
      } else {
        setProjectMode("upload");
        setRawProjectBase64(base64);
        setUploadedProjectBase64(base64); // Default to full uploaded image
        setUploadedProjectName(file.name);
        setCropProjX(0);
        setCropProjY(0);
        setCropProjW(100);
        setCropProjH(100);
        setIsCroppingProject(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFigmaMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setIsDrawingFigma(true);
    setFigmaStartPos({ x, y });
    setCropFigmaX(Math.round(x));
    setCropFigmaY(Math.round(y));
    setCropFigmaW(1);
    setCropFigmaH(1);
  };

  const handleFigmaMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingFigma) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    const left = Math.min(figmaStartPos.x, x);
    const top = Math.min(figmaStartPos.y, y);
    const right = Math.max(figmaStartPos.x, x);
    const bottom = Math.max(figmaStartPos.y, y);

    setCropFigmaX(Math.round(left));
    setCropFigmaY(Math.round(top));
    setCropFigmaW(Math.max(1, Math.round(right - left)));
    setCropFigmaH(Math.max(1, Math.round(bottom - top)));
  };

  const handleFigmaMouseUp = () => {
    setIsDrawingFigma(false);
  };

  const handleProjMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setIsDrawingProject(true);
    setProjectStartPos({ x, y });
    setCropProjX(Math.round(x));
    setCropProjY(Math.round(y));
    setCropProjW(1);
    setCropProjH(1);
  };

  const handleProjMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingProject) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    const left = Math.min(projectStartPos.x, x);
    const top = Math.min(projectStartPos.y, y);
    const right = Math.max(projectStartPos.x, x);
    const bottom = Math.max(projectStartPos.y, y);

    setCropProjX(Math.round(left));
    setCropProjY(Math.round(top));
    setCropProjW(Math.max(1, Math.round(right - left)));
    setCropProjH(Math.max(1, Math.round(bottom - top)));
  };

  const handleProjMouseUp = () => {
    setIsDrawingProject(false);
  };

  const applyFigmaCrop = () => {
    if (!rawFigmaBase64) return;
    setCropProcessing(true);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const natWidth = img.naturalWidth;
      const natHeight = img.naturalHeight;

      // Coordinate matching math
      const sX = natWidth * (cropFigmaX / 100);
      const sY = natHeight * (cropFigmaY / 100);
      const sWidth = natWidth * (cropFigmaW / 100);
      const sHeight = natHeight * (cropFigmaH / 100);

      canvas.width = sWidth;
      canvas.height = sHeight;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, sX, sY, sWidth, sHeight, 0, 0, sWidth, sHeight);
        setUploadedFigmaBase64(canvas.toDataURL("image/png"));
      }

      setTimeout(() => {
        setCropProcessing(false);
        setIsCroppingFigma(false);
      }, 1100);
    };
    img.src = rawFigmaBase64;
  };

  const applyProjectCrop = () => {
    if (!rawProjectBase64) return;
    setCropProcessing(true);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const natWidth = img.naturalWidth;
      const natHeight = img.naturalHeight;

      // Coordinate matching math
      const sX = natWidth * (cropProjX / 100);
      const sY = natHeight * (cropProjY / 100);
      const sWidth = natWidth * (cropProjW / 100);
      const sHeight = natHeight * (cropProjH / 100);

      canvas.width = sWidth;
      canvas.height = sHeight;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, sX, sY, sWidth, sHeight, 0, 0, sWidth, sHeight);
        setUploadedProjectBase64(canvas.toDataURL("image/png"));
      }

      setTimeout(() => {
        setCropProcessing(false);
        setIsCroppingProject(false);
      }, 1100);
    };
    img.src = rawProjectBase64;
  };

  const getViewportWidthForCapture = (): number => {
    const width = currentResolutionWidth();
    return typeof width === "number" && width >= 320 && width <= 3840 ? Math.round(width) : 1280;
  };

  // Read the natural pixel width of a data-URL image. Used to capture the live site
  // at the SAME viewport width as the design export, so both images come from the
  // same responsive breakpoint (mismatched widths cause false layout findings).
  const getImageNaturalWidth = (dataUrl: string): Promise<number | null> =>
    new Promise((resolve) => {
      if (!dataUrl) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth || null);
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });

  const resolveCaptureWidth = async (designImage: string): Promise<number> => {
    const designWidth = await getImageNaturalWidth(designImage);
    if (typeof designWidth === "number" && designWidth >= 320 && designWidth <= 3840) {
      return Math.round(designWidth);
    }
    return getViewportWidthForCapture();
  };

  const runVisualQAAudit = async () => {
    setIsAuditing(true);
    setAuditProgress(5);
    setSelectedIssue(null);
    setCaptureError(null);
    setFallbackInfo(null);
    setLoadingText("Initializing alignment visual analyzer...");

    let activeDesignImage = "";
    let activeSiteImage = "";
    let usedCaptureWidth: number | null = null;
    let activeProjectName = "";

    // 1. Resolve Design Image (Figma Upload or URL)
    if (figmaMode === "upload") {
      activeDesignImage = uploadedFigmaBase64 || "";
      activeProjectName = uploadedFigmaName ? `Mockup: ${uploadedFigmaName}` : "Custom Design Reference";
    } else {
      // It's in URL/Figma mode!
      setLoadingText("Pre-rendering Figma Frame design specification...");
      setAuditProgress(10);
      try {
        const response = await fetch("/api/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: figmaUrl, type: "figma", figmaToken })
        });
        if (response.ok) {
          const resData = await response.json();
          if (resData.success && resData.base64Image) {
            activeDesignImage = resData.base64Image;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          setCaptureError(errData.error || `Could not capture the Figma URL (HTTP ${response.status}).`);
          setIsAuditing(false);
          return;
        }
      } catch (err) {
        setCaptureError("Could not reach the capture service. Is the dev server running?");
        setIsAuditing(false);
        return;
      }

      if (!activeDesignImage) {
        setCaptureError("Figma capture returned no image. Check the URL (and Figma token for private files).");
        setIsAuditing(false);
        return;
      }

      // Format custom host/file title
      let fileTitle = "Guidelines comparative audit";
      try {
        const parsed = new URL(figmaUrl);
        const segments = parsed.pathname.split("/").filter(Boolean);
        const fileIdx = segments.indexOf("file");
        if (fileIdx !== -1 && segments[fileIdx + 2]) {
          fileTitle = decodeURIComponent(segments[fileIdx + 2]).replace(/[-_]+/g, " ");
        } else {
          fileTitle = segments.pop()?.replace(/[-_]+/g, " ") || "Figma Design Frame";
        }
      } catch {
        fileTitle = "Figma Frame Spec";
      }
      activeProjectName = `Figma: ${fileTitle}`;
    }

    // 2. Resolve Site Image (Staging/Production Upload or URL)
    if (projectMode === "upload") {
      activeSiteImage = uploadedProjectBase64 || "";
    } else {
      // It's in URL/Staging mode!
      setLoadingText("Launching headless renderer to capture website screenshot...");
      setAuditProgress(25);
      try {
        const captureWidth = autoMatchWidth
          ? await resolveCaptureWidth(activeDesignImage)
          : getViewportWidthForCapture();
        usedCaptureWidth = captureWidth;
        const response = await fetch("/api/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: projectUrl, type: "staging", width: captureWidth })
        });
        if (response.ok) {
          const resData = await response.json();
          if (resData.success && resData.base64Image) {
            activeSiteImage = resData.base64Image;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          setCaptureError(errData.error || `Could not capture ${projectUrl} (HTTP ${response.status}).`);
          setIsAuditing(false);
          return;
        }
      } catch (err) {
        setCaptureError("Could not reach the capture service. Is the dev server running?");
        setIsAuditing(false);
        return;
      }

      if (!activeSiteImage) {
        setCaptureError(`Capture of ${projectUrl} returned no image.`);
        setIsAuditing(false);
        return;
      }
    }

    const ensurePngBase64 = async (imgUrl: string): Promise<string> => {
      if (!imgUrl || !imgUrl.startsWith("data:image/svg+xml")) {
        return imgUrl;
      }
      return new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || 800;
          canvas.height = img.naturalHeight || 600;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            let bgFill = "#111827";
            if (imgUrl.includes("0F172A") || imgUrl.includes("%230F172A")) bgFill = "#0F172A";
            else if (imgUrl.includes("F8FAFC") || imgUrl.includes("%23F8FAFC")) bgFill = "#F8FAFC";
            else if (imgUrl.includes("FFFFFF") || imgUrl.includes("%23FFFFFF")) bgFill = "#FFFFFF";
            else if (imgUrl.includes("111827") || imgUrl.includes("%23111827")) bgFill = "#111827";

            ctx.fillStyle = bgFill;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/png"));
          } else {
            resolve(imgUrl);
          }
        };
        img.onerror = () => {
          resolve(imgUrl);
        };
        img.src = imgUrl;
      });
    };

    // Artificial animated progress steps during the backend fetch for maximum immersion
    let progress = 25;
    const progressInterval = setInterval(() => {
      progress = Math.min(95, progress + Math.floor(Math.random() * 8) + 3);
      setAuditProgress(progress);

      if (analyzeAllResolutions) {
        if (progress < 45) {
          setLoadingText("Comparing 4K (3840px) high-DPI layout coordinate grids...");
        } else if (progress < 65) {
          setLoadingText("Processing 1920px (1080p) and 1536px standard responsive blocks...");
        } else if (progress < 80) {
          setLoadingText("Validating 1440px and 1366px laptop viewport alignments...");
        } else {
          setLoadingText("Aggregating 1280px & 1024px responsive scale break matrices...");
        }
      } else {
        if (progress < 45) {
          setLoadingText(`Extracting Mockup tokens for ${getResolutionLabel()}...`);
        } else if (progress < 70) {
          setLoadingText(`Slicing staging screenshot nodes on ${getResolutionLabel()}...`);
        } else if (progress < 85) {
          setLoadingText("Calculating spatial alignment difference matrices...");
        } else {
          setLoadingText("Generating spec correction CSS definitions...");
        }
      }
    }, 380);

    try {
      const processedDesign = await ensurePngBase64(activeDesignImage);
      const processedSite = await ensurePngBase64(activeSiteImage);

      if (!processedDesign || !processedSite) {
        setIsAuditing(false);
        setLoadingText("Missing design or live screenshot. Please re-upload.");
        return;
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          projectId: selectedScenarioId,
          designImage: processedDesign,
          siteImage: processedSite,
          projectName: activeProjectName,
          isDemo: false
        })
      });

      clearInterval(progressInterval);
      setAuditProgress(100);

      if (!response.ok) {
        throw new Error(`Visual audit API request failed with status: ${response.status}`);
      }

      const completedRun = await response.json();

      setFallbackInfo(completedRun.isFallback ? { reason: completedRun.fallbackReason || "unknown" } : null);

      // Map general issues to visual PremiumIssue items
      const mappedIssues: PremiumIssue[] = (completedRun.issues || []).map((issue: any) => ({
        ...issue,
        classification: issue.classification || (issue.category === "layout" ? "misaligned" : issue.category === "color" ? "unmatched" : "missing"),
        improvementNote: issue.improvementNote || issue.cssSuggestion || `Sync CSS properties to match standard brand layouts.`
      }));

      // Update state models with ACTUAL live results!
      setScore(completedRun.score);
      setPremiumIssues(mappedIssues);
      setCurrentDesignImage(completedRun.designImage || activeDesignImage);
      setCurrentSiteImage(completedRun.siteImage || activeSiteImage);
      setActiveRunTitle(activeProjectName);

      // Save this actual analyzed run to our history record
      const timestamp = new Date().toISOString();
      const newHistoryItem = {
        id: completedRun.id || `run-${Date.now()}`,
        projectName: activeProjectName,
        startedAt: completedRun.startedAt || timestamp,
        completedAt: completedRun.completedAt || timestamp,
        designImage: completedRun.designImage || activeDesignImage,
        siteImage: completedRun.siteImage || activeSiteImage,
        score: completedRun.score,
        issues: mappedIssues,
        status: "completed",
        resolution: analyzeAllResolutions ? "Multi-Res" : resolution,
        inputs: {
          mockup: figmaMode === "upload" ? (uploadedFigmaName || "Mockup Upload") : figmaUrl,
          staging: projectMode === "upload" ? (uploadedProjectName || "Screenshot Upload") : projectUrl
        },
        isFallback: !!completedRun.isFallback,
        archived: false
      };

      const sortedHistory = [newHistoryItem, ...historyRuns.filter(r => r.id !== newHistoryItem.id)]
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

      const processedHistory = sortedHistory.map((run, idx) => ({
        ...run,
        archived: idx >= 20
      }));

      setHistoryRuns(processedHistory);
      saveHistoryWithQuotaManagement(processedHistory);

      // Persist this pairing so Sync can re-compare without re-uploads
      if (projectMode === "url" && projectUrl && activeDesignImage) {
        const env = projectUrl.includes("localhost") || projectUrl.includes("127.0.0.1")
          ? "local" : projectUrl.includes("staging") ? "staging" : "production";
        const setup: ComparisonSetup = {
          id: activeSetup?.id || `setup-${Date.now()}`,
          name: activeProjectName || projectUrl,
          figmaImageBase64: processedDesign,
          devUrl: projectUrl,
          environmentLabel: env,
          viewportWidth: usedCaptureWidth ?? getViewportWidthForCapture(),
          createdAt: activeSetup?.createdAt || new Date().toISOString(),
        };
        setActiveSetup(setup);
        saveSetup(setup).catch((err) => console.error("Failed to persist comparison setup", err));
      }

      setIsAuditing(false);
      setIsFullscreen(true); // Automatically enter full-viewport comparative screen

      // Set URL to individual page route for visual QA audit result
      window.history.pushState({ runId: newHistoryItem.id }, "", `/audit/${newHistoryItem.id}`);

    } catch (error: any) {
      clearInterval(progressInterval);
      console.error("Visual QA Audit failed:", error);
      setLoadingText(`Audit failed: ${error.message}. Fallbacking to local scenario.`);

      // Fallback rescue so user can still test offline or if API key missing:
      setTimeout(() => {
        setIsAuditing(false);
        loadScenario(selectedScenarioId);
        setIsFullscreen(true);
        window.history.pushState({ runId: `run-${selectedScenarioId}` }, "", `/audit/run-${selectedScenarioId}`);
      }, 1500);
    }
  };

  const runSync = async (target?: ComparisonSetup) => {
    const setup = target ?? activeSetup;
    if (!setup || syncStage) return;
    setActiveSetup(setup);
    const controller = new AbortController();
    syncAbortRef.current = controller;
    setCaptureError(null);
    setFallbackInfo(null);
    setSyncStage("capturing");

    try {
      const capRes = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: setup.devUrl, type: "staging", width: setup.viewportWidth }),
        signal: controller.signal,
      });
      if (!capRes.ok) {
        const errData = await capRes.json().catch(() => ({}));
        throw new Error(errData.error || `Capture failed (HTTP ${capRes.status})`);
      }
      const capData = await capRes.json();
      if (!capData.base64Image) throw new Error("Capture returned no image.");

      setSyncStage("analyzing");
      const anaRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: setup.id,
          projectName: setup.name,
          designImage: setup.figmaImageBase64,
          siteImage: capData.base64Image,
          isDemo: false,
        }),
        signal: controller.signal,
      });
      if (!anaRes.ok) throw new Error(`Analysis failed (HTTP ${anaRes.status})`);
      const completedRun = await anaRes.json();

      setFallbackInfo(completedRun.isFallback ? { reason: completedRun.fallbackReason || "unknown" } : null);
      const mappedIssues: PremiumIssue[] = (completedRun.issues || []).map((issue: any) => ({
        ...issue,
        classification: issue.classification || (issue.category === "layout" ? "misaligned" : issue.category === "color" ? "unmatched" : "missing"),
        improvementNote: issue.improvementNote || issue.cssSuggestion || "Sync CSS properties to match standard brand layouts.",
      }));
      setScore(completedRun.score);
      setPremiumIssues(mappedIssues);
      setCurrentDesignImage(setup.figmaImageBase64);
      setCurrentSiteImage(capData.base64Image);
      setActiveRunTitle(setup.name);

      const now = new Date().toISOString();
      const newHistoryItem = {
        id: completedRun.id || `run-${Date.now()}`,
        projectName: setup.name,
        startedAt: completedRun.startedAt || now,
        completedAt: completedRun.completedAt || now,
        designImage: setup.figmaImageBase64,
        siteImage: capData.base64Image,
        score: completedRun.score,
        issues: mappedIssues,
        status: "completed",
        resolution: `${setup.viewportWidth}px`,
        inputs: { mockup: setup.name, staging: setup.devUrl },
        isFallback: !!completedRun.isFallback,
        archived: false,
      };
      const sortedHistory = [newHistoryItem, ...historyRuns.filter((r) => r.id !== newHistoryItem.id)]
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .map((run, idx) => ({ ...run, archived: idx >= 20 }));
      setHistoryRuns(sortedHistory);
      saveHistoryWithQuotaManagement(sortedHistory);

      setActiveSetup({ ...setup, lastSyncedAt: now });
      markSynced(setup.id, now).catch(() => { });
      setIsFullscreen(true);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setCaptureError(err.message || "Sync failed.");
      }
    } finally {
      syncAbortRef.current = null;
      setSyncStage(null);
    }
  };

  const cancelSync = () => {
    syncAbortRef.current?.abort();
  };

  const loadHistoryItem = (item: any) => {
    const mappedIssues: PremiumIssue[] = (item.issues || []).map((issue: any) => ({
      ...issue,
      classification: issue.classification || (issue.category === "layout" ? "misaligned" : issue.category === "color" ? "unmatched" : "missing"),
      improvementNote: issue.improvementNote || issue.cssSuggestion || `Align CSS properties to match standard spec.`
    }));

    setScore(item.score);
    setPremiumIssues(mappedIssues);
    setCurrentDesignImage(item.designImage);
    setCurrentSiteImage(item.siteImage);
    setActiveRunTitle(item.projectName || "Custom Comparative Session");
    setActiveRunId(item.id);

    // Select match preset category to highlight standard dashboard parameters accurately
    if (item.projectName && (item.projectName.includes("Hero") || item.id === "run-preset-hero")) {
      setSelectedScenarioId("preset-hero");
    } else if (item.projectName && (item.projectName.includes("Pricing") || item.id === "run-preset-pricing")) {
      setSelectedScenarioId("preset-pricing");
    }

    setIsFullscreen(true);

    // Sync URL with the individual route for the comparative QA audit result
    const expectedPath = `/audit/${item.id}`;
    if (window.location.pathname !== expectedPath) {
      window.history.pushState({ runId: item.id }, "", expectedPath);
    }
  };

  const handlePermanentDelete = (e: React.MouseEvent, runId: string) => {
    e.stopPropagation();
    setDeleteRunId(runId);
  };

  const executePermanentDelete = async (runId: string) => {
    const updated = historyRuns.filter((r: any) => r.id !== runId);
    setHistoryRuns(updated);
    await deleteRunFromIDB(runId);
    saveHistoryWithQuotaManagement(updated);
  };

  const handleRestoreRun = async (runId: string) => {
    const updated = historyRuns.map((r: any) => {
      if (r.id === runId) {
        return {
          ...r,
          archived: false,
          startedAt: new Date().toISOString() // Set timestamp to make it the latest active run
        };
      }
      return r;
    });

    const sorted = updated.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    const processed = sorted.map((run, idx) => ({
      ...run,
      archived: idx >= 20
    }));

    setHistoryRuns(processed);
    await saveHistoryWithQuotaManagement(processed);
  };

  const exportBackupJSON = () => {
    try {
      const dataStr = JSON.stringify(historyRuns, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = `veloce_visual_qa_backup_${new Date().toISOString().slice(0, 10)}.json`;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (e) {
      console.error("Failed to export backup", e);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            const validRuns = parsed.filter(run => run && typeof run === "object" && run.id);
            if (validRuns.length === 0) {
              alert("No valid Visual QA runs found in backup file.");
              return;
            }
            const existingIds = new Set(historyRuns.map(r => r.id));
            const newRuns = validRuns.filter(r => !existingIds.has(r.id));
            const merged = [...newRuns, ...historyRuns]
              .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

            const processed = merged.map((run, idx) => ({
              ...run,
              archived: run.archived !== undefined ? run.archived : idx >= 20
            }));

            setHistoryRuns(processed);
            await saveHistoryWithQuotaManagement(processed);
            alert(`Successfully restored ${validRuns.length} runs!`);
          } else {
            alert("Invalid backup file format. Must be a JSON array of runs.");
          }
        } catch (err) {
          console.error("Failed to parse backup file", err);
          alert("Error parsing backup file. Please make sure it's a valid JSON.");
        }
      };
    }
  };

  const currentResolutionWidth = () => {
    if (analyzeAllResolutions) return 1920;
    switch (resolution) {
      case "4k": return 3840;
      case "1920": return 1920;
      case "1536": return 1536;
      case "1440": return 1440;
      case "1366": return 1366;
      case "1280": return 1280;
      case "1024": return 1024;
      case "custom": return customWidth;
      default: return 1440;
    }
  };

  const getResolutionLabel = () => {
    if (analyzeAllResolutions) return "Simultaneous Multi-Res (4K - 1024px)";
    switch (resolution) {
      case "4k": return "4K UHD (3840px)";
      case "1920": return "1080p FHD (1920px)";
      case "1536": return "QHD Spec (1536px)";
      case "1440": return "WQXGA Screen (1440px)";
      case "1366": return "Standard HD+ (1366px)";
      case "1280": return "WXGA Size (1280px)";
      case "1024": return "XGA Monitor (1024px)";
      case "custom": return `Custom (${customWidth}px)`;
      default: return "1440px";
    }
  };

  // Step readiness for the guided 3-step workspace flow
  const isDesignSourceReady = figmaMode === "upload" ? !!uploadedFigmaBase64 : !!figmaUrl;
  const isDevBuildReady = projectMode === "upload" ? !!uploadedProjectBase64 : !!projectUrl;

  useEffect(() => {
    if (isDesignSourceReady && isDevBuildReady && missingInputsNudge) {
      setMissingInputsNudge(false);
    }
  }, [isDesignSourceReady, isDevBuildReady, missingInputsNudge]);

  const handleRunButtonWrapperClick = () => {
    if (!isDesignSourceReady || !isDevBuildReady) {
      setMissingInputsNudge(true);
      return;
    }
    if (!isAuditing) runVisualQAAudit();
  };

  const getClassificationColor = (classification: "missing" | "misaligned" | "unmatched") => {
    switch (classification) {
      case "missing": return "bg-rose-500 ring-rose-300 ring-4 text-white border-2 border-white";
      case "misaligned": return "bg-amber-500 ring-amber-300 ring-4 text-white border-2 border-white";
      case "unmatched": return "bg-sky-500 ring-sky-300 ring-4 text-white border-2 border-white";
    }
  };

  const getClassificationBorder = (classification: "missing" | "misaligned" | "unmatched") => {
    switch (classification) {
      case "missing": return "border-2 border-dashed border-rose-500/80 bg-rose-500/5 shadow-inner shadow-rose-200/50";
      case "misaligned": return "border-2 border-dashed border-amber-500/80 bg-amber-500/5 shadow-inner shadow-amber-200/50";
      case "unmatched": return "border-2 border-dashed border-sky-500/80 bg-sky-500/5 shadow-inner shadow-sky-200/50";
    }
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const filteredHistoryRuns = historyRuns.filter((run: any) => {
    const matchesSearch = !archiveSearchQuery
      ? true
      : run.projectName?.toLowerCase().includes(archiveSearchQuery.toLowerCase());

    const matchesResolution = archiveResolutionFilter === "all"
      ? true
      : (archiveResolutionFilter === "Multi-Res"
        ? !run.resolution
        : run.resolution === archiveResolutionFilter);

    return matchesSearch && matchesResolution;
  });

  return (
    <>
      <div className="relative min-h-screen bg-slate-50 text-slate-800 print:hidden">
        {/* Premium Header Navigation Bar */}
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 py-3.5 px-4 sm:px-8 shadow-xs no-print">
          <div className="mx-auto flex flex-col md:flex-row items-center justify-between gap-4">

            {/* Logo & Brand description */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-slate-900 to-indigo-950 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100/80 transform hover:rotate-3 transition-transform duration-200">
                <Layers className="text-emerald-400" size={19} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-sans font-bold text-base text-slate-900 tracking-tight leading-none">Veloce QA</h1>
                </div>
                <p className="text-slate-400 text-[10px] sm:text-xs font-medium tracking-wide mt-0.5">Automated Figma design visual quality assurance audits</p>
              </div>
            </div>

            {/* Actions & User State */}
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 sm:gap-3 text-xs font-sans">

              {/* Authenticated User Banner */}
              <div className="flex items-center gap-2 bg-slate-50 pl-2 pr-3 py-1 rounded-xl border border-slate-150 shadow-2xs hover:border-slate-200 transition-colors">
                {auth.currentUser?.photoURL ? (
                  <img
                    src={auth.currentUser.photoURL}
                    alt="avatar"
                    referrerPolicy="no-referrer"
                    className="w-5.5 h-5.5 rounded-full border border-slate-200"
                  />
                ) : (
                  <div className="w-5.5 h-5.5 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 shrink-0">
                    <User size={11} />
                  </div>
                )}
                <span className="text-[11px] font-medium text-slate-700 max-w-[120px] truncate">
                  {auth.currentUser?.displayName || auth.currentUser?.email?.split("@")[0] || "User"}
                </span>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 text-xs font-bold rounded-xl border border-rose-150 hover:border-rose-200 transition-all cursor-pointer"
                title="Sign Out Account"
              >
                <LogOut size={13} />
                <span>Logout</span>
              </button>
            </div>

          </div>
        </header>

        {isReuploadModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl">
              <h2 className="text-lg font-bold text-white">Re-upload Assets</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">Design</p>
                  {uploadedFigmaBase64 && <img src={uploadedFigmaBase64} className="w-full h-32 object-cover rounded-lg" alt="Figma" />}
                  <div className="flex gap-2">
                    <button onClick={() => setUploadedFigmaBase64(null)} className="text-xs text-rose-400">Clear</button>
                    <label className="text-xs text-indigo-400 cursor-pointer">Upload
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "figma")} className="hidden" />
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">Live</p>
                  {uploadedProjectBase64 && <img src={uploadedProjectBase64} className="w-full h-32 object-cover rounded-lg" alt="Project" />}
                  <div className="flex gap-2">
                    <button onClick={() => setUploadedProjectBase64(null)} className="text-xs text-rose-400">Clear</button>
                    <label className="text-xs text-indigo-400 cursor-pointer">Upload
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "project")} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setIsReuploadModalOpen(false)} className="px-4 py-2 bg-slate-800 text-white rounded-lg">Close</button>
                <button onClick={async () => {
                  setIsReuploadModalOpen(false);
                  await runVisualQAAudit();
                }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Analyze Again</button>
              </div>
            </div>
          </div>
        )}

        {/* RECENT AUDITS CARD + UPLOAD/WORKSPACE CARD (SHARED 50/50 TWO-COLUMN WRAPPER) */}
        <div className="mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-20 grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <div id="comparative-archives-card" className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xl shadow-slate-200/45 space-y-6 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200/55 border-t-4 border-t-emerald-600 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-800 text-lg tracking-tight">Recent Audits <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{historyRuns.filter(r => !r.archived).length} Active</span></h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => uploadSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl px-4 py-2 border-none cursor-pointer transition-all"
                >
                  <Plus size={13} />
                  <span>Verify New</span>
                </button>
              </div>
            </div>

            {historyRuns.filter(r => !r.archived).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No comparisons yet — verify your first build below.</p>
            ) : (
              <>
                <div className="grid grid-cols-12 gap-4 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold px-3">
                  <div className="col-span-4">Images</div>
                  <div className="col-span-3">Date</div>
                  <div className="col-span-3">Bugs Status</div>
                  <div className="col-span-2 text-center">Action</div>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {historyRuns.filter(r => !r.archived).map((run: any) => {
                    const isSampleRun = run.id?.startsWith("run-preset-") || !!run.isFallback;
                    const sampleTitle = run.isFallback ? "Demo data — Gemini was not used" : "Seeded sample run";
                    const resolvedCount = Array.isArray(run.resolvedIssueIds) ? run.resolvedIssueIds.length : null;
                    const issueCount = run.issues ? run.issues.length : 0;
                    const isUrlRun = /^https?:\/\//.test(run.inputs?.staging || "");
                    return (
                      <div
                        key={run.id}
                        className="group w-full grid grid-cols-12 gap-4 items-center p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all relative"
                      >
                        <button
                          type="button"
                          onClick={() => loadHistoryItem(run)}
                          className="col-span-10 grid grid-cols-10 gap-4 items-center text-left border-none bg-transparent p-0 cursor-pointer"
                        >
                          <div className="col-span-4 flex gap-1">
                            <img src={run.designImage || null} className="w-16 h-16 object-cover rounded bg-slate-100" />
                            <img src={run.siteImage || null} className="w-16 h-16 object-cover rounded bg-slate-100" />
                          </div>
                          <div className="col-span-3 text-[10px] text-slate-600 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span>{new Date(run.startedAt).toLocaleDateString()}</span>
                              {isSampleRun && (
                                <span
                                  className="text-[8px] px-1 py-0.5 rounded uppercase font-bold bg-amber-100 text-amber-700 shrink-0"
                                  title={sampleTitle}
                                >
                                  SAMPLE
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 mt-0.5">{new Date(run.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                          </div>
                          <div className="col-span-3 w-full text-[10px] text-slate-600 flex items-center">
                            <span className={`text-[10px] px-2 py-1 rounded-md font-bold ${issueCount === 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                              }`}>
                              {resolvedCount !== null ? `${resolvedCount}/${issueCount} solved` : `${issueCount} issue${issueCount === 1 ? "" : "s"}`}
                            </span>
                          </div>
                        </button>
                        <div className="col-span-2 flex justify-end items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              loadHistoryItem(run);
                            }}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 border-none cursor-pointer"
                            title="View comparison"
                          >
                            <Eye size={13} />
                          </button>
                          {isUrlRun && !isSampleRun && (
                            <button
                              type="button"
                              disabled={!!syncStage || isAuditing}
                              onClick={(e) => {
                                e.stopPropagation();
                                const setupFromRun: ComparisonSetup = {
                                  id: `setup-${run.id}`,
                                  name: run.projectName || run.inputs?.mockup || "Saved comparison",
                                  figmaImageBase64: run.designImage,
                                  devUrl: run.inputs.staging,
                                  environmentLabel: run.inputs.staging.includes("localhost") || run.inputs.staging.includes("127.0.0.1") ? "local" : run.inputs.staging.includes("staging") ? "staging" : "production",
                                  viewportWidth: parseInt(String(run.resolution || "").match(/(\d{3,4})/)?.[1] || "1280", 10),
                                  createdAt: run.startedAt || new Date().toISOString(),
                                };
                                runSync(setupFromRun);
                              }}
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Re-capture the dev URL and re-compare"
                            >
                              <RefreshCw size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handlePermanentDelete(e, run.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 border-none cursor-pointer"
                            title="Delete this run"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* UPLOAD / WORKSPACE CARD (STEP 1/2/3, RESOLUTION, RUN BUTTON) */}
          <div ref={uploadSectionRef} className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xl shadow-slate-200/45 space-y-6 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200/55 border-t-4 border-t-emerald-600 relative">

            {/* DUAL WORKSPACE CAPTURES (STAGE A & STAGE B GRID) */}
            <div className="grid grid-cols-1 gap-6">

              {/* STEP 1: FIGMA DESIGN INPUTS & LIVE CROP FRAME */}
              <div className={`bg-slate-50/40 rounded-2xl border p-5 space-y-4 transition-all ${missingInputsNudge && !isDesignSourceReady ? "border-rose-300 ring-2 ring-rose-300" : "border-slate-150"
                }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${isDesignSourceReady ? "bg-emerald-600 text-white" : "bg-pink-100 text-pink-600"
                      }`}>
                      {isDesignSourceReady ? <Check size={16} /> : "①"}
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-mono tracking-widest text-slate-400 font-bold block">Step 1</span>
                      <span className="text-xs font-bold text-slate-800 block leading-tight flex items-center gap-1.5">
                        Design Source (Figma)
                        {isDesignSourceReady && <CheckCircle size={12} className="text-emerald-600" />}
                      </span>
                    </div>
                  </div>

                  <div className="flex bg-slate-150/80 p-0.5 rounded-xl border border-slate-200 self-start sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setFigmaMode("url")}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border-none ${figmaMode === "url" ? "bg-white text-slate-8 w-max shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      Figma URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setFigmaMode("upload")}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border-none ${figmaMode === "upload" ? "bg-white text-slate-8 w-max shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      Upload Mockup Image
                    </button>
                  </div>
                </div>

                {figmaMode === "url" ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full bg-white border border-slate-200/90 rounded-xl py-3 pl-10 pr-4 text-xs font-mono text-slate-600 focus:outline-emerald-500"
                        value={figmaUrl}
                        onChange={(e) => setFigmaUrl(e.target.value)}
                        placeholder="https://www.figma.com/design/:fileKey/:title?node-id=:nodeId"
                      />
                      <div className="absolute left-3.5 top-3.5 text-pink-500">
                        <Figma size={14} />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 -mt-1">
                      Public files render best-effort. Private files need a Figma token.
                    </p>

                    {/* FIGMA API ACCESS WORKFLOW */}
                    <div className="bg-slate-50/50 border border-slate-200/60 p-3.5 rounded-xl space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Key size={13} className="text-pink-500 animate-pulse" />
                          <span className="text-[10px] font-bold text-slate-700 tracking-tight uppercase font-mono">
                            Figma Developer Access
                          </span>
                        </div>
                        <a
                          href="https://www.figma.com/developers/api#access-tokens"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-pink-600 hover:text-pink-700 font-extrabold flex items-center gap-0.5 no-underline transition-all hover:translate-x-0.5"
                        >
                          Generate Token ↗
                        </a>
                      </div>

                      <div className="relative">
                        <input
                          type="password"
                          className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-8 pr-3 text-[10px] font-mono text-slate-700 placeholder-slate-400 focus:outline-emerald-500"
                          placeholder="Paste Figma Personal Access Token to get actual frames..."
                          value={figmaToken}
                          onChange={(e) => setFigmaToken(e.target.value)}
                        />
                        <span className="absolute left-2.5 top-2.5 text-slate-400">🔑</span>
                        {figmaToken && (
                          <button
                            type="button"
                            onClick={() => setFigmaToken("")}
                            className="absolute right-2.5 top-2 ml-0.5 text-slate-455 hover:text-rose-500 text-[10px] cursor-pointer border-none bg-transparent font-bold"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Image Cropper Component embedded inside popup modal */}
                    {rawFigmaBase64 && isCroppingFigma ? (
                      <div className="bg-pink-50/20 border border-dashed border-pink-200 p-5 rounded-2xl text-center space-y-3 animate-fade-in shadow-xs">
                        <div className="flex items-center justify-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                          </span>
                          <span className="text-[10px] font-mono font-bold text-pink-600 uppercase tracking-wider">Crop Workspace Active inside Popup</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsCroppingFigma(true)}
                          className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-xs hover:shadow-sm flex items-center gap-1.5 mx-auto border-none cursor-pointer"
                        >
                          <Figma size={13} /> Open Cropping Popup Workspace
                        </button>
                      </div>
                    ) : uploadedFigmaBase64 ? (
                      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 animate-fade-in text-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden border bg-slate-100 flex-shrink-0 relative">
                            <img src={uploadedFigmaBase64 || null} alt="Cropped figma" className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 line-clamp-1">{uploadedFigmaName}</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setIsCroppingFigma(true)}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 text-emerald-800 hover:text-emerald-950 font-bold border border-slate-150 rounded-lg text-[10px] transition-all cursor-pointer"
                          >
                            ✂ Recrop
                          </button>
                          <label className="px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 text-emerald-800 hover:text-emerald-950 font-bold border border-slate-150 rounded-lg text-[10px] transition-all cursor-pointer">
                            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "figma")} className="hidden" />
                            Re-upload
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadedFigmaBase64(null);
                              setRawFigmaBase64(null);
                            }}
                            className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 font-bold border border-rose-150 rounded-lg text-[10px] transition-all cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="w-full h-24 border-2 border-dashed border-slate-250 hover:border-emerald-500 rounded-xl flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all gap-1 bg-white hover:bg-emerald-50/10">
                        <Upload size={18} className="text-slate-400" />
                        <span className="text-xs font-semibold text-slate-600">Select Mockup JPG / PNG / JPEG file</span>
                        <span className="text-[10px] text-slate-400">Drag & drop asset or click to browse files</span>
                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "figma")} className="hidden" />
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* STEP 2: PROJECT IMPLEMENTATION SNAPSHOTS & LIVE CROP FRAME */}
              <div className={`bg-slate-50/40 rounded-2xl border p-5 space-y-4 transition-all ${missingInputsNudge && !isDevBuildReady ? "border-rose-300 ring-2 ring-rose-300" : "border-slate-150"
                }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${isDevBuildReady ? "bg-emerald-600 text-white" : "bg-sky-100 text-sky-600"
                      }`}>
                      {isDevBuildReady ? <Check size={16} /> : "②"}
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-mono tracking-widest text-slate-400 font-bold block">Step 2</span>
                      <span className="text-xs font-bold text-slate-800 block leading-tight flex items-center gap-1.5">
                        Development Build
                        {isDevBuildReady && <CheckCircle size={12} className="text-emerald-600" />}
                      </span>
                    </div>
                  </div>

                  <div className="flex bg-slate-150/80 p-0.5 rounded-xl border border-slate-200 self-start sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setProjectMode("url")}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border-none ${projectMode === "url" ? "bg-white text-slate-8 w-max shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      Developed URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectMode("upload")}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border-none ${projectMode === "upload" ? "bg-white text-slate-8 w-max shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      Upload Image
                    </button>
                  </div>
                </div>

                {projectMode === "url" ? (
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200/90 rounded-xl py-3 pl-10 pr-4 text-xs font-mono text-slate-600 focus:outline-emerald-500"
                      value={projectUrl}
                      onChange={(e) => setProjectUrl(e.target.value)}
                      placeholder="http://localhost:3000 or staging deployment link"
                    />
                    <div className="absolute left-3.5 top-3.5 text-sky-500">
                      <Globe size={14} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Image Cropper for screenshot inside popup modal */}
                    {rawProjectBase64 && isCroppingProject ? (
                      <div className="bg-sky-50/20 border border-dashed border-sky-300 p-5 rounded-2xl text-center space-y-3 animate-fade-in shadow-xs">
                        <div className="flex items-center justify-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-505"></span>
                          </span>
                          <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-wider">Crop Workspace Active inside Popup</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsCroppingProject(true)}
                          className="px-4 py-2 bg-sky-650 hover:bg-sky-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-xs hover:shadow-sm flex items-center gap-1.5 mx-auto border-none cursor-pointer"
                        >
                          <Globe size={13} /> Open Screenshot Crop Workspace
                        </button>
                      </div>
                    ) : uploadedProjectBase64 ? (
                      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 animate-fade-in text-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden border bg-slate-100 flex-shrink-0 relative">
                            <img src={uploadedProjectBase64 || null} alt="Cropped live" className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 line-clamp-1">{uploadedProjectName}</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setIsCroppingProject(true)}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 text-emerald-850 hover:text-emerald-950 font-bold border border-slate-150 rounded-lg text-[10px] transition-all cursor-pointer"
                          >
                            ✂ Recrop
                          </button>
                          <label className="px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 text-emerald-850 hover:text-emerald-950 font-bold border border-slate-150 rounded-lg text-[10px] transition-all cursor-pointer">
                            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "project")} className="hidden" />
                            Re-upload
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadedProjectBase64(null);
                              setRawProjectBase64(null);
                            }}
                            className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 font-bold border border-rose-150 rounded-lg text-[10px] transition-all cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="w-full h-24 border-2 border-dashed border-slate-250 hover:border-emerald-500 rounded-xl flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all gap-1 bg-white hover:bg-emerald-50/10">
                        <Upload size={18} className="text-slate-400" />
                        <span className="text-xs font-semibold text-slate-600">Select Developed Captured Screenshot JPG / PNG</span>
                        <span className="text-[10px] text-slate-400">Drag & drop asset or click to browse files</span>
                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "project")} className="hidden" />
                      </label>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* STEP 3: TARGET VIEWPORT RESOLUTION BLOCK & ALL RESOLUTION TOGGLE */}
            <div className="!hidden space-y-4 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8.5 h-8.5 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0">
                    ③
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-mono tracking-widest text-slate-400 font-bold block">Step 3</span>
                    <span className="text-xs font-bold text-slate-800 block leading-tight">Test Multiple Target Viewport Resolutions</span>
                  </div>
                </div>

                {/* Resolution Header with Toggle All Switch */}
                {/* <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      Test Multiple Target Viewport Resolutions
                    </h4>
                    {autoMatchWidth && !analyzeAllResolutions && (
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">
                        Auto — matches your design's width
                      </span>
                    )}
                  </div> */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-mono font-bold text-slate-500 uppercase">
                    {analyzeAllResolutions ? "All Breakpoints Enable" : "Manual Selection Unlock"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAnalyzeAllResolutions(!analyzeAllResolutions)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${analyzeAllResolutions ? "bg-emerald-600" : "bg-slate-200"
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${analyzeAllResolutions ? "translate-x-5" : "translate-x-0"
                        }`}
                    />
                  </button>
                </div>
                {/* </div> */}
              </div>

              {/* Viewport Selectors Grid */}
              <div className={`flex flex-wrap justify-between transition-all duration-300 ${analyzeAllResolutions || autoMatchWidth ? "opacity-45" : "opacity-100"
                } ${analyzeAllResolutions ? "pointer-events-none pr-none" : ""}`}>
                {/* 4K Button */}
                <button
                  type="button"
                  disabled={analyzeAllResolutions}
                  onClick={() => { setResolution("4k"); setAutoMatchWidth(false); }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center border-none ${resolution === "4k" && !analyzeAllResolutions && !autoMatchWidth ? "bg-emerald-600 text-white shadow-xs font-black" : "bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-600"
                    }`}
                >
                  <Monitor size={14} className="mb-1" />
                  <span className="text-[10px] font-bold block">4K UHD</span>
                  <span className="text-[8px] opacity-80 block font-mono">3840px Width</span>
                </button>

                {/* 1920 Button */}
                <button
                  type="button"
                  disabled={analyzeAllResolutions}
                  onClick={() => { setResolution("1920"); setAutoMatchWidth(false); }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center border-none ${resolution === "1920" && !analyzeAllResolutions && !autoMatchWidth ? "bg-emerald-600 text-white shadow-xs font-black" : "bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-600"
                    }`}
                >
                  <Monitor size={14} className="mb-1" />
                  <span className="text-[10px] font-bold block">1080p FHD</span>
                  <span className="text-[8px] opacity-80 block font-mono">1920px Width</span>
                </button>

                {/* 1536 Button */}
                <button
                  type="button"
                  disabled={analyzeAllResolutions}
                  onClick={() => { setResolution("1536"); setAutoMatchWidth(false); }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center border-none ${resolution === "1536" && !analyzeAllResolutions && !autoMatchWidth ? "bg-emerald-600 text-white shadow-xs font-black" : "bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-600"
                    }`}
                >
                  <Laptop size={14} className="mb-1" />
                  <span className="text-[10px] font-bold block">QHD Viewport</span>
                  <span className="text-[8px] opacity-80 block font-mono">1536px Width</span>
                </button>

                {/* 1440 Button */}
                <button
                  type="button"
                  disabled={analyzeAllResolutions}
                  onClick={() => { setResolution("1440"); setAutoMatchWidth(false); }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center border-none ${resolution === "1440" && !analyzeAllResolutions && !autoMatchWidth ? "bg-emerald-600 text-white shadow-xs font-black" : "bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-600"
                    }`}
                >
                  <Laptop size={14} className="mb-1" />
                  <span className="text-[10px] font-bold block">WQXGA Layout</span>
                  <span className="text-[8px] opacity-80 block font-mono">1440px Width</span>
                </button>

                {/* 1366 Button */}
                <button
                  type="button"
                  disabled={analyzeAllResolutions}
                  onClick={() => { setResolution("1366"); setAutoMatchWidth(false); }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center border-none ${resolution === "1366" && !analyzeAllResolutions && !autoMatchWidth ? "bg-emerald-600 text-white shadow-xs font-black" : "bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-600"
                    }`}
                >
                  <Laptop size={14} className="mb-1" />
                  <span className="text-[10px] font-bold block">Standard HD+</span>
                  <span className="text-[8px] opacity-80 block font-mono">1366px Width</span>
                </button>

                {/* 1280 Button */}
                <button
                  type="button"
                  disabled={analyzeAllResolutions}
                  onClick={() => { setResolution("1280"); setAutoMatchWidth(false); }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center border-none ${resolution === "1280" && !analyzeAllResolutions && !autoMatchWidth ? "bg-emerald-600 text-white shadow-xs font-black" : "bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-600"
                    }`}
                >
                  <Tablet size={14} className="mb-1" />
                  <span className="text-[10px] font-bold block">WXGA Screen</span>
                  <span className="text-[8px] opacity-80 block font-mono">1280px Width</span>
                </button>

                {/* 1024 Button */}
                <button
                  type="button"
                  disabled={analyzeAllResolutions}
                  onClick={() => { setResolution("1024"); setAutoMatchWidth(false); }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center border-none ${resolution === "1024" && !analyzeAllResolutions && !autoMatchWidth ? "bg-emerald-600 text-white shadow-xs font-black" : "bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-600"
                    }`}
                >
                  <Tablet size={14} className="mb-1" />
                  <span className="text-[10px] font-bold block">XGA Monitor</span>
                  <span className="text-[8px] opacity-80 block font-mono">1024px Width</span>
                </button>
              </div>

              {!analyzeAllResolutions && !autoMatchWidth && resolution === "custom" && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex items-center gap-4 animate-slide-up">
                  <span className="text-xs font-mono text-slate-500 shrink-0">Width: {customWidth}px</span>
                  <input
                    type="range"
                    min="320"
                    max="1920"
                    step="20"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(parseInt(e.target.value))}
                    className="flex-1 accent-emerald-600 h-1"
                  />
                  <input
                    type="number"
                    min="320"
                    max="1920"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(parseInt(e.target.value) || 1280)}
                    className="w-20 bg-white text-xs border rounded-lg p-1.5 focus:outline-none focus:border-emerald-500 text-center"
                  />
                </div>
              )}
            </div>

            {/* TIMELINE LOADER ACTIONS & LAUNCHER */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              {fallbackInfo && <FallbackBanner reason={fallbackInfo.reason} />}

              {captureError && (
                <div className="w-full bg-rose-50 border border-rose-500/60 text-rose-500/60 rounded-xl px-4 py-3 text-xs font-semibold">
                  Capture failed: {captureError}
                </div>
              )}

              {isAuditing && (
                <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 border border-slate-800 space-y-4 animate-pulse">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      <span className="font-mono text-emerald-400 uppercase tracking-widest">{loadingText}</span>
                    </div>
                    <span className="text-slate-400 font-mono font-bold">{auditProgress}% COMPLETE</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${auditProgress}%` }}></div>
                  </div>
                </div>
              )}

              {missingInputsNudge && (!isDesignSourceReady || !isDevBuildReady) && (
                <p className="text-[11px] font-semibold text-rose-500 text-center animate-fade-in">
                  Add your Figma design and development build first
                </p>
              )}

              <div onClick={handleRunButtonWrapperClick}>
                <button
                  type="button"
                  disabled={isAuditing || !isDesignSourceReady || !isDevBuildReady}
                  className={`w-full py-4 text-sm font-bold rounded-2xl text-white flex flex-col items-center justify-center gap-0.5 shadow-sm transition-all scale-100 border-none ${isAuditing || !isDesignSourceReady || !isDevBuildReady
                    ? "bg-emerald-600/50 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.005] cursor-pointer"
                    }`}
                >
                  <span className="flex items-center gap-2">
                    <Play size={13} fill="white" />
                    Run Visual Comparison
                  </span>
                  {/* <span className="text-[10px] font-mono font-normal opacity-80">
                    {analyzeAllResolutions
                      ? getResolutionLabel()
                      : autoMatchWidth
                        ? "width auto-matched to design"
                        : `at ${currentResolutionWidth()}px`}
                  </span> */}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* FULLSCREEN COMPARISON OVERVIEW PORTAL */}
        {isFullscreen && (
          <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col animate-fade-in text-white overflow-hidden select-none">

            {/* HEADER HEADER BAR */}
            <header className="bg-slate-950 border-b border-slate-800/80 p-3 px-6 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xl relative z-30">
              {fallbackInfo && <FallbackBanner reason={fallbackInfo.reason} />}

              {/* Left Brand Area */}
              <div className="flex items-center gap-3">
                <div className="space-y-0.5">
                  <h2 className="font-display font-extrabold text-xs tracking-tight text-white flex items-center gap-1.5 uppercase">
                    Development
                  </h2>
                  <p className="text-slate-400 text-[9px] uppercase font-mono tracking-widest leading-none">
                    Staging • <span className="text-indigo-400 font-semibold">{activeRunTitle}</span>
                  </p>
                </div>
              </div>

              {/* Middle: Control Toggles */}
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-900 border border-slate-700/50 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFullscreenCompareMode("side-by-side")}
                    className={`p-1.5 rounded text-xs ${fullscreenCompareMode === "side-by-side" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                  >
                    <Columns size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFullscreenCompareMode("overlapped")}
                    className={`p-1.5 rounded text-xs ${fullscreenCompareMode === "overlapped" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                  >
                    <Eye size={14} />
                  </button>
                </div>

                {fullscreenCompareMode === "overlapped" && (
                  <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={fullscreenOpacity}
                    onChange={(e) => setFullscreenOpacity(parseFloat(e.target.value))}
                    className="w-20 accent-indigo-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                )}
              </div>

              {/* Right Group: Stats, Metric, Close */}
              <div className="flex items-center gap-3">
                <div className="hidden lg:flex items-center gap-2 bg-slate-900/40 px-3 py-1 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono text-emerald-400">{resolvedIssueIds.length}/{premiumIssues.length} Solved</span>
                </div>

                {/* Sync and Re-analyze */}
                <button
                  type="button"
                  disabled={!!syncStage || isAuditing || (!activeSetup && figmaMode === "upload" && projectMode === "upload")}
                  onClick={() => {
                    if (activeSetup) {
                      runSync();
                    } else {
                      setLoadingText("Syncing and Re-analyzing...");
                      runVisualQAAudit(); // no saved URL setup — fall back to re-running the current inputs
                    }
                  }}
                  title={activeSetup ? `Re-capture ${activeSetup.devUrl} and re-compare` : "Re-run the audit with current inputs"}
                  className={`px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 ${(syncStage || isAuditing) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} shadow-sm border border-slate-700`}
                >
                  <RefreshCw size={13} className={(syncStage || isAuditing) ? 'animate-spin' : ''} />
                  <span>{syncStage ? 'Syncing...' : 'Sync'}</span>
                </button>

                {/* Export Menu Dropdown */}
                <button
                  type="button"
                  onClick={() => setIsReuploadModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border border-slate-700"
                >
                  <Upload size={13} />
                  <span>Re-upload</span>
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 active:bg-indigo-800 text-white font-extrabold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border-none"
                    title="Export analysis findings"
                  >
                    <Share2 size={13} />
                    <span>Export Report</span>
                  </button>

                  {showExportMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40 cursor-default"
                        onClick={() => setShowExportMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-2.5 text-left">
                        <div className="px-2 pb-1.5 mb-1.5 border-b border-slate-800">
                          <p className="text-[9px] uppercase font-mono tracking-widest text-slate-400 font-bold">Choose Format</p>
                        </div>

                        {exportFeedback && (
                          <div className="mb-2 px-2 py-1 bg-emerald-950/40 border border-emerald-900/50 rounded-lg text-[10px] text-emerald-400 font-medium font-mono text-center">
                            {exportFeedback}
                          </div>
                        )}

                        <button
                          onClick={() => {
                            handleExportHTML();
                            setShowExportMenu(false);
                          }}
                          className="w-full text-left p-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-all text-xs font-medium flex items-center gap-2 cursor-pointer border-none bg-transparent"
                        >
                          <FileText size={13} className="text-sky-400" />
                          <div>
                            <p className="font-bold text-[11px]">Interactive HTML Report</p>
                            <p className="text-[9px] text-slate-500 font-normal">Offline-first, styled QA dashboard</p>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setShowExportMenu(false);
                            setTimeout(() => window.print(), 100);
                          }}
                          className="w-full text-left p-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-all text-xs font-medium flex items-center gap-2 cursor-pointer border-none bg-transparent"
                        >
                          <Printer size={13} className="text-emerald-400" />
                          <div>
                            <p className="font-bold text-[11px]">Direct Print / Save PDF</p>
                            <p className="text-[9px] text-slate-500 font-normal">Standard browser print to PDF</p>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            handleExportJSON();
                            setShowExportMenu(false);
                          }}
                          className="w-full text-left p-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-all text-xs font-medium flex items-center gap-2 cursor-pointer border-none bg-transparent"
                        >
                          <Code size={13} className="text-amber-400" />
                          <div>
                            <p className="font-bold text-[11px]">Raw JSON Log</p>
                            <p className="text-[9px] text-slate-500 font-normal">Programmatic structured data</p>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => {
                    setIsFullscreen(false);
                    setSelectedIssue(null);
                    setActiveRunId(null);
                    window.history.pushState(null, "", "/");
                  }}
                  className="p-2 rounded-full bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-800"
                  title="Exit Comparison Room"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            {/* CONTROL BAR SHELF FOR EXPERT COMPONENT ALIGNMENT */}
            <div className="bg-slate-900/90 hidden backdrop-blur-md border-b border-slate-800/80 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 z-20 shrink-0 shadow-md">
              {/* Left Hand: Mode Selector Toggles */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Compare Strategy:</span>
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setFullscreenCompareMode("side-by-side")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${fullscreenCompareMode === "side-by-side"
                      ? "bg-indigo-650 text-white shadow-[0_2px_8px_rgba(99,102,241,0.3)] font-extrabold scale-102"
                      : "text-slate-405 hover:text-white hover:bg-slate-900/50"
                      }`}
                  >
                    <Columns size={12} />
                    Side By Side
                  </button>
                  <button
                    type="button"
                    onClick={() => setFullscreenCompareMode("overlapped")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${fullscreenCompareMode === "overlapped"
                      ? "bg-indigo-650 text-white shadow-[0_2px_8px_rgba(99,102,241,0.3)] font-extrabold scale-102"
                      : "text-slate-405 hover:text-white hover:bg-slate-900/50"
                      }`}
                  >
                    <Eye size={12} />
                    Overlapped Layout
                  </button>
                </div>
              </div>

              {/* Middle: Manage project alpha level when in overlap mode */}
              {fullscreenCompareMode === "overlapped" && (
                <div className="flex items-center gap-3 bg-slate-950/60 px-4 py-1.5 rounded-xl border border-slate-850/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">Foreground Staging Opacity:</span>
                  <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={fullscreenOpacity}
                    onChange={(e) => setFullscreenOpacity(parseFloat(e.target.value))}
                    className="w-32 accent-indigo-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono font-black text-indigo-400 min-w-[34px] text-right">
                    {Math.round(fullscreenOpacity * 100)}%
                  </span>
                </div>
              )}

              {/* Right Side: Quick calibration panel toggle + reset */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowFullscreenAlignmentControls(prev => {
                      if (!prev) {
                        handleSelectIssue(null); // Close issue slides to avoid layout conflicts
                      }
                      return !prev;
                    });
                  }}
                  className={`px-3.5 py-1.8 text-xs font-bold rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${showFullscreenAlignmentControls
                    ? "bg-indigo-600/15 border-indigo-500/80 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                    : "bg-slate-850 border-slate-755 text-slate-350 hover:text-white"
                    }`}
                >
                  <Sliders size={13} />
                  <span>{showFullscreenAlignmentControls ? "Close Calibration Panel" : "Open Alignment Tools"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFigmaX(0);
                    setFigmaY(0);
                    setProjectXOffsetGlobal(0);
                    setProjectYOffsetGlobal(0);
                    setZoomFigma(1.0);
                    setZoomProject(1.0);
                    setOverlapScale(1.0);
                    setOverlapXOffset(0);
                    setOverlapYOffset(0);
                    setBgOverlapScale(1.0);
                    setBgOverlapXOffset(0);
                    setBgOverlapYOffset(0);
                  }}
                  className="px-3.5 py-1.8 text-xs font-bold rounded-xl border border-rose-900/45 bg-rose-955/10 hover:bg-rose-950/35 text-rose-400 hover:text-rose-300 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
                  title="Reset figma and staging offsets"
                >
                  <RotateCcw size={12} />
                  <span>Reset Alignment</span>
                </button>
              </div>
            </div>

            {/* MAIN CONTAINER SPLIT SCREEN & TRANSLATION SCROLLING */}
            <div className="flex-1 overflow-hidden relative flex">

              {/* OVERLAPPED COMPARISON VIEW LAYOUT BRANCH */}
              {fullscreenCompareMode === "overlapped" ? (
                <div
                  className={`flex-1 h-full flex transition-all duration-500 ease-in-out relative bg-slate-950 overflow-auto p-3 select-none justify-center items-start ${(selectedIssue || showFullscreenAlignmentControls) ? "w-1/2" : "w-full"
                    }`}
                >
                  {/* Fixed Overlay helper tag */}
                  <div className="absolute top-4 left-4 bg-indigo-950/90 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-slate-205 rounded-xl border border-indigo-900/60 z-[60] flex items-center gap-2 shadow-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    <span>Alignment Active</span>
                    <button onClick={() => setShowAlignmentPopup(!showAlignmentPopup)} className="p-1 hover:bg-slate-700/50 rounded text-slate-400 hover:text-white">
                      <Sliders size={14} />
                    </button>
                  </div>

                  {showAlignmentPopup && (
                    <div className="absolute top-16 left-4 bg-slate-900 border border-slate-700 p-4 rounded-xl z-[70] w-64 shadow-2xl space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Layer Overrides</h3>
                        <button
                          onClick={() => {
                            if (overlapAlignmentTab === "foreground") {
                              setOverlapScale(1.0);
                              setOverlapXOffset(0);
                              setOverlapYOffset(0);
                            } else {
                              setBgOverlapScale(1.0);
                              setBgOverlapXOffset(0);
                              setBgOverlapYOffset(0);
                            }
                          }}
                          className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors font-bold cursor-pointer"
                          title="Reset selected layer overrides"
                        >
                          Reset Layer
                        </button>
                      </div>

                      {/* Tab selector */}
                      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                        <button
                          onClick={() => setOverlapAlignmentTab("foreground")}
                          className={`flex-1 text-[10px] font-bold py-1 px-2 rounded-md transition-all cursor-pointer text-center ${overlapAlignmentTab === "foreground"
                            ? "bg-indigo-650/40 border border-indigo-500/50 text-indigo-200"
                            : "text-slate-400 hover:text-white border border-transparent"
                            }`}
                        >
                          Foreground (Live)
                        </button>
                        <button
                          onClick={() => setOverlapAlignmentTab("background")}
                          className={`flex-1 text-[10px] font-bold py-1 px-2 rounded-md transition-all cursor-pointer text-center ${overlapAlignmentTab === "background"
                            ? "bg-pink-650/40 border border-pink-500/50 text-pink-200"
                            : "text-slate-400 hover:text-white border border-transparent"
                            }`}
                        >
                          Background (Figma)
                        </button>
                      </div>

                      {/* Tab Panels */}
                      {overlapAlignmentTab === "foreground" ? (
                        <div className="space-y-3 animate-fade-in">
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] text-slate-400 font-medium">Foreground Scale</label>
                              <span className="text-[10px] text-indigo-400 font-mono font-bold">{overlapScale.toFixed(2)}x</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setOverlapScale(Math.max(0.5, Math.min(2, Math.round((overlapScale - 0.01) * 100) / 100)))}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                                title="Decrease by 0.1"
                              >
                                <Minus size={10} strokeWidth={3} />
                              </button>
                              <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.01"
                                value={overlapScale}
                                onChange={(e) => setOverlapScale(parseFloat(e.target.value))}
                                className="flex-1 accent-indigo-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => setOverlapScale(Math.max(0.5, Math.min(2, Math.round((overlapScale + 0.01) * 100) / 100)))}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                                title="Increase by 0.1"
                              >
                                <Plus size={10} strokeWidth={3} />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] text-slate-400 font-medium">Top Offset</label>
                              <span className="text-[10px] text-indigo-400 font-mono font-bold">{overlapYOffset.toFixed(1)}px</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setOverlapYOffset(Math.max(-1000, Math.min(1000, overlapYOffset - 10)))}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                                title="Decrease by 10"
                              >
                                <Minus size={10} strokeWidth={3} />
                              </button>
                              <input
                                type="range"
                                min="-1000"
                                max="1000"
                                step="0.1"
                                value={overlapYOffset}
                                onChange={(e) => setOverlapYOffset(parseFloat(e.target.value))}
                                className="flex-1 accent-indigo-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => setOverlapYOffset(Math.max(-1000, Math.min(1000, overlapYOffset + 10)))}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                                title="Increase by 10"
                              >
                                <Plus size={10} strokeWidth={3} />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] text-slate-400 font-medium">Left Offset</label>
                              <span className="text-[10px] text-indigo-400 font-mono font-bold">{overlapXOffset.toFixed(1)}px</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setOverlapXOffset(Math.max(-1000, Math.min(1000, overlapXOffset - 10)))}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                                title="Decrease by 10"
                              >
                                <Minus size={10} strokeWidth={3} />
                              </button>
                              <input
                                type="range"
                                min="-1000"
                                max="1000"
                                step="0.1"
                                value={overlapXOffset}
                                onChange={(e) => setOverlapXOffset(parseFloat(e.target.value))}
                                className="flex-1 accent-indigo-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => setOverlapXOffset(Math.max(-1000, Math.min(1000, overlapXOffset + 10)))}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                                title="Increase by 10"
                              >
                                <Plus size={10} strokeWidth={3} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 animate-fade-in">
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] text-slate-400 font-medium">Background Scale</label>
                              <span className="text-[10px] text-pink-400 font-mono font-bold">{bgOverlapScale.toFixed(2)}x</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setBgOverlapScale(Math.max(0.5, Math.min(2, Math.round((bgOverlapScale - 0.01) * 100) / 100)))}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                                title="Decrease by 0.1"
                              >
                                <Minus size={10} strokeWidth={3} />
                              </button>
                              <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.01"
                                value={bgOverlapScale}
                                onChange={(e) => setBgOverlapScale(parseFloat(e.target.value))}
                                className="flex-1 accent-pink-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => setBgOverlapScale(Math.max(0.5, Math.min(2, Math.round((bgOverlapScale + 0.01) * 100) / 100)))}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                                title="Increase by 0.1"
                              >
                                <Plus size={10} strokeWidth={3} />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] text-slate-400 font-medium">Top Offset</label>
                              <span className="text-[10px] text-pink-400 font-mono font-bold">{bgOverlapYOffset.toFixed(1)}px</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setBgOverlapYOffset(Math.max(-1000, Math.min(1000, bgOverlapYOffset - 10)))}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                                title="Decrease by 10"
                              >
                                <Minus size={10} strokeWidth={3} />
                              </button>
                              <input
                                type="range"
                                min="-1000"
                                max="1000"
                                step="0.1"
                                value={bgOverlapYOffset}
                                onChange={(e) => setBgOverlapYOffset(parseFloat(e.target.value))}
                                className="flex-1 accent-pink-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => setBgOverlapYOffset(Math.max(-1000, Math.min(1000, bgOverlapYOffset + 10)))}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                                title="Increase by 10"
                              >
                                <Plus size={10} strokeWidth={3} />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] text-slate-400 font-medium">Left Offset</label>
                              <span className="text-[10px] text-pink-400 font-mono font-bold">{bgOverlapXOffset.toFixed(1)}px</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setBgOverlapXOffset(Math.max(-1000, Math.min(1000, bgOverlapXOffset - 10)))}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                                title="Decrease by 10"
                              >
                                <Minus size={10} strokeWidth={3} />
                              </button>
                              <input
                                type="range"
                                min="-1000"
                                max="1000"
                                step="0.1"
                                value={bgOverlapXOffset}
                                onChange={(e) => setBgOverlapXOffset(parseFloat(e.target.value))}
                                className="flex-1 accent-pink-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => setBgOverlapXOffset(Math.max(-1000, Math.min(1000, bgOverlapXOffset + 10)))}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                                title="Increase by 10"
                              >
                                <Plus size={10} strokeWidth={3} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Substrate/Canvas wrapper bounding both states */}
                  <div className="relative w-full max-w-full h-[calc(100vh-140px)] shrink-0 border border-slate-800 rounded-2xl bg-slate-950 flex items-start justify-center overflow-auto shadow-2xl dark-scroll p-3">

                    {/* Figma design (Underlaid base) */}
                    <div
                      className="absolute transition-all duration-150 origin-top flex-shrink-0"
                      style={{
                        width: `${zoomFigma * 100 * bgOverlapScale}%`,
                        minWidth: "320px",
                        transform: `translate(${figmaX + bgOverlapXOffset}px, ${figmaY + bgOverlapYOffset}px)`,
                        zIndex: 10,
                      }}
                    >
                      <img
                        src={((figmaMode === "upload" && uploadedFigmaBase64) ? uploadedFigmaBase64 : (currentDesignImage || (selectedScenarioId === "preset-hero" ? presetCatalog.designImage : presetPricing.designImage))) || null}
                        alt="Figma design layout mockup base"
                        className="w-full h-auto block rounded-xl pointer-events-none"
                      />
                      <div className="absolute top-3 left-3 bg-pink-955/80 backdrop-blur-sm border border-pink-900/40 text-[9px] font-mono px-2 py-0.5 rounded text-pink-300 font-bold uppercase tracking-wider flex items-center gap-2">
                        Background: Figma Design
                        <button
                          type="button"
                          onClick={() => setIsReuploadModalOpen(true)}
                          className="cursor-pointer hover:text-white underline"
                        >
                          (Re-upload)
                        </button>
                      </div>
                    </div>

                    {/* Project rendering (Overlaid with custom opacity level) */}
                    <div
                      className="absolute transition-all duration-150 origin-top flex-shrink-0"
                      style={{
                        width: `${zoomProject * 100 * overlapScale}%`,
                        minWidth: "320px",
                        transform: `translate(${projectXOffsetGlobal + overlapXOffset}px, ${projectYOffsetGlobal + overlapYOffset}px)`,
                        opacity: fullscreenOpacity,
                        zIndex: 20,
                      }}
                    >
                      <img
                        src={((projectMode === "upload" && uploadedProjectBase64) ? uploadedProjectBase64 : (currentSiteImage || (selectedScenarioId === "preset-hero" ? presetCatalog.siteImage : presetPricing.siteImage))) || null}
                        alt="Stating development actual render"
                        className="w-full h-auto block rounded-xl pointer-events-none"
                      />
                      <div className="absolute top-3 right-3 bg-sky-955/80 backdrop-blur-sm border border-sky-905/40 text-[9px] font-mono px-2 py-0.5 rounded text-sky-200 font-bold uppercase tracking-wider flex items-center gap-2">
                        Foreground: Live Website ({Math.round(fullscreenOpacity * 100)}% α)
                        <button
                          type="button"
                          onClick={() => setIsReuploadModalOpen(true)}
                          className="cursor-pointer hover:text-white underline"
                        >
                          (Re-upload)
                        </button>
                      </div>
                    </div>

                    {/* Intersecting Pins overlaid on top for flawless click-mapping actions */}
                    <div
                      className="absolute transition-all duration-150 origin-top flex-shrink-0"
                      style={{
                        width: `${zoomProject * 100 * overlapScale}%`,
                        minWidth: "320px",
                        transform: `translate(${projectXOffsetGlobal + overlapXOffset}px, ${projectYOffsetGlobal + overlapYOffset}px)`,
                        zIndex: 30,
                      }}
                    >
                      <img
                        src={((projectMode === "upload" && uploadedProjectBase64) ? uploadedProjectBase64 : (currentSiteImage || (selectedScenarioId === "preset-hero" ? presetCatalog.siteImage : presetPricing.siteImage))) || null}
                        alt=""
                        className="w-full h-auto block opacity-0 pointer-events-none rounded-xl"
                      />
                      {premiumIssues.map((issue, idx) => {
                        const isResolved = resolvedIssueIds.includes(issue.id);
                        if (isResolved) return null; // Only highlight not matched areas

                        const isSelected = selectedIssue?.id === issue.id;
                        const isHovered = isHoveredIssueId === issue.id;
                        const sliders = getIssueSliderValues(issue.id);

                        // Calculate visual dynamic adjustments
                        const xTranslation = sliders.xOffset;
                        const yTranslation = sliders.yOffset;
                        const roundingVal = sliders.borderRadius;
                        const scaleFactor = sliders.scaleWidth / 100;

                        return (
                          <div key={`over-issue-${issue.id}`}>
                            {/* Anchor Outline Wireframe */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectIssue(issue);
                              }}
                              onMouseEnter={() => setIsHoveredIssueId(issue.id)}
                              onMouseLeave={() => setIsHoveredIssueId(null)}
                              className="absolute cursor-pointer transition-all hover:scale-105 active:scale-95"
                              style={{
                                left: `${issue.xPercent}%`,
                                top: `${issue.yPercent}%`,
                                width: "125px",
                                height: "65px",
                                transform: `translate(-50%, -50%) translate(${xTranslation}px, ${yTranslation}px) scale(${scaleFactor})`
                              }}
                            >
                              <div
                                className={`w-full h-full transition-all border-2 border-dashed flex items-center justify-center relative ${isSelected || isHovered
                                  ? "border-amber-400 bg-amber-400/5 ring-2 ring-amber-400"
                                  : getClassificationBorder(issue.classification)
                                  }`}
                                style={{ borderRadius: `${roundingVal}px` }}
                              >
                              </div>
                            </div>

                            {/* Pin button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectIssue(issue);
                              }}
                              onMouseEnter={() => setIsHoveredIssueId(issue.id)}
                              onMouseLeave={() => setIsHoveredIssueId(null)}
                              className={`absolute w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold cursor-pointer font-black transition-all z-35 border-2 border-white/90 shadow ${isSelected || isHovered
                                ? "bg-amber-400 text-slate-950 ring-4 ring-amber-300/40"
                                : getClassificationColor(issue.classification)
                                } ${isSelected || isHovered ? "scale-125 rotate-6" : ""}`}
                              style={{
                                left: `${issue.xPercent}%`,
                                top: `${issue.yPercent}%`,
                                transform: `translate(-50%, -50%) translate(${xTranslation}px, ${yTranslation}px) translateY(-38px)`
                              }}
                            >
                              {idx + 1}
                            </button>

                            {/* Single-line description tooltip */}
                            {isHovered && (
                              null
                            )}
                          </div>
                        );
                      })}
                    </div>

                  </div>
                </div>
              ) : (
                /* MAIN BOTH SCREEN PANEL WITH TRANSLATIONAL TRANSFORM SLIDEOVER SHIFT */
                <div
                  className={`flex-1 h-full flex transition-all duration-500 ease-in-out ${(selectedIssue || showFullscreenAlignmentControls) ? "w-1/2 translate-x-[-10%]" : "w-full"
                    }`}
                >

                  {/* FIGMA ORIGINAL SIDE */}
                  <div className={`h-full border-r border-slate-800 flex flex-col relative overflow-hidden transition-all duration-500 ${selectedIssue ? "w-0 opacity-0 bg-slate-950 pointer-events-none" : "w-1/2"
                    }`}>
                    {/* Visual spec card banner */}
                    <div className="absolute top-4 left-4 bg-slate-950/85 backdrop-blur px-3 py-1.5 text-xs font-bold text-slate-300 rounded-lg border border-slate-800 z-30 flex items-center gap-2">
                      Figma Design Image</div>

                    {/* Floating Zoom Controls for Figma */}
                    <div className="absolute top-4 right-4 bg-slate-950/85 backdrop-blur border border-slate-850 p-1 rounded-xl z-30 flex items-center gap-1.5 shadow-xl">
                      <button
                        type="button"
                        onClick={() => setZoomFigma(z => Math.max(0.25, z - 0.1))}
                        className="p-1 px-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-none transition-colors cursor-pointer text-xs flex items-center justify-center font-bold"
                        title="Zoom Out"
                      >
                        <ZoomOut size={13} />
                      </button>
                      <span className="text-[10px] font-mono font-bold text-slate-400 min-w-[34px] text-center">
                        {Math.round(zoomFigma * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoomFigma(z => Math.min(2.5, z + 0.1))}
                        className="p-1 px-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-none transition-colors cursor-pointer text-xs flex items-center justify-center font-bold"
                        title="Zoom In"
                      >
                        <ZoomIn size={13} />
                      </button>
                      <div className="h-4 w-px bg-slate-800 mx-0.5"></div>
                      <button
                        type="button"
                        onClick={() => setZoomFigma(1.0)}
                        className="p-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[9px] font-mono font-bold text-slate-400 hover:text-white border-none transition-colors cursor-pointer"
                        title="Reset to 100%"
                      >
                        100%
                      </button>
                    </div>

                    <div
                      ref={leftPaneRef}
                      onScroll={(e) => handlePaneScroll(e.currentTarget, rightPaneRef.current)}
                      className="flex-1 w-full h-full overflow-auto p-6 bg-slate-950 flex items-start justify-center"
                    >
                      <div
                        className="relative border border-slate-800 bg-slate-900 rounded-xl shadow-2xl transition-all duration-150 origin-top flex-shrink-0"
                        style={{
                          width: `${zoomFigma * 100}%`,
                          minWidth: "320px",
                          transform: `translate(${figmaX}px, ${figmaY}px)`,
                        }}
                      >
                        <img
                          src={((figmaMode === "upload" && uploadedFigmaBase64) ? uploadedFigmaBase64 : (currentDesignImage || (selectedScenarioId === "preset-hero" ? presetCatalog.designImage : presetPricing.designImage))) || null}
                          alt="Figma mockup spec"
                          className="w-full h-auto block pointer-events-none rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {/* PROJECT COMPILATION SIDE */}
                  <div className={`h-full flex flex-col relative overflow-hidden transition-all duration-500 ${selectedIssue ? "w-full bg-slate-950" : "w-1/2"
                    }`}>

                    {/* Visual actual staging banner */}
                    <div className="absolute top-4 left-4 bg-emerald-950/95 backdrop-blur px-3 py-1.5 text-xs font-bold text-emerald-305 rounded-lg border border-emerald-900/60 z-30 flex items-center gap-1.5">
                      Development
                    </div>

                    {/* Floating Zoom Controls for Live Developed View */}
                    <div className="absolute top-4 right-16 bg-slate-950/85 backdrop-blur border border-slate-850 p-1 rounded-xl z-30 flex items-center gap-1.5 shadow-xl">
                      <button
                        type="button"
                        onClick={() => setZoomProject(z => Math.max(0.25, z - 0.1))}
                        className="p-1 px-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-none transition-colors cursor-pointer text-xs flex items-center justify-center font-bold"
                        title="Zoom Out"
                      >
                        <ZoomOut size={13} />
                      </button>
                      <span className="text-[10px] font-mono font-bold text-slate-400 min-w-[34px] text-center">
                        {Math.round(zoomProject * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoomProject(z => Math.min(2.5, z + 0.1))}
                        className="p-1 px-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-none transition-colors cursor-pointer text-xs flex items-center justify-center font-bold"
                        title="Zoom In"
                      >
                        <ZoomIn size={13} />
                      </button>
                      <div className="h-4 w-px bg-slate-800 mx-0.5"></div>
                      <button
                        type="button"
                        onClick={() => setZoomProject(1.0)}
                        className="p-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[9px] font-mono font-bold text-slate-400 hover:text-white border-none transition-colors cursor-pointer"
                        title="Reset to 100%"
                      >
                        100%
                      </button>
                    </div>

                    {selectedIssue && (
                      <button
                        type="button"
                        onClick={() => setSelectedIssue(null)}
                        className="absolute top-4 right-4 bg-slate-850 hover:bg-slate-700 p-2 text-xs font-bold rounded-xl text-white border-none z-30 flex items-center gap-1 hover:scale-105 transition-all"
                      >
                        ← Show Side-By-Side Design
                      </button>
                    )}

                    <div
                      ref={rightPaneRef}
                      onScroll={(e) => handlePaneScroll(e.currentTarget, leftPaneRef.current)}
                      className="flex-1 w-full h-full overflow-auto p-6 bg-slate-950 flex items-start justify-center"
                    >
                      <div
                        className="relative border border-slate-800 bg-slate-900 rounded-xl shadow-2xl transition-all duration-150 origin-top flex-shrink-0"
                        style={{
                          width: `${zoomProject * 100}%`,
                          minWidth: "320px",
                          transform: `translate(${projectXOffsetGlobal}px, ${projectYOffsetGlobal}px)`,
                        }}
                      >

                        {/* Live Snapshot Base representation */}
                        <img
                          src={((projectMode === "upload" && uploadedProjectBase64) ? uploadedProjectBase64 : (currentSiteImage || (selectedScenarioId === "preset-hero" ? presetCatalog.siteImage : presetPricing.siteImage))) || null}
                          alt="Actual staging viewport compilation"
                          className="w-full h-auto block pointer-events-none rounded-xl"
                        />

                        {/* OVERLAY CORNER SYSTEM BOXES DRAWINGS AND DOTS */}
                        {premiumIssues.map((issue, idx) => {
                          const isResolved = resolvedIssueIds.includes(issue.id);
                          if (isResolved) return null; // Only highlight not matched areas

                          const isSelected = selectedIssue?.id === issue.id;
                          const isHovered = isHoveredIssueId === issue.id;
                          const sliders = getIssueSliderValues(issue.id);

                          // Calculate visual dynamic adjustments
                          const xTranslation = sliders.xOffset;
                          const yTranslation = sliders.yOffset;
                          const roundingVal = sliders.borderRadius;
                          const scaleFactor = sliders.scaleWidth / 100;

                          return (
                            <div key={issue.id}>
                              {/* Anchor Overlay Highlight Outer Wireframe */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectIssue(issue);
                                }}
                                onMouseEnter={() => setIsHoveredIssueId(issue.id)}
                                onMouseLeave={() => setIsHoveredIssueId(null)}
                                className={`absolute cursor-pointer transition-all z-20 hover:scale-105 active:scale-95`}
                                style={{
                                  left: `${issue.xPercent}%`,
                                  top: `${issue.yPercent}%`,
                                  width: "125px",
                                  height: "65px",
                                  transform: `translate(-50%, -50%) translate(${xTranslation}px, ${yTranslation}px) scale(${scaleFactor})`
                                }}
                              >
                                <div
                                  className={`w-full h-full transition-all border-2 border-dashed flex items-center justify-center relative ${isSelected || isHovered
                                    ? "border-amber-400 bg-amber-400/5 ring-2 ring-amber-400"
                                    : getClassificationBorder(issue.classification)
                                    }`}
                                  style={{
                                    borderRadius: `${roundingVal}px`
                                  }}
                                >
                                </div>
                              </div>

                              {/* Interactive Numbered Target Button Indicator */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectIssue(issue);
                                }}
                                onMouseEnter={() => setIsHoveredIssueId(issue.id)}
                                onMouseLeave={() => setIsHoveredIssueId(null)}
                                className={`absolute w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold cursor-pointer font-black transition-all z-35 border-2 border-white/90 shadow ${isSelected || isHovered
                                  ? "bg-amber-400 text-slate-950 ring-4 ring-amber-300/40"
                                  : getClassificationColor(issue.classification)
                                  } ${isSelected || isHovered ? "scale-125 rotate-6" : ""
                                  }`}
                                style={{
                                  left: `${issue.xPercent}%`,
                                  top: `${issue.yPercent}%`,
                                  transform: `translate(-50%, -50%) translate(${xTranslation}px, ${yTranslation}px) translateY(-38px)`
                                }}
                              >
                                {idx + 1}
                              </button>

                              {/* Single-line description tooltip */}
                              {isHovered && (
                                null
                              )}
                            </div>
                          );
                        })}

                      </div>
                    </div>

                  </div>

                </div>
              )}


              {/* SLIDEOVER Popover panel sliding out from right to left (takes up 50% width) */}
              {selectedIssue && (
                <div className="absolute top-0 right-0 bottom-0 w-1/2 bg-slate-950 border-l border-slate-800 flex flex-col z-40 animate-slide-left select-text">

                  {/* Popover Header */}
                  <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-650/20 text-emerald-400 rounded-lg">
                        <Code size={16} />
                      </div>
                      <div>
                        <h4 className="font-display font-extrabold text-sm tracking-tight text-white uppercase">
                          Spec Inspection Inspector
                        </h4>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                          Issue coordinates: x={selectedIssue.xPercent}%, y={selectedIssue.yPercent}%
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedIssue(null)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-none transition-all cursor-pointer"
                      title="Close spec review"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Popover content area */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Interactive Discrepancy Backlog</span>
                      <span className="text-[10px] font-medium text-slate-500">
                        Total Issues: {premiumIssues.length} items
                      </span>
                    </div>

                    {resolvedIssueIds.length > 0 && (
                      <div className="bg-slate-950/80 p-3.5 rounded-xl border border-emerald-950/80 space-y-2 text-center animate-fade-in">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-emerald-400 font-bold">✓ {resolvedIssueIds.length} Corrections Resolved</span>
                          <span className="text-slate-500 font-semibold">{Math.round((resolvedIssueIds.length / premiumIssues.length) * 100)}% Match</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleExportPatch}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs border-none transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          {patchCopyFeedback ? (
                            <>
                              <Check size={11} />
                              <span>Patch Copied successfully!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copy Compiled CSS Patch</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    <div className="space-y-2">
                      {premiumIssues.map((issue, idx) => {
                        const isCurrent = selectedIssue.id === issue.id;
                        const isResolved = resolvedIssueIds.includes(issue.id);
                        return (
                          <div
                            key={`sidebar-${issue.id}`}
                            onClick={() => handleSelectIssue(issue)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${isCurrent
                              ? "border-emerald-600 bg-emerald-950/40 text-white"
                              : isResolved
                                ? "border-emerald-900/60 bg-emerald-950/15 text-emerald-300 hover:bg-emerald-950/25"
                                : "border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900"
                              }`}
                          >
                            <div className="truncate flex-1">
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-xs font-bold text-emerald-455">#{idx + 1}</span>
                                <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 rounded-sm ${issue.classification === "missing" ? "bg-rose-500/10 text-rose-400" :
                                  issue.classification === "misaligned" ? "bg-amber-500/10 text-amber-400" :
                                    "bg-sky-500/10 text-sky-400"
                                  }`}>
                                  {issue.classification}
                                </span>
                                {isResolved && (
                                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[8px] tracking-wider font-mono px-1 rounded font-black">
                                    RECONCILED
                                  </span>
                                )}
                              </div>
                              <span className="font-semibold text-xs truncate block mt-1">{issue.title}</span>
                            </div>
                            {isResolved ? (
                              <CheckCircle size={13} className="text-emerald-400 shrink-0" />
                            ) : (
                              <ChevronRight size={13} className="text-slate-500 shrink-0 animate-pulse" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Title & Classification Tags */}
                    <div className="space-y-2">

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-black ${selectedIssue.classification === "missing" ? "bg-rose-950/80 text-rose-300 border border-rose-900" :
                          selectedIssue.classification === "misaligned" ? "bg-amber-950/80 text-amber-300 border border-amber-900" :
                            "bg-sky-950/80 text-sky-300 border border-sky-900"
                          }`}>
                          Class: {selectedIssue.classification}
                        </span>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${selectedIssue.severity === "critical" ? "bg-rose-600 text-white" :
                          selectedIssue.severity === "major" ? "bg-amber-500 text-slate-950" :
                            "bg-emerald-600 text-white"
                          }`}>
                          {selectedIssue.severity} severity
                        </span>
                      </div>

                      <h3 className="font-display font-extrabold text-white text-lg leading-tight">
                        {selectedIssue.title}
                      </h3>

                      <p className="text-slate-300 text-xs leading-relaxed font-sans pt-1">
                        {selectedIssue.description}
                      </p>
                    </div>

                    {/* Impact Summary and UI friction metrics */}
                    {selectedIssue.estimatedImpact && (
                      <div className="p-4 bg-slate-900 rounded-xl border border-slate-800/80 space-y-1">
                        <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-emerald-400">System UX Impact Metrics</span>
                        <p className="text-slate-320 text-xs italic font-semibold font-sans">
                          &ldquo;{selectedIssue.estimatedImpact}&rdquo;
                        </p>
                      </div>
                    )}

                    {/* IMPROVEMENT NOTE */}
                    <div className="!hidden p-4 bg-yellow-905/10 border border-yellow-750/30 rounded-xl space-y-1">
                      <span className="text-[10px] font-mono tracking-wider font-bold text-yellow-400 block uppercase">✔ Actionable Improvement Directive</span>
                      <p className="text-yellow-105 text-xs font-medium leading-relaxed font-sans">
                        {selectedIssue.improvementNote}
                      </p>
                    </div>

                    {/* COPIABLE Actionable CSS fix coding blocks */}
                    {selectedIssue.cssSuggestion && (
                      <div className="!hidden space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Corrective CSS Alignment rules</span>
                          <button
                            onClick={() => handleCopyCode(selectedIssue.cssSuggestion || "")}
                            className="text-[10px] text-emerald-355 hover:text-emerald-200 font-bold flex items-center gap-1 bg-none border-none cursor-pointer"
                          >
                            {copyFeedback ? (
                              <>
                                <Check size={10} className="text-emerald-400" />
                                Copied Fix!
                              </>
                            ) : (
                              <>
                                <Copy size={10} />
                                Copy CSS spec values
                              </>
                            )}
                          </button>
                        </div>

                        <div className="relative group rounded-xl overflow-hidden bg-slate-950 border border-slate-900">
                          <pre className="p-4 pr-12 text-emerald-303 font-mono text-xs overflow-x-auto leading-relaxed select-all">
                            <code>{selectedIssue.cssSuggestion}</code>
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* INTERACTIVE SANDBOX CORRECTOR PLATFORM */}
                    <div className="!hidden p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 animate-fade-in relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 font-mono text-[8.5px] font-black text-emerald-500/35 uppercase select-none font-bold">
                        Corrector Sandbox v1.2
                      </div>

                      <div className="flex items-center gap-2">
                        <Sliders size={14} className="text-emerald-450 animate-pulse" />
                        <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-white">Interactive Corrector Playground</span>
                      </div>


                      {/* SLIDERS MATRIX */}
                      <div className="space-y-3.5 pt-1 border-t border-slate-800/60">
                        {/* X Offset slider */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono font-bold text-slate-400">
                            <span>↔ Horizontal Alignment (X-Shift)</span>
                            <span className={getIssueSliderValues(selectedIssue.id).xOffset !== 0 ? "text-emerald-400 font-black font-mono bg-emerald-950/40 px-1 py-0.25 rounded" : "text-slate-500"}>
                              {getIssueSliderValues(selectedIssue.id).xOffset > 0 ? "+" : ""}{getIssueSliderValues(selectedIssue.id).xOffset}px
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateIssueSlider(selectedIssue.id, "xOffset", Math.max(-40, Math.min(40, getIssueSliderValues(selectedIssue.id).xOffset - 1)))}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                            >
                              <Minus size={10} strokeWidth={3} />
                            </button>
                            <input
                              type="range"
                              min="-40"
                              max="40"
                              step="1"
                              value={getIssueSliderValues(selectedIssue.id).xOffset}
                              onChange={(e) => updateIssueSlider(selectedIssue.id, "xOffset", parseInt(e.target.value))}
                              className="flex-1 accent-emerald-500 bg-slate-950 h-1 rounded-lg appearance-none cursor-pointer"
                            />
                            <button
                              type="button"
                              onClick={() => updateIssueSlider(selectedIssue.id, "xOffset", Math.max(-40, Math.min(40, getIssueSliderValues(selectedIssue.id).xOffset + 1)))}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                            >
                              <Plus size={10} strokeWidth={3} />
                            </button>
                          </div>
                          <div className="flex justify-between text-[8px] uppercase font-mono text-zinc-500">
                            <span>Shift Left</span>
                            <span>Shift Right</span>
                          </div>
                        </div>

                        {/* Y Offset slider */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono font-bold text-slate-400">
                            <span>↕ Vertical Alignment (Y-Shift)</span>
                            <span className={getIssueSliderValues(selectedIssue.id).yOffset !== 0 ? "text-emerald-400 font-black font-mono bg-emerald-950/40 px-1 py-0.25 rounded" : "text-slate-500"}>
                              {getIssueSliderValues(selectedIssue.id).yOffset > 0 ? "+" : ""}{getIssueSliderValues(selectedIssue.id).yOffset}px
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateIssueSlider(selectedIssue.id, "yOffset", Math.max(-40, Math.min(40, getIssueSliderValues(selectedIssue.id).yOffset - 1)))}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                            >
                              <Minus size={10} strokeWidth={3} />
                            </button>
                            <input
                              type="range"
                              min="-40"
                              max="40"
                              step="1"
                              value={getIssueSliderValues(selectedIssue.id).yOffset}
                              onChange={(e) => updateIssueSlider(selectedIssue.id, "yOffset", parseInt(e.target.value))}
                              className="flex-1 accent-emerald-500 bg-slate-950 h-1 rounded-lg appearance-none cursor-pointer"
                            />
                            <button
                              type="button"
                              onClick={() => updateIssueSlider(selectedIssue.id, "yOffset", Math.max(-40, Math.min(40, getIssueSliderValues(selectedIssue.id).yOffset + 1)))}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                            >
                              <Plus size={10} strokeWidth={3} />
                            </button>
                          </div>
                          <div className="flex justify-between text-[8px] uppercase font-mono text-zinc-500">
                            <span>Shift Up</span>
                            <span>Shift Down</span>
                          </div>
                        </div>

                        {/* Border Curvature rounding */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono font-bold text-slate-400">
                            <span>🎨 Curvature Calibration (Radius)</span>
                            <span className={getIssueSliderValues(selectedIssue.id).borderRadius !== 4 ? "text-emerald-400 font-black font-mono bg-emerald-950/40 px-1 py-0.25 rounded" : "text-slate-500"}>
                              {getIssueSliderValues(selectedIssue.id).borderRadius}px
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateIssueSlider(selectedIssue.id, "borderRadius", Math.max(0, Math.min(24, getIssueSliderValues(selectedIssue.id).borderRadius - 2)))}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                            >
                              <Minus size={10} strokeWidth={3} />
                            </button>
                            <input
                              type="range"
                              min="0"
                              max="24"
                              step="2"
                              value={getIssueSliderValues(selectedIssue.id).borderRadius}
                              onChange={(e) => updateIssueSlider(selectedIssue.id, "borderRadius", parseInt(e.target.value))}
                              className="flex-1 accent-emerald-500 bg-slate-950 h-1 rounded-lg appearance-none cursor-pointer"
                            />
                            <button
                              type="button"
                              onClick={() => updateIssueSlider(selectedIssue.id, "borderRadius", Math.max(0, Math.min(24, getIssueSliderValues(selectedIssue.id).borderRadius + 2)))}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                            >
                              <Plus size={10} strokeWidth={3} />
                            </button>
                          </div>
                          <div className="flex justify-between text-[8px] uppercase font-mono text-zinc-500">
                            <span>Square (0px)</span>
                            <span>luxurious Curve (24px)</span>
                          </div>
                        </div>

                        {/* Scale width calibration */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono font-bold text-slate-400">
                            <span>⤢ Size / Scale Calibration</span>
                            <span className={getIssueSliderValues(selectedIssue.id).scaleWidth !== 100 ? "text-emerald-400 font-black font-mono bg-emerald-950/40 px-1 py-0.25 rounded" : "text-slate-500"}>
                              {getIssueSliderValues(selectedIssue.id).scaleWidth}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateIssueSlider(selectedIssue.id, "scaleWidth", Math.max(60, Math.min(140, getIssueSliderValues(selectedIssue.id).scaleWidth - 1)))}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                            >
                              <Minus size={10} strokeWidth={3} />
                            </button>
                            <input
                              type="range"
                              min="60"
                              max="140"
                              step="5"
                              value={getIssueSliderValues(selectedIssue.id).scaleWidth}
                              onChange={(e) => updateIssueSlider(selectedIssue.id, "scaleWidth", parseInt(e.target.value))}
                              className="flex-1 accent-emerald-500 bg-slate-950 h-1 rounded-lg appearance-none cursor-pointer"
                            />
                            <button
                              type="button"
                              onClick={() => updateIssueSlider(selectedIssue.id, "scaleWidth", Math.max(60, Math.min(140, getIssueSliderValues(selectedIssue.id).scaleWidth + 1)))}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                            >
                              <Plus size={10} strokeWidth={3} />
                            </button>
                          </div>
                          <div className="flex justify-between text-[8px] uppercase font-mono text-zinc-500">
                            <span>Compress (60%)</span>
                            <span>Expand (140%)</span>
                          </div>
                        </div>
                      </div>

                      {/* Manual Override Editor Area */}
                      <div className="space-y-1.5 pt-2">
                        <span className="text-[10px] uppercase font-mono font-bold text-slate-400">📝 Active Sandbox CSS Overrides</span>
                        <textarea
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-emerald-300 focus:outline focus:outline-emerald-500/50 focus:border-transparent h-20"
                          value={customCssOverrides[selectedIssue.id] !== undefined ? customCssOverrides[selectedIssue.id] : selectedIssue.cssSuggestion || ""}
                          onChange={(e) => setCustomCssOverrides(prev => ({ ...prev, [selectedIssue.id]: e.target.value }))}
                          placeholder="/* Type custom CSS overrides here to mock additional alignment rules... */"
                        />
                      </div>

                      {/* ACTIONS BAR */}
                      <div className="flex gap-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            const isResolved = resolvedIssueIds.includes(selectedIssue.id);
                            if (isResolved) {
                              setResolvedIssueIds(prev => prev.filter(id => id !== selectedIssue.id));
                            } else {
                              setResolvedIssueIds(prev => [...prev, selectedIssue.id]);
                            }
                          }}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border-none transition-all cursor-pointer ${resolvedIssueIds.includes(selectedIssue.id)
                            ? "bg-rose-950/70 text-rose-300 border border-rose-900/40 hover:bg-rose-900/40"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white shadow"
                            }`}
                        >
                          {resolvedIssueIds.includes(selectedIssue.id) ? (
                            <>
                              <span>↺ Revert Corrections Fix</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle size={13} />
                              <span>✓ Deploy Corrections Fix</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCustomCssOverrides(prev => {
                              const updated = { ...prev };
                              delete updated[selectedIssue.id];
                              return updated;
                            });
                            setIssueSliders(prev => {
                              const updated = { ...prev };
                              delete updated[selectedIssue.id];
                              return updated;
                            });
                          }}
                          className="px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-white rounded-xl text-xs font-mono font-bold transition-all border border-slate-750 cursor-pointer"
                          title="Reset sandbox overrides"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    {/* NAV LIST OF OTHER AFFECTED ELEMENTS right inside popover */}
                    <div className="pt-4 border-t border-slate-800 space-y-3.5">

                      {/* Share & Export Report Widget */}
                      <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                        <span className="text-[9px] uppercase font-mono tracking-wider text-indigo-400 block font-bold">📤 Team Sharing & Export</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={handleExportHTML}
                            className="py-1.5 px-2 bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all border border-slate-800 cursor-pointer flex items-center justify-center gap-1.5"
                            title="Download stand-alone HTML report"
                          >
                            <FileText size={11} className="text-sky-400" />
                            <span>HTML Report</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleExportJSON}
                            className="py-1.5 px-2 bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all border border-slate-800 cursor-pointer flex items-center justify-center gap-1.5"
                            title="Download structured JSON report"
                          >
                            <Code size={11} className="text-amber-400" />
                            <span>JSON Report</span>
                          </button>
                        </div>
                      </div>


                    </div>

                  </div>

                  {/* Popover Footer bar info details */}
                  <div className="p-4 border-t border-slate-800 bg-slate-950 text-slate-450 font-mono text-[9px] uppercase text-center">
                    VELOCE AI INTEGRITY AUDIT GUIDELINE SYSTEM &copy; 2026
                  </div>

                </div>
              )}

              {/* DYNAMIC RIGHT-SIDEBAR ALIGNMENT & CALIBRATION POPUP */}
              {showFullscreenAlignmentControls && (
                <div className="absolute top-0 right-0 bottom-0 w-96 bg-slate-950 border-l border-slate-800/80 flex flex-col z-45 animate-slide-left select-text shadow-2xl overflow-hidden">
                  {/* Header inside right-sidebar popup */}
                  <div className="p-5 border-b border-slate-850 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-indigo-650/20 text-indigo-400 rounded-lg animate-pulse">
                        <Sliders size={15} />
                      </div>
                      <div>
                        <h4 className="font-display font-extrabold text-xs tracking-tight text-white uppercase">
                          Calibration Controls
                        </h4>
                        <p className="text-[9px] text-slate-450 uppercase tracking-widest font-mono">
                          Viewport Alignment
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFullscreenAlignmentControls(false)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-none transition-all cursor-pointer"
                      title="Close calibration panel"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Sidebar Content */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      🌟 <strong>Viewport Alignment:</strong> Figma spec ratios and coded builds often scale or clip slightly differently. Adjust scale zoom or nudge coordinates pixel-by-pixel.
                    </p>

                    {/* FIGMA BACKGROUND CONTROL BLOCKIALS */}
                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-4 shadow-sm">
                      <div className="flex flex-col gap-1 border-b border-slate-800/60 pb-2">
                        <span className="text-[10px] font-mono text-pink-400 font-extrabold flex items-center gap-1.5 uppercase tracking-wide">
                          <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                          Background: Figma spec
                        </span>
                        <span className="text-[9px] font-mono text-pink-305">
                          Offset: {figmaX}px, {figmaY}px | {Math.round(zoomFigma * 100)}% scale
                        </span>
                      </div>

                      {/* Zoom bar slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400">
                          <span>Scale / Zoom:</span>
                          <span className="text-pink-400 font-mono font-bold">{Math.round(zoomFigma * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.25"
                          max="2.5"
                          step="0.05"
                          value={zoomFigma}
                          onChange={(e) => setZoomFigma(parseFloat(e.target.value))}
                          className="w-full accent-pink-500 bg-slate-950 h-1 rounded-lg cursor-pointer"
                        />
                        <div className="flex justify-between text-[8px] font-mono text-slate-500">
                          <button type="button" onClick={() => setZoomFigma(0.5)} className="hover:text-pink-300">50%</button>
                          <button type="button" onClick={() => setZoomFigma(1.0)} className="hover:text-pink-305 font-semibold text-slate-400">100%</button>
                          <button type="button" onClick={() => setZoomFigma(2.0)} className="hover:text-pink-303">200%</button>
                        </div>
                      </div>

                      {/* Offset fine-tuning coordinates inline layout for sidebar context */}
                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="flex flex-col gap-1 select-none">
                          <span className="text-[9px] text-slate-450 font-mono uppercase tracking-widest font-semibold block leading-none">X Nudge:</span>
                          <div className="flex gap-0.5 shrink-0">
                            <button type="button" onClick={() => setFigmaX(prev => prev - 1)} className="flex-1 py-1 text-[9px] font-mono bg-slate-950 border border-slate-850 hover:border-pink-550/50 text-slate-400 rounded hover:text-white font-bold transition-all">-1</button>
                            <button type="button" onClick={() => setFigmaX(prev => prev + 1)} className="flex-1 py-1 text-[9px] font-mono bg-slate-950 border border-slate-850 hover:border-pink-550/50 text-slate-400 rounded hover:text-white font-bold transition-all">+1</button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 select-none">
                          <span className="text-[9px] text-slate-455 font-mono uppercase tracking-widest font-semibold block leading-none">Y Nudge:</span>
                          <div className="flex gap-0.5 shrink-0">
                            <button type="button" onClick={() => setFigmaY(prev => prev - 1)} className="flex-1 py-1 text-[9px] font-mono bg-slate-950 border border-slate-850 hover:border-pink-550/50 text-slate-400 rounded hover:text-white font-bold transition-all">-1</button>
                            <button type="button" onClick={() => setFigmaY(prev => prev + 1)} className="flex-1 py-1 text-[9px] font-mono bg-slate-950 border border-slate-850 hover:border-pink-550/50 text-slate-400 rounded hover:text-white font-bold transition-all">+1</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* PROJECT BUILD COMPILATION COORDS */}
                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-4 shadow-sm">
                      <div className="flex flex-col gap-1 border-b border-slate-800/60 pb-2">
                        <span className="text-[10px] font-mono text-sky-400 font-extrabold flex items-center gap-1.5 uppercase tracking-wide">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                          Foreground: Coded Staging
                        </span>
                        <span className="text-[9px] font-mono text-sky-305">
                          Offset: {projectXOffsetGlobal}px, {projectYOffsetGlobal}px | {Math.round(zoomProject * 100)}% scale
                        </span>
                      </div>

                      {/* Zoom bar slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400">
                          <span>Scale / Zoom:</span>
                          <span className="text-sky-400 font-mono font-bold">{Math.round(zoomProject * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.25"
                          max="2.5"
                          step="0.05"
                          value={zoomProject}
                          onChange={(e) => setZoomProject(parseFloat(e.target.value))}
                          className="w-full accent-sky-500 bg-slate-950 h-1 rounded-lg cursor-pointer"
                        />
                        <div className="flex justify-between text-[8px] font-mono text-slate-500">
                          <button type="button" onClick={() => setZoomProject(0.5)} className="hover:text-sky-305 font-mono">50%</button>
                          <button type="button" onClick={() => setZoomProject(1.0)} className="hover:text-sky-305 font-mono font-semibold text-slate-400">100%</button>
                          <button type="button" onClick={() => setZoomProject(2.0)} className="hover:text-sky-355 font-mono">200%</button>
                        </div>
                      </div>

                      {/* Offset fine-tuning coordinates inline layout for sidebar context */}
                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="flex flex-col gap-1 select-none">
                          <span className="text-[9px] text-slate-455 font-mono uppercase tracking-widest font-semibold block leading-none">X Nudge:</span>
                          <div className="flex gap-0.5 shrink-0">
                            <button type="button" onClick={() => setProjectXOffsetGlobal(prev => prev - 1)} className="flex-1 py-1 text-[9px] font-mono bg-slate-950 border border-slate-850 hover:border-sky-550/50 text-slate-455 rounded hover:text-white font-bold transition-all">-1</button>
                            <button type="button" onClick={() => setProjectXOffsetGlobal(prev => prev + 1)} className="flex-1 py-1 text-[9px] font-mono bg-slate-950 border border-slate-850 hover:border-sky-550/50 text-slate-455 rounded hover:text-white font-bold transition-all">+1</button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 select-none">
                          <span className="text-[9px] text-slate-455 font-mono uppercase tracking-widest font-semibold block leading-none">Y Nudge:</span>
                          <div className="flex gap-0.5 shrink-0">
                            <button type="button" onClick={() => setProjectYOffsetGlobal(prev => prev - 1)} className="flex-1 py-1 text-[9px] font-mono bg-slate-950 border border-slate-850 hover:border-sky-550/50 text-slate-455 rounded hover:text-white font-bold transition-all">-1</button>
                            <button type="button" onClick={() => setProjectYOffsetGlobal(prev => prev + 1)} className="flex-1 py-1 text-[9px] font-mono bg-slate-950 border border-slate-850 hover:border-sky-550/50 text-slate-455 rounded hover:text-white font-bold transition-all">+1</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

            </div>

          </div>
        )}

        {/* FIGMA IMAGE CROPPING PORTAL DIALOG */}
        {isCroppingFigma && rawFigmaBase64 && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in select-none">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-[85%] w-full flex flex-col overflow-hidden max-h-[92vh] text-slate-100">
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-pink-600/15 border border-pink-500/20 text-pink-400 rounded-xl flex items-center justify-center shrink-0">
                    <Figma size={16} />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-sm text-white tracking-tight flex items-center gap-2">
                      Mockup Cropping Workspace
                    </h3>
                    <p className="text-slate-400 text-[10px] truncate max-w-md mt-0.5">
                      File: {uploadedFigmaName || "reference-mockup.png"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCroppingFigma(false);
                    if (!uploadedFigmaBase64) {
                      setRawFigmaBase64(null);
                    }
                  }}
                  className="text-slate-400 hover:text-white transition-colors duration-150 p-1 bg-transparent border-none cursor-pointer text-xs font-black"
                  id="close-figma-cropper"
                >
                  ✕
                </button>
              </div>

              {/* Modal Grid content */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 overflow-y-auto">
                {/* Left Column: Reference Bounds Mapper */}
                <div className="md:col-span-7 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold block">
                      1. ADJUST BOUNDARY RECTANGLE
                    </span>
                  </div>

                  {/* Main image bounds view with full width layout and tall internal overflow scroll */}
                  <div className="relative bg-slate-950 rounded-2xl overflow-y-auto block p-4 border border-slate-800 h-[380px] md:h-[600px]">
                    <div
                      onMouseDown={handleFigmaMouseDown}
                      onMouseMove={handleFigmaMouseMove}
                      onMouseUp={handleFigmaMouseUp}
                      onMouseLeave={handleFigmaMouseUp}
                      className="relative select-none w-full cursor-crosshair overflow-hidden rounded-lg"
                    >
                      <img
                        src={rawFigmaBase64 || null}
                        alt="Crop bound mapper"
                        className="w-full h-auto block select-none pointer-events-none rounded-lg text-white"
                      />
                      {/* CSS shadow mask overlay highlights specific coordinates vividly! */}
                      <div
                        className="absolute border border-dashed border-pink-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.78)] pointer-events-none"
                        style={{
                          left: `${cropFigmaX}%`,
                          top: `${cropFigmaY}%`,
                          width: `${cropFigmaW}%`,
                          height: `${cropFigmaH}%`,
                          transition: isDrawingFigma ? "none" : "all 150ms ease-out"
                        }}
                      >
                        {/* Interactive Visual Notches */}
                        <span className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-pink-400 bg-slate-900"></span>
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-pink-400 bg-slate-900"></span>
                        <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-pink-400 bg-slate-900"></span>
                        <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-pink-400 bg-slate-900"></span>
                        <span className="absolute top-1 left-2 text-[8px] font-mono text-pink-200 bg-pink-950/90 rounded px-1.5 py-0.5 scale-90 origin-left border border-pink-500/10 whitespace-nowrap">
                          Crop box: {cropFigmaX}%x{cropFigmaY}% ({cropFigmaW}%w × {cropFigmaH}%h)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Proper Live Preview and Sliders */}
                <div className="md:col-span-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-4">

                    {/* Range inputs with coordinates data */}
                    <div className="space-y-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-[11px]">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-mono text-[10px]">COORDINATE KEYS</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCropFigmaX(0);
                            setCropFigmaY(0);
                            setCropFigmaW(100);
                            setCropFigmaH(100);
                          }}
                          className="text-[9px] bg-slate-900 border border-slate-800 text-pink-400 hover:text-white hover:bg-pink-950/40 px-2 py-0.5 rounded transition font-sans cursor-pointer font-bold leading-none"
                        >
                          Reset (0% Crop Keep Original)
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-slate-400">LEFT OFFSET (X)</span>
                          <span className="font-bold text-pink-400">{cropFigmaX}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCropFigmaX(Math.max(0, Math.min(100, cropFigmaX - 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Minus size={10} strokeWidth={3} />
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={cropFigmaX}
                            onChange={(e) => setCropFigmaX(parseInt(e.target.value) || 0)}
                            className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none accent-pink-500 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setCropFigmaX(Math.max(0, Math.min(100, cropFigmaX + 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Plus size={10} strokeWidth={3} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-slate-400">TOP OFFSET (Y)</span>
                          <span className="font-bold text-pink-400">{cropFigmaY}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCropFigmaY(Math.max(0, Math.min(100, cropFigmaY - 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Minus size={10} strokeWidth={3} />
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={cropFigmaY}
                            onChange={(e) => setCropFigmaY(parseInt(e.target.value) || 0)}
                            className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none accent-pink-500 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setCropFigmaY(Math.max(0, Math.min(100, cropFigmaY + 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Plus size={10} strokeWidth={3} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-slate-400">SLICED WIDTH</span>
                          <span className="font-bold text-pink-400">{cropFigmaW}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCropFigmaW(Math.max(1, Math.min(100, cropFigmaW - 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Minus size={10} strokeWidth={3} />
                          </button>
                          <input
                            type="range"
                            min="1"
                            max="100"
                            value={cropFigmaW}
                            onChange={(e) => setCropFigmaW(parseInt(e.target.value) || 100)}
                            className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none accent-pink-500 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setCropFigmaW(Math.max(1, Math.min(100, cropFigmaW + 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Plus size={10} strokeWidth={3} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-slate-400">SLICED HEIGHT</span>
                          <span className="font-bold text-pink-400">{cropFigmaH}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCropFigmaH(Math.max(1, Math.min(100, cropFigmaH - 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Minus size={10} strokeWidth={3} />
                          </button>
                          <input
                            type="range"
                            min="1"
                            max="100"
                            value={cropFigmaH}
                            onChange={(e) => setCropFigmaH(parseInt(e.target.value) || 100)}
                            className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none accent-pink-500 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setCropFigmaH(Math.max(1, Math.min(100, cropFigmaH + 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Plus size={10} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Close/Commit button pair */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCroppingFigma(false);
                        if (!uploadedFigmaBase64) {
                          setRawFigmaBase64(null);
                        }
                      }}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-755 text-slate-300 hover:text-white font-bold rounded-xl text-xs transition-colors border-none cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={applyFigmaCrop}
                      disabled={cropProcessing}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-50 flex items-center justify-center gap-2 border-none cursor-pointer animate-fade-in"
                    >
                      {cropProcessing ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Generating Crop...
                        </>
                      ) : (
                        <>✂ Apply Mockup Specs</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PROJECTscreenshot SCREENSHOT CROPPING PORTAL DIALOG */}
        {isCroppingProject && rawProjectBase64 && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in select-none">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-[85%] w-full flex flex-col overflow-hidden max-h-[92vh] text-slate-100">
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-sky-600/15 border border-sky-500/20 text-sky-400 rounded-xl flex items-center justify-center shrink-0">
                    <Globe size={16} />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-sm text-white tracking-tight flex items-center gap-2">
                      Developed Cropping workspace
                    </h3>
                    <p className="text-slate-400 text-[10px] truncate max-w-md mt-0.5">
                      File: {uploadedProjectName || "staging-capture.png"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCroppingProject(false);
                    if (!uploadedProjectBase64) {
                      setRawProjectBase64(null);
                    }
                  }}
                  className="text-slate-400 hover:text-white transition-colors duration-150 p-1 bg-transparent border-none cursor-pointer text-xs font-black"
                  id="close-project-cropper"
                >
                  ✕
                </button>
              </div>

              {/* Modal Grid content */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 overflow-y-auto">
                {/* Left Column: Reference Bounds Mapper */}
                <div className="md:col-span-7 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold block">
                      1. ADJUST BOUNDARY RECTANGLE
                    </span>
                  </div>

                  {/* Main image bounds view with full width layout and tall internal overflow scroll */}
                  <div className="relative bg-slate-950 rounded-2xl overflow-y-auto block p-4 border border-slate-800 h-[380px] md:h-[600px]">
                    <div
                      onMouseDown={handleProjMouseDown}
                      onMouseMove={handleProjMouseMove}
                      onMouseUp={handleProjMouseUp}
                      onMouseLeave={handleProjMouseUp}
                      className="relative select-none w-full cursor-crosshair overflow-hidden rounded-lg"
                    >
                      <img
                        src={rawProjectBase64 || null}
                        alt="Crop bound mapper"
                        className="w-full h-auto block select-none pointer-events-none rounded-lg text-white"
                      />
                      {/* CSS shadow mask overlay highlights specific coordinates vividly! */}
                      <div
                        className="absolute border border-dashed border-sky-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.78)] pointer-events-none"
                        style={{
                          left: `${cropProjX}%`,
                          top: `${cropProjY}%`,
                          width: `${cropProjW}%`,
                          height: `${cropProjH}%`,
                          transition: isDrawingProject ? "none" : "all 150ms ease-out"
                        }}
                      >
                        {/* Interactive Visual Notches */}
                        <span className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-sky-400 bg-slate-900"></span>
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-sky-400 bg-slate-900"></span>
                        <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-sky-400 bg-slate-900"></span>
                        <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-sky-400 bg-slate-900"></span>
                        <span className="absolute top-1 left-2 text-[8px] font-mono text-sky-200 bg-sky-950/90 rounded px-1.5 py-0.5 scale-90 origin-left border border-sky-500/10 whitespace-nowrap">
                          Crop box: {cropProjX}%x{cropProjY}% ({cropProjW}%w × {cropProjH}%h)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Proper Live Preview and Sliders */}
                <div className="md:col-span-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-4">

                    {/* Range inputs with coordinates data */}
                    <div className="space-y-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-[11px]">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-mono text-[10px]">COORDINATE KEYS</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCropProjX(0);
                            setCropProjY(0);
                            setCropProjW(100);
                            setCropProjH(100);
                          }}
                          className="text-[9px] bg-slate-900 border border-slate-800 text-sky-400 hover:text-white hover:bg-sky-955/40 px-2 py-0.5 rounded transition font-sans cursor-pointer font-bold leading-none"
                        >
                          Reset (0% Crop Keep Original)
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-slate-400">LEFT OFFSET (X)</span>
                          <span className="font-bold text-sky-400">{cropProjX}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCropProjX(Math.max(0, Math.min(100, cropProjX - 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Minus size={10} strokeWidth={3} />
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={cropProjX}
                            onChange={(e) => setCropProjX(parseInt(e.target.value) || 0)}
                            className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none accent-sky-500 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setCropProjX(Math.max(0, Math.min(100, cropProjX + 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Plus size={10} strokeWidth={3} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-slate-400">TOP OFFSET (Y)</span>
                          <span className="font-bold text-sky-400">{cropProjY}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCropProjY(Math.max(0, Math.min(100, cropProjY - 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Minus size={10} strokeWidth={3} />
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={cropProjY}
                            onChange={(e) => setCropProjY(parseInt(e.target.value) || 0)}
                            className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none accent-sky-500 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setCropProjY(Math.max(0, Math.min(100, cropProjY + 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Plus size={10} strokeWidth={3} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-slate-400">SLICED WIDTH</span>
                          <span className="font-bold text-sky-400">{cropProjW}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCropProjW(Math.max(1, Math.min(100, cropProjW - 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Minus size={10} strokeWidth={3} />
                          </button>
                          <input
                            type="range"
                            min="1"
                            max="100"
                            value={cropProjW}
                            onChange={(e) => setCropProjW(parseInt(e.target.value) || 100)}
                            className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none accent-sky-500 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setCropProjW(Math.max(1, Math.min(100, cropProjW + 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Plus size={10} strokeWidth={3} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-slate-400">SLICED HEIGHT</span>
                          <span className="font-bold text-sky-400">{cropProjH}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCropProjH(Math.max(1, Math.min(100, cropProjH - 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Minus size={10} strokeWidth={3} />
                          </button>
                          <input
                            type="range"
                            min="1"
                            max="100"
                            value={cropProjH}
                            onChange={(e) => setCropProjH(parseInt(e.target.value) || 100)}
                            className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none accent-sky-500 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setCropProjH(Math.max(1, Math.min(100, cropProjH + 1)))}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-slate-700/50"
                          >
                            <Plus size={10} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Close/Commit button pair */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCroppingProject(false);
                        if (!uploadedProjectBase64) {
                          setRawProjectBase64(null);
                        }
                      }}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-755 text-slate-300 hover:text-white font-bold rounded-xl text-xs transition-colors border-none cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={applyProjectCrop}
                      disabled={cropProcessing}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-50 flex items-center justify-center gap-2 border-none cursor-pointer animate-fade-in"
                    >
                      {cropProcessing ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Generating Crop...
                        </>
                      ) : (
                        <>✂ Apply Screen Specs</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FULLSCREEN PERSISTENT ARCHIVE PORTAL MODAL */}
        {isArchiveFullscreen && (
          <div id="archive-fullscreen-portal" className="fixed inset-0 bg-slate-950/98 backdrop-blur-md z-50 flex flex-col p-6 sm:p-8 md:p-10 text-white overflow-hidden animate-fade-in select-none">
            {/* Header row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-5 mb-6 gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="p-1 px-2.5 bg-emerald-500/15 text-emerald-400 rounded-lg text-xs font-black font-mono border border-emerald-500/30 w-fit">
                  PORTAL INTERACTIVE ARCHIVES
                </span>
                <h2 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white flex items-center gap-2 animate-slide-up">
                  Comparative Visual QA Audit Logs <span className="text-slate-400 font-mono text-xs">({filteredHistoryRuns.length} matched)</span>
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="close-archive-fullscreen-portal-btn"
                  onClick={() => setIsArchiveFullscreen(false)}
                  className="px-4 py-2 bg-slate-900 override-bg hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-800 transition-all flex items-center gap-2 hover:scale-[1.02] cursor-pointer"
                >
                  <Minimize2 size={14} />
                  Exit Fullscreen
                </button>
              </div>
            </div>

            {/* Tab switches and backup utilities bar */}
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 mb-6">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setArchiveTab("active")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all border cursor-pointer ${archiveTab === "active"
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                >
                  Active Logs ({historyRuns.filter(r => !r.archived).length})
                </button>
                <button
                  onClick={() => setArchiveTab("archived")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all border cursor-pointer ${archiveTab === "archived"
                    ? "bg-amber-600/20 border-amber-500 text-amber-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                >
                  Archived Logs ({historyRuns.filter(r => r.archived).length})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={exportBackupJSON}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 hover:text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Download offline backup file"
                >
                  📥 Export Backup
                </button>
                <label className="px-3 py-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 hover:text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer">
                  📤 Import Backup
                  <input type="file" className="hidden" accept=".json" onChange={handleImportBackup} />
                </label>
                <button
                  onClick={() => setIsClearingAllRuns(true)}
                  className="px-3 py-2 bg-rose-950/20 border border-rose-900/30 hover:bg-rose-950/40 text-rose-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 size={12} /> Clear Logs
                </button>
              </div>
            </div>

            {/* Filtering bar in Fullscreen */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-slate-900/25 p-4 rounded-2xl border border-slate-800/60 mb-6">
              <div className="sm:col-span-8 relative">
                <input
                  type="text"
                  id="archive-search-input-fs"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
                  placeholder="Type to search custom audit scenarios by query..."
                  value={archiveSearchQuery}
                  onChange={(e) => setArchiveSearchQuery(e.target.value)}
                />
                <span className="absolute left-3.5 top-3.5 text-slate-500">🔍</span>
                {archiveSearchQuery && (
                  <button
                    onClick={() => setArchiveSearchQuery("")}
                    className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 text-xs border-none bg-transparent cursor-pointer font-bold"
                  >
                    ✖
                  </button>
                )}
              </div>
              <div className="sm:col-span-4 select-wrapper">
                <select
                  id="archive-resolution-select-fs"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs font-semibold text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  value={archiveResolutionFilter}
                  onChange={(e) => setArchiveResolutionFilter(e.target.value)}
                >
                  <option value="all">All Viewport Resolutions</option>
                  <option value="4k">4K Resolution (3840px)</option>
                  <option value="1920">FHD 1080p (1920px)</option>
                  <option value="1536">QHD Breakpoint (1536px)</option>
                  <option value="1440">WQXGA (1440px)</option>
                  <option value="1366">Standard HD+ (1366px)</option>
                  <option value="1280">WXGA Screen (1280px)</option>
                  <option value="1024">XGA Monitor (1024px)</option>
                  <option value="Multi-Res">Multi-Resolution Stack</option>
                </select>
              </div>
            </div>

            {/* Fullscreen Grid Container */}
            <div className="flex-1 overflow-y-auto pr-1">
              {filteredHistoryRuns.length === 0 ? (
                <div className="text-center py-24 bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl p-8 flex flex-col justify-center items-center">
                  <span className="text-4xl mb-4">🔎</span>
                  <p className="text-xs text-slate-400 mt-2">No audit reports found matching current filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12">
                  {filteredHistoryRuns.map((run: any) => {
                    const date = new Date(run.startedAt);
                    const displayDate = isNaN(date.getTime())
                      ? "May 26, 2026, 10:18 UTC"
                      : date.toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      });

                    const scoreColor = run.score >= 90
                      ? "border-emerald-500 bg-emerald-950/40 text-emerald-400"
                      : run.score >= 75
                        ? "border-amber-500 bg-amber-950/40 text-amber-400"
                        : "border-rose-500 bg-rose-950/40 text-rose-400";

                    return (
                      <div
                        key={`fs-${run.id}`}
                        onClick={() => {
                          loadHistoryItem(run);
                          setIsArchiveFullscreen(false); // Close the archives list when opening report
                        }}
                        className="border border-slate-800 hover:border-emerald-500 bg-slate-900/60 rounded-2xl p-5 cursor-pointer transition-all duration-300 flex flex-col justify-between group h-full space-y-4 relative overflow-hidden"
                      >
                        <div className="space-y-3.5 flex-1 w-full">
                          {/* Mini side-by-side thumbnails inside card */}
                          <div className="grid grid-cols-2 gap-1.5 h-32 rounded-xl overflow-hidden bg-slate-105 relative">
                            <div className="h-full w-full relative">
                              <img src={run.designImage || null} alt="Design Spec" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                              <span className="absolute bottom-2 left-2 bg-slate-950/90 text-[9px] font-bold text-white px-2 py-0.5 rounded">SPEC</span>
                            </div>
                            <div className="h-full w-full relative border-l border-slate-950">
                              <img src={run.siteImage || null} alt="Staging Capture" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                              <span className="absolute bottom-2 left-2 bg-emerald-950/90 text-[9px] font-bold text-emerald-300 px-2 py-0.5 rounded">STAGING</span>
                            </div>

                            {/* Action Button Overlays right inside thumbnail header */}
                            <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                              {run.archived ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRestoreRun(run.id);
                                  }}
                                  className="p-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg border-none flex items-center gap-1.5 shadow transition-colors cursor-pointer"
                                  title="Restore to Active List"
                                >
                                  <RotateCcw size={12} />
                                  <span className="text-[10px] font-bold">Restore</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    loadHistoryItem(run);
                                    setIsArchiveFullscreen(false);
                                  }}
                                  className="p-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg border-none flex items-center gap-1 shadow transition-colors cursor-pointer"
                                  title="Compare & Open"
                                >
                                  <Eye size={12} />
                                  <span className="text-[10px] font-bold">Compare</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePermanentDelete(e, run.id);
                                }}
                                className="p-1.5 bg-rose-900/80 hover:bg-rose-700 text-white rounded-lg border-none transition-colors cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>

                            {/* Match score bubble */}
                            <div className="absolute bottom-2 right-2">
                              <span className={`px-2 py-0.5 text-[10px] font-black rounded-lg border shadow ${scoreColor}`}>
                                {run.score}% match
                              </span>
                            </div>
                          </div>

                          {/* Info descriptions */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 uppercase font-bold">
                              <span>{displayDate}</span>
                              <span>•</span>
                              <span className="text-emerald-400 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded">{run.resolution || "Multi-Res"}</span>
                            </div>
                            <h4 className="font-sans font-black text-slate-200 text-sm group-hover:text-emerald-400 transition-colors leading-snug">
                              {run.projectName || "Guidelines comparative audit"}
                            </h4>
                          </div>

                          {/* Inputs properties text bar */}
                          <div className="text-[10px] text-slate-400 bg-slate-950/80 p-2.5 rounded-xl space-y-1.5 font-mono">
                            <UrlLinkAndCopy
                              label="SPEC"
                              value={run.inputs?.mockup || "Uploaded mockup image"}
                              labelColorClass="text-slate-500"
                              textColorClass="text-slate-300"
                              linkColorClass="text-emerald-400 hover:text-emerald-300 hover:underline"
                              buttonBgClass="bg-slate-900 hover:bg-slate-800 text-slate-450 hover:text-slate-200 border border-slate-800"
                            />
                            <UrlLinkAndCopy
                              label="STAGING"
                              value={run.inputs?.staging || "Captured live UI"}
                              labelColorClass="text-slate-500"
                              textColorClass="text-slate-300"
                              linkColorClass="text-emerald-400 hover:text-emerald-300 hover:underline"
                              buttonBgClass="bg-slate-900 hover:bg-slate-800 text-slate-450 hover:text-slate-200 border border-slate-800"
                            />
                          </div>
                        </div>

                        {/* Bottom alignment count summaries */}
                        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            {run.issues ? run.issues.length : 0} layout discrepancies
                          </span>
                          <span className="text-emerald-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                            Launch Room 🔬
                          </span>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom Confirmation Modal for Single comparative run removal */}
        <ConfirmationModal
          isOpen={!!deleteRunId}
          title="Delete Comparative Session Log?"
          message="Are you sure you want to permanently delete this comparative session report? This action cannot be undone."
          confirmText="Delete Report"
          cancelText="Keep"
          isDestructive={true}
          onConfirm={() => {
            if (deleteRunId) {
              executePermanentDelete(deleteRunId);
              setDeleteRunId(null);
            }
          }}
          onCancel={() => setDeleteRunId(null)}
        />

        {/* Custom Confirmation Modal for Cleared records */}
        <ConfirmationModal
          isOpen={isClearingAllRuns}
          title="Clean All Comparative Records?"
          message="Are you sure you want to delete all historical audit logs? This clears the local browser cache for all previous visual QA runs."
          confirmText="Clean All logs"
          cancelText="Discard"
          isDestructive={true}
          onConfirm={async () => {
            localStorage.removeItem("veloce_premium_history_runs");
            setHistoryRuns([]);
            await clearIDB();
            setIsClearingAllRuns(false);
          }}
          onCancel={() => setIsClearingAllRuns(false)}
        />

        {/* OVERLAY POPUP FOR ISSUE */}
        {selectedOverlayIssue && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md z-60 animate-in fade-in slide-in-from-bottom-4 p-4">
            <div className="bg-slate-950/95 backdrop-blur-xl border border-slate-700 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-slate-200">
              <div className="flex items-center justify-between gap-4 mb-3">
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${selectedOverlayIssue.classification === "missing" ? "bg-rose-950/80 text-rose-300" :
                  selectedOverlayIssue.classification === "misaligned" ? "bg-amber-950/80 text-amber-300" :
                    "bg-sky-950/80 text-sky-300"
                  }`}>
                  {selectedOverlayIssue.classification}
                </span>
                <button onClick={() => setSelectedOverlayIssue(null)} className="text-slate-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <h4 className="font-bold text-sm mb-1">{selectedOverlayIssue.title}</h4>
              <p className="text-xs text-slate-400 mb-4">{selectedOverlayIssue.description}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setResolvedIssueIds(prev => [...prev, selectedOverlayIssue.id]);
                    setSelectedOverlayIssue(null);
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5"
                >
                  <Check size={14} /> Approve
                </button>
                <button
                  onClick={() => {
                    setSelectedIssue(selectedOverlayIssue);
                    setSelectedOverlayIssue(null);
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5"
                >
                  More Info
                </button>
                <button
                  onClick={() => {
                    setSelectedOverlayIssue(null);
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5"
                >
                  <X size={14} /> Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PRINT OPTIMIZED LAYOUT */}
      <div className="hidden print:block text-slate-900 bg-white p-10 w-full max-w-4xl mx-auto font-sans select-text border-slate-200">
        <div className="border-b-4 border-indigo-600 pb-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 uppercase">Visual QA Audit Report</h1>
              <p className="text-slate-500 font-mono text-xs mt-1">Compiled by Veloce DevQA Suite</p>
            </div>
            <div className="text-right">
              <span className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold rounded-2xl text-xl inline-block">
                {getDynamicScore()}% Match
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 text-sm text-slate-600 border-t border-slate-100 pt-4">
            <div>
              <p><strong className="text-slate-900">Project / Page:</strong> {activeRunTitle}</p>
              <p className="mt-1"><strong className="text-slate-900">Report Date:</strong> {new Date().toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p><strong className="text-slate-900">Status:</strong> {premiumIssues.length === resolvedIssueIds.length ? "100% Compliant" : `${premiumIssues.length - resolvedIssueIds.length} Discrepancies Active`}</p>
              <p className="mt-1"><strong className="text-slate-900">Corrections Resolved:</strong> {resolvedIssueIds.length} of {premiumIssues.length} ({premiumIssues.length > 0 ? Math.round((resolvedIssueIds.length / premiumIssues.length) * 100) : 100}%)</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-bold border-b border-slate-200 pb-2 text-slate-950 uppercase">Audit Findings</h2>
            <div className="mt-4 space-y-6">
              {premiumIssues.map((issue) => {
                const isResolved = resolvedIssueIds.includes(issue.id);
                const sliders = getIssueSliderValues(issue.id);
                const customCss = customCssOverrides[issue.id];
                return (
                  <div key={`print-issue-${issue.id}`} className="p-5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-3" style={{ pageBreakInside: "avoid" }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[9px] font-mono tracking-widest uppercase font-bold rounded border ${issue.severity === "critical" ? "bg-red-50 border-red-200 text-red-700" :
                            issue.severity === "major" ? "bg-amber-50 border-amber-200 text-amber-700" :
                              "bg-sky-50 border-sky-200 text-sky-700"
                            }`}>{issue.severity}</span>
                          <span className="px-2 py-0.5 text-[9px] font-mono tracking-widest uppercase font-bold rounded border bg-slate-100 border-slate-200 text-slate-600">{issue.category}</span>
                          <span className="px-2 py-0.5 text-[9px] font-mono tracking-widest uppercase font-bold rounded border bg-slate-100 border-slate-200 text-indigo-600">{issue.classification}</span>
                        </div>
                        <h3 className="text-base font-bold text-slate-950 mt-1.5">{issue.title}</h3>
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${isResolved ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
                        }`}>
                        {isResolved ? "✓ Resolved Fix" : "● Correction Pending"}
                      </span>
                    </div>

                    <p className="text-sm text-slate-700 leading-relaxed">{issue.description}</p>

                    {issue.estimatedImpact && (
                      <div className="p-3 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block font-bold">Estimated UX Impact</span>
                        <p className="text-xs text-slate-600 italic mt-0.5">"{issue.estimatedImpact}"</p>
                      </div>
                    )}

                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block font-bold">Actionable Fix Guidance</span>
                      <p className="text-xs text-slate-700 mt-0.5">{issue.improvementNote}</p>
                    </div>

                    {issue.cssSuggestion && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Recommended Correction CSS</span>
                        <pre className="bg-slate-50 p-3 rounded-lg text-slate-800 font-mono text-xs overflow-x-auto border border-slate-200 leading-relaxed">{issue.cssSuggestion}</pre>
                      </div>
                    )}

                    {(sliders.xOffset !== 0 || sliders.yOffset !== 0 || sliders.borderRadius !== 4 || sliders.scaleWidth !== 100 || customCss) && (
                      <div className="pt-3 border-t border-slate-200 space-y-1.5">
                        <span className="text-[10px] text-indigo-600 font-mono uppercase tracking-wider block font-bold">QA Sandbox Calibration Applied</span>
                        <div className="grid grid-cols-4 gap-2 text-xs text-slate-600 font-mono">
                          {sliders.xOffset !== 0 && <div>X Shift: <strong>{sliders.xOffset}px</strong></div>}
                          {sliders.yOffset !== 0 && <div>Y Shift: <strong>{sliders.yOffset}px</strong></div>}
                          {sliders.borderRadius !== 4 && <div>Border Radius: <strong>{sliders.borderRadius}px</strong></div>}
                          {sliders.scaleWidth !== 100 && <div>Scale Width: <strong>{sliders.scaleWidth}%</strong></div>}
                        </div>
                        {customCss && (
                          <div className="mt-1">
                            <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block">Custom sandbox CSS</span>
                            <pre className="bg-slate-50 p-2.5 rounded-lg text-indigo-700 font-mono text-xs overflow-x-auto border border-slate-200">{customCss}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <footer className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400 font-mono">
          <p>Report compiled by Veloce Visual QA Platform • Confined Sandbox Context</p>
        </footer>
        {isAuditing && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm">
            <div className="w-16 h-16 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-white text-lg font-medium">{loadingText}</p>
            <div className="w-64 h-2 bg-slate-800 rounded-full mt-6 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${auditProgress}%` }}></div>
            </div>
          </div>
        )}
      </div>

      {syncStage && activeSetup && (
        <SyncOverlay
          stage={syncStage}
          targetUrl={activeSetup.devUrl}
          viewportWidth={activeSetup.viewportWidth}
          onCancel={cancelSync}
        />
      )}
    </>
  );
}
