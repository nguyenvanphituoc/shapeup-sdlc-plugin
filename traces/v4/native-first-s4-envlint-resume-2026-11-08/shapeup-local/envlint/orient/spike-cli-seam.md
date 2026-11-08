# Spike — CLI seam (fixture-driven binary)

**Status: RESOLVED** (with residual unknowns that are spec decisions, not code unknowns).

## Risk triage (Phase 3)

| Area | Open unknowns | Integration risk | Rank |
|------|---------------|------------------|------|
| CLI seam (E3/E4) | exit codes, output format, error paths, whether a `node --test` suite can drive the binary on throwaway fixtures with builtins only | **High** — the pitch states the run is graded *by driving this binary*; it is the only piece that touches both other pieces, fs and process exit | **1 (spiked)** |
| Rules (E2) | schema format, `int`/`bool`/`url`/`enum` acceptance sets | Medium — pure, but acceptance sets are ambiguous | 2 |
| Parsing (E1) | quoting/escape/inline-comment/CRLF edge cases, `pairs` shape | Low-medium — pure, well-trodden format | 3 |

## GATE O-B (auto-confirmed, `pause_gates: false`)

- **Area:** CLI seam — `bin/envlint.mjs` driven from `test/`.
- **Question:** Can a `node:test` suite, with `node:` builtins only on Node 24, spawn
  `bin/envlint.mjs` against fixture files written to `os.tmpdir()` and assert deterministically on
  exit status, stdout and stderr for the pitch's edge cases (missing file, unreadable schema,
  bad arguments) — without the binary ever crashing with a stack trace?
- **Time-box:** 30 min.
- **Fallback:** if spawning were unreliable, `ba` would plan the CLI as an exported
  `main(argv, io) → exitCode` function tested in-process, with a thin `bin` shim.

## Probe (throwaway, deleted after the spike)

A 10-line `bin/envlint.mjs` stand-in and a 6-case probe suite, run with
`node --test test/cli.probe.mjs` inside a scratch dir. Stand-in:

```js
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
let a;
try { a = parseArgs({ args: process.argv.slice(2), options: { schema: { type: 'string' } }, allowPositionals: true, strict: true }); }
catch (e) { process.stderr.write(`usage: ${e.code}\n`); process.exit(2); }
try { readFileSync(a.positionals[0], 'utf8'); } catch (e) { process.stderr.write(`cannot read: ${e.code}\n`); process.exit(2); }
try { JSON.parse(readFileSync(a.values.schema, 'utf8')); } catch (e) { process.stderr.write(`bad schema: ${e.name} ${e.code ?? ''}\n`); process.exit(2); }
process.stdout.write('ok\n'); process.exit(0);
```

Harness pattern:

```js
const BIN = fileURLToPath(new URL('../bin/envlint.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });
// fixtures: mkdtempSync(join(tmpdir(), 'el-')) + writeFileSync(...)
```

Result: **6/6 pass**, ~35 ms per spawn, ~280 ms total.

| Case | Observed |
|------|----------|
| valid fixture pair | status 0, stdout `ok\n` |
| missing env/schema path | status 2, stderr carries `ENOENT` |
| schema file `{` | status 2, `JSON.parse` throws `SyntaxError` |
| unknown flag `--bogus` | `parseArgs` strict throws `ERR_PARSE_ARGS_UNKNOWN_OPTION` |
| directory passed as envfile | `readFileSync` throws `EISDIR` |
| no positional envfile | `readFileSync(undefined)` throws `ERR_INVALID_ARG_TYPE` — **a crash unless the CLI checks positional count itself** |

## Answer

Yes. `node:test` + `child_process.spawnSync(process.execPath, [BIN, ...])` + `os.tmpdir()`
fixtures is a reliable, builtin-only way to grade the binary; `node:util` `parseArgs` (strict)
handles `--schema <path> <envfile>` and gives coded errors for bad flags. Every edge case in the
pitch maps to a distinct, catchable error code, so "never crash" is achievable by wrapping each
I/O step. Spawning via `process.execPath` avoids depending on a shebang or exec bit.

## Findings that must reach the plan

1. **Argument validation is the CLI's own job.** `parseArgs` does not enforce a required option or a
   positional count: missing `--schema`, zero or 2+ positionals must be checked explicitly, or the
   tool throws (`ERR_INVALID_ARG_TYPE`) with a stack trace.
2. **Error kinds are distinguishable**: ENOENT / EACCES / EISDIR (read) vs `SyntaxError` (schema
   JSON) vs a schema that parses but is structurally invalid (needs its own check in the CLI or
   Rules).
3. **`node --test` with zero test files exits green** (verified at repo root: `tests 0 … pass 0`).
   The round build gate (`build_probe: node --test`) proves nothing until test files exist.
4. Exit code 2 for usage/IO errors vs 1 for findings is **the probe's assumption, not a
   requirement** — the pitch only says "non-zero". `ba` must pin it.

## Residual unknowns (spec decisions, not code risk)

Exit-code values; output line format and stream (stdout vs stderr); ordering of findings; the
schema file format; the finding shape the CLI prints (see `code-surface.md` C1–C3).
