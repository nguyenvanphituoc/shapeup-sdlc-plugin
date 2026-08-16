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

  const C = await import(join(ROOT, "kernel/lib/contract.mjs"));

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

  // --- (f) HD-001: an UNREADABLE contract must be loud, never empty ------------
  // The heading match is exact, so a table under `# Wiring map — <slug>` used to parse as ABSENT —
  // and every reader downstream treats absent as "none declared". Measured consequence, reproduced
  // with no model in the loop: `trace-lint` printing `🟢 green · reachability: 0/0 engines reach
  // src/cli/main.js` for a committed map holding six correct rows. The gate whose entire purpose is
  // that no engine ships orphaned, failing OPEN on a file that looks right to every human reviewer.
  //
  // Discovered by the Day-1 measurement loop (P3): two of three first drafts wrote exactly this.
  // Asserted on all three legs — the diagnosis, the oracle's verdict, and the gate's exit code —
  // because fixing any one alone leaves the hole open through the others.
  const wrongHeading = [
    "---", "schema_version: 1", "feature: demo", "entry_point: src/main.js", "---",
    "# Wiring map — demo",
    "| use_case | engine | wiring_seam | affordance |",
    "|---|---|---|---|",
    "| UC-01 | src/cart/engine.js | src/main.js:init | Add to cart |",
    "",
  ].join("\n");
  const misfiled = C.parseContract(wrongHeading, C.WIRING_MAP);
  const why = C.unreadableReason(misfiled);
  if (misfiled.entries === undefined && why && /Wiring/.test(why)) {
    ok("HD-001: a table under an unrecognised heading is reported UNREADABLE, not silently absent");
  } else {
    fail(`HD-001 regression: a wiring table under "# Wiring map — demo" parsed as ${JSON.stringify(misfiled.entries)} with reason ${JSON.stringify(why)} — a contract this parser cannot see must not read as a contract that declared nothing`);
  }
  // The clean case must stay quiet, or every correct contract becomes a false alarm.
  if (C.unreadableReason(wiring) === null) ok("HD-001 guard is silent on a correctly-headed contract (no false alarm)");
  else fail(`HD-001 guard fired on a VALID wiring map: ${C.unreadableReason(wiring)}`);
  // Prose tables must not trip it either — the signature columns are what identify the field.
  const withProse = C.parseContract([
    "---", "schema_version: 1", "feature: demo", "entry_point: src/main.js", "---",
    "## Why this map", "| option | verdict |", "|---|---|", "| inline the engine | rejected |", "",
    "## Wiring", "| use_case | engine |", "|---|---|", "| UC-01 | src/cart/engine.js |", "",
  ].join("\n"), C.WIRING_MAP);
  if (withProse.entries?.length === 1 && C.unreadableReason(withProse) === null) {
    ok("HD-001 guard ignores a prose table that lacks the field's signature columns");
  } else fail(`HD-001 guard misread a prose comparison table: entries=${JSON.stringify(withProse.entries)}, reason=${JSON.stringify(C.unreadableReason(withProse))}`);

  // --- (g) HD-002: a QUOTED list member survives the comma delimiter ----------
  // `coerce` used to split `[a, b]` on every comma, quoted or not. Measured consequence, from a
  // paid scope-architect run: the worker probed the running CLI, confirmed `tag` was unimplemented,
  // and wrote the honest single entry its own SKILL.md asks for —
  //   ["TBD — `tag` is not in dispatch.js's TABLE (exits 1, confirmed…). A fixture asserting the
  //     spec'd behaviour (attach/remove a tag, idempotent double-tag) needs the command first."]
  // — and the parser turned that ONE string into FOUR members, three of them prose. `t0-verify`
  // EXECUTES this field, so the run would have tried to spawn `idempotent double-tag)`. A worker
  // doing exactly what its contract asks, mangled on the way in.
  {
    const one = C.coerce('["TBD — not built (exits 1, confirmed). A fixture (attach a tag, remove it) needs the command first."]');
    if (one.length === 1) ok("HD-002: a quoted list member carrying commas parses as ONE member");
    else fail(`HD-002 regression: a quoted member split into ${one.length} members (${JSON.stringify(one)}) — a worker's honest TBD note becomes several bogus commands, and t0-verify runs this field`);
    // The writer's half: re-rendering must quote it back, or the round trip re-shreds it.
    if (JSON.stringify(C.coerce(C.uncoerce(one))) === JSON.stringify(one)) ok("HD-002: a member carrying commas survives render → parse unchanged");
    else fail(`HD-002 regression: round trip changed ${JSON.stringify(one)} into ${JSON.stringify(C.coerce(C.uncoerce(one)))}`);
    // Non-regression: the ordinary forms this field actually carries must be untouched.
    if (JSON.stringify(C.coerce("[TASK-001, TASK-002]")) === '["TASK-001","TASK-002"]') ok("HD-002 fix leaves plain id lists unchanged");
    else fail(`HD-002 fix broke a plain id list: ${JSON.stringify(C.coerce("[TASK-001, TASK-002]"))}`);
    if (JSON.stringify(C.coerce("[src/**, src/cli/dispatch.js]")) === '["src/**","src/cli/dispatch.js"]') ok("HD-002 fix leaves substrate globs unchanged");
    else fail(`HD-002 fix broke a substrate glob list: ${JSON.stringify(C.coerce("[src/**, src/cli/dispatch.js]"))}`);
    // A QUOTED STRING that looks like a list must stay a string — the list test runs before the
    // quotes come off, and inverting that order silently changes the field's type.
    if (C.coerce('"[a, b]"') === "[a, b]") ok("HD-002: a quoted string that looks like a list stays a string");
    else fail(`HD-002: '"[a, b]"' coerced to ${JSON.stringify(C.coerce('"[a, b]"'))} — quoting was stripped before the list test`);
  }

  // --- (h) HD-003: a YAML block sequence is read, and an unreadable shape is reported ----------
  // The third instance of the same family. `key:` followed by indented `- item` lines used to be
  // skipped wholesale, so the value read as null and no reader could tell "declared nothing" from
  // "declared something I discarded". Measured: a scope-architect run wrote three scopes of
  // researched fixtures in this form — expected exit codes, evidence from probing the CLI, a TBD
  // with a reason — and every member evaporated. `t0-verify` consumes this field.
  {
    const blockForm = [
      "---", "scope_id: SC-demo", "tasks: [TASK-001, TASK-002]",
      "e2e_verification_fixtures:",
      '  - "node src/cli/main.js archive"',
      '  - "TBD — not built (exits 1, confirmed). Needs the command first."',
      "business_goal: demo", "---", "",
    ].join("\n");
    const c = C.parseContract(blockForm, C.SCOPE_CONTRACT);
    const fx = c.e2e_verification_fixtures;
    if (Array.isArray(fx) && fx.length === 2 && fx[0] === "node src/cli/main.js archive") {
      ok("HD-003: a YAML block sequence parses as a list (was: silently null)");
    } else fail(`HD-003 regression: a block sequence parsed as ${JSON.stringify(fx)} — the members are discarded and the field reads as undeclared`);
    // The block form is also how a prose member with commas travels without HD-002's quoting rule.
    if (Array.isArray(fx) && /Needs the command first\.$/.test(fx[1] || "")) ok("HD-003: a block member carrying commas survives whole");
    else fail(`HD-003 regression: block member came back as ${JSON.stringify(fx && fx[1])}`);
    // Non-regression: inline lists and scalars beside a block key are untouched.
    if (JSON.stringify(c.tasks) === '["TASK-001","TASK-002"]' && c.business_goal === "demo" && C.unreadableReason(c) === null) {
      ok("HD-003 fix leaves inline lists and scalars alone, and reports the contract as clean");
    } else fail(`HD-003 fix disturbed its neighbours: tasks=${JSON.stringify(c.tasks)} goal=${JSON.stringify(c.business_goal)} reason=${JSON.stringify(C.unreadableReason(c))}`);
    // And the half that matters most: an indented shape that is NOT a block sequence is REPORTED.
    const junk = C.parseContract(["---", "scope_id: SC-junk", "e2e_verification_fixtures:",
      "    node src/cli/main.js archive", "    node src/cli/main.js list", "---", ""].join("\n"), C.SCOPE_CONTRACT);
    if (C.unreadableReason(junk)) ok("HD-003: an indented shape this dialect cannot read is REPORTED, not dropped");
    else fail("HD-003 regression: an unreadable indented block was silently discarded — the next unreadable shape is invisible again");
  }

  // --- (i) HD-005: a markdown code span is FORMATTING, not part of the value ------------------
  // The fifth instance of the family, and the first that fails CLOSED rather than open. These
  // contracts are markdown, and a code span is how anyone writes a path in one — this repo's own
  // prose backticks every path it names. Read literally, `` `src/capture/add.js` `` is a filename
  // containing two backticks, so trace-lint reported "engine file not on disk" and then
  // "reachability is not demonstrated" for a wiring map whose six engines ALL resolve and ALL
  // reach the entry point. Measured: a paid solution-architect round scored 0.667 on a correct
  // map, and stripping the backticks with nothing else changed took it to 1.0.
  {
    const cell = "`src/capture/add.js`";
    if (C.coerce(cell) === "src/capture/add.js") ok("HD-005: a whole-value code span is stripped — the value is the path, not the formatting");
    else fail(`HD-005 regression: ${cell} coerced to ${JSON.stringify(C.coerce(cell))} — trace-lint then reports a resolvable engine as missing, and the reachability gate fails CLOSED on a correct map`);

    // The other half, and the reason the rule is "whole value only": a cell that is PROSE
    // containing spans keeps them. Every wiring map's seam and call-site columns look like this.
    const prose = "Registered as the `add` entry in the command table `TABLE`";
    if (C.coerce(prose) === prose) ok("HD-005: prose containing code spans is left exactly as written");
    else fail(`HD-005 fix over-reached: prose was rewritten to ${JSON.stringify(C.coerce(prose))}`);

    // Two spans with text between them start AND end with a backtick, so a naive strip splices
    // them into one nonsense token. The inner text may not contain a backtick, which rules it out.
    if (C.coerce("`a` and `b`") === "`a` and `b`") ok("HD-005: two adjacent spans are not spliced into one token");
    else fail(`HD-005 fix spliced two spans: ${JSON.stringify(C.coerce("`a` and `b`"))}`);

    // Non-regression across the other coercions, since this runs before all of them.
    const untouched = [["src/x.js", "src/x.js"], ["[a, b]", ["a", "b"]], ['"[a, b]"', "[a, b]"], ["~", null], ["true", true], ["42", 42]];
    const broke = untouched.filter(([i, w]) => JSON.stringify(C.coerce(i)) !== JSON.stringify(w));
    if (!broke.length) ok("HD-005 fix leaves bare paths, lists, quoted lists, null, booleans and numbers unchanged");
    else fail(`HD-005 fix disturbed ${broke.length} existing coercion(s): ${JSON.stringify(broke.map(([i]) => [i, C.coerce(i)]))}`);
  }

  // The oracle leg: trace-lint must go RED and must NOT claim reachability it never checked.
  {
    const { traceLint } = await import("../../kernel/verify/trace.mjs");
    const dir = mkdtempSync(join(tmpdir(), "hd001-"));
    try {
      mkdirSync(join(dir, "shapeup", "demo"), { recursive: true });
      mkdirSync(join(dir, "src"), { recursive: true });
      writeFileSync(join(dir, "src", "main.js"), "export const main = () => {};\n");
      writeFileSync(join(dir, "shapeup", "demo", "project-profile.md"), "---\nschema_version: 1\narchetype: cli\nentry_point: src/main.js\n---\n");
      writeFileSync(join(dir, "shapeup", "demo", "wiring-map.md"), wrongHeading);
      const { report } = traceLint("demo", { cwd: dir });
      const red = report.findings.some((f) => f.code === "WIRING-UNREADABLE" && f.severity === "red");
      if (report.overall === "red" && red) ok("HD-001: trace-lint reports RED on an unreadable wiring map (was: green, 0/0 engines)");
      else fail(`HD-001 regression: trace-lint returned overall=${report.overall} for an unreadable wiring map — the reachability gate fails OPEN`);
      if (report.reachability.checked === false && report.reachability.pass === false) {
        ok("HD-001: trace-lint does not claim reachability it could not check");
      } else fail(`HD-001 regression: reachability reported checked=${report.reachability.checked} pass=${report.reachability.pass} having walked nothing`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // =============================================================================
  section("61. A frontmatter field written as a `## section` is reported ABSENT, loudly");
  // =============================================================================
  // The existing UNREADABLE channel answers "was a declared TABLE written under the wrong heading".
  // It says nothing about the scalars and string lists that live in frontmatter, because the parser
  // has no heading to expect for them — so an author who writes
  //
  //     ## e2e_verification_fixtures
  //     - `node --test test/store.test.js` — round-trips load()/save()
  //
  // produces a contract where the field is simply `undefined`, indistinguishable from "not
  // declared". Measured, on a live run: the fixtures reached `verify t0` as `undefined` and six
  // scopes were certified T0-green having executed nothing, while the substrate list beside them —
  // written as a frontmatter block list — parsed perfectly.
  {
    const { parseContract, unreadableReason, SCOPE_CONTRACT } = await import(join(ROOT, "kernel/lib/contract.mjs"));
    const md = (extra) => [
      "---", "scope_id: sc-01", "topology_type: LAYER_CAKE", "tasks: [TASK-001]",
      "allowed_file_substrate:", "  - src/a.js", "hill_phase: UPHILL_UNKNOWN", "---", "",
      "# Scope: sc-01", "", "## Why this slice", "", "Because the flow crosses two layers.", "", extra,
    ].join("\n");

    const asSection = parseContract(md("## e2e_verification_fixtures\n\n- `node --test test/a.test.js` — round-trips\n"), SCOPE_CONTRACT);
    const reason = unreadableReason(asSection);
    if (asSection.e2e_verification_fixtures === undefined && reason && /FRONTMATTER key/.test(reason)) {
      ok("a frontmatter field written as a `## section` is reported unreadable, and the message names the actual fix");
    } else {
      fail(`a field written as a markdown section parsed as ABSENT with no diagnostic (reason=${JSON.stringify(reason)}). ` +
        `Every reader downstream then treats it as "not declared" — which is how a scope reached T0 with nothing to run.`);
    }

    // Prose headings must not trip it: a contract is mostly prose, and a detector that cried wolf on
    // "## Why this slice" would be turned off within a day.
    const proseOnly = parseContract(md("## Affordances\n\n| test_id | role |\n|---|---|\n| cli:add | command |\n"), SCOPE_CONTRACT);
    if (!unreadableReason(proseOnly)) ok("ordinary prose and table headings raise nothing — the detector matches a bare snake_case field name only");
    else fail(`the detector fires on an ordinary contract: ${unreadableReason(proseOnly)}`);

    // And a field present in BOTH places is not a mistake worth reporting — frontmatter won.
    const both = parseContract([
      "---", "scope_id: sc-01", "e2e_verification_fixtures: [node --test test/a.test.js]", "---", "",
      "## e2e_verification_fixtures", "", "documented again in prose for the reader", "",
    ].join("\n"), SCOPE_CONTRACT);
    if (!unreadableReason(both) && Array.isArray(both.e2e_verification_fixtures)) {
      ok("a field in frontmatter AND echoed as a prose heading is read from frontmatter, silently");
    } else {
      fail(`a correctly-declared field is reported unreadable because prose repeats its name: ${unreadableReason(both)}`);
    }
  }

  // ---------------------------------------------------------------------------
  // (f) A VALUE CARRYING A QUOTE SURVIVES. The corpus above contains no quote character anywhere,
  //     which is how a lossy reader shipped: `coerce` stripped a leading OR trailing quote
  //     independently, so any value merely ENDING in one lost it. Verification fixtures are shell
  //     one-liners and quote constantly, so this is not an exotic input — it is the common one.
  //
  //     What made it expensive is that nothing reports it as a parse error. The truncated fixture
  //     reaches the shell as a syntax error, the attempt scores red, and a correct implementation
  //     is retried until its budget is gone. A lossy reader and a builder that cannot make progress
  //     look identical from outside, so the assertion has to live here, at the reader.
  // ---------------------------------------------------------------------------
  {
    const quoted = [
      ['say "hi"', "a value ending in a double quote"],
      ['export STORE="$T/s.json"', "a shell assignment, the shape that actually broke"],
      ["it's", "a value ending in an apostrophe"],
      ['"quoted"', "a value that is itself wrapped in quotes"],
      ["'q'", "the same with apostrophes"],
      ['a "b" c', "quotes in the middle"],
      ["plain", "the ordinary case"],
    ];
    let lost = 0;
    for (const [value, label] of quoted) {
      const back = C.coerce(C.uncoerce(value));
      if (back === value) ok(`round trip preserves ${label}`);
      else { lost++; fail(`coerce(uncoerce(${JSON.stringify(value)})) === ${JSON.stringify(back)} — ${label} was corrupted in transit`); }
    }

    // The same property through a real table cell, since frontmatter and cells share the reader
    // but not the surrounding syntax.
    const withQuote = 'bash -c \'echo "ok"\'';
    const md = [
      "---", "scope_id: SC-Q", `db_probe: ${C.uncoerce(withQuote)}`, "---",
      "# SC-Q", "", "## Why this slice", "", "Because quoting is not exotic.", "",
    ].join("\n");
    const parsed = C.parseContract(md, C.SCOPE_CONTRACT);
    if (parsed.db_probe === withQuote) ok("a quoted shell command survives the frontmatter round trip intact");
    else fail(`db_probe read back as ${JSON.stringify(parsed.db_probe)}, not ${JSON.stringify(withQuote)} — the fixture the verifier runs is not the one the author wrote`);

    if (!lost) ok("no value containing a quote is silently truncated by the contract reader");
  }
}
