# Spike — local JSON store persistence & corruption handling

**Area**: the JSON store read/write path (`src/store.js`, NEW — see code-surface.md).

**Question**: with zero external dependencies (per the pitch's "zero-config" framing and the
no-gos ruling out heavier tooling), can Node's built-in `fs` module (a) detect and recover
gracefully from a corrupted/unparseable store file and a missing store file, and (b) write the
store back without risking a torn/corrupted write, using only `fs` sync APIs?

**Time-box**: ~15 minutes, real Node REPL probes (no repo code existed to spike against, so
this is direct `node -e` experimentation against throwaway files in `/tmp`).

**Result: RESOLVED**

Ran three probes in `/tmp/orient-spike` on this machine (`node v24.15.0`, darwin):

1. **Corrupted file → parse error is catchable**
   ```
   $ node -e "fs.writeFileSync('store.json','not json {{{'); try { JSON.parse(fs.readFileSync('store.json','utf8')) } catch(e) { console.log(e.constructor.name, e.message) }"
   PARSE ERROR CAUGHT: SyntaxError Unexpected token 'o', "not json {{{" is not valid JSON
   ```
   A `try/catch` around `JSON.parse` cleanly catches `SyntaxError` — the store module can
   detect corruption and decide a policy (e.g. treat as empty list + warn, or exit non-zero
   with a clear message) instead of an unhandled exception / stack trace reaching the user.

2. **Missing file → `ENOENT` is catchable and distinguishable**
   ```
   $ node -e "try { fs.readFileSync('/tmp/orient-spike/nope.json','utf8') } catch(e) { console.log('CODE:', e.code) }"
   CODE: ENOENT
   ```
   `e.code === 'ENOENT'` lets the store module distinguish "first run, no store yet" (silently
   treat as empty list) from "file exists but is garbage" (the corruption case above) — these
   need different UX per the pitch ("behave sanely at the edges").

3. **Atomic-ish write with no dependencies**
   ```
   $ node -e "fs.writeFileSync('store2.json.tmp', JSON.stringify([...])); fs.renameSync('store2.json.tmp','store2.json')"
   ```
   `fs.renameSync` on the same filesystem is effectively atomic on darwin/linux (POSIX
   `rename(2)` semantics) — writing to a temp file then renaming avoids leaving a half-written
   store file if the process is killed mid-write. This needs zero dependencies.

**Conclusion**: the corruption/missing-file/safe-write requirements in the pitch are fully
achievable with Node core `fs` + `try/catch` + a write-to-tmp-then-rename pattern. No external
dependency (e.g. `proper-lockfile`, `write-file-atomic`) is required for a single-process CLI
tool — this de-risks the pitch's explicit "corrupted store file" edge case. `ba` can spec the
store module directly against this pattern rather than treating it as an open unknown.

**Residual (non-blocking) unknown**: concurrent invocations (two `todo` processes racing to
write) are not addressed by rename-based atomicity alone (last-writer-wins, no merge). The
pitch has no concurrency requirement and no-gos rule out server/sync, so this is accepted as
out of scope rather than re-spiked.
