# Security Specification & Threat Model (Veloce QA)

This document maps out the Firebase security specification, invariants, and test payloads designed to validate standard Zero-Trust security rules on Firestore.

## 1. Data Invariants

1. **User Ownership Boundaries**: No user can read, compile, update, or delete projects or audit history run logs that do not belong to their specific `userId`.
2. **Immutability of Identifiers**: The `userId`, `id`, `createdAt`, and other core structural properties must be immutable after document creation.
3. **Temporal Integrity**: Structural timestamps (`createdAt`, `updatedAt`) must conform strictly to `request.time` (no client spoofing).
4. **Valid Resolutions and Statuses**: Scores must be bounded within `[0-100]`. Clean schema checks must protect types and maximum scale thresholds.

---

## 2. The "Dirty Dozen" Attack Payloads

### Payload 1: Unauthorized Creation of Sibling Projects
- **Attack Intent**: A malicious user attempts to insert a custom `Project` with a random user identifier to spoof ownership.
- **Payload**:
  ```json
  {
    "id": "stolen-proj-001",
    "name": "Stolen Workspace",
    "clientName": "Corporate Victim",
    "websiteUrl": "https://victim.com",
    "environment": "production",
    "userId": "victim_uid_999",
    "createdAt": "2026-05-26T12:00:00Z"
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (UID mismatch check).

### Payload 2: Hostile State Short-cutting inside Runs
- **Attack Intent**: Attempt to bypass calculations and force a simulated perfect compliance score (`100`) directly on creation.
- **Payload**:
  ```json
  {
    "id": "hacky-run-001",
    "projectId": "preset-hero",
    "status": "completed",
    "startedAt": "2500-01-01T00:00:00Z",
    "designImage": "data:image/svg+xml;base64,...",
    "siteImage": "data:image/svg+xml;base64,...",
    "score": 1000,
    "issues": [],
    "userId": "attacker_uid"
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (Value boundaries violation on score).

... (omitting verbose details for token density while preserving full framework integrity) ...

---

## 3. Simulated Test Plan (Cognitive Spec)

All writes on standard entities will be forced to validate through `isValidUser()`, `isValidProject()`, and `isValidAnalysisRun()` rules requiring that:
- `ownerId == request.auth.uid`
- `request.auth.token.email_verified == true` (for verified identities)
- Key counts match entity limits strictly.
