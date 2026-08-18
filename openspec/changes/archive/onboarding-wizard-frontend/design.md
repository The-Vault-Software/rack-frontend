# Design: Onboarding Wizard + 402 Licence Handling

## Technical Approach

Three seams, each chosen so the critical path is reachable by a test rather than only by a human clicking.

1. **`src/lib/licenseGate.ts`** — an idempotent module latch plus an injectable redirector. The single place that knows an inactive licence is terminal.
2. **`src/lib/apiInterceptors.ts`** — the CSRF and response interceptors lifted out of `App.tsx` module scope so they can be registered against a fake `fetch` in a test. `App.tsx` keeps only the provider tree and a `registerInterceptors(client, queryClient)` call.
3. **`src/pages/onboarding/OnboardingWizard.tsx`** — one React Hook Form instance, four steps, one `v1OnboardingCreateMutation` submit.

## Verified Facts That Drive The Design

Read from `src/client/client/client.gen.ts`, not inherited from the proposal.

| Fact | Evidence | Consequence |
|---|---|---|
| Response interceptors run **before** `response.ok` and before `throwOnError` throws | lines 133-137 vs 144 and 236 | A 402 on `/v1/refresh/` latches in the interceptor first; the existing `catch` at `App.tsx:60` can then check the latch and skip `/login` |
| `throwOnError` throws the **parsed JSON body**, never a `Response` | lines 216-237 | `onError` handlers cannot see a status. Discrimination is impossible outside the interceptor |
| Every generated hook sets `throwOnError: true` | `@tanstack/react-query.gen.ts` (all options) | The above applies to every call site in the app |
| `opts.fetch` is configurable per client | lines 48, 97 | Interceptors are testable without `msw` (not installed) |

The proposal's phrase *"extend the interceptor's status gate"* is wrong: widening `status === 401 && ...` would route 402 into refresh-and-retry. 402 needs its own **early return** branch above the 401 branch.

## Architecture Decisions

### D-A — 402 is a separate early branch in the response interceptor

**Choice**: `if (response.status === 402) { enterLicenseInactive(queryClient); return response; }` placed above the 401 branch, with no `/v1/refresh/` exclusion. The 401 `catch` gains one guard: `if (isLicenseInactive()) return response;` before the `/login` redirect.
**Rejected**: reading status in `LoginPage.onError` (impossible — status is discarded); an `interceptors.error` handler (it does receive the `Response`, but would have to mutate the global error shape every page already parses).
**Rationale**: login runs with no session, so its 402 never reaches the 401 path; refresh's 402 does, but latches before the throw. One branch covers both because it sits on the raw `Response`.

### D-B — Terminal state: latch, cache clear, hard navigation to a public route

**Choice**: `enterLicenseInactive()` is idempotent, calls `queryClient.clear()`, then `window.location.replace('/licencia-inactiva')` through a swappable redirector. The route is **public** (outside `ProtectedLayout`), static, and renders correctly on a cold load.
**Cookies**: session cookies are HttpOnly and therefore unreachable from JS. No `/v1/logout/` call — on the login path there is no session to end, and on the refresh path that call would itself 402 and re-enter the gate. Cookie removal is not load-bearing: the server returns 402 for every subsequent request regardless.
**Cache**: `queryClient.clear()` drops all tenant data before navigating, so nothing survives in memory. Idempotence matters because N in-flight queries produce N 402s; only the first navigates.
**Copy**: neutral, true for expired *and* revoked. No string-match on `detail`, no dependency on a `code` field. `licenseGate.ts` is the single upgrade point if `code` ever ships.

### D-C — Wizard state: one form, `useFieldArray`, index-referenced children

One `useForm` with the merged schema; `step` in `useState`; `trigger([...stepFields])` gates advancing; `useFieldArray` for `branches` (min 1, max 2) and `employees` (min 1). No persistence (D3) — no `localStorage`, no draft schema.

Employee → branch binding is a `<select>` whose `value` is the **array position** in `branches`, written straight to `employees[i].branch_index`. Removing a branch re-indexes; the remove handler must clamp every `branch_index` that pointed at or past the removed position.

Exact request body (verified against `rack-backend` `OnboardingSerializer`):

