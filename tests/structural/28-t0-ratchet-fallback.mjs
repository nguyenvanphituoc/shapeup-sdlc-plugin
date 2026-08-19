// 28 — THE T0 RATCHET'S FIELD-NAME BUG, AND THE FALLBACK THAT SURVIVED IT (Phase 3.5 / S3).
//
// THE DEFECT THIS CLOSES. `kernel/verify/t0.mjs`'s ratchet read `contract.substrate?.allowed` —
// a path no `ScopeContract` has; every sibling reader uses `allowed_file_substrate`. The bound
// was therefore always `[]`, so `restore()` in `ratchet-tree.mjs` correctly refused on principle
// EVERY time ("no substrate pathspec ... refusing a repo-wide revert"), and the caller's own
// "first trial, nothing to restore to yet" fallback — gated on nothing but `!tree.ok` — fired on
// every subsequent restore too, silently promoting a FAILING attempt's tree as the new kept
// baseline. The fix reads the real field AND re-gates the fallback on "no prior kept trial
// exists" (`!baseline`, derived from `trials.jsonl`), not on "restore returned not-ok for any
// reason" — a field-name fix alone still falls through to the identical wrong behaviour on a
// genuine git-level restore failure that isn't the first-trial case.
//
// WHAT THIS MODULE PROVES, by driving `kernel/verify/t0.mjs`'s own CLI entry (`harness verify
// t0`) against a REAL git work tree and a REAL `ScopeContract` fixture carrying
// `allowed_file_substrate` — never by calling `restore()` in isolation, which is why the repo's
// existing suite never caught this:
//
//   (1) a scope's very first trial (empty `trials.jsonl`, so `baseline` is genuinely null) that
//       CRASHES still falls back to a real snapshot exactly as before — the no-regression case.
//   (2) a scope with an existing KEPT trial in `trials.jsonl` (`baseline` is NOT null) whose
//       current attempt is worse AND whose `restore()` call itself fails for a reason that is not
//       "no prior kept trial" — the tree must NOT be silently promoted: `tree_ref` stays `null`,
//       and the row carries no snapshot fallback.
//   (3) the field is read correctly end-to-end: a real, tracked, `allowed_file_substrate`-bound
//       file is actually rolled back by a real `git restore`, which is only possible when `own` is
//       populated from the right field in the first place.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/** Write a file (JSON object or raw string), creating its directory. */
function w(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return p;
}

