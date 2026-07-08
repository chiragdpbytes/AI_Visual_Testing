import { Issue, SeverityType, CategoryType } from "../src/types";

const SEVERITIES: SeverityType[] = ["critical", "major", "minor", "suggestion"];
const CATEGORIES: CategoryType[] = ["layout", "typography", "color", "accessibility", "custom"];
// Higher index = more severe, for dedup comparisons
const SEVERITY_RANK: Record<SeverityType, number> = {
  suggestion: 0,
  minor: 1,
  major: 2,
  critical: 3,
};
const DEDUP_DISTANCE_PERCENT = 5;

const clampPercent = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, 0), 100) : 50;

export function processIssues(rawIssues: unknown[], runId: string): Issue[] {
  const normalized: Issue[] = [];

  for (const raw of rawIssues || []) {
    const iss = raw as Record<string, unknown>;
    const designEvidence = typeof iss.designEvidence === "string" ? iss.designEvidence.trim() : "";
    const siteEvidence = typeof iss.siteEvidence === "string" ? iss.siteEvidence.trim() : "";
    // Evidence gate: issues the model can't ground in both images are dropped
    if (!designEvidence || !siteEvidence) continue;

    normalized.push({
      id: "", // assigned after dedup so indexes stay contiguous
      severity: SEVERITIES.includes(iss.severity as SeverityType)
        ? (iss.severity as SeverityType)
        : "minor",
      category: CATEGORIES.includes(iss.category as CategoryType)
        ? (iss.category as CategoryType)
        : "layout",
      title: String(iss.title || "Untitled discrepancy"),
      description: String(iss.description || ""),
      xPercent: clampPercent(iss.xPercent),
      yPercent: clampPercent(iss.yPercent),
      cssSuggestion: typeof iss.cssSuggestion === "string" ? iss.cssSuggestion : undefined,
      estimatedImpact: typeof iss.estimatedImpact === "string" ? iss.estimatedImpact : undefined,
      designEvidence,
      siteEvidence,
    });
  }

  // Dedup: same category within DEDUP_DISTANCE_PERCENT (euclidean) — keep higher severity
  const deduped: Issue[] = [];
  for (const issue of normalized) {
    const clashIdx = deduped.findIndex(
      (kept) =>
        kept.category === issue.category &&
        Math.hypot(kept.xPercent - issue.xPercent, kept.yPercent - issue.yPercent) <=
          DEDUP_DISTANCE_PERCENT
    );
    if (clashIdx === -1) {
      deduped.push(issue);
    } else if (SEVERITY_RANK[issue.severity] > SEVERITY_RANK[deduped[clashIdx].severity]) {
      deduped[clashIdx] = issue;
    }
  }

  return deduped.map((issue, idx) => ({ ...issue, id: `iss-${runId}-${idx}` }));
}
