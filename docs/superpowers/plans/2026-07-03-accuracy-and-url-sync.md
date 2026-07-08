# Comparison Accuracy + Figma-vs-URL Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Gemini visual comparisons more accurate and honest (evidence-based issues, visible fallback), and let users compare a saved Figma reference against a live localhost/staging/production URL with a one-click Sync that freezes the screen while re-comparing.

**Architecture:** Extract pure analysis helpers out of `server.ts` into `server/` modules (image dimension parsing, issue post-processing) with unit tests; replace external screenshot services with a headless-Chromium singleton (`playwright`); persist comparison setups client-side in the existing IndexedDB database (version bump, new store); add a full-viewport freeze overlay component used by the Sync flow in `PremiumDashboard`.

**Tech Stack:** Express + tsx (existing), `@google/genai` (existing), `playwright` (new), vitest + fake-indexeddb (new, dev-only), React 19 + Tailwind (existing).

## Global Constraints

- **NEVER run `git commit` or `git push`** — the user commits manually. Tasks end at verification, not commit.
- Spec: `docs/superpowers/specs/2026-07-03-accuracy-and-url-sync-design.md`.
- The dev server hardcodes port 3000 (`server.ts:11`). Another app sometimes occupies 3000 — check `netstat -ano | grep ':3000'` before starting; kill only processes whose command line contains `AI_Visual_Testing`.
- `GEMINI_API_KEY` lives in `.env` at the project root (gitignored). Never print its value.
- Real-analysis verification uses two fixture images that exist on this machine:
  `C:/Users/Bytes-Chirag/Downloads/default-meta-image_ (2).png` (design, "GET DRIVERS ED")
  and `C:/Users/Bytes-Chirag/Downloads/default-meta-image_.png` (site, "GET DRIVERS").
  If missing, ask the user before substituting.
- `npm run lint` (`tsc --noEmit`) must pass at the end of every task.
- Windows/PowerShell environment; Bash tool available. `rm -rf dist server.js` style commands work in Git Bash.

---

### Task 1: Test infrastructure + image dimension parser (`server/imageMeta.ts`)

**Files:**
- Modify: `package.json` (add vitest, fake-indexeddb devDeps + `test` script)
- Create: `server/imageMeta.ts`
- Test: `server/imageMeta.test.ts`

**Interfaces:**
- Produces: `parseImageDimensions(base64Data: string, mimeType: string): { width: number; height: number } | null` — consumed by Task 3. `base64Data` is raw base64 (no `data:` prefix).

- [ ] **Step 1: Install dev dependencies and add test script**

```bash
npm install --save-dev vitest fake-indexeddb
```

In `package.json` `"scripts"`, add:

```json
"test": "vitest run"
```

- [ ] **Step 2: Write the failing test**

Create `server/imageMeta.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseImageDimensions } from "./imageMeta";

// Build a minimal valid PNG header: 8-byte signature + IHDR chunk
function pngBase64(width: number, height: number): string {
  const buf = Buffer.alloc(33);
  buf.write("\x89PNG\r\n\x1a\n", 0, "binary"); // signature
  buf.writeUInt32BE(13, 8); // IHDR length
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf.toString("base64");
}

// Minimal JPEG: SOI + SOF0 frame with dimensions
function jpegBase64(width: number, height: number): string {
  const buf = Buffer.from([
    0xff, 0xd8,             // SOI
    0xff, 0xc0,             // SOF0 marker
    0x00, 0x11,             // segment length 17
    0x08,                   // bit depth
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03,                   // components
    0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  ]);
  return buf.toString("base64");
}

describe("parseImageDimensions", () => {
  it("parses PNG dimensions from IHDR", () => {
    expect(parseImageDimensions(pngBase64(1920, 1080), "image/png"))
      .toEqual({ width: 1920, height: 1080 });
  });

  it("parses JPEG dimensions from SOF0", () => {
    expect(parseImageDimensions(jpegBase64(1280, 720), "image/jpeg"))
      .toEqual({ width: 1280, height: 720 });
  });

  it("returns null for garbage input", () => {
    expect(parseImageDimensions("bm90IGFuIGltYWdl", "image/png")).toBeNull();
  });

  it("returns null for unsupported mime types", () => {
    expect(parseImageDimensions(pngBase64(10, 10), "image/webp")).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run server/imageMeta.test.ts`
Expected: FAIL — `Cannot find module './imageMeta'` (or equivalent).

- [ ] **Step 4: Write the implementation**

Create `server/imageMeta.ts`:

