// 35 — the domain model has three expressions, and they must agree.
//
// WHY THIS EXISTS. `domain.schema.json` describes the model twice — `$defs` is the type catalog,
// `x-erd.relationships` is the relationship catalog — and `kernel/reduce/graph.mjs` is a third
// expression: the projection that actually executes. Nothing compared any pair of them, and all
// three had drifted:
//
//   · 9 of 29 ERD node keys did not resolve to a type. Some were display strings with a
//     parenthetical baked into the identifier ("RequirementClause (SHARED registry)"), one was a
//     COMPOUND node ("CriterionVerdict / Discovery") that is not an entity at all, and two were
//     aliases for a type that already existed under another name.
//   · `UseCase` — the anchor the whole scope↔task join was rebuilt onto — had no type definition
//     anywhere, while three other types referenced it.
//   · The projection emitted a `Seam` node type that appeared in no relationship, and named its
//     nodes Scope/Trial/Order/Result where the schema said ScopeContract/TrialRow/WorkOrder/
//     WorkResult. The two vocabularies overlapped almost nowhere.
//
// That is the same failure mode as the `tasks[]` defect this suite already guards: a description
// and an implementation that agree with nobody, and are never compared.
//
// WHAT THIS MODULE PROVES, by reading the shipped schema and the shipped projection rather than a
// restatement of either:
//   (a) every ERD node key resolves — a $def, or an explicitly declared external schema file
//   (b) the projection map is TOTAL: every node type graph.mjs emits is accounted for, either
//       typed or recorded as a known gap. A new node type cannot appear silently.
//   (c) every mapped type actually exists
//   (d) THE TIER RULE, checked at the schema level: no SHARED type stores a key that resolves
//       into the LOCAL tier. This is the invariant the scope contract broke by carrying `tasks[]`,
//       asserted where it belongs instead of one artifact at a time.

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Node types the projection emits, read from the shipped module rather than hand-kept. */
function emittedNodeTypes(src) {
  const out = new Set();
  // the two exported roster constants are the projection's own declaration of its vocabulary
  for (const m of src.matchAll(/(?:WORK|DOMAIN)_NODES\s*=\s*\[([^\]]+)\]/g)) {
    for (const q of m[1].matchAll(/"([A-Za-z]+)"/g)) out.add(q[1]);
  }
  // and every literal node(...) call, so a type emitted without being in a roster is still caught
  for (const m of src.matchAll(/\bnode\([^,]+,\s*"([A-Za-z]+)"/g)) out.add(m[1]);
  return out;
}

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
  section("78. The type catalog, the relationship catalog and the running projection agree");
  // =============================================================================

  const schema = JSON.parse(readFileSync(join(ROOT, "skills/tech-lead/schemas/domain.schema.json"), "utf8"));
  const defs = new Set(Object.keys(schema.$defs || {}));
  const erd = schema["x-erd"] || {};
  const rels = erd.relationships || [];
  const external = erd.external || {};
  const projection = erd.projection?.nodes || {};

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

  // --- (b)+(c) the projection map is total, and every mapped type exists -------------------------
  {
    const src = readFileSync(join(ROOT, "kernel/reduce/graph.mjs"), "utf8");
    const emitted = emittedNodeTypes(src);
    const mapped = new Set(Object.keys(projection));

    const unmapped = [...emitted].filter((t) => !mapped.has(t)).sort();
    if (!unmapped.length) {
      ok(`every node type reduce graph emits (${emitted.size}) is accounted for in x-erd.projection`);
    } else {
      fail(`reduce graph emits ${JSON.stringify(unmapped)}, which x-erd.projection does not account for. ` +
        "Add the type, or record it as an explicit gap — a node type the schema has never heard of is " +
        "how Seam came to exist in the projection and in no relationship.");
    }

    const stale = [...mapped].filter((t) => !emitted.has(t)).sort();
    if (!stale.length) ok("x-erd.projection maps nothing the projection stopped emitting");
    else fail(`x-erd.projection still maps ${JSON.stringify(stale)}, which reduce graph no longer emits`);

    const broken = Object.entries(projection)
      .filter(([, v]) => v.type !== null && !defs.has(v.type) && !(v.type in external))
      .map(([k, v]) => `${k}→${v.type}`);
    if (!broken.length) ok("every type the projection map names exists in the catalog");
    else fail(`projection map points at non-existent type(s): ${JSON.stringify(broken)}`);

    // Gaps are allowed, but they must be declared with a reason — never left implicit.
    const undeclared = Object.entries(projection)
      .filter(([, v]) => v.type === null && !v.gap).map(([k]) => k);
    if (!undeclared.length) ok("every untyped projection node declares why it is a gap");
    else fail(`projection node(s) ${JSON.stringify(undeclared)} are untyped with no stated gap reason`);
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
