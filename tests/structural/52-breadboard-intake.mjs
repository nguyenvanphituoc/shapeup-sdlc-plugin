// Structural test module: the breadboard is a run input, and the four planning dispatches carry it.
// Sections: 83.
//
// A `/shapeup` pitch is two files — `shaping.md` and `breadboard.md` — and `init run` used to take
// one. It copied `--intake-file` and dropped the path it came from, so the breadboard's Places and
// affordances reached no worker, and a Place that only the breadboard named (a new blocking sheet)
// shipped folded into another screen with every check green. These checks pin the other half:
// found beside the intake (the layout the real consumer used, not only the documented one), staged
// byte for byte, hashed into the receipt, reported by `probe resume`, and sent by the workflow.
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

/** The `#`-column layout: Places, UI, code and store tables, a slicing table. */
export const BB_HASH_LAYOUT = `---
shaping: true
---

# Demo — Breadboard

## Places

| # | Place | Description |
|---|---|---|
| P1 | Composer | where a message is written |
| P2 | Payment Sheet | new blocking modal over the composer |
| P3 | Backend | order API |

## UI Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|---|---|---|---|---|---|
| U1 | P1 | composer | send button | click | → N1 | — |
| **U2** | P2 | sheet | pay button | click | → N1 | — |
| \`U3\` | P2 | sheet | cancel link | click | → P1 | — |

## Code Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|---|---|---|---|---|---|
| N1 | P3 | api | \`submit()\` | call | → S1 | — |
| N1b | P3 | api | \`retry()\` | call | → N1 | — |

## Data Stores

| # | Place | Store | Description |
|---|---|---|---|
| S1 | P3 | \`orders\` | persisted orders |

## Slicing

| # | Slice | Mechanism | Demo |
|---|---|---|---|
| V1 | Pay from the sheet | U2 → N1 | pay and see the receipt |
`;

/** The guide's "Output File" layout: prose Places, an `ID` column, a code table with no Place column. */
export const BB_ID_LAYOUT = `# Demo — Breadboard

## Places
P1: Composer — where a message is written
P2: Payment Sheet — new blocking modal over the composer
P3 — Backend

## UI Affordances
| ID | Place | Description | Wires Out | Returns To |
|----|-------|-------------|-----------|------------|
| U1 | P1 | send button | → N1 | — |
| U2 | P2 | pay button | → N1 | — |
| U3 | P2 | cancel link | → P1 | — |

## Code Affordances
| ID | Description | Wires Out | Returns To |
|----|-------------|-----------|------------|
| N1 | submit() | → S1 | — |
| N1b | retry() | → N1 | — |

## Stores
| ID | Description |
|----|-------------|
| S1 | persisted orders |

## Slicing
| # | Slice | Mechanism | Demo |
|---|-------|-----------|------|
| V1 | Pay from the sheet | U2 → N1 | pay |
`;

const SHAPING = `---
shaping: true
---

# Demo — Shaping

## Requirements

| R | Requirement |
|---|---|
| R0 | A customer can pay for an order |

## Parts

| Part | Mechanism |
|---|---|
| A1 | Payment flow |
`;

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

