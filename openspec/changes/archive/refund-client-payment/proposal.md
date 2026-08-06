# Proposal: Refund by Client Payment Grouping (Frontend Coordinated Reference)

> **Source of truth**: the authoritative proposal lives in the backend repository at
> `rack-backend/openspec/changes/refund-client-payment/proposal.md`. This file is the
> coordinated frontend reference required for the cross-repository SDD change
> `refund-client-payment` (exploration topic `sdd/refund-client-payment/explore`,
> Engram observation #15).

## Suggested Change Name
`refund-client-payment`

## Intent (frontend slice)
Replace the client-side sequential allocation loop in `handleBulkPayment` with a single
atomic bulk registration call against the new backend endpoint, and add grouped + individual
refund tabs to `ReversePaymentsModal` so a whole cobro can be refunded with an exact amount
match while per-allocation refunds remain available.

## Frontend Scope
- Replace `CustomerSalesPage.handleBulkPayment` float-arithmetic loop with a single
  `POST /v1/customer-payments/` call (amount, payment method, currency, exchange-rate
  snapshot, date, allocated sales) — allocation moves to the backend.
- `ReversePaymentsModal`: add two tabs — **Grouped** (refund by cobro) and **Individual**
  (current per-row behavior preserved, including partial amounts).
- Regenerate `src/client/` via `npm run generate-api` after the backend schema update;
  prefer generated React Query hooks over raw SDK functions (per repo CLAUDE.md).
- Preserve existing fallback against the legacy per-sale endpoint until the coordinated
  rollout completes (legacy endpoint stays available — see backend proposal question #3).

## Frontend Non-Goals
- No provider `AccountPayment` UI changes.
- No historical grouping heuristic on the client.
- No overpayment / OVERPAID / customer credit UI.

## Capabilities (frontend)
- `customer-payment-refund-ux`: grouped + individual refund tabs and bulk registration call
  coordination. Full definition in backend proposal.

## Affected Frontend Areas
| Area | Impact | Description |
|------|--------|-------------|
| `src/pages/contacts/CustomerSalesPage.tsx` | Modified | `handleBulkPayment` calls bulk endpoint instead of sequential per-sale loop |
| `src/pages/contacts/components/ReversePaymentsModal.tsx` | Modified | Add Grouped + Individual tabs; dispatch to group reverse vs per-id reverse |
| `src/pages/contacts/hooks/` (refund + payment hooks) | Modified | Switch refund hook to accept either `group_id` or `payment_ids` |
| `src/client/` | Regenerated | `openapi-ts` output after backend schema update — never manually edited |

## Cross-Repository Dependency
Backend must ship the new endpoints + migration first. Frontend depends on a regenerated
`schema.yml`; until then, the existing loop + flat modal keep working against the legacy
endpoints. Coordinated rollout order is specified in the backend proposal.

## Risks (frontend slice)
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Generated client drift after backend schema change | Low | Run `npm run generate-api` immediately after backend merge; never hand-edit `src/client/` |
| Tab UX adds cognitive load vs current flat list | Med | Progressive disclosure: Grouped tab as default happy path, Individual tab for advanced/power users |
| 400-line budget exceeded across both repos | High | Forecast in `sdd-tasks`; recommend chained PRs — backend slice before frontend slice |

## Rollback Plan (frontend)
- Revert `CustomerSalesPage.tsx` and `ReversePaymentsModal.tsx` to the loop + flat modal.
- Regenerate `src/client/` against the pre-change `schema.yml`.
- New endpoints are additive; an un-rolled-back backend keeps serving but the frontend simply
  does not call them.

## Success Criteria (frontend)
- [ ] One cobro registered through one bulk call — no per-sale loop remaining in `handleBulkPayment`.
- [ ] Grouped tab refunds a whole cobro matching the registered total exactly.
- [ ] Individual tab still reverses any single allocation, including partial amounts.
- [ ] `src/client/` regenerated from updated `schema.yml`; no manual edits.