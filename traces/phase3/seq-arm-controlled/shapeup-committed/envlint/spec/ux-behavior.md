---
type: ux-spec
feature: envlint
entities: []
usecases: [UC-01]
screens: [HumanReadableOutput, JsonOutput, ToolErrorOutput]
tags: [ux, cli]
depends_on: ["[[domain-model]]"]
status: ready
---

# UX Behavior: envlint

This is a CLI, not a GUI — there are no screens in the visual sense. "Screen" below means one of
the three distinct **output modes** the binary can produce, each fully specified by
EXPECTED.md's Interface section. No colors, no TUI, no interactive prompts (explicit no-go) —
every mode is plain, assertable text on stdout or stderr.

## Screen Flow

```
$ envlint --schema <schema.json> [--json] <envfile>
                    │
      ┌─────────────┼──────────────────────┐
      │              │                      │
 tool error     zero findings          ≥1 finding
 (E1/E2/no       (clean file)          (parse or rule
  --schema)                             violation)
      │              │                      │
      ▼              ▼                      ▼
[ToolErrorOutput] [HumanReadableOutput   [HumanReadableOutput
  stderr, exit 2    or JsonOutput]         or JsonOutput]
                     stdout, exit 0        stdout, exit 1
```

`--json` selects `JsonOutput` instead of `HumanReadableOutput` for the two non-error branches;
it never changes which branch is taken or the exit code (INV-04).

---

## Screen: HumanReadableOutput

### States

| State | Trigger | Output Behavior | Exit Code |
|-------|---------|------------------|-----------|
| `clean` | schema + envfile both valid, `findings.length === 0` | stdout: `ok: N keys checked` (N = schema key count), nothing else | 0 |
| `findings` | `findings.length >= 1` | stdout: one line per finding, `<envfile>:<line>: <KEY>: <message>`, in the order findings were produced (file line order for parse/value findings; missing-required findings for keys absent from the file entirely use line `0`) — then a trailing summary line `N problem(s)` | 1 |

### Behavior Rules

- [RULE-01] Every finding line is `<envfile>:<line>: <KEY>: <message>` — the envfile path is
  exactly the argument as given (not resolved/absolutized), matching how a test would assert
  against a fixture path it wrote.
- [RULE-02] `<line>` is `0` only for a `required` key missing from the file entirely — every
  other finding carries the 1-based source line.
- [RULE-03] The `N problem(s)` summary is always printed last, after every per-finding line, and
  `N === findings.length`.
- [RULE-04] `KEY` for an E4 (malformed line) finding is the line text truncated to 30 characters,
  per EXPECTED.md E4 — there is no schema key to attribute it to.

### Error Catalog
(see UC-01 Error Cases table for the full E1–E5 + INV-derived set — this screen only renders
`findings`-branch errors; `ToolErrorOutput` below renders the exit-2 branch.)

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `E4` | a line is not blank/comment/`KEY=VALUE` | `<file>:<line>: <line text truncated to 30 chars>: not a KEY=VALUE assignment` | none — exits 1 after printing all findings |

---

## Screen: JsonOutput

### States

| State | Trigger | Output Behavior | Exit Code |
|-------|---------|------------------|-----------|
| `clean` | `--json` + `findings.length === 0` | stdout: exactly one JSON document `{"ok":true,"findings":[],"checked":N}`, nothing else on stdout | 0 |
| `findings` | `--json` + `findings.length >= 1` | stdout: exactly one JSON document `{"ok":false,"findings":[{"line":N,"key":"K","message":"..."}...],"checked":N}`, nothing else on stdout | 1 |

### Behavior Rules

- [RULE-05] Exactly one JSON document is written to stdout — no leading/trailing text, no
  pretty-print requirement, no second `console.log`.
- [RULE-06] `findings` array order matches `HumanReadableOutput`'s line order (same underlying
  `Finding[]`) — the two modes render the same data, not two independently-ordered views.
  **Assumption** (EXPECTED.md does not pin this ordering explicitly — flagged in the WorkResult
  `assumptions[]`; confirm with PO before treating a reorder as a regression).
- [RULE-07] `checked` matches the human-readable `N` in `ok: N keys checked` / `N problem(s)` —
  same source value, two renderings.

---

## Screen: ToolErrorOutput

### States

| State | Trigger | Output Behavior | Exit Code |
|-------|---------|------------------|-----------|
| `missing-schema-flag` | `--schema` not given | stderr: `Error: ` + reason, never a bare stack trace | 2 |
| `unreadable-env` | envfile path missing or unreadable | stderr: `Error: cannot read env file: <path>` (E1) | 2 |
| `invalid-schema-json` | schema file is not valid JSON | stderr: `Error: schema is not valid JSON: <path>` (E2) | 2 |
| `unreadable-schema` | schema path missing or unreadable | stderr: `Error: cannot read schema file: <path>` (symmetric with E1, not itself named in EXPECTED.md's E-list but required by "the schema file is missing or unreadable" in the Interface section) | 2 |

### Behavior Rules

- [RULE-08] Every exit-2 message goes to **stderr**, prefixed `Error: `, and is a single line —
  never a raw stack trace (explicit EXPECTED.md constraint: "worse than no linter").
- [RULE-09] `--json` does not change this branch's output stream or exit code — tool errors are
  never JSON-formatted, even when `--json` was passed (EXPECTED.md: "Exit codes are unchanged by
  `--json`"; the error message itself is plain text regardless of `--json`, since a tool error
  means no `LintReport` was ever produced).

### Error Catalog

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `E1` | env file missing/unreadable | `Error: cannot read env file: <path>` | exit 2 |
| `E2` | schema not valid JSON | `Error: schema is not valid JSON: <path>` | exit 2 |
| `E_NOFLAG` | `--schema` not given | `Error: ` + reason (message text not pinned by EXPECTED.md beyond the prefix — see UC-01 Error Cases) | exit 2 |
| `E_SCHEMA_UNREADABLE` | schema file missing/unreadable | `Error: cannot read schema file: <path>` | exit 2 |

---

## Platform Differences

N/A — single Node CLI binary, no mobile/web split.
