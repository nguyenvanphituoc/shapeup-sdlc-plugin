# Insight Report — Market Position & Path to 500 Stars

- **Date:** 2026-07-25 · **Status updated:** 2026-07-26
- **Subject:** `nguyenvanphituoc/shapeup-sdlc-plugin` v1.3.0 (+ unreleased `main`)
- **Goal under analysis:** reach 500 GitHub stars
- **Method:** GitHub REST API metrics for 26 comparable repos, plus web research on the
  agent-skills / spec-driven-development (SDD) / harness landscape as of July 2026.

> **Status note (2026-07-26).** The analysis below is unchanged from 2026-07-25; only §6 (the
> fix list), §8 (the plan), and the §0 signal table carry live status. Of the 19 numbered P0–P2
> items, **12 are shipped** — five of seven P0s, six of seven P1s, and P2-2 — with two partial,
> one staged-but-unsent, and four untouched (P3 is ongoing and tracked separately). What has
> *not* happened is any outward-facing act: nothing submitted, nothing launched. The binding
> constraint has moved from P0-1 (ten minutes of repo settings) to **P0-6** (five submissions,
> human-authored by channel rule) and **P2-3** (Show HN). See §6 for the per-item table.

---

## 0. TL;DR — the finding that reframes the goal

**This is not a capability problem. It is an invisibility problem.**

The harness is, by architecture, in the top decile of rigor in this category. It has mechanisms
(schema-validated worker envelopes, single-writer state, mechanically-derived hill phase,
substrate write-sandboxes, covers-closure oracle) that **none** of the 100k-star projects have.

But as of today the repository has:

| Signal | At analysis (2026-07-25) | Now (2026-07-26) |
|---|---|---|
| Stars | **1** | **1** |
| Watchers | **0** | **0** |
| GitHub `description` | **null** | ✅ set |
| GitHub `topics` | **[]** (empty) | ✅ 20 topics incl. `shapeup` |
| `homepage` | **null** | ✅ set |
| Discussions | disabled | ✅ enabled |
| Unique visitors (14 d) | **5** | **4** |
| Unique cloners (14 d) | 21 (almost certainly self + CI) | unchanged in character |
| Referrers (14 d) | `github.com` (1 unique), `teams.cdn.office.net` (1) | unchanged |

Zero search surface, zero listings, zero launch. **Nobody has been given the chance to not-star
it.** Every hour spent on mechanism v1.4 before fixing the top of the funnel is an hour spent at
0× leverage.

**Update (2026-07-26):** the *search surface* half of that is now fixed — description, twenty
topics, homepage, Discussions, a rewritten README, a glossary, and a demo asset all shipped in
one day. The *distribution* half has not moved: still zero listings, zero launch, and the traffic
numbers are correspondingly flat. That is the expected shape — a fixed funnel with nothing poured
into it looks identical to a broken one. The diagnosis stands, and the next act is outward-facing
(§6, P0-6 → P2-3), not more building.

The good news is the target is well-chosen and reachable. See §2: the "Shape Up × coding agents"
niche has a **ceiling of 1,404 stars** today. 500 stars ≈ *becoming the definitive Shape Up
harness*, which is an open position — not a fight with `spec-kit`.

The second-order finding, unpacked in **§4**: the three mechanisms that make this project look
alien in a comparison table (typed worker envelope, single-writer state, deny-hook gates) are
one idea — *move the invariant out of the prompt and into the runtime* — and they are not equally
valuable. **One is a product, two are plumbing.** Gate enforcement is demoable, emotional, and
does not erode as models improve; the envelope is currently a net *tax* on adoption because users
meet it as vocabulary before they meet a benefit. The strategic consequence is that the
enforcement layer, not the Shape Up harness, is the thing to launch (§6, P2-2).

---

## 1. Landscape — verified numbers (GitHub API, 2026-07-25)

### Tier A — category-defining (100k+)

