# Addendum §3.7 + Blueprint F — Storage Architecture & File Organization

| | |
|---|---|
| **Document** | Addendum to Design Specification v1.1, **revision 2** (becomes §3.7 and Blueprint F in v1.2) |
| **Motivation** | v1.1 declared "files in repo — the only shared memory" but never separated what earns a commit from what must stay local; three v1.1 placements turn out to be wrong under analysis |
| **Revision 2** | Tier C converted from machine-level to **project-local per-member config** (gitignored files inside the checkout, with committed templates), leaving only a small machine-level residue (Tier C′) for binaries the project can reference but not contain |
| **Status** | Draft for review |

---

## F.1 Placement criteria

Every artifact in the harness is placed by five questions, applied in order:

| # | Question | If yes → |
|---|---|---|
| C1 | Is it a secret, credential, or personal preference? | **Tier C** (project-local, gitignored, per member), always — with a committed `*.example` template in Tier A |
| C2 | Is it fully derivable from committed inputs (regenerable at will)? | **Tier B** (runtime) — committing derived data creates drift between the artifact and its source of truth |
| C3 | Does another human, another machine, or a *future round* need it to reproduce a decision? | **Tier A** (committed) — decisions and evidence summaries are team memory |
| C4 | Would two teammates writing it concurrently corrupt it? | Tier A only if **sharded** (one file per unit) or **single-writer** (one role owns it) |
| C5 | Is it bulky evidence (logs, traces, video) whose *conclusion* matters but whose *body* doesn't? | Body → Tier B; a hash + summary promotes to Tier A |

The litmus phrase: **commit decisions and contracts; regenerate renders and evidence; never commit anything a `git clone` + `install-harness.sh` + one run cannot rebuild.**

## F.2 The three tiers

### Tier A — Repo, committed (team memory)

Durable, reviewable, merge-conscious. Single-writer per file, sharded per unit where concurrency is possible.

```
project-root/
├─ docs/shapeup-sdlc/
│  ├─ pitches/<cycle-id>/
│  │  ├─ pitch.md                    # bet artifact (shaping output)
│  │  ├─ baseline.md                 # GATE H comparator — first-class, not a pitch footnote
│  │  └─ shaping/                    # framing.md, breadboard.md
│  ├─ cycles/<cycle-id>/             # one directory per run/cycle
│  │  ├─ round-ledger.md             # decisions, escalation answers, model matrix, budgets
│  │  ├─ scopes/<scope-id>.json      # scope contracts  ← MOVED from .harness/ (see F.4-Δ1)
│  │  ├─ tasks/TASK-NNN.md           # ba output specs (+ AC checkboxes)
│  │  ├─ hill/<scope-id>.yml         # per-scope hill shard  ← REPLACES monolith (F.4-Δ2)
│  │  ├─ hill-chart.md               # derived render, regenerated at every L2 commit
│  │  ├─ eval/EVAL-r<N>.md           # judge reports; cite T0 artifact by hash
│  │  └─ ship-report.md              # GATE H cut list + GATE L4 deploy evidence
│  ├─ knowledge-base/<skill>.md      # /coach rules, per skill (existing, unchanged)
│  └─ metrics/<machine-id>.jsonl     # telemetry shards  ← REPLACES single file (F.4-Δ3)
├─ discovery/ledger.md               # append-only task ledger (existing location kept)
├─ fixtures/<scope-id>.spec.ts       # T0 e2e fixtures — they are tests, tests are code
└─ .claude/settings.json             # team defaults: SHAPEUP_* env, plugin enablement
```

### Tier B — `.shapeup-sdlc/` in-repo, gitignored (runtime working memory)

Everything here is rebuildable; `rm -rf .shapeup-sdlc/` (or `/ship --clean`) must never lose a decision.

```
.shapeup-sdlc/
├─ run.lock                          # {machine-id, pid, cycle, started} — one run per checkout
├─ active-scope                      # pointer read by the PreToolUse sandbox hook
├─ briefs/r<N>-a<M>.md               # generated zero-memory handoff briefs (derived from
│                                    #   contract + substrate + ledger — never hand-edited)
├─ t0/
│  ├─ verdicts/r<N>-a<M>.json        # machine verdict: green|red per fixture + DB probe
│  ├─ logs/                          # raw playwright/build/test output (digester input)
│  └─ traces/                        # screenshots, videos, HAR — bulky evidence bodies
├─ digests/r<N>-a<M>.json            # AEGIS {file, line, core_message} triples,
│                                    #   pre-promotion staging for discovery/ledger.md
├─ seesaw/registry.json              # cache of FINISHED-scope fixture list — rebuildable
│                                    #   by scanning committed contracts where phase=FINISHED
└─ tmp/
```