```typescript
// Parse pixel dimensions from base64 image data without any image library.
// Supports PNG (IHDR chunk) and JPEG (SOFn frame headers).

export function parseImageDimensions(
  base64Data: string,
  mimeType: string
): { width: number; height: number } | null {
  let buf: Buffer;
  try {
    buf = Buffer.from(base64Data, "base64");
  } catch {
    return null;
  }
  if (mimeType === "image/png") return parsePng(buf);
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return parseJpeg(buf);
  return null;
}

function parsePng(buf: Buffer): { width: number; height: number } | null {
  // 8-byte signature, then IHDR: 4-byte length, "IHDR", 4-byte width, 4-byte height
  if (buf.length < 24) return null;
  const signature = "\x89PNG\r\n\x1a\n";
  if (buf.toString("binary", 0, 8) !== signature) return null;
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width === 0 || height === 0) return null;
  return { width, height };
}

function parseJpeg(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) return null;
    const marker = buf[offset + 1];
    // SOF0-SOF15 except DHT(C4), JPG(C8), DAC(CC) carry dimensions
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      if (width === 0 || height === 0) return null;
      return { width, height };
    }
    const segmentLength = buf.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null;
    offset += 2 + segmentLength;
  }
  return null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/imageMeta.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Type-check**

Run: `npm run lint`
Expected: exit 0.

---

### Task 2: Shared types + issue post-processing (`server/issueProcessing.ts`)

**Files:**
- Modify: `src/types.ts`
- Create: `server/issueProcessing.ts`
- Test: `server/issueProcessing.test.ts`

**Interfaces:**
- Consumes: `Issue`, `SeverityType`, `CategoryType` from `src/types.ts`.
- Produces (consumed by Task 3):
  `processIssues(rawIssues: unknown[], runId: string): Issue[]` — filters evidence-less issues, clamps enums/coordinates, dedupes, assigns ids.
- Produces (consumed by Tasks 3, 5, 6, 7): new fields on types —
  `Issue.designEvidence?: string`, `Issue.siteEvidence?: string`,
  `AnalysisRun.isFallback?: boolean`,
  `AnalysisRun.fallbackReason?: "missing_api_key" | "api_error" | "demo_requested"`,
  and a new `ComparisonSetup` interface.

- [ ] **Step 1: Extend `src/types.ts`**

In `src/types.ts`, add to the `Issue` interface after `estimatedImpact?: string;`:

```typescript
  designEvidence?: string; // What the design image concretely shows at this location
  siteEvidence?: string;   // What the developed build concretely shows instead
```

Add to the `AnalysisRun` interface after `error?: string;`:

```typescript
  isFallback?: boolean; // true when this run is canned demo data, not real Gemini output
  fallbackReason?: "missing_api_key" | "api_error" | "demo_requested";
```

Add at the end of the file:

```typescript
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
```

- [ ] **Step 2: Write the failing test**

Create `server/issueProcessing.test.ts`:

```typescript
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run server/issueProcessing.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

Create `server/issueProcessing.ts`:

```typescript
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/issueProcessing.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Type-check**

Run: `npm run lint`
Expected: exit 0.

---

### Task 3: `/api/analyze` rewrite — structured prompt, evidence schema, deterministic settings, visible fallback

**Files:**
- Modify: `server.ts` (the `/api/analyze` handler, roughly lines 240–640)

**Interfaces:**
- Consumes: `parseImageDimensions` (Task 1), `processIssues` (Task 2), extended `Issue`/`AnalysisRun` types (Task 2).
- Produces: `/api/analyze` responses where every run includes `isFallback: boolean` and (when true) `fallbackReason`. Consumed by Task 6 (banner) and Task 7 (sync).

- [ ] **Step 1: Add imports**

At the top of `server.ts`, alongside the existing type import:

```typescript
import { parseImageDimensions } from "./server/imageMeta";
import { processIssues } from "./server/issueProcessing";
```

- [ ] **Step 2: Tag all three fallback paths**

There are three places that return canned data; each gets the two new fields on the run object it builds:

1. The `if (!client || isDemo)` mock block (`completedRun` around line 345):

```typescript
      isFallback: true,
      fallbackReason: !client ? "missing_api_key" : "demo_requested",
```

2. The catch-handler fallback (`fallbackRun` around line 625):

```typescript
      isFallback: true,
      fallbackReason: "api_error",
```

3. The real-result path (`completedRun` around line 531) gets:

```typescript
      isFallback: false,
