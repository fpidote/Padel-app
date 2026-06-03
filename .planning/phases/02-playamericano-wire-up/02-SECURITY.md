---
phase: 02-playamericano-wire-up
audited_at: 2026-06-03
asvs_level: 1
auditor: claude-sonnet-4-6
result: SECURED
threats_open: 0
---

# Security Audit — Phase 02: PlayAmericano Wire-Up

**Phase:** 02 — PlayAmericano Wire-Up
**Threats Closed:** 5/5
**ASVS Level:** 1
**Block On:** open

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-02-01 | Spoofing | mitigate | CLOSED | See below |
| T-02-02 | Information Disclosure | mitigate | CLOSED | See below |
| T-02-03 | Tampering | accept | CLOSED | Accepted risk — documented below |
| T-02-04 | Denial of Service | accept | CLOSED | Accepted risk — documented below |
| T-02-05 | Tampering | accept | CLOSED | Accepted risk — documented below |

---

## Mitigated Threats

### T-02-01 — Spoofing: isAdmin gate for WarningsBanner

**Declared mitigation:** Gate is `isAdmin && t.roundWarnings?.length > 0` where isAdmin comes from Firebase Auth comparison in useTournament, never from localStorage or URL params.

**Verification:**

1. Gate pattern in PlayAmericano.jsx — FOUND at line 204:
   ```
   {isAdmin && t.roundWarnings?.length > 0 && (
   ```

2. `isAdmin` received as a prop at the component signature (line 30) — PlayAmericano never computes isAdmin itself:
   ```
   export default function PlayAmericano({ t, code, isAdmin, persist, copyCode, onEditTournament })
   ```

3. `isAdmin` derivation in useTournament.js — FOUND at line 14:
   ```
   const isAdmin = !!(authUser?.uid && t?.ownerUid && authUser.uid === t.ownerUid);
   ```
   `authUser` is set exclusively by `onAuthStateChanged(auth, ...)` (line 19) — pure Firebase Auth, no client-supplied value.

4. `localStorage` grep across both files — zero matches. No localStorage used anywhere in the isAdmin chain.

**Finding: CLOSED.** isAdmin is derived solely from Firebase Auth UID comparison in useTournament.js and passed as a prop. No bypass vector via localStorage, URL params, or any other client-controlled source.

---

### T-02-02 — Information Disclosure: WarningsBanner content visible to spectators

**Declared mitigation:** isAdmin prop gates the entire WarningsBanner render. Spectators receive `t` via onSnapshot but the JSX never renders the warnings DOM for non-admins.

**Verification:**

1. Usage site gate — FOUND at PlayAmericano.jsx line 204–206:
   ```
   {isAdmin && t.roundWarnings?.length > 0 && (
     <WarningsBanner warnings={t.roundWarnings} />
   )}
   ```
   Short-circuit evaluation: when `isAdmin` is false (spectator), `WarningsBanner` is never called and no DOM node is produced.

2. `WarningsBanner` is defined at file scope (line 853) and has no independent render path — it is only reachable via the gated call above. No other call site exists in the file (grep confirms exactly 2 occurrences: usage site line 205 and definition line 853).

3. `t.roundWarnings` data is present in the Firestore document received by all clients via onSnapshot — the mitigation is purely JSX-layer gating, not data-layer filtering. This is consistent with the declared mitigation plan and accepted for this phase (Phase 2 is display-only; Firestore Security Rules hardening is tracked in CLAUDE.md §9 as a pre-deploy item).

**Finding: CLOSED.** The WarningsBanner JSX block is unconditionally gated behind `isAdmin &&`. Spectators never receive a rendered DOM element containing warning content. The underlying data is present in the Firestore snapshot for all clients, which is the accepted trust boundary for this phase.

---

## Accepted Risks

### T-02-03 — Tampering: Client modifying t.precomputedRounds or t.roundWarnings in-browser

**Disposition:** accept

**Rationale:** These fields are display-only in Phase 2. No writes to `t.precomputedRounds` or `t.roundWarnings` occur in PlayAmericano.jsx. A client modifying these fields in-browser (e.g., via dev tools) affects only their local React state; the Firestore document is not modified. The local view corruption does not affect other users.

**Residual risk:** A malicious admin could modify these fields in their own browser state and then trigger `persist()`, which would write the tampered data to Firestore (and thus to all spectators). However, only the authenticated admin can call `persist()` (the persist function is passed only when the caller is an admin in TournamentPage). This is an accepted self-tampering risk for Phase 2.

**Remediation path:** Firestore Security Rules should validate `ownerUid` and enforce schema constraints on writes. Tracked in CLAUDE.md §9 as pre-deploy hardening.

---

### T-02-04 — Denial of Service: Very large t.roundWarnings array on mobile

**Disposition:** accept

**Rationale:** `t.roundWarnings` count is structurally bounded by `totalRounds` (7–12 for typical americano tournaments). Rendering 12 amber `<div>` rows inside a collapsed banner is O(n) DOM and trivially fast on any mobile device. No pagination or virtualization is needed at this scale.

---

### T-02-05 — Tampering: npm/pip/cargo installs

**Disposition:** accept

**Rationale:** Phase 2 introduces zero new npm packages. The `tech_stack.added` field in 02-01-SUMMARY.md is empty (`[]`). Package Legitimacy Audit is not applicable to this phase.

---

## Unregistered Threat Flags

SUMMARY.md `## Threat Flags` (lines 111–113) reports: "Sin nueva superficie de amenaza más allá del modelo de amenazas del plan. `isAdmin` sigue siendo `auth.currentUser.uid === t.ownerUid` (Firebase Auth puro, sin localStorage)."

No unregistered flags requiring threat mapping.

---

## Notes

- The Descansos tab (T-02-02 adjacent surface) is intentionally visible to all users (admin + spectators). This is by design per D-03 in the plan — rest schedule information is non-sensitive.
- `t.roundWarnings` data travels in the Firestore `data` JSON field to all connected clients. The mitigation is JSX-layer only. Full server-side field-level ACL is deferred to the Firestore Security Rules hardening milestone.
- No implementation files were modified during this audit.
