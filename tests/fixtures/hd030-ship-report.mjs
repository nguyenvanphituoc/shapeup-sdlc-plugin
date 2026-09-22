#!/usr/bin/env node
// hd030-ship-report.mjs — a run that ships must not make the next run of the same pitch
// un-plannable.
//
// `reduce ship` freezes `REPORT.md` into the COMMITTED tier at GATE L4. The committed-tier lint
// reds a board id (`TASK-…`) anywhere in that tree, correctly: boards live in the gitignored tier
// and renumber per machine, so a committed citation resolves on one machine and dangles on every
// other. Measured on a consumer: a shipped report carried 23 of them and the NEXT run of that pitch
// hard-aborted at L1b with `rounds_used: 0`.
//
// DRIVES THE REAL ENTRY POINT, never the renderer in isolation: it opens a run, writes a board and
// a registry, spawns `harness reduce ship`, and lints the file that command actually wrote. A
// fixture that called `buildReport` directly would pass over a pipeline that still writes the
// violation (this repo's own rule: a fixture calling your function directly cannot see whether
// anything calls it).
//
// The fixture plants a board id in all THREE places the real report drew them from, because a fix
// that closes two of three still aborts the next run:
//   1. the unfinished-task callout        — `board.unfinished` ids, printed as a list
//   2. the covering-AC column's prefix    — `${task_id}: ${ac}`
//   3. INSIDE the acceptance-criterion prose itself — the BA writes "…the seeded todos (TASK-006)…"
// The third is the one a structured fix misses: it is free text, authored upstream, and it has to
// be sanitised at the write boundary rather than at the column.
//
// Usage: node tests/fixtures/hd030-ship-report.mjs [--keep]
// Exits 0 when the shipped report is clean, 1 when it still carries board ids, 2 on a broken probe.

import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SLUG = "hd030fx";
const keep = process.argv.includes("--keep");

const ws = mkdtempSync(join(tmpdir(), "hd030-"));
process.env.SHAPEUP_DECISIONS_PATH = join(ws, "decisions.jsonl");

/** Write a file, creating its directory. */
const w = (p, body) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, body); };

try {
  const opened = spawnSync(process.execPath, [
    join(ROOT, "kernel/harness.mjs"), "init", "run",
    "--slug", SLUG, "--intake-text", "Ship a report that does not red its own successor",
    "--auto-level", "unattended", "--cwd", ws,
  ], { cwd: ws, encoding: "utf8", timeout: 60_000 });
  if (opened.status !== 0) {
    console.error(`CANNOT OPEN FIXTURE RUN (exit ${opened.status}): ${opened.stderr || opened.stdout}`);
    process.exit(2);
  }

  // (1) + (2) + (3): a board whose ids reach the report three different ways.
  const task = (id, status, acs) => w(join(ws, ".shapeup", SLUG, "tasks", `${id}-x.md`), [
    "---", `id: ${id}`, "type: task", `feature: ${SLUG}`, `title: "${id} work"`,
    `status: ${status}`, "use_case_refs: [UC-ViewList]", "---", "",
    "## Acceptance Criteria",
    ...acs.map((a) => `- [ ] ${a}`), "",
  ].join("\n"));

  task("TASK-001", "done", ["the list renders (covers: REQ-1)"]);
  // unfinished -> the callout; and its AC prose names ANOTHER task id inline.
  task("TASK-004", "in-progress", [
    "given the seeded todos (TASK-006) the filter matches without diacritics (covers: REQ-2)",
  ]);

  w(join(ws, "shapeup", SLUG, "requirements.md"), [
    "---", `feature: "[[${SLUG}]]"`, "registry: true", "---", "",
    "# Requirements Registry", "",
    "| REQ-id | Clause (verbatim) | Source | Status | Note |",
    "|---|---|---|---|---|",
    '| REQ-1 | "the list renders" | intake.md § Success | covered | |',
    '| REQ-2 | "the filter ignores diacritics" | intake.md § Success | covered | |',
    "",
  ].join("\n"));

  const ship = spawnSync(process.execPath, [
    join(ROOT, "kernel/harness.mjs"), "reduce", "ship",
    "--slug", SLUG, "--verdict", "not-evaluated", "--qa", "skipped", "--cwd", ws,
  ], { cwd: ws, encoding: "utf8", timeout: 60_000 });
  if (ship.status !== 0) {
    console.error(`reduce ship failed (exit ${ship.status}): ${`${ship.stdout}${ship.stderr}`.slice(0, 500)}`);
    process.exit(2);
  }

  const reportPath = join(ws, "shapeup", SLUG, "REPORT.md");
  if (!existsSync(reportPath)) {
    console.error(`reduce ship exited 0 but wrote no REPORT.md at ${reportPath} — broken probe`);
    process.exit(2);
  }

  // THE ACTUAL QUESTION: does the committed-tier lint red the file this run just committed?
  const { lintCommittedTier } = await import(join(ROOT, "kernel/verify/spec.mjs"));
  const findings = lintCommittedTier({ cwd: ws, slug: SLUG })
    .filter((f) => f.rule === "TIER-DIRECTION");

  if (!findings.length) {
    console.log("SHIPPED REPORT IS TIER-CLEAN — the next run of this pitch can still plan");
    process.exit(0);
  }
  console.error(`SHIPPED REPORT REDS ITS OWN SUCCESSOR: ${findings.length} TIER-DIRECTION finding(s).`);
  for (const f of findings.slice(0, 6)) console.error(`  - ${f.detail.slice(0, 160)}`);
  const body = readFileSync(reportPath, "utf8");
  for (const line of body.split("\n")) {
    if (/\bTASK-/.test(line)) console.error(`  report: ${line.slice(0, 150)}`);
  }
  process.exit(1);
} finally {
  if (keep) console.error(`(kept fixture at ${ws})`);
  else rmSync(ws, { recursive: true, force: true });
}
