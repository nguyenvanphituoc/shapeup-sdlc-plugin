// A "GONE" FINDING RULES OUT AN OVERLAY, AND A "SURVIVES A RELAUNCH" FINDING DIFFS THE SEED.
//
// Two lens-③ findings on one consumer, two different runs, worded almost identically, both
// hand-falsified: a badge that supposedly "survives a relaunch" (the store reseeds; never diffed
// against the seed) and an item that "vanished" (the keyboard covered it; a layout dump has no
// concept of an overlay). skills/qa-edge-hunter/SKILL.md now requires both checks before either
// claim counts as reproduced (H.2), and states them as hard rules — the same "closed when" this
// repo holds a prose fix to when the defect is a worker's method, not a kernel-checkable shape.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Run the occlusion/seed-diff guidance checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  section("174. qa-edge-hunter requires an overlay check before \"gone\" and a seed diff before \"survives a relaunch\"");
  const skill = readFileSync(join(ROOT, "skills/qa-edge-hunter/SKILL.md"), "utf8");

  const h2 = skill.slice(skill.indexOf("H.2  Suspected finding"), skill.indexOf("H.3  Confirmed"));
  if (/COVERED/.test(h2) && /overlay/i.test(h2) && /keyboard/.test(h2)) {
    ok("H.2 requires ruling out an overlay (keyboard/dialog/sheet) before a \"gone\" claim is reproduced");
  } else fail("H.2 does not require an overlay check before an absence finding");
  if (/SURVIVES/.test(h2) && /seed/i.test(h2)) {
    ok("H.2 requires diffing against the seed/reset state before a \"survives a relaunch\" claim is reproduced");
  } else fail("H.2 does not require a seed diff before a persistence-across-relaunch finding");

  const rules = skill.slice(skill.indexOf("## Hard rules"));
  const numbered = [...rules.matchAll(/^(\d+)\.\s+\*\*/gm)].map((m) => Number(m[1]));
  if (numbered.length === 10 && numbered[numbered.length - 1] === 10 && new Set(numbered).size === 10) {
    ok("the hard-rules list carries all ten rules in order, with no gap or duplicate number");
  } else fail(`hard-rules numbering: ${JSON.stringify(numbered)}`);
  if (/Never call something gone from one tree read/.test(rules) && /Never call a value "surviving" a relaunch without diffing the seed/.test(rules)) {
    ok("both new failure modes are also stated as their own hard rules, not only inside H.2");
  } else fail("the hard-rules list is missing one of the two new rules");
}
