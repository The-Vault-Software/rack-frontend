# Tasks: Onboarding Wizard + 402 Licence Handling (change 3 of 3)

Source artifacts: `proposal.md`, `design.md`, `specs/{onboarding-wizard,license-state-ux}/spec.md`. Strict TDD is ACTIVE (`openspec/config.yaml` `apply.tdd: true`, `test_command: npm test`). Every implementation task below is a RED/GREEN pair unless marked `n/a` (no test-observable behavior, e.g. deletions or config).

Do NOT task `openspec/config.yaml` — it already reads `strict_tdd: true`, `runner: vitest`, `test_command: "npm test"`. Requirement 11 of `onboarding-wizard` ("Toolchain Config Reflects Installed Test Runner") is already satisfied; it is listed below only as a closed item, not a task.

No backend changes. The 402 `code` field has no PR — D1's neutral terminal state stands. RIF held by the wrong company has no owner and no remedy in this change.

---

## Review Workload Forecast

| Metric | Value |
|---|---|
| Estimated authored changed lines (additions+deletions), excluding regenerated `src/client/**` | **~2,800** |
| Regenerated `src/client/**` + `schema.yml` (excluded from authored count) | Unknown exact size — depends on unmerged backend PRs #25/#35. Rough estimate: 500–2,000+ generated lines (new onboarding types/zod schemas/query hooks, plus removal of `v1CompanyCreateMutation` typings). Not authored-risk, but included in snapshot identity. |
| Session review budget (explicit override) | **800** lines |
| Shared-protocol default budget | 400 lines |

