import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Layers, 
  HelpCircle, 
  Sparkles, 
  Upload, 
  Globe, 
  Trash2, 
  FileText, 
  Settings, 
  CheckCircle, 
  Play, 
  Monitor, 
  AlertTriangle,
  History,
  Check,
  ChevronRight,
  ChevronDown,
  LogOut,
  User as UserIcon
} from "lucide-react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Project, Issue, AnalysisRun } from "./types";
import ProjectForm from "./components/ProjectForm";
import CompareCanvas from "./components/CompareCanvas";
import IssueCard from "./components/IssueCard";
import PresetSelector from "./components/PresetSelector";
import ReportStats from "./components/ReportStats";
import { presetCatalog } from "./presets";
import PremiumDashboard from "./components/PremiumDashboard";
import AuditPage from "./components/AuditPage";
import ConfirmationModal from "./components/ConfirmationModal";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import AuthOverlay from "./components/AuthOverlay";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dashboardMode, setDashboardMode] = useState<"premium" | "demo1">("premium");
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  // State hook variables
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [deleteProjectConfirmId, setDeleteProjectConfirmId] = useState<string | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  
  // Custom uploaded images
  const [designFileBase64, setDesignFileBase64] = useState<string | null>(null);
  const [siteFileBase64, setSiteFileBase64] = useState<string | null>(null);
  const [designFileName, setDesignFileName] = useState<string>("");
  const [siteFileName, setSiteFileName] = useState<string>("");

  // Analysis Result
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "loading" | "completed" | "failed">("completed");
  const [currentResult, setCurrentResult] = useState<AnalysisRun>({
    id: "run-init",
    projectId: "preset-hero",
    status: "completed",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    designImage: presetCatalog.designImage,
    siteImage: presetCatalog.siteImage,
    score: presetCatalog.score,
    issues: presetCatalog.issues
  });

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"compare" | "all-issues" | "documentation">("compare");
  const [loaderMessage, setLoaderMessage] = useState("AI is comparative matching snapshots...");
  const [envWarning, setEnvWarning] = useState(false);

  // Load projects from Express server
  useEffect(() => {
    fetchProjects();
    checkApiKeyPreflight();
  }, []);

  const checkApiKeyPreflight = async () => {
    // If we request any analysis, the server handles checking GEMINI_API_KEY.
    // If the server output warn message, we handle gracefully.
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        if (data.length > 0) {
          setSelectedProjectId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Unable to list registered projects. Using simulated workspace.", err);
    }
  };

  const handleCreateProject = async (projectData: Omit<Project, "id" | "createdAt">) => {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData)
      });
      if (res.ok) {
        const newProj = await res.json();
        setProjects(prev => [...prev, newProj]);
        setSelectedProjectId(newProj.id);
        setShowProjectModal(false);
      }
    } catch (err) {
      console.error("Failed to commit project.", err);
    }
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteProjectConfirmId(id);
  };

  const executeDeleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== id));
        if (selectedProjectId === id) {
          setSelectedProjectId("");
        }
      }
    } catch (err) {
      console.error("Error deleting project", err);
    }
  };

  // Convert uploaded files to base64 encoding strings
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "design" | "site"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === "design") {
        setDesignFileBase64(base64);
        setDesignFileName(file.name);
      } else {
        setSiteFileBase64(base64);
        setSiteFileName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  // Run the Gemini comparative Visual QA analysis
  const handleLaunchAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!designFileBase64 || !siteFileBase64) return;

    setAnalysisStatus("loading");
    setSelectedIssueId(null);
    setActiveTab("compare");

    // Cycle informative loading statements on a timer
    const loadingStates = [
      "Gemini Vision is parsing UI container dimensions...",
      "Pixel alignment matrices are comparing layout offsets...",
      "Analyzing accessibility contrast rates and typography weights...",
      "Generating precision CSS layout fixes..."
    ];
    let step = 0;
    const interval = setInterval(() => {
      step = (step + 1) % loadingStates.length;
      setLoaderMessage(loadingStates[step]);
    }, 2500);

    const activeProj = projects.find(p => p.id === selectedProjectId);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          designImage: designFileBase64,
          siteImage: siteFileBase64,
          projectName: activeProj?.name || "Custom Upload"
        })
      });

      clearInterval(interval);

      if (res.ok) {
        const resultData: AnalysisRun = await res.json();
        setCurrentResult(resultData);
        setAnalysisStatus("completed");
      } else {
        const errData = await res.json();
        console.warn("Backend fell back or errored out. Operating in fallback presentation mode.", errData);
        setAnalysisStatus("failed");
      }
    } catch (err) {
      clearInterval(interval);
      console.error("Failed to fetch analytical visual qa findings.", err);
      setAnalysisStatus("failed");
    }
  };

  // Preset Scenario quick triggers
  const handleSelectPreset = (preset: typeof presetCatalog) => {
    setSelectedIssueId(null);
    setDesignFileBase64(null);
    setSiteFileBase64(null);
    setDesignFileName("");
    setSiteFileName("");
    
    // Set simulated result instantly
    setCurrentResult({
      id: `run-preset-${preset.id}`,
      projectId: "preset-catalog",
      status: "completed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      designImage: preset.designImage,
      siteImage: preset.siteImage,
      score: preset.score,
      issues: preset.issues
    });
    setAnalysisStatus("completed");
  };

  const getEnvBadgeColor = (env: Project["environment"]) => {
    switch (env) {
      case "localhost": return "bg-emerald-50 text-emerald-700 border-emerald-150";
      case "production": return "bg-rose-50 text-rose-700 border-rose-150";
      case "wordpress": return "bg-sky-50 text-sky-700 border-sky-150";
      default: return "bg-amber-50 text-amber-700 border-amber-150";
    }
  };

  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-mono text-slate-400 uppercase tracking-widest animate-pulse">Running security identity preflight check...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthOverlay onSuccess={() => {}} />;
  }

  if (dashboardMode === "premium") {
    return (
      <Routes>
        <Route path="/" element={<PremiumDashboard onToggleDemo1={() => setDashboardMode("demo1")} />} />
        <Route path="/audit/:runId" element={<AuditPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans antialiased text-slate-800">
      
      {/* 1. Header Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 py-3.5 px-4 sm:px-8 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & Brand description */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100/80 transform hover:rotate-3 transition-transform duration-200">
              <Layers className="text-white" size={19} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-sans font-bold text-base text-slate-900 tracking-tight leading-none">Veloce QA</h1>
                <span className="bg-emerald-50 text-emerald-700 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md tracking-wider">AI VISION</span>
              </div>
              <p className="text-slate-400 text-[10px] sm:text-xs font-medium tracking-wide mt-0.5">Automated Figma design visual quality assurance audits</p>
            </div>
          </div>

          {/* Current User Context Metadata */}
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 sm:gap-3 text-xs font-sans">
            
            <button
              onClick={() => setDashboardMode("premium")}
              className="group px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-750 hover:to-teal-700 text-white font-bold rounded-xl text-[11px] transition-all hover:shadow-xs border-none uppercase tracking-wider cursor-pointer flex items-center gap-1.5 shrink-0"
              title="Activate full visual matching suite, automated pixel crop mapping & historic regression archives"
            >
              <Sparkles size={11} className="text-teal-100 animate-pulse group-hover:scale-110 transition-transform" />
              <span>Premium Workspace</span>
            </button>
            
            {/* Authenticated User Banner */}
            <div className="flex items-center gap-2 bg-slate-50 pl-2 pr-3 py-1 rounded-xl border border-slate-150 shadow-2xs hover:border-slate-200 transition-colors">
              {(currentUser.photoURL && currentUser.photoURL.trim() !== "") ? (
                <img 
                  src={currentUser.photoURL || null} 
                  alt="avatar" 
                  referrerPolicy="no-referrer"
                  className="w-5.5 h-5.5 rounded-full border border-slate-200"
                />
              ) : (
                <div className="w-5.5 h-5.5 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 shrink-0">
                  <UserIcon size={11} />
                </div>
              )}
              <span className="text-[11px] font-medium text-slate-700 max-w-[100px] truncate">
                {currentUser.displayName || currentUser.email?.split("@")[0] || "User"}
              </span>
            </div>

            {/* Dynamic Status Pill */}
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-150 font-mono text-[10px] font-semibold text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>UTC: 2026-06-02</span>
            </div>
            
            <a 
              href="#documentation" 
              onClick={() => setActiveTab("documentation")}
              className="text-slate-500 hover:text-slate-900 px-1 py-1 transition-colors uppercase tracking-wider text-[10px] font-bold"
            >
              Docs
            </a>

            <button
              onClick={() => signOut(auth)}
              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-xl border border-rose-100 hover:border-rose-200 transition-all cursor-pointer inline-flex items-center justify-center"
              title="Sign Out Account"
            >
              <LogOut size={12} />
            </button>
          </div>

        </div>
      </header>

      {/* 2. Main Workspace Layout Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Big Dashboard Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase font-extrabold text-emerald-650 tracking-widest font-display">Workspace Dashboard</span>
            <h2 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight mt-1">Audit Control Panel</h2>
          </div>
          
          {/* Action buttons */}
          <button 
            type="button"
            onClick={() => setShowProjectModal(true)}
            className="flex items-center gap-2 p-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition-all"
          >
            <Plus size={16} />
            Configure Project
          </button>
        </div>

        {/* Interactive Preset selector Grid */}
        <PresetSelector 
          selectedPresetId={currentResult.projectId === "preset-catalog" ? "preset-hero" : currentResult.projectId}
          onSelectPreset={handleSelectPreset}
        />

        {/* Dashboard workspace grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left / Sidebar Content (Upload controls & Projects list) - Span 4 */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Project List Widget */}
            <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                <h4 className="font-display font-bold text-sm text-slate-800">Projects Workspace</h4>
                <span className="text-[10px] font-mono bg-slate-100 border px-1.5 py-0.5 rounded font-bold text-slate-500">
                  {projects.length} Registered
                </span>
              </div>

              {projects.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-slate-400 text-xs">No custom projects created yet.</p>
                  <button
                    onClick={() => setShowProjectModal(true)}
                    className="text-xs text-emerald-650 font-bold hover:text-emerald-800 mt-2 hover:underline bg-none border-none"
                  >
                    Create first project →
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {projects.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => setSelectedProjectId(proj.id)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        selectedProjectId === proj.id
                          ? "border-emerald-650 bg-emerald-50/20 text-slate-950"
                          : "border-slate-150 hover:border-slate-200"
                      }`}
                    >
                      <div className="truncate flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs truncate">{proj.name}</span>
                          <span className={`px-1 rounded-sm border text-[9px] uppercase font-bold tracking-wider ${getEnvBadgeColor(proj.environment)}`}>
                            {proj.environment}
                          </span>
                        </div>
                        <span className="text-slate-400 text-[10px] block mt-0.5 truncate">{proj.websiteUrl}</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteProject(proj.id, e)}
                        className="p-1 text-slate-400 hover:text-red-650 hover:bg-rose-50 rounded transition-colors"
                        title="Delete project"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Comparative Audit Form */}
            <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-xs space-y-4">
              <div>
                <h4 className="font-display font-semibold text-slate-900 text-sm">Custom Spatial Comparatives</h4>
                <p className="text-slate-450 text-[11px] leading-relaxed mt-0.5">Upload two screen snapshots to run an automated visual QA report using Gemini vision models.</p>
              </div>

              <form onSubmit={handleLaunchAnalysis} className="space-y-4">
                
                {/* 1. Design Mockup uploader */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Image A: Figma Design Source</span>
                  <label className={`w-full h-24 border border-dashed rounded-xl flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all gap-1.5 ${
                    designFileBase64 
                      ? "border-emerald-500 bg-emerald-50/10 text-emerald-800" 
                      : "border-slate-200 hover:border-emerald-500 hover:bg-slate-50 text-slate-500"
                  }`}>
                    <Upload size={18} className={designFileBase64 ? "text-emerald-500" : "text-slate-400"} />
                    <div className="truncate max-w-full font-medium text-xs">
                      {designFileName ? designFileName : "Figma frame export or design image"}
                    </div>
                    {!designFileBase64 && <span className="text-[10px] text-slate-400">Click to import image</span>}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleImageUpload(e, "design")}
                      className="hidden" 
                    />
                  </label>
                </div>

                {/* 2. Implementation screenshot uploader */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Image B: Live Developed Site Snapshot</span>
                  <label className={`w-full h-24 border border-dashed rounded-xl flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all gap-1.5 ${
                    siteFileBase64 
                      ? "border-emerald-500 bg-emerald-50/10 text-emerald-800" 
                      : "border-slate-200 hover:border-emerald-500 hover:bg-slate-50 text-slate-500"
                  }`}>
                    <Upload size={18} className={siteFileBase64 ? "text-emerald-500" : "text-slate-400"} />
                    <div className="truncate max-w-full font-medium text-xs">
                      {siteFileName ? siteFileName : "Staging layout build screenshot"}
                    </div>
                    {!siteFileBase64 && <span className="text-[10px] text-slate-400">Click to import image</span>}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleImageUpload(e, "site")}
                      className="hidden" 
                    />
                  </label>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!designFileBase64 || !siteFileBase64 || !selectedProjectId}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm shadow-emerald-200 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Play size={14} fill="white" />
                  Run Custom Visual Audit
                </button>
              </form>
            </div>

          </div>

          {/* Right Content Area (Canvas and Tab results) - Span 8 */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Visual Stats Widgets */}
            {analysisStatus === "completed" && (
              <ReportStats score={currentResult.score} issues={currentResult.issues} />
            )}

            {/* Canvas Area or Loading skeleton */}
            {analysisStatus === "loading" ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4 shadow-xl min-h-[460px]">
                {/* Simulated futuristic parsing widget */}
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 border-4 border-emerald-550/20 border-t-emerald-550 rounded-full animate-spin"></div>
                  <div className="absolute inset-2 border-4 border-dashed border-emerald-400/25 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-emerald-650">
                    <Layers size={24} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-display font-semibold text-slate-100 text-base">Gemini Visual QA Auditing...</h4>
                  <p className="text-slate-400 text-xs font-mono max-w-sm mx-auto">{loaderMessage}</p>
                </div>
              </div>
            ) : analysisStatus === "failed" ? (
              <div className="bg-rose-950/20 border border-rose-900/60 rounded-3xl p-12 text-center text-rose-300 flex flex-col items-center justify-center gap-4 shadow-xl min-h-[460px]">
                <AlertTriangle size={36} className="text-rose-500" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-100 text-base">Analytical visual qa session failed</h4>
                  <p className="text-stone-300 text-xs max-w-md mx-auto">
                    The Gemini vision processing pipeline timed out or was temporarily rate-limited. Ensure you are using suitable mock presets if no valid API Key exists on container.
                  </p>
                </div>
                <button
                  onClick={() => handleSelectPreset(presetCatalog)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border-none"
                >
                  Load Fallback Hero Scenario
                </button>
              </div>
            ) : (
              // Active Interactive Dual canvases
              <CompareCanvas 
                designImage={currentResult.designImage}
                siteImage={currentResult.siteImage}
                issues={currentResult.issues}
                selectedIssueId={selectedIssueId}
                onSelectIssue={(id) => setSelectedIssueId(id)}
              />
            )}

            {/* TAB-BAR CONTROLS */}
            <div className="flex bg-[#E2E8F0] p-1.5 rounded-2xl max-w-max border border-slate-200">
              <button
                onClick={() => setActiveTab("compare")}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
                  activeTab === "compare"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Discrepancy Log ({currentResult.issues.length})
              </button>
              <button
                onClick={() => setActiveTab("documentation")}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
                  activeTab === "documentation"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                QA Methodology
              </button>
            </div>

            {/* RESULTS CONTAINER */}
            {activeTab === "compare" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-bold text-slate-800 text-base">Identified UI Inconsistencies</h4>
                  <span className="text-slate-450 text-xs">Click card/Pin to highlight location</span>
                </div>

                {currentResult.issues.length === 0 ? (
                  <div className="border border-slate-200 rounded-2xl bg-white p-12 text-center">
                    <p className="font-semibold text-slate-700">No discrepancies detected!</p>
                    <p className="text-slate-400 text-xs mt-1">Excellent job! This frontend build satisfies pixel-token alignments perfectly.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentResult.issues.map((issue, idx) => (
                      <IssueCard 
                        key={issue.id}
                        issue={issue}
                        index={idx}
                        isSelected={selectedIssueId === issue.id}
                        onSelect={() => setSelectedIssueId(selectedIssueId === issue.id ? null : issue.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "documentation" && (
              <div id="documentation" className="border border-slate-200 rounded-3xl bg-white p-6 md:p-8 space-y-6 text-slate-700 leading-relaxed text-sm scroll-mt-24">
                <div>
                  <h3 className="font-display font-extrabold text-slate-950 text-lg">AI Visual Audit Methodology</h3>
                  <p className="text-slate-450 text-xs mt-0.5">Learn how spatial visual QA automates pixel matches and design alignments.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2">
                    <h5 className="font-bold text-slate-900 text-sm">1. Spatial Alignment Coordinate Grid</h5>
                    <p className="text-slate-500 text-xs">
                      Traditional image diff tools check straight values of individual pixel colors. This fails on dynamic page loads or slight browser font anti-aliasing.
                      Veloce QA uses multimodal Gemini models to isolate component structures (cards, buttons, titles) and assign logical 0-100 percentage anchors.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-bold text-slate-900 text-sm">2. Token Extraction & Comparative Review</h5>
                    <p className="text-slate-500 text-xs">
                      The AI Vision engine isolates bounding elements of both images. It analyzes standard visual token mismatches like rounded border corners (`rounded-*`), color spectrums, text wrap boundaries, and grid margin structures to calculate realistic similarity scores.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs flex gap-2.5 items-start text-emerald-900">
                  <span className="text-lg">💡</span>
                  <div>
                    <span className="font-bold">Pro-tip for Developer Teams</span>
                    <p className="text-emerald-850 leading-relaxed mt-0.5">
                      Hover over any numbered glowing target on the compare canvas to reveal coordinates. Clicking open the discrepancy triggers copyable CSS attributes that match the exact visual fix.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

      </main>

      {/* 3. Global Footer */}
      <footer className="border-t border-slate-200 bg-white p-6 mt-12 text-center text-slate-400 text-xs font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>AI Frontend Visual QA Platform — High Contrast Edition</span>
          <span>Google AI Studio Build &copy; 2026</span>
        </div>
      </footer>

      {/* 4. Project creation Modal drawers */}
      {showProjectModal && (
        <ProjectForm 
          onClose={() => setShowProjectModal(false)}
          onSubmit={handleCreateProject}
        />
      )}

      {/* Confirmation Modal for Project Deletion */}
      <ConfirmationModal
        isOpen={!!deleteProjectConfirmId}
        title="Delete Registered Project?"
        message="Are you sure you want to permanently delete this project? This will clear all stored coordinates and staging URL records associated with it."
        confirmText="Permanently Delete"
        cancelText="Discard"
        isDestructive={true}
        onConfirm={() => {
          if (deleteProjectConfirmId) {
            executeDeleteProject(deleteProjectConfirmId);
            setDeleteProjectConfirmId(null);
          }
        }}
        onCancel={() => setDeleteProjectConfirmId(null)}
      />

    </div>
  );
}
