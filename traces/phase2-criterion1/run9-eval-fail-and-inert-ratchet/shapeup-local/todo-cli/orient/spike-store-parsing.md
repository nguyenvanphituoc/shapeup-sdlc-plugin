# Spike — JSON store parsing & index-argument edges

Riskiest area per the pitch: *"It must behave sanely at the edges — empty list, bad index, a
corrupted store file — because a CLI that crashes on a typo is worse than no CLI."* Since there
is no code yet, the spike is throwaway Node run directly in a scratch dir (`/tmp/todo-cli-spike`,
outside the repo — nothing under this order's substrate touches production paths) to confirm the
actual runtime behavior the real implementation will have to guard against. Nothing here was
assumed; every line below was executed.

## 1. Corrupted store file → `JSON.parse` throws `SyntaxError`

```
$ printf '{not valid json,,,\n' > store.json
$ node -e "try { JSON.parse(fs.readFileSync('store.json','utf8')) } catch (e) { console.log(e.constructor.name, e.message) }"
caught: SyntaxError Expected property name or '}' in JSON at position 1 (line 1 column 2)
```
Confirms: a corrupted store is a synchronous, catchable `SyntaxError` — not a crash by default,
but only if the load path wraps `JSON.parse` in try/catch. An unguarded `JSON.parse` call left
bare *will* crash the whole process with a stack trace, which directly violates the pitch's "must
not crash on a typo" requirement. **Task implication: the store-read function must try/catch
around parse and produce a clean, user-facing error message + non-zero exit, not let the
exception propagate.**

## 2. Missing store file → `ENOENT`, not a crash-worthy case

```
$ node -e "try { fs.readFileSync('nope.json','utf8') } catch (e) { console.log(e.code, e.message) }"
caught: ENOENT ENOENT: no such file or directory, open 'nope.json'
```
First run (no store yet) is indistinguishable in mechanism from "corrupted file" unless handled
separately — `ENOENT` must be treated as "empty list, create fresh store on first write," not as
an error. Conflating these two catch branches would make `todo list` on a fresh install look like
a corruption error, which is the wrong UX.

## 3. Empty list is valid JSON, not a special case

```
$ echo '[]' > empty.json
$ node -e "const d = JSON.parse(fs.readFileSync('empty.json','utf8')); console.log(Array.isArray(d), d.length)"
true 0
```
No special-casing needed here beyond "print a friendly message when `list` sees a zero-length
array" — the parse path itself is uneventful.

## 4. Index-argument coercion (`done <n>` / `rm <n>`) has real footguns

```
$ node -e "for (const s of ['2','2.5','-1','0','abc','','  3  ','3abc']) console.log(JSON.stringify(s), Number(s), Number.isInteger(Number(s)))"
"2"      -> 2     isInt: true
"2.5"    -> 2.5   isInt: false
"-1"     -> -1    isInt: true
"0"      -> 0     isInt: true
"abc"    -> NaN   isInt: false
""       -> 0     isInt: true   <-- footgun: empty string coerces to 0, not NaN
"  3  "  -> 3     isInt: true   <-- footgun: whitespace silently trimmed
"3abc"   -> NaN   isInt: true is false, but parseInt('3abc') would give 3 -- footgun if parseInt used instead of Number
```
Confirms two concrete implementation risks the pitch's "bad index" requirement is actually about:
- **Do not use `parseInt` for arg coercion** — `parseInt('3abc')` silently returns `3` (parses a
  leading numeric prefix and ignores the rest), which would make `todo done 3abc` succeed instead
  of rejecting a bad index.
- **`Number('')` is `0`, not `NaN`** — an omitted argument (`todo done` with no `<n>`) must be
  checked for `undefined`/missing *before* numeric coercion, or it will silently resolve to index
  0 instead of erroring "missing argument."
- 1-based vs 0-based display index must be decided once and validated against array bounds
  (`n < 1 || n > list.length`) — `done 0` and `done -1` are both syntactically "integers" and
  need an explicit range check, not just `Number.isInteger`.

## Conclusion — this de-risks the board

The board's storage/parsing task should be written with an explicit, testable contract:
- read: `ENOENT` → empty list (not an error); `SyntaxError` → clean "corrupted store" error,
  non-zero exit, no stack trace.
- index args: reject non-integer, reject out-of-range, reject missing — via explicit checks, not
  bare `Number()`/`parseInt()` coercion trusted at face value.

This was the one real unknown in an otherwise trivial CLI; everything else (dispatch on
`process.argv[2]`, four subcommands, plain stdout) is standard and needs no spike.
