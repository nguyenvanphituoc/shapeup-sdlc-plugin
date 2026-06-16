# Context Loading Rules — Phase 1

Rules for loading spec documents before implementation. Read before Phase 1.

---

## Loading Priority Order

Always read in this order — earlier docs establish vocabulary for later ones:

```
1. task file (full)                          ← primary spec
2. run-state.md                              ← lens + feature context
3. domain-model.md                           ← entity + aggregate definitions
4. usecases/[UC-referenced-in-task].md       ← use case IO shapes
5. ux-behavior.md (LITE only, screen section) ← screen state spec
6. contracts/[repo].contract.md (STANDARD)    ← typed request/response
7. integration.md (STANDARD, if task touches cross-system boundary)
8. Existing code files referenced in task.context
```

---

## Wikilink Resolution

Pattern: `[[doc-name]]` or `[[doc-name#Section]]`

Resolution algorithm:
```
1. Strip [[ and ]] and optional #Section anchor
2. Search for: spec_folder/[doc-name].md
3. Search for: spec_folder/[subfolder]/[doc-name].md
   (e.g. [[usecases/UC-CreateOrder]] → spec_folder/usecases/UC-CreateOrder.md)
4. If not found: note as unresolved — surface at GATE C
```

Never resolve wikilinks from memory or training data.
If a contract file is referenced but missing, do not invent its contents.

---

## Large File Strategy

For files > 300 lines, read only the sections the task references:

```bash
# Extract a section by header
awk '/^## Section Name/{found=1} found{print; if (/^## / && !/^## Section Name/) exit}' file.md
```

Print which sections were loaded (for GATE C summary).

---

## Existing Code Reading

Before implementing, always check if relevant code already exists:

```bash
# Find files in the target package
find . -path "*[package_path]*" -name "*.ts" ! -path "*/node_modules/*" | head -20

# Read any file referenced by task.context
cat [referenced_file_path]
```

If a type/interface already exists in the codebase: use it, do not redefine.
If it conflicts with the spec: surface at GATE C.

---

## SPIKE-Specific Context Loading

For SPIKE tasks, load:
1. task file
2. api-feasibility.md — the specific API-NN block referenced by task.api_ref
3. Any existing contract file for that API (even if partial / ⏳ TBD)

Do not load domain-model or use cases — SPIKE output is a findings document, not code.

---

## Missing Context Checklist

After Phase 1, verify these are loaded:
- [ ] Task AC section read completely
- [ ] All `[[wikilinks]]` in task body resolved or flagged
- [ ] Layer context confirmed (lite vs standard)
- [ ] Existing code style reference identified (at least one comparable file)
- [ ] Test command confirmed (from GATE B)