```

- [ ] **Step 3: Replace the prompt**

Replace the entire `promptText` template (currently `server.ts:386-422`) with:

```typescript
    const designDims = parseImageDimensions(designPart.data, designPart.mimeType);
    const siteDims = parseImageDimensions(sitePart.data, sitePart.mimeType);
    const dimsNote =
      designDims && siteDims
        ? `Image 1 (design) is ${designDims.width}x${designDims.height}px; Image 2 (developed build) is ${siteDims.width}x${siteDims.height}px. The images may differ in scale or aspect ratio — do NOT report scaling, cropping, or resolution artifacts as issues.`
        : `The images may differ in scale or aspect ratio — do NOT report scaling, cropping, or resolution artifacts as issues.`;

    const promptText = `
You are an expert frontend visual QA auditor. Image 1 is the design mockup (source of truth). Image 2 is the developed build. Find real, visible discrepancies where the build deviates from the design.

${dimsNote}

Perform these comparison passes IN ORDER and report findings from each:

PASS 1 — TEXT CONTENT: Read every piece of text in BOTH images character by character. Report any text that is missing, truncated, added, or changed in the build (category "typography", usually severity "critical" — wrong content misrepresents the product).
PASS 2 — LAYOUT & POSITION: Sections, grids, columns, alignment, element order, missing/moved components (category "layout").
PASS 3 — SPACING: Padding, margins, gaps that clearly differ (category "layout").
PASS 4 — TYPOGRAPHY STYLE: Font weight, size, line breaks, letter case (category "typography").
PASS 5 — COLOR & BRAND: Colors, gradients, borders, shadows that differ (category "color").
PASS 6 — ACCESSIBILITY: Low-contrast text, touch targets that shrank below ~44px equivalent (category "accessibility").

EVIDENCE RULE (critical): For every issue you MUST fill "designEvidence" (what Image 1 concretely shows) and "siteEvidence" (what Image 2 concretely shows instead). If you cannot state both from what is visibly in the images, DO NOT report the issue. Never guess or infer beyond what is visible.

SEVERITY RUBRIC:
- "critical": wrong/missing content, or layout broken enough to mislead users
- "major": clearly off-spec visual difference a stakeholder would flag
- "minor": subtle deviation most users would not notice
- "suggestion": improvement idea, not a spec violation

SCORE RUBRIC: Start at 100. Deduct roughly 15 per critical, 8 per major, 3 per minor, 1 per suggestion. Floor at 0. If the images are essentially identical, return 100 and an empty issues array.

COORDINATES: "xPercent"/"yPercent" are 0-100 positions of the issue's center ON IMAGE 2.

Return ONLY valid JSON matching the response schema.
`;
```

- [ ] **Step 4: Extend the response schema and pin generation settings**

In the `client.models.generateContent` call (`server.ts:438-490`):

1. Inside `config`, add:

```typescript
            temperature: 0,
```

2. In the issue item `properties`, add after `estimatedImpact`:

```typescript
                      designEvidence: {
                        type: Type.STRING,
                        description: "What the design mockup (Image 1) concretely shows at this location."
                      },
                      siteEvidence: {
                        type: Type.STRING,
                        description: "What the developed build (Image 2) concretely shows instead."
                      }
```

3. Update the item `required` array to:

```typescript
                    required: ["severity", "category", "title", "description", "xPercent", "yPercent", "designEvidence", "siteEvidence"]
```

- [ ] **Step 5: Reorder models strongest-first**

Replace `modelsToTry` (`server.ts:428-432`) with:

```typescript
    const modelsToTry = [
      "gemini-3.1-pro-preview",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite"
    ];
```

- [ ] **Step 6: Use `processIssues` for post-processing**

Replace the `verifiedIssues` mapping block (`server.ts:521-529`) with:

```typescript
    const verifiedIssues = processIssues(parsedData.issues || [], runId);
```

- [ ] **Step 7: Verify — demo path returns fallback flags**

With the dev server running (`npm run dev`; free port 3000 first per Global Constraints):

```bash
node -e "
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
fetch('http://localhost:3000/api/analyze', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ projectId: 't', projectName: 't', designImage: tinyPng, siteImage: tinyPng, isDemo: true })
}).then(r => r.json()).then(d => console.log('isFallback:', d.isFallback, '| reason:', d.fallbackReason));
"
```

Expected: `isFallback: true | reason: demo_requested`

- [ ] **Step 8: Verify — real analysis finds the text issue with evidence, twice**

```bash
node -e "
const fs = require('fs');
const b64 = p => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
const body = JSON.stringify({
  projectId: 'ed-test', projectName: 'ED Test',
  designImage: b64('C:/Users/Bytes-Chirag/Downloads/default-meta-image_ (2).png'),
  siteImage: b64('C:/Users/Bytes-Chirag/Downloads/default-meta-image_.png')
});
(async () => {
  for (let i = 1; i <= 2; i++) {
    const d = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body
    }).then(r => r.json());
    console.log('run', i, '| isFallback:', d.isFallback, '| score:', d.score, '| issues:', d.issues.length);
    d.issues.forEach(x => console.log('  -', x.severity, x.category, ':', x.title, '| design:', x.designEvidence, '| site:', x.siteEvidence));
  }
})();
"
```

Expected: both runs — `isFallback: false`, 1 issue (typography, the missing "ED"), both evidence fields non-empty, similar scores across runs.

- [ ] **Step 9: Type-check and full test suite**

Run: `npm run lint && npm test`
Expected: both exit 0.

---

### Task 4: Playwright capture engine (`server/capture.ts` + `/api/capture` rewrite)

**Files:**
- Create: `server/capture.ts`
- Modify: `server.ts` (the `/api/capture` handler, lines 101–238)
- Modify: `package.json` (playwright dependency)

**Interfaces:**
- Produces: `captureWebsite(url: string, viewportWidth?: number): Promise<string>` — returns a `data:image/png;base64,...` data URL; throws `Error` with a human-readable message on failure. Consumed by the `/api/capture` route.
- `/api/capture` request body gains optional `width?: number` (default 1280). Response shape unchanged (`{ success, base64Image, sourceUrl }`), plus honest HTTP 502 `{ error }` on capture failure. Consumed by Task 7.

- [ ] **Step 1: Install Playwright + Chromium**

```bash
npm install playwright
npx playwright install chromium
```

- [ ] **Step 2: Create `server/capture.ts`**

```typescript
import { chromium, Browser } from "playwright";

