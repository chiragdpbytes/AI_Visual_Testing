import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Sliders,
  Upload,
  ZoomIn,
  ZoomOut,
  Check,
  Copy,
  ChevronRight,
  Eye,
  CheckCircle,
  X,
  Code,
  Columns,
  RotateCcw,
  Share2,
  FileText,
  Printer,
  Plus,
  Minus,
  RefreshCw
} from "lucide-react";
import { presetCatalog, presetPricing } from "../presets";
import { getRunsFromIDB, saveRunToIDB } from "../lib/runHistoryStore";
import FallbackBanner from "./FallbackBanner";
import { Issue } from "../types";

// Matches the shape PremiumDashboard.tsx uses for its own history/issue items.
export interface PremiumIssue extends Issue {
  classification: "missing" | "misaligned" | "unmatched";
  improvementNote: string;
}

const FALLBACK_PRESET_RUNS: Record<string, any> = {
  "run-preset-hero": {
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
  "run-preset-pricing": {
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
};

function mapToPremiumIssues(issues: any[]): PremiumIssue[] {
  return (issues || []).map((issue: any) => ({
    ...issue,
    classification: issue.classification || (issue.category === "layout" || issue.category === "spacing" ? "misaligned" : issue.category === "color" ? "unmatched" : "missing"),
    improvementNote: issue.improvementNote || issue.cssSuggestion || "Align CSS properties to match standard spec."
  }));
}

export default function AuditPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const [run, setRun] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<"preset-hero" | "preset-pricing">("preset-hero");

  // --- Comparison-view state (owned exclusively by this page; nothing shared with the homepage) ---
  const [score, setScore] = useState(86);
  const [premiumIssues, setPremiumIssues] = useState<PremiumIssue[]>([]);
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
  const [currentDesignImage, setCurrentDesignImage] = useState("");
  const [currentSiteImage, setCurrentSiteImage] = useState("");
  const [activeRunTitle, setActiveRunTitle] = useState("Comparative Session");
  const [selectedIssue, setSelectedIssue] = useState<PremiumIssue | null>(null);
  const [selectedOverlayIssue, setSelectedOverlayIssue] = useState<PremiumIssue | null>(null);
  const [fullscreenCompareMode, setFullscreenCompareMode] = useState<"side-by-side" | "overlapped">("side-by-side");
  const [fullscreenOpacity, setFullscreenOpacity] = useState(0.5);
  const [zoomFigma, setZoomFigma] = useState(1);
  const [zoomProject, setZoomProject] = useState(1);
  const [figmaX, setFigmaX] = useState(0);
  const [figmaY, setFigmaY] = useState(0);
  const [projectXOffsetGlobal, setProjectXOffsetGlobal] = useState(0);
  const [projectYOffsetGlobal, setProjectYOffsetGlobal] = useState(0);
  const [showFullscreenAlignmentControls, setShowFullscreenAlignmentControls] = useState(false);
  const [overlapScale, setOverlapScale] = useState(1);
  const [overlapXOffset, setOverlapXOffset] = useState(0);
  const [overlapYOffset, setOverlapYOffset] = useState(0);
  const [bgOverlapScale, setBgOverlapScale] = useState(1);
  const [bgOverlapXOffset, setBgOverlapXOffset] = useState(0);
  const [bgOverlapYOffset, setBgOverlapYOffset] = useState(0);
  const [overlapAlignmentTab, setOverlapAlignmentTab] = useState<"foreground" | "background">("foreground");
  const [showAlignmentPopup, setShowAlignmentPopup] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isHoveredIssueId, setIsHoveredIssueId] = useState<string | null>(null);
  const [syncStage, setSyncStage] = useState<"capturing" | "analyzing" | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [fallbackInfo, setFallbackInfo] = useState<{ reason: string } | null>(null);

  const leftPaneRef = React.useRef<HTMLDivElement | null>(null);
  const rightPaneRef = React.useRef<HTMLDivElement | null>(null);
  const isSyncingScroll = React.useRef(false);
  const syncAbortRef = React.useRef<AbortController | null>(null);

  const isUrlRun = /^https?:\/\//.test(run?.inputs?.staging || "");

  // --- Load the run once, from its own id, seeding all local state ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const runs = await getRunsFromIDB();
      let found = runs.find((r: any) => r.id === runId);
      if (!found && runId && FALLBACK_PRESET_RUNS[runId]) {
        found = FALLBACK_PRESET_RUNS[runId];
      }
      if (cancelled) return;
      if (!found) {
        setNotFound(true);
        return;
      }

      setRun(found);
      const mappedIssues = mapToPremiumIssues(found.issues);
      setScore(found.score);
      setPremiumIssues(mappedIssues);
      setResolvedIssueIds(Array.isArray(found.resolvedIssueIds) ? found.resolvedIssueIds : []);
      setCurrentDesignImage(found.designImage);
      setCurrentSiteImage(found.siteImage);
      setActiveRunTitle(found.projectName || "Custom Comparative Session");
      setFallbackInfo(found.isFallback ? { reason: found.fallbackReason || "unknown" } : null);

      if (found.projectName && (found.projectName.includes("Hero") || found.id === "run-preset-hero")) {
        setSelectedScenarioId("preset-hero");
      } else if (found.projectName && (found.projectName.includes("Pricing") || found.id === "run-preset-pricing")) {
        setSelectedScenarioId("preset-pricing");
      }
    })();
    return () => { cancelled = true; };
  }, [runId]);

  // Persist issue-resolution back onto the run's own IndexedDB record, so it survives a refresh.
  useEffect(() => {
    if (!run) return;
    saveRunToIDB({ ...run, resolvedIssueIds });
  }, [resolvedIssueIds]);

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

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
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

  // Re-capture this run's own source URL and re-analyze against this run's own stored
  // design image. Scoped entirely to this run — no ComparisonSetup/homepage coupling.
  const runAuditSync = async () => {
    if (!run || syncStage) return;
    const controller = new AbortController();
    syncAbortRef.current = controller;
    setCaptureError(null);
    setFallbackInfo(null);

    let siteImageForAnalysis = run.siteImage;

    try {
      if (isUrlRun) {
        setSyncStage("capturing");
        const viewportWidth = parseInt(String(run.resolution || "").match(/(\d{3,4})/)?.[1] || "1280", 10);
        const capRes = await fetch("/api/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: run.inputs.staging, type: "staging", width: viewportWidth }),
          signal: controller.signal,
        });
        if (!capRes.ok) {
          const errData = await capRes.json().catch(() => ({}));
          throw new Error(errData.error || `Capture failed (HTTP ${capRes.status})`);
        }
        const capData = await capRes.json();
        if (!capData.base64Image) throw new Error("Capture returned no image.");
        siteImageForAnalysis = capData.base64Image;
      }

      setSyncStage("analyzing");
      const anaRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: run.id,
          projectName: run.projectName,
          designImage: run.designImage,
          siteImage: siteImageForAnalysis,
          isDemo: false,
        }),
        signal: controller.signal,
      });
      if (!anaRes.ok) throw new Error(`Analysis failed (HTTP ${anaRes.status})`);
      const completedRun = await anaRes.json();

      setFallbackInfo(completedRun.isFallback ? { reason: completedRun.fallbackReason || "unknown" } : null);
      const mappedIssues = mapToPremiumIssues(completedRun.issues || []);
      setScore(completedRun.score);
      setPremiumIssues(mappedIssues);
      setCurrentSiteImage(siteImageForAnalysis);

      const now = new Date().toISOString();
      const updatedRun = {
        ...run,
        siteImage: siteImageForAnalysis,
        score: completedRun.score,
        issues: mappedIssues,
        completedAt: now,
        isFallback: !!completedRun.isFallback,
      };
      setRun(updatedRun);
      await saveRunToIDB(updatedRun);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setCaptureError(err.message || "Sync failed.");
      }
    } finally {
      syncAbortRef.current = null;
      setSyncStage(null);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-slate-300">Comparison not found.</p>
        <Link to="/" className="text-emerald-400 underline">Back to dashboard</Link>
      </div>
    );
  }

  if (!run) {
    return <div className="min-h-screen bg-slate-950 text-white p-8">Loading...</div>;
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col animate-fade-in text-white overflow-hidden select-none">

        {/* HEADER HEADER BAR */}
        <header className="bg-slate-950 border-b border-slate-800/80 p-3 px-6 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xl relative z-30">
          {fallbackInfo && <FallbackBanner reason={fallbackInfo.reason} />}
          {captureError && (
            <div className="w-full bg-rose-950/40 border border-rose-500/60 text-rose-300 rounded-xl px-4 py-3 text-xs font-semibold">
              Capture failed: {captureError}
            </div>
          )}

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
              disabled={!!syncStage}
              onClick={() => runAuditSync()}
              title={isUrlRun ? `Re-capture ${run.inputs.staging} and re-compare` : "Re-analyze the uploaded design and screenshot"}
              className={`px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 ${syncStage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} shadow-sm border border-slate-700`}
            >
              <RefreshCw size={13} className={syncStage ? 'animate-spin' : ''} />
              <span>{syncStage ? 'Syncing...' : 'Sync'}</span>
            </button>

            {/* Export Menu Dropdown */}
            <button
              type="button"
              title="coming soon"
              // onClick={() => setIsReuploadModalOpen(true)}
              className=" px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border border-slate-700 !cursor-not-allowed !opacity-50"
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
              onClick={() => navigate("/")}
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
                    src={(currentDesignImage || (selectedScenarioId === "preset-hero" ? presetCatalog.designImage : presetPricing.designImage)) || null}
                    alt="Figma design layout mockup base"
                    className="w-full h-auto block rounded-xl pointer-events-none"
                  />
                  <div className="absolute top-3 left-3 bg-pink-955/80 backdrop-blur-sm border border-pink-900/40 text-[9px] font-mono px-2 py-0.5 rounded text-pink-300 font-bold uppercase tracking-wider flex items-center gap-2">
                    Background: Figma Design
                    <button
                      type="button"
                      title="coming soon"
                      className="cursor-not-allowed opacity-50 underline"
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
                    src={(currentSiteImage || (selectedScenarioId === "preset-hero" ? presetCatalog.siteImage : presetPricing.siteImage)) || null}
                    alt="Stating development actual render"
                    className="w-full h-auto block rounded-xl pointer-events-none"
                  />
                  <div className="absolute top-3 right-3 bg-sky-955/80 backdrop-blur-sm border border-sky-905/40 text-[9px] font-mono px-2 py-0.5 rounded text-sky-200 font-bold uppercase tracking-wider flex items-center gap-2">
                    Foreground: Live Website ({Math.round(fullscreenOpacity * 100)}% α)
                    <button
                      type="button"
                      title="coming soon"
                      className="cursor-not-allowed opacity-50 underline"
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
                    src={(currentSiteImage || (selectedScenarioId === "preset-hero" ? presetCatalog.siteImage : presetPricing.siteImage)) || null}
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
                      src={(currentDesignImage || (selectedScenarioId === "preset-hero" ? presetCatalog.designImage : presetPricing.designImage)) || null}
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
                      src={(currentSiteImage || (selectedScenarioId === "preset-hero" ? presetCatalog.siteImage : presetPricing.siteImage)) || null}
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
      </div>

      {syncStage && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm">
          <div className="w-16 h-16 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-white text-lg font-medium">
            {syncStage === "capturing" ? "Re-capturing live site..." : "Re-analyzing again..."}
          </p>
        </div>
      )}
    </>
  );
}
