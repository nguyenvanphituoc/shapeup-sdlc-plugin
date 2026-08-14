# Quickstart — a real run, start to finish

The shortest honest walkthrough of what this harness actually does. It uses
[`examples/todo-cli`](../examples/todo-cli/): a small command-line todo list, chosen because it
is a **non-UI** deliverable — no browser, no Playwright, nothing to install beyond Node.

Every command below is real, and every block of output marked **verbatim** was produced by
running it. Nothing here is illustrative-only.

- [What you need](#what-you-need)
- [1. The idea](#1-the-idea)
- [2. Shape it](#2-shape-it)
- [3. Map it](#3-map-it)
- [4. Build it](#4-build-it)
- [5. The gate that makes this different](#5-the-gate-that-makes-this-different)
- [6. Evaluate — a FAIL round](#6-evaluate--a-fail-round)
- [7. Fix, then PASS](#7-fix-then-pass)
- [8. Hunt the edges, then ship](#8-hunt-the-edges-then-ship)
- [What just happened](#what-just-happened)

## What you need

Node 18+, and the plugin installed in a Claude Code session
([docs/install.md](install.md)). No browser: this deliverable has no `[ui]` acceptance
criterion, so the Playwright dependency never activates.

Work in a scratch directory, not in the plugin repo:

```bash
mkdir /tmp/todo-demo && cd /tmp/todo-demo && git init
cp <plugin>/examples/todo-cli/idea.md .
```

## 1. The idea

`idea.md` is a paragraph and an appetite — the input the harness expects. The essential part:

> Developers keep todos in their head and lose them. Give them a zero-config CLI, `todo`, that
> stores items in a local JSON file and supports `add`, `list`, `done <n>`, and `rm <n>`. It must
> behave sanely at the edges — empty list, bad index, a corrupted store file — **because a CLI
> that crashes on a typo is worse than no CLI.**
>
> **Appetite:** small batch — a single build round.
> **No-gos:** no sync, no server, no accounts. No TUI/colors (keep output assertable).

That last clause is doing real work. "Behaves sanely at the edges" is what will become a
testable invariant, and the no-gos are what stop the agent gold-plating.

## 2. Shape it

```
/shape idea.md
```

Shaping produces a pitch: problem, appetite, the solution at the right altitude, rabbit holes,
and no-gos. You are the Betting Table — read it, and either bet on it or send it back. Nothing
downstream starts until you do.

> **Why this exists.** The most expensive failure in agent-assisted work is building the wrong
> thing quickly. This step is cheap and it is where you still have all your leverage.

## 3. Map it

```
/orient          # recon: read the code, spike the riskiest part, write no production code
/scopes          # pitch → spec tree (domain model → use cases → tasks) + the board
```

`/scopes` produces the **Test Surface** — the rows the build will be graded against — derived
from the use cases rather than invented. For this pitch it includes the happy paths (`add`,
`list`, `done`, `rm`) *and* the edges the idea called out. Those edges are the difference
between a demo and a tool:

| # | Edge | Expected |
|---|---|---|
| E1 | empty list | exit 0, prints "no todos" |
| E2 | bad index (`done 99`) | exit ≠ 0, clear message, **no stack trace** |
| E3 | non-numeric index (`done abc`) | exit ≠ 0, clear message |
| E4 | corrupted store (`{garbage`) | exit ≠ 0, names the file, **does not delete user data** |
| E5 | missing store, first run | creates it, exit 0 |
| E6 | store with two items | lists both, exit 0 — proves the CLI reads the store it was given |

⏸ **GATE L1b** pauses here. Review the board before a line of code is written — this is the
last cheap moment to change your mind.

## 4. Build it

```
/build           # or let /ship drive the whole loop
```

Each task is a separate dispatch with a fresh worker: it receives a work order, writes code, and
returns a result. It cannot write the board, the ledger, or the run state — the orchestrator
applies those. If scope contracts are in play it also cannot write outside its substrate; a hook
denies it.

## 5. The gate that makes this different

Suppose two tasks are still unfinished and the agent decides it has done enough:

```
/eval
```

**Verbatim output** — this is the gate's real warning, not a paraphrase:

```
⚠ GATE L2 — the board is NOT green and the EVAL is proceeding anyway.
Unfinished (2): TASK-003, TASK-004
EVAL is designed to run once per round, after every task is done. A verdict taken
now grades a partial board, so a PASS does not mean the feature is complete — it
means the finished part passed. Route back to BUILD (task-executor) to close these,
or use --task for a deliberate single-task check.
```

That text is derived from the board read twice — per-task frontmatter *and* the board table — and
it travels in the GATE L2 block itself, so whoever answers the gate sees it. **GATE L2 is
advisory**: the operator asked for the call and the board is local to this machine, so it reports
rather than refuses. What it buys is that "evaluated a green board" and "evaluated a half-green
board anyway" are two different, countable facts — a PASS over an incomplete board can never later
be read as a complete one.

> **The layers that do refuse.** Advisory is GATE L2's own choice, not the harness's posture.
> `harness verify envelope` denies a worker dispatch whose order is missing or schema-invalid;
> `sandbox-guard.mjs` denies a write no live order's substrate permits;
> `gate-intake.mjs` denies an orchestrator dispatch with no requirement in it;
> `safety-spine.mjs` denies `rm -rf ~`, force-push, `DROP TABLE` and secret reads; and
> `gate-zerowork.mjs` blocks a session that reached the orchestrator and left no run receipt.
> Those are `deny` decisions from hooks, and no amount of reasoning gets past them.

## 6. Evaluate — a FAIL round

With the board green, the judge runs. For a CLI the evaluator uses the **`process` oracle**: it
spawns the binary in a throwaway temp dir, feeds it a store fixture, and grades exit code and
output. You can run exactly what it runs:

```bash
node oracles/process-oracle.mjs \
  examples/todo-cli/todo.contract.json \
  "node $PWD/examples/todo-cli/reference/todo.js"
```

Here is a build that implemented the happy path and dropped one bounds check — by far the most
common real outcome. **Verbatim:**

```
Evaluation report — process oracle for: node …/todo.js
============================================================
PASS  E1  empty list prints a friendly message, exit 0
        ⇒ exit 0, crashed=false, out="no todos"
FAIL  E2  bad index fails gracefully, non-zero, no stack trace
        ⇒ exit 1, crashed=true, out="…TypeError: Cannot read properties of
          undefined (reading 'done')  at todo.js:45:18…"
          [crashed (stack trace / panic in output)]
PASS  E3  non-numeric index fails gracefully
        ⇒ exit 1, crashed=false, out="error: \"abc\" is not a valid item number"
PASS  E4  corrupted store fails without destroying data
        ⇒ exit 1, crashed=false, out="error: store …/store.json is corrupted"
PASS  E5  missing store is created on first run, exit 0
        ⇒ exit 0, crashed=false, out="no todos"
PASS  E6  a seeded store is actually read — its items are listed, exit 0
        ⇒ exit 0, crashed=false, out="1. [ ] buy milk\n2. [x] write tests"
============================================================
❌ 1/6 criteria FAIL
```

Read what that verdict is made of: a **command that was run**, an **exit code**, and **observed
output**. Not "looks good", not "should work". `todo done 99` printed a stack trace, so E2 is a
FAIL — and the run does not proceed to ship on five out of six.

> **Absence of evidence is a FAIL.** A criterion the evaluator could not probe does not pass by
> default. This is the rule that makes the verdict worth anything.

⏸ **GATE L3.** FAIL routes back to BUILD for round 2 — and round 2 builds *only* the bugs, plus
the full Test Surface of any use case that was touched. It does not rebuild the world.

## 7. Fix, then PASS

The fix is the missing guard:

```js
if (n < 1 || n > items.length) fail(`no item ${n}`);
```

Re-run the same oracle. **Verbatim:**

```
PASS  E1  empty list prints a friendly message, exit 0
        ⇒ exit 0, crashed=false, out="no todos"
PASS  E2  bad index fails gracefully, non-zero, no stack trace
        ⇒ exit 1, crashed=false, out="error: no item 99"
PASS  E3  non-numeric index fails gracefully
        ⇒ exit 1, crashed=false, out="error: \"abc\" is not a valid item number"
PASS  E4  corrupted store fails without destroying data
        ⇒ exit 1, crashed=false, out="error: store …/store.json is corrupted"
PASS  E5  missing store is created on first run, exit 0
        ⇒ exit 0, crashed=false, out="no todos"
PASS  E6  a seeded store is actually read — its items are listed, exit 0
        ⇒ exit 0, crashed=false, out="1. [ ] buy milk\n2. [x] write tests"
============================================================
✅ all 6 criteria PASS
```

E2 now exits 1 with `error: no item 99` and no stack trace. Same probe, same oracle, different
evidence.

## 8. Hunt the edges, then ship

```
/qa        # exploratory hunt OUTSIDE what the evaluator already probed
/hammer    # must-have census → compare against baseline → cut list → ship verdict
```

QA has **no verdict and no score** — findings land in the discovery ledger as `~` and never
block the ship. It is looking for what the Test Surface did not think to ask (`todo done` twice,
a store that is a JSON array of the wrong shape, a 10,000-item list).

`/hammer` compares against the **baseline — what people live with today, which is nothing** —
not against an ideal todo app. That is what makes it possible to stop.

⏸ **GATE L4.** You sign off. Feedback you give here is not lost: `/retro` files it under the
responsible skill in `shapeup/knowledge-base/<skill>.md`, committed, and the coachable
skills read it back on their next run.

## What just happened

Five things, none of which depended on the agent being honest:

1. You reviewed a **pitch** and a **board** before any code existed.
2. A hook **recorded** that the evaluation ran over unfinished work — mechanically, not by
   request — and other hooks **denied** the malformed dispatch and the out-of-substrate write
   outright.
3. The verdict was built from **commands, exit codes, and observed output**, with a criterion
   that could not be probed counted as a FAIL.
4. The FAIL round rebuilt **only the bugs plus the touched Test Surface**.
5. The stop decision compared against the **baseline**, not the ideal.

The full loop is in [the design docs](design/README.md); the vocabulary is in
[the glossary](glossary.md). If a step here confused you, that is a bug worth
[filing](https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin/issues/new?template=onboarding_friction.yml).
