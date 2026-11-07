// 35 — the domain model has two expressions, and they must agree.
//
// `domain.schema.json` describes the model twice — `$defs` is the type catalog, `x-erd.relationships`
// is the relationship catalog. Nothing compared them, and they had drifted: ERD node keys that did not
// resolve to a type, a compound node that is not an entity, and a type the whole scope-to-task join
// anchored on that had no definition at all.
//
// WHAT THIS MODULE PROVES, by reading the shipped schema rather than a restatement of it:
//   (a) every ERD node key resolves — a $def, or an explicitly declared external schema file
//   (d) THE TIER RULE, checked at the schema level: no SHARED type stores a key that resolves
//       into the LOCAL tier. This is the invariant the scope contract broke by carrying `tasks[]`,
//       asserted where it belongs instead of one artifact at a time.

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Keys a type stores that would resolve into the LOCAL tier.
 *
 * A task id is the LOCAL key: the board renumbers them per machine. A field NAMED `tasks` on a
 * committed type is the exact shape that shipped and broke — the contract held a list of board ids
 * and resolved to nothing on every other clone.
 *
 * @param {object} def - One `$defs` entry.
 * @returns {string[]} Offending property names; [] when the type is clean.
 */
function localKeysStoredBy(def) {
  const props = Object.keys(def?.properties || {});
  return props.filter((p) => /^tasks$|^task_id$|_task_ids?$/.test(p));
}

/**
 * Run the domain-catalog checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("78. The type catalog and the relationship catalog agree, and the tier rule holds");
  // =============================================================================

  const schema = JSON.parse(readFileSync(join(ROOT, "kernel/schemas/domain.schema.json"), "utf8"));
  const defs = new Set(Object.keys(schema.$defs || {}));
  const erd = schema["x-erd"] || {};
  const rels = erd.relationships || [];
  const external = erd.external || {};

  // --- (a) every ERD node key resolves ----------------------------------------------------------
  {
    const nodes = new Set(rels.flatMap((r) => [r.from, r.to]));
    const unresolved = [...nodes].filter((n) => !defs.has(n) && !(n in external)).sort();
    if (!unresolved.length) {
      ok(`all ${nodes.size} ERD node keys resolve to a $def or a declared external schema`);
    } else {
      fail(`ERD names ${unresolved.length} node(s) that are neither a $def nor a declared external: ` +
        `${JSON.stringify(unresolved)}. A node key is an identifier, not a display label — an ERD ` +
        "whose nodes do not resolve cannot be validated, generated from, or diffed.");
    }
    // a compound node is not an entity, however readable it looks
    const compound = [...nodes].filter((n) => /[/,]| and /.test(n));
    if (!compound.length) ok("no ERD node collapses two entities into one key");
    else fail(`compound ERD node(s) ${JSON.stringify(compound)} — each names more than one entity, so the edge cannot be walked`);
  }

  // --- (d) the tier rule, at the schema level ---------------------------------------------------
  {
    const offenders = [];
    for (const [name, def] of Object.entries(schema.$defs || {})) {
      const tier = String(def["x-tier"] || "").split(/\s/)[0];
      if (tier !== "SHARED") continue;
      const bad = localKeysStoredBy(def);
      if (bad.length) offenders.push(`${name}.{${bad.join(",")}}`);
    }
    if (!offenders.length) {
      ok("no SHARED type stores a key that resolves into the LOCAL tier — the tier rule holds at the catalog level");
    } else {
      fail(`SHARED type(s) store LOCAL keys: ${JSON.stringify(offenders)}. A committed type holding a ` +
        "board id resolves on the machine that wrote it and nowhere else, and an empty join is " +
        "indistinguishable from a dangling one. Anchor on use_cases/covers/scope_id instead.");
    }

    // The anchor the tier boundary now rests on must itself be typed and committed.
    const uc = schema.$defs?.UseCase;
    if (uc && String(uc["x-tier"]).startsWith("SHARED") && uc["x-location"]?.includes("usecases/")) {
      ok("UseCase — the anchor the scope↔task join is re-derived through — is typed, SHARED and located");
    } else {
      fail("UseCase is not defined as a SHARED type with an x-location. It is the far end of every " +
        "use_cases[]/use_case_refs[] link and the key the tier boundary rests on; leaving it untyped " +
        "is how it went nine relationships without a definition.");
    }
  }
}
