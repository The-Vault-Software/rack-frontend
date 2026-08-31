## 2024-05-23 - [Optimization] Replace Array.find with Map lookup in Render Loop
**Learning:** Using `Array.find` inside a render loop (e.g., `map`) or expensive `useMemo` calculation results in O(N*M) complexity. For large datasets, this causes significant performance degradation.
**Action:** Pre-compute lookups using `Map` (O(1) access) in a `useMemo` hook before the render loop. This reduces complexity to O(N + M).
