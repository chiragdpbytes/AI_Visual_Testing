import React, { useState } from "react";
import { Plus, X, Globe, Link2, Monitor } from "lucide-react";
import { Project } from "../types";

interface ProjectFormProps {
  onClose: () => void;
  onSubmit: (projectData: Omit<Project, "id" | "createdAt">) => void;
}

export default function ProjectForm({ onClose, onSubmit }: ProjectFormProps) {
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [environment, setEnvironment] = useState<Project["environment"]>("staging");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !websiteUrl) return;
    onSubmit({
      name,
      clientName,
      websiteUrl,
      figmaUrl: figmaUrl || undefined,
      environment
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col justify-between border-l border-slate-100 animate-slide-in">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl font-bold text-slate-900">Configure Web Project</h3>
            <p className="text-slate-500 text-xs mt-1">Add a live URL and optional Figma source to monitor inconsistencies.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1 px-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Project Name */}
          <div className="space-y-1.5ClassName">
            <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase">Project Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Redesign Mobile Hero"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
            />
          </div>

          {/* Client Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase">Client or Team Name</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Acme Corp / Marketing"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
            />
          </div>

          {/* Website URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase">Staging / Live Website URL *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-3.5 text-slate-400">
                <Globe size={16} />
              </span>
              <input
                type="url"
                required
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://staging.myclient.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              />
            </div>
          </div>

          {/* Figma Design Frame URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase">Figma File / Frame Link (Optional)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-3.5 text-slate-400">
                <Link2 size={16} />
              </span>
              <input
                type="url"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                placeholder="https://figma.com/file/..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              />
            </div>
          </div>

          {/* Environment Group Preset */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase">Runtime Environment</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Local Dev (Port 3000)", val: "localhost" },
                { label: "Staging Server", val: "staging" },
                { label: "Production Live", val: "production" },
                { label: "WordPress Inst.", val: "wordpress" },
                { label: "Static HTML/CSS", val: "static" }
              ].map((env) => (
                <button
                  key={env.val}
                  type="button"
                  onClick={() => setEnvironment(env.val as Project["environment"])}
                  className={`px-3 py-2.5 text-xs text-left rounded-xl border font-medium flex items-center gap-2 transition-all ${
                    environment === env.val
                      ? "border-indigo-600 bg-indigo-50/60 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Monitor size={14} className={environment === env.val ? "text-indigo-600" : "text-slate-400"} />
                  {env.label}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Footer actions */}
        <div className="p-6 border-t border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 font-semibold text-sm transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name || !websiteUrl}
            className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-sm shadow-indigo-200 disabled:opacity-50 disabled:pointer-events-none"
          >
            Register Project
          </button>
        </div>

      </div>
    </div>
  );
}