// Headless Chromium singleton — launched on first capture, reused afterwards.
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true }).catch((err) => {
      browserPromise = null; // allow retry after a failed launch
      throw err;
    });
  }
  return browserPromise;
}

const DEFAULT_VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 1000;
const NAVIGATION_TIMEOUT_MS = 30_000;

export async function captureWebsite(url: string, viewportWidth?: number): Promise<string> {
  const parsed = new URL(url); // throws on invalid URL
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported URL scheme: ${parsed.protocol}`);
  }

  const width =
    typeof viewportWidth === "number" && viewportWidth >= 320 && viewportWidth <= 3840
      ? Math.round(viewportWidth)
      : DEFAULT_VIEWPORT_WIDTH;

  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT } });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: NAVIGATION_TIMEOUT_MS });
    const buffer = await page.screenshot({ type: "png", fullPage: false });
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } finally {
    await context.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    browserPromise = null;
    if (browser) await browser.close();
  }
}
```

- [ ] **Step 3: Rewrite the website branch of `/api/capture`**

In `server.ts`:

1. Add import: `import { captureWebsite } from "./server/capture";`
2. The Figma branch (`if (url.includes("figma.com") && figmaToken) { ... }`, lines 112–183) stays **unchanged**.
3. Replace everything from `let targetScreenshotUrl = "";` (line 185) through the end of the handler's catch block (line 237) with:

```typescript
    try {
      const cleanUrl = url.startsWith("http") ? url : `https://${url}`;
      const { width } = req.body;
      console.log(`[Capture Controller] Playwright capturing ${cleanUrl} at width ${width || 1280}...`);
      const base64Image = await captureWebsite(cleanUrl, width);
      return res.json({ success: true, base64Image, sourceUrl: url });
    } catch (error: any) {
      console.error(`[Capture Controller] Playwright capture failed for ${url}:`, error.message);
      return res.status(502).json({
        error: `Failed to capture ${url}: ${error.message}. Check the URL is reachable from this machine.`
      });
    }
```

Note: this removes the thum.io and microlink.io calls and the nested backup-retry entirely. The Figma-without-token case previously used microlink; it now goes through Playwright too (figma.com is a public site — rendering fidelity for Figma URLs without a token is best-effort, same as before).

- [ ] **Step 4: Verify — localhost and public captures**

With the dev server running:

```bash
node -e "
(async () => {
  for (const target of ['http://localhost:3000', 'https://example.com']) {
    const d = await fetch('http://localhost:3000/api/capture', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ url: target, type: 'staging', width: 1280 })
    }).then(r => r.json());
    const ok = d.success && d.base64Image && d.base64Image.startsWith('data:image/png;base64,iVBOR');
    console.log(target, '->', ok ? 'PNG OK (' + d.base64Image.length + ' chars)' : 'FAILED: ' + (d.error || JSON.stringify(d)).slice(0, 200));
  }
})();
"
```

Expected: both lines end `PNG OK (...)`. The localhost capture proves private-URL support (external services could never do this).

- [ ] **Step 5: Verify — bad URL returns honest error**

```bash
node -e "
fetch('http://localhost:3000/api/capture', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ url: 'http://localhost:59999', type: 'staging' })
}).then(r => Promise.all([r.status, r.json()])).then(([s, d]) => console.log('status:', s, '| error present:', !!d.error));
"
```

Expected: `status: 502 | error present: true`

- [ ] **Step 6: Type-check and tests**

Run: `npm run lint && npm test`
Expected: both exit 0.

---

### Task 5: Comparison-setup store (`src/lib/setupStore.ts`)

**Files:**
- Create: `src/lib/setupStore.ts`
- Test: `src/lib/setupStore.test.ts`
- Modify: `src/components/PremiumDashboard.tsx:50-67` (IDB version bump + store creation)

**Interfaces:**
- Consumes: `ComparisonSetup` from `src/types.ts` (Task 2).
- Produces (consumed by Task 7):
  - `saveSetup(setup: ComparisonSetup): Promise<void>` (upsert by id)
  - `getSetups(): Promise<ComparisonSetup[]>` (newest `createdAt` first)
  - `markSynced(id: string, when: string): Promise<void>`
  - `deleteSetup(id: string): Promise<void>`
  - Exported constants `IDB_NAME = "VeloceVisualQAStore"`, `IDB_VERSION = 2`, `SETUPS_STORE = "comparisonSetups"`.

**Important:** the dashboard currently opens this same database with version 1 (`PremiumDashboard.tsx:52`). Both open sites MUST use version 2 with an upgrade callback that creates whichever stores are missing, otherwise the second opener fails with `VersionError`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/setupStore.test.ts`:

