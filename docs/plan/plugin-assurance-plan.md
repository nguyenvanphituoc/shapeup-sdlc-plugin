# Verifying shapeup-sdlc — an assurance suite, not another benchmark

- **Item:** the plugin's stated thesis is *"every invariant that matters lives in the runtime, not in
  a prompt."* Nothing currently tests that claim under the conditions where it broke.
- **Status:** design. Nothing built.
- **Why this and not another benchmark:** see §1. The benchmark question is answered; the assurance
  question has never been asked.

---

## 1. Why the next plugin work is assurance, not performance

The benchmark measured the plugin four times and the answer stopped moving:

| Measured | Result |
|---|---|
| Uninterrupted quality vs no harness | **identical** — every arm 100%, across 4 features |
| Cost vs a one-sentence control | **4.6× – 12×** |
| Recovery across a handoff (v1.4.0) | **0/3** |
| Recovery after the F-16 fix (v1.4.1) | **0/3** — unchanged |
| `session-rehydrate` firing | **3/3** — and worth nothing |
| `compact-snapshot` firing | **never observed** |

Chasing a fifth benchmark result is chasing a condition where the tool wins. The plan that produced
those numbers explicitly warns against it, and `fit-check` returning `lane: "full", confidence:
"clear"` on the losing intake shows the tool is not even misconfigured — it is correctly doing a
thing that does not fit the window.

**But one question was never asked, and it is the one the tool's own marketing rests on.** F-16 found
that 26 scripts and hooks were **silently inert** under an ordinary install: `init-run.mjs` wrote no
receipt, `validate-envelope.mjs` emitted no denial, and *every gate still reported success*. The
enforcement layer — the entire value proposition — was decorative, and 610 passing structural checks
did not notice.

**That is a safety property, and safety properties are verified adversarially, not benchmarked.**

---

## 2. The claim under test, stated so it can fail

The plugin's `AGENTS.md` makes three falsifiable claims. This project tests exactly these:

| # | Claim, in the plugin's own words | Fails if… |
|---|---|---|
| **C1** | *"A `PreToolUse` hook hard-denies the once-per-round EVAL delegation while the board is not green — the tool call never reaches the evaluator."* | a red board ever reaches the evaluator |
| **C2** | *"Progress is derived, never claimed."* Hill phase comes only from T0/T1/seesaw artifacts on disk | a fabricated or absent artifact yields a green phase |
| **C3** | *"Per-scope substrate write-whitelists are hook-enforced, and exactly one script performs every board/ledger/verdict write."* | a write lands outside its substrate, or a second writer mutates shared state |

Plus the meta-claim F-16 falsified once already:

| **C0** | *"Every invariant that matters lives in the runtime."* | **any** enforcement point is a silent no-op under a legal install shape |

---

## 3. The design: adversarial, install-shape-aware, and hostile by default

Three properties, each descended from how F-16 escaped:

### 3.1 Every check runs under **hostile install shapes**, not the repo path

F-16 was invisible because all 610 checks invoked scripts by their real, space-free repository path
— the single shape in which the bug does not exist. The matrix is therefore:

| Shape | Why it is legal and why it breaks things |
|---|---|
| real repo path | the baseline; everything passes here by construction |
| **symlinked directory** | `/var` → `/private/var` on macOS, so every system temp path. nvm, pnpm, Homebrew |
| **path containing a space** | `~/Library/Application Support/…` |
| **packed distributable** (`npm pack` → extract) | what a user actually installs; catches files missing from `files` |
| **read-only plugin root** | a plugin installed under a store or a container image layer |
| **`FORCE_COLOR=3` set** | already cost this project a broken rate-limit branch; ANSI in a captured value |

Every enforcement point × every shape. A check that passes on the repo path and fails on the packed
symlinked path is the F-16 signature, and it is the default expectation, not an edge case.

### 3.2 The oracle is **"did it deny?"**, never "did it exit 0"

F-16's core lesson: **exit 0 stood in for "the work happened."** So no check here may accept a clean
exit as evidence. Every enforcement point must produce a **positive, observable denial artifact**:

- a `permissionDecision: "deny"` on stdout, or
- a non-zero exit with a message, or
- a named file on disk that only the enforcing path writes.

**Silence is a failure, always.** This inverts the usual hook convention (fail-open) *for the test
only* — the production hooks may still fail open; the test asserts they SPOKE when they should have.

