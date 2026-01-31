# Bolt's Journal

## 2024-10-26 - [O(N*M) Lookups in Render Loops]
**Learning:** The codebase frequently uses `Array.prototype.find()` inside render loops (e.g., inside `products.map`) to resolve foreign keys (Category ID -> Name). This creates `O(N*M)` complexity which degrades performance significantly as list sizes grow.
**Action:** Replace these lookups with `O(1)` Maps created via `useMemo`. This is a low-risk, high-impact pattern to apply across the project.
