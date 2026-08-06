# Design: Refund by Client Payment Grouping (Frontend Coordinated Reference)

> **Source of truth**: the authoritative design lives in the backend repository at
> `rack-backend/openspec/changes/refund-client-payment/design.md`. This file is the
> coordinated frontend reference for the cross-repository change
> `refund-client-payment`. Contract decisions (data model, atomic service,
> allocation math, endpoint shapes, scoping, rollback) are defined there and are
> not repeated here.

## Technical Approach (frontend slice)

Replace the client-side allocation loop with one atomic bulk call and add a
Grouped/Individual tab split to the refund modal. All server state stays in
TanStack Query via the regenerated `openapi-ts` client; no new state library.

## Architecture Decisions

| Decision | Options (tradeoff) | Choice | Rationale |
|----------|-------------------|--------|-----------|
| Bulk call wiring | Generated React Query mutation (repo convention) vs raw SDK call | Generated `v1CustomerPaymentsCreateMutation` | CLAUDE.md: prefer generated hooks; raw SDK only for custom mutations |
| `sale_ids` usage | Omit field (current behavior) vs build selective-sale UI now | Omit; backend accepts it optionally | Contract Option B: selective-sale payment enabled later without a contract break |
| Tab state | Local `useState` (existing modal pattern) vs URL/global state | Local `useState`, Grouped default | Matches modal conventions; progressive disclosure keeps Individual for power users |
| Group refund hook | Extend `useReversePayments` (two responsibilities) vs new `useReverseCustomerPayment` | New hook, shared `extractErrorDetail` + invalidation pattern | Mirrors existing hook; invalidates `v1CustomerPaymentsList`, `v1CustomerSalePaymentsList`, `v1SalesList`, and per-sale keys from `affected_sales` |
| Money display | Reuse modal's integer-cent `toCents` accumulation (exact) vs parseFloat sums (drifts) | Reuse `toCents` pattern for group totals | Confirmation dialog amount must match the server's Decimal sum exactly |

## Data Flow

    PaymentForm → onSubmitOverride=handleBulkPayment
      → v1CustomerPaymentsCreateMutation({amount, currency, payment_method, discount})
      → one success toast / error toast with backend `detail`; modal stays open on error
      → invalidate v1SalesList (+ customer queries)

    ReversePaymentsModal
      ├── Tab "Agrupados" (default): v1CustomerPaymentsList(customer_id)
      │     → select group → confirm dialog states exact remaining refundable
      │     → useReverseCustomerPayment → POST /v1/customer-payments/<id>/reverse/
      └── Tab "Individuales": existing list + useReversePayments (unchanged)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/pages/contacts/CustomerSalesPage.tsx` | Modify | `handleBulkPayment` issues one bulk call; drop float loop and `pendingSales` sort |
| `src/pages/contacts/components/ReversePaymentsModal.tsx` | Modify | Two tabs; Grouped lists groups with remaining refundable amount; fully-reversed groups disabled |
| `src/pages/contacts/hooks/useReverseCustomerPayment.ts` | Create | Group reverse mutation + cache invalidation, backend `detail` error toasts |
| `src/client/` | Regenerated | `npm run generate-api` after backend `schema.yml` update — never hand-edited |

## Testing Strategy

No test runner installed (sdd-init known gap — out of scope to add one here).
Verification is `npm run build` (strict TS type-check against regenerated client)
plus manual QA: one-call registration, Grouped tab default, exact-amount
confirmation, Individual tab regression, stale-frontend compatibility.

## Migration / Rollout

Ship only after the backend endpoints are deployed (per backend rollout order).
Rollback: revert the two pages/hook and regenerate `src/client/` against the
pre-change `schema.yml`; an un-reverted backend simply receives no calls.

## Open Questions

- None beyond those in the backend design.