```typescript
import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { saveSetup, getSetups, markSynced, deleteSetup } from "./setupStore";
import { ComparisonSetup } from "../types";

const setup = (id: string, createdAt: string): ComparisonSetup => ({
  id,
  name: `Setup ${id}`,
  figmaImageBase64: "data:image/png;base64,AAAA",
  devUrl: "http://localhost:5173",
  environmentLabel: "local",
  viewportWidth: 1280,
  createdAt,
});

describe("setupStore", () => {
  it("saves and lists setups newest-first", async () => {
    await saveSetup(setup("a", "2026-07-01T00:00:00Z"));
    await saveSetup(setup("b", "2026-07-02T00:00:00Z"));
    const all = await getSetups();
    expect(all.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("upserts on same id and records lastSyncedAt", async () => {
    await saveSetup(setup("a", "2026-07-01T00:00:00Z"));
    await markSynced("a", "2026-07-03T12:00:00Z");
    const all = await getSetups();
    expect(all.find((s) => s.id === "a")?.lastSyncedAt).toBe("2026-07-03T12:00:00Z");
  });

  it("deletes a setup", async () => {
    await deleteSetup("a");
    await deleteSetup("b");
    expect(await getSetups()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/setupStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/setupStore.ts`**

```typescript
import { ComparisonSetup } from "../types";

export const IDB_NAME = "VeloceVisualQAStore";
export const IDB_VERSION = 2;
export const SETUPS_STORE = "comparisonSetups";
const RUNS_STORE = "runs"; // owned by PremiumDashboard history; created here too so either opener can upgrade

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RUNS_STORE)) {
        db.createObjectStore(RUNS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SETUPS_STORE)) {
        db.createObjectStore(SETUPS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(SETUPS_STORE, mode);
        const request = run(transaction.objectStore(SETUPS_STORE));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
      })
  );
}

export async function saveSetup(setup: ComparisonSetup): Promise<void> {
  await tx("readwrite", (store) => store.put(setup));
}

export async function getSetups(): Promise<ComparisonSetup[]> {
  const all = await tx<ComparisonSetup[]>("readonly", (store) => store.getAll() as IDBRequest<ComparisonSetup[]>);
  return (all || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markSynced(id: string, when: string): Promise<void> {
  const all = await getSetups();
  const target = all.find((s) => s.id === id);
  if (!target) return;
  await saveSetup({ ...target, lastSyncedAt: when });
}

export async function deleteSetup(id: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(id));
}
```

- [ ] **Step 4: Bump the dashboard's IDB open site to version 2**

In `src/components/PremiumDashboard.tsx`, change line 52 and the upgrade callback (lines 58–63) to keep both stores in sync with `setupStore.ts`:

```typescript
const IDB_VERSION = 2;
```

```typescript
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("comparisonSetups")) {
        db.createObjectStore("comparisonSetups", { keyPath: "id" });
      }
    };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/setupStore.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Type-check and full suite**

Run: `npm run lint && npm test`
Expected: both exit 0.

---

### Task 6: Fallback banner + honest capture errors in `PremiumDashboard`

**Files:**
- Modify: `src/components/PremiumDashboard.tsx` (`runVisualQAAudit`, lines 1272–1500; new state + banner JSX)

**Interfaces:**
- Consumes: `isFallback`/`fallbackReason` on analyze responses (Task 3); HTTP 502 errors from `/api/capture` (Task 4).
- Produces: `fallbackInfo` state consumed by the banner; capture failures now surface as user-visible errors instead of silently substituting preset images.

- [ ] **Step 1: Add state**

Near the other `useState` hooks at the top of the `PremiumDashboard` component (search for `const [isAuditing`), add:

```typescript
  const [fallbackInfo, setFallbackInfo] = useState<{ reason: string } | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
```

- [ ] **Step 2: Remove silent preset substitution for the design image**

Replace the Figma-URL capture fallback (`PremiumDashboard.tsx:1296-1309` — the `if (response.ok)` handling plus the `if (!activeDesignImage)` preset block) with:

```typescript
        if (response.ok) {
          const resData = await response.json();
          if (resData.success && resData.base64Image) {
            activeDesignImage = resData.base64Image;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          setCaptureError(errData.error || `Could not capture the Figma URL (HTTP ${response.status}).`);
          setIsAuditing(false);
          return;
        }
      } catch (err) {
        setCaptureError("Could not reach the capture service. Is the dev server running?");
        setIsAuditing(false);
        return;
      }

      if (!activeDesignImage) {
        setCaptureError("Figma capture returned no image. Check the URL (and Figma token for private files).");
        setIsAuditing(false);
        return;
      }
```

- [ ] **Step 3: Remove silent preset substitution for the site image**

Apply the same shape to the site-URL capture block (`PremiumDashboard.tsx:1341-1353`), passing the viewport width through:

```typescript
        const response = await fetch("/api/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: projectUrl, type: "staging", width: getViewportWidthForCapture() })
        });
        if (response.ok) {
          const resData = await response.json();
          if (resData.success && resData.base64Image) {
            activeSiteImage = resData.base64Image;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          setCaptureError(errData.error || `Could not capture ${projectUrl} (HTTP ${response.status}).`);
          setIsAuditing(false);
          return;
        }
      } catch (err) {
        setCaptureError("Could not reach the capture service. Is the dev server running?");
        setIsAuditing(false);
        return;
      }

      if (!activeSiteImage) {
        setCaptureError(`Capture of ${projectUrl} returned no image.`);
        setIsAuditing(false);
        return;
      }
