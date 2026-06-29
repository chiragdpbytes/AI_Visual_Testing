import React, { useState, useRef } from "react";
import { 
  Eye, 
  Layers, 
  Columns, 
  ZoomIn, 
  ZoomOut, 
  AlertCircle, 
  Sliders, 
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Move,
  Maximize2
} from "lucide-react";
import { Issue, SeverityType } from "../types";

interface CompareCanvasProps {
  designImage: string;
  siteImage: string;
  issues: Issue[];
  selectedIssueId: string | null;
  onSelectIssue: (id: string | null) => void;
}

export default function CompareCanvas({
  designImage,
  siteImage,
  issues,
  selectedIssueId,
  onSelectIssue
}: CompareCanvasProps) {
  const [mode, setMode] = useState<"side-by-side" | "overlay" | "curtain">("side-by-side");
  const [opacity, setOpacity] = useState(0.5); // For standard opacity overlap
  const [curtainX, setCurtainX] = useState(50); // For curtain slider (0 to 100 percentage)
  const [zoom, setZoom] = useState(1); // 1 to 2.5

  // Alignment calibration states - turned to true by default for maximum visibility
  const [showConfig, setShowConfig] = useState(false);
  const [fitMode, setFitMode] = useState<"contain" | "cover" | "fill">("contain");
  
  const [mockupX, setMockupX] = useState(0);
  const [mockupY, setMockupY] = useState(0);
  const [mockupScale, setMockupScale] = useState(100);

  const [projectX, setProjectX] = useState(0);
  const [projectY, setProjectY] = useState(0);
  const [projectScale, setProjectScale] = useState(100);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingCurtain = useRef(false);

  // Translate severity to color tokens
  const getSeverityStyle = (severity: SeverityType, isSelected: boolean) => {
    const base = "absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all shadow-md cursor-pointer z-30 ring-3 ";
    let colorClasses = "";
    
    switch (severity) {
      case "critical":
        colorClasses = "bg-rose-500 text-white ring-rose-100 border-2 border-white pulse-pin";
        break;
      case "major":
        colorClasses = "bg-amber-500 text-white ring-amber-100 border-2 border-white";
        break;
      case "minor":
        colorClasses = "bg-indigo-500 text-white ring-indigo-100 border-2 border-white";
        break;
      case "suggestion":
        colorClasses = "bg-slate-500 text-white ring-slate-100 border-2 border-white";
        break;
    }

    const selectedBonus = isSelected ? "scale-130 ring-indigo-300 z-40 border-2 border-yellow-300" : "hover:scale-120";
    return `${base} ${colorClasses} ${selectedBonus}`;
  };

  const handleCurtainMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setCurtainX(Math.max(0, Math.min(100, x)));
  };

  const handleMouseDown = () => {
    isDraggingCurtain.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCurtain.current) return;
    handleCurtainMove(e.clientX);
  };

  const handleMouseUpOrLeave = () => {
    isDraggingCurtain.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleCurtainMove(e.touches[0].clientX);
    }
  };

  const getSeverityBadge = (type: string) => {
    switch (type) {
      case "critical": return "🔴";
      case "major": return "🟠";
      case "minor": return "🔵";
      default: return "⚪";
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-5">
      
      {/* Visual Controls Panel */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-500/10 text-indigo-400 p-2 rounded-xl">
            <Layers size={18} />
          </div>
          <div>
            <h4 className="font-display text-sm font-bold text-slate-100">Comparison Room Workspace</h4>
            <p className="text-slate-400 text-xs">Side-by-side or overlapped comparisons with layout alignments</p>
          </div>
        </div>

        {/* View Mode Switchers with explicitly clear Labels requested in prompt */}
        <div className="flex items-center bg-slate-800/80 p-1 rounded-2xl border border-slate-700 max-w-max self-center sm:self-auto">
          <button
            onClick={() => setMode("side-by-side")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              mode === "side-by-side"
                ? "bg-indigo-600 text-slate-50 shadow-md scale-102"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Columns size={13} className={mode === "side-by-side" ? "text-white" : "text-slate-400"} />
            Side-By-Side View
          </button>
          
          <button
            onClick={() => setMode("overlay")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              mode === "overlay"
                ? "bg-indigo-600 text-slate-50 shadow-md scale-102"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Eye size={13} className={mode === "overlay" ? "text-white" : "text-slate-400"} />
            Overlapped View
          </button>
          
          <button
            onClick={() => setMode("curtain")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              mode === "curtain"
                ? "bg-indigo-600 text-slate-50 shadow-md scale-102"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers size={13} className={mode === "curtain" ? "text-white" : "text-slate-400"} />
            Curtain Wipe
          </button>
        </div>

        {/* Global Canvas View Zoom & Configuration Panel Toggle */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-2xl border border-slate-750">
            <span className="text-slate-450 text-[10px] uppercase font-mono tracking-wider font-semibold">Workspace Screen Zoom:</span>
            <button 
              onClick={() => setZoom(prev => Math.max(1, prev - 0.25))}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg cursor-pointer transition-all"
              title="Zoom Out Canvas"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-slate-200 text-xs font-mono w-10 text-center font-bold">{Math.round(zoom * 100)}%</span>
            <button 
              onClick={() => setZoom(prev => Math.min(2.5, prev + 0.25))}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg cursor-pointer transition-all"
              title="Zoom In Canvas"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
              showConfig
                ? "bg-indigo-600/20 border-indigo-500/80 text-indigo-300 shadow-sm font-extrabold"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
            }`}
          >
            <Sliders size={13} />
            <span>Alignment & Zoom Panel</span>
          </button>
        </div>
      </div>

      {/* Slider Controls for Overlap/Curtain Wipe */}
      {(mode === "overlay" || mode === "curtain") && (
        <div className="flex flex-col gap-2 bg-indigo-950/20 p-4 rounded-2xl border border-indigo-900/40 animate-fade-in text-left">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-100 font-bold block flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {mode === "overlay" ? "💡 OVERLAPPED BLEND SETTINGS:" : "💡 CURTAIN POSITION:"}
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              {mode === "overlay" 
                ? `Foreground Opacity: ${Math.round(opacity * 100)}% (Figma Blueprint Background underlaid)` 
                : `Staging Snapshot Visible: ${Math.round(curtainX)}%`}
            </span>
          </div>
          
          <div className="flex-1 flex items-center gap-4 pt-1">
            <span className="text-slate-400 text-3xs font-mono font-bold uppercase tracking-wider">Design Mockup Base (0%)</span>
            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={mode === "overlay" ? opacity : curtainX / 100}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (mode === "overlay") {
                    setOpacity(val);
                  } else {
                    setCurtainX(val * 100);
                  }
                }}
                className="w-full accent-indigo-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
            <span className="text-indigo-400 text-3xs font-mono font-bold uppercase tracking-wider">Project Staging (100%)</span>
          </div>
          <p className="text-[10px] text-slate-400 italic mt-0.5">
            {mode === "overlay" 
              ? "Drag to change background/foreground weight opacity. Zoom individually and shift coordinates below to lock-match specific components."
              : "Slide horizontally to wipe between the reference design layout and developed build output."}
          </p>
        </div>
      )}

      {/* Alignment & Sync Calibration Matrix (Shown by default on mount so options are obvious) */}
      {showConfig && (
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 space-y-4 animate-fade-in text-left">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/50">
            <div></div>
            
            <button
              type="button"
              onClick={() => {
                setMockupX(0);
                setMockupY(0);
                setMockupScale(100);
                setProjectX(0);
                setProjectY(0);
                setProjectScale(100);
                setFitMode("contain");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold rounded-xl border border-rose-900/50 hover:border-rose-700 bg-rose-950/20 text-rose-400 hover:text-rose-300 transition-all cursor-pointer"
            >
              <RotateCcw size={11} />
              <span>Reset Positions</span>
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-400">
            Figma designs and live viewport captures may vary in size, scroll borders, or native bounds. 
            Scale (Zoom) background/foreground individually, or nudge X &amp; Y pixels to perfectly overlay elements.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-1">
            
            {/* ASPECT STRATEGY CARD */}
            <div className="md:col-span-3 bg-slate-900/40 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
              <div></div>
              <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(["contain", "cover", "fill"] as const).map((fit) => (
                  <button
                    key={fit}
                    type="button"
                    onClick={() => setFitMode(fit)}
                    className={`flex-1 py-1 px-1.5 text-[10px] font-bold rounded-lg transition-all capitalize ${
                      fitMode === fit 
                        ? "bg-indigo-650 text-white font-extrabold border border-indigo-500/20 shadow-sm" 
                        : "text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-900/40"
                    }`}
                  >
                    {fit}
                  </button>
                ))}
              </div>
            </div>

            {/* BACKGROUND FIGMA MOCKUP COMPONENT */}
            <div className="md:col-span-4.5 bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-pink-400 font-extrabold flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                  Background: Figma Design
                </span>
                <span className="bg-pink-950/40 border border-pink-900/35 text-[9px] font-mono px-2 py-0.5 rounded text-pink-300">
                  X: {mockupX}px | Y: {mockupY}px
                </span>
              </div>

              {/* INDIVIDUAL ZOOM PRESSETS AND SLIDERS */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400">
                  <span>Zoom / Dimension Sizing:</span>
                  <span className="font-mono text-pink-400 font-bold">{mockupScale}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="250"
                  step="2"
                  value={mockupScale}
                  onChange={(e) => setMockupScale(parseInt(e.target.value))}
                  className="w-full accent-pink-500 bg-slate-950 h-1 rounded-lg cursor-pointer"
                />
                
                {/* Scale buttons presets */}
                <div className="grid grid-cols-5 gap-1 pt-1">
                  {[50, 75, 100, 150, 200].map((sc) => (
                    <button
                      key={`bg-sc-${sc}`}
                      type="button"
                      onClick={() => setMockupScale(sc)}
                      className={`py-0.5 text-[9px] font-mono rounded border transition-colors ${
                        mockupScale === sc 
                          ? "bg-pink-600/30 border-pink-500 text-pink-300 font-bold"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {sc}%
                    </button>
                  ))}
                </div>
              </div>

              {/* COORDINATE ALIGNMENT PAD & NUDGERS */}
              <div className="space-y-2 pt-1 border-t border-slate-800/60 pb-1">
                <span className="text-[10px] text-slate-400 font-semibold block">Axis Shift Fine-Tuning:</span>
                
                {/* Horizontal Alignment */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex-1 flex flex-col gap-0.5">
                    <span className="text-[9px] text-slate-500 leading-none">X Offset</span>
                    <input
                      type="range"
                      min="-400"
                      max="400"
                      step="1"
                      value={mockupX}
                      onChange={(e) => setMockupX(parseInt(e.target.value))}
                      className="w-full accent-pink-500 bg-slate-950 h-1 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMockupX(prev => prev - 10)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-pink-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge negative 10px"
                    >
                      -10
                    </button>
                    <button
                      type="button"
                      onClick={() => setMockupX(prev => prev - 1)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-pink-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge negative 1px"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => setMockupX(prev => prev + 1)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-pink-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge positive 1px"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => setMockupX(prev => prev + 10)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-pink-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge positive 10px"
                    >
                      +10
                    </button>
                  </div>
                </div>

                {/* Vertical Alignment */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex-1 flex flex-col gap-0.5">
                    <span className="text-[9px] text-slate-500 leading-none">Y Offset</span>
                    <input
                      type="range"
                      min="-400"
                      max="400"
                      step="1"
                      value={mockupY}
                      onChange={(e) => setMockupY(parseInt(e.target.value))}
                      className="w-full accent-pink-500 bg-slate-955 h-1 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMockupY(prev => prev - 10)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-pink-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge negative 10px"
                    >
                      -10
                    </button>
                    <button
                      type="button"
                      onClick={() => setMockupY(prev => prev - 1)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-pink-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge negative 1px"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => setMockupY(prev => prev + 1)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-pink-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge positive 1px"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => setMockupY(prev => prev + 10)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-pink-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge positive 10px"
                    >
                      +10
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* FOREGROUND WEBSITE BUILD COMPONENT */}
            <div className="md:col-span-4.5 bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-sky-400 font-extrabold flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                  Foreground: Staging Build
                </span>
                <span className="bg-sky-950/40 border border-sky-900/35 text-[9px] font-mono px-2 py-0.5 rounded text-sky-305">
                  X: {projectX}px | Y: {projectY}px
                </span>
              </div>

              {/* INDIVIDUAL ZOOM PRESETS AND SLIDERS */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400">
                  <span>Zoom / Dimension Sizing:</span>
                  <span className="font-mono text-sky-400 font-bold">{projectScale}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="250"
                  step="2"
                  value={projectScale}
                  onChange={(e) => setProjectScale(parseInt(e.target.value))}
                  className="w-full accent-sky-500 bg-slate-950 h-1 rounded-lg cursor-pointer"
                />
                
                {/* Scale buttons presets */}
                <div className="grid grid-cols-5 gap-1 pt-1">
                  {[50, 75, 100, 150, 200].map((sc) => (
                    <button
                      key={`proj-sc-${sc}`}
                      type="button"
                      onClick={() => setProjectScale(sc)}
                      className={`py-0.5 text-[9px] font-mono rounded border transition-colors ${
                        projectScale === sc 
                          ? "bg-sky-600/30 border-sky-500 text-sky-300 font-bold"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {sc}%
                    </button>
                  ))}
                </div>
              </div>

              {/* COORDINATE ALIGNMENT PAD & NUDGERS */}
              <div className="space-y-2 pt-1 border-t border-slate-800/60 pb-1">
                <span className="text-[10px] text-slate-400 font-semibold block">Axis Shift Fine-Tuning:</span>
                
                {/* Horizontal Alignment */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex-1 flex flex-col gap-0.5">
                    <span className="text-[9px] text-slate-500 leading-none">X Offset</span>
                    <input
                      type="range"
                      min="-400"
                      max="400"
                      step="1"
                      value={projectX}
                      onChange={(e) => setProjectX(parseInt(e.target.value))}
                      className="w-full accent-sky-500 bg-slate-955 h-1 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setProjectX(prev => prev - 10)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-sky-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge negative 10px"
                    >
                      -10
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectX(prev => prev - 1)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-sky-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge negative 1px"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectX(prev => prev + 1)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-sky-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge positive 1px"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectX(prev => prev + 10)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-sky-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge positive 10px"
                    >
                      +10
                    </button>
                  </div>
                </div>

                {/* Vertical Alignment */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex-1 flex flex-col gap-0.5">
                    <span className="text-[9px] text-slate-500 leading-none">Y Offset</span>
                    <input
                      type="range"
                      min="-400"
                      max="400"
                      step="1"
                      value={projectY}
                      onChange={(e) => setProjectY(parseInt(e.target.value))}
                      className="w-full accent-sky-500 bg-slate-955 h-1 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setProjectY(prev => prev - 10)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-sky-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge negative 10px"
                    >
                      -10
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectY(prev => prev - 1)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-sky-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge negative 1px"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectY(prev => prev + 1)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-sky-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge positive 1px"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectY(prev => prev + 10)}
                      className="px-1 py-0.5 text-[9px] font-mono bg-slate-950 border border-slate-800 hover:border-sky-500/30 text-slate-400 rounded hover:text-white"
                      title="Nudge positive 10px"
                    >
                      +10
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Workspace Display */}
      <div 
        className="relative overflow-auto max-h-[640px] flex justify-center bg-slate-950 p-4 rounded-2xl border border-slate-800"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      >
        <div 
          className="relative origin-top transition-transform duration-100 ease-out"
          style={{ transform: `scale(${zoom})`, width: "800px", height: "600px", minWidth: "800px" }}
          ref={containerRef}
          onTouchMove={handleTouchMove}
        >
          
          {/* VIEW: SIDE BY SIDE */}
          {mode === "side-by-side" && (
            <div className="grid grid-cols-2 gap-4 w-full h-full relative">
              
              {/* Left Column: Figma design frame with interactive Pins */}
              <div className="relative border border-slate-800 rounded-xl overflow-hidden bg-slate-950 group select-none flex items-center justify-center">
                <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs px-2.5 py-1 text-slate-300 font-display text-[11px] font-semibold tracking-wide uppercase rounded-lg border border-slate-800 z-30">
                  Figma Design (Original)
                </div>
                <div 
                  className="w-full h-full relative"
                  style={{ 
                    transform: `translate(${mockupX}px, ${mockupY}px) scale(${mockupScale / 100})`,
                    transformOrigin: "center center",
                    transition: "transform 100ms ease-out"
                  }}
                >
                  <img 
                    src={designImage || null} 
                    alt="Figma design layout mockup" 
                    referrerPolicy="no-referrer"
                    className={`w-full h-full pointer-events-none ${
                      fitMode === "contain" ? "object-contain" : fitMode === "cover" ? "object-cover" : "object-fill"
                    }`} 
                  />

                  {/* Plot Pins on Left side */}
                  {issues.map((issue, idx) => (
                    <button
                      key={issue.id}
                      onClick={() => onSelectIssue(selectedIssueId === issue.id ? null : issue.id)}
                      className={getSeverityStyle(issue.severity, selectedIssueId === issue.id)}
                      style={{ left: `${issue.xPercent}%`, top: `${issue.yPercent}%` }}
                      title={`${issue.severity.toUpperCase()} Discrepancy - ${issue.title}: ${issue.description}`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Implementation image */}
              <div className="relative border border-slate-800 rounded-xl overflow-hidden bg-slate-950 group select-none flex items-center justify-center">
                <div className="absolute top-3 left-3 bg-indigo-900/80 backdrop-blur-xs px-2.5 py-1 text-indigo-200 font-display text-[11px] font-semibold tracking-wide uppercase rounded-lg border border-indigo-700/50 z-30">
                  Live Website Build
                </div>
                <div 
                  className="w-full h-full relative"
                  style={{ 
                    transform: `translate(${projectX}px, ${projectY}px) scale(${projectScale / 100})`,
                    transformOrigin: "center center",
                    transition: "transform 100ms ease-out"
                  }}
                >
                  <img 
                    src={siteImage || null} 
                    alt="Stating development actual render" 
                    referrerPolicy="no-referrer"
                    className={`w-full h-full pointer-events-none ${
                      fitMode === "contain" ? "object-contain" : fitMode === "cover" ? "object-cover" : "object-fill"
                    }`} 
                  />

                  {/* Plot Pins on right side too so user feels connected */}
                  {issues.map((issue, idx) => (
                    <button
                      key={`right-${issue.id}`}
                      onClick={() => onSelectIssue(selectedIssueId === issue.id ? null : issue.id)}
                      className={getSeverityStyle(issue.severity, selectedIssueId === issue.id)}
                      style={{ left: `${issue.xPercent}%`, top: `${issue.yPercent}%` }}
                      title={`${issue.severity.toUpperCase()} Discrepancy - ${issue.title}: ${issue.description}`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* VIEW: OPACITY OVERLAY MATCH */}
          {mode === "overlay" && (
            <div className="relative w-full h-full border border-slate-800 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
              {/* Background: Figma Design Frame */}
              <div 
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{
                  transform: `translate(${mockupX}px, ${mockupY}px) scale(${mockupScale / 100})`,
                  transformOrigin: "center center",
                  transition: "transform 100ms ease-out"
                }}
              >
                <img 
                  src={designImage || null} 
                  alt="Figma mockup base" 
                  referrerPolicy="no-referrer"
                  className={`w-full h-full select-none pointer-events-none ${
                    fitMode === "contain" ? "object-contain" : fitMode === "cover" ? "object-cover" : "object-fill"
                  }`} 
                />
              </div>
              
              {/* Foreground: Live rendering screenshot overlay alpha controlled */}
              <div 
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{
                  transform: `translate(${projectX}px, ${projectY}px) scale(${projectScale / 100})`,
                  transformOrigin: "center center",
                  transition: "transform 100ms ease-out"
                }}
              >
                <img 
                  src={siteImage || null} 
                  alt="Website overlap screen" 
                  referrerPolicy="no-referrer"
                  className={`w-full h-full select-none pointer-events-none transition-opacity duration-75 ${
                    fitMode === "contain" ? "object-contain" : fitMode === "cover" ? "object-cover" : "object-fill"
                  }`} 
                  style={{ opacity: opacity }}
                />
              </div>

              {/* Overlay Interactive Pins - synced with Live Website coordinates */}
              <div 
                className="absolute inset-0 w-full h-full pointer-events-auto"
                style={{
                  transform: `translate(${projectX}px, ${projectY}px) scale(${projectScale / 100})`,
                  transformOrigin: "center center",
                  transition: "transform 100ms ease-out"
                }}
              >
                {issues.map((issue, idx) => (
                  <button
                    key={`ov-${issue.id}`}
                    onClick={() => onSelectIssue(selectedIssueId === issue.id ? null : issue.id)}
                    className={getSeverityStyle(issue.severity, selectedIssueId === issue.id)}
                    style={{ left: `${issue.xPercent}%`, top: `${issue.yPercent}%` }}
                    title={`${issue.severity.toUpperCase()} Discrepancy - ${issue.title}: ${issue.description}`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <div className="absolute bottom-3 left-3 bg-slate-950/90 text-slate-300 font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg border border-slate-800 z-30">
                Blend Mode is Active
              </div>
            </div>
          )}

          {/* VIEW: CURTAIN SPLIT SLIDE */}
          {mode === "curtain" && (
            <div className="relative w-full h-full border border-slate-800 rounded-xl overflow-hidden bg-slate-950 group select-none flex items-center justify-center">
              
              {/* Base Left Layer: Figma Mockup Frame */}
              <div 
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{
                  transform: `translate(${mockupX}px, ${mockupY}px) scale(${mockupScale / 100})`,
                  transformOrigin: "center center",
                  transition: "transform 100ms ease-out"
                }}
              >
                <img 
                  src={designImage || null} 
                  alt="Figma Mockup layer" 
                  referrerPolicy="no-referrer"
                  className={`w-full h-full ${
                    fitMode === "contain" ? "object-contain" : fitMode === "cover" ? "object-cover" : "object-fill"
                  }`} 
                />
              </div>
              <div className="absolute top-3 left-3 bg-slate-950/90 px-2 py-1 text-slate-300 font-mono text-[10px] uppercase rounded border border-slate-800 z-10">
                Figma Design
              </div>

              {/* Top Layer: Actual design cropped according to curtain boundary */}
              <div 
                className="absolute inset-0 h-full overflow-hidden border-r border-indigo-500/80 pointer-events-none"
                style={{ width: `${curtainX}%` }}
              >
                {/* Needs to stretch the full canvas size in inside cropped container */}
                <div 
                  className="absolute inset-0 w-[800px] h-[600px] max-w-none pointer-events-none"
                  style={{
                    transform: `translate(${projectX}px, ${projectY}px) scale(${projectScale / 100})`,
                    transformOrigin: "center center",
                    transition: "transform 100ms ease-out"
                  }}
                >
                  <img 
                    src={siteImage || null} 
                    alt="Actual site layer" 
                    referrerPolicy="no-referrer"
                    className={`w-full h-full ${
                      fitMode === "contain" ? "object-contain" : fitMode === "cover" ? "object-cover" : "object-fill"
                    }`} 
                  />
                </div>
              </div>
              <div className="absolute top-3 right-3 bg-indigo-950/90 px-2.5 py-1 text-indigo-300 font-mono text-[10px] uppercase rounded border border-indigo-900/50 z-10">
                Website Build
              </div>

              {/* Interactive Drag Handle Overlay */}
              <div 
                className="absolute top-0 bottom-0 w-1 bg-indigo-500 cursor-ew-resize z-45"
                style={{ left: `${curtainX}%` }}
                onMouseDown={handleMouseDown}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white w-8 h-8 rounded-full flex items-center justify-center border-2 border-white cursor-ew-resize shadow-md transition-all scale-100 hover:scale-110">
                  ↔
                </div>
              </div>

              {/* Pins Plotted above the split layout, aligned to project transform for correctness */}
              <div 
                className="absolute inset-0 w-full h-full pointer-events-auto"
                style={{
                  transform: `translate(${projectX}px, ${projectY}px) scale(${projectScale / 100})`,
                  transformOrigin: "center center",
                  transition: "transform 100ms ease-out"
                }}
              >
                {issues.map((issue, idx) => (
                  <button
                    key={`curt-${issue.id}`}
                    onClick={() => onSelectIssue(selectedIssueId === issue.id ? null : issue.id)}
                    className={getSeverityStyle(issue.severity, selectedIssueId === issue.id)}
                    style={{ left: `${issue.xPercent}%`, top: `${issue.yPercent}%` }}
                    title={`${issue.severity.toUpperCase()} Discrepancy - ${issue.title}: ${issue.description}`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Selected Indicator Panel */}
      {selectedIssueId && (
        <div className="p-4 bg-indigo-950/30 border border-indigo-900/60 rounded-2xl flex items-start gap-3 animate-fade-in relative z-20">
          <div className="text-indigo-400 mt-0.5">
            <AlertCircle size={18} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold text-indigo-400 tracking-wider">
                Selected Issue Pin {issues.findIndex(iss => iss.id === selectedIssueId) + 1}
              </span>
              <span className="text-xs">
                {getSeverityBadge(issues.find(iss => iss.id === selectedIssueId)?.severity || "")}
              </span>
            </div>
            <h5 className="font-semibold text-slate-100 text-sm mt-0.5">
              {issues.find(iss => iss.id === selectedIssueId)?.title}
            </h5>
            <p className="text-slate-300 text-xs mt-1">
              {issues.find(iss => iss.id === selectedIssueId)?.description}
            </p>
          </div>
          <button 
            onClick={() => onSelectIssue(null)}
            className="p-1 px-2 text-slate-400 hover:text-slate-200 text-xs font-semibold bg-slate-800 rounded transition-colors"
          >
            Clear Pins
          </button>
        </div>
      )}

    </div>
  );
}
