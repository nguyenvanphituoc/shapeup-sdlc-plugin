# 01 — Should v4 build a harness at all, or lean on the vendor's tools?

| | |
|---|---|
| **Date** | 2026-11-06 |
| **Baseline** | 3.18.4 |
| **Status** | draft — external input, not yet checked against this repo |
| **Origin** | A five-angle rebuttal of the statement *"don't build a harness, use the tools"*, supplied by the maintainer. Translated from Vietnamese; figures are kept as the source gave them. |

## Question

The statement under test: *"There is no need to build a harness — use the vendor's tools."* Where
does it hold, where does it fail, and which parts of this plugin sit on which side of that line?

## Evidence

**This is external input.** No command in this repo re-runs it, and most figures come from
third-party or vendor blogs. Read every number below as a direction, not a settled value, and as
one that predates any check made here. Cost figures are estimates.

### Where the statement is right

All five angles concede these:

- A vendor's harness is tuned continuously on real traffic. Cursor runs A/B tests and per-model
  evals that a small team cannot keep pace with.
- A thick harness expires with the model. Anthropic removes parts of its own: Opus 4.5 no longer
  needed context resets, Opus 4.6 no longer needed sprint decomposition.
- Under the Bitter Lesson, routers, fixed pipelines and step-forcing prompts tend to be absorbed
  by the model over time.

### The five rebuttals

| Angle | Core argument | Headline evidence (as claimed by the source) |
|---|---|---|
| **Architecture** | Lock-in does not disappear; it moves from the model to the harness. A vendor optimizes for "writing code in general" and does not know Shape Up, RLS, or your PO gate. Vendors change behavior silently on update. | The cost of leaving sits in the harness, where context and tool integrations accumulate. |
| **Security** | Permissions on a customer's cloud, DB and CI are outside a vendor's scope. The vendor's audit log lives on the vendor's infrastructure. Contracts assign liability to your company. | PocketOS (2026-04): Cursor running Opus 4.6 deleted a production DB and its backup in 9 seconds. CVE-2026-26268 (CVSS 9.9): RCE in Cursor on opening a malicious repo. |
| **Economics and operations** | Unattended runs need hard budgets, timeouts, checkpoint/resume and evals over time. Packaged tools do not do this for you. | GPT-4o: 61% pass@1 but 25% pass@8 on τ-bench. "Meltdown" rate up to 19% on the strongest model. |
| **Evaluation and ML** | The harness drives most of the score. A model grading its own work is biased, so the evaluator must be separate. | Terminal-Bench 2.0: +13.7 points from the harness alone. Changing the harness moves scores 8.5–13 points; changing the model moves them 2.5–5. Retro game maker: solo ≈ $9 did not run, full harness ≈ $200 did. |
| **Organization and process** | A vendor knows "code runs, tests pass" — not your definition of done or your acceptance chain. Domain knowledge, onboarding and handover traceability must be encoded. | DORA 2025: AI is an amplifier, so a weak organization multiplies its errors. METR: experienced developers ~19% slower while feeling faster. |

### A subtle point: "use the vendor's harness" is itself a harness choice

Same model, different scaffold: Sonnet 4.5 dropped from 68% to 34% on HAL. So "just use the
vendor's harness" needs measuring too, not defaulting to.

### Reliability of this evidence

- Many benchmark figures come from third parties or vendor blogs — a direction, not a final number.
- The organization-angle agent saw only titles and URLs and did not open each page. Its DORA, Stack
  Overflow and METR figures must be cross-checked before they enter any formal document.
- The EU AI Act section (logging for agents) and the sources on multi-tool `SKILL.md` were not read
  directly.
- The pilot on "a stronger judge still falls for the mirage" used one model and three repetitions;
  its authors call it preliminary.

## Finding

The statement is right at the **execution** layer and wrong if it means "do nothing more". All five
angles land on the same line: **rent the core** and **own a thin layer**.

| Rent (do not build) | Own (the thin layer) |
|---|---|
| Agent loop, file-edit and shell tools, context compaction | The definition of "done", evaluator criteria, PO gates |
| Per-model tuning | Layered permissions, approval gates for irreversible actions, an immutable audit log |
| Raw model capability | Spec, ledger and state as Markdown files in the repo |
| | Internal regression evals, cost tracking and pass^k |