```

Add this helper above `runVisualQAAudit` (it derives a concrete pixel width from the existing `resolution` state, defaulting to 1280):

```typescript
  const getViewportWidthForCapture = (): number => {
    const match = String(resolution || "").match(/(\d{3,4})/);
    const width = match ? parseInt(match[1], 10) : 1280;
    return width >= 320 && width <= 3840 ? width : 1280;
  };
```

Also clear stale errors at the start of `runVisualQAAudit` (right after `setIsAuditing(true);`):

```typescript
    setCaptureError(null);
    setFallbackInfo(null);
```

- [ ] **Step 4: Record fallback state from the analyze response**

In `runVisualQAAudit`, right after `const completedRun = await response.json();` (line ~1450), add:

```typescript
      setFallbackInfo(completedRun.isFallback ? { reason: completedRun.fallbackReason || "unknown" } : null);
```

- [ ] **Step 5: Render the banner and the capture-error notice**

Create a small component above `export default function PremiumDashboard` in the same file:

```typescript
const FALLBACK_REASON_COPY: Record<string, string> = {
  missing_api_key: "GEMINI_API_KEY is not configured on the server",
  api_error: "the Gemini API was unreachable or failed after retries",
  demo_requested: "demo mode was explicitly requested",
  unknown: "the analysis engine reported fallback without a reason",
};

