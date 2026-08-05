# architecture-research-report

A repo-local Claude Code skill. Anyone who clones this repository gets it automatically — no
install step. It is **not** part of the `shapeup-sdlc-plugin` product; it lives in `.claude/skills/`
precisely so it stays out of the harness's thirteen pipeline skills and their structural contract.

## What it does

Researches a technical question, then writes an evidence-dense architecture report that takes a
position and shows its work — Mermaid diagrams, weighted comparison tables, claims cited to
`file:line` or a measured number, staged and costed recommendations.

It triggers on its own when you ask for a technology comparison, an architecture review of an
existing system, a design doc, or a deep dive on a technical domain. To invoke it deliberately:

```
/architecture-research-report
```

## Using it

Just ask. Examples that trigger it:

- "Should we move the RAG index off pgvector before the Q1 traffic step-up?"
- "Review this service's architecture — where are the real structural weaknesses?"
- "What's the state of the art in agentic eval, and what does it mean for us?"

## Layout

| Path | What it is |
|---|---|
| `SKILL.md` | The five-phase workflow and the report spine (§0–§7) |
| `references/report-craft.md` | House style — the finding paragraph, comparison tables, citation forms, prose failures with rewrites |
| `references/diagram-patterns.md` | Verified Mermaid per diagram type, plus the escaping rules that break rendering |
| `references/graph-engineering.md` | *Graph Engineering — The Karpathy Loop* (2026) distilled into review lenses: the six selection questions, five planes, six-rung ladder, when a graph is the wrong answer |
| `references/ai-data-lenses.md` | Evaluation design, cost/latency modelling, RAG failure stages, data contracts |
| `scripts/validate_report.py` | Report linter (see below) |
| `evals/evals.json` | Three test prompts with assertions, for iterating on the skill |

## The linter

Run it on any report, whether or not the skill wrote it:

```bash
python3 .claude/skills/architecture-research-report/scripts/validate_report.py docs/my-report.md
```

It checks Mermaid syntax against the errors that actually break rendering (unquoted parens in
labels, bare `->` arrows, reserved node ids, unclosed subgraphs), verifies the report's spine
sections are present, measures citation density, and flags hedge phrases. Exit code is non-zero
only on errors — warnings are advice.

Python 3.9+, standard library only.

Calibration: it flags all six planted defects in its test fixture and raises zero false-positive
errors on `docs/plan/graph-engineering-roadmap.md` (5,700 words, 9 diagrams), which is the
reference example of the output standard this skill aims at.

## Changing it

The skill is prose — edit `SKILL.md` and the references directly. `evals/evals.json` holds three
test prompts with assertions if you want to measure a change rather than guess at it; the
`skill-creator` skill runs that loop.