| Repo | Stars | Forks | Created | What it is |
|---|---:|---:|---|---|
| [obra/superpowers](https://github.com/obra/superpowers) | 260,682 | 23,254 | 2025-10 | Agentic **skills framework + methodology**: brainstorm → design → plan → TDD → review, with worktrees & subagents. Uses Cialdini persuasion framing to stop agents skipping steps. 787K installs. |
| [anthropics/skills](https://github.com/anthropics/skills) | 164,009 | 19,471 | 2025-09 | Official SKILL.md catalog / de-facto standard reference. |
| [github/spec-kit](https://github.com/github/spec-kit) | 123,692 | 11,039 | 2025-08 | `specify` CLI. **Spec → Plan → Tasks → Implement**, constitution, checklists, cross-artifact `analyze`. 35 agent integrations, 138 community extensions, 240+ contributors. |

### Tier B — major frameworks (20k–90k)

| Repo | Stars | Created | Thesis |
|---|---:|---|---|
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | 80,251 | 2026-02 | Celebrity-distribution "production-grade engineering skills". 80k in 5 months — *not replicable*, it is audience-led. |
| [ruvnet/ruflo](https://github.com/ruvnet/claude-flow) (ex claude-flow) | 65,860 | 2025-06 | Agent **meta-harness**: swarms, adaptive memory, self-learning, RAG. |
| [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) | 62,486 | 2025-08 | Minimalist **delta-spec** SDD, brownfield-first, plain markdown, "fluid not rigid". |
| [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | 51,097 | 2025-04 | Full simulated agile org: 21 agents, 50+ workflows, scale-adaptive lanes. |
| [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | 50,878 | 2025-04 | The list that gates community discovery. |
| [wshobson/agents](https://github.com/wshobson/agents) | 38,207 | 2025-07 | Multi-harness agentic plugin marketplace. |
| [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | 32,627 | 2025-11 | Official curated plugin directory (101 plugins: 33 Anthropic, 68 partner). |
| [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | 28,874 | 2025-10 | 1000+ curated skills, multi-agent. |
| [eyaltoledano/claude-task-master](https://github.com/eyaltoledano/claude-task-master) | 27,896 | 2025-03 | Task-management drop-in. **Not pushed since 2026-04** — the category churns. |
| [SuperClaude_Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework) | 23,592 | 2025-06 | Commands + cognitive personas config framework. |

### Tier C — the actual peer group (the useful comparison)

| Repo | Stars | Created | Why it matters here |
|---|---:|---|---|
| [buildermethods/agent-os](https://github.com/buildermethods/agent-os) | 5,117 | 2025-07 | Standards-injection + better specs. Stale since 2026-05. |
| [gotalab/cc-sdd](https://github.com/gotalab/cc-sdd) | 3,581 | 2025-07 | **Closest structural analogue.** Kiro-compatible SDD harness, 17 agent skills, 8 CLIs, per-task TDD + independent reviewer subagent, boundary annotations. `npx cc-sdd@latest`. |
| [disler/claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery) | 3,847 | 2025-07 | Single-concept teaching repo → 3.8k. Proof that *one legible idea* beats a broad system. |
| **[rjs/shaping-skills](https://github.com/rjs/shaping-skills)** | **1,404** | 2026-01 | **Ryan Singer's own shaping skills — this repo's credited inspiration, and the current ceiling of the Shape Up niche.** 8 pages of nothing but skills. |
| [anthropics/claude-plugins-community](https://github.com/anthropics/claude-plugins-community) | 312 | 2026-03 | Submission target (`clau.de/plugin-directory-submission`). |
| [cameronsjo/spec-compare](https://github.com/cameronsjo/spec-compare) | 92 | 2025-11 | 6-tool SDD comparison research. **Benchmark-as-content → 92 stars from a research repo.** |
| [basecamp/skills](https://github.com/basecamp/skills) | 54 | 2026-02 | Official Basecamp agent skills. |
| [sergiolindolfoferreira/shape-up-ai-native](https://github.com/sergiolindolfoferreira/shape-up-ai-native) | 30 | 2026-02 | "Shape Up reimagined for AI agents" — direct positional competitor, thin. |
| [dwarvesf/dwarves-kit](https://github.com/dwarvesf/dwarves-kit) | 7 | 2026-03 | Convergent-architecture peer (see `comparison-dwarves-kit.md`). |
| [onliminal/shapeup-skills](https://github.com/onliminal/shapeup-skills) | 3 | 2026-03 | Shape Up skills, abandoned-looking. |
| **this repo** | **1** | 2026-06 | — |

### The `shapeup` GitHub topic, in full

`fenbox/shapeup` 6 ★ · `RickCogley/aichaku` 6 ★ · `shapeitapp/shapeitapp` 3 ★ ·
`onliminal/shapeup-skills` 3 ★ · `searchspring/shapeup-scheduler` 1 ★.

**The topic is empty land.** A repo that claims and holds it starts from ~6★ competition.

---

## 2. Strategic read: which fight to pick

Two positioning options, and only one of them can produce 500 stars in a quarter.

**❌ Compete as "another SDD framework."** Head-on against spec-kit (124k, Microsoft-backed,
35 integrations, 138 extensions), OpenSpec (62k), BMAD (51k). The market is saturated at the
top and the differentiator you'd be selling — rigor — is what *every* entrant claims. New
entrants in this lane land at 3k (cc-sdd) after 12 months of work.

**✅ Own two uncontested positions simultaneously:**

1. **"The Shape Up harness for coding agents."** Category ceiling 1,404★ (rjs/shaping-skills),
   and that repo is *shaping only* — it stops at the pitch. This repo is the only project that
   carries Shape Up's actual **building** apparatus (appetite, betting table, hill charts,
   scope hammer, "QA is for the edges", baseline-not-ideal comparison) into a mechanized loop.
   Shape Up has a large, opinionated, evangelical audience that is currently unserved past
   the pitch. **This is the wedge.**
2. **"The verification layer that stops agents lying about done."** The single most-cited SDD
   failure in 2026 literature is: *"even with a detailed spec, agents occasionally ignore
   constraints… the spec improved the hit rate, but it did not guarantee compliance."* Every
   framework's answer to this is prose ("please follow the process"), including Superpowers,
   whose actual technique is *rhetorical persuasion*. This repo's answer is **mechanical**:
   a PreToolUse hook that hard-denies the EVAL delegation until the board is green, an
   envelope schema that denies malformed dispatches before a worker sees them, and a hill
   phase derived from T0 artifacts so it *cannot* be self-reported. That is a genuinely
   differentiated, demonstrable claim — and it is the one nobody else can copy in a weekend.
   Critically, this axis is **orthogonal** to the spec axis the leaders compete on, which means
   the play is composition rather than rivalry: ship it as a layer that installs *into*
   spec-kit / OpenSpec / Superpowers (§4.2, P2-2).

Tagline direction (pick one, use it everywhere — repo description, README H1, HN title):

> **Shape Up for coding agents — with gates the agent can't talk its way past.**

---

## 3. Head-to-head comparison

| Axis | this repo | spec-kit | OpenSpec | BMAD | cc-sdd | Superpowers |
|---|---|---|---|---|---|---|
| Methodology | **Shape Up** (appetite/betting/hill/hammer) | generic spec→plan→tasks | delta-specs | full agile org | Kiro SDD | brainstorm→TDD→review |
| Install | marketplace + bash installer + Playwright plugin + `npx playwright install` | `uv tool install specify-cli` | npx | npx installer | **`npx cc-sdd@latest`** | plugin install |
| Time-to-first-value | **unknown / high** | ~minutes | **~12 min to result** | 5.5 h to result | minutes | minutes |
| Slash commands exposed | **1** (`/ship`) | ~10 named phases | few | many | ~7 `kiro-*` | many |
| Agent CLIs | Claude Code (+ Codex/Antigravity/Cursor via `dist/`, unmarketed) | **35** | many | many | **8** | Claude-first |
| Worker interface | **typed JSON envelope, schema-validated, hook-denied** | markdown | markdown | markdown | markdown | markdown |
| Shared-state writes | **single writer (`ingest-result.mjs`)** | agent writes | agent writes | agent writes | agent writes | agent writes |
| Progress honesty | **derived from T0 artifacts (not self-reported)** | self-reported | self-reported | self-reported | reviewer subagent | persuasion prompts |
| Gate enforcement | **PreToolUse hooks that `deny`** | prompt + checklists | prompt | prompt | prompt | prompt |
| Parallel-write safety | **substrate write-whitelist hook + disjointness lint** | — | — | — | `_Boundary:_` annotations | worktrees |
| Retry bounding | **two-level circuit breaker** | — | — | — | auto-debug | — |
| Traceability | **covers-closure + wiring reachability oracle** | cross-artifact `analyze` | — | — | boundary/depends | — |
| Learning loop | **committed per-skill KB, human categorization gate** | — | — | retro | Implementation Notes | — |
| Brownfield | orient/spike (unmarketed) | weak (greenfield-tilted) | **strongest** | medium | strong | medium |
| Lightweight lane | **none** ⚠️ | `--minimal` presets | native | risk lanes | direct-impl route | skill-scoped |
| Proof / benchmarks | trigger-evals harness (honestly **unmeasured**) | community benchmarks | blog benchmarks | case studies | — | 787k installs |
| Docs surface | README + 2,045 lines internal design docs | **full docs site** | docs site | docs site | README | docs/ |
| Stars | 1 | 123,692 | 62,486 | 51,097 | 3,581 | 260,682 |

> **Reading the three enforcement rows.** *Worker interface*, *shared-state writes* and *gate
> enforcement* are the three cells where this project looks alien rather than better. They are
> not three features — they are one idea, and one of them is a product while two are plumbing.
> **§4 unpacks this**, including the honest caveat that single-writer is partly a solution to a
> problem this project chose to have (the others get write-safety for free by being
> single-threaded).

### Where this repo is objectively ahead of the 100k-star field

Each edge is stated with the failure it prevents. An edge without a named failure reads as
over-engineering, which is exactly how these currently land on a first-time reader.

1. **Mechanically-enforced worker contract.** WorkOrder-in/WorkResult-out, JSON-Schema
   validated, with a `PreToolUse` hook that denies a malformed dispatch *before* a worker runs.
   Everyone else's worker interface is prose in a markdown file.
   *Prevents:* a worker receiving a truncated task list after a compaction and silently
   building half the feature.
2. **Single-writer shared state.** One script (`ingest-result.mjs`) performs every board/ledger/
   verdict write. This structurally eliminates the state-corruption class that plagues
   multi-agent SDD tools.
   *Prevents:* two parallel executors both rewriting the board, and one's completions vanishing.
3. **Non-self-reported progress.** Hill phase derived only from T0/T1/seesaw facts. Directly
   kills the "agent claims done" failure the whole industry complains about.
   *Prevents:* the agent running EVAL on a half-green board and reporting PASS.
4. **Substrate sandbox.** Per-scope write whitelist enforced by hook + a disjointness lint —
   real parallel-safety, not an annotation convention.
5. **Two-level circuit breaker** with a graceful degrade (exhausted scope *queues a cut
   proposal* instead of blocking the round). Nobody else bounds retries at two granularities.
6. **Traceability spine.** Covers-closure + wiring reachability catches the "engine has zero
   call sites / feature built but never wired to the entry point" failure. This is a real,
   frequently-experienced pain with **no** competing solution in the top 10.
7. **Single-judge invariant + EVAL exactly once per round.** A token-cost discipline that
   directly answers the "BMAD costs $2,000/mo/dev" objection — if it were ever marketed.
8. **Honest evals.** A trigger-eval harness with cross-skill hard negatives that ships
   `status: "unmeasured"` and a CI test that *fails* if fabricated results appear. This level
   of intellectual honesty is rare and is itself a marketable artifact.

### Where it is objectively behind

| # | Gap | Evidence / consequence |
|---|---|---|
| G1 | **No discovery surface at all** | null description, no topics, no homepage, no listings, 5 unique visitors/14 d |
| G2 | **Time-to-first-value unknown and probably high** | 8 gates, 13 skills, bash installer, Playwright plugin + chromium prerequisite; competitors are one `npx` away from a result |
| G3 | **One slash command** | Users browse `/`-completion to learn a tool. `/ship` alone hides 13 skills; spec-kit's ~10 named commands *are* its onboarding |
| G4 | **Invented vocabulary, no glossary above the fold** | substrate, T0, seesaw, covers-closure, GATE L1a.5, hill shard, spine, envelope port, WorkOrder — README leads with mechanism, not outcome |
| G5 | **No proof artifact** | no demo GIF, no video, no before/after, no benchmark, no case study. Every competitor claims rigor; nobody is believed without evidence |
| G6 | **No lightweight lane** | the #1 documented SDD criticism is overhead ("12 min OpenSpec vs 5.5 h BMAD"). This harness *reads* BMAD-class. A one-file typo fix through 8 gates is absurd, and readers will assume that's the only mode |
| G7 | **Multi-CLI support built but unmarketed** | `dist/` already emits Cursor rules + Antigravity subagents; README buries it. Portability is the top install-decision axis in 2026 |
| G8 | **README is 322 lines and opens with install troubleshooting** | lines 45–150 are dependency errors and migration mechanics. An HN visitor gives ~30 s |
| G9 | **No trust signals** | plugin runs 7 node hooks; ecosystem is shifting hard to trust (36% of audited marketplace skills contain prompt injection; avg 6.3 security issues/skill). No `SECURITY.md`, no scan badge, no "what these hooks do and don't do" |
| G10 | **Solo-author bus factor, no contribution path** | 44 commits/1 author, no `CONTRIBUTING.md`, Discussions off, no issue templates, no `good first issue` |
| G11 | **Docs are internal-facing** | 2,045 lines of design docs written for the author (conformance audits, ERDs, plans) and ~0 lines of *user* narrative ("here's how I shipped feature X with this") |

---

## 4. The enforcement axis — why three cells look alien, and what to do about it

Three rows of §3 read as *different in kind* rather than *better in degree*: worker interface,
shared-state writes, gate enforcement. This section is the architectural read on them, because
how they are framed determines whether a first-time reader thinks "obviously right" or
"over-engineered."

### 4.1 They are one idea, not three features

All three are the same move: **take an invariant out of the prompt and put it in the runtime.**

| Invariant | Where the field keeps it | Where this repo keeps it |
|---|---|---|
| A worker receives well-formed context | prose in a markdown file | JSON Schema + a hook that denies |
| Shared state does not get corrupted | agent discipline / convention | one writer function |
| Phases happen in order | "please don't skip EVAL" | `deny` on the tool call |

None of this is novel computing — it is ports-and-adapters, a single-writer log, and a
reference monitor. It is novel *in this category*, where the state of the art is a firmer
instruction (Superpowers' actual anti-skip technique is Cialdini persuasion principles).

The framing that follows from this: **everyone else shipped a prompt pack; this project shipped
a control plane.** The column looks alien because it is not a better answer to their question —
it answers a different question.

### 4.2 Why nobody else does it — and why that is good news

The field is not behind. It made a different bet about the bottleneck:

- spec-kit / OpenSpec / BMAD bet on **intent capture** — get the spec right and the agent will
  mostly comply.
- this repo bets on **compliance** — the spec is fine, the agent lies about what it did.

The published evidence supports both: *"the spec improved the hit rate, but it did not guarantee
compliance."* Spec-first raises the floor; enforcement raises the ceiling. They are
complements, not substitutes.

That is the strategic payoff: **this project sits on an orthogonal axis, so composition beats
competition.** A spec-kit user does not have to abandon spec-kit to want a hook that denies a
premature EVAL. Competing with a 124k-star project is a fight; being the layer underneath it is
a distribution channel. This is the architectural justification for **P2-2**, and the reason
it is re-ranked as the highest-ceiling item in §6.

### 4.3 The asymmetry — one is a product, two are plumbing

§3 presents all three as wins. They are not the same kind of thing:

| Mechanism | Visible to a user? | Marketing value | Engineering value |
|---|---|---|---|
| Gate enforcement (`deny`) | yes — inside 10 seconds | **high** — demoable, emotional, one frame of video | high |
| Single-writer state | no | ~zero | high |
| Typed envelope | only as complexity | **negative today** | high |

Users experience the deny hook. They never experience single-writer state — they experience the
*absence* of corruption bugs they never knew were coming. And they experience the envelope as
vocabulary they must learn before they are permitted to understand the README.

**Consequence:** lead with enforcement; let the other two be the reason enforcement is
trustworthy, mentioned once rather than as three co-equal headline features. Today `AGENTS.md`
opens on the envelope — that is leading with the plumbing.

### 4.4 The costs, stated plainly

| Choice | Cost |
|---|---|
| **Typed envelope** | An **extensibility tax.** Adding a skill to Superpowers is dropping a markdown file; adding a worker here means learning a schema. spec-kit has 138 community extensions; this project's extension cost is "read `domain.schema.json`." Compounds with bus-factor 1 (G10). |
| **Single writer** | A **contribution bottleneck.** Every new class of shared fact routes through `ingest-result.mjs` — i.e. through one person. It also resists piecemeal use: you cannot run just the evaluator, because state application lives in the orchestrator. dwarves-kit's `bash lib/board/board.sh --help` working with zero install is a real advantage traded away. |
| **Deny hooks** | The **least portable** of the three. Hooks are per-CLI, so the strongest differentiator does not travel to the Cursor / Codex / Antigravity targets (G7). Every false-deny is a rage-quit, and 7 `PreToolUse` hooks is a security-review surface — which is why `SECURITY.md` (P1-6) protects the headline feature rather than being hygiene. |

**One correction to §3's framing.** Single-writer is *partly a solution to a problem this
project chose to have.* The others get write-safety free by being single-threaded; this harness
needs it because it parallelizes scopes. It remains a genuine win against compaction/resume
corruption — which is universal — but stated as a bare axis it flatters this repo, and a sharp
reader will notice.

### 4.5 Where "alien" turns into a liability

Differentiation without a named failure reads as over-engineering. When one column says
*"typed JSON envelope, schema-validated, hook-denied"* and the rest say *"markdown,"* the
skeptic's first thought is not "impressive" — it is **"why would that need all that?"**

Each cell needs its failure welded on (now done in §3):

| Mechanism | The failure it prevents |
|---|---|
| Typed envelope | a worker got a truncated task list after a compaction and silently built half the feature |
| Single writer | two parallel executors both rewrote the board; one's completions vanished |
| Deny hook | the agent ran EVAL on a half-green board and reported PASS |

With the story attached, "alien" becomes "obvious in hindsight." This is a README-and-table
fix, not an architecture fix — filed as **P0-7** in §6.

### 4.6 Verdict, and which mechanism ages well

Gate enforcement and single-writer: **right, keep, defend.** The typed envelope: right in
principle, **priced wrong** — it should be an invisible implementation detail, not a concept a
user must learn. The acceptance test: *can someone use this harness productively without ever
hearing the word "WorkOrder"?* Today, no. That should be yes.

The durability argument decides which one to bet the project on:

- The **envelope** encodes the assumption *"workers are unreliable at reconstructing context."*
  Models keep getting better at exactly that, so the assumption erodes.
- The **deny hook** encodes *"a model asked to report on its own work is motivated to claim
  success."* That is about incentives, not capability — it does not erode at all.

**The moat is the enforcement layer. The envelope is plumbing that makes it trustworthy. Market
accordingly.**

---

## 5. Growth analytics — what actually moves stars in this category

From the research (see Sources):

- **87%** of repos that reached 10k stars **launched on Hacker News first**, then cross-posted.
- HN exposure yields on average **+121 stars in 24 h, +189 in 48 h, +289 in a week**; a
  front-page *Show HN* commonly delivers hundreds in a day.
- Optimal *Show HN* window: **US Tue–Thu, 08:00–10:00 ET**.
- With active promotion, **0 → 1,000 stars in 1–3 months is realistic** for a genuinely useful
  OSS dev tool.
- Reddit posts framed *"I built this to solve X, feedback welcome"* survive moderation; plain
  promotion does not.
- Distribution channels that exist today and cost nothing: Anthropic **community plugin
  marketplace** (`clau.de/plugin-directory-submission`), the **official** directory (curated,
  Anthropic's discretion, ~days review), **awesome-claude-code** (web-UI issue form only, no
  PRs, no star minimum, discretionary), **VoltAgent/awesome-agent-skills**, **skills.sh**,
  **agentskills.io showcase**, **claudemarketplaces.com** (2,500+ marketplaces registered),
  **tonsofskills.com**, **claudepluginhub.com**.
- Ecosystem quality bar is *low* and buyers know it: average public skill scores **6.2/12**;
  curated skills raise task pass rates by **+16.2 pp**; focused 2–3-skill sets beat monoliths
  by **18.6 pp**. → **A credible quality/benchmark claim is the scarcest asset in the market,
  and this repo is unusually close to being able to make one honestly.**

**Star model for 500:**

| Source | Realistic contribution |
|---|---:|
| One good *Show HN* (front page, not necessarily #1) | 150–350 |
| awesome-claude-code + VoltAgent listing | 40–120 |
| Anthropic community marketplace + plugin hubs | 30–100 |
| r/ClaudeAI + r/ClaudeCode + r/programming posts | 40–120 |
| Shape Up community (37signals orbit, X, Ryan Singer's audience) | 30–100 |
| Benchmark/comparison content ("I benchmarked 6 SDD harnesses") | 50–200 |
| Topics + description + SEO long tail | 20–60 |

Any two of these land 500. **None of them can fire while the description is null.**

---

## 6. Prioritized fix list

Ranked by (impact ÷ effort). P0 items are gating — nothing downstream works without them.
Two items are re-ranked by §4: **P0-7** is new (framing), and **P2-2** is now the
highest-ceiling item in the list rather than a week-5 nice-to-have.

**Status legend:** ✅ shipped · 🟡 partial (what's missing is named) · ⏳ staged, not fired ·
⬜ not started. Status verified against `main` and the GitHub API on **2026-07-26**.

**Scoreboard (P0–P2, 19 items): 12 ✅ · 2 🟡 · 1 ⏳ · 4 ⬜.** Everything a solo author can do
alone, in a repository, is done. Every remaining item requires either an outward-facing send
(P0-6, P2-3, P2-4, P2-5) or measurement against other people's tools (P1-4, P2-1). P3 is ongoing
and scored separately below.

### P0 — Unblock the funnel (hours, not days; do before any code)

| # | Status | Action | Why | Effort |
|---|---|---|---|---|
| **P0-1** | ✅ | Set GitHub **description** + **20 topics** (`claude-code`, `claude-code-plugin`, `agent-skills`, `skill`, `spec-driven-development`, `shape-up`, `shapeup`, `ai-agents`, `sdlc`, `agentic-workflow`, `tdd`, `claude`, `codex`, `cursor`, `llm-harness`, `orchestration`, `hooks`, `mcp`, `developer-tools`, `basecamp`) + **homepage** | Literally zero search surface today. Topics are the primary in-GitHub discovery path and `shapeup` is uncontested land (top competitor 6★) | 10 min |
| **P0-2** | ✅ | Enable **Discussions**, add `CONTRIBUTING.md`, issue templates, 5 `good first issue`s | Bus-factor-1 + no contribution path reads as abandoned-in-waiting | 1 h |
| **P0-3** | ✅ | **Rewrite README top 40 lines**: one-sentence value prop → 15-line "what it does to your agent" → 3-command quickstart → animated demo → *then* everything else. Move install-troubleshooting, migration, and layout to `docs/` | 30-second budget; currently lines 45–150 are dependency errors | 2 h |
| **P0-4** | 🟡 | Add a **60-second demo asset** (asciinema/GIF: raw idea → gate → build → FAIL verdict → fix → PASS). Show the hook **denying** a premature EVAL — that single frame *is* the product | Only unfakeable proof; every competitor has one | 3 h |
| **P0-5** | ✅ | **Glossary above the fold** — a 12-row table mapping invented terms to plain English (substrate → "files this scope may write"; T0 → "the smoke test that must pass before a scope counts"; hill → "how much is still unknown") | G4; vocabulary is the single biggest comprehension tax | 1 h |
| **P0-6** | ⏳ | Submit to **awesome-claude-code** (web issue form), **Anthropic community marketplace**, **VoltAgent/awesome-agent-skills**, **claudemarketplaces.com**, **claudepluginhub.com** | Free, compounding, days of latency — start the clock now | 2 h |
| **P0-7** | ✅ | **Reframe the three enforcement mechanisms** (§4): weld the failure story onto each, lead with the deny hook, demote the envelope to an implementation detail — including in `AGENTS.md`, which currently opens on it | §4.3/4.5. Differentiation without a named failure reads as over-engineering; today the strongest asset (enforcement) is buried under the most costly one (vocabulary) | 2 h |

**P0 status detail.**

- **P0-4 🟡** — the *money frame* shipped: `docs/assets/demo-gate.svg`, regenerated by
  `scripts/demo/record-demo.mjs`, which runs the real `hooks/gate-l2.mjs` and fails rather than
  draw a picture. That is better than a GIF on the honesty axis and it is the frame the report
  called "the product." What is still missing is the *narrative* asset the item asked for — the
  full idea → gate → build → FAIL → fix → PASS run. Close it before P2-3; a Show HN thread wants
  motion.
- **P0-6 ⏳ — this is now the binding constraint.** `docs/launch/submissions.md` holds
  channel-verified copy for all five, and the sent log is empty. It stayed unsent on purpose:
  awesome-claude-code requires a human-authored recommendation, and the report itself says not to
  point reviewers at an unfinished README. Both preconditions are now met. One caveat worth
  clearing first: the shipped work sits on `main`, and the newest tag is still **v1.3.0
  (2026-07-24)** — cut a release so a reviewer arriving from a directory sees the anti-lying kit
  in a tagged version, then send.

### P1 — Reduce friction & prove value (1–2 weeks)

| # | Status | Action | Why | Effort |
|---|---|---|---|---|
| **P1-1** | ✅ | **`npx shapeup-sdlc init`** — one command, no Playwright prerequisite, no bash, works on Windows. Make Playwright a *lazy* dependency needed only when a `[ui]` criterion is actually evaluated | G2. cc-sdd's `npx cc-sdd@latest` is its single biggest adoption advantage over this repo. The current bash + `--yes` + chromium + plugin-dependency-troubleshooting path loses most first-time users at the door | 2–3 d |
| **P1-2** | ✅ | **Add a `tiny` lane** — `/ship --tiny` (or auto-detected by diff size): orient → build → T0 → done. Skip wiring, scope contracts, QA, coach. Document it in the README's second paragraph | G6, the #1 category objection. Also honest: an 8-gate pipeline for a typo is indefensible, and reviewers will assume it's the only mode. This turns the harness's biggest perceived liability into a "right-size the ceremony" feature (dwarves-kit already ships risk lanes) | 2–3 d |
| **P1-3** | ✅ | **Expose the workflow as named slash commands**: `/shape`, `/orient`, `/wire`, `/scopes`, `/build`, `/eval`, `/qa`, `/hammer`, `/retro` as thin wrappers over the skills | G3. Slash-completion is how users learn a plugin. spec-kit's phase commands *are* its docs. This is a 1-line-per-file change with outsized legibility payoff | 4 h |
| **P1-4** | 🟡 | **Run the trigger-evals for real** and publish measured TPR/FPR in the README with the method | The harness is already built and refuses to fabricate. A published, honestly-measured skill-activation number is something *no competitor has*, in a market where the average skill scores 6.2/12 | 1 d |
| **P1-5** | ✅ | **A `docs/quickstart.md` walkthrough on a real toy app** (`examples/todo-cli` exists — finish the narrative: every gate output verbatim, the FAIL round, the ledger, the ship summary) | G11. Converts "impressive architecture" into "I can picture using this" | 1 d |
| **P1-6** | ✅ | **`SECURITY.md` + "what the hooks do"** table: each of the 7 hooks, what it reads, what it can deny, what it never does; note that no hook phones home | G9. Trust is the ecosystem's 2026 axis; 7 node hooks in a PreToolUse position is a legitimate reviewer concern to pre-empt | 3 h |
| **P1-7** | ✅ | **Market the multi-CLI story** (`dist/` already emits Cursor rules + Antigravity subagents + Codex skills). Put an agent-support matrix in the README | G7. Portability is a top install-decision axis; you already paid for this feature and get no credit | 2 h |

**P1-4 status detail — half measured, and the honest half is the marketable one.**
The FPR side is done and is a real, quotable number: **0 false activations across 75 cross-skill
hard negatives** (Haiku 4.5, 2026-07-26), i.e. the thirteen skill descriptions do not steal each
other's work. The TPR side is measured but **confounded and deliberately not quoted**: the probes
run in this repo's own tree, so 38 of 74 positive cases name a referent the probe never supplies,
and a model that correctly asks for the missing input scores as a miss. Two open issues track the
fix ([#7](https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin/issues/7) fixture workspace,
[#12](https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin/issues/12) `solution-architect`
TPR 0.0). Risk 4 of §7 is being honored — three earlier baselines were discarded rather than
published — so this counts as a *partial that is behaving correctly*, not a slip.

### P2 — Differentiate & launch (weeks 3–5)

| # | Status | Action | Why |
|---|---|---|---|
| **P2-2** ⭐ | ✅ | **Extract "the anti-lying kit" as a standalone, adoptable sub-product**: `gate-l2`, `anti-rationalization`, `slop-cleaner`, `t0-verify`, mechanical hill derivation — installable *without* Shape Up, into any workflow (spec-kit, OpenSpec, Superpowers) | **Highest-ceiling item in the list** (re-ranked by §4.2). The enforcement axis is orthogonal to the spec axis, so composition beats competition: this rides the 100k-star repos instead of fighting them, and it is the one mechanism that does not erode as models improve (§4.6). `disler/claude-code-hooks-mastery` reached 3.8k on one legible idea; "hooks that stop your agent claiming done" is a far better Show HN than "an SDLC harness" |
| **P2-1** | ⬜ | **Publish the benchmark**: run the same 3 features through this harness / spec-kit / OpenSpec / cc-sdd; report wall-clock, tokens, first-pass verdict rate, and *escaped defects found by QA*. Ship as a repo (`spec-compare` got 92★ purely as research) | Benchmark-as-content is the highest-ROI content in this category, and the harness's *unique* metric (escaped defects, wiring reachability) is one where it should genuinely win |
| **P2-3** | ⬜ | **Show HN launch**, Tue–Thu 08:00–10:00 ET, title framing the problem not the framework — e.g. *"Show HN: I got tired of agents claiming 'done' — so I made gates they can't talk past"* | 87% of 10k-star repos launched here; expect +150–350 in week 1 |
| **P2-4** | ⬜ | **Shape Up community outreach**: post in the 37signals/Shape Up orbit; a courteous heads-up to Ryan Singer (`rjs/shaping-skills`, 1,404★, already credited) framed as *"I built the building half of your shaping skills"* | The single highest-intent audience that exists for this product, and the credit relationship is already in place |
| **P2-5** | ⬜ | **Submit to the official Anthropic directory** once P0/P1 are done (manifest spec compliance, no out-of-dir access, clear skill instructions, adequate README — all already checkable via `claude plugin validate --strict`) | Official listing is what took Superpowers from 57k → 224k. Curated, discretionary, days-long review |

**P2-2 status detail — built, not yet launched.** The kit ships at
`plugins/anti-lying-kit/` (three hooks, no methodology, its own README, installable alongside
spec-kit / OpenSpec / your own `tasks.md`) and the main README carries a "Just want the gate?"
callout. Two open `good first issue`s already exist against it
([#10](https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin/issues/10) board presets for BMAD
/ Task Master / Superpowers, [#11](https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin/issues/11)
a `doctor` command). **Its strategic value is entirely unrealized until P2-3 fires**, because the
whole argument of §4.2 is that this is the thing to *lead the launch with*. Building it and not
launching it captures none of the ceiling.

### P3 — Sustain (ongoing)

| # | Status | Action |
|---|---|---|
| P3-1 | 🟡 | Weekly cadence of small releases + a visible public roadmap (velocity is already excellent — 15 releases in 5 weeks — just make it legible). *Cadence held (v1.3.0 on 2026-07-24), but the P0/P1/P2-2 work is unreleased on `main` and there is still no public roadmap.* |
| P3-2 | ⬜ | Turn each internal design doc into one external blog post ("single-writer state in an agent harness", "why hill phase must be mechanical", "the orphaned-engine problem") |
| P3-3 | ⬜ | Answer every issue within 24 h for the first 90 days; convert 3 contributors. *Not yet exercised — every issue so far is self-filed; the clock starts at first external traffic.* |
| P3-4 | ⬜ | Track referrers weekly; double down on whichever channel actually converts. *Nothing to track until P0-6 sends.* |

### What to do next, in order

1. **Cut a release** off `main` so a directory reviewer lands on a tagged version containing the
   anti-lying kit (unblocks P0-6 and P2-5).
2. **P0-6 — send the five submissions** by hand. Days of latency; every day unsent is a day the
   compounding does not start.
3. **P0-4 — finish the narrative demo**, and **P1-4 — de-confound the TPR probes**
   (issues #7/#12). These are the two assets the launch post will be judged on.
4. **P2-3 — Show HN**, led by the anti-lying kit rather than the SDLC harness, per §4.2.
   Not before step 3: §7's risk 3 is that HN traffic does not come back.

---

## 7. Honest risks

1. **Complexity is the real product risk, not marketing.** 13 skills, 8 gates, 3,112 lines of
   SKILL.md, 7 hooks, ~26k LOC. The market's stated preference in 2026 is *lighter*
   (OpenSpec 62k on minimalism vs BMAD 51k on maximalism, and the 12-min-vs-5.5-h datapoint is
   the most-quoted line in every comparison article). P1-2 (`tiny` lane) is not a nice-to-have;
   without it the harness is legible only to the person who built it.
2. **Attribution risk.** The Shape Up wedge depends on 37signals goodwill. The existing credit
   to `rjs/shaping-skills` and Basecamp is correct and prominent — keep it that way, and reach
   out *before* launching rather than after.
3. **A launch on a repo with an unfinished quickstart burns the one shot.** HN traffic does not
   come back. Do not fire P2-3 until P0 and P1-1/P1-2/P1-5 are shipped and a stranger has
   completed the quickstart successfully.
4. **The trigger-eval integrity is an asset — do not spend it.** The temptation at launch will
   be to publish a flattering number. The CI test that fails on fabricated results is the most
   trustworthy thing in this repository; publishing a mediocre-but-real number will do more for
   credibility than a great fake one.
5. **The envelope's extensibility tax is the quietest risk of the five (§4.4).** A control plane
   that only its author can extend cannot accumulate contributors, and contributors are how
   every project in §1's Tier A/B got there. If the envelope stays a *documented user-facing
   concept* rather than an internal detail, the ceiling is however much one person can build.

---

## 8. The 6-week plan

| Week | Focus | Exit condition | Status |
|---|---|---|---|
| 1 | P0 (all seven) | Repo has description, topics, homepage, discussions, a 40-line README top, demo GIF, glossary; the three enforcement mechanisms reframed with their failure stories; submitted to 5 directories | 🟡 all but the demo narrative (P0-4) and the sends (P0-6) |
| 2 | P1-1, P1-3 | `npx shapeup-sdlc init` works on a clean machine (incl. Windows); 9 named slash commands | ✅ |
| 3 | **P2-2**, P1-2 | "Anti-lying kit" installable standalone into spec-kit / OpenSpec / Superpowers (pulled forward from week 5 — §4.2); `--tiny` lane | ✅ |
| 4 | P1-5, P1-6, P1-7 | Quickstart a stranger can finish; SECURITY.md; agent-support matrix | ✅ (not yet read by a stranger) |
| 5 | P1-4, P2-1 | Measured trigger-eval numbers published; benchmark repo live | 🟡 FPR published, TPR confounded; benchmark ⬜ |
| 6 | P2-3, P2-4, P2-5 | Show HN (led by the anti-lying kit, not the SDLC harness) + Reddit + Shape Up outreach + official directory submission | ⬜ |

**Six weeks of plan executed in roughly two days.** That is the honest read of the table above:
weeks 1–4 are substantially done, and week 5 is half done. The compression is real but it is
entirely on the *building* axis — which is the axis this report opened by saying was never the
constraint. The one week that matters most, week 6, is untouched.

**Expected trajectory:** 1 → ~80 (P0 + listings, weeks 1–3) → ~400–700 (launch week 6). 500 is
achievable inside a quarter. The binding constraint *was* P0-1, which took ten minutes and is
done; **it is now P0-6 → P2-3** — five submissions plus one launch post, none of which a build
round can substitute for. Stars are still 1, and will stay 1 until something is sent.

---

## Sources

- [github/spec-kit](https://github.com/github/spec-kit) · [Spec Kit docs](https://github.github.com/spec-kit/)
- [obra/superpowers](https://github.com/obra/superpowers)
- [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
- [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)
- [gotalab/cc-sdd](https://github.com/gotalab/cc-sdd)
- [rjs/shaping-skills](https://github.com/rjs/shaping-skills)
- [cameronsjo/spec-compare](https://github.com/cameronsjo/spec-compare)
- [Agentic Skills Frameworks Compared — Ry Walker](https://rywalker.com/research/agentic-skills-frameworks)
- [The Agent Skills Ecosystem in 2026 — Agentman](https://agentman.ai/blog/agent-skills-ecosystem-report-2026)
- [BMAD vs Spec Kit vs OpenSpec — Reenbit](https://medium.com/@reenbit/bmad-vs-spec-kit-vs-openspec-choosing-your-spec-driven-ai-framework-in-2026-a6996b3ebb8d)
- [Spec-Driven Development: OpenSpec vs Spec-Kit vs BMAD — nosam](https://www.nosam.com/spec-driven-development-openspec-vs-spec-kit-vs-bmad-which-ones-actually-worth-your-time/)
- [Spec-Driven Development in 2026 — DEV](https://dev.to/krlz/spec-driven-development-in-2026-what-it-is-the-tooling-and-how-teams-actually-use-it-2fk2)
- [Spec-Driven Development, What I Wish I Knew — Medium](https://medium.com/@tojosphine/spec-driven-development-what-i-wish-i-knew-before-i-started-1213d485a244)
- [Discover and install prebuilt plugins — Claude Code Docs](https://code.claude.com/docs/en/discover-plugins)
- [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) · [claude-plugins-community](https://github.com/anthropics/claude-plugins-community)
- [awesome-claude-code CONTRIBUTING](https://github.com/hesreallyhim/awesome-claude-code/blob/main/CONTRIBUTING.md)
- [Launch-Day Diffusion: Tracking Hacker News Impact on GitHub Stars for AI Tools — arXiv 2511.04453](https://arxiv.org/html/2511.04453v1)
- [I Analyzed 50 GitHub Repos That Went From 0 to 10K Stars — DEV](https://dev.to/0012303/i-analyzed-50-github-repos-that-went-from-0-to-10k-stars-here-are-the-7-patterns-54o1)
- [How to Get Your First 1,000 GitHub Stars — DEV](https://dev.to/iris1031/how-to-get-your-first-1000-github-stars-the-complete-open-source-growth-guide-4367)
- [Best Claude Code Skills — Firecrawl](https://www.firecrawl.dev/blog/best-claude-code-skills)
- GitHub REST API (`/repos/*`, `/traffic/*`), retrieved 2026-07-25
