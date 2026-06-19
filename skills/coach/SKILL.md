---
name: coach
description: Translates raw Product Owner feedback at the L4 Gate (Ship Sign-off) into structured rules in the global knowledge base.
---

# Coach Skill

## Purpose
The `/coach` skill ingests unstructured post-sprint feedback provided by the PO/TL at the Ship Sign-off (L4 Gate). It consolidates, deduplicates, and generalizes this feedback, then saves it to `.shapeup-sdlc/knowledge-base.md`.

## Instructions
1. Read the provided raw feedback from the user.
2. Check if `.shapeup-sdlc/knowledge-base.md` exists. If it does, read it. If not, initialize a new document.
3. Merge the new feedback into the knowledge base:
   - **Consolidate** overlapping rules.
   - **Deduplicate** redundant information.
   - **Generalize** specific issues into broader architectural or stylistic guidelines.
4. Rewrite `.shapeup-sdlc/knowledge-base.md` with the updated rules.
5. Explain to the user that these rules will now serve as guidelines for `/task-executor` and `/ba-pitch-analyzer` in future cycles, but they will not act as strict invariants for `/spec-evaluator`.
