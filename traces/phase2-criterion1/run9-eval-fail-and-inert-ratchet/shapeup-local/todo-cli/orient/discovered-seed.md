# Discovered-task seed — todo-cli

Open decisions and risks surfaced during orient that the scopes/board step should turn into
explicit tasks or explicit decisions, rather than leave implicit:

1. **Store file location is unspecified by the pitch.** Options: `./todo.json` (cwd-relative,
   truly zero-config but "which list am I editing" depends on shell cwd) vs `~/.todo.json` /
   `~/.config/todo/todo.json` (stable single global list, more conventional for a CLI). The pitch
   says "zero-config" and "local JSON file" — both readings are defensible. This needs to be
   pinned by the first storage task, not left to build-time improvisation.

2. **Corrupted-store recovery policy is unstated.** Spike confirmed `JSON.parse` throws cleanly
   and is catchable, but the pitch doesn't say what happens *after* catching: hard-fail with a
   message and exit code (safest — never silently destroys user data), or offer to reset to an
   empty store? Recommend hard-fail with a clear message; do not auto-overwrite a corrupted file
   without an explicit user action, since that risks silent data loss.

3. **Exit-code / stderr-vs-stdout convention is unstated.** The pitch says output must be
   "assertable" (for the no-TUI constraint) but doesn't pin whether errors go to stderr with
   non-zero exit vs stdout with exit 0. This affects every command's acceptance criteria and
   should be decided once, up front, so all four commands are consistent.

4. **1-based vs 0-based display/index convention for `done <n>` / `rm <n>`.** Spike shows the
   coercion pitfalls (`parseInt` prefix-parsing, `Number('')` → `0`, whitespace trimming) but the
   numbering convention itself (list shows `1) buy milk`, user types `done 1`) is a product
   decision, not just an implementation detail — should be explicit in the spec so evaluator and
   builder agree.

5. **No `package.json` / entry-point wiring exists yet.** `bin/todo.js` per the project profile
   doesn't exist. First task needs to also decide: plain Node script run via `node bin/todo.js`,
   or a `package.json` with a `bin` field for global install? The pitch's "zero-config" framing
   leans toward "just run the script," but this should be one explicit line in the spec rather
   than assumed.
