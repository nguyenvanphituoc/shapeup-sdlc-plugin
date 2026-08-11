# Kill/resume probe rig — Stage A3's G6 (2026-08-11)

Forked from `../wf-a2-probe/`. **`assert.mjs` and `snapshot.mjs` are byte-identical to A2's**
(`shasum -a 256` both directories to check) — a PASS here is only meaningful against A2's FAIL if
the instrument is the same one. A2's evidence refused to narrow an assertion so its own change
would pass; this rig keeps that refusal mechanical.

| file | what it is | new in A3 |
|---|---|---|
| `install-candidate.sh` | pack this worktree, stamp it with its own version + marketplace name, verify every file by sha256 | ✔ |
| `seed-project.sh` | leg 0: scratch project, intake, profile, settings, trust bit, `init-run.mjs` | ✔ |
| `launch.sh` | the launch, called once per leg with byte-identical args | plugin root only |
| `kill-and-snapshot.sh` | SIGKILL the session, snapshot the disk at the kill | — |
| `snapshot.mjs` | hash every artifact under `.shapeup/<slug>/` and `shapeup/<slug>/` | — |
| `assert.mjs` | the four assertions, as set operations over two snapshots | — |

## The run, end to end

```bash
./install-candidate.sh          # → candidate/ (1.6.3-a3probe, marketplace a3probe-marketplace)
./seed-project.sh               # → project/ with a receipt and a ledger
./launch.sh 1                   # leg 1 — run it until BUILD is under way
./kill-and-snapshot.sh          # SIGKILL at the window: ≥1 scope T0-green, ≥1 order in flight
./launch.sh 2                   # leg 2 — fresh session, same args, resumes from disk alone
node snapshot.mjs project todo-kill after-resume.json
node assert.mjs at-kill.json after-resume.json
```

**Why seeding is a script now.** A2 did leg 0 by hand, so its re-run was a rebuild: the intake, the
profile and the settings went with the project directory and only the launch was committed. Every
input the run reads is written by `seed-project.sh`, so the next re-run differs in nothing but the
code under test.

**Setup gotchas, all measured (execution-report.md findings #8, #10, #11):**
- The workspace must be TRUSTED or `permissions.allow` is ignored in full — `seed-project.sh` sets
  the bit rather than leaving it to a dialog nobody is there to answer.
- `npx shapeup-sdlc init` re-clones the marketplace from GitHub, silently replacing a local
  candidate with the published build. This rig never calls it; it writes the project's settings
  itself and names the candidate's marketplace `a3probe-marketplace` so the two cannot collide.
- The archetype enum has no `cli` member. The profile declares `web-service` — true of this
  scratch project, and in the enum.
