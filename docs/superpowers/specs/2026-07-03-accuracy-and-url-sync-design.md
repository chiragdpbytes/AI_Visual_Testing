# Design: Comparison Accuracy Improvements + Figma-vs-Live-URL Sync

Date: 2026-07-03
Status: Approved by user (conversation), pending spec review

## Problem

1. **Accuracy**: The Gemini visual comparison uses a single freeform prompt with no
   evidence requirements, non-deterministic generation settings, weakest-model-first
   rotation, and no result post-processing beyond enum clamping. Real analyses work
   (verified with the "GET DRIVERS ED" test) but precision/consistency can be
   significantly improved.
2. **Silent fallback**: When `GEMINI_API_KEY` is missing or the API fails, the server
   returns hardcoded canned issues that are indistinguishable from real results in the
   UI. This misled the user twice during testing.
3. **URL comparison**: `/api/capture` uses external services (thum.io / microlink.io)
   that cannot reach `localhost` or private staging URLs. When capture fails, the
   client silently substitutes preset demo images (`PremiumDashboard.tsx:1306,1351`).
4. **Re-upload friction**: Users must re-upload the Figma reference and a fresh dev
   screenshot for every audit. No way to save a comparison pairing and re-run it.

## Scope

Two workstreams, one server file + one dashboard component + one new client module:

### Workstream A — Analysis accuracy (`server.ts`)

**A1. Prompt rewrite** (`/api/analyze`)
- Structured, ordered comparison passes: ① text content (read all text in both
  images character-by-character; catches truncation like the missing "ED"),
  ② layout/grid/position, ③ spacing, ④ typography styling, ⑤ color/brand,
  ⑥ accessibility (contrast, touch-target size).
- Evidence requirement: each issue must include `designEvidence` and `siteEvidence`
  (what each image concretely shows). New fields in the response schema; the model
  is instructed to omit issues it cannot back with visible evidence.
- Severity rubric: critical = wrong/missing content or broken layout;
  major = clearly off-spec visual; minor = subtle deviation; suggestion = improvement.
- Scoring rubric spelled out for consistency (100 = identical; deductions per
  severity tier).
- Both images' pixel dimensions parsed from PNG/JPEG headers (no new dependency)
  and stated in the prompt, with instruction not to flag scale/aspect-ratio
  artifacts as bugs.

**A2. Generation settings**
- Model rotation reordered strongest-first: `gemini-3.1-pro-preview` →
  `gemini-3.5-flash` → `gemini-3.1-flash-lite`.
- `temperature: 0` for deterministic repeatable audits.

**A3. Post-processing**
- Drop issues missing `designEvidence` or `siteEvidence`.
- Deduplicate: same category with pin coordinates within 5% → keep higher severity.
- Existing enum/coordinate clamping retained.

**A4. Visible fallback**
- Every canned/mock response gains `isFallback: true` and
  `fallbackReason: "missing_api_key" | "api_error" | "demo_requested"`.
- Real responses set `isFallback: false`.
- `PremiumDashboard` renders a prominent amber banner on fallback results:
  "Demo data — Gemini was not used (<reason>)".

### Workstream B — Figma vs Live-URL comparison with Sync

**B1. Playwright capture engine** (`server.ts`)
- New dependency: `playwright` (Chromium only).
- `/api/capture` for website URLs uses a lazily-launched, reused headless Chromium
  singleton: `page.goto(url, { waitUntil: "networkidle" })`, viewport width from
  request (default 1280; wired to dashboard resolution selector), returns base64 PNG.
- Works for localhost, VPN-only staging, and production URLs.
- Figma-URL capture path (Figma REST API + token) unchanged.
- External-service calls removed for website captures. Playwright failure returns an
  honest HTTP error — no silent preset substitution (client fallback at
  `PremiumDashboard.tsx:1306,1351` also removed).
- Only http/https URLs accepted. localhost intentionally allowed (local dev tool).

**B2. Saved comparison setups (IndexedDB, client)**
- New object store `comparisonSetups` alongside existing history store:
  `{ id, name, figmaImageBase64, devUrl, environmentLabel, viewportWidth,
  createdAt, lastSyncedAt }`.
- Auto-saved when an audit runs with a Figma image + dev URL pairing.
- Setup picker UI to reload a saved pairing — no re-upload after browser restart.

**B3. Sync re-compare flow**
- Existing "Sync" toolbar button becomes functional: active setup → freeze UI →
  re-capture dev URL via Playwright at stored viewport → `/api/analyze` with stored
  Figma image + fresh screenshot → update comparison view, score, pins, history,
  `lastSyncedAt`.

**B4. Fullscreen freeze overlay**
- Fixed full-viewport overlay during sync: dark scrim, progress stages
  ("Capturing <url> at <width>px…" → "Analyzing with Gemini…"), blocks all pointer
  and keyboard interaction beneath.
- Single Cancel button aborts in-flight capture/analyze via `AbortController` and
  unfreezes.

## Explicitly out of scope

- Multi-pass Gemini verification (option rejected: cost).
- Real multi-resolution analysis (deferred; Playwright viewport control enables it later).
- Firestore persistence of setups (IndexedDB chosen; per-browser is acceptable).
- Auto-sync on interval.

## Known limitations

- `localhost` capture reaches the machine running the Express server. Fine locally;
  on Cloud Run "localhost" would be the container itself.
- IndexedDB setups don't roam across browsers/devices.
- Playwright adds a ~300MB browser download at install time.

## Testing plan

1. API: analyze the "GET DRIVERS ED" pair → exactly one text issue with both
   evidence fields populated; run twice → consistent results (temp 0).
2. API: `isDemo: true` → `isFallback: true` + reason; UI shows amber banner.
3. API: capture a local test page via Playwright → valid PNG; capture a public URL.
4. UI (Playwright MCP): full flow — save setup, reload page, setup persists,
   Sync re-captures + re-analyzes, freeze overlay blocks clicks and releases.
5. Regression: uploaded-images flow still works end-to-end.
