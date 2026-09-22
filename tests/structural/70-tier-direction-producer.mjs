// 70 — HD-1 (promoted HD-027): the producer/lint collision that hard-aborts planning at L1b.
// Sections: 113, 114.
//
// THE DEFECT, measured on a real consumer (`proj-harmony-os-sample`, run
// `find-my-todos-20260921T142815Z-b80de580`). `harness init run` stages the pitch into the
// gitignored run tier at `.shapeup/<slug>/intake.md`, and that is the only path `ba-pitch-analyzer`
// actually reads. `requirements.md` is a COMMITTED artifact, and spec-lint's `TIER-DIRECTION` rule
// (kernel/verify/spec.mjs, `lintCommittedTier`) forbids a committed file from naming a `.shapeup/`
// path, in ANY form — a bare path in prose, not only a `[[tasks/...]]` wikilink. A worker that
// cites its real source honestly produces a registry its own lint reds, and the run aborted at L1b
// after 25 dispatches (~28 minutes, ~1.17M subagent tokens) over one sentence of provenance prose.
//
// THE HOLE THIS CLOSES. The lint's own enforcement was already correct and whole-tree — the defect
// was that `skills/ba-pitch-analyzer/references/doc-schemas.md` TAUGHT the rule more narrowly than
// the lint ENFORCED it: purely in wikilink terms ("never `[[tasks/...]]`"), with no mention of a
// bare path cited in prose. A worker following only the docs had no way to know the sentence it was
// about to write would red. This module pins that the taught and enforced rules now agree, and that
// the two inline anti-gaming guards this stage's acceptance contract also carries — the lint must
// still red a real `.shapeup/` path, and must stay clean for provenance prose that names none — hold
// as a PERMANENT structural guard rather than a one-off contract row that only ran once.
//
// WHY THIS IS A SEPARATE MODULE FROM tests/fixtures/s0-doc-parity.mjs. That fixture is the
// contract's own falsifier driver (BOTH_DIRECTIONS: green on the fixed doc, red on the restored
// one) and is disposable by design. This module is the durable regression pin: it runs on every
// `npm test`, forever, the same discipline 66 through 69 already apply to their own defects.

import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function run(ctx) {
  const { ROOT, ok, fail, section, read } = ctx;

  const { lintCommittedTier } = await import(join(ROOT, "kernel/verify/spec.mjs"));

  /** Lint a single synthetic committed file's content under a throwaway shapeup/<slug>/ tree. */
  function lintOneFile(relPath, body) {
    const d = mkdtempSync(join(tmpdir(), "struct-tier-direction-"));
    try {
      const full = join(d, "shapeup", "f", relPath);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, body);
      return lintCommittedTier({ cwd: d, slug: "f" }).filter((x) => x.rule === "TIER-DIRECTION");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  }

  // ===============================================================================================
  section("113. TAUGHT==ENFORCED — doc-schemas.md's Tier-direction rule covers what the lint actually reds");
  // ===============================================================================================
  {
    // ENFORCED, executed: a bare (non-wikilink) .shapeup/ path in a provenance sentence — the exact
    // shape HD-1 measured — must still red. This is the "STILL BITES" guard: the cheap wrong fix to
    // this defect is weakening the lint so the collision cannot recur, which is worse than the bug.
    const bites = lintOneFile("requirements.md", "Atomic requirement clauses extracted from `.shapeup/f/intake.md`.\n");
    if (bites.length) ok("lintCommittedTier still reds a bare .shapeup/ path cited in prose (TIER-DIRECTION not weakened)");
    else fail("REGRESSION: lintCommittedTier no longer reds a bare .shapeup/ path in prose — TIER-DIRECTION has been weakened");

    // The payoff, executed: provenance prose that names no local path is clean. Not a discriminator
    // on its own (it was already true before this stage), but a non-regression pin on the fix's goal.
    const clean = lintOneFile("requirements.md", "Derived from the pitch staged for this run by harness init run.\n");
    if (!clean.length) ok("lintCommittedTier stays clean for provenance prose naming no local path");
    else fail(`REGRESSION: provenance prose naming no local path now reds: ${JSON.stringify(clean)}`);

    // TAUGHT: doc-schemas.md's own Tier-direction rule section states the non-wikilink case, not
    // only "never [[tasks/...]]". Anchored on the literal heading so a rewrite that drops it is
    // caught as a missing anchor, not silently read as passing.
    const doc = read(join(ROOT, "skills/ba-pitch-analyzer/references/doc-schemas.md"));
    const ANCHOR = "**Tier-direction rule.**";
    const at = doc.indexOf(ANCHOR);
    if (at === -1) {
      fail(`doc-schemas.md no longer has the literal "${ANCHOR}" anchor — TAUGHT cannot be located`);
    } else {
      const rest = doc.slice(at + ANCHOR.length);
      const nextHeading = rest.search(/\n#{1,6}\s/);
      const section_ = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
      const taught = /bare path/i.test(section_) && /not only/i.test(section_);
      if (taught) ok("doc-schemas.md's Tier-direction rule states the non-wikilink (bare-path-in-prose) case, matching lintCommittedTier's actual enforcement");
      else fail("doc-schemas.md's Tier-direction rule still reads as wikilink-only — a worker following only the docs cannot know a plain provenance sentence will red");
    }
  }

  // ===============================================================================================
  section("114. TIER-DIRECTION scans the WHOLE committed tree — not only requirements.md, the file that bit");
  // ===============================================================================================
  {
    // The stage's third proposition ("no other committed artifact any worker writes cites a
    // .shapeup/ path") is guaranteed by lintCommittedTier's own whole-tree walk, not by a
    // per-writer opt-in — proven here by driving several different committed filenames a
    // DIFFERENT worker writes (scope-summary.md, scope-board.md, a scope contract's frontmatter),
    // each independently, and confirming every one reds a bare .shapeup/ path exactly as
    // requirements.md does. A rule that only caught the one file that happened to bite would
    // leave every other committed-tier writer exposed to the identical collision.
    const otherFiles = [
      ["spec/scope-summary.md", "Summary sourced from .shapeup/f/intake.md, section 2.\n"],
      ["scope-board.md", "Board regenerated from .shapeup/f/board.md on each run.\n"],
      ["scopes/core.md", "---\nnote: see .shapeup/f/spikes/core.md for detail\n---\n# core\n"],
    ];
    let allCaught = true;
    for (const [relPath, body] of otherFiles) {
      const findings = lintOneFile(relPath, body);
      if (!findings.length) { allCaught = false; fail(`lintCommittedTier did not red a bare .shapeup/ path in ${relPath} — the scan is not whole-tree`); }
    }
    if (allCaught) ok(`lintCommittedTier reds a bare .shapeup/ path in every committed filename tried (${otherFiles.length}), not only requirements.md`);
  }
}