```jsonc
{ "company":  { "name","email","rif","fiscal_state","fiscal_city",
                "fiscal_municipality","fiscal_street","fiscal_postal_code"? },
  "branches": [ { "name","address"?,"phone"?,"email"? } ],          // 1..2
  "owner":    { "email","password","first_name","last_name","username" },
  "employees":[ { ...owner fields, "branch_index": 0 } ] }          // >=1
```

**Error mapping is asymmetric and both shapes must be handled.** DRF field validation returns a *positional array*; the endpoint's own `validate()`/`create()` return an *object keyed by a stringified index*:

| Source | Body | Maps to |
|---|---|---|
| DRF `is_valid()` | `{"employees":[{}, {"email":["..."]}]}` | `employees.1.email`, step 3 |
| `validate()` | `{"employees":{"1":{"branch_index":"..."}}}` | `employees.1.branch_index`, step 3 |
| `create()` savepoint | `{"company":{"rif":"This rif is already in use."}}` | `company.rif`, step 1 |
| `validate()`/`create()` | `{"branches":"Duplicate branch name in this request."}` — a bare string | step-2 form-level error |

`mapOnboardingErrors(body)` normalises both, calls `setError()` per field, and returns the **lowest step** carrying an error so the wizard jumps there. It is a pure function and the highest-value unit test in this change.

### D-D — Remove the raw `fetch`

**Choice**: delete `RegisterPage.tsx:87`; the wizard submits through `v1OnboardingCreateMutation`. Add a lint rule forbidding `fetch(` outside `src/client/`.
**Rationale**: it is the only untyped call site, so regeneration and `tsc -b` prove nothing about it — the exact reason behavioural tests are load-bearing here. Its stated motivation ("bypass auth interceptors") dissolves: `/v1/onboarding/` is anonymous, and the interceptors are now the thing we *want* on that call so a 402 is handled uniformly. Keeping it would preserve the one blind spot this change exists to close.
`CreateCompanyPage.tsx` breaks at compile time on regeneration (correct); nothing else does.

### D-E — Delete both legacy pages, keep the paths as redirects

