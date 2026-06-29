import React from "react";
import { Sparkles, Trophy, AlignJustify, HelpCircle } from "lucide-react";
import { presetCatalogCollection } from "../presets";
import { PresetCase } from "../types";

interface PresetSelectorProps {
  selectedPresetId: string;
  onSelectPreset: (preset: PresetCase) => void;
}

export default function PresetSelector({
  selectedPresetId,
  onSelectPreset
}: PresetSelectorProps) {
  return (
    <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-xs">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-amber-500/10 text-amber-500 p-2 rounded-xl">
          <Sparkles size={18} />
        </div>
        <div>
          <h4 className="font-display text-sm font-bold text-slate-800">Pre-loaded QA Scenarios</h4>
          <p className="text-slate-500 text-xs">Instantly load typical frontend mismatch issues to explore</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {presetCatalogCollection.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectPreset(preset)}
            className={`w-full text-left p-4 rounded-2xl border transition-all text-slate-800 flex flex-col justify-between ${
              selectedPresetId === preset.id
                ? "border-amber-500 bg-amber-50/20 shadow-xs shadow-amber-550/10 scale-[1.005]"
                : "border-slate-150 bg-white hover:border-slate-250 hover:bg-slate-50/30"
            }`}
          >
            <div>
              {/* Category */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                  {preset.category}
                </span>
                
                {/* Score */}
                <div className="flex items-center gap-1.5 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  <Trophy size={11} className="text-indigo-600" />
                  <span className="text-xs font-mono font-bold text-indigo-700">{preset.score}% Match</span>
                </div>
              </div>

              {/* Title & Desc */}
              <h5 className="font-display font-bold text-slate-800 text-sm mt-3">
                {preset.name}
              </h5>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed line-clamp-2">
                {preset.description}
              </p>
            </div>

            {/* Micro thumbnail row */}
            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                Explore Scenarios →
              </span>
              
              <div className="flex items-center gap-1.5">
                <div className="w-9 h-7 border border-slate-200 rounded overflow-hidden opacity-80 shadow-xs bg-slate-50">
                  <img src={preset.designImage || null} alt="Figma small thumb" className="w-full h-full object-cover pointer-events-none" />
                </div>
                <div className="w-9 h-7 border border-slate-200 rounded overflow-hidden opacity-80 shadow-xs bg-slate-50">
                  <img src={preset.siteImage || null} alt="Site small thumb" className="w-full h-full object-cover pointer-events-none" />
                </div>
                <span className="text-slate-400 font-mono text-[10px] font-semibold ml-1">
                  ({preset.issues.length} bugs)
                </span>
              </div>
            </div>

          </button>
        ))}
      </div>
    </div>
  );
}
