# Anti-Lying Kit

**Hooks that stop your coding agent claiming "done".**

Your agent finishes two of four tasks, runs its own review pass, and tells you the feature is
complete. Every spec-driven framework's answer to this is a firmer instruction. This is three
hooks that make it not happen.

It works **with** whatever you already use — spec-kit, OpenSpec, BMAD, Superpowers, or your own
`tasks.md`. It does not replace your workflow and has no opinion about how you plan.

```
⛔ PreToolUse hook — DENIED   Skill(speckit.implement-review)

GATE DONE — the task board is not green, so this cannot be graded as finished
yet. 2 of 4 tasks are unfinished: T003 (specs/001-dark-mode/tasks.md),
T004 (specs/001-dark-mode/tasks.md). Finish them, then re-attempt.
```

That is verbatim output, from a real spec-kit-shaped board. The review call never ran.

## Install

```
/plugin marketplace add nguyenvanphituoc/shapeup-sdlc-plugin
/plugin install anti-lying-kit@nvptuoc-marketplace
```

Then tell it where your task board is — one file, `.antilying.json` at your project root:

```json
{ "preset": "spec-kit" }
```

That's it. Presets: `spec-kit`, `openspec`, `markdown-checklist`, `shapeup-sdlc`.

**Until that file exists, every hook is inert.** Nothing is gated by installing this.

## What you get

| Hook | Event | Blocks? | What it does |
|---|---|:---:|---|
| **gate-done** | PreToolUse | **yes** | Denies the review/eval/ship call while any task on your board is unfinished, naming them. |
| **no-fake-done** | Stop | no | Flags a reply that reads "all done" when the board says otherwise. |
| **slop-check** | Stop | no | Flags TODO/FIXME, stray debug logging, and commented-out code in the session's own diff. **Needs no config** — works in any git repo immediately. |

Only the first one blocks. The other two emit a message and get out of the way, because a Stop
hook that can trap a session is a hook you will uninstall.

## Custom boards

Any layout works — describe it instead of using a preset:

```json
{
  "board": {
    "glob": "planning/**/todo.md",
    "id": "(STORY-\\d+)",
    "done": "^\\s*[-*]\\s*\\[[xX]\\]",
    "notDone": "^\\s*[-*]\\s*\\[\\s*\\]"
  }
}
```

| Field | Meaning |
|---|---|
| `glob` | Where the task files are (`*` and `**` supported) |
| `done` | Regex matching a **finished** task |
| `notDone` | Regex matching an **unfinished** task (optional; omit and anything not `done` counts) |
| `id` | Regex whose first group names the task, for the denial message |
| `perFile` | `true` when one file *is* one task (matched against frontmatter, not per line) |

You can also retune what counts as a gated call:

```json
{
  "preset": "spec-kit",
  "gate": {
    "names": "(my-reviewer|final-check)",
    "perItem": "--task(?![\\w-])"
  }
}
```

## Design: it fails open, on purpose

A gate that blocks legitimate work gets uninstalled, and then it protects nothing. `gate-done`
denies **only** when it can positively prove a task is unfinished. Every one of these defers to
your normal permission flow:

- no `.antilying.json` — you haven't opted in
- config missing/malformed, or naming an unknown preset
- no files match `glob`, or no line looks like a task
- the call grades a single item (`--task T003`) rather than the whole round
- the hook payload doesn't parse

Boring corollary worth stating: **it cannot approve anything.** It has exactly one power, `deny`,
and it declines to use it whenever it is unsure.

## Trust

Three `.mjs` files and one library, no dependencies, no network calls, ~450 lines you can read
end to end. Nothing is sent anywhere; the hooks read your task files and your `git diff` and
write nothing at all.

```bash
grep -rnE "fetch|node:http|node:net|curl|wget" hooks/ lib/    # returns nothing
```

## Limits, stated plainly

- **It trusts your board.** If your agent marks tasks done without doing them, the board is green
  and the gate opens. It closes the "graded work it hadn't finished" hole, not the "lied on the
  board" hole. Pair it with a check that runs your tests.
- **Hooks are Claude Code-specific.** The idea ports anywhere with a tool-call interceptor; this
  implementation does not.
- **`no-fake-done` needs a transcript.** Where the host doesn't provide one it stays silent
  rather than nag.
- **Two harness mechanisms did not extract.** Artifact-cited verification (`t0-verify`) and
  mechanical progress derivation depend on per-scope contracts, so they stayed behind in the
  [full harness](../../README.md) rather than shipping here as something weaker wearing the same
  name.

## Where this came from

Extracted from [ShapeUp SDLC](../../README.md), a full Shape Up harness whose three enforcement
mechanisms are its actual differentiator. Those generalise past Shape Up, so they ship separately
— you should not have to adopt a methodology to get a gate.

If you want the whole loop (shaping, betting, hill charts, scope hammer, single-judge evaluation),
that's the parent. If you just want your agent to stop lying about done, this is the part you want.

MIT.