/** One JSONL row per line, parsed; [] when the file is absent. */
function trialRows(p) {
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

/** A fresh, committed git work tree — `git()` runs inside it. */
function gitRepo() {
  const ws = mkdtempSync(join(tmpdir(), "struct-t0-ratchet-"));
  const g = (args) => spawnSync("git", args, { cwd: ws, encoding: "utf8" });
  g(["init", "-q", "-b", "main"]);
  g(["config", "user.email", "probe@example.invalid"]);
  g(["config", "user.name", "probe"]);
  mkdirSync(join(ws, "src", "exist"), { recursive: true });
  writeFileSync(join(ws, "src", "exist", "index.js"), "// baseline content\n");
  g(["add", "-A"]);
  g(["commit", "-q", "-m", "baseline"]);
  return { ws, g };
}

/**
 * Run the T0 ratchet field-name / fallback-gating checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");

  // =============================================================================
  section("28. The T0 ratchet reads the real substrate field, and its fallback is gated on baseline (Phase 3.5 / S3)");
  // =============================================================================

  // --- (1) first trial, no baseline, a genuine crash → falls back to a real snapshot, unchanged --
  {
    const { ws } = gitRepo();
    const outDir = mkdtempSync(join(tmpdir(), "struct-t0-ratchet-out-a-"));
    try {
      const contractPath = w(ws, "SC-CRASH.json", {
        schema_version: 1, scope_id: "SC-CRASH",
        allowed_file_substrate: ["src/exist/**"],
        // Overflows spawnSync's default maxBuffer, which is a genuine node-level spawn error
        // (`r.error` set) — the ONLY way `action` becomes "restore" with no prior trial at all,
        // since `better(next, null)` is unconditionally `true` otherwise.
        e2e_verification_fixtures: ["node -e \"process.stdout.write('x'.repeat(2*1024*1024))\""],
      });
      const r = spawnSync("node", [KERNEL, "verify", "t0", contractPath,
        "--round", "1", "--attempt", "1", "--cwd", ws, "--out", outDir, "--no-seesaw"],
        { cwd: ws, encoding: "utf8" });
      const rows = trialRows(join(outDir, "t0", "trials.jsonl"));
      const row = rows.find((t) => t.scope_id === "SC-CRASH");
      if (!row) fail(`verify t0 wrote no trial row for SC-CRASH's first trial (exit ${r.status}): ${(r.stderr || "").slice(0, 300)}`);
      else {
        if (row.status === "crash") ok("a crashed first attempt is recorded as `crash`, not silently swallowed");
        else fail(`a crashed first attempt recorded status ${JSON.stringify(row.status)}, not "crash"`);
        if (row.baseline_trial === null) ok("the first trial genuinely has no baseline — `baseline_trial` is null");
        else fail(`the first trial's baseline_trial was ${JSON.stringify(row.baseline_trial)}, expected null`);
        // No regression: with nothing to restore to, the fallback still takes a real snapshot,
        // exactly as it did before the fix — `tree_ref` is populated, not left null.
        if (row.tree_ref) ok("first trial + no baseline: the fallback still snapshots the tree, unchanged from before the fix");
        else fail("first trial + no baseline: the fallback did not snapshot the tree — a real, pre-existing behaviour regressed");
      }
    } finally { rmSync(ws, { recursive: true, force: true }); rmSync(outDir, { recursive: true, force: true }); }
  }

  // --- (2) existing kept trial + a genuine, non-"first-trial" restore failure → NOT promoted -----
  {
    const { ws } = gitRepo();
    const outDir = mkdtempSync(join(tmpdir(), "struct-t0-ratchet-out-b-"));
    try {
      // A baseline the application layer genuinely believes in — a prior KEPT trial on disk —
      // with NO matching shadow ref ever published in THIS repo (`refs/shapeup/SC-EXIST/kept`
      // does not exist). This is exactly the divergence the fix's `!baseline` gate has to survive:
      // `baseline` (from `trials.jsonl`) says "not the first trial"; `restore()` will still fail,
      // but for a git-level reason, not because this is genuinely trial one.
      const trialsPath = join(outDir, "t0", "trials.jsonl");
      mkdirSync(dirname(trialsPath), { recursive: true });
      writeFileSync(trialsPath, JSON.stringify({
        schema_version: 1, trial: 1, round: 1, attempt: 1, scope_id: "SC-EXIST", status: "kept",
        score: { regressions: 0, fixtures_passed: 1, fixtures_total: 1, db_probe: null },
        baseline_trial: null, at: "2026-08-19T00:00:00.000Z",
        artifact: "t0/verdicts/r1-a1-t1.json", sha256: "0".repeat(64),
      }) + "\n");

      const contractPath = w(ws, "SC-EXIST.json", {
        schema_version: 1, scope_id: "SC-EXIST",
        // A real, non-empty, field-name-correct pathspec — but it names a path this repo never
        // tracked, so `git restore --source=<ref> --worktree -- <paths>` genuinely fails once it
        // gets past the "no snapshot" check... which it cannot, because no ref exists either. The
        // failure this produces is "no snapshot at <ref>" at the git layer — but the trials.jsonl
        // baseline is what the fix's gate actually reads, and that baseline is NOT null, so the
        // buggy blanket fallback (`!tree.ok` alone) must not fire here.
        allowed_file_substrate: ["src/exist/**"],
        e2e_verification_fixtures: ["node -e \"process.exit(1)\""], // worse than baseline's 1/1
      });
      const r = spawnSync("node", [KERNEL, "verify", "t0", contractPath,
        "--round", "1", "--attempt", "2", "--cwd", ws, "--out", outDir, "--no-seesaw"],
        { cwd: ws, encoding: "utf8" });
      const rows = trialRows(trialsPath);
      const row = rows.find((t) => t.scope_id === "SC-EXIST" && t.trial !== 1) || rows[rows.length - 1];
      if (!row || rows.length < 2) fail(`verify t0 did not append a second trial for SC-EXIST (exit ${r.status}): ${(r.stderr || "").slice(0, 300)}`);
      else {
        if (row.status === "reverted") ok("a worse attempt against a real baseline is recorded as `reverted`");
        else fail(`a worse attempt against a real baseline recorded status ${JSON.stringify(row.status)}, expected "reverted"`);
        if (row.baseline_trial === 1) ok("the reverted trial's baseline_trial correctly points at the prior kept trial");
        else fail(`baseline_trial was ${JSON.stringify(row.baseline_trial)}, expected 1 — the ratchet lost track of its own baseline`);
        // THE ASSERTION THIS MODULE EXISTS FOR: a genuine restore failure, with a real baseline on
        // record, must not be silently promoted as the new kept tree.
        if (row.tree_ref === null) ok("a genuine restore failure with a real baseline on record is NOT silently promoted — tree_ref stays null");
        else fail(`tree_ref was ${JSON.stringify(row.tree_ref)} — a failing attempt with a real baseline on record was silently promoted as the new kept tree (the exact defect this module exists to catch)`);
      }
    } finally { rmSync(ws, { recursive: true, force: true }); rmSync(outDir, { recursive: true, force: true }); }
  }

  // --- (3) the field is read correctly end-to-end: a real restore actually rolls a file back -----
  {
    const { ws } = gitRepo();
    const outDir = mkdtempSync(join(tmpdir(), "struct-t0-ratchet-out-c-"));
    try {
      const contractPath = w(ws, "SC-ROLL.json", {
        schema_version: 1, scope_id: "SC-ROLL",
        allowed_file_substrate: ["src/exist/**"],
        e2e_verification_fixtures: ["node -e \"process.exit(0)\""], // trial 1: green → kept
      });
      const r1 = spawnSync("node", [KERNEL, "verify", "t0", contractPath,
        "--round", "1", "--attempt", "1", "--cwd", ws, "--out", outDir, "--no-seesaw"],
        { cwd: ws, encoding: "utf8" });
      const rows1 = trialRows(join(outDir, "t0", "trials.jsonl"));
      const kept = rows1.find((t) => t.scope_id === "SC-ROLL");
      if (!kept || kept.status !== "kept") fail(`SC-ROLL's first (green) trial did not come back "kept" (exit ${r1.status}): ${(r1.stderr || "").slice(0, 300)}`);
      else {
        ok("a green first trial is kept, publishing a real snapshot to restore to");
        // The attempt now writes into its own substrate, then goes red — worse than the kept
        // baseline (1/1 → 0/1) — so the ratchet should restore the file it just changed.
        writeFileSync(join(ws, "src", "exist", "index.js"), "// attempt 2 clobbered this file\n");
        const contractPath2 = w(ws, "SC-ROLL.json", {
          schema_version: 1, scope_id: "SC-ROLL",
          allowed_file_substrate: ["src/exist/**"],
          e2e_verification_fixtures: ["node -e \"process.exit(1)\""],
        });
        const r2 = spawnSync("node", [KERNEL, "verify", "t0", contractPath2,
          "--round", "1", "--attempt", "2", "--cwd", ws, "--out", outDir, "--no-seesaw"],
          { cwd: ws, encoding: "utf8" });
        const rows2 = trialRows(join(outDir, "t0", "trials.jsonl"));
        const reverted = rows2[rows2.length - 1];
        const restoredContent = readFileSync(join(ws, "src", "exist", "index.js"), "utf8");
        if (reverted && reverted.status === "reverted" && reverted.tree_ref) {
          ok("the worse second attempt was reverted, and `tree_ref` names the real restore, not a null/fallback state");
        } else fail(`the worse second attempt recorded ${JSON.stringify(reverted)} (exit ${r2.status}): ${(r2.stderr || "").slice(0, 200)}`);
        if (restoredContent.includes("baseline content")) {
          ok("`own` was populated from `allowed_file_substrate` — the real substrate glob — so `git restore` actually rolled the file back");
        } else fail(`the file under the scope's own substrate was NOT restored (reads ${JSON.stringify(restoredContent)}) — \`own\` is not being read from the field a real ScopeContract carries`);
      }
    } finally { rmSync(ws, { recursive: true, force: true }); rmSync(outDir, { recursive: true, force: true }); }
  }
}
