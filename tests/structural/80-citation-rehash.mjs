// 80 — HD-043: a T0 citation was a presence check, and the schema has always promised a re-hash.
// Section 133.
//
// THE DEFECT. `citationProblem()` accepted ANY non-empty `t0_citations[]` on a scoped PASS/FAIL,
// whatever it pointed at — its own comment said "PRESENCE, NOT HASHES" as if that were the design,
// while `domain.schema.json`'s own `T0Citation` doc has always said the opposite: "the evaluator
// RECOMPUTES sha256 from disk — a handed hash is never trusted". Measured live: a PASS citing a path
// that does not exist, with a sha256 of sixty-four zeros, ingested clean; so did a PASS citing a
// real, correctly-hashed artifact whose own `overall` was "red".
//
// THE FIX re-hashes what a citation actually points at, from the one seam every reader (`probe
// eval`, `reduce ingest`, and — through them — the round loop, resume and hill) already funnels
// through: `kernel/probe/eval.mjs`'s `unresolvedCitation()`. This module drives the real entry
// points (`harness.mjs probe eval`, `harness.mjs reduce ingest`) against a fixture spec and forged
// results — a fixture that calls the predicate directly cannot see whether the pipeline calls it.
//
// WHAT THIS PINS (133):
//   (a) a citation to a NONEXISTENT artifact is refused — the exact measured defect.
//   (b) a citation to a REAL, correctly-hashed artifact whose own verdict is red is refused.
//   (c) a citation whose sha256 does not match the real artifact's bytes is refused.
//   (d) a citation naming a DIRECTORY where a T0 verdict file belongs is refused.
//   (e) a citation this machine cannot READ for an unrelated reason (permission denied) is NOT
//       refused on that ground alone — unreadable and forged are different facts, and only the
//       second is positively proven. Skipped, honestly, where the filesystem/user does not enforce
//       the mode bit (root, some CI mounts) — the same discipline 18-resume-state.mjs uses for the
//       same ambiguity.
//   (f) the same pipeline accepts an HONEST citation — a real green artifact, the correct hash —
//       so the check is a lock with a key, not a check that only ever denies.
//   (g)-(i) a MULTI-citation verdict — a real scoped run cites one artifact PER SCOPE, so three or
//       four is normal — is refused when a LATER citation is forged: missing, hash-mismatched, or
//       red, the same three shapes (a)-(c) already pin, now hiding behind an honest first citation.
//       A loop that reads only `t0_citations[0]` (every fixture above cites exactly one, so nothing
//       above would notice) would accept all three.
//   (j) the same multi-citation verdict, with every citation honest, still passes — the walk over
//       every citation is not one-directional either.
//   (k)-(m) a citation to a real, correctly-hashed artifact whose own `overall` is "amber", `null`,
//       or absent entirely is refused — pinning the actual proposition ("refused unless positively
//       green") against a narrowing that only ever checks `overall === "red"`, which would accept
//       all three.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