/**
 * Run the breadboard-intake checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx): ROOT, ok, fail,
 *   section. ok()/fail() mutate the counters in place.
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const node = (verbs, args, opts = {}) =>
    spawnSync("node", [KERNEL, ...verbs.split(" "), ...args], { encoding: "utf8", ...opts });
  const bbLib = await import(join(ROOT, "kernel/lib/breadboard.mjs"));

  /** A temp project with the given files; returns its root. */
  const project = (files) => {
    const ws = mkdtempSync(join(tmpdir(), "struct-breadboard-"));
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(dirname(join(ws, rel)), { recursive: true });
      writeFileSync(join(ws, rel), text, "utf8");
    }
    return ws;
  };
  const initRun = (ws, args) => node("init run", ["--slug", "demo", "--cwd", ws, ...args]);
  const receiptOf = (ws) => {
    try { return JSON.parse(readFileSync(join(ws, ".shapeup", "demo", "receipt.json"), "utf8")); }
    catch { return null; }
  };
  // THE LITERAL PATH, never the builder: a builder that moves the staged copy must turn this red,
  // and a test that asks the builder where the file is agrees with the builder by construction.
  const stagedAt = (ws) => join(ws, ".shapeup", "demo", "breadboard.md");
  const resumeOf = (ws) => {
    const r = node("probe resume", ["--slug", "demo", "--cwd", ws]);
    try { return JSON.parse(r.stdout); } catch { return null; }
  };
  const expectCounts = bbLib.idCounts(bbLib.parseBreadboard(BB_HASH_LAYOUT));

  // =============================================================================
  section("83. The breadboard reaches the run — found, staged verbatim, hashed, reported, dispatched");
  // =============================================================================

  // --- (a) the case study's layout: shaping.md and breadboard.md side by side ----------------
  {
    const ws = project({ "shapeup/demo/shaping.md": SHAPING, "shapeup/demo/breadboard.md": BB_HASH_LAYOUT });
    try {
      const r = initRun(ws, ["--intake-file", "shapeup/demo/shaping.md"]);
      const rec = receiptOf(ws);
      if (r.status === 0 && rec?.breadboard?.source === "sibling") ok("(a) a breadboard.md beside the intake is found as `sibling`");
      else fail(`(a) sibling breadboard not recorded: exit ${r.status}, receipt.breadboard=${JSON.stringify(rec?.breadboard)} ${r.stderr}`);
      if (rec?.breadboard?.sha256 === sha(BB_HASH_LAYOUT)) ok("(a) receipt.breadboard.sha256 is the source file's digest");
      else fail(`(a) receipt.breadboard.sha256 ${rec?.breadboard?.sha256} ≠ ${sha(BB_HASH_LAYOUT)}`);
      if (JSON.stringify(rec?.breadboard?.ids) === JSON.stringify(expectCounts) && expectCounts.P === 3 && expectCounts.U === 3)
        ok(`(a) receipt.breadboard.ids records the fixture's counts ${JSON.stringify(expectCounts)}`);
      else fail(`(a) receipt.breadboard.ids ${JSON.stringify(rec?.breadboard?.ids)} ≠ ${JSON.stringify(expectCounts)}`);
      if (rec?.breadboard?.path === "shapeup/demo/breadboard.md" && rec?.intake_source === "shapeup/demo/shaping.md")
        ok("(a) the receipt names both halves' repo-relative sources");
      else fail(`(a) receipt sources wrong: breadboard.path=${rec?.breadboard?.path} intake_source=${rec?.intake_source}`);
      const p = stagedAt(ws);
      if (existsSync(p) && readFileSync(p, "utf8") === BB_HASH_LAYOUT) ok("(a) .shapeup/demo/breadboard.md is a byte-identical staged copy");
      else fail(`(a) no byte-identical staged copy at ${p}`);
      let out = null; try { out = JSON.parse(r.stdout); } catch { /* reported below */ }
      if (out?.breadboard === ".shapeup/demo/breadboard.md" && out?.breadboard_source === "sibling") ok("(a) init run's stdout names the staged breadboard");
      else fail(`(a) stdout breadboard=${out?.breadboard} breadboard_source=${out?.breadboard_source}`);

      // --- (g) probe resume reports it -------------------------------------------------------
      const rs = resumeOf(ws);
      if (rs?.breadboard_path === p && rs?.breadboard_source === "sibling") ok("(g) probe resume reports breadboard_path and breadboard_source");
      else fail(`(g) probe resume: breadboard_path=${rs?.breadboard_path} breadboard_source=${rs?.breadboard_source}`);

      // --force re-open with no breadboard must not inherit the forced-over run's copy.
      rmSync(join(ws, "shapeup/demo/breadboard.md"));
      const f = initRun(ws, ["--intake-file", "shapeup/demo/shaping.md", "--force"]);
      if (f.status === 0 && !existsSync(p) && receiptOf(ws)?.breadboard === null) ok("(a) a --force re-open without a breadboard does not inherit the last run's copy");
      else fail(`(a) --force re-open inherited a breadboard: exit ${f.status}, staged=${existsSync(p)}, receipt=${JSON.stringify(receiptOf(ws)?.breadboard)}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // --- (b) the shaping/ layout is a sibling; an outside intake falls back to shaping-dir -----
  {
    const ws = project({ "shapeup/demo/shaping/shaping.md": SHAPING, "shapeup/demo/shaping/breadboard.md": BB_ID_LAYOUT });
    try {
      initRun(ws, ["--intake-file", "shapeup/demo/shaping/shaping.md"]);
      if (receiptOf(ws)?.breadboard?.source === "sibling") ok("(b) the shaping/ layout resolves as `sibling`");
      else fail(`(b) shaping/ layout: source=${receiptOf(ws)?.breadboard?.source}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
    const ws2 = project({ "elsewhere/pitch.md": SHAPING, "shapeup/demo/shaping/breadboard.md": BB_ID_LAYOUT });
    try {
      initRun(ws2, ["--intake-file", "elsewhere/pitch.md"]);
      const rec = receiptOf(ws2);
      if (rec?.breadboard?.source === "shaping-dir" && existsSync(stagedAt(ws2))) ok("(b) an intake outside the tree finds shapeup/<slug>/shaping/breadboard.md as `shaping-dir`");
      else fail(`(b) outside intake: source=${rec?.breadboard?.source}, staged=${existsSync(stagedAt(ws2))}`);
    } finally { rmSync(ws2, { recursive: true, force: true }); }
  }

  // --- (c) --breadboard beats a sibling; a missing --breadboard is a usage error ------------
  {
    const other = BB_ID_LAYOUT.replace("# Demo", "# Flagged");
    const ws = project({ "shapeup/demo/shaping.md": SHAPING, "shapeup/demo/breadboard.md": BB_HASH_LAYOUT, "flagged.md": other });
    try {
      initRun(ws, ["--intake-file", "shapeup/demo/shaping.md", "--breadboard", "flagged.md"]);
      const rec = receiptOf(ws);
      if (rec?.breadboard?.source === "flag" && readFileSync(stagedAt(ws), "utf8") === other) ok("(c) --breadboard beats a sibling breadboard");
      else fail(`(c) --breadboard lost to the sibling: source=${rec?.breadboard?.source}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
    const ws2 = project({ "shapeup/demo/shaping.md": SHAPING });
    try {
      const r = initRun(ws2, ["--intake-file", "shapeup/demo/shaping.md", "--breadboard", "nope.md"]);
      if (r.status === 2 && /--breadboard not found/.test(r.stderr) && !existsSync(join(ws2, ".shapeup", "demo", "receipt.json")))
        ok("(c) --breadboard <missing> exits 2 and opens no run");
      else fail(`(c) --breadboard <missing>: exit ${r.status}, stderr=${r.stderr.trim()}`);
    } finally { rmSync(ws2, { recursive: true, force: true }); }
  }

  // --- (d) --intake-text, no breadboard anywhere: behaviour as before ------------------------
  {
    const ws = project({});
    try {
      const r = initRun(ws, ["--intake-text", "Add category budgets with a monthly rollover"]);
      const rec = receiptOf(ws);
      if (r.status === 0 && rec && rec.breadboard === null && rec.intake_source === "text" && !existsSync(stagedAt(ws)))
        ok("(d) no breadboard: receipt.breadboard null, intake_source `text`, nothing staged");
      else fail(`(d) no-breadboard run: exit ${r.status}, breadboard=${JSON.stringify(rec?.breadboard)}, intake_source=${rec?.intake_source}, staged=${existsSync(stagedAt(ws))}`);
      const rs = resumeOf(ws);
      if (rs && rs.breadboard_path === null && rs.breadboard_source === null) ok("(g) probe resume reports null breadboard fields for a run without one");
      else fail(`(g) probe resume without a breadboard: ${rs?.breadboard_path} / ${rs?.breadboard_source}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // --- (e) a pitch carrying its breadboard inline: embedded, nothing staged -----------------
  {
    const ws = project({ "pitch.md": `${SHAPING}\n${BB_HASH_LAYOUT.replace(/^---[\s\S]*?---\n/, "")}` });
    try {
      initRun(ws, ["--intake-file", "pitch.md"]);
      const rec = receiptOf(ws);
      if (rec?.breadboard?.source === "embedded" && rec.breadboard.path === null && !existsSync(stagedAt(ws)))
        ok("(e) an intake embedding Places and UI tables records `embedded` and stages nothing");
      else fail(`(e) embedded: breadboard=${JSON.stringify(rec?.breadboard)}, staged=${existsSync(stagedAt(ws))}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // --- (f) both shipped layouts parse to the same counts ------------------------------------
  {
    const a = bbLib.idCounts(bbLib.parseBreadboard(BB_HASH_LAYOUT));
    const b = bbLib.idCounts(bbLib.parseBreadboard(BB_ID_LAYOUT));
    const want = { P: 3, U: 3, N: 2, S: 1, V: 1 };
    if (JSON.stringify(a) === JSON.stringify(want) && JSON.stringify(b) === JSON.stringify(want))
      ok("(f) the `#` layout and the `ID`/prose-Places layout parse to the same counts");
    else fail(`(f) layouts disagree: # → ${JSON.stringify(a)}, ID → ${JSON.stringify(b)}, want ${JSON.stringify(want)}`);
    const u = bbLib.parseBreadboard(BB_ID_LAYOUT);
    if (u.places.find((p) => p.id === "P2")?.name === "Payment Sheet" && u.ui.find((x) => x.id === "U2")?.places.join() === "P2" && u.code.every((n) => n.places.length === 0))
      ok("(f) prose Places keep their names, a Place column assigns U#, a table without one assigns nothing");
    else fail(`(f) parse detail wrong: ${JSON.stringify(u)}`);
    const multi = bbLib.parseBreadboard("| # | Place | X |\n|---|---|---|\n| U9 | P1 / P3 | x |\n| U10 | P2/P1 | y |\n");
    if (multi.ui.find((x) => x.id === "U9")?.places.join() === "P1,P3" && multi.ui.find((x) => x.id === "U10")?.places.join() === "P2,P1")
      ok("(f) a Place cell naming several Places keeps every one");
    else fail(`(f) multi-Place cell: ${JSON.stringify(multi.ui)}`);
    if (!bbLib.hasBreadboardTables(SHAPING) && bbLib.hasBreadboardTables(BB_HASH_LAYOUT)) ok("(f) a shaping doc's R#/A# tables are not a breadboard");
    else fail("(f) hasBreadboardTables misclassifies a shaping doc or a breadboard");
  }
}
