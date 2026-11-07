---
type: eval-report
feature: personal-site
task: FEATURE (round 1)
verdict: pass
dimensions_run: [spec-conformance, tdd-surface, completeness, test-surface-conformance]
dimensions_ignored: [integration, security, performance]
bug_count: 0
browser_mode: none
evaluator: spec-evaluator
eval_at: 2026-11-08
linked_docs: ["[[usecases/UC-BuildPage]]", "[[domain-model]]", "[[ux-behavior]]", "[[_index]]"]
t0_citation: { scope_id: site-build, artifact: t0/verdicts/r1-a1-t1.json, sha256: 8965bee3276344007203acc5c4657a71b3d581efe609ab9e5b478f172dcf469a }
---

OVERALL: PASS — all 4 active dimensions pass (31 criteria, 0 FAIL). 0 bugs. Ignored: integration, security, performance.

Oracle: process (CLI deliverable). Evidence comes from two sources: the order's named command
`node --test test/build.test.mjs`, which I ran myself (exit 0, 13 tests, 13 pass, 0 fail), and an
independent probe I wrote, `evaluation/evidence/probe-r1.mjs`, which spawns `node build.mjs` as a
process with its own inputs, separate from the generator's tests. Its inputs are harder than the
suite's: six unsafe URL schemes (`javascript:` with mixed case, a leading newline or an embedded tab,
plus `data:` and `vbscript:`), a whitespace-only url, `name` = `null` and `name` = `["x"]`, a missing
file inside a missing directory, the no-env default paths, and escaping in `<title>`/summary. The
probe's own output is quoted per row below.

## T0 citation
| scope | artifact | sha256 (recomputed) | state |
|---|---|---|---|
| site-build | `.shapeup/personal-site/t0/verdicts/r1-a1-t1.json` | `8965bee3276344007203acc5c4657a71b3d581efe609ab9e5b478f172dcf469a` | green, fixtures 1/1 |

I computed the digest twice: once with `harness probe t0 --slug personal-site --scope site-build --round 1`
and once with node:crypto inside the probe. The two agree. The check file `test/build.test.mjs`
currently hashes to `c1c09fb8…de2fcf6`, which is the same value as `check_files` in the T0 artifact.
So the suite I ran is the suite T0 graded. The build gate `.shapeup/personal-site/build/r1-t1.json`
(sha256 `f4d63701…362ff6`) is green, with build_probe exit 0 at 13/13. It also carries a warning
(the ledger declares no run_cmd); that warning is noted and does not affect any grade. No
`revised_checks` and no `scopes_without_t0`.

## test-surface-conformance — PASS (threshold: every row PASS)
| row | verdict | conf | evidence |
|---|---|---|---|
| TS-INV-01 | PASS | high | suite ✔; probe: 6 unsafe urls → exit 0, 0 `<a>`, no `<script`, no `javascript:`, titles T0–T5 present as text |
| TS-INV-02 | PASS | high | suite ✔; probe: content sha256 cde1178e… before = after two runs |
| TS-INV-03 | PASS | high | suite ✔; probe: two runs → index.html sha256 41a3fd9c… both, single trailing `\n` |
| TS-INV-04 | PASS | high | suite ✔; probe: `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`, no `<b>`/`<i>`, `href="mailto:a&quot;b&lt;c&gt;@example.org"`, `<title>N &amp; &lt;Co&gt;</title>` |
| TS-INV-05 | PASS | high | suite ✔; probe: h1s=[`<h1>Grace Hopper</h1>`], title=name, offsets 422<447<497<578<809, 2 cards, 1 `<style>` in head, no `<link>` |
| TS-INV-06 | PASS | high | suite ✔; probe: url absent / `""` / `"   "` → no `<a>`, no `href="#"`, no `href=""`, no undefined/null |
| TS-INV-07 | PASS | high | suite ✔; probe: `projects: []` and absent → "Projects are coming soon.", no ul/ol/li |
| TS-ERR-CONTENT_MISSING | PASS | high | suite ✔; probe: exit 1, one line `error: content file not found: <path>`, no out dir |
| TS-ERR-CONTENT_UNPARSEABLE | PASS | high | suite ✔; probe: exit 1, one line naming the file + parse error, no out dir |
| TS-REQ-name-missing | PASS | high | suite ✔; probe: exit 1, one line naming `"name"`, nothing written |
| TS-REQ-name-type | PASS | high | suite ✔; probe: 42, "", null, ["x"] → each exit 1, one line naming `"name"`, nothing written |
| TS-NOGO-01 | PASS | high | suite ✔; probe: literal `**bold** _x_ # h`, no strong/em |
| TS-NOGO-02 | PASS | high | suite ✔; probe: lone copy in empty temp dir → exit 0, no node_modules; package.json has no `dependencies` |

