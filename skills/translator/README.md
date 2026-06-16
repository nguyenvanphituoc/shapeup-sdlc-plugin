# translator

The language gate upstream of the harness. It turns the PO's non-English intake (pitch /
PRD / requirement / transcript) into faithful **English** copies the harness can consume,
then proves the result is English and structurally identical to the source. It is **narrow
by design** — it normalizes language, nothing else.

```
PO intake (any language)  →  TRANSLATOR  →  <name>.en.md (+ glossary.md + report)  →  ba-pitch-analyzer → …
```

**Why it exists:** the harness (ba-pitch-analyzer → task-executor → spec-evaluator) is
English-only end to end and HARD-FAILs on anything else. Previously `tech-lead` was expected
to cover this; that conflated orchestration with language normalization. This skill owns the
language concern so the orchestrator stays thin.

**What it does NOT do:** plan, build, judge, or translate harness output back to the PO's
language. Input-normalization only.

## Resource map
```
translator/
├── SKILL.md                       # entry — GATE T0–T2, the detect→glossary→translate→verify flow, flags, hard rules
├── README.md                      # this file
└── references/
    └── preservation-rules.md      # ★ translate-vs-preserve table, 1:1 structure rule, glossary protocol, verification scan
```

| Resource | Loaded at | Purpose |
|----------|-----------|---------|
| `SKILL.md` | always | T-gates, phase sequence, invocation, hard rules |
| `references/preservation-rules.md` | before translating | what stays verbatim, glossary format, the 3 verification checks |

## Install
```bash
cp -r translator <repo>/.claude/skills/      # or ~/.claude/skills/
```
Pairs with the harness skills (`ba-pitch-analyzer`, `task-executor`, `spec-evaluator`,
`tech-lead`). `tech-lead` auto-invokes it at GATE L0 when intake is non-English.

## Invoke
```bash
/translator docs/pitch.md                       # → docs/pitch.en.md (+ glossary.md, report)
/translator docs/intake/                         # folder; already-English files skipped
/translator --glossary docs/glossary.md docs/pitch.md   # reuse vocabulary across docs/runs
/translator --check docs/pitch.md                # detect-only (what tech-lead L0 calls)
/translator --auto docs/pitch.md                 # headless; still stops on a dirty residual scan
```

## Gate map
| Gate | When | Decision |
|------|------|----------|
| T0 | intake | detect source language per file; scope what to translate; `--check` stops here |
| T1 | after glossary | PO confirms term mappings; ambiguous terms resolved (never guessed) |
| T2 | after verify | sign off only on a clean residual scan + matching structure |

## Output
- `<name>.en.md` — the English copy (original never overwritten)
- `glossary.md` — source→English term map (persisted, reusable)
- `translation-report.md` — detect table, glossary diff, verification result

## Version
0.1 — initial language gate. Detect → glossary → translate → verify → sign-off. Strict
English-only for the whole harness; faithful 1:1 with structure/frontmatter/wikilink/code/
number preservation; reusable glossary; idempotent already-English no-op; `--check` mode;
residual-non-English scan blocks sign-off even under `--auto`.