### Tier C — Project-local, per member (inside the checkout, gitignored, never committed)

Every member's personal configuration lives *inside the project directory*, so it travels with the checkout, is discoverable next to the team defaults it overrides, and is validated by the harness at L0 — while staying out of git.

```
project-root/
├─ .claude/
│  ├─ settings.json                  # Tier A — committed team defaults (SHAPEUP_* env)
│  ├─ settings.local.json            # Tier C — per-member overrides; Claude Code natively
│  │                                 #   merges this over settings.json and gitignores it
│  └─ settings.local.example.json    # Tier A — committed template: every overridable key
│                                    #   with its default and a one-line comment
├─ .env.local                        # Tier C — per-member secrets for the T0 DB probe
│                                    #   (connection strings, API keys); gitignored
└─ .env.example                      # Tier A — committed template listing required keys
```

Example `settings.local.json` for a member on a budget plan who also runs a personal DB port:

```json
{
  "env": {
    "SHAPEUP_ORCH_MODEL": "sonnet",
    "SHAPEUP_QA_MODEL": "haiku",
    "SHAPEUP_ATTEMPT_BUDGET": "3"
  }
}
```

**Config resolution chain** (replaces spec §4.4's three layers with four; resolved once at GATE L0.5 and recorded in the ledger header):

```
/ship flags                          # highest — this run only
  → .claude/settings.local.json      # this member, this project
    → .claude/settings.json          # the team, this project (committed)
      → agents/*.md frontmatter      # plugin-shipped defaults
```

**Onboarding = copy + fill**: `cp .claude/settings.local.example.json .claude/settings.local.json && cp .env.example .env.local`, edit values, run `/ship` — GATE L0 validates the merged config against the template's key set and fails fast with a per-key report (missing DB credential, unknown SHAPEUP_ key, model not available on the member's plan → degrade rule R2 applies).

### Tier C′ — Machine-level residue (the irreducible remainder)

Two things cannot live in the project because they are shared binaries/caches by nature; the project *references* them but does not contain them:

```
~/.claude/plugins/…                  # plugin install + marketplace cache — Claude Code managed;
                                     #   the project pins the reference via committed
                                     #   extraKnownMarketplaces + enabledPlugins in settings.json
~/.cache/ms-playwright/              # browser binaries — default machine cache; teams wanting a
                                     #   fully project-contained toolchain may set
                                     #   PLAYWRIGHT_BROWSERS_PATH=.shapeup-sdlc/browsers in
                                     #   settings.json (trade-off: per-project duplication)
```

Tier C's rule is absolute in *both* directions: nothing from C or C′ enters git, and nothing committed may depend on a value that exists only in one member's local files — that's what `settings.json` team defaults and the committed `*.example` templates are for. The L0 fail-fast check is what makes the rule testable: a fresh clone with only templates copied must reach GATE L1 or die at L0 with an actionable list.

## F.3 Promotion protocol — when local becomes shared

Local state crosses into team memory only at gate moments, by the orchestrator, as part of the gate's code path (enforcement class (a)):

| Moment | Promotion | Form |
|---|---|---|
| Every attempt, on T0 red | `t0/logs/*` → digester → `digests/*` | stays Tier B (staging) |
| Round close (pre-L2) | `digests/*` → `discovery/ledger.md` entries | full triples, tagged `discovered` |
| GATE L2 | T0 verdict + seesaw result → `hill/<scope>.yml` phase derivation; commit shard + regenerate `hill-chart.md` | derived facts only |
| GATE L2 | T0 artifact → `eval/EVAL-r<N>.md` citation | **sha256 + one-paragraph summary** — the raw log body never leaves Tier B (criterion C5) |
| Escalation answered | in-flight ESCALATE → `round-ledger.md` decision record | immediately, not at round close — a decision made must survive a crash |
| GATE H / L4 | hammer census + deploy evidence → `ship-report.md` | final commit of the cycle |
| Cool-down | `.shapeup-sdlc/` deleted; `cycles/<id>/` remains as the permanent record | Tier B dies, Tier A persists |

Anti-promotion rule: **raw logs, traces, screenshots, and generated briefs are never committed.** If an EVAL report's summary proves insufficient later, the fixture is re-run — evidence is reproducible by design, so storing its body is waste plus repo bloat plus a stale-evidence hazard.

## F.4 Corrections to v1.1 (the three misplacements)

