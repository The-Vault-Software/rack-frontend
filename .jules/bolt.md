## 2025-02-19 - Inventory List Performance
**Learning:** Rendering large lists with nested `find()` operations on every item causes O(N*M) complexity, which is a major bottleneck in React render loops.
**Action:** Always pre-calculate lookups using `Map` or objects inside `useMemo` before the render loop to ensure O(1) access complexity.
