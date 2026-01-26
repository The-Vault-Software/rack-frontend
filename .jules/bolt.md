## 2026-01-26 - O(N*M) Lookup in Render Loop
**Learning:** Found O(N*M) complexity in list rendering where category/unit names were looked up via `find()` inside the map loop.
**Action:** Always pre-calculate lookup Maps (O(1)) for reference data (Categories, Units) before rendering large lists.
