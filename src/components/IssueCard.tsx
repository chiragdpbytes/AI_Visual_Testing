import React, { useState } from "react";
import { AlertTriangle, Check, Copy, Code, Sparkles, Accessibility } from "lucide-react";
import { Issue, SeverityType, CategoryType } from "../types";

interface IssueCardProps {
  key?: string | number;
  issue: Issue;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

export default function IssueCard({ issue, index, isSelected, onSelect }: IssueCardProps) {
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(true);

  const getSeverityBadge = (severity: SeverityType) => {
    switch (severity) {
      case "critical":
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-rose-500 text-white flex items-center gap-1">
            <AlertTriangle size={10} />
            CRITICAL
          </span>
        );
      case "major":
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-amber-500 text-white flex items-center gap-1">
            <AlertTriangle size={10} />
            MAJOR
          </span>
        );
      case "minor":
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md bg-indigo-500 text-white font-semibold">
            MINOR
          </span>
        );
      case "suggestion":
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md bg-slate-500 text-white font-semibold">
            SUGGESTION
          </span>
        );
    }
  };

  const getCategoryIcon = (category: CategoryType) => {
    switch (category) {
      case "accessibility":
        return <Accessibility size={13} className="text-emerald-500" />;
      case "typography":
        return <span className="font-mono text-xs font-bold text-sky-500">Aa</span>;
      case "color":
        return <div className="w-3 h-3 rounded-full bg-indigo-500" />;
      case "layout":
        return <Sparkles size={13} className="text-pink-500" />;
      default:
        return <Code size={13} className="text-slate-500" />;
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!issue.cssSuggestion) return;
    navigator.clipboard.writeText(issue.cssSuggestion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      onClick={onSelect}
      className={`border rounded-2xl p-5 cursor-pointer transition-all ${
        isSelected
          ? "border-indigo-600 bg-indigo-50/40 shadow-sm shadow-indigo-100/50 scale-[1.01]"
          : "border-slate-150 bg-white hover:border-slate-300 hover:shadow-xs hover:scale-[1.005]"
      }`}
    >
      {/* Upper line: Pin and ratings */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Index marker Pin */}
          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] font-bold ${
            isSelected 
              ? "bg-indigo-600 text-white" 
              : "bg-slate-100 text-slate-700"
          }`}>
            {index + 1}
          </div>
          {/* Category Label */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md text-slate-500 font-medium text-xs">
            {getCategoryIcon(issue.category)}
            <span className="capitalize">{issue.category}</span>
          </div>
        </div>
        {getSeverityBadge(issue.severity)}
      </div>

      {/* Main title */}
      <h5 className="font-display font-semibold text-slate-900 text-[15px] mt-3">
        {issue.title}
      </h5>

      {/* Structured report description */}
      <p className="text-slate-600 text-[13px] mt-2 leading-relaxed">
        {issue.description}
      </p>

      {/* Impact summary */}
      {issue.estimatedImpact && (
        <div className="mt-2.5 py-1 px-3 border-l-2 border-slate-200 text-slate-500 text-[11px] flex gap-1 items-center italic">
          <span className="font-semibold text-slate-700 not-italic">User/UX Impact:</span> {issue.estimatedImpact}
        </div>
      )}

      {/* CSS fix snippet */}
      {issue.cssSuggestion && (
        <div className="mt-4 space-y-2">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowCode(!showCode);
            }}
            className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 flex items-center gap-1 bg-none border-none cursor-pointer"
          >
            <Code size={12} />
            {showCode ? "Hide Actionable CSS Suggestion" : "Show Actionable CSS Suggestion"}
          </button>
          
          {showCode && (
            <div className="relative group/code rounded-xl overflow-hidden bg-slate-950 border border-slate-900 text-left animate-slide-up">
              <pre className="p-3.5 pr-12 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto select-all">
                <code>{issue.cssSuggestion}</code>
              </pre>
              <button
                type="button"
                onClick={handleCopy}
                className="absolute right-2 top-2 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-all border-none scale-100 hover:scale-105"
                title="Copy Fix Rules"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
