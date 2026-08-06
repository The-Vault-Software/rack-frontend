# Tasks: Refund by Client Payment Grouping (Frontend Coordinated Reference)

> Authoritative tasks live in `rack-backend/openspec/changes/refund-client-payment/tasks.md`. Contract decisions, model, endpoints, and rollout order are defined there and not repeated here. This file mirrors the frontend slice (Phases 5–7) for cross-repo coordination.

## Review Workload Forecast

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Frontend ships only as PR3 (base=main, post backend merge + deployed schema.yml). Focused test: `npm run build`; runtime harness: manual QA of registration + both tabs. Rollback: restore `handleBulkPayment` loop + flat `ReversePaymentsModal`; regenerate `src/client/` against pre-change `schema.yml`.

## Phase 5: Frontend Client & Bulk Registration

- [x] 5.1 Copy backend `schema.yml`; `npm run generate-api`; never edit `src/client/`; `npm run build`.
- [x] 5.2 `CustomerSalesPage.tsx::handleBulkPayment`: drop loop+`pendingSales` sort; one `v1CustomerPaymentsCreateMutation({amount, currency, payment_method, discount})`; omit `sale_ids` (Option B future).
- [x] 5.3 Preserve USD-only discount guard (legacy quirk); do NOT align to backend uniform `SalePaymentSerializer`.
- [x] 5.4 One toast on success; backend `detail` on error; modal open on error; invalidate `v1SalesList`+customer; `npm run build` + manual QA.

## Phase 6: Frontend Refund Tabs

- [x] 6.1 Create `src/pages/contacts/hooks/useReverseCustomerPayment.ts`: mutation, `detail` toast, invalidate group+sale keys, reuse `extractErrorDetail`.
- [x] 6.2 `ReversePaymentsModal.tsx`: two tabs `useState`; Grouped (Agrupados) default / Individual (Individuales).
- [x] 6.3 Grouped tab: groups newest-first; distinct loading/error/empty states; fully-reversed disabled.
- [x] 6.4 Confirm dialog: exact remaining refundable, one reverse request, disable while pending, success post-server. Individual tab preserves per-row/select-all/reason≤255/legacy endpoint; Spanish copy.
- [x] 6.5 `npm run build` + manual QA both tabs, exact amount, individual regression.

## Phase 7: Rollout & Verify (frontend)

- [x] 7.3 Coordinated rollout: backend PR(s) merged → deployed `schema.yml` verified → then frontend PR. Legacy `POST /v1/sales/<id>/payments/` + `reverse/` must remain callable so an un-updated frontend keeps working.