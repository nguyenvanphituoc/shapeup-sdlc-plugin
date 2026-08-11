# Kill/resume probe rig — Stage A2's G6 (2026-08-11)

Stage A's rig lived on another machine and was lost, so it was rebuilt and is committed here to
make the next re-run a repeat rather than a rebuild.

| file | what it is |
|---|---|
| `launch.sh` | the launch, called once per leg with byte-identical args |
| `kill-and-snapshot.sh` | SIGKILL the session, snapshot the disk at the kill |
| `snapshot.mjs` | hash every artifact under `.shapeup/<slug>/` and `shapeup/<slug>/` |
| `assert.mjs` | the four assertions, as set operations over two snapshots |
| `at-kill.json` / `after-resume.json` | this run's two snapshots — the evidence §7 cites |

**Self-test the instrument before trusting it.** `assert.mjs` was verified in three directions
(clean resume PASSes; Stage A's recorded failure FAILs; a rebuilt green scope + rewritten citation
FAILs) before it graded anything.

**Setup gotchas, both measured (execution-report.md findings #8, #10):**
- The workspace must be TRUSTED or `permissions.allow` is ignored in full.
- `npx shapeup-sdlc init` re-clones the marketplace from GitHub, silently replacing a local
  candidate install with the published build. Verify every file by sha256 against the worktree
  before launching, or the probe measures the control.