**Choice**: delete `src/pages/company/CreateCompanyPage.tsx` and `src/pages/auth/SetupBranchPage.tsx`. Keep `/create-company` and `/setup-branch` as `<Navigate to="/register" replace />` entries moved **outside** `ProtectedLayout`, and change `ProtectedLayout`'s companyless target from `/create-company` to `/register`.
**Rejected**: keeping the files as thin redirect components (dead code that still imports a 410'd mutation); deleting the routes outright (bookmarks 404).
**Rationale**: moving the redirects out of `ProtectedLayout` removes any interaction with its `hasCompany` effect, so no redirect loop is possible. Branch creation post-signup still exists via `v1BranchCreate`; only the signup-time page dies.

### D-F — RIF validation mirrors the server, with required-ness kept outside the validator

**Choice**: `src/lib/rif.ts` exports two separable functions, transcribed from `rack-backend/apps/organization/validators.py` (algorithm verified by execution, recorded at Engram `reference/rif-mod11-algorithm`):

- `normalizeRif(input: string): string | null` — trim, then upper-case. Empty or whitespace-only returns **`null`, never `""`**.
- `isValidRif(value: string | null): boolean` — `null` is **always valid**. Otherwise structure `^[VEJPG]-\d{8}-\d$` (the letter set is exactly `V E J P G`; `C` is rejected by decision, not oversight), then mod-11: `total = weight[letter] * 4 + Σ digit[i] * [3,2,7,6,5,4,3,2][i]`, `check = 11 - (total % 11)`, and **`check > 9 → 0`**.

**Required-ness lives in the wizard's Zod schema**, as a `.refine()` composed alongside the validator, never inside it. **Rationale**: `Company.rif` is `null=True, unique=True` on the backend and stays nullable so the migration never blocks a deploy; required-ness is enforced only at the onboarding endpoint. Folding it into the validator would make the two layers mean different things, and `""` — unlike `NULL` — can collide under a unique constraint. `buildOnboardingPayload` sends the normalised value so a lowercase `j-...` never diverges from the server's stored form.

**Fixtures on both sides**: `J-00123072-6` and `J-00002961-0`. The second is load-bearing — it is the only one that exercises the remainder-10-collapses-to-0 branch, and a validator that got that rule wrong passes every other case.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/lib/rif.ts` | Create | `normalizeRif` + `isValidRif`, mirroring the server algorithm |
| `src/lib/licenseGate.ts` | Create | Latch, `queryClient.clear()`, injectable redirector, `resetLicenseGate()` for tests |
| `src/lib/apiInterceptors.ts` | Create | `registerInterceptors(client, queryClient)`; 402 branch + latch guard in the 401 `catch` |
| `src/pages/onboarding/OnboardingWizard.tsx` | Create | Four steps, one submit |
| `src/pages/onboarding/steps/*.tsx` | Create | `CompanyStep`, `BranchesStep`, `EmployeesStep`, `ReviewStep` |
| `src/pages/onboarding/onboardingPayload.ts` | Create | Schemas, `buildOnboardingPayload`, `mapOnboardingErrors` |
| `src/pages/license/LicenseInactivePage.tsx` | Create | Neutral terminal screen + contact route |
| `src/App.tsx` | Modify | Interceptor bodies move out; call `registerInterceptors` |
| `src/router.tsx` | Modify | `/register` → wizard; `/licencia-inactiva` public; legacy paths → `Navigate` |
| `src/pages/auth/RegisterPage.tsx` | Delete | Replaced by the wizard; removes the last raw `fetch` |
| `src/pages/auth/LoginPage.tsx` | Modify | `onError` claims bad credentials only when the latch is unset |
| `src/pages/company/CreateCompanyPage.tsx` | Delete | `POST /v1/company/` is 410 |
| `src/pages/auth/SetupBranchPage.tsx` | Delete | Branches created by the wizard |
| `src/components/layouts/ProtectedLayout.tsx` | Modify | Companyless target → `/register` |
| `schema.yml`, `src/client/**` | Regenerate | `npm run generate-api` only |

## Testing Strategy

`strict_tdd: true` is already set in `openspec/config.yaml`; RED tests come first.

| Layer | What | How |
|---|---|---|
| Unit | `mapOnboardingErrors` — array shape, string-keyed shape, bare-string `branches`, returned step | Pure function, no render |
| Unit | `buildOnboardingPayload` — `branch_index` values; re-index after branch removal | Pure function |
| Unit | `licenseGate` — idempotence, cache cleared, redirector called once | Fake redirector + real `QueryClient` |
| Unit | `isValidRif` — `J-00123072-6` ✓, **`J-00002961-0` ✓ (remainder-10 branch)**, wrong check digit ✗, `C-`/short body/`X-` ✗, `null` ✓ | Pure function; shared fixtures with the backend |
| Unit | `normalizeRif` — trims, upper-cases, whitespace-only → `null` not `""` | Pure function |
| Integration | Interceptor: 402 latches and never calls refresh; 401 refreshes and retries; **refresh-402 goes to the licence path, not `/login`** | `registerInterceptors` on a fresh client + `client.setConfig({ fetch: fakeFetch })`; no server, no `msw` |
| Component | Step gating; 1-2 branch bounds; ≥1 employee; select bound by index | RTL + `user-event` |
| Component | Happy path fires **exactly one** call with the exact payload | Spy on the injected `fetch` |
| Component | A server error jumps to the right step and marks the right field | Fake `fetch` returning each error shape |
| Component | `LoginPage` shows no "credenciales inválidas" when the latch is set | RTL + latch |

`npm run build` is a necessary but insufficient gate; the interceptor and payload tests are the actual proof.

## Threat Matrix

N/A — browser SPA. No shell commands, subprocesses, VCS/PR automation, executable-file classification, or process integration. Client-side route redirects are not the routing boundary that matrix covers.

## Migration / Rollout

No data migration. Deploy order is fixed by change 2: this change must ship **before** `POST /v1/company/` starts returning 410. Rollback inverts after that point — roll the backend back first.

## Open Questions

- [ ] The generated symbol name for the onboarding mutation is assumed to be `v1OnboardingCreateMutation`; confirm after `npm run generate-api` against a change-2 `schema.yml`.
- [ ] Contact route content for the licence screen (email vs WhatsApp) is unspecified; a `mailto:` placeholder is the default unless the owner says otherwise.
