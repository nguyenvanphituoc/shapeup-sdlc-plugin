# Spike — Rules value types (`int` / `url` / `bool`)

## Why this area (Phase 3 triage)

Greenfield, zero-dependency, so there is no third-party SDK and no existing data to confirm.
Ranking (open unknowns × integration risk):

| Area | Unknowns | Integration risk | Rank |
|------|----------|------------------|------|
| Rules value types (`int`/`url`/`bool`) | predicate semantics; tempting builtins may false-accept | high — the pitch's core promise ("tells them exactly what is wrong", `intake.md:11`) and the "`url` validates the shape only, no network" boundary (`intake.md:41`) both rest on it; a lax predicate passes tests written by the same hand and fails EVAL's edge probes | **1 (spiked)** |
| `pairs` shape contract Parse → Rules | shape unspecified | high, but it is a **spec decision**, not a technical unknown — no amount of code reading answers it | 2 (known unknown → hill-signal) |
| Parse quoting grammar | inline `#`, escapes, unterminated quotes | medium — pure, self-contained, fully fixture-testable | 3 |
| CLI exit codes / output format / edge files | unspecified | medium — spec decision | 4 |

## GATE O-B (auto-confirmed; order has `interaction.pause_gates: false`)

- **Area**: Rules value-type predicates.
- **Question**: Can `int` and `url` be decided by Node builtins (`Number`, `Number.isInteger`, `new URL`/`URL.canParse`) without false accepts on values a `.env` linter should reject?
- **Time-box**: 30 min.
- **Fallback**: if unresolved, `ba` writes explicit accept/reject example tables per type into the spec and Rules implements anchored regexes.

## Method

Throwaway probe `probe-types.mjs` in the orient dir, run with Node v24.15.0, then deleted. Source:

```js
const urls = ["https://a.b", "http://localhost:3000", "localhost:3000", "mailto:x@y", "ftp://x",
  "javascript:alert(1)", "not a url", "postgres://u:p@h:5432/db", "https://", "http:/x",
  "file:///etc/passwd", "", "https://exa mple.com"];
for (const s of urls) { /* new URL(s) → protocol/host or throw code; URL.canParse(s) */ }
for (const s of ["42","-1","+3","1e3","0x10"," 7","07","3.0","9007199254740993",""]) {
  /* /^[+-]?\d+$/.test(s), Number.isInteger(Number(s)), Number(s) */ }
```

## Results (verbatim)

```
url "https://a.b" OK protocol=https: host="a.b" canParse=true
url "http://localhost:3000" OK protocol=http: host="localhost:3000" canParse=true
url "localhost:3000" OK protocol=localhost: host="" canParse=true
url "mailto:x@y" OK protocol=mailto: host="" canParse=true
url "ftp://x" OK protocol=ftp: host="x" canParse=true
url "javascript:alert(1)" OK protocol=javascript: host="" canParse=true
url "not a url" THROW ERR_INVALID_URL canParse=false
url "postgres://u:p@h:5432/db" OK protocol=postgres: host="h:5432" canParse=true
url "https://" THROW ERR_INVALID_URL canParse=false
url "http:/x" OK protocol=http: host="x" canParse=true
url "file:///etc/passwd" OK protocol=file: host="" canParse=true
url "" THROW ERR_INVALID_URL canParse=false
url "https://exa mple.com" THROW ERR_INVALID_URL canParse=false
int "42" regex=true Number.isInteger(Number)=true Number=42
int "-1" regex=true Number.isInteger(Number)=true Number=-1
int "+3" regex=true Number.isInteger(Number)=true Number=3
int "1e3" regex=false Number.isInteger(Number)=true Number=1000
int "0x10" regex=false Number.isInteger(Number)=true Number=16
int " 7" regex=false Number.isInteger(Number)=true Number=7
int "07" regex=true Number.isInteger(Number)=true Number=7
int "3.0" regex=false Number.isInteger(Number)=true Number=3
int "9007199254740993" regex=true Number.isInteger(Number)=true Number=9007199254740992
int "" regex=false Number.isInteger(Number)=true Number=0
node:test function version v24.15.0
```

## Answer — RESOLVED: **No**, builtins alone false-accept

**`int`**: `Number.isInteger(Number(s))` accepts `""` (→ 0), `" 7"`, `"1e3"`, `"0x10"`, `"3.0"`.
An empty `PORT=` would pass as an int. Only an anchored regex on the raw string
(`/^[+-]?\d+$/` or `/^-?\d+$/`) rejects them. Values beyond 2^53 lose precision when converted
(`9007199254740993` → `…992`), so the predicate must judge the **string**, never a converted
number. Open choices for the spec: allow leading `+`? allow leading zeros (`07`)?

**`url`**: `URL.canParse` / `new URL` accept any `scheme:` string — `localhost:3000` parses as
protocol `localhost:` with empty host; `javascript:alert(1)`, `mailto:x@y`, `file:///…`, and the
malformed `http:/x` (normalised to host `x`) all pass. It does correctly reject `""`, `"not a url"`,
`"https://"` and embedded spaces. It makes no network call (consistent with `intake.md:41`).
A shape-only `url` type needs `URL.canParse` **plus** at least one extra rule; options for the spec:
- (a) require non-empty `host` after parsing (rejects `localhost:3000`, `mailto:`, `javascript:`, `file:///`), and/or
- (b) require the raw string to contain `://` (rejects `http:/x`, which `new URL` silently repairs), and/or
- (c) a protocol allowlist (`http:`/`https:` only) — stricter; would reject `postgres://…`, a common `.env` value (`DATABASE_URL`).

Recommended for `ba` to pin: (a)+(b), no allowlist — accepts `postgres://u:p@h:5432/db`, rejects
the shapes above. This is a recommendation, not a decision; the spec owns it.

**`bool`**: **not probed** — no builtin exists; the accepted spellings (`true/false` only? `1/0`?
`yes/no`? case-insensitive?) are a pure spec decision. Left as an open unknown.

**`string`**: trivially any value; open only on whether empty string satisfies it.

## Residual unknowns (carried to hill-signal)

- Exact `int` grammar (`+`, leading zeros) and `bool` spellings — spec must list accept/reject examples.
- Choice among url options (a)/(b)/(c).
- Whether an empty value (`KEY=`) satisfies `required` and is then type-checked.