function FallbackBanner({ reason }: { reason: string }) {
  return (
    <div className="w-full bg-amber-500/15 border border-amber-500/60 text-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-xs font-semibold">
      <AlertTriangle size={16} className="text-amber-400 shrink-0" />
      <span>
        DEMO DATA — this result was NOT produced by Gemini analysis ({FALLBACK_REASON_COPY[reason] || reason}).
        The issues shown are canned examples and do not describe your images.
      </span>
    </div>
  );
}
```

Mount it in both result surfaces:

1. **Dashboard view**: directly above the score/issue results area — find the JSX that renders the score after an audit (search for `{score` usages in the main return) and insert as the first child of that results container:

```tsx
{fallbackInfo && <FallbackBanner reason={fallbackInfo.reason} />}
```

2. **Fullscreen compare view**: inside the fullscreen top bar container (the parent of the Sync button at line ~2337, rendered when `isFullscreen`), insert the same element as a full-width row above the toolbar buttons.

3. **Capture error notice**: near the Run/audit trigger button, render:

```tsx
{captureError && (
  <div className="w-full bg-rose-500/15 border border-rose-500/60 text-rose-200 rounded-xl px-4 py-3 text-xs font-semibold">
    Capture failed: {captureError}
  </div>
)}
```

- [ ] **Step 6: Verify in the browser**

Run the app, sign in, and use Playwright MCP (or manually):
1. Trigger an audit with a URL that cannot resolve (e.g. `http://localhost:59999`) → the rose "Capture failed" notice appears, no preset images are substituted, `isAuditing` resets.
2. Temporarily rename `.env` → restart server → run an upload-based audit → amber DEMO DATA banner appears. Restore `.env` and restart afterwards.
3. Normal audit with `.env` in place → no banner.

- [ ] **Step 7: Type-check**

Run: `npm run lint`
Expected: exit 0.

---

### Task 7: Sync flow — setup autosave/hydration, freeze overlay, functional Sync button

**Files:**
- Create: `src/components/SyncOverlay.tsx`
- Modify: `src/components/PremiumDashboard.tsx` (autosave in `runVisualQAAudit`; new `runSync`; rewire Sync button at line ~2337; setup hydration on mount)

**Interfaces:**
- Consumes: `saveSetup`, `getSetups`, `markSynced` from `src/lib/setupStore.ts` (Task 5); `ComparisonSetup` type (Task 2); `/api/capture` with `width` (Task 4).
- Produces: `SyncOverlay` props contract: `{ stage: "capturing" | "analyzing"; targetUrl: string; viewportWidth: number; onCancel: () => void }`.

- [ ] **Step 1: Create `src/components/SyncOverlay.tsx`**

```tsx
import React, { useEffect } from "react";
import { RefreshCw, X } from "lucide-react";

interface SyncOverlayProps {
  stage: "capturing" | "analyzing";
  targetUrl: string;
  viewportWidth: number;
  onCancel: () => void;
}

// Full-viewport freeze overlay shown while a Sync re-compare is in flight.
// Blocks all pointer and keyboard interaction beneath it; only Cancel works.
export default function SyncOverlay({ stage, targetUrl, viewportWidth, onCancel }: SyncOverlayProps) {
  useEffect(() => {
    const blockKeys = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", blockKeys, true);
    return () => window.removeEventListener("keydown", blockKeys, true);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-6"
      aria-modal="true"
      role="dialog"
    >
      <RefreshCw size={40} className="text-emerald-400 animate-spin" />
      <div className="text-center space-y-2 max-w-md px-6">
        <h3 className="text-slate-100 font-bold text-lg">Re-comparing against live build</h3>
        <p className="text-slate-400 text-sm font-mono break-all">
          {stage === "capturing"
            ? `Capturing ${targetUrl} at ${viewportWidth}px...`
            : "Analyzing with Gemini..."}
        </p>
        <p className="text-slate-500 text-xs">The screen is frozen to prevent interaction during sync.</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 cursor-pointer"
      >
        <X size={13} />
        Cancel Sync
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add sync state + imports to `PremiumDashboard.tsx`**

Imports:

```typescript
import SyncOverlay from "./SyncOverlay";
import { saveSetup, getSetups, markSynced } from "../lib/setupStore";
import { ComparisonSetup } from "../types";
```

State (near the other hooks):

```typescript
  const [activeSetup, setActiveSetup] = useState<ComparisonSetup | null>(null);
  const [syncStage, setSyncStage] = useState<"capturing" | "analyzing" | null>(null);
  const syncAbortRef = React.useRef<AbortController | null>(null);
```

Hydrate the newest saved setup on mount:

```typescript
  useEffect(() => {
    getSetups().then((all) => {
      if (all.length > 0) setActiveSetup(all[0]);
    }).catch(() => {});
  }, []);
```

- [ ] **Step 3: Autosave a setup after successful URL-mode audits**

In `runVisualQAAudit`, immediately after the history-save block (`saveHistoryWithQuotaManagement(processedHistory);`, line ~1495), add:

```typescript
      // Persist this pairing so Sync can re-compare without re-uploads
      if (projectMode === "url" && projectUrl && activeDesignImage) {
        const env = projectUrl.includes("localhost") || projectUrl.includes("127.0.0.1")
          ? "local" : projectUrl.includes("staging") ? "staging" : "production";
        const setup: ComparisonSetup = {
          id: activeSetup?.id || `setup-${Date.now()}`,
          name: activeProjectName || projectUrl,
          figmaImageBase64: processedDesign,
          devUrl: projectUrl,
          environmentLabel: env,
          viewportWidth: getViewportWidthForCapture(),
          createdAt: activeSetup?.createdAt || new Date().toISOString(),
        };
        setActiveSetup(setup);
        saveSetup(setup).catch((err) => console.error("Failed to persist comparison setup", err));
      }
```

Note: `projectMode`'s URL-mode value must be confirmed at implementation time (search `projectMode ===` in the file — it is the non-`"upload"` branch; if the literal is e.g. `"url"` adjust accordingly).

- [ ] **Step 4: Implement `runSync`**

Add below `runVisualQAAudit`:

```typescript
  const runSync = async () => {
    if (!activeSetup || syncStage) return;
    const controller = new AbortController();
    syncAbortRef.current = controller;
    setCaptureError(null);
    setFallbackInfo(null);
    setSyncStage("capturing");

    try {
      const capRes = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: activeSetup.devUrl, type: "staging", width: activeSetup.viewportWidth }),
        signal: controller.signal,
      });
      if (!capRes.ok) {
        const errData = await capRes.json().catch(() => ({}));
        throw new Error(errData.error || `Capture failed (HTTP ${capRes.status})`);
      }
      const capData = await capRes.json();
      if (!capData.base64Image) throw new Error("Capture returned no image.");

      setSyncStage("analyzing");
      const anaRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: activeSetup.id,
          projectName: activeSetup.name,
          designImage: activeSetup.figmaImageBase64,
          siteImage: capData.base64Image,
          isDemo: false,
        }),
        signal: controller.signal,
      });
      if (!anaRes.ok) throw new Error(`Analysis failed (HTTP ${anaRes.status})`);
      const completedRun = await anaRes.json();

      setFallbackInfo(completedRun.isFallback ? { reason: completedRun.fallbackReason || "unknown" } : null);
      const mappedIssues: PremiumIssue[] = (completedRun.issues || []).map((issue: any) => ({
        ...issue,
        classification: issue.classification || (issue.category === "layout" ? "misaligned" : issue.category === "color" ? "unmatched" : "missing"),
        improvementNote: issue.improvementNote || issue.cssSuggestion || "Sync CSS properties to match standard brand layouts.",
      }));
      setScore(completedRun.score);
      setPremiumIssues(mappedIssues);
      setCurrentDesignImage(activeSetup.figmaImageBase64);
      setCurrentSiteImage(capData.base64Image);
      setActiveRunTitle(activeSetup.name);

      const now = new Date().toISOString();
      const newHistoryItem = {
        id: completedRun.id || `run-${Date.now()}`,
        projectName: activeSetup.name,
        startedAt: completedRun.startedAt || now,
        completedAt: completedRun.completedAt || now,
        designImage: activeSetup.figmaImageBase64,
        siteImage: capData.base64Image,
        score: completedRun.score,
        issues: mappedIssues,
        status: "completed",
        resolution: `${activeSetup.viewportWidth}px`,
        inputs: { mockup: activeSetup.name, staging: activeSetup.devUrl },
        archived: false,
      };
      const sortedHistory = [newHistoryItem, ...historyRuns.filter((r) => r.id !== newHistoryItem.id)]
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .map((run, idx) => ({ ...run, archived: idx >= 20 }));
      setHistoryRuns(sortedHistory);
      saveHistoryWithQuotaManagement(sortedHistory);

      setActiveSetup({ ...activeSetup, lastSyncedAt: now });
      markSynced(activeSetup.id, now).catch(() => {});
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setCaptureError(err.message || "Sync failed.");
      }
    } finally {
      syncAbortRef.current = null;
      setSyncStage(null);
    }
  };

  const cancelSync = () => {
    syncAbortRef.current?.abort();
  };
