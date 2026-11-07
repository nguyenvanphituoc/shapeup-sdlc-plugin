# Hunt Report — personal-site (round 1, 2026-11-08)
charters: 4/4 · session units spent: 4
deliverable reached: `node build.mjs` driven via CONTENT_FILE/OUT_DIR over temp files (no app_url, no launch_cmd in the order); build gate r1-t1 green (node --test 14/14). EVAL verdict: PASS.
out of bounds (excluded): none stated (pause_gates false, no questions asked)
hammered out at GATE Q1 (not hunted): lens ② concurrency, lens ⑥ data residue beyond stale-output (single-shot CLI, no session or shared state). Charters were not reviewed (pause_gates false).
Note: `shapeup/knowledge-base/qa-edge-hunter.md` is absent, so no retro guidance applied.

## Findings by lens
| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| ① Boundary | C-01 name types, C-02 url/optional-field types, C-03 control chars/size | QA-001..005 | 0 |
| ③ State interruption | C-04 failed build over prior output, BOM input | QA-006 | 0 |
| ⑤ No-go | C-04 unspecified path failures (OUT_DIR) | QA-007 | 0 |
| ② / ④ / ⑥ | not hunted | 0 | 0 |

Details are returned in the WorkResult `discoveries[]` (all `~`); ingest appends them to the ledger.

Checked and held (not findings): HTML/attribute escaping of quotes and `&` in url and mailto; missing, empty, non-object and array JSON content give a coded one-line stderr and exit 1; CONTENT_FILE pointing at a directory gives CONTENT_MISSING; `__proto__` and lone-surrogate names do not break the build.

## Shaping-quality signal (advisory)
- lens ① cluster (QA-001..005) suggests the pitch bounds only the presence of `name`, not field types or shapes.
- lens ⑤ (QA-007) suggests path and output-dir failure modes were left loose in the pitch.

## Session notes
Probe script: `.shapeup/personal-site/qa/hunt-probe.mjs`. Every finding was reproduced in a single scripted run against build.mjs. Open scents: none. No time box expired.
