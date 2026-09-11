// Structural test module: spec-lint fails a spec that drops or misplaces a breadboard Place.
// Sections: 84.
//
// THE CASE THIS IS WRITTEN AGAINST. A breadboard named a new blocking sheet as its own Place, with
// three UI affordances. The spec had all three — inside one state row of the composer's screen — so
// a rule asking "is each U# cited?" passes it. What the run lost was the Place, and only a placement
// rule sees that: each Place with UI affordances has its own `## Screen: … (P#)` section, and each
// U# is cited inside the section of a Place the breadboard puts it in.
//
// Modelled on the invariant-floor module: the shipped `lintBreadboard()` is called directly for the
// rule's logic, and `verify spec` is run end to end for the wiring — the staged breadboard, the
// inline-in-the-intake fallback, and the exit code L1b aborts on.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/** The case study in miniature: P1 Composer (U1), P2 a new blocking sheet (U2, U3), P3 backend (N1). */
const MINI_BB = `# Demo — Breadboard

## Places

| # | Place | Description |
|---|---|---|
| P1 | Composer | where a message is written |
| P2 | Sheet | new blocking modal |
| P3 | Backend | order API |

## UI Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|---|---|---|---|---|---|
| U1 | P1 | composer | send button | click | → N1 | — |
| U2 | P2 | sheet | confirm button | click | → N1 | — |
| U3 | P2 | sheet | dismiss link | click | → P1 | — |

## Code Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|---|---|---|---|---|---|
| N1 | P3 | api | submit() | call | — | — |
`;

/** The same breadboard in the guide's "Output File" layout. */
const ID_LAYOUT_BB = `# Demo — Breadboard

## Places
P1: Composer — where a message is written
P2: Sheet — new blocking modal
P3: Backend — order API

## UI Affordances
| ID | Place | Description | Wires Out | Returns To |
|----|-------|-------------|-----------|------------|
| U1 | P1 | send button | → N1 | — |
| U2 | P2 | confirm button | → N1 | — |
| U3 | P2 | dismiss link | → P1 | — |

## Code Affordances
| ID | Description | Wires Out | Returns To |
|----|-------------|-----------|------------|
| N1 | submit() | — | — |
`;

/** The misplaced spec: the sheet's affordances folded into the composer's state table. */
const UX_FOLDED = `---
type: ux-spec
---

# UX Behavior: Demo

## Screen: Composer (P1)

### States

| State | Trigger | UI Behavior | CTA |
|---|---|---|---|
| \`idle\` | mount | U1 send enabled | enabled |
| \`confirming\` | U1 clicked | inline bar with U2 confirm and U3 dismiss | — |
`;

const UX_PLACED = `${UX_FOLDED}
## Screen: Sheet (P2)

### States

| State | Trigger | UI Behavior | CTA |
|---|---|---|---|
| \`open\` | U1 clicked | blocking sheet, U2 confirm, U3 dismiss | enabled |
`;

const UX_DEFERRED = `${UX_FOLDED}
## Deferred Places

| Place | Reason |
|---|---|
| P2 Sheet | the sheet is the next cycle's bet |
`;

/** Write a file, creating its directory. */
function w(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
  return p;
}

/**
 * A project whose spec tree lints clean on every non-breadboard rule, so any red is ours.
 * @param {object} o - `ux` (ux-behavior.md), `staged` (a staged breadboard), `intake` (intake.md).
 * @returns {string} The project root.
 */
function tree({ ux = null, staged = null, intake = null }) {
  const cwd = mkdtempSync(join(tmpdir(), "spec-breadboard-"));
  w(cwd, "shapeup/demo/spec/domain-model.md", "# Domain model\n");
  w(cwd, "shapeup/demo/spec/usecases/UC-Confirm.md", "# UC-Confirm\n\n## Steps\n1. confirm (N1)\n");
  if (ux !== null) w(cwd, "shapeup/demo/spec/ux-behavior.md", ux);
  if (staged !== null) w(cwd, ".shapeup/demo/breadboard.md", staged);
  if (intake !== null) w(cwd, ".shapeup/demo/intake.md", intake);
  return cwd;
}