/**
 * Run the T0-citation re-hash checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("134. A T0 citation is re-hashed, not merely present — forged shapes refused, an honest one still passes");
  // =============================================================================

  const K = (verb) => [join(ROOT, "kernel/harness.mjs"), ...verb.split(" ")];
  const roots = [];
  const fixture = (name) => { const d = mkdtempSync(join(tmpdir(), `citation-rehash-${name}-`)); roots.push(d); return d; };
  const w = (root, rel, body) => {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
    return p;
  };
  const contract = (root, id) => w(root, `shapeup/demo/scopes/${id}.json`,
    { schema_version: 1, scope_id: id, allowed_file_substrate: [`src/${id}/**`] });
  // Writes a real T0 verdict artifact and hands back its re-hashable identity — {rel, sha256} —
  // exactly what an honest evaluator would compute before citing it.
  const t0 = (root, file, extra) => {
    const full = { schema_version: 2, round: 1, attempt: 1, trial: 1, ...extra };
    const rel = `.shapeup/demo/t0/verdicts/${file}`;
    w(root, rel, full);
    return { rel, sha256: createHash("sha256").update(JSON.stringify(full, null, 2)).digest("hex") };
  };
  // `overall` is derived from the criteria now, so a fixture verdict carries one honest criterion
  // unless the case supplies its own — this module is about citations, not verdict arithmetic.
  const honest = (v) => (v && !Array.isArray(v.criteria) && (v.overall === "PASS" || v.overall === "FAIL")
    ? { ...v, criteria: [{ criterion: "UC-01 step 1", verdict: v.overall, evidence: "src/a.ts:1 measured" }] }
    : v);
  const evalResult = (root, verdict) => w(root, ".shapeup/demo/results/evaluate-r1.json",
    { schema_version: 1, order_id: "demo/evaluate-r1", worker: "spec-evaluator", status: "done", verdict: honest(verdict) });
  const probeEval = (root) => {
    const r = spawnSync("node", [...K("probe eval"), "--slug", "demo", "--round", "1", "--cwd", root], { encoding: "utf8" });
    let json = {};
    try { json = JSON.parse(r.stdout); } catch { /* reported by the caller */ }
    return { r, json };
  };
  const ingest = (root) => spawnSync("node",
    [...K("reduce ingest"), join(root, ".shapeup/demo/results/evaluate-r1.json"), "--cwd", root], { encoding: "utf8" });
  const ledgerPath = (root) => join(root, ".shapeup/demo/evaluation/.verdicts-evaluate-r1.jsonl");

  try {
    // --- (a) FORGED: a citation naming an artifact that does not exist on disk -----------------
    {
      const d = fixture("missing");
      contract(d, "alpha");
      evalResult(d, { overall: "PASS",
        t0_citations: [{ scope_id: "alpha", path: ".shapeup/demo/t0/verdicts/ghost.json", sha256: "0".repeat(64) }] });
      const { r, json } = probeEval(d);
      if (r.status === 1 && json.ok === false && /does not exist/.test(json.reason || "")) {
        ok("(a) probe eval refuses a PASS citing an artifact that does not exist — sha256 of zeros and all");
      } else fail(`(a) probe eval accepted a citation to a nonexistent artifact: exit ${r.status}, ${JSON.stringify(json)}`);
      const i = ingest(d);
      if (i.status === 1 && /does not exist/.test(i.stderr) && !existsSync(ledgerPath(d))) {
        ok("(a) reduce ingest refuses the same forged citation before writing the verdict ledger");
      } else fail(`(a) reduce ingest accepted a citation to a nonexistent artifact (exit ${i.status})\n${i.stderr}`);
    }

    // --- (b) FORGED: a citation to a REAL, correctly-hashed artifact whose own verdict is red ---
    {
      const d = fixture("red");
      contract(d, "alpha");
      const red = t0(d, "r1-a1-t1.json", { scope_id: "alpha", overall: "red" });
      evalResult(d, { overall: "PASS", t0_citations: [{ scope_id: "alpha", path: red.rel, sha256: red.sha256 }] });
      const { r, json } = probeEval(d);
      if (r.status === 1 && json.ok === false && /not green/.test(json.reason || "")) {
        ok("(b) probe eval refuses a PASS citing a real, correctly-hashed T0 artifact whose own verdict is red");
      } else fail(`(b) probe eval accepted a PASS citing a red T0 artifact: exit ${r.status}, ${JSON.stringify(json)}`);
      const i = ingest(d);
      if (i.status === 1 && /not green/.test(i.stderr) && !existsSync(ledgerPath(d))) {
        ok("(b) reduce ingest refuses the same red-artifact citation before writing the verdict ledger");
      } else fail(`(b) reduce ingest accepted a citation to a red T0 artifact (exit ${i.status})\n${i.stderr}`);
    }

    // --- (c) FORGED: a citation whose sha256 does not match the real artifact's bytes ----------
    {
      const d = fixture("mismatch");
      contract(d, "alpha");
      const green = t0(d, "r1-a1-t1.json", { scope_id: "alpha", overall: "green" });
      const wrongHash = green.sha256.slice(0, 63) + (green.sha256.slice(63) === "0" ? "1" : "0");
      evalResult(d, { overall: "PASS", t0_citations: [{ scope_id: "alpha", path: green.rel, sha256: wrongHash }] });
      const { r, json } = probeEval(d);
      if (r.status === 1 && json.ok === false && /hashes to/.test(json.reason || "")) {
        ok("(c) probe eval refuses a PASS whose cited sha256 does not match the real artifact's bytes");
      } else fail(`(c) probe eval accepted a mismatched hash: exit ${r.status}, ${JSON.stringify(json)}`);
      const i = ingest(d);
      if (i.status === 1 && /hashes to/.test(i.stderr) && !existsSync(ledgerPath(d))) {
        ok("(c) reduce ingest refuses the same hash mismatch before writing the verdict ledger");
      } else fail(`(c) reduce ingest accepted a mismatched hash (exit ${i.status})\n${i.stderr}`);
    }

    // --- (d) FORGED: a citation naming a directory, never a T0 verdict file --------------------
    {
      const d = fixture("isdir");
      contract(d, "alpha");
      const rel = ".shapeup/demo/t0/verdicts/r1-a1-t1.json";
      mkdirSync(join(d, rel), { recursive: true }); // a directory sits where the verdict file should be
      evalResult(d, { overall: "PASS", t0_citations: [{ scope_id: "alpha", path: rel, sha256: "0".repeat(64) }] });
      const { r, json } = probeEval(d);
      if (r.status === 1 && json.ok === false && /directory/.test(json.reason || "")) {
        ok("(d) probe eval refuses a citation naming a directory in place of a T0 verdict file");
      } else fail(`(d) probe eval accepted a directory as a T0 citation: exit ${r.status}, ${JSON.stringify(json)}`);
    }

    // --- (e) FAIL OPEN: unreadable (permission denied) is not proof of forgery -----------------
    // Only a MISSING or wrongly-shaped artifact is positively proven; a read this machine simply
    // cannot perform right now says nothing about the citation's honesty. Cites the WRONG hash too,
    // so acceptance can only be explained by the read failure short-circuiting before any hash
    // comparison — never by the hash happening to be right.
    {
      const d = fixture("unreadable");
      contract(d, "alpha");
      const locked = t0(d, "r1-a1-t1.json", { scope_id: "alpha", overall: "green" });
      const lockedPath = join(d, locked.rel);
      chmodSync(lockedPath, 0o000);
      let enforced = true;
      try { readFileSync(lockedPath, "utf8"); enforced = false; } catch { /* the mode bit holds on this fs */ }
      if (!enforced) {
        ok("(e) skipped the unreadable-artifact arm — this filesystem/user does not enforce a 000 mode (e.g. root)");
      } else {
        evalResult(d, { overall: "PASS", t0_citations: [{ scope_id: "alpha", path: locked.rel, sha256: "0".repeat(64) }] });
        const { r, json } = probeEval(d);
        if (r.status === 0 && json.ok === true && json.overall === "PASS") {
          ok("(e) probe eval does not refuse a citation it cannot read for a permission reason — fails open on an unproven state");
        } else fail(`(e) an unreadable (not missing) citation was refused: exit ${r.status}, ${JSON.stringify(json)} — unreadable and forged are being conflated`);
      }
      chmodSync(lockedPath, 0o644);
    }

    // --- (f) HONEST: the same pipeline, a real green artifact, the correct hash — still passes --
    {
      const d = fixture("honest");
      contract(d, "alpha");
      const green = t0(d, "r1-a1-t1.json", { scope_id: "alpha", overall: "green" });
      const criteria = [{ criterion: "UC-01 step 1", dimension: "spec-conformance", verdict: "PASS", confidence: "high", evidence: "ran it" }];
      evalResult(d, { overall: "PASS", criteria, t0_citations: [{ scope_id: "alpha", path: green.rel, sha256: green.sha256 }] });
      const { r, json } = probeEval(d);
      if (r.status === 0 && json.ok === true && json.overall === "PASS") {
        ok("(f) probe eval accepts a PASS whose T0 citation actually resolves — the check is not one-directional");
      } else fail(`(f) probe eval refused an honest citation: exit ${r.status}, ${JSON.stringify(json)}`);
      const i = ingest(d);
      if (i.status === 0 && existsSync(ledgerPath(d))) {
        ok("(f) reduce ingest applies the same honestly-cited verdict and writes the verdict ledger");
      } else fail(`(f) reduce ingest refused an honest citation (exit ${i.status})\n${i.stdout}${i.stderr}`);
    }

    // --- (g) MULTI-CITATION, FORGED LATER: a real scoped run cites one artifact PER SCOPE — three
    // or four is normal — so a loop that only reads `t0_citations[0]` (every fixture above cites
    // exactly one, so nothing above would notice) accepts a forged SECOND citation whenever the
    // first happens to be honest. Here the later citation names an artifact that was never written.
    {
      const d = fixture("multi-missing");
      contract(d, "alpha");
      contract(d, "beta");
      const good = t0(d, "r1-a1-t1.json", { scope_id: "alpha", overall: "green" });
      evalResult(d, { overall: "PASS", t0_citations: [
        { scope_id: "alpha", path: good.rel, sha256: good.sha256 },
        { scope_id: "beta", path: ".shapeup/demo/t0/verdicts/ghost-beta.json", sha256: "0".repeat(64) },
      ] });
      const { r, json } = probeEval(d);
      if (r.status === 1 && json.ok === false && /does not exist/.test(json.reason || "")) {
        ok("(g) probe eval refuses a PASS whose FIRST citation resolves honestly but whose SECOND names a nonexistent artifact — a loop stopping at index 0 would miss this");
      } else fail(`(g) probe eval accepted a multi-citation PASS with a nonexistent later citation: exit ${r.status}, ${JSON.stringify(json)}`);
      const ing = ingest(d);
      if (ing.status === 1 && /does not exist/.test(ing.stderr) && !existsSync(ledgerPath(d))) {
        ok("(g) reduce ingest refuses the same multi-citation forgery before writing the verdict ledger");
      } else fail(`(g) reduce ingest accepted a multi-citation PASS with a nonexistent later citation (exit ${ing.status})\n${ing.stderr}`);
    }

    // --- (h) MULTI-CITATION, FORGED LATER: the second citation's sha256 does not match its bytes,
    // hiding behind an honest first citation the same way (g) hides a missing artifact.
    {
      const d = fixture("multi-mismatch");
      contract(d, "alpha");
      contract(d, "beta");
      const good = t0(d, "r1-a1-t1.json", { scope_id: "alpha", overall: "green" });
      const bad = t0(d, "r1-b1-t1.json", { scope_id: "beta", overall: "green" });
      const wrongHash = bad.sha256.slice(0, 63) + (bad.sha256.slice(63) === "0" ? "1" : "0");
      evalResult(d, { overall: "PASS", t0_citations: [
        { scope_id: "alpha", path: good.rel, sha256: good.sha256 },
        { scope_id: "beta", path: bad.rel, sha256: wrongHash },
      ] });
      const { r, json } = probeEval(d);
      if (r.status === 1 && json.ok === false && /hashes to/.test(json.reason || "")) {
        ok("(h) probe eval refuses a PASS whose FIRST citation resolves honestly but whose SECOND sha256 does not match — a loop stopping at index 0 would miss this");
      } else fail(`(h) probe eval accepted a multi-citation PASS with a hash-mismatched later citation: exit ${r.status}, ${JSON.stringify(json)}`);
      const ing = ingest(d);
      if (ing.status === 1 && /hashes to/.test(ing.stderr) && !existsSync(ledgerPath(d))) {
        ok("(h) reduce ingest refuses the same multi-citation hash mismatch before writing the verdict ledger");
      } else fail(`(h) reduce ingest accepted a multi-citation PASS with a hash-mismatched later citation (exit ${ing.status})\n${ing.stderr}`);
    }

    // --- (i) MULTI-CITATION, FORGED LATER: the second citation resolves and hashes correctly, but
    // its OWN verdict is red — the exact HD-043 shape, now hiding behind an honest first citation.
    {
      const d = fixture("multi-red");
      contract(d, "alpha");
      contract(d, "beta");
      const good = t0(d, "r1-a1-t1.json", { scope_id: "alpha", overall: "green" });
      const red = t0(d, "r1-b1-t1.json", { scope_id: "beta", overall: "red" });
      evalResult(d, { overall: "PASS", t0_citations: [
        { scope_id: "alpha", path: good.rel, sha256: good.sha256 },
        { scope_id: "beta", path: red.rel, sha256: red.sha256 },
      ] });
      const { r, json } = probeEval(d);
      if (r.status === 1 && json.ok === false && /not green/.test(json.reason || "")) {
        ok("(i) probe eval refuses a PASS whose FIRST citation resolves honestly but whose SECOND cites a red T0 artifact — a loop stopping at index 0 would miss this");
      } else fail(`(i) probe eval accepted a multi-citation PASS with a red later citation: exit ${r.status}, ${JSON.stringify(json)}`);
      const ing = ingest(d);
      if (ing.status === 1 && /not green/.test(ing.stderr) && !existsSync(ledgerPath(d))) {
        ok("(i) reduce ingest refuses the same multi-citation red-artifact forgery before writing the verdict ledger");
      } else fail(`(i) reduce ingest accepted a multi-citation PASS with a red later citation (exit ${ing.status})\n${ing.stderr}`);
    }

    // --- (j) MULTI-CITATION, HONEST: several real, correctly-hashed, green citations all resolve —
    // the walk over every citation is not one-directional either.
    {
      const d = fixture("multi-honest");
      contract(d, "alpha");
      contract(d, "beta");
      const a = t0(d, "r1-a1-t1.json", { scope_id: "alpha", overall: "green" });
      const b = t0(d, "r1-b1-t1.json", { scope_id: "beta", overall: "green" });
      const criteria = [{ criterion: "UC-01 step 1", dimension: "spec-conformance", verdict: "PASS", confidence: "high", evidence: "ran it" }];
      evalResult(d, { overall: "PASS", criteria, t0_citations: [
        { scope_id: "alpha", path: a.rel, sha256: a.sha256 },
        { scope_id: "beta", path: b.rel, sha256: b.sha256 },
      ] });
      const { r, json } = probeEval(d);
      if (r.status === 0 && json.ok === true && json.overall === "PASS") {
        ok("(j) probe eval accepts a PASS whose several T0 citations all actually resolve");
      } else fail(`(j) probe eval refused an honest multi-citation PASS: exit ${r.status}, ${JSON.stringify(json)}`);
      const ing = ingest(d);
      if (ing.status === 0 && existsSync(ledgerPath(d))) {
        ok("(j) reduce ingest applies the same honestly multi-cited verdict and writes the verdict ledger");
      } else fail(`(j) reduce ingest refused an honest multi-citation PASS (exit ${ing.status})\n${ing.stdout}${ing.stderr}`);
    }

    // --- (k) NOT GREEN, NOT RED: a real, correctly-hashed artifact whose own verdict is "amber" —
    // pinning the actual proposition ("refused unless positively green") against a narrowing that
    // only ever checks `overall === "red"`, which would let this ride through unrefused.
    {
      const d = fixture("amber");
      contract(d, "alpha");
      const amber = t0(d, "r1-a1-t1.json", { scope_id: "alpha", overall: "amber" });
      evalResult(d, { overall: "PASS", t0_citations: [{ scope_id: "alpha", path: amber.rel, sha256: amber.sha256 }] });
      const { r, json } = probeEval(d);
      if (r.status === 1 && json.ok === false && /not green/.test(json.reason || "")) {
        ok('(k) probe eval refuses a PASS citing a T0 artifact whose own verdict is "amber" — the standard is positively green, not merely "not red"');
      } else fail(`(k) probe eval accepted a PASS citing an amber T0 artifact: exit ${r.status}, ${JSON.stringify(json)}`);
      const ing = ingest(d);
      if (ing.status === 1 && /not green/.test(ing.stderr) && !existsSync(ledgerPath(d))) {
        ok("(k) reduce ingest refuses the same amber-artifact citation before writing the verdict ledger");
      } else fail(`(k) reduce ingest accepted a citation to an amber T0 artifact (exit ${ing.status})\n${ing.stderr}`);
    }

    // --- (l) NOT GREEN, NOT RED: the cited artifact's `overall` is explicitly null.
    {
      const d = fixture("null-overall");
      contract(d, "alpha");
      const nul = t0(d, "r1-a1-t1.json", { scope_id: "alpha", overall: null });
      evalResult(d, { overall: "PASS", t0_citations: [{ scope_id: "alpha", path: nul.rel, sha256: nul.sha256 }] });
      const { r, json } = probeEval(d);
      if (r.status === 1 && json.ok === false && /not green/.test(json.reason || "")) {
        ok("(l) probe eval refuses a PASS citing a T0 artifact whose `overall` is explicitly null");
      } else fail(`(l) probe eval accepted a PASS citing a null-overall T0 artifact: exit ${r.status}, ${JSON.stringify(json)}`);
      const ing = ingest(d);
      if (ing.status === 1 && /not green/.test(ing.stderr) && !existsSync(ledgerPath(d))) {
        ok("(l) reduce ingest refuses the same null-overall citation before writing the verdict ledger");
      } else fail(`(l) reduce ingest accepted a citation to a null-overall T0 artifact (exit ${ing.status})\n${ing.stderr}`);
    }

    // --- (m) NOT GREEN, NOT RED: the cited artifact carries no `overall` field at all.
    {
      const d = fixture("absent-overall");
      contract(d, "alpha");
      const absent = t0(d, "r1-a1-t1.json", { scope_id: "alpha" });
      evalResult(d, { overall: "PASS", t0_citations: [{ scope_id: "alpha", path: absent.rel, sha256: absent.sha256 }] });
      const { r, json } = probeEval(d);
      if (r.status === 1 && json.ok === false && /not green/.test(json.reason || "")) {
        ok("(m) probe eval refuses a PASS citing a T0 artifact with no `overall` field at all");
      } else fail(`(m) probe eval accepted a PASS citing an overall-absent T0 artifact: exit ${r.status}, ${JSON.stringify(json)}`);
      const ing = ingest(d);
      if (ing.status === 1 && /not green/.test(ing.stderr) && !existsSync(ledgerPath(d))) {
        ok("(m) reduce ingest refuses the same overall-absent citation before writing the verdict ledger");
      } else fail(`(m) reduce ingest accepted a citation to an overall-absent T0 artifact (exit ${ing.status})\n${ing.stderr}`);
    }
  } finally {
    for (const d of roots) rmSync(d, { recursive: true, force: true });
  }
}