**Δ1 — Scope contracts move from gitignored `.harness/scopes/` to committed `docs/shapeup-sdlc/cycles/<id>/scopes/`.**
v1.1 marked them runtime; that fails criteria C3 and C4-single-writer badly: the PO *approves* contracts at GATE L1 (they are the scope board — the project's common language), a teammate picking up scope B needs scope A's substrate list to respect disjointness, and the sandbox hook should enforce *committed truth*, not a local file an executor could theoretically rewrite. Runtime keeps only the `active-scope` pointer. Contracts are single-writer (`ba`) and per-scope files, so they merge cleanly.

**Δ2 — `hill-state.md` monolith splits into per-scope shards + a derived render.**
The v1.1 monolith fails C4: two teammates closing different scopes in the same round both edit one file → guaranteed merge conflicts in the project's most important status artifact. Sharding to `hill/<scope-id>.yml` makes each shard single-writer (whoever holds that scope's branch); `hill-chart.md` becomes a regenerated render — Shape Up's "status without asking" is preserved (the PO still reads one committed page) while the data underneath merges trivially. Blueprint B2's derivation rules are unchanged; only the file layout changes.

**Δ3 — `metrics.jsonl` shards per machine.**
Append-only JSONL from N concurrent machines into one committed file is a merge-conflict generator with zero semantic conflict (appends never actually contend). `metrics/<machine-id>.jsonl` removes the conflicts; any aggregate view is derived on demand (`cat metrics/*.jsonl`). This also gives E-series experiments per-machine provenance for free.

## F.5 Concurrency rules

1. **One run per checkout** — `run.lock` refuses a second `/ship` in the same working copy; a second teammate works in their own clone/worktree.
2. **One writer per Tier A file** — contracts: `ba`; hill shard: the orchestrator instance holding that scope's branch; ledgers: the orchestrator; EVAL reports: the evaluator dispatch; knowledge base: `/coach`.
3. **Scope = branch = substrate** — the existing branch-per-scope isolation (spec §3.5) is also the concurrency unit: two teammates can run two scopes in parallel clones because their substrates are disjoint (enforced at L1) and their Tier A writes land in different shard files.
4. **Shared-substrate writes are the one contended path** — a write to a declared `shared_substrate` file forces a full seesaw on merge (spec R7), which is exactly the moment cross-teammate interference would surface.

## F.6 Lifecycle and cleanup

| Event | Effect |
|---|---|
| `/ship` start | create `run.lock`, `active-scope`; verify Tier C prerequisites (browsers, env) and fail fast at L0 if missing |
| attempt end | prune `t0/logs` older than N attempts (keep last red + last green) |
| cycle close (cool-down) | delete `.shapeup-sdlc/` entirely; `cycles/<id>/` is the archive — no separate archival step needed because promotion already happened at gates |
| `/ship --clean` | manual Tier B wipe; safe by the F.2 invariant |
| new cycle | fresh `cycles/<new-id>/`; prior cycles remain browsable history (hill shards + ledgers + ship reports = the team's longitudinal memory, greppable) |

## F.7 `.gitignore` specification (installer-managed)

```gitignore
# ShapeUp SDLC harness — runtime tier (rebuildable, never commit)
.shapeup-sdlc/

# project-local per-member config (Tier C) — templates *.example ARE committed
.claude/settings.local.json
.env.local
.env

# never ignore the templates
!.env.example
!.claude/settings.local.example.json
```

Note the *removal* relative to v0.2.6 behavior: the installer previously treated `.shapeup-sdlc/` as the home of the knowledge base and telemetry; both have committed homes now (`docs/shapeup-sdlc/knowledge-base/`, `docs/shapeup-sdlc/metrics/`), so the ignore rule now covers pure runtime only — consistent with the 0.2.5 knowledge-base migration already shipped.

## F.8 Traceability

| Concern | Answered by |
|---|---|
| What do teammates inherit on `git pull`? | Tier A: contracts, tasks, hill shards + render, ledgers, EVAL summaries, ship reports, knowledge base, metrics shards, fixtures |
| What does a fresh clone need to run? | `install-harness.sh` (plugin, hooks) + `npx playwright install` + copy the two committed templates to `settings.local.json` / `.env.local` and fill values — L0 fail-fast validates the result per key |
| Where does a member tune models/budgets without affecting the team? | `.claude/settings.local.json` — merges over committed team defaults, resolved at L0.5, recorded in the ledger header so runs stay attributable |
| Can any decision be lost by deleting local state? | No — decisions promote to the ledger at the moment they're made (F.3), and everything else in Tier B is derived |
| Do concurrent teammates conflict? | Only on shared substrates, by design, where the seesaw adjudicates (F.5) |
| Does the repo bloat with evidence? | No — C5 hash+summary rule; raw bodies live and die in Tier B |

*This addendum folds into the main specification as §3.7 (tiers, promotion, concurrency) and Blueprint F (trees, gitignore) in v1.2, alongside change-log entries for Δ1–Δ3.*
