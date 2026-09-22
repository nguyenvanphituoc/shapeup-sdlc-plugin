#!/usr/bin/env node
// s0-doc-parity.mjs — HD-1 (promoted HD-027): TAUGHT vs ENFORCED for the TIER-DIRECTION rule.
//
// ENFORCED is read off the running lint — kernel/verify/spec.mjs's lintCommittedTier, EXECUTED
// (rule 2: execute, don't read) against a synthetic committed file citing a bare, non-wikilink
// `.shapeup/` path in prose, the exact shape HD-1 measured: a `coverage` provenance sentence
// ("extracted from `.shapeup/find-my-todos/intake.md`") that was never a `[[tasks/...]]` link.
//
// TAUGHT is read off `skills/ba-pitch-analyzer/references/doc-schemas.md`'s own Tier-direction
// rule section. Before this stage's fix that section stated the rule purely in wikilink terms —
// "never `[[tasks/...]]`" — and said nothing about a bare path in prose, so a worker reading only
// the docs had no way to know the sentence it was about to write would red. They must now agree.
//
// Anchors on the literal "**Tier-direction rule.**" heading and exits 2 (distinct from a FAILING
// check) when that anchor is gone — rule 3: "I cannot verify this here" and "this is wrong" are
// different findings, and a broken probe must not be read as a red one.
//
// Usage: node tests/fixtures/s0-doc-parity.mjs   (exit 0 + "TAUGHT==ENFORCED" only when they agree)

import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOC_PATH = join(ROOT, "skills/ba-pitch-analyzer/references/doc-schemas.md");
const ANCHOR = "**Tier-direction rule.**";

let doc;
try {
  doc = readFileSync(DOC_PATH, "utf8");
} catch (err) {
  console.error(`CANNOT READ skills/ba-pitch-analyzer/references/doc-schemas.md: ${err.message}`);
  process.exit(2);
}

const anchorAt = doc.indexOf(ANCHOR);
if (anchorAt === -1) {
  console.error(`ANCHOR NOT FOUND: literal "${ANCHOR}" is not in doc-schemas.md — probe cannot locate the rule`);
  process.exit(2);
}

// The section runs from the anchor to the next heading (any level), so a rewrite that keeps
// growing the bullet list is still read whole rather than truncated at a hand-picked line count.
const rest = doc.slice(anchorAt + ANCHOR.length);
const nextHeading = rest.search(/\n#{1,6}\s/);
const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);

// --- ENFORCED: executed against the real lint, never assumed. ---------------------------------
const d = mkdtempSync(join(tmpdir(), "s0-doc-parity-"));
let enforced;
try {
  mkdirSync(join(d, "shapeup", "f"), { recursive: true });
  writeFileSync(
    join(d, "shapeup", "f", "requirements.md"),
    "Atomic requirement clauses extracted from `.shapeup/f/intake.md`.\n",
  );
  const { lintCommittedTier } = await import(join(ROOT, "kernel/verify/spec.mjs"));
  const findings = lintCommittedTier({ cwd: d, slug: "f" }).filter((x) => x.rule === "TIER-DIRECTION");
  enforced = findings.length > 0;
} finally {
  rmSync(d, { recursive: true, force: true });
}

if (!enforced) {
  console.error("PROBE BROKEN: lintCommittedTier no longer reds a bare .shapeup/ path cited in prose — " +
    "this fixture cannot tell TAUGHT from ENFORCED if ENFORCED itself is not measurable");
  process.exit(2);
}

// --- TAUGHT: does the section state the rule for the non-wikilink (bare path in prose) case? --
const taught = /bare path/i.test(section) && /not only/i.test(section);

if (!taught) {
  console.error("TAUGHT=false, ENFORCED=true — doc-schemas.md's Tier-direction rule still reads as " +
    "wikilink-only (\"never [[tasks/...]]\"), but the lint it describes reds ANY .shapeup/ path, " +
    "wikilink or bare prose alike. A worker following only the docs has no way to know a plain " +
    "provenance sentence will red.");
  process.exit(1);
}

console.log("TAUGHT==ENFORCED");
process.exit(0);