I read each check in `test/build.test.mjs` against its row's Expect. Every check asserts at least
what its row asks for, and none is weaker.

## completeness — PASS (threshold: every Invariant holds)
| criterion | verdict | conf | evidence |
|---|---|---|---|
| UC-BuildPage INV-01 | PASS | high | as TS-INV-01; `safeUrl` admits only http/https/relative |
| UC-BuildPage INV-02 | PASS | high | as TS-INV-02 |
| UC-BuildPage INV-03 | PASS | high | as TS-INV-03 |
| UC-BuildPage INV-04 | PASS | high | as TS-INV-04 (text + both href kinds + title) |
| UC-BuildPage INV-05 | PASS | high | as TS-INV-05 |
| UC-BuildPage INV-06 | PASS | high | as TS-INV-06 |
| UC-BuildPage INV-07 | PASS | high | as TS-INV-07 |

## spec-conformance — PASS (threshold: all [cmd] criteria + Error Cases + Non-Go)
| criterion | verdict | conf | evidence |
|---|---|---|---|
| UC-BuildPage Step 1 (path resolution, defaults) | PASS | high | probe: no env, `content.json` in cwd → exit 0, empty stderr, `dist/` holds only index.html |
| UC-BuildPage Steps 2–5 (load, validate, render, write) | PASS | high | env-pointed runs write only `<OUT_DIR>/index.html` (TS-INV-05 probe) |
| UC-BuildPage Step 6 (error path never reaches write) | PASS | high | probe: default path, no content.json → exit 1, one line naming `<cwd>/content.json`, no `dist/` |
| Error case CONTENT_MISSING | PASS | high | as TS-ERR-CONTENT_MISSING |
| Error case CONTENT_UNPARSEABLE | PASS | high | as TS-ERR-CONTENT_UNPARSEABLE; line names file and parse failure |
| Error case NAME_MISSING | PASS | high | as TS-REQ-name-missing / -type |
| domain-model SiteContent optional fields render empty | PASS | high | probe: `{name, projects:[{title}], contact:{}}` → exit 0, About/Contact headings present, no undefined/null |
| _index Non-Go (no deps, no network, no page JS, no content write, no Markdown) | PASS | high | TS-NOGO-01/02, TS-INV-01/02; build.mjs imports only node:fs, node:path |

## tdd-surface — PASS
| criterion | verdict | conf | evidence |
|---|---|---|---|
| named fixture `node --test test/build.test.mjs` exits 0 with > 0 tests | PASS | high | run by evaluator: tests 13, pass 13, fail 0; T0 + build gate agree |
| one named test per Test Surface row | PASS | high | 13 tests named TS-INV-01…07, TS-ERR-×2, TS-REQ-×2, TS-NOGO-×2 = all 13 rows |
| check file unchanged since T0 | PASS | high | sha256 c1c09fb8… = T0 `check_files` |

Side note, which is not a criterion: `npm test` (package.json → bare `node --test`) also exits 0 at 13/13.

## Verdict stability (run 1)
- This is the first evaluation of personal-site, and no `.verdicts-*.jsonl` exists yet, so there is no history. This run is the baseline.
- No criterion FAILed, so nothing needed a re-probe. Every PASS is backed by two independent runs, the suite and the probe, and they agree.
- Stability: 31/31.

## Bugs
None.

## Next action
→ Round 1 of personal-site is verified against [spec-conformance, tdd-surface, completeness,
  test-surface-conformance]. It is safe for the orchestrator to proceed to QA / Ship.
  (Note: integration, security and performance were NOT evaluated in this run.)
