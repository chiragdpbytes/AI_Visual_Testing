import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Monitor,
  Tablet,
  Laptop,
  Figma,
  Globe,
  Upload,
  Play,
  Minimize2,
  Check,
  Copy,
  Layers,
  Eye,
  CheckCircle,
  Trash2,
  Key,
  LogOut,
  User,
  RotateCcw,
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
import { getIDB, saveRunToIDB, getRunsFromIDB, deleteRunFromIDB, clearIDB } from "../lib/runHistoryStore";
import FallbackBanner from "./FallbackBanner";

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

interface PremiumDashboardProps {
  onToggleDemo1: () => void;
}

export default function PremiumDashboard({ onToggleDemo1 }: PremiumDashboardProps) {
  const navigate = useNavigate();

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
  const uploadSectionRef = React.useRef<HTMLDivElement | null>(null);
  const [auditProgress, setAuditProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("");
  const [isArchiveFullscreen, setIsArchiveFullscreen] = useState(false);
  const [archiveTab, setArchiveTab] = useState<"active" | "archived">("active");
  const [archiveSearchQuery, setArchiveSearchQuery] = useState("");
  const [archiveResolutionFilter, setArchiveResolutionFilter] = useState("all");
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null);
  const [isClearingAllRuns, setIsClearingAllRuns] = useState(false);

  // Hydrate the most recently saved comparison setup so Sync can re-compare without re-uploads
  useEffect(() => {
    getSetups().then((all) => {
      if (all.length > 0) setActiveSetup(all[0]);
    }).catch(() => { });
  }, []);

  // Results State
  const [selectedScenarioId, setSelectedScenarioId] = useState<"preset-hero" | "preset-pricing">("preset-hero");

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
        classification: issue.classification || (issue.category === "layout" || issue.category === "spacing" ? "misaligned" : issue.category === "color" ? "unmatched" : "missing"),
        improvementNote: issue.improvementNote || issue.cssSuggestion || `Sync CSS properties to match standard brand layouts.`
      }));

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
      navigate(`/audit/${newHistoryItem.id}`); // Automatically enter full-viewport comparative screen

    } catch (error: any) {
      clearInterval(progressInterval);
      console.error("Visual QA Audit failed:", error);
      setLoadingText(`Audit failed: ${error.message}. Fallbacking to local scenario.`);

      // Fallback rescue so user can still test offline or if API key missing:
      setTimeout(() => {
        setIsAuditing(false);
        navigate(`/audit/run-${selectedScenarioId}`);
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
        classification: issue.classification || (issue.category === "layout" || issue.category === "spacing" ? "misaligned" : issue.category === "color" ? "unmatched" : "missing"),
        improvementNote: issue.improvementNote || issue.cssSuggestion || "Sync CSS properties to match standard brand layouts.",
      }));
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
      navigate(`/audit/${newHistoryItem.id}`);
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
    navigate(`/audit/${item.id}`);
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

        {/* RECENT AUDITS CARD + UPLOAD/WORKSPACE CARD (SHARED 50/50 TWO-COLUMN WRAPPER) */}
        <div className="mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-20 grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

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
                      title="coming soon"
                      // onClick={() => setFigmaMode("url")}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border-none ${figmaMode === "url" ? "bg-white text-slate-8 w-max shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-800"} cursor-not-allowed opacity-50`}
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
                      <label className="w-full h-24 border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all gap-1 bg-white hover:bg-emerald-50/10">
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
                      title="coming soon"
                      // onClick={() => setProjectMode("url")}
                      className={` px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border-none ${projectMode === "url" ? "bg-white text-slate-8 w-max shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-800"} cursor-not-allowed opacity-50`}
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
                      <label className="w-full h-24 border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all gap-1 bg-white hover:bg-emerald-50/10">
                        <Upload size={18} className="text-slate-400" />
                        <span className="text-xs font-semibold text-slate-600">Maintain the original Figma frame resolution and capture the development screenshot in JPG or PNG format.</span>
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
          <div id="comparative-archives-card" className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xl shadow-slate-200/45 space-y-6 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200/55 border-t-4 border-t-emerald-600 relative overflow-hidden">
            <div className="!hidden flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-800 text-lg tracking-tight">Recent Audits <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{historyRuns.filter(r => !r.archived).length} Active</span></h3>
              {/* <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => uploadSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl px-4 py-2 border-none cursor-pointer transition-all"
                >
                  <Plus size={13} />
                  <span>Verify New</span>
                </button>
              </div> */}
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
        </div>


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
      </div>

      {isAuditing && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm">
          <div className="w-16 h-16 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-white text-lg font-medium">{loadingText}</p>
          <div className="w-64 h-2 bg-slate-800 rounded-full mt-6 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${auditProgress}%` }}></div>
          </div>
        </div>
      )}

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
