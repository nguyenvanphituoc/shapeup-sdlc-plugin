# 01 — Objective & Product Value

[← Back to index](README.md)

## Why this exists

Left alone, an autonomous coding agent tends toward the same failure mode regardless of model
quality: it self-reports progress, marks its own homework, and drifts scope — because nothing
in its loop forces a skeptical, independent check before it says "done." The harness exists to
remove that failure mode structurally, not by prompting the agent to "be more careful."

It does this by taking **Shape Up** — Basecamp's six-week product-development methodology —
and re-implementing its roles (shaper, builder, evaluator), its rhythm (shape → bet → build),
and its central discipline (the Hill Chart: progress is a position, never a percentage) as an
actual pipeline of scripts, JSON schemas, and hook-enforced preconditions that a Claude Code
session drives.

## Product value

| Problem in unmanaged agent coding | What the harness does instead |
|---|---|
| The agent that writes the code also decides it's correct. | A dedicated `spec-evaluator` — skeptical by default, absence of evidence is a FAIL — runs exactly once per round, after the board is fully green. Single judge, never the builder. |
| "It works" is a claim, not a fact. | Scoped builds require a **T0** mechanical artifact — fixtures, a DB probe, and a cross-scope regression check (*seesaw*) — before a verdict may even cite the work as done. |
| A stuck agent either loops forever or silently gives up. | A **two-level circuit breaker**: an outer round budget and an inner per-scope attempt budget. An exhausted scope is queued as a proposal for a human decision — it never blocks the run and never loops silently. |
| Parallel or multi-scope work steps on itself. | Each vertical scope gets a write-whitelisted file substrate, mechanically enforced by a `PreToolUse` hook — one scope's generator physically cannot edit another's files. |
| Lessons learned in one sprint evaporate by the next. | PO feedback at ship sign-off is filed, by a categorization gate, into a committed **knowledge base** that the relevant skill reads back on its next run — team-shared on `git pull`, not trapped in one session. |
| The human loses the thread of a long automated run. | Five numbered gates (`L0–L4`) pause the run at exactly the points Shape Up already treats as decisions — intake, orient, plan, verdict, ship — and refuse to auto-proceed without sign-off. |
| Tooling only works in one editor. | One source of truth (`skills/`, `commands/`, `hooks/`) compiles to a native Claude Code plugin, Cursor rules/extension, and Antigravity subagents — install once, evolve locally per project. |

The recurring design move, visible in almost every mechanism in this document, is turning a
**prompted convention into a mechanically enforced precondition**: a hook that denies a tool
call instead of a sentence asking the model not to make it. That substitution — "the model
promises" → "the script refuses" — is the harness's actual product.

---
[← Back to index](README.md) · [Next: High-Level Design →](02-high-level-design.md)
