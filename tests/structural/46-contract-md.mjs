// 46 — the committed contracts are markdown, and the parser is honest about it.
//
// ADR-0001 moved ScopeContract, WiringMap and ProjectProfile from `.json` to markdown so a
// reviewer can read the low-level design in a pull request. The risk that introduces is a
// LOSSY round-trip: a generator regenerates a contract, quietly drops a field or a teammate's
// rationale paragraph, and the substrate the sandbox enforces is no longer the one anyone agreed
// to. Nothing about that would throw.
//
// So the assertions here are about preservation, not parsing:
//   (a) parse → render → parse is stable, including the nested array-of-objects field;
//   (b) prose under a heading the spec does not own survives regeneration;
//   (c) the legacy `.json` is still read, because code and data upgrade at different moments;
//   (d) markdown beats a stale `.json` sibling, so a leftover cannot resurrect an old substrate;
//   (e) a `|` inside a value survives the table round-trip rather than splitting the row.

import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("46. Committed contracts round-trip as markdown without losing fields or prose");
  // =============================================================================

  const C = await import(join(ROOT, "skills/tech-lead/scripts/lib/contract-md.mjs"));

  const SCOPE_MD = [
    "---",
    "scope_id: SC-02",
    "topology_type: LAYER_CAKE",
    "allowed_file_substrate: [src/cart/**, src/pricing/total.ts]",
    "e2e_verification_fixtures: [npm run e2e:cart]",
    "db_probe: npm run db:check -- --table carts",
    "hill_phase: uphill",
    "---",
    "# SC-02 — cart creation",
    "",
    "## Why this slice",
    "Cart creation touches pricing and inventory in one transaction.",
    "",
    "## Affordances",
    "| test_id | role | required_states |",
    "|---|---|---|",
    "| add-to-cart | button | [empty, one-item] |",
    "| cart-badge | status | [empty] |",
    "",
  ].join("\n");

  // --- (a) round-trip stability ----------------------------------------------
  const first = C.parseContract(SCOPE_MD, C.SCOPE_CONTRACT);
  const rendered = C.renderContract(first, C.SCOPE_CONTRACT, { existing: SCOPE_MD });
  const second = C.parseContract(rendered, C.SCOPE_CONTRACT);

  if (JSON.stringify(first) === JSON.stringify(second)) ok("scope contract round-trips unchanged (parse → render → parse)");
  else fail(`scope contract lost or altered data on round-trip:\n  before ${JSON.stringify(first)}\n  after  ${JSON.stringify(second)}`);

  // The substrate is the field the sandbox hook enforces — name it explicitly rather than
  // trusting the whole-object compare, so a failure here says what actually broke.
  if (Array.isArray(first.allowed_file_substrate) && first.allowed_file_substrate.length === 2) {
    ok("allowed_file_substrate parses as a list (the glob set sandbox-guard enforces)");
  } else fail(`allowed_file_substrate did not parse as a 2-item list: ${JSON.stringify(first.allowed_file_substrate)}`);

  const aff = first.affordance_manifest;
  if (aff?.length === 2 && Array.isArray(aff[0].required_states) && aff[0].required_states.length === 2) {
    ok("affordance_manifest parses from a markdown table, nested list cell included");
  } else fail(`affordance_manifest did not parse: ${JSON.stringify(aff)}`);

  // --- (b) prose survives regeneration ---------------------------------------
  if (rendered.includes("Cart creation touches pricing")) ok("rationale prose survives a regeneration");
  else fail("regeneration destroyed the author's prose — the format is worse than the JSON it replaced");

  // --- (e) a pipe inside a value ---------------------------------------------
  const piped = C.renderContract(
    { scope_id: "SC-03", affordance_manifest: [{ test_id: "a|b", role: "button" }] },
    C.SCOPE_CONTRACT,
  );
  const pipedBack = C.parseContract(piped, C.SCOPE_CONTRACT);
  if (pipedBack.affordance_manifest?.[0]?.test_id === "a|b") ok("a `|` inside a cell survives the table round-trip");
  else fail(`a pipe in a cell broke the row: ${JSON.stringify(pipedBack.affordance_manifest)}`);

  // --- (c)/(d) on-disk resolution --------------------------------------------
  const dir = mkdtempSync(join(tmpdir(), "contract-md-"));
  try {
    mkdirSync(join(dir, "scopes"), { recursive: true });

    // legacy JSON only → still read (code and data upgrade at different moments)
    writeFileSync(join(dir, "scopes", "legacy.json"), JSON.stringify({ scope_id: "legacy", allowed_file_substrate: ["src/a/**"] }));
    const legacy = C.readContract(join(dir, "scopes", "legacy"), C.SCOPE_CONTRACT);
    if (legacy?.format === "json" && legacy.contract.scope_id === "legacy") ok("a legacy .json contract is still read (mid-migration projects keep working)");
    else fail(`legacy .json was not read: ${JSON.stringify(legacy)}`);

    // both present → markdown wins, so a stale leftover cannot resurrect an old substrate
    writeFileSync(join(dir, "scopes", "both.json"), JSON.stringify({ scope_id: "both", allowed_file_substrate: ["OLD/**"] }));
    writeFileSync(join(dir, "scopes", "both.md"), "---\nscope_id: both\nallowed_file_substrate: [NEW/**]\n---\n");
    const both = C.readContract(join(dir, "scopes", "both"), C.SCOPE_CONTRACT);
    if (both?.format === "markdown" && both.contract.allowed_file_substrate?.[0] === "NEW/**") {
      ok("markdown wins over a stale .json sibling — a leftover cannot restore an old substrate");
    } else fail(`stale .json won over markdown: ${JSON.stringify(both)}`);

    // absent → null, never a throw (every caller has a fail-open branch keyed on this)
    if (C.readContract(join(dir, "scopes", "nope"), C.SCOPE_CONTRACT) === null) ok("an absent contract returns null rather than throwing");
    else fail("readContract did not return null for an absent contract");

    // Directory scan: three FILES on disk (legacy.json, both.json, both.md) but only TWO scopes.
    // The `both` pair is one contract in two formats, and counting it twice would hand the
    // orchestrator a duplicate scope to build.
    const all = C.readAllContracts(join(dir, "scopes"), C.SCOPE_CONTRACT);
    const ids = all.map((c) => c.id).sort();
    if (ids.length === 2 && ids.join(",") === "both,legacy") {
      ok("readAllContracts collapses a .md/.json pair into one contract (2 scopes from 3 files)");
    } else fail(`readAllContracts returned ${all.length} entries (${ids.join(", ")}) — expected exactly both, legacy`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // --- the other two contract types ------------------------------------------
  const wiring = C.parseContract([
    "---", "schema_version: 1", "feature: demo", "entry_point: src/main.js", "---",
    "## Wiring",
    "| use_case | engine | wiring_seam | affordance |",
    "|---|---|---|---|",
    "| UC-01 | src/cart/engine.js | src/main.js:init | Add to cart |",
    "",
  ].join("\n"), C.WIRING_MAP);
  if (wiring.entries?.length === 1 && wiring.entries[0].engine === "src/cart/engine.js" && wiring.entry_point === "src/main.js") {
    ok("wiring map parses its entries table and entry_point");
  } else fail(`wiring map did not parse: ${JSON.stringify(wiring)}`);

  const profile = C.parseContract("---\nschema_version: 1\narchetype: web-service\nentry_point: src/server.ts\n---\n", C.PROJECT_PROFILE);
  if (profile.archetype === "web-service" && profile.entry_point === "src/server.ts" && profile.schema_version === 1) {
    ok("project profile parses (all scalars, schema_version stays a number)");
  } else fail(`project profile did not parse: ${JSON.stringify(profile)}`);
}
