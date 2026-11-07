# Intake — opening a run

Everything the run needs is pinned once, here, so the loop never has to guess. The intake is a
**kicked-off pitch**: shaping, betting and kick-off are the PO's own and happen upstream. A raw idea is
not an intake.

## 1. Resolve the pitch

In order: `--pitch <path>` (a shaping or pitch file), `--spec <folder>`, requirement text passed to the
skill. **None resolvable → stop.** Print "✋ NO INTAKE — name a kicked-off pitch (`--pitch <path>`)" and
nothing else: do not emit the L0 block, list downstream gates, or describe the pipeline that "will" run.
A run with no spec has nothing to drive, and narrating one reads exactly like a run that worked.

A pitch is `shaping.md` plus its `breadboard.md`, which the run finds beside it (or in `shaping/`), takes
from `--breadboard`, or reads inline in a single `pitch.md`.

## 2. Language check

Dispatch a sub-agent (the exec model) to invoke `Skill(shapeup-sdlc-plugin:translator) --check` over the
pitch **and** its breadboard. English → use both as they are. Otherwise a second sub-agent translates
both (`--auto` under auto/unattended) and the run opens on the produced `<name>.en.md` files; the intake is
what every planning worker reads, so a translation made after the run opened reaches nobody. A run already
open on the original is reopened with `init run --force` — nothing has been dispatched yet. You detect and
sequence; you never translate.

## 3. Collect, explicitly

Never inferred; ask for what the pitch does not say.

| | |
|---|---|
| Appetite | the pitch frontmatter's `appetite`. Missing or uncapped is a risk: say so at L0 and again at the board gate. It sizes the round budget: 1 week → 2 rounds, 2 weeks → 3, 6 weeks → 4. |
| Lens | `lite` \| `standard` \| `cross-context` (default `standard`) |
| Stack hint | aims the Scout's sweeps and the run commands (e.g. "pnpm, Next 16 web :3000") |
| Eval dimensions | default `auto`: the order resolves the set from the spec. Name a set only on request; it must reach `init run --dimensions`, or it grades nothing. What is left out is reported at the ship gate as not evaluated. |
| Rounds, attempts | default 3 rounds, 5 attempts per scope per round |
| Auto level | `interactive` (default): pause at every gate · `auto`: low-risk gates pre-answered, still pause at the judgment gates and ship · `unattended`: headless, needs an answer set |
| Models | resolve once: flags, then `.claude/settings.local.json`, then `.claude/settings.json`, then defaults. Exec and eval must be sonnet or above — the kernel refuses a cheaper tier. |
| Run commands | the build command (`run_cmd`), and the profile's `build_probe` and `launch_probe`. A `mobile` profile with no launch probe has nobody owning the install and launch risk: say so. |
| Knowledge base | read `shapeup/knowledge-base/building.md` if it exists. It may add a question or a check to a gate block and may propose run values (confirm each with the PO and note `(source: knowledge-base)`). It never answers, skips or reorders a gate. With no file at all, offer `/retro --scan` once and go on whether or not the PO takes it. |

## 4. Open the run

Write the requirement to a file first and pass the path; a multi-line requirement inlined into a shell
argument is where this step goes wrong.

```bash
node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" init run --slug <slug> --intake-file <path> --auto-level <interactive|auto|unattended> [--dimensions <a,b>] [--gate-answers <ci|guarded|path.json>] [--wall-clock-budget <seconds>] [--max-rounds 3] [--breadboard <path>]
```

**Exit 3 means a run is already open.** Read the derived state it prints, run `probe resume --slug <slug>
--mark-relaunch`, and go to the loop with `--restart`. `--force` reopens deliberately and discards the
round history the breaker counts; only the PO asks for it.

## 5. The shared profile

Write `shapeup/<slug>/project-profile.md`: frontmatter `{schema_version: 1, archetype, entry_point}` plus,
when the project has them, `build_probe` and `launch_probe`. Nothing downstream can be wired without it.

## 6. The L0 gate

Emit the block, then resolve it like every other gate:

```
⏸ GATE L0 — Intake & Run Config
Feature      : <slug>   (kicked-off pitch: <path>)
Intake lang  : English | translated → <name>.en.md
Appetite     : ~1 week | ~2 weeks | ~6 weeks | ⚠ missing — scope uncapped
Eval dims    : auto | the named set        Rounds: <N>     Auto: <level>
Run commands : <run_cmd> · build_probe <set|—> · launch_probe <set|— ⚠ mobile>
Model matrix : exec=<m> eval=<m> qa=<m>   (source: flags | settings.local | settings.json | default)
Budgets      : round_budget=<N> (outer)   attempt_budget=<N> (inner, per scope)
Knowledge    : building.md — <N> rules | none
```

```bash
node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" gate --resolve L0 --slug <slug> [--file <path>|--preset <name>]
```

Exit 4: put the block to the PO and wait. Exit 0 `proceed`: continue. Exit 5: stop; do not launch.

## 7. The launch record

Every switch typed to this launch becomes a field of the launch record, or it does nothing: the loop
reads nothing but the record and the artifacts.

```bash
node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" init run-args --slug <slug> --auto-level <level> --exec-model <n> [--eval-model <n>] [--qa-model <n>] --max-rounds <N> --attempts <N> --plugin-root "${CLAUDE_PLUGIN_ROOT}" [--answers <a>] [--lane <l>] [--no-eval] [--no-qa] [--parallel-scopes <N>]
```

`--no-eval` and `--no-qa` skip those phases (a shipped report says so; it never reads as verified).
`--parallel-scopes N` caps scopes building at once (default 4; `1` = sequential). `--adversarial-verify` is
recorded and reported as not carried by the loop. `--wall-clock-budget` is typed once, on `init run`.
Then go to the loop.