### 3.3 Adversarial fixtures, generated not hand-picked

For each claim, a small generator produces states that *should* be denied, including the awkward ones:

- a board at 99% green (off-by-one), not just 0%
- a T0 artifact that exists but whose hash does not match
- a T0 artifact that is a **symlink to a green one from another scope**
- an envelope valid against the schema but referencing a dangling order path
- a write one directory above the substrate root, and one via `../` inside it
- a second writer racing `ingest-result.mjs` on the same ledger

**Every generated case ships with its expected verdict, committed before the suite runs.**

---

## 4. Architecture

```
assurance/
  shapes/            the six install shapes; each yields a plugin root + an invoker
  claims/
    c0-liveness.mjs    every entry point speaks under every shape (the F-16 regression, generalised)
    c1-gate-l2.mjs     a red board never reaches the evaluator
    c2-derived.mjs     no fabricated artifact yields a green hill phase
    c3-substrate.mjs   no write escapes its whitelist; no second writer mutates shared state
  fixtures/generate.mjs
  expected/*.json    committed verdicts — the suite cannot decide what "correct" means at run time
  run.mjs            claims x shapes -> a matrix report, non-zero on any silent no-op
```

**Reuses:** `tests/structural/11-is-main.mjs` (the packed-distributable shape already works there) and
`12-report-parity.mjs`'s stripping approach. **Does not reuse** the benchmark: no model is called,
so this suite is **free and runs in CI**, which is the point — F-16 was found by a $56 experiment
that should have been a test.

---

## 5. Stages

| Stage | Buys | Cost | Gate |
|---|---|--:|---|
| **A0** | shapes harness + C0 liveness across all six shapes | $0 | **any entry point silent in any shape ⇒ that is a live F-16 recurrence; stop and fix before continuing** |
| **A1** | C1 — GATE L2 adversarial board fixtures | $0 | a red board reaching the evaluator is a release blocker |
| **A2** | C2 — derived-progress fixtures (hash mismatch, symlinked artifact) | $0 | — |
| **A3** | C3 — substrate escape + concurrent-writer fixtures | $0 | — |
| **A4** | wire into `npm test` and CI; ratchet the check count | $0 | — |
| **A5** | one paid confirmation: `shapeup-sdlc` on the benchmark, packed, asserting `hooks_fired` and the denial artifacts appear in a real run | **~$10** | the suite says enforced, the real run says silent ⇒ **the suite is wrong**, which is the most important thing it could tell us |

**Total ~$10, almost all of it free.** A5 exists because a green assurance suite that disagrees with
a real run is exactly the failure F-16 was: a test that could not see the thing it claimed to check.

---

## 6. Registered predictions

1. **C0 finds at least one more silent no-op** in a shape not yet tested — most likely the read-only
   plugin root or `FORCE_COLOR`. The `is-main` fix addressed *path resolution*; it did not address
   every way an entry point can decline to speak.
2. **C1 holds.** `gate-l2.mjs` is the most-tested mechanism in the plugin and I expect it to pass in
   every shape.
3. **C3's concurrent-writer case fails or is untestable**, because single-writer is currently a
   *convention* enforced by which script you call, not by a lock or an atomic append.
4. **A5 agrees with the suite.** If it does not, the suite is rewritten, not the plugin.

---

## 7. What this deliberately is not

- **Not a benchmark.** No model is called except in A5. No comparison to any other tool.
- **Not a performance claim.** Nothing here argues the plugin is worth its cost — the benchmark
  already answered that, unfavourably, and this project does not relitigate it.
- **Not a fix list.** It produces a matrix of *enforced / silently inert* per claim per shape. What
  to fix is a separate decision, made after seeing it.

---

## 8. The honest framing

The benchmark's verdict stands: this plugin costs 4.6–12× a one-sentence control and has never
bought a measurable quality point. **That is not what this project disputes.**

What it establishes is narrower and, for a tool whose entire pitch is enforcement, more important:
**when the plugin says it denied something, did it?** F-16 showed that for an entire release, across
26 files and every guarded hook, the answer was no — and nothing in the repository could tell.

A tool that is expensive and honest is a defensible product. A tool that is expensive and *silently
does nothing* is not, and the difference is worth $0 and a CI job to know.
