# SPIKE-NOT-NEEDED

No existing code and no third-party seam; everything is Node builtins (`node:fs`, `process.argv`, global `URL`). The nearest unknowns (schema JSON shape, exit-code and output contract) are specification decisions for the planner, not something code investigation can resolve. `URL` parsing and `node --test` are well-known prior art. Rank-0 technical risk; product-level open questions are in hill-signal.md.