The thin layer can be built from the tools' own mechanisms: `CLAUDE.md` / `AGENTS.md` for the
domain glossary, skills for process, hooks to enforce hard gates, subagents to separate planner,
generator and judge, MCP to reach the tracker and CI.

**The practical rule the source proposes:** every component added on top of the tool should justify
itself with an ablation run — with and without it. After each model or tool upgrade, re-run and
remove what no longer contributes. That is fair to both sides: no needless building, and no
discarding what only your organization knows.

## Candidate requirements

*(none yet.)* The source argues a position; it does not name a change to this plugin. The
questions below are what it turns into once read against 3.18.4, each to be answered by its own
analysis file before any row is written to `../requirements.md`.

1. **Which parts of this plugin sit in the "rent" column?** The plugin ships hooks, skills, a
   kernel and gates. Which of those re-implements what the host tool now does itself, and would a
   v4 be thinner without them? Derive the list from the filesystem and the hook registry, not from
   the docs.
2. **Does any component here have an ablation on record?** The source's rule is "with and without".
   Whether this repo can show that for a hook, a gate or a worker skill is a question about
   artifacts to be answered by looking, not assumed either way.
3. **Does the plugin measure what the source says an unattended run needs?** Budgets and breaker
   trips already exist as run records; pass^k across repeated runs and per-run cost are the two
   the source names that need checking against what the export tables actually hold.
4. **Is the "own" column complete?** The source lists an immutable audit log and approval gates for
   irreversible actions. Check by reading and exercising the hooks what the decision ledger
   actually guarantees against being rewritten — "append-only by convention" and "immutable" are
   different claims — before asserting either.

## What would change this answer

- A **first-party** measurement — on this plugin, with a named model and date — showing a component
  adds nothing. That outranks every third-party figure above.
- The unverified figures failing cross-check. The Finding rests on the *shape* of the argument
  (execution is rentable, definition-of-done is not); if the DORA, METR or benchmark numbers
  collapse, the shape survives only if the architecture and security angles stand on their own.
- The vendor's harness gaining a first-class, user-defined gate and evaluator separation. That
  would move "definition of done" from the "own" column toward "rent".

## Sources

As listed by the source; none has been opened from this repo.

- [Cursor: continually improving agent harness](https://cursor.com/blog/continually-improving-agent-harness)
- [Waehner: AI agent harness and vendor lock-in](https://www.kai-waehner.de/blog/2026/09/01/the-ai-agent-harness-where-vendor-lock-in-went-after-the-model-became-swappable/)
- [Arize: Own the loop](https://arize.com/blog/own-the-loop-field-guide-agent-harnesses/)
- [TechSpot: the PocketOS incident](https://www.techspot.com/news/112207-ai-coding-agent-running-claude-wiped-startup-database.html)
- [Claude Code issue #45200](https://github.com/anthropics/claude-code/issues/45200)
- [Cursor CVE and Comment and Control](https://codex.danielvaughan.com/2026/05/02/spring-2026-ai-coding-agent-vulnerabilities-cursor-rce-comment-control-codex-cli-defence/)
- [Anthropic: managed agents](https://anthropic.com/engineering/managed-agents)
- [Anthropic: harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [arXiv 2603.29231 (agent reliability)](https://arxiv.org/html/2603.29231v1)
- [arXiv 2605.23950 (harness vs. model)](https://arxiv.org/html/2605.23950)
- [arXiv 2404.13076 (self-preference)](https://arxiv.org/pdf/2404.13076v1)
- [arXiv 2607.25152 (judge pilot)](https://arxiv.org/pdf/2607.25152)
- [Traversal: agent architecture mistakes](https://www.traversal.com/blog/ai-agent-architecture-mistakes)
- [DORA 2025](https://dora.dev/dora-report-2025/)
- [Stack Overflow Developer Survey 2025](https://stackoverflow.blog/2025/07/29/developers-remain-willing-but-reluctant-to-use-ai-the-2025-developer-survey-results-are-here)
- [InfoWorld: the METR study](https://www.infoworld.com/article/4020931/ai-coding-tools-can-slow-down-seasoned-developers-by-19.html)
- [Atlas Cloud: token cost](https://www.atlascloud.ai/blog/guides/reduce-ai-coding-token-cost)
