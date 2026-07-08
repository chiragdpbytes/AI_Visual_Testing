# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Veloce QA" — an AI-powered frontend visual QA platform (built via Google AI Studio) that compares a Figma design mockup against a live website screenshot using Gemini vision models, and reports layout/typography/color/accessibility discrepancies with suggested CSS fixes.

## Commands

- `npm run dev` — start the app (tsx runs `server.ts`, which mounts Vite in middleware mode for HMR). Serves on `http://localhost:3000`.
- `npm run build` — builds the client with Vite, then bundles `server.ts` into `dist/server.cjs` with esbuild (Node/CJS target, sourcemaps, external packages).
- `npm run start` — runs the production build (`node dist/server.cjs`); requires `npm run build` first and `NODE_ENV=production` to serve static files from `dist/` instead of mounting Vite.
- `npm run lint` — type-checks the whole project with `tsc --noEmit` (no separate ESLint config; this is the only "lint" step).
- `npm run clean` — removes `dist/` and `server.js`.
- There is no test runner configured in this repo.

## Environment

- `GEMINI_API_KEY` — required for real Gemini Vision calls. If unset, the server logs a warning and every `/api/analyze` call automatically falls back to a hardcoded mock analysis engine (see below). This means the app is fully usable and demoable with zero configuration.
- `APP_URL` — self-referential URL, injected by AI Studio's Cloud Run hosting; not needed for local dev.
- Firebase client config lives in `firebase-applet-config.json` (project id, apiKey, authDomain, etc.) and is imported directly by `src/firebase.ts` — it's a public web client config, not a server secret.

## Architecture

This is a single Express server (`server.ts`) that both serves the Vite/React SPA and exposes the JSON API — there is no separate backend service or build step split between client/server code during dev.

### Server (`server.ts`)

- All data (`projects`, `analysisHistory`) is kept in **in-memory arrays** — nothing is persisted server-side; it resets on every restart. Note this is distinct from the Firestore layer used client-side for auth-scoped persistence (see below) — the two are not currently wired together.
- `getGeminiClient()` lazily constructs a single `GoogleGenAI` client from `GEMINI_API_KEY`; returns `null` if the key is missing, which triggers demo-mode fallbacks throughout.
- `POST /api/capture` — given a URL, returns a base64 screenshot. For Figma URLs with a user-supplied `figmaToken`, it tries the official Figma REST API first (parses `fileKey`/`node-id` out of the URL, calls `api.figma.com/v1/images/...`); otherwise/on failure it falls back to `thum.io` (websites) or `microlink.io` (Figma without token), then to a second `microlink.io` retry if the primary capture fails.
- `POST /api/analyze` — the core AI comparison endpoint. Takes `designImage`/`siteImage` (base64 data URLs), strips the data-URL prefix, and sends both images + a detailed comparison prompt to Gemini with a strict JSON response schema (`score` + `issues[]` with `severity`/`category`/`title`/`description`/`xPercent`/`yPercent`/`cssSuggestion`/`estimatedImpact`). It retries across a rotation of models (`gemini-3.5-flash`, `gemini-3.1-flash-lite`, `gemini-3.1-pro-preview`) with exponential backoff on failure.
  - If `GEMINI_API_KEY` is missing, or `isDemo` is passed, or the Gemini call ultimately fails after retries, the endpoint **never returns an error to the client** — it always falls back to a deterministic mock/fallback `AnalysisRun` (with different canned issues depending on whether the project name looks pricing-related) so the UI always has something to render.
- Issue coordinates (`xPercent`/`yPercent`) are always clamped to `[0, 100]` server-side before being stored/returned.

### Client (`src/`)

- `App.tsx` is the legacy/simple dashboard (fetches `/api/projects`, uploads two images, calls `/api/analyze`, renders results via `CompareCanvas`/`IssueCard`/`ReportStats`). It gates on Firebase auth state (`onAuthStateChanged`) and shows `AuthOverlay` when signed out.
- `App.tsx` immediately redirects into `PremiumDashboard` (`dashboardMode` defaults to `"premium"`) — `PremiumDashboard` is the actively-developed, feature-rich dashboard (device frame previews, IndexedDB-backed run history, PDF/report export, etc.) and is where most UI work should target; the legacy dashboard body in `App.tsx` is effectively dead code reachable only by manually toggling `dashboardMode`.
- `src/firebase.ts` initializes Firebase (Auth + Firestore) from `firebase-applet-config.json` and exposes `handleFirestoreError`, a helper that serializes Firestore errors (with auth context) into a JSON string and throws — used across auth/project/history read-write call sites for consistent error diagnostics.
- `src/presets.ts` defines canned `PresetCase` scenarios (`presetCatalog`, `presetPricing`, etc.) used both as default/demo data and as one-click "preset" comparisons in the UI (`PresetSelector`) that bypass the API entirely.
- `src/types.ts` is the single source of truth for shared domain types (`Project`, `Issue`, `AnalysisRun`, `PresetCase`, `SeverityType`, `CategoryType`) — mirrored independently in `server.ts`'s imports and in the Firestore schema/rules below, so changes to shape need to be kept in sync across all three by hand.

### Firebase / Firestore

- `firestore.rules` implements a default-deny, per-`userId`-ownership model for three collections: `users/{userId}`, `projects/{projectId}`, `historyRuns/{runId}`. Every collection requires `isEmailVerified()` and enforces field-level schema validation (`isValidUser`/`isValidProject`/`isValidAnalysisRun`) plus immutability of `userId`/`createdAt`/`id`-type fields on update via `diff(...).affectedKeys().hasOnly([...])` allowlists.
- `firebase-blueprint.json` documents the corresponding entity schemas (`User`, `Project`, `AnalysisRun`) and their Firestore collection paths — treat it as the schema spec when changing `firestore.rules` or the client's Firestore read/writes.
- `security_spec.md` is the informal threat model/test-payload catalog ("Dirty Dozen" attack payloads) that `firestore.rules` is designed to defend against (ownership spoofing, score/status short-circuiting, timestamp spoofing, etc.) — consult it when modifying security rules to make sure existing attack classes stay blocked.
- Note the current disconnect: `server.ts`'s `/api/projects` and `/api/analysis/history` endpoints operate on in-memory arrays, not Firestore, even though Firestore rules/schemas for `projects` and `historyRuns` exist and the client authenticates via Firebase — persistence wiring between the two is incomplete.

## Path aliases

`@/*` resolves to the project root (configured in both `tsconfig.json` and `vite.config.ts`).
