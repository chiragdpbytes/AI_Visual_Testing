import { describe, it, expect } from "vitest";
import { processIssues } from "./issueProcessing";

const base = {
  severity: "major",
  category: "layout",
  title: "T",
  description: "D",
  xPercent: 50,
  yPercent: 50,
  designEvidence: "design shows X",
  siteEvidence: "site shows Y",
};

describe("processIssues", () => {
  it("drops issues missing designEvidence or siteEvidence", () => {
    const out = processIssues(
      [base, { ...base, designEvidence: "" }, { ...base, siteEvidence: undefined }],
      "run-1"
    );
    expect(out).toHaveLength(1);
  });

  it("coerces unknown severity/category and clamps coordinates", () => {
    const out = processIssues(
      [{ ...base, severity: "huge", category: "weird", xPercent: 150, yPercent: -5 }],
      "run-1"
    );
    expect(out[0].severity).toBe("minor");
    expect(out[0].category).toBe("layout");
    expect(out[0].xPercent).toBe(100);
    expect(out[0].yPercent).toBe(0);
  });

  it("dedupes same-category issues within 5% distance, keeping higher severity", () => {
    const out = processIssues(
      [
        { ...base, severity: "minor", xPercent: 50, yPercent: 50 },
        { ...base, severity: "critical", xPercent: 52, yPercent: 51 },
        { ...base, severity: "major", category: "color", xPercent: 51, yPercent: 50 },
      ],
      "run-1"
    );
    expect(out).toHaveLength(2); // layout pair deduped, color kept
    const layout = out.find((i) => i.category === "layout");
    expect(layout?.severity).toBe("critical");
  });

  it("assigns stable ids from runId", () => {
    const out = processIssues([base], "run-9");
    expect(out[0].id).toBe("iss-run-9-0");
  });
});
