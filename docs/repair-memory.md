# Shape Up SDLC Repair Memory

This repository tracks historical evaluation failures, prompt modifications, and repair actions taken during local skill evolution runs. It serves as the memory store for HarnessFix diagnosis-driven skill optimization.

---

## Evolution Memory Log

| Date | Target Skill | Symptom / Failure Case | Scoped Repair Operator | Outcome / Delta |
| :--- | :--- | :--- | :--- | :--- |
| 2026-06-19 | (Example) `shapeup` | Trigger failure on "let's shape this" | Trigger-eval optimizer (`run_loop.py`) | Improved TPR from 0.40 to 0.75 |

---

## Repair Operator Guidelines

When fixing a skill's instructions or trigger descriptions:
1. **Trigger Adjustments**: Refine the trigger phrases in frontmatter `description` only. Do not overfit to specific queries.
2. **Instruction Refinements**: If a skill fails functional checks (e.g., evaluator leniency or executor code-bloat), add explicit counter-examples to the `references/` files.
3. **Seesaw Constraint Verification**: Ensure `make eval-gate` is run before committing modifications. Evolved skills must never regress previously passing baseline tests.
