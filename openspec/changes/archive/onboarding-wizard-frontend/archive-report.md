# Archive Report: onboarding-wizard-frontend

**Status**: Complete  
**Change**: onboarding-wizard-frontend (change 3 of 3)  
**Archived to**: `openspec/changes/archive/onboarding-wizard-frontend/`  
**Archive Date**: 2026-08-18  
**Project**: rack-frontend

## Artifacts Merged into Source of Truth

| Domain | Type | Status | Path |
|--------|------|--------|------|
| onboarding-wizard | NEW capability | ✓ Synced | `openspec/specs/onboarding-wizard/spec.md` |
| license-state-ux | NEW capability | ✓ Synced | `openspec/specs/license-state-ux/spec.md` |

Both delta specs were full new-domain specs (no MODIFIED or REMOVED requirements). Mechanical copy verified with empty `diff -r` output.

## Archive Contents

All artifacts successfully moved to `openspec/changes/archive/onboarding-wizard-frontend/`:

- ✓ `proposal.md` (Engram #144)
- ✓ `design.md` (Engram #148)
- ✓ `tasks.md` (41 implementation tasks checked; 4 Phase-3 external-gate tasks unchecked per reconciliation below)
- ✓ `specs/onboarding-wizard/spec.md` (11 ADDED requirements)
- ✓ `specs/license-state-ux/spec.md` (7 ADDED requirements)

**Verification**: Mechanical move with `git mv` + empty `diff -r` readback (archive-report excluded from comparison).

## Task Completion Reconciliation

**Finding**: `tasks.md` shows 41/45 implementation tasks checked (✓). The 4 unchecked items are in Phase 3:

- 3.1 Confirm backend PRs merged (external gate, n/a)
- 3.2 Obtain exported `schema.yml` (external gate, n/a)
- 3.3 Run `npm run generate-api` (external gate, n/a)
- 3.4 Confirm `CreateCompanyPage.tsx` breaks on compile (external gate, n/a)

**Reconciliation Basis** (Final-State Authority ranking):
1. Launch prompt explicit facts: "All six slices are merged into `main`. Delivered as PRs #14, #15, #16, #17, #18 (chained under tracker `feat/onboarding-wizard`) and #20."
2. Tasks artifact: Phases 1, 2, 4, 5, 6 all complete (41 checkmarks); Phase 3 is a gate/verification step, not implementation work.

**Resolution**: Phase 3 unchecked items are correctly recorded as external verification gates (not implementation tasks awaiting work). All actual implementation is complete. Archive proceeds with this reconciliation recorded.

## Final Delivery State

Per launch prompt final-state facts (ranking above intermediate `apply-progress`/`verify-report`):

- **Test suite**: 65 tests passing (up from 3 at change start)
- **Build**: `tsc -b` clean, `npm run build` succeeds
- **Lint**: `npm run lint` holds pre-existing baseline (14 problems: 8 errors, 6 warnings)
- **Implementation**: All six slices merged to `main` (PRs #14, #15, #16, #17, #18, #20; test-runner PR #13)
- **Functional state**: `/register` renders `OnboardingWizard`; `RegisterPage.tsx`, `CreateCompanyPage.tsx`, `SetupBranchPage.tsx` deleted; `/create-company` and `/setup-branch` redirect to `/register`
- **Blocking condition resolved**: Backend change 2 (`rack-backend` PRs #25, #35) is merged; schema.yml regenerated; deployment unblocked

## Key Decisions Carried Forward

These decisions are settled (per proposal D1–D5) and must not be reopened in future work:

1. **402 terminal state is neutral by availability, not by preference** — does not distinguish expired from revoked because DRF's `ErrorDetail` is a `str` subclass and `LicenseExpired`/`LicenseRevoked`'s `default_code` never reaches the wire. No backend `code` field exists yet; the upgrade path is open but intentionally taken after stable wire contract.

2. **No wizard persistence is a product decision** — a refresh restarts the wizard from step 1. Zero storage writes is tested as load-bearing precisely to prevent silent draft-saving being added later believing it an improvement.

3. **Owner fieldset lives in the employees step** — not a separate step, because the spec named four steps and no owner step while the payload requires an `owner` distinct from `employees`. This UX call is flagged; future sessions should know why it landed here.

4. **A raw `fetch` outside `src/client/` is now an ESLint error** — the one that existed (`RegisterPage.tsx:87`) survived months because it was the only call site regeneration couldn't catch. Verified gone by repo-wide scan.

5. **`ProtectedLayout`'s `pathname !== '/register'` guard is dead code** — retained deliberately and flagged for future cleanup, since `/register` now sits outside that layout.

## Known Gaps & Unowned Issues

Per proposal and backend spec (not oversights, intentional out-of-scope):

- Backend 402 `code` field: no PR, no owner. Without it, revoked and expired tenants remain indistinguishable. (Blocked by backend team; unshipped as of change delivery.)
- Freeing a RIF held by the wrong company: no owner, no remedy. Explicitly out of scope per proposal and backend spec's own "Known gap, unowned" note. (Blocked by team decision.)
- Verification gate precision: `rg "fetch\(" src --glob '!src/client/**'` command prescribed in spec matches `refetch()` from `useQuery`. The requirement genuinely holds (word-boundary variant returns zero, AST lint rule is silent) — but record that the instrument was flawed even though the outcome is correct.

## Engram Artifacts (Lineage)

All observations persisted and read for this archive:

| Artifact | Observation ID | Topic Key |
|----------|----------------|-----------|
| Proposal | #144 | `sdd/onboarding-wizard-frontend/proposal` |
| Spec | #146 | `sdd/onboarding-wizard-frontend/spec` |
| Design | #148 | `sdd/onboarding-wizard-frontend/design` |
| Tasks | #149 | `sdd/onboarding-wizard-frontend/tasks` |
| Archive Report | (this document) | `sdd/onboarding-wizard-frontend/archive-report` |

No verify-report was found in Engram or filesystem; intermediate `apply-progress` records exist but are superseded by launch prompt final-state facts (per Final-State Authority ranking).

## SDD Cycle Completion

This change has been fully planned (proposal), specified (spec), designed (design), tasked (tasks), implemented and verified (per final-state facts), and archived. All delta specs are now merged into `openspec/specs/` as the source of truth. The change folder is immutable in the archive for audit trail purposes.

**Ready for next change.**
