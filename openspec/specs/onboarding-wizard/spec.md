# Delta Spec: onboarding-wizard (NEW capability)

Change: `onboarding-wizard-frontend` (change 3 of 3). Replaces `RegisterPage.tsx`'s three-call, non-transactional registration flow with a single four-step wizard that submits ONE `POST /v1/onboarding/`, mirroring the backend's atomic all-or-nothing endpoint (`sdd/company-fiscal-onboarding/spec`, domain `company-onboarding`, `rack-backend`).

Testing: vitest + jsdom + Testing Library are installed and available on this branch (PR #13). `openspec/config.yaml`'s `strict_tdd: false` / `testing.runner: none` is stale for this change — see the ADDED requirement "Toolchain Config Reflects Installed Test Runner" below.

## ADDED Requirements

### Requirement: Four-Step Wizard Replaces Three-Call Registration
The system MUST present registration as one wizard component with exactly four ordered steps — company, branches, employees, review/submit — replacing `RegisterPage.tsx`'s current two-step (company, user) flow. The user MUST be able to move forward only after the current step's fields validate, and MUST be able to move backward without losing already-entered data for the current session.

- Scenario: Fresh visit to `/register`. **Given** a user with no prior wizard state, **when** they load `/register`, **then** the wizard renders step 1 (company) and steps 2–4 are not yet reachable.
- Scenario: Forward navigation blocked by invalid step. **Given** the user is on step 1 with an invalid or empty required field, **when** they attempt to advance, **then** the wizard MUST NOT advance and MUST surface the field-level validation error.
- Scenario: Backward navigation preserves in-memory data. **Given** the user completed step 1 and is on step 2, **when** they navigate back to step 1, **then** their previously entered step-1 values MUST still be populated.
- Test note: component test (Testing Library) driving the wizard through all four steps by role/label queries; assert step indicator and rendered fields per step.

### Requirement: Company Step Fields and Structured Fiscal Address
Step 1 (company) MUST collect: company name, company email, RIF, and a structured fiscal address with four REQUIRED fields (estado, ciudad, municipio, calle) and one OPTIONAL field (código postal). The step MUST NOT advance while any required field is empty or fails its format validation.

- Scenario: Missing required fiscal address field rejected. **Given** estado, ciudad, or municipio, or calle is empty, **when** the user attempts to advance, **then** the step MUST reject advancement with a field-level error and MUST NOT submit anything.
- Scenario: Omitted código postal accepted. **Given** every required company-step field is valid and código postal is left empty, **when** the user advances, **then** the step MUST allow advancement.
- Test note: component test asserting per-field validation messages and that omitting only código postal does not block advancement.

### Requirement: RIF Format and Check-Digit Validation Mirrors the Server Rule
The system MUST validate the RIF client-side against the same rule the backend enforces (`company-fiscal-identity` domain, `rack-backend`): pattern `^[VEJPG]-\d{8}-\d$` (letter set exactly V, E, J, P, G) AND the SENIAT mod-11 check digit. The client validator MUST NOT diverge from the backend's algorithm or accept a superset/subset of valid RIFs. `C-` and any letter outside V, E, J, P, G MUST be rejected regardless of check digit.

- Scenario: Valid RIF accepted. **Given** a RIF with a correct letter, digit pattern, and correct mod-11 check digit, **when** the user submits step 1, **then** the RIF field validates and the step advances.
- Scenario: Wrong check digit rejected. **Given** a RIF matching `^[VEJPG]-\d{8}-\d$` with an incorrect final check digit, **when** the user submits step 1, **then** the RIF field MUST show a validation error and the step MUST NOT advance.
- Scenario: `C-` prefix rejected. **Given** a RIF beginning with `C-` (or any letter outside V, E, J, P, G), **when** the user submits step 1, **then** the RIF field MUST show a validation error regardless of the digits or check digit that follow.
- Test note: unit tests against the RIF validator function with fixed fixture RIFs (one valid, one wrong-check-digit, one `C-` prefixed) — not full-form tests, so the algorithm's correctness is independently verifiable.
- Dependency note: the exact mod-11 weight/algorithm parameters are not present in this change's own sources (proposal, business-rules memory, or `schema.yml`, which is stale and lacks `/v1/onboarding/`). The design/apply phase MUST source the literal algorithm from the backend implementation (PR #35, `company-fiscal-identity` domain) before writing the validator, and test fixtures MUST be RIFs known-valid/known-invalid under that exact backend algorithm, not an independently invented one.

### Requirement: Branch Count Bounds — Minimum 1, Maximum 2
Step 2 (branches) MUST require at least 1 branch and MUST NOT permit more than 2. The second branch MUST be presented as optional, not mandatory.

- Scenario: Zero branches rejected. **Given** the user has removed all branches, **when** they attempt to advance from step 2, **then** the step MUST reject advancement with a "at least one branch required" error.
- Scenario: Third branch rejected. **Given** the user already has 2 branches entered, **when** they attempt to add a third, **then** the UI MUST NOT allow adding a third branch (control disabled or absent).
- Scenario: One branch, no second offered but accepted. **Given** the user has entered exactly 1 valid branch and does not add a second, **when** they advance, **then** the step MUST allow advancement.
- Test note: component test asserting the "add branch" control is unavailable at 2 branches, and that advancement is blocked at 0 branches.

### Requirement: Employee Requirement and Branch Index Binding
Step 3 (employees) MUST require at least 1 employee. Each employee MUST be bound to one of the branches entered in step 2 by that branch's POSITION (index) within the same submission's branches array — never by a persisted id, since no ids exist before the transactional submit.

- Scenario: Zero employees rejected. **Given** the user has removed all employees, **when** they attempt to advance from step 3, **then** the step MUST reject advancement with an "at least one employee required" error.
- Scenario: Employee referencing a non-existent branch index rejected. **Given** step 2 has 1 branch (valid index range `[0]`) and an employee entry is bound to index `1`, **when** the user attempts to advance or submit, **then** the wizard MUST reject the entry client-side before any network request is made.
- Scenario: Valid index binding accepted. **Given** step 2 has 2 branches and every employee entry references index `0` or `1`, **when** the user advances, **then** the step MUST allow advancement.
- Test note: component test seeding a 1-branch wizard state, attempting to bind an employee to index 1, and asserting both the validation error and that no submission request fires.

### Requirement: Single Transactional Submission
The wizard MUST submit the entire company + branches + employees payload as exactly ONE `POST /v1/onboarding/` request via the generated API client, on the review/submit step only. No earlier step MUST perform any network write. On success, the wizard MUST navigate the user out of the registration flow. On failure, the wizard MUST NOT have created anything partial, MUST surface the server's error, and MUST let the user correct and resubmit without losing their entered wizard data.

- Scenario: One request per submission attempt. **Given** the user completes all four steps, **when** they submit on the review step, **then** exactly one `POST /v1/onboarding/` request MUST be observed and no request MUST have been made on steps 1–3.
- Scenario: Failure leaves wizard state intact for correction. **Given** the single request fails (e.g., duplicate RIF, validation error), **when** the failure response is received, **then** the wizard MUST remain on the review step (or return to the offending step) with all previously entered values still populated, and MUST allow the user to edit and resubmit.
- Scenario: No partial creation on failure. **Given** the request fails, **then** the wizard MUST NOT display or assume that any company, branch, or employee was created — the failure is atomic per the backend's own transactional guarantee, and the client MUST NOT contradict it (no "some records were saved" messaging).
- Test note: component/integration test mocking the generated onboarding mutation to reject, asserting exactly one call was made, and asserting wizard fields remain populated post-failure.

### Requirement: Review Step Shows Entered Data Before Submit
Step 4 (review) MUST display the company, branches, and employees exactly as entered in the prior steps before the user confirms submission. It MUST NOT silently transform or drop any previously entered field.

- Scenario: Review reflects prior steps. **Given** the user completed steps 1–3 with specific values, **when** they reach step 4, **then** every required field entered (company, each branch, each employee) MUST be visible in the review.
- Test note: component test asserting review-step rendered text matches the values typed into earlier steps.

### Requirement: No Client-Side Wizard Persistence
The wizard MUST NOT persist its in-progress state to `localStorage`, `sessionStorage`, or any other durable client storage. A page refresh MUST restart the wizard at step 1 with no data retained.

- Scenario: Refresh restarts the wizard. **Given** the user has entered data through step 3, **when** the page is refreshed, **then** the wizard MUST render step 1 with empty fields — no prior entry MUST be recoverable.
- Test note: component test asserting no `localStorage`/`sessionStorage` write occurs at any step transition (spy on storage APIs).

### Requirement: No Raw `fetch` Outside the Generated Client
The wizard's company/branches/employees submission MUST use the generated API client (`src/client/`) exclusively. The raw hand-rolled `fetch` currently at `RegisterPage.tsx:87` (posting to `/v1/company/` with `company_id`, `license_date`, `max_branches` in the body) MUST be removed. No new raw `fetch` call MUST be introduced anywhere in application code.

- Scenario: Raw fetch removed. **Given** the completed wizard implementation, **when** the codebase is scanned for `fetch(` outside `src/client/`, **then** zero matches MUST be found (mirrors the proposal's Success Criterion: "No raw `fetch` remains outside `src/client/`").
- Scenario: Stale fields no longer sent. **Given** the wizard submits, **then** the request body MUST NOT include `company_id`, `license_date`, or `max_branches` — these are server-assigned per the backend's `company-licensing` domain and are no longer accepted client input.
- Test note: this requirement is verifiable by static repo scan (`rg "fetch\(" src --glob '!src/client/**'`) as a verify-phase gate, in addition to the request-shape assertion in the transactional-submission test above. `npm run build` passing does NOT prove this requirement — the removed call was the one raw `fetch` a compile-time regeneration could not catch (see proposal, "Why Behavioural Tests Are Load-Bearing Here").

### Requirement: Legacy Signup Routes Redirect Into the Wizard
`/create-company` and `/setup-branch` MUST redirect into the wizard (`/register`, or wherever the wizard is mounted). Both routes' current mutations (`v1CompanyCreateMutation` via `POST /v1/company/`, and the branch-creation call in `SetupBranchPage.tsx`) become unreachable once `POST /v1/company/` returns 410 Gone; the redirect MUST happen unconditionally, not only on a 410 response, since a companyless authenticated user reaching either route is itself the anomaly the wizard now owns.

- Scenario: `/create-company` redirects. **Given** an authenticated user with no company navigates to `/create-company`, **when** the route renders, **then** the user MUST be redirected into the wizard flow rather than shown the legacy form.
- Scenario: `/setup-branch` redirects. **Given** the same condition at `/setup-branch`, **then** the same redirect MUST occur.
- Test note: routing test (React Router test utilities) asserting navigation to the wizard entry point when either legacy path is visited.

### Requirement: Toolchain Config Reflects Installed Test Runner
`openspec/config.yaml`'s `testing.runner: none` and `strict_tdd: false` MUST be updated to reflect that vitest + jsdom + Testing Library are installed and the runner is `npm test`. This is a proposal Success Criterion, not optional cleanup: the field is factually wrong today and blocks later phases from correctly gating on test results.

- Scenario: Config matches installed toolchain. **Given** the completed change, **when** `openspec/config.yaml` is inspected, **then** `testing.runner` MUST name the vitest command and `testing.layers.unit`/`integration` MUST reflect what this change actually exercises.
- Test note: this requirement is verified by direct file inspection, not a runtime test — it is a documentation/config-accuracy requirement.