/**
 * Run the breadboard-placement lint checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx): ROOT, ok, fail,
 *   section. ok()/fail() mutate the counters in place.
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { lintBreadboard, lint } = await import(join(ROOT, "kernel/verify/spec.mjs"));
  const verifySpec = (cwd) => {
    const r = spawnSync("node", [join(ROOT, "kernel/harness.mjs"), "verify", "spec", "--slug", "demo", "--cwd", cwd], { encoding: "utf8" });
    let report = null; try { report = JSON.parse(r.stdout); } catch { /* reported by the caller */ }
    return { status: r.status, report };
  };
  const bbOf = (fs) => fs.filter((f) => f.rule.startsWith("BREADBOARD-"));
  const reds = (fs, rule) => fs.filter((f) => f.rule === rule && f.level === "red");
  const direct = (ux, bb) => lintBreadboard({ uxText: ux, specText: `${ux}\n${ux.includes("N1") ? "" : "N1"}`, bbText: bb });

  // =============================================================================
  section("84. spec-lint places the breadboard — a folded or missing Place is red, citing is not placing");
  // =============================================================================

  // --- (a) the case study in miniature, end to end ------------------------------------------
  {
    const cwd = tree({ ux: UX_FOLDED, staged: MINI_BB });
    try {
      const { status, report } = verifySpec(cwd);
      const f = report?.findings ?? [];
      const place = reds(f, "BREADBOARD-PLACE");
      const ui = reds(f, "BREADBOARD-UI");
      if (status === 1) ok("(a) verify spec exits 1 on a spec that folds the sheet into the composer");
      else fail(`(a) verify spec exited ${status} on the folded spec: ${JSON.stringify(bbOf(f))}`);
      if (place.length === 1 && /\bP2\b/.test(place[0].detail)) ok("(a) BREADBOARD-PLACE is red and names P2");
      else fail(`(a) BREADBOARD-PLACE: ${JSON.stringify(place)}`);
      if (ui.length === 2 && ui.some((x) => /\bU2\b/.test(x.detail)) && ui.some((x) => /\bU3\b/.test(x.detail)) && ui.every((x) => /only under P1/.test(x.detail)))
        ok("(a) BREADBOARD-UI is red for U2 and U3, each reported as cited only under P1");
      else fail(`(a) BREADBOARD-UI: ${JSON.stringify(ui)}`);
      if (!bbOf(f).some((x) => /\bP3\b/.test(x.detail))) ok("(a) P3, a Place with no UI affordances, needs no screen");
      else fail(`(a) a finding names P3: ${JSON.stringify(bbOf(f))}`);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }

  // --- (b) the sheet gets its own screen ------------------------------------------------------
  {
    const cwd = tree({ ux: UX_PLACED, staged: MINI_BB });
    try {
      const { status, report } = verifySpec(cwd);
      const f = report?.findings ?? [];
      if (status === 0 && !bbOf(f).some((x) => x.level === "red")) ok("(b) with `## Screen: Sheet (P2)` citing U2 and U3, no BREADBOARD finding is red and verify spec exits 0");
      else fail(`(b) placed spec: exit ${status}, ${JSON.stringify(bbOf(f))}`);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }

  // --- (c) the sheet is deferred ----------------------------------------------------------------
  {
    const f = direct(UX_DEFERRED, MINI_BB);
    if (!f.some((x) => x.level === "red")) ok("(c) P2 listed under `## Deferred Places` leaves no red finding");
    else fail(`(c) deferred Place still reds: ${JSON.stringify(f)}`);
  }

  // --- (d) no breadboard anywhere: the rule set is off --------------------------------------
  {
    const cwd = tree({ ux: UX_FOLDED, intake: "# Raw idea\n\nLet a customer confirm an order.\n" });
    try {
      const f = lint({ cwd, slug: "demo" }).findings;
      if (bbOf(f).length === 0) ok("(d) no staged breadboard and a plain intake: zero BREADBOARD-* findings");
      else fail(`(d) BREADBOARD findings with no breadboard: ${JSON.stringify(bbOf(f))}`);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
    if (lintBreadboard({ uxText: UX_FOLDED, specText: UX_FOLDED, bbText: null }).length === 0) ok("(d) lintBreadboard with no breadboard returns []");
    else fail("(d) lintBreadboard fired with bbText null");
  }

  // --- (e) a breadboard inline in the intake ----------------------------------------------------
  {
    const cwd = tree({ ux: UX_FOLDED, intake: `# Pitch\n\nLet a customer confirm an order.\n\n${MINI_BB}` });
    try {
      const f = lint({ cwd, slug: "demo" }).findings;
      if (reds(f, "BREADBOARD-PLACE").length === 1 && reds(f, "BREADBOARD-UI").length === 2) ok("(e) with no staged copy, the rules fire from a breadboard inline in the intake");
      else fail(`(e) inline breadboard: ${JSON.stringify(bbOf(f))}`);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }

  // --- (f) the guide's "Output File" layout parses and lints ----------------------------------
  {
    const folded = direct(UX_FOLDED, ID_LAYOUT_BB);
    const placed = direct(UX_PLACED, ID_LAYOUT_BB);
    if (reds(folded, "BREADBOARD-PLACE").length === 1 && reds(folded, "BREADBOARD-UI").length === 2 && !placed.some((x) => x.level === "red"))
      ok("(f) the `ID`-column layout with prose Places lints the same as the `#` layout");
    else fail(`(f) ID layout: folded=${JSON.stringify(folded)} placed=${JSON.stringify(placed)}`);
  }

  // --- (g) a breadboard with no ids: a warning, never a stop -------------------------------------
  {
    const f = direct(UX_FOLDED, "# Breadboard\n\nWe sketched it on a whiteboard.\n\n- composer\n- a sheet\n");
    if (f.length === 1 && f[0].rule === "BREADBOARD-UNPARSED" && f[0].level === "warn") ok("(g) a breadboard with no ids yields only BREADBOARD-UNPARSED, at warn");
    else fail(`(g) id-less breadboard: ${JSON.stringify(f)}`);
  }

  // --- (h) the other ids warn and never block --------------------------------------------------
  {
    const f = lintBreadboard({ uxText: UX_PLACED, specText: UX_PLACED, bbText: MINI_BB });
    const t = f.filter((x) => x.rule === "BREADBOARD-TRACE");
    if (!f.some((x) => x.level === "red") && t.length === 1 && t[0].level === "warn" && /N1/.test(t[0].detail))
      ok("(h) an N# the spec never cites is one BREADBOARD-TRACE warning, not a red");
    else fail(`(h) trace: ${JSON.stringify(f)}`);
  }
}
