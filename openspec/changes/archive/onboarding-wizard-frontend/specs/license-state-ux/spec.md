# Delta Spec: license-state-ux (NEW capability)

Change: `onboarding-wizard-frontend` (change 3 of 3). Fixes the defect where an inactive-licence `402` is misreported as invalid credentials, and defines the one neutral terminal state that follows a `402` from any source. Binding decisions (do not re-open): a single neutral copy for both expired and revoked licences (no `detail` string-matching, no dependency on an unshipped backend `code` field); the terminal state has no read-only mode; the wizard's `/register` flow itself is unaffected by this domain.

## ADDED Requirements

### Requirement: 402 Detected Distinctly From 401 on Login
The login flow MUST distinguish a `402` response from a `401` response and MUST NOT show the credentials-error message for a `402`. Today `LoginPage.tsx`'s `onError` handler shows `"Credenciales inválidas o error en el servidor."` for every login failure regardless of status — this is the defect this requirement removes.

- Scenario: 402 on login shows licence state, not credentials error. **Given** `POST /v1/login/` responds `402` with body `{"detail":"Company license has expired."}`, **when** the login mutation fails, **then** the user MUST be shown the licence-inactive terminal state (see "Neutral Terminal Licence-Inactive State" below) and MUST NOT see `"Credenciales inválidas o error en el servidor."` or any other wording implying a bad password.
- Scenario: 401 on login still shows the credentials error. **Given** `POST /v1/login/` responds `401`, **when** the login mutation fails, **then** the existing credentials-error message MUST still be shown (this requirement narrows the 402 case; it MUST NOT regress the 401 case).
- Test note: component test rendering `LoginPage`, mocking the login mutation to reject with a `402`-shaped error, and asserting the licence-inactive UI renders while the credentials-error toast text does not appear. A second test asserts the 401 case is unchanged.

### Requirement: 402 on Token Refresh Reaches the Terminal State Without Bouncing to Login
The response interceptor in `src/App.tsx` MUST check for `402` before or independently of its existing `401` handling, and a `402` received during token refresh MUST route the user to the licence-inactive terminal state directly. It MUST NOT retry the original request, and MUST NOT redirect to `/login` — an inactive licence is terminal, not a token-expiry condition, and the existing 401-refresh-failure redirect path (`App.tsx:62`) MUST NOT be reused for this case.

- Scenario: 402 during refresh goes terminal, not to login. **Given** an authenticated user's session encounters a `402` (either on the original request or during the refresh attempt it triggers), **when** the interceptor processes the response, **then** the user MUST land on the licence-inactive terminal state and `window.location.href` MUST NOT be set to `/login`.
- Scenario: 402 does not retry the original request. **Given** the same condition, **then** the interceptor MUST NOT attempt to replay the original request after receiving a `402`.
- Test note: unit/integration test on the interceptor logic (or an integration test through a component making an authenticated request) mocking a `402` response and asserting no navigation to `/login` occurs and no retried request is observed.

### Requirement: 401 Behavior Is Unchanged (Regression Guard)
The existing `401` handling — attempt refresh via `v1RefreshCreate`, retry the original request on success, redirect to `/login` on refresh failure (except when already on `/login` or `/register`) — MUST continue to function exactly as before this change. This change MUST extend the interceptor's status handling to cover `402`; it MUST NOT alter the `401` code path.

- Scenario: 401 still triggers refresh-and-retry. **Given** a request responds `401` and refresh succeeds, **when** the interceptor processes it, **then** the original request MUST be retried and its result returned, exactly as before this change.
- Scenario: 401 refresh failure still redirects to login. **Given** a request responds `401` and the refresh attempt itself fails, **when** neither `/login` nor `/register` is the current path, **then** the browser MUST be redirected to `/login`, exactly as before this change.
- Test note: this is a regression test, not new behavior — write it against the current (pre-change) interceptor contract and keep it green through the change.

### Requirement: Neutral Terminal Licence-Inactive State
The system MUST present exactly one licence-inactive terminal screen for both an expired and a revoked licence, worded so its claim is true in both cases (e.g., "tu licencia no está activa" / "your licence is not active" — not "expired" specifically). The system MUST NOT string-match the `402` response body's `detail` text to select different copy, and MUST NOT depend on a backend `code` field to distinguish expired from revoked, since no such field is shipped on the wire today (`LicenseExpired`/`LicenseRevoked`'s `default_code` is lost in DRF's `ErrorDetail` string serialization — verified live against the running backend).

- Scenario: Expired licence shows the neutral state. **Given** a `402` with `detail: "Company license has expired."`, **when** the terminal state renders, **then** its copy MUST be the same neutral wording used for a revoked licence — no expired-specific wording MUST appear.
- Scenario: No detail-string branching in code. **Given** the implementation, **when** the licence-inactive handling logic is inspected, **then** it MUST NOT contain a conditional keyed on the `detail` string's content (e.g., no `if (detail.includes('expired'))`).
- Test note: a test asserting identical rendered copy for two distinct mocked `402` bodies (one plausible "expired" detail, one plausible "revoked" detail) is the direct behavioral proof this scenario needs.

### Requirement: Terminal State Has No App Access
The licence-inactive terminal state MUST NOT grant access to any application route, read-only view, or data export. Reaching it MUST be a dead end with respect to the product itself — the only affordance is the contact route (see next requirement).

- Scenario: No navigation out except contact. **Given** the user is on the licence-inactive terminal state, **when** they look for a way into the app, **then** no link, button, or automatic redirect MUST lead to any authenticated app route (dashboard, inventory, sales, etc.).
- Test note: component test asserting the terminal screen renders no navigation affordance other than the contact route and (optionally) logout.

### Requirement: Terminal State Provides a Contact Route
The licence-inactive terminal state MUST provide a way to make contact (e.g., a mailto link, support URL, or contact form entry point) so the tenant has a path to resolution. It MUST NOT imply that the upgrade/renewal path is closed — the state is terminal in that the app is inaccessible, not in that resolution is impossible.

- Scenario: Contact affordance present. **Given** the user is on the licence-inactive terminal state, **when** the screen renders, **then** a contact affordance (link or actionable element) MUST be present and MUST be reachable without further authentication.
- Test note: component test asserting the contact element is present in the rendered DOM and has a resolvable `href` or equivalent action.

### Requirement: 402 on Any Authenticated Request Reaches the Same Terminal State
A `402` received on any request through the shared API client — not only login or refresh — MUST route to the same licence-inactive terminal state via the same code path, so the behavior does not silently diverge per call site.

- Scenario: 402 on an arbitrary authenticated GET. **Given** an authenticated user's session has gone `402` (licence deactivated mid-session) and they trigger any data-fetching request, **when** the response interceptor sees `402`, **then** the same terminal-state routing MUST occur as in the login and refresh cases.
- Test note: integration-style test hitting the shared interceptor with a `402` from a non-auth endpoint and asserting the same terminal-state outcome as the login/refresh tests.
