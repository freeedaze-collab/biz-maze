# Merge resolution guidance

When resolving the conflicts reported in `TransactionHistory.tsx` and `20251110_create_v_all_transactions.sql`, keep the changes that introduce stable `ctx_id` support and the dual (tx/ctx) usage labeling flow. In practice, choose the incoming change anywhere the conflict is between the main branch and the version that includes `ctx_id`.

## TransactionHistory.tsx
- Preserve the `ctx_id` field on `TxRow` and the `usageKey` helper that builds `tx:` / `ctx:` keys.
- Keep the expanded `loadUsageDrafts`, `onPredictUsage`, and `onSaveUsage` logic that handles both `tx_id` and `ctx_id` records (incoming change).
- In the transaction table, keep the dropdown wiring that uses `usageKey` so exchange rows can be edited (incoming change).

## 20251110_create_v_all_transactions.sql
- Keep the computed `ctx_id` columns for both wallet and exchange rows and the `nullif(... )::bigint` tx_id extraction for exchanges (incoming change).

With these choices, labeling and prediction will work for both wallet and exchange transactions via `ctx` identifiers.