`Decision needed before apply: Yes`
`Chained PRs recommended: Yes`
`400-line budget risk: High`
`800-line budget risk: High` (session's explicit override budget is 800; ~2,800 authored lines is **3.5×** over it)

The estimate is honest, not padded: it comes from actually reading `RegisterPage.tsx` (382 lines, deleted), `CreateCompanyPage.tsx` (102, deleted), `SetupBranchPage.tsx` (146, deleted), `App.tsx` (87, ~40 lines change), `LoginPage.tsx` (137, ~15 lines change), `router.tsx` (123, ~45 lines change across two slices), `ProtectedLayout.tsx` (47, ~8 lines change) — plus line-count estimates for ~20 new source+test files sized against the design's own file list and testing strategy. No single slice below exceeds 800; each is independently reviewable and independently mergeable per the chained-pr skill's ≤60-minute guidance.

### Recommended slicing — Feature Branch Chain

This change already sits in a chain: `feat/onboarding-wizard` → `build/vitest-setup` (PR #13, open) → `origin/main`. Treat `feat/onboarding-wizard` as the tracker for this change's own children.

| Slice | Content | Est. authored lines | Depends on | Spec requirements covered |
|---|---|---|---|---|
| **PR 1** | License-state-ux: interceptor extraction, licence gate, 402 branch, terminal page, `LoginPage` fix | ~640 | none (independent of wizard and of regen) | `license-state-ux` #1–7 |
| **PR 2** | Onboarding domain logic: RIF validator, error mapper, payload builder | ~520 | none (pure functions; file-disjoint from PR 1) | `onboarding-wizard` #3, #5 (partial), #6 (partial) |
| **PR 3** | API regeneration gate | n/a authored; generated diff excluded | **External: backend PRs #25 and #35 merged**, `#35 → #25 → tracker → main` order, plus an exported `schema.yml` | none directly; unblocks PR 4–6 |
| **PR 4** | Wizard steps 1–2: `CompanyStep`, `BranchesStep` | ~340 | PR 3 (design's explicit "regenerate before writing UI"); PR 2 (RIF validator) | `onboarding-wizard` #2, #3, #4 |
| **PR 5** | Wizard steps 3–4 + shell + submission: `EmployeesStep`, `ReviewStep`, `OnboardingWizard.tsx` | ~630 | PR 3, PR 4, PR 2 | `onboarding-wizard` #1, #5, #6, #7, #8 |
| **PR 6** | Legacy cleanup: delete `RegisterPage`/`CreateCompanyPage`/`SetupBranchPage`, router rewiring, `ProtectedLayout` retarget, raw-`fetch` lint rule, full verification | ~665 | PR 5 (wizard must exist at `/register`), PR 3 (compile break is expected only after regen) | `onboarding-wizard` #9, #10 |

Dependency diagram (planning-time; `sdd-apply` marks the current slice with 📍 as it proceeds):

```
tracker: feat/onboarding-wizard (on build/vitest-setup PR #13, on origin/main)
  ├── PR 1 (license-state-ux)         ─┐  file-disjoint, either order
  ├── PR 2 (domain logic)             ─┘
  ├── PR 3 (api regen)  ── BLOCKED on backend #25/#35
  │     └── PR 4 (wizard steps 1-2)
  │           └── PR 5 (wizard steps 3-4 + shell)
  │                 └── PR 6 (legacy cleanup + final verification)
```

**What can proceed before backend PRs #25/#35 merge**: PR 1 and PR 2 in full — neither touches `src/client/**`, the onboarding endpoint, or any generated type.
**What genuinely cannot**: PR 4, 5, 6. The wizard's field shapes, the exact request body typing, and the generated mutation hook's name (assumed `v1OnboardingCreateMutation`, unconfirmed) all come from `schema.yml` regeneration. Writing the wizard against hand-typed guesses would produce work that gets thrown away the moment the real schema lands — the design's own approach table calls this out explicitly ("Regenerate before writing UI: types drive the form shape rather than the reverse").

---

## Phase 1 — License-State-UX (PR Slice 1, ~640 lines, independent)

### 1.1 Extract response/CSRF interceptors out of `App.tsx` module scope
Prerequisite for everything else in this phase — interceptors currently run at module import, so importing `App.tsx` in a test mutates a global singleton.

- [x] 1.1.1 RED — write `src/lib/apiInterceptors.test.ts`: a regression test asserting the **current** 401 contract (refresh + retry on success; redirect to `/login` on refresh failure, except when already on `/login`/`/register`) against `registerInterceptors(client, queryClient)`, which does not exist yet. (Req: `license-state-ux` #3)
- [x] 1.1.2 GREEN — create `src/lib/apiInterceptors.ts` exporting `registerInterceptors(client, queryClient)`; move the CSRF request interceptor and the 401 response interceptor body out of `App.tsx` verbatim (no behavior change). Update `App.tsx` to call `registerInterceptors(client, queryClient)` once, keeping only the provider tree.

### 1.2 License gate module
- [x] 1.2.1 RED — write `src/lib/licenseGate.test.ts`: idempotence (second call is a no-op), `queryClient.clear()` called, injected redirector called exactly once even under N concurrent calls, `resetLicenseGate()` resets state for test isolation. (Req: `license-state-ux` #4, #5)
- [x] 1.2.2 GREEN — create `src/lib/licenseGate.ts`: `enterLicenseInactive(queryClient)`, `isLicenseInactive()`, swappable redirector (defaults to `window.location.replace('/licencia-inactiva')`), `resetLicenseGate()`.

### 1.3 402 branch in the response interceptor + 401 guard
This is the load-bearing seam. Do NOT widen the existing `status === 401` gate — 402 gets its own early-return branch ABOVE it. Pin the interceptor ordering (response interceptors run before `response.ok` and before `throwOnError`'s throw) with a test, not a comment, since that ordering is what makes this work at all.

- [x] 1.3.1 RED — extend `apiInterceptors.test.ts`: (a) a 402 on any request latches via `licenseGate` and never calls `v1RefreshCreate`; (b) a 402 received *during* the refresh call itself routes to the licence path and does **not** set `window.location.href` to `/login` and does **not** retry the original request; (c) the existing 401 regression test from 1.1.1 stays green unmodified. (Req: `license-state-ux` #2, #3, #7)
- [x] 1.3.2 GREEN — in `apiInterceptors.ts`, add `if (response.status === 402) { enterLicenseInactive(queryClient); return response; }` above the 401 branch (no `/v1/refresh/` exclusion); add `if (isLicenseInactive()) return response;` as the first line inside the 401 `catch`, before the `/login` redirect.

### 1.4 Terminal licence-inactive page + route
- [x] 1.4.1 RED — write `src/pages/license/LicenseInactivePage.test.tsx`: renders identical neutral copy for two distinct mocked 402 `detail` bodies (one "expired"-flavored, one "revoked"-flavored) fed through the same rendering path — asserting no `detail.includes(...)` branching exists in behavior, not just in source; asserts no navigation affordance to any authenticated route; asserts a contact affordance (e.g. `mailto:`) is present and reachable without auth. (Req: `license-state-ux` #4, #5, #6)
- [x] 1.4.2 GREEN — create `src/pages/license/LicenseInactivePage.tsx` with static neutral copy ("tu licencia no está activa" or equivalent — true for both expired and revoked) and a `mailto:` contact link (placeholder per design's open question; owner has not specified email vs WhatsApp). Add `/licencia-inactiva` as a **public** route in `router.tsx`, outside `ProtectedLayout`.

### 1.5 `LoginPage` stops claiming bad credentials on a 402
`onError` cannot see the HTTP status — `throwOnError: true` on every generated hook throws the parsed body, never a `Response`. Discrimination happened upstream in the interceptor (1.3); `LoginPage` only needs to read the latch.

- [x] 1.5.1 RED — write/extend `src/pages/auth/LoginPage.test.tsx`: given the login mutation rejects while `isLicenseInactive()` is true (set via the fake redirector in a test), the credentials-error toast text ("Credenciales inválidas...") MUST NOT appear; given a 401-shaped rejection with the latch unset, the existing credentials toast MUST still appear (regression). (Req: `license-state-ux` #1, #3)
- [x] 1.5.2 GREEN — in `LoginPage.tsx`'s `onError`, guard the existing toast with `if (!isLicenseInactive()) { toast.error(...) }`.

### 1.6 Slice verification
- [x] 1.6.1 `npm test` green for all Phase 1 files; `npm run lint`; `tsc -b` clean for touched files. n/a (verification, no new behavior)

---

## Phase 2 — Onboarding Domain Logic (PR Slice 2, ~520 lines, parallel-safe with Phase 1)

### 2.1 RIF validator
Fixtures are fixed, not invented: `J-00123072-6` and `J-00002961-0` (the second is the only one exercising the remainder-10-collapses-to-0 branch; per Engram `reference/rif-mod11-algorithm`, do not re-derive the algorithm from scratch).

- [x] 2.1.1 RED — write `src/lib/rif.test.ts`: `isValidRif` — `J-00123072-6` ✓, `J-00002961-0` ✓ (remainder-10 branch), wrong check digit ✗, `C-00123072-6` ✗ (rejected regardless of check digit), `J-0012307-6` (short body) ✗, `X-00002961-0` ✗, `null` ✓ (always valid — required-ness lives outside the validator). `normalizeRif` — trims, upper-cases, whitespace-only input → `null` (never `""`). (Req: `onboarding-wizard` #3)
- [x] 2.1.2 GREEN — create `src/lib/rif.ts` exporting `normalizeRif` and `isValidRif`, transcribing the algorithm exactly: letter weights `{V:1,E:2,J:3,P:4,G:5}` × 4, digit weights `[3,2,7,6,5,4,3,2]`, `check = 11 - (total % 11)`, `check > 9 → 0`. No required-ness logic here — that belongs in the wizard's Zod `.refine()` (Phase 4).

### 2.2 Error mapper + payload builder
The error-shape asymmetry is the likeliest silent bug in this change: DRF's own field validation returns a positional array; the endpoint's `validate()`/`create()` return an object keyed by a **stringified index**; `branches` duplicate-name errors come back as a bare string, not a list. All three shapes must be tested explicitly — a mapper that handles one shape passes half the cases.

- [x] 2.2.1 RED — write `src/pages/onboarding/onboardingPayload.test.ts` for `mapOnboardingErrors(body)`: (a) DRF positional-array shape `{"employees":[{}, {"email":["..."]}]}` → maps to `employees.1.email`, step 3; (b) stringified-index object shape `{"employees":{"1":{"branch_index":"..."}}}` → maps to `employees.1.branch_index`, step 3; (c) keyed-object shape `{"company":{"rif":"This rif is already in use."}}` → maps to `company.rif`, step 1; (d) bare-string shape `{"branches":"Duplicate branch name in this request."}` → step-2 form-level error, not a per-field error; (e) mixed body with errors on multiple steps → returns the **lowest** step. (Req: `onboarding-wizard` #6)
- [x] 2.2.2 GREEN — implement `mapOnboardingErrors(body)` in `src/pages/onboarding/onboardingPayload.ts` as a pure function handling all four shapes and returning `{ setErrors: (setError) => void, lowestStep: number }` or equivalent.
- [x] 2.2.3 RED — extend the same test file for `buildOnboardingPayload`: employee `branch_index` values reflect array position at build time; removing a branch re-indexes every `employees[i].branch_index` that pointed at or past the removed position (clamped, not left dangling). (Req: `onboarding-wizard` #5)
- [x] 2.2.4 GREEN — implement `buildOnboardingPayload(formValues)` producing the exact verified request shape: `{ company: {...}, branches: [...1..2], owner: {...}, employees: [...>=1, branch_index] }`. Type against hand-written interfaces matching the design's verified payload shape for now; reconcile against generated types in Phase 4 after regeneration.

### 2.3 Slice verification
- [x] 2.3.1 `npm test` green for all Phase 2 files; `npm run lint`; `tsc -b` clean for touched files. n/a (verification, no new behavior)

---

## Phase 3 — API Regeneration Gate (PR Slice 3, generated diff excluded from budget)

**BLOCKED externally.** Do not start this phase's regeneration step until its precondition is met; PR 1 and PR 2 do not need it.

- [ ] 3.1 Confirm backend PRs `rack-backend#25` and `rack-backend#35` are merged, in order `#35 → #25 → tracker → main`. n/a (external verification, no local file change)
- [ ] 3.2 Obtain a `schema.yml` exported from the merged change-2 backend and replace the local stale copy (no `/v1/onboarding/` path today). n/a
- [ ] 3.3 Run `npm run generate-api`; confirm the generated onboarding mutation hook's actual name — the design's `v1OnboardingCreateMutation` is an **assumption**, not a verified fact, until this step runs. Record the actual name for Phase 4/5. n/a
- [ ] 3.4 Confirm `CreateCompanyPage.tsx` now fails to compile (its `v1CompanyCreateMutation` import breaks because `/v1/company/` is 410). This is **expected and correct** — do not fix it here; Phase 6 deletes the file. n/a
- [x] 3.5 Reconcile Phase 2's hand-typed `buildOnboardingPayload`/`mapOnboardingErrors` interfaces against the newly generated types; adjust only if the verified payload shape in `design.md` diverges from what actually generated. (Req: `onboarding-wizard` #5, #6) — done in Phase 4: `V1OnboardingCreateData.body` generates as `never` (schema.yml's `/v1/onboarding/` POST has no `requestBody` section at all). Nothing generated to reconcile the hand-written interfaces against; they are kept as-is (see comment added to `onboardingPayload.ts`). Flagged as a Phase 5 risk: the generated mutation call will fail type-checking on a real `body` until the backend's OpenAPI schema documents a request body for this operation.

---

## Phase 4 — Wizard Steps 1–2 (PR Slice 4, ~340 lines, depends on Phase 3)

### 4.1 `CompanyStep`
- [x] 4.1.1 RED — write `src/pages/onboarding/steps/CompanyStep.test.tsx`: required fields (name, email, RIF, estado, ciudad, municipio, calle) block advancement when empty; optional código postal does not block advancement; a RIF with correct structure and mod-11 check digit passes (reuses Phase 2 fixtures); a wrong check digit or `C-` prefix blocks advancement with a field-level error. (Req: `onboarding-wizard` #2, #3)
- [x] 4.1.2 GREEN — create `src/pages/onboarding/steps/CompanyStep.tsx` using the Zod schema with `isValidRif`/`normalizeRif` from Phase 2 composed via `.refine()`, plus a required-ness refine local to this step (per design D-F, required-ness stays out of the validator itself).

### 4.2 `BranchesStep`
- [x] 4.2.1 RED — write `src/pages/onboarding/steps/BranchesStep.test.tsx`: 0 branches blocks advancement; the "add branch" control is unavailable/disabled at 2 branches; exactly 1 valid branch (second omitted) advances. (Req: `onboarding-wizard` #4)
- [x] 4.2.2 GREEN — create `src/pages/onboarding/steps/BranchesStep.tsx` using `useFieldArray` bounded to min 1 / max 2.

### 4.3 Slice verification
- [x] 4.3.1 `npm test` green for Phase 4 files; `npm run lint`; `tsc -b` clean. n/a

---

## Phase 5 — Wizard Steps 3–4 + Shell + Submission (PR Slice 5, ~630 lines, depends on Phase 3, 4, 2)

### 5.1 `EmployeesStep`
- [x] 5.1.1 RED — write `src/pages/onboarding/steps/EmployeesStep.test.tsx`: 0 employees blocks advancement; seeding a 1-branch wizard state and binding an employee to index `1` is rejected client-side with **no network request fired**; 2-branch state with employees at index `0`/`1` advances. The branch `<select>`'s value is the array position, not a persisted id. (Req: `onboarding-wizard` #5)
- [x] 5.1.2 GREEN — create `src/pages/onboarding/steps/EmployeesStep.tsx` using `useFieldArray`, binding `employees[i].branch_index` to the branch `<select>`'s array position, validating the index is within `[0, branches.length)` before allowing advancement. Also collects the account owner's credentials (a section not named in the spec's four steps — see apply-phase deviation note) since `buildOnboardingPayload`'s `owner` field needs a UI source and no dedicated owner step exists.

### 5.2 `ReviewStep`
- [x] 5.2.1 RED — write `src/pages/onboarding/steps/ReviewStep.test.tsx`: rendered text matches every required field entered in steps 1–3 (company, each branch, each employee) with no silent transformation or field drop. (Req: `onboarding-wizard` #7)
- [x] 5.2.2 GREEN — create `src/pages/onboarding/steps/ReviewStep.tsx`, read-only rendering of the current form state.

### 5.3 `OnboardingWizard` shell + single transactional submission
- [x] 5.3.1 RED — write `src/pages/onboarding/OnboardingWizard.test.tsx`: (a) fresh visit renders step 1 only, steps 2–4 unreachable; (b) invalid step 1 blocks forward navigation and surfaces the field error; (c) backward navigation preserves already-entered in-memory data; (d) happy path fires **exactly one** `POST /v1/onboarding/` call (spy on the injected `fetch`, per design's `client.setConfig({ fetch })` — no `msw`, it is not installed) with the exact payload from `buildOnboardingPayload`, and no request fires on steps 1–3; (e) a rejected submission keeps the wizard on the offending step (via `mapOnboardingErrors`'s returned lowest step) with all entered values still populated, no "partial success" messaging; (f) no `localStorage`/`sessionStorage` write occurs at any step transition (spy on storage APIs) and a simulated refresh restarts at step 1. (Req: `onboarding-wizard` #1, #5 (submit-time reject), #6, #8)
- [x] 5.3.2 GREEN — create `src/pages/onboarding/OnboardingWizard.tsx`. DEVIATION from design.md D-C (flagged, not silent): kept Phase 4's accumulate-per-step pattern (shell `useState` holds each step's submitted values, passed back as `defaultValues` on backward nav) instead of one merged `useForm` + `trigger([...stepFields])`, so `CompanyStep`/`BranchesStep` and their existing tests stay untouched. Submits via `v1OnboardingCreateMutation()`; `V1OnboardingCreateData.body` now types as `OnboardingRequestWritable` (rack-backend#38 landed) — a narrow cast remains only for `company.rif`'s `string | null` vs the generated type's non-nullable `string`, since `CompanyStep`'s own schema already guarantees non-null by the time this runs.

### 5.4 Slice verification
- [x] 5.4.1 `npm test` green for Phase 5 files (61/61 full suite, stable across repeated runs); `npm run lint` (14 problems, 8 errors/6 warnings, byte-identical to baseline); `tsc -b` clean.

---

## Phase 6 — Legacy Cleanup, Routing, Final Verification (PR Slice 6, ~665 lines, depends on Phase 5, 3)

### 6.1 Remove `RegisterPage.tsx` and mount the wizard at `/register`
This deletes the last raw `fetch` in application code (`RegisterPage.tsx:87`) — the one call site a compile-time `tsc -b` pass after regeneration cannot catch, since no generated type touches it today.

- [ ] 6.1.1 Delete `src/pages/auth/RegisterPage.tsx`. n/a (Req: `onboarding-wizard` #9)
- [ ] 6.1.2 Update `router.tsx`: `/register` renders `OnboardingWizard`. n/a (Req: `onboarding-wizard` #1)

### 6.2 Delete legacy signup pages, redirect legacy routes, retarget `ProtectedLayout`
- [ ] 6.2.1 RED — write a routing test (React Router test utilities) asserting `/create-company` and `/setup-branch` navigate to `/register` unconditionally (not gated on a 410 response). (Req: `onboarding-wizard` #10)
- [ ] 6.2.2 GREEN — delete `src/pages/company/CreateCompanyPage.tsx` and `src/pages/auth/SetupBranchPage.tsx`; add `/create-company` and `/setup-branch` as `<Navigate to="/register" replace />` entries in `router.tsx`, positioned **outside** `ProtectedLayout`; change `ProtectedLayout.tsx`'s companyless redirect target from `/create-company` to `/register`.

### 6.3 Forbid raw `fetch` outside `src/client/`
- [ ] 6.3.1 Add an ESLint rule to `eslint.config.js` (e.g. `no-restricted-syntax` on `CallExpression[callee.name='fetch']`, scoped to exclude `src/client/**`) so a future raw `fetch` fails lint, not just review. n/a (Req: `onboarding-wizard` #9)

### 6.4 Final change-wide verification
- [ ] 6.4.1 `npm test` — full suite green, including Phases 1–5's tests still passing after the router/page changes in this phase.
- [ ] 6.4.2 `npm run build` (`tsc -b && vite build`) — necessary but explicitly insufficient per the proposal's own argument; it does not substitute for 6.4.1.
- [ ] 6.4.3 `npm run lint`.
- [ ] 6.4.4 Static repo scan: `rg "fetch\(" src --glob '!src/client/**'` returns zero matches (mirrors proposal Success Criterion "No raw `fetch` remains outside `src/client/`"). This is the requirement-9 gate `npm run build` cannot provide.
- [ ] 6.4.5 Confirm the request body sent by the wizard never includes `company_id`, `license_date`, or `max_branches` (server-assigned, no longer accepted client input).

n/a for 6.4.* (verification only, no new authored behavior).

---

## Requirement Coverage Cross-Check

| Spec requirement | Task(s) |
|---|---|
| `onboarding-wizard` #1 Four-Step Wizard | 5.3, 6.1.2 |
| `onboarding-wizard` #2 Company Step Fields | 4.1 |
| `onboarding-wizard` #3 RIF Validation | 2.1, 4.1 |
| `onboarding-wizard` #4 Branch Bounds | 4.2 |
| `onboarding-wizard` #5 Employee/Branch Index Binding | 2.2.3–2.2.4, 5.1, 5.3.1(d) |
| `onboarding-wizard` #6 Single Transactional Submission | 2.2.1–2.2.2, 5.3 |
| `onboarding-wizard` #7 Review Step | 5.2 |
| `onboarding-wizard` #8 No Client-Side Persistence | 5.3.1(f) |
| `onboarding-wizard` #9 No Raw `fetch` | 6.1.1, 6.3, 6.4.4 |
| `onboarding-wizard` #10 Legacy Routes Redirect | 6.2 |
| `onboarding-wizard` #11 Toolchain Config | already satisfied — no task |
| `license-state-ux` #1 402 Distinct on Login | 1.5 |
| `license-state-ux` #2 402 on Refresh → Terminal | 1.3 |
| `license-state-ux` #3 401 Unchanged (Regression) | 1.1.1, 1.3.1(c), 1.5.1 |
| `license-state-ux` #4 Neutral Terminal Copy | 1.2, 1.4 |
| `license-state-ux` #5 No App Access | 1.2, 1.4 |
| `license-state-ux` #6 Contact Route | 1.4 |
| `license-state-ux` #7 402 on Any Request | 1.3 |
