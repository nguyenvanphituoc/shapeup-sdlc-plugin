// 74 — a run that ships must not make the next run of the same pitch un-plannable.
//
// THE DEFECT THIS PINS, measured on a consumer rather than imagined. `reduce ship` freezes
// `REPORT.md` into the COMMITTED tier at GATE L4, and the report cited board ids. The
// committed-tier lint reds a `TASK-…` id anywhere in that tree — correctly, because boards live in
// the gitignored tier and renumber per machine, so the citation resolves on one machine and dangles
// on every other clone. The consequence is circular and was not noticed until a real run hit it:
// the artifact a SUCCESSFUL run writes is the thing that stops its SUCCESSOR. The measured run
// aborted at L1b with 23 red findings, all of them in `REPORT.md`, and `rounds_used: 0`.
//
// WHY THIS DRIVES THE CLI RATHER THAN `buildReport`. 47-ship-report.mjs already calls `generate()`
// in-process and now forbids a board id in what it returns. That is necessary and not sufficient:
// it proves the renderer is clean, never that the COMMAND writes a clean file to the committed
// path. This module spawns `harness reduce ship` and lints the file that command actually wrote,
// which is the only question the next run's spec-lint will ask.
//
// THREE SOURCES, and a fix that closes two of them still aborts the next run:
//   (a) the unfinished-task callout — `board.unfinished`, printed as a list of ids
//   (b) the covering-AC column's prefix — `${task_id}: ${ac}`
//   (c) INSIDE acceptance-criterion prose, where a planner wrote "…the seeded todos (TASK-006)…"
// (c) is upstream free text, so the sanitiser belongs at the write boundary, not at the column.
// The fixture below plants a board id in all three and requires the lint to find none.

import { existsSync, mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // ===============================================================================================
  section("126. A shipped REPORT.md is tier-clean — driven through `reduce ship`, linted on disk");
  // ===============================================================================================
  {
    const ws = mkdtempSync(join(tmpdir(), "ship-tier-126-"));
    const slug = "tierfx";
    try {
      const w = (p, body) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, body); };

      const opened = spawnSync(process.execPath, [
        join(ROOT, "kernel/harness.mjs"), "init", "run",
        "--slug", slug, "--intake-text", "A shipped report must not red its own successor",
        "--auto-level", "unattended", "--cwd", ws,
      ], { cwd: ws, encoding: "utf8", timeout: 60_000 });
      if (opened.status !== 0) {
        fail(`(setup) init run failed: ${(opened.stderr || opened.stdout || "").slice(0, 200)}`);
        return;
      }

      const task = (id, status, acs) => w(join(ws, ".shapeup", slug, "tasks", `${id}-x.md`), [
        "---", `id: ${id}`, "type: task", `feature: ${slug}`, `title: "${id} work"`,
        `status: ${status}`, "use_case_refs: [UC-ViewList]", "---", "",
        "## Acceptance Criteria", ...acs.map((a) => `- [ ] ${a}`), "",
      ].join("\n"));

      task("TASK-001", "done", ["the list renders (covers: REQ-1)"]);
      task("TASK-004", "in-progress", [
        "given the seeded todos (TASK-006) the filter matches without diacritics (covers: REQ-2)",
      ]);

      w(join(ws, "shapeup", slug, "requirements.md"), [
        "---", `feature: "[[${slug}]]"`, "registry: true", "---", "",
        "# Requirements Registry", "",
        "| REQ-id | Clause (verbatim) | Source | Status | Note |",
        "|---|---|---|---|---|",
        '| REQ-1 | "the list renders" | intake.md § Success | covered | |',
        '| REQ-2 | "the filter ignores diacritics" | intake.md § Success | covered | |',
        "",
      ].join("\n"));

      const ship = spawnSync(process.execPath, [
        join(ROOT, "kernel/harness.mjs"), "reduce", "ship",
        "--slug", slug, "--verdict", "not-evaluated", "--qa", "skipped", "--cwd", ws,
      ], { cwd: ws, encoding: "utf8", timeout: 60_000 });
      if (ship.status !== 0) {
        fail(`(setup) reduce ship failed: ${`${ship.stdout}${ship.stderr}`.slice(0, 200)}`);
        return;
      }

      const reportPath = join(ws, "shapeup", slug, "REPORT.md");
      if (!existsSync(reportPath)) {
        fail("(setup) reduce ship exited 0 but wrote no REPORT.md — a broken probe, not a failing one");
        return;
      }

      const { lintCommittedTier } = await import(join(ROOT, "kernel/verify/spec.mjs"));
      const findings = lintCommittedTier({ cwd: ws, slug }).filter((f) => f.rule === "TIER-DIRECTION");
      if (!findings.length) {
        ok("(a) the report `reduce ship` committed carries no board id — the next run of this pitch can still plan");
      } else {
        const lines = readFileSync(reportPath, "utf8").split("\n").filter((l) => /\bTASK-/.test(l));
        fail(`(a) the shipped report reds its own successor: ${findings.length} TIER-DIRECTION finding(s); ` +
             `offending line(s): ${lines.slice(0, 3).map((l) => l.trim().slice(0, 90)).join(" ⏎ ")}`);
      }

      // The disclosure must survive the sanitising. Losing the caveat to gain tier-cleanliness would
      // trade one silent failure for another: a report that no longer says work is unfinished reads
      // as "the feature is done".
      const md = readFileSync(reportPath, "utf8");
      if (/did not finish/.test(md) && md.includes("UC-ViewList")) {
        ok("(b) unfinished work is still disclosed, now anchored on the committed use case");
      } else {
        fail(`(b) the caveat was lost while making the report tier-clean: disclosed=${/did not finish/.test(md)} anchored=${md.includes("UC-ViewList")}`);
      }
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }
}
