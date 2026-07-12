# Local Tasks Architecture Plan

This document outlines the architectural shift to manage tasks locally, separating the committed deliverables from the ephemeral run-traces.

## 1. Task Locality
* The `tasks/` directory (`_index.md` and `TASK-NNN.md` files) will be moved entirely out of the shared `docs/shapeup-sdlc/<slug>/spec/` root and into the ephemeral, gitignored local root at `.shapeup-sdlc/<slug>/tasks/`.
* The shared repository will **only** care about high-level requirements: `usecases/`, `domain-model.md`, and scope contracts.

## 2. Evaluation Source of Truth
* Because the tasks are now local execution steps, the `spec-evaluator` will no longer grade against the acceptance criteria within individual `TASK-NNN.md` files.
* Instead, `spec-evaluator` will use the shared, committed `usecases/` and `domain-model.md` as its absolute source of truth for grading the feature.

## 3. Task Generation (`ba-pitch-analyzer`)
* `ba-pitch-analyzer` will still generate the tasks, but it will split its output: the domain tree goes to the shared `docs/` root, while the `tasks/` folder is written directly to the local `.shapeup-sdlc/` root.

## 4. PO Gate (`GATE L1b`)
* At `GATE L1b - Board Review`, the PO will no longer review the local `tasks/_index.md` board.
* Instead, the PO will sign off on the shared `usecases/` and scope contracts, ensuring the high-level plan is sound before execution begins. Implementation details remain hidden.

## 5. Developer Handoff (Bootstrapping)
* If a second developer pulls a branch containing the shared `usecases/` but lacking the ephemeral local `tasks/`, the orchestrator will handle this gracefully.
* The `tech-lead` will automatically detect a missing `.shapeup-sdlc/<slug>/tasks/_index.md` and invoke `ba-pitch-analyzer --tasks-only` to regenerate the task board on the fly for their local machine.
