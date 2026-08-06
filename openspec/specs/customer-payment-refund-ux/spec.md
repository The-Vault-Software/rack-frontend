# Customer Payment Refund UX Specification

## Purpose

Registers a client payment ("cobro") through one atomic backend call and lets users refund it as a group or allocation-by-allocation in `ReversePaymentsModal`. UI copy is Spanish; technical identifiers stay English. Provider payments and OVERPAID/customer-credit UI are out of scope. Depends on the backend `customer-payment-groups` capability shipping first.

## Requirements

### Requirement: Atomic Bulk Registration Call

`CustomerSalesPage.handleBulkPayment` MUST replace its sequential per-sale loop with a single `POST /v1/customer-payments/` call carrying amount, currency, payment method, discount, and the current exchange-rate snapshot; allocation MUST be delegated to the backend. The UI MUST show exactly one success toast on completion and MUST NOT present partial-success states.

#### Scenario: One call, one toast

- GIVEN a customer with three pending sales
- WHEN the cashier confirms a payment covering all three
- THEN exactly one bulk request is issued and one success toast appears (e.g. "Se registró el pago exitosamente").

#### Scenario: Server error surfaces backend message

- WHEN the bulk call fails
- THEN an error toast shows the backend `detail` message and the payment modal stays open with the entered values.

### Requirement: Grouped Refund Tab

`ReversePaymentsModal` MUST present two tabs — Grouped (default) listing `CustomerPayment` groups, and Individual preserving the current per-row list. The Grouped tab MUST show per group: date, payment method, currency, registered total, remaining refundable amount, and affected sale count.

#### Scenario: Default tab on open

- WHEN the modal opens
- THEN the Grouped tab is active and groups are listed newest-first.

#### Scenario: Group with prior partial refunds

- GIVEN a group with one allocation already refunded individually
- THEN the group shows a remaining refundable amount lower than its registered total.

### Requirement: Group Refund Exact-Total Behavior

Confirming a selected group MUST issue exactly one `POST /v1/customer-payments/<id>/reverse/` call. The confirmation dialog MUST state the exact remaining refundable amount to be reversed, and success feedback MUST appear only after the server confirms.

#### Scenario: Exact match confirmation

- WHEN a group with 100 USD remaining is confirmed
- THEN the dialog states that exact amount and one group-reverse request is issued.

#### Scenario: Fully reversed group not selectable

- GIVEN a group whose allocations are all reversed
- THEN it is not selectable in the Grouped tab.

### Requirement: Individual Refund Tab

The Individual tab MUST preserve current behavior: per-payment selection, select-all, optional reason (max 255 chars), truncation notice for histories over one page, and reversal via `POST /v1/sale-payments/reverse/`. Any single active allocation — grouped or legacy, including partial-coverage ones — MUST remain refundable by its full stored amount.

#### Scenario: Refund one grouped allocation

- GIVEN the Individual tab
- WHEN one allocation of a group is reversed
- THEN the Grouped tab reflects the reduced remaining amount on next open.

### Requirement: Legacy Compatibility and Rollout

The change MUST NOT break an un-updated frontend: every legacy endpoint it calls MUST remain available server-side. The Individual tab MUST keep calling the legacy reverse endpoint. The registration migration to the bulk endpoint MUST ship only after the backend endpoint is deployed.

#### Scenario: Updated backend, stale frontend

- GIVEN a backend with the new endpoints deployed and an un-updated frontend
- WHEN a user registers or reverses payments
- THEN all existing flows keep working unchanged.

### Requirement: Generated API Client

After the backend schema update, `src/client/` MUST be regenerated exclusively via `npm run generate-api` and MUST NOT be hand-edited. New calls MUST prefer the generated TanStack Query hooks; raw SDK functions MAY be used only for custom mutations.

#### Scenario: Schema regeneration

- WHEN the backend `schema.yml` gains the new endpoints
- THEN regeneration produces typed hooks for them and `npm run build` type-checks without manual edits.

### Requirement: Loading, Error, and Empty States

Each tab MUST render distinct loading, error, and empty states (current copy: "Cargando pagos...", "No se pudieron cargar los pagos del cliente.", "Este cliente no tiene pagos registrados."). Mutation errors MUST surface the backend `detail` message via toast. Confirm buttons MUST be disabled while a mutation is pending.

#### Scenario: Failed group list load

- WHEN the groups query fails
- THEN the Grouped tab shows the error state and no stale data is displayed.

### Requirement: Spanish UI Copy

All user-facing strings (tab labels, toasts, status badges such as "Devolución"/"Devuelto"/"Activo", confirmation dialogs) MUST be in Spanish; technical identifiers and code artifacts MUST stay in English.

#### Scenario: Modal copy

- WHEN the modal renders
- THEN every visible label and message is Spanish.
