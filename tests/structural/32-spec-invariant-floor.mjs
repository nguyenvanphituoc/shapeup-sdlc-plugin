// 32 — FLOOR THE SPEC TREE AGAINST A PITCH THAT NAMES CONSTRAINTS (Phase 3.5 / S7).
//
// THE CORRECTNESS HOLE THIS CLOSES. Nothing stopped a spec tree that derives NOTHING from the raw
// idea from shipping green: a criteria-count check can't tell a healthy small tree from one that is
// silently thin. A pitch can spell out real No-gos/Constraints/Edge-cases and the derived UC tree
// can still declare zero `[INV-NN]` invariants anywhere — every other STRUCTURE/UC-ANCHOR rule in
// `kernel/verify/spec.mjs` passes on that tree, because none of them ever compares the tree back to
// the pitch it was supposed to come from.
//
// THE FIX adds `intakeNamesConstraints()` (a loose, case-insensitive heading match for a
// No-gos/Constraints/Edge-cases section followed by real content) and a new `INV-FLOOR` rule to
// `lintStructure()`, which now accepts an optional `intakeContent` string. `lint({cwd, slug})`
// threads `intake(cwd, slug)`'s verbatim content through as that parameter.
//
// WHAT THIS MODULE PROVES, against the shipped `lintStructure()` (not a hand-kept copy of the
// rule) and, for the wiring itself, against the shipped `lint()`:
//   (1) intake.md names real constraints, tree has zero `[INV-` markers anywhere → INV-FLOOR fires.
//   (2) the SAME intake.md, but at least one `[INV-01]` present somewhere in the tree → INV-FLOOR
//       does NOT fire — the rule discriminates on real content, not merely on the heading existing.
//   (3) intake.md names no such section at all, tree still has zero invariants → INV-FLOOR must NOT
//       fire — a pitch that never raised constraints is not evidence of a thinned tree.
//   (4) end-to-end through `lint({cwd, slug})`: an intake.md written at the real `intake(cwd, slug)`
//       path is actually read and reaches the rule — proves the wiring, not only the rule's logic.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const CONSTRAINTS_INTAKE = [
  "# Raw idea",
  "",
  "Let shoppers save a cart for later.",
  "",
  "## Constraints",
  "",
  "- Must never lose an item already in the cart.",
  "- Saved carts expire after 30 days.",
  "",
].join("\n");

const NO_CONSTRAINTS_INTAKE = [
  "# Raw idea",
  "",
  "Let shoppers save a cart for later.",
  "",
].join("\n");

/** Write a file (JSON object or raw string), creating its directory. */
function w(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return p;
}

/**
 * Build one fixture spec dir: a domain-model.md and a single UC with (or without) an `[INV-01]`
 * entry in its `## Invariants` section.
 * @param {boolean} withInvariant - When true, the UC body carries a real `[INV-01]` marker.
 * @returns {string} The fixture's spec dir (a fresh tmp directory, caller's to clean up).
 */
function buildSpecDir(withInvariant) {
  const tmp = mkdtempSync(join(tmpdir(), "spec-inv-floor-"));
  const specDir = join(tmp, "spec");
  w(specDir, "domain-model.md", "# dm\n");
  w(specDir, join("usecases", "UC-SaveCart.md"),
    withInvariant
      ? "## Steps\n1. save\n\n## Invariants\n- [INV-01] a saved cart is never lost\n"
      : "## Steps\n1. save\n");
  return specDir;
}

/**
 * Run the invariant-floor lint checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("76. spec-lint floors the tree against a pitch that names constraints (Phase 3.5 / S7)");
  // =============================================================================

  const { lintStructure, intakeNamesConstraints, lint } = await import(join(ROOT, "kernel/verify/spec.mjs"));

  // --- helper self-check: the detector discriminates a real section from an empty heading ------
  if (intakeNamesConstraints(CONSTRAINTS_INTAKE)) ok("intakeNamesConstraints() recognizes a Constraints heading with real content");
  else fail("intakeNamesConstraints() missed a real Constraints section");
  if (!intakeNamesConstraints(NO_CONSTRAINTS_INTAKE)) ok("intakeNamesConstraints() does not fire on an intake with no such heading");
  else fail("intakeNamesConstraints() wrongly fired with no No-gos/Constraints/Edge-cases heading");
  if (!intakeNamesConstraints("## No-gos\n\n## Next section\n"))
    ok("intakeNamesConstraints() does not fire on a heading immediately followed by another heading (no content)");
  else fail("intakeNamesConstraints() wrongly fired on an empty heading");

  // --- (1) constraints named, zero invariants anywhere → INV-FLOOR fires red --------------------
  {
    const specDir = buildSpecDir(false);
    try {
      const findings = lintStructure({ specDir, tasks: [], intakeContent: CONSTRAINTS_INTAKE });
      if (findings.some((f) => f.rule === "INV-FLOOR" && f.level === "red"))
        ok("INV-FLOOR fires when the pitch names constraints but the tree declares zero invariants");
      else fail("INV-FLOOR missed a pitch naming constraints against a tree with zero [INV-NN] markers");
    } finally { rmSync(dirname(specDir), { recursive: true, force: true }); }
  }

  // --- (2) same intake, but the tree DOES declare an invariant → INV-FLOOR does not fire ---------
  {
    const specDir = buildSpecDir(true);
    try {
      const findings = lintStructure({ specDir, tasks: [], intakeContent: CONSTRAINTS_INTAKE });
      if (!findings.some((f) => f.rule === "INV-FLOOR"))
        ok("INV-FLOOR does not fire once the tree declares at least one [INV-NN] (discriminates on real content)");
      else fail("INV-FLOOR wrongly fired against a tree that already declares an invariant");
    } finally { rmSync(dirname(specDir), { recursive: true, force: true }); }
  }

  // --- (3) pitch names no constraints at all, tree has zero invariants → INV-FLOOR does not fire -
  {
    const specDir = buildSpecDir(false);
    try {
      const findings = lintStructure({ specDir, tasks: [], intakeContent: NO_CONSTRAINTS_INTAKE });
      if (!findings.some((f) => f.rule === "INV-FLOOR"))
        ok("INV-FLOOR does not fire when the pitch never named constraints (absence of the topic is not evidence of a thinned tree)");
      else fail("INV-FLOOR wrongly fired against a pitch that named no constraints at all");
    } finally { rmSync(dirname(specDir), { recursive: true, force: true }); }
  }

  // --- (4) end-to-end: lint({cwd, slug}) actually reads intake(cwd, slug) off disk ----------------
  {
    const cwd = mkdtempSync(join(tmpdir(), "spec-inv-floor-e2e-"));
    const slug = "inv-floor-demo";
    try {
      w(cwd, `shapeup/${slug}/spec/domain-model.md`, "# dm\n");
      w(cwd, `shapeup/${slug}/spec/usecases/UC-SaveCart.md`, "## Steps\n1. save\n");
      w(cwd, `.shapeup/${slug}/intake.md`, CONSTRAINTS_INTAKE);
      const report = lint({ cwd, slug });
      if (report.findings.some((f) => f.rule === "INV-FLOOR" && f.level === "red"))
        ok("lint({cwd, slug}) reads intake.md via the real path resolver and INV-FLOOR fires end-to-end");
      else fail("lint({cwd, slug}) did not surface INV-FLOOR — intake.md's content is not reaching lintStructure()");
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }
}
