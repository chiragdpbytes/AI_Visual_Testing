import React from "react";
import { CheckCircle2, ShieldAlert, Award, AlertOctagon, HelpCircle } from "lucide-react";
import { Issue } from "../types";

interface ReportStatsProps {
  score: number;
  issues: Issue[];
}

export default function ReportStats({ score, issues }: ReportStatsProps) {
  // Calculate category aggregates
  const categories = ["layout", "typography", "color", "accessibility"] as const;
  
  const getCategoryCount = (category: typeof categories[number]) => {
    return issues.filter(iss => iss.category === category).length;
  };

  const getSeverityCount = (severity: "critical" | "major" | "minor" | "suggestion") => {
    return issues.filter(iss => iss.severity === severity).length;
  };

  const criticalsCount = getSeverityCount("critical");
  const majorsCount = getSeverityCount("major");
  const minorsCount = getSeverityCount("minor");
  const suggestionsCount = getSeverityCount("suggestion");

  // Generate dynamic grades
  const getGrade = (s: number) => {
    if (s >= 95) return { label: "Standard-AAA (Perfect Build)", color: "text-emerald-600 bg-emerald-50 border-emerald-100" };
    if (s >= 85) return { label: "Standard-AA (Good Alignment)", color: "text-blue-600 bg-blue-50 border-blue-100" };
    if (s >= 75) return { label: "Standard-A (Noticeable Gaps)", color: "text-amber-600 bg-amber-50 border-amber-100" };
    return { label: "Unacceptable Match (Needs Refactor)", color: "text-rose-600 bg-rose-50 border-rose-100" };
  };

  const grade = getGrade(score);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      
      {/* Visual Matching Circle Meter */}
      <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-xs flex flex-col items-center justify-between text-center">
        <div>
          <h4 className="font-display font-bold text-slate-800 text-sm">Design Matching Score</h4>
          <p className="text-slate-500 text-xs mt-0.5">Automated spatial resemblance index</p>
        </div>

        {/* Dynamic Circular SVG Meter */}
        <div className="relative w-36 h-36 my-4 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background Trail */}
            <circle cx="50" cy="50" r="40" className="stroke-slate-100" strokeWidth="8" fill="transparent" />
            {/* Main Arc */}
            <circle 
              cx="50" 
              cy="50" 
              r="40" 
              className={`stroke-indigo-600 transition-all duration-1000 ease-out`}
              strokeWidth="8" 
              fill="transparent" 
              strokeDasharray={251.2} 
              strokeDashoffset={251.2 - (251.2 * score) / 100}
              strokeLinecap="round"
            />
          </svg>
          <div className="flex flex-col items-center">
            <span className="font-display font-extrabold text-slate-900 text-4xl">{score}</span>
            <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">similarity%</span>
          </div>
        </div>

        {/* Grade rating */}
        <div className={`px-4 py-1.5 rounded-xl border font-bold text-xs truncate max-w-full ${grade.color}`}>
          {grade.label}
        </div>
      </div>

      {/* Severity Metrics Counts */}
      <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
        <div>
          <h4 className="font-display font-bold text-slate-800 text-sm">Inconsistency Severity</h4>
          <p className="text-slate-500 text-xs mt-0.5">Bugs mapped by critical risk scale</p>
        </div>

        {/* Severity Rows */}
        <div className="my-3 space-y-2.5">
          {/* Criticals */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔴</span>
              <span className="text-xs font-semibold text-slate-700">Critical Breaks</span>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${criticalsCount > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-50 text-slate-400"}`}>
              {criticalsCount}
            </span>
          </div>

          {/* Majors */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">🟠</span>
              <span className="text-xs font-semibold text-slate-700">Major Gaps</span>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${majorsCount > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-50 text-slate-400"}`}>
              {majorsCount}
            </span>
          </div>

          {/* Minors */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔵</span>
              <span className="text-xs font-semibold text-slate-700">Minor Offsets</span>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${minorsCount > 0 ? "bg-indigo-100 text-indigo-700" : "bg-slate-50 text-slate-400"}`}>
              {minorsCount}
            </span>
          </div>

          {/* Suggestions */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚪</span>
              <span className="text-xs font-semibold text-slate-700">Suggestions</span>
            </div>
            <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-50 text-slate-500">
              {suggestionsCount}
            </span>
          </div>
        </div>

        {/* Status Line */}
        <div className="text-[11px] text-slate-400 flex items-center justify-between">
          <span>Active Inconsistencies:</span>
          <span className="font-mono font-bold text-slate-600">{issues.length} total</span>
        </div>
      </div>

      {/* Semantic QA Areas Checklist */}
      <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
        <div>
          <h4 className="font-display font-bold text-slate-800 text-sm">System Audit Coverage</h4>
          <p className="text-slate-500 text-xs mt-0.5">Integrity checklist verification scoring</p>
        </div>

        {/* Coverage Categories */}
        <div className="my-3 space-y-3">
          {categories.map((cat) => {
            const count = getCategoryCount(cat);
            const isGood = count === 0;
            return (
              <div key={cat} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className={isGood ? "text-emerald-500" : "text-amber-500"} />
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{cat} Systems</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${isGood ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                    {isGood ? "Aligned" : `${count} Gaps`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Completion Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold tracking-wide">
            <span>Overall Alignment Guarantee</span>
            <span>{score}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-600 h-full rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

    </div>
  );
}
