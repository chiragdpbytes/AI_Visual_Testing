export type SeverityType = "critical" | "major" | "minor" | "suggestion";
export type CategoryType = "layout" | "typography" | "color" | "accessibility" | "custom";

export interface Project {
  id: string;
  name: string;
  clientName: string;
  websiteUrl: string;
  figmaUrl?: string;
  environment: "localhost" | "staging" | "production" | "wordpress" | "static";
  createdAt: string;
}

export interface Issue {
  id: string;
  severity: SeverityType;
  category: CategoryType;
  title: string;
  description: string;
  xPercent: number; // For plotting Pin on Design Image / Website Image (0-100)
  yPercent: number; // For plotting Pin (0-100)
  cssSuggestion?: string;
  estimatedImpact?: string;
  designEvidence?: string; // What the design image concretely shows at this location
  siteEvidence?: string;   // What the developed build concretely shows instead
}

export interface AnalysisRun {
  id: string;
  projectId: string;
  status: "pending" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  designImage: string; // base64 or placeholder URL
  siteImage: string; // base64 or placeholder URL
  score: number; // 0-100 score representing similarity / visual consistency
  issues: Issue[];
  error?: string;
  isFallback?: boolean; // true when this run is canned demo data, not real Gemini output
  fallbackReason?: "missing_api_key" | "api_error" | "demo_requested";
}

export interface PresetCase {
  id: string;
  name: string;
  category: string;
  description: string;
  designImage: string; // Full high-quality placeholder base64/SVG or relative path
  siteImage: string; // Full high-quality placeholder base64/SVG or relative path
  score: number;
  issues: Issue[];
}

export interface ComparisonSetup {
  id: string;
  name: string;
  figmaImageBase64: string; // data URL of the saved design reference
  devUrl: string;
  environmentLabel: "local" | "staging" | "production";
  viewportWidth: number;
  createdAt: string;
  lastSyncedAt?: string;
}
