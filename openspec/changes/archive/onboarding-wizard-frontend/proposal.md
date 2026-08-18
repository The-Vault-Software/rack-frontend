# Proposal: Onboarding Wizard + 402 Licence Handling

## Intent

Backend change 2 (PRs #25, #35) replaces the three-call registration with one transactional `POST /v1/onboarding/` and turns `POST /v1/company/` into **410 Gone**. **Deploy constraint, hard: change 2 cannot deploy until this ships** — registration breaks the moment it does.

Separately, an inactive-licence 402 is reported as a wrong password. `src/App.tsx:45` gates the response interceptor on `response.status === 401` alone, so 402 falls through untouched to the hardcoded toast at `src/pages/auth/LoginPage.tsx:56` — `"Credenciales inválidas o error en el servidor."`. There is **no** redirect loop (`App.tsx:62` already guards it). The fault is misdirection: the tenant resets a password that was never wrong and the support ticket is filed under the wrong cause.

## Scope

### In Scope

1. **Four-step wizard** replacing `RegisterPage.tsx`: company (name, email, RIF, structured fiscal address — estado/ciudad/municipio/calle required, código postal optional) → branches (min 1, max 2) → employees (≥1, each bound to a branch **by payload index**) → review/submit. One call to `/v1/onboarding/`.
2. **Terminal licence-inactive state** on 402 from login, refresh, or any request, with a contact route (D1, D2). No retry, no bounce to `/login` — an inactive licence is terminal, not a token problem.
3. **Regenerate the client** (`npm run generate-api`). Local `schema.yml` is stale: no `/v1/onboarding/`, no fiscal address columns.
4. Remove the raw `fetch` at `RegisterPage.tsx:87`; stop sending `company_id`, `license_date`, `max_branches`; redirect `/create-company` and `/setup-branch` into the wizard (D4).

### Out of Scope

- Backend behaviour, except the `code` decision below.
- Admin/licence dashboard — already merged, parallel-owned.
- Freeing a RIF held by the wrong company — known gap, **no owner**.

## Capabilities

### New Capabilities

- `onboarding-wizard`: four-step registration submitted as one transactional call; index-referenced children; branch and employee minimums.
- `license-state-ux`: how the app detects, presents, and terminates on an inactive licence (402).

### Modified Capabilities

- None. The only existing spec is `customer-payment-refund-ux`, untouched.

## Decisions

These were put to the owner and settled. They are not defaults awaiting confirmation.

### D1 — The 402 does not distinguish expired from revoked (owner)

The 402 body today is exactly `{"detail":"Company license has expired."}`, probed live. `LicenseExpired.default_code = "license_expired"` and the parallel workstream's `LicenseRevoked` never reach the wire: DRF's `ErrorDetail` is a `str` subclass, so the code is lost in serialisation.

**Decided**: one neutral terminal state whose claim is true in both cases.

Both alternatives were considered and rejected:

- *String-matching `detail`* — couples the UI to copy that can change with **no compile error and no failing test**. Silent failure is the exact mode this change exists to remove.
- *Depending on a backend `code` field* — no PR exists in that repository.

The upgrade path to a machine-readable `code` stays open, and it is not taken now for **availability, not preference**. Whoever adds `code` upstream should expect this UI to want it.

### D2 — An inactive licence is terminal, with a contact route (owner)

**Decided**: a terminal screen plus a way to make contact. No read-only mode.

*Read-only access was rejected*: the backend gates at login, not per operation, so a read-only mode would require defining what "read" means endpoint by endpoint. That multiplies scope well past this change.

### D3 — Wizard progress does not persist (owner)

**Decided**: a page refresh restarts the wizard. Accepted friction for a one-time signup.

### D4 — `/create-company` and `/setup-branch` redirect into the wizard (orchestrator)

**Decided by the orchestrator, not the owner** — recorded here so its provenance is honest. Both routes die when `POST /v1/company/` returns 410, and `ProtectedLayout` still sends companyless users to `/create-company`.

### D5 — The optional second branch is offered during signup (owner)

**Decided**: minimum 1, maximum 2, both offered in the wizard.

## Approach

| Decision | Rationale |
|---|---|
| One wizard component tree, one submit | Mirrors the endpoint's all-or-nothing transaction; no partial tenant can exist |
| Index-based child references | The endpoint has no ids to reference before commit |
| Extend the interceptor's status gate, not its redirect | 402 is terminal; retry/redirect is the wrong response |
| Regenerate before writing UI | Types drive the form shape rather than the reverse |

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/pages/auth/RegisterPage.tsx` | Rewritten | Four steps; single generated-client call; raw `fetch` removed |
| `src/App.tsx` | Modified | Response interceptor handles 402 distinctly from 401 |
| `src/pages/auth/LoginPage.tsx` | Modified | Stop claiming bad credentials on non-401 failures |
| `src/pages/company/CreateCompanyPage.tsx` | Modified/Removed | `/v1/company/` POST is 410; will break at compile time on regeneration |
| `src/pages/auth/SetupBranchPage.tsx` | Modified | Branches now created by the wizard; route no longer part of signup |
| `src/router.tsx` | Modified | Licence-inactive route; signup path rewiring |
| `src/client/**` | Regenerated | `npm run generate-api` only — never hand-edited |
| `schema.yml` | Replaced | Pulled from the change-2 backend |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Backend PRs #25/#35 unmerged; schema unstable | High | Treat the schema as the contract; re-run `generate-api` before verify |
| Wrong copy for a revoked tenant | Low | Closed by D1 — the neutral wording is true in both cases |
| Wizard exceeds the 800-line review budget | Med | Flag for slicing at `sdd-tasks`; wizard steps split cleanly |
| Existing tenants with one branch hitting `max_branches` | Low | Server-assigned; the wizard only offers 1–2 |

## Why Behavioural Tests Are Load-Bearing Here

A generated client is a type safety net **only over the calls that use it**.

`RegisterPage.tsx:87` posts to `/v1/company/` through a hand-rolled `fetch` with a JSON body. It is the **only raw `fetch` in application code** — a repo-wide scan confirms the sole other matches live inside generated `src/client/`. Because no generated type touches that call, regenerating the client produces **no compile error there**. Contrast `CreateCompanyPage.tsx`, which uses `v1CompanyCreateMutation` and will break loudly and correctly.

The consequence is concrete, not theoretical: `npm run build` passing proves nothing about the one file this change most needs to be right. Behavioural tests over the wizard are therefore **load-bearing**, not good practice. This change removes that last raw `fetch`, and "no raw `fetch` outside `src/client/`" becomes a verify step so the gap cannot silently reopen.

Testing **is** available: vitest + jsdom + Testing Library are installed (PR #13) and this branch sits on top of it. `openspec/config.yaml` still records `strict_tdd: false`, `testing.runner: none` — **that is now stale and should be updated** as part of this change.

## Rollback

Frontend-only and revertible by branch: `git revert` the wizard commits and restore `schema.yml` from `origin/main`. **But rollback is only safe while change 2 is undeployed** — once `/v1/company/` returns 410, reverting this change leaves registration broken. After that point, roll the backend back first.

## Dependencies

- Backend PRs #25 and #35 merged in order `#35 → #25 → tracker → main`.
- A `schema.yml` exported from the change-2 backend.
- **Not** a dependency: the backend `code` field on the 402 body. D1 settled that this change ships without it.

## Success Criteria

- [ ] A new tenant completes company → branches → employees → review in one submit; a failure at any step leaves no partial tenant.
- [ ] An inactive-licence tenant sees a licence state, never "credenciales inválidas", on login and on refresh.
- [ ] No raw `fetch` remains outside `src/client/`.
- [ ] `npm run build`, `npm run lint`, `npm run test` pass on a freshly regenerated client.
- [ ] `openspec/config.yaml` reflects the installed vitest toolchain.
