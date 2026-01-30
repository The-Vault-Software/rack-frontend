## 2024-05-22 - O(N*M) Lookup Bottleneck in Tables
**Learning:** The application frequently renders tables (like Inventory) where each row performs a `.find()` operation on related data (Stock, Categories). This creates O(N*M) complexity which scales poorly.
**Action:** Systematically replace `.find()` inside render loops with pre-computed `Map` lookups using `useMemo`.