```

- [ ] **Step 5: Rewire the Sync button and mount the overlay**

Replace the Sync button's `onClick`/`disabled` (line ~2337-2348):

```tsx
              <button
                type="button"
                disabled={!!syncStage || isAuditing || (!activeSetup && figmaMode === "upload" && projectMode === "upload")}
                onClick={() => {
                  if (activeSetup) {
                    runSync();
                  } else {
                    setLoadingText("Syncing and Re-analyzing...");
                    runVisualQAAudit(); // no saved URL setup — fall back to re-running the current inputs
                  }
                }}
                title={activeSetup ? `Re-capture ${activeSetup.devUrl} and re-compare` : "Re-run the audit with current inputs"}
                className={`px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 ${(syncStage || isAuditing) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} shadow-sm border border-slate-700`}
              >
                <RefreshCw size={13} className={(syncStage || isAuditing) ? 'animate-spin' : ''} />
                <span>{syncStage ? 'Syncing...' : 'Sync'}</span>
              </button>
```

Mount the overlay at the very end of the component's root return (so it covers both dashboard and fullscreen modes):

```tsx
      {syncStage && activeSetup && (
        <SyncOverlay
          stage={syncStage}
          targetUrl={activeSetup.devUrl}
          viewportWidth={activeSetup.viewportWidth}
          onCancel={cancelSync}
        />
      )}
```

- [ ] **Step 6: Type-check**

Run: `npm run lint`
Expected: exit 0.

---

### Task 8: End-to-end verification

**Files:** none created — verification only.

- [ ] **Step 1: Full test suite + types**

Run: `npm test && npm run lint`
Expected: all pass.

- [ ] **Step 2: API-level regression of the accuracy work**

Re-run Task 3 Steps 7–8 verification scripts. Expected: unchanged results (fallback flags correct; ED issue found with evidence).

- [ ] **Step 3: UI flow via Playwright MCP** (needs the user signed in — coordinate with them, do not enter credentials yourself)

1. Configure a comparison: upload the "GET DRIVERS ED" design image, set site source to URL mode pointing at a reachable page, run audit → result renders, no fallback banner.
2. Reload the page → the saved setup hydrates (check via the Sync button being enabled without re-uploading).
3. Click **Sync** → freeze overlay appears (verify a click on an issue pin beneath does nothing), stages progress "Capturing…" → "Analyzing…", overlay releases, updated result + history entry appear.
4. Click **Sync**, then **Cancel Sync** mid-capture → overlay releases promptly, no result corruption, rose error suppressed (abort is silent).
5. Point a setup at `http://localhost:59999`, Sync → rose "Capture failed" notice, overlay releases.

- [ ] **Step 4: Report results to the user**

Summarize what passed/failed with actual outputs. Do NOT claim success without running the commands (verification-before-completion).
