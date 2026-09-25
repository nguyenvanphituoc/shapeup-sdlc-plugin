// A LIST TOO LONG FOR ONE LINE IS STILL A LIST.
//
// The contract dialect read two list forms — `field: [a, b]` on one line, and an indented
// `- item` block — and a third one that a model reaches for the moment the members stop fitting:
//
//     allowed_file_substrate: [
//       "app/.../ui/**",
//       "app/.../profile/route_map.json"
//     ]
//
// took only the text after the colon. The value became the single character "[", its members were
// counted as unreadable strays, and every reader downstream saw a string where an array was
// declared. That is not a cosmetic parse: a scope contract's substrate IS the build leg's write
// permission, and the compiler refuses to write an order that fails its own envelope schema — so a
// scope written this way could not be dispatched at all.
//
// Measured on a live unattended run: three of five scope contracts came back in this form from one
// scope-mapping dispatch. The run would have reached BUILD with three of its five scopes
// uncompilable. Fixed at the parser rather than in guidance to the worker, because a worker carries
// no lesson across a dispatch and the correct value was on disk the whole time.
//
// This module drives the real reader, the real compiler and the real hook, and pins the three
// answers that have to stay apart: a closed sequence is its members, a sequence that never closes
// is REPORTED rather than guessed at, and a quoted bracket is a character rather than structure.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/** Frontmatter-only contract text, so the parser is exercised on exactly the shape under test. */
function contract(body) {
  return ["---", "schema_version: 1", "scope_id: sc-flow", "title: flow",
    body, 'e2e_verification_fixtures: ["true"]', "---", "", "# sc-flow", ""].join("\n");
}

/**
 * Run the flow-sequence parsing checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("151. A flow sequence that spans lines is the list it declares, and an unclosed one is reported");
  // =============================================================================

  const { splitFrontmatter, UNREADABLE } = await import(join(ROOT, "kernel/lib/contract.mjs"));
  const meta = (body) => splitFrontmatter(contract(body));

  // --- (1) The form the defect was measured on: one member per line, closing bracket alone. ------
  {
    const { meta: m } = meta('allowed_file_substrate: [\n  "app/ui/**",\n  "app/profile/route_map.json"\n]');
    const v = m.allowed_file_substrate;
    if (Array.isArray(v) && v.length === 2 && v[0] === "app/ui/**" && v[1] === "app/profile/route_map.json") {
      ok("a flow sequence broken across lines parses to its members — the form a model writes as soon as the list stops fitting on one line");
    } else fail(`a multi-line flow sequence parsed to ${JSON.stringify(v)} — the members are the value, not the bracket`);

    if (!m[UNREADABLE]) ok("and it raises no unreadable diagnostic: the lines were consumed as the sequence, not counted as strays");
    else fail(`the members were also reported unreadable: ${JSON.stringify(m[UNREADABLE])}`);
  }

  // --- (1b) THE SCAN STOPS AT THE CLOSING BRACKET. A consuming loop that overruns eats every key
  //          after it, which would be a far worse defect than the one being fixed: the contract
  //          would parse, with fields silently missing. Asked on both a closed and an open form. ---
  {
    const { meta: m } = splitFrontmatter(
      ["---", "schema_version: 1", 'allowed_file_substrate: [', '  "a/**",', '  "b/**"', ']',
        'shared_substrate: ["s/**"]', "hill_phase: UPHILL_UNKNOWN", "---", "", "# x", ""].join("\n"));
    if (Array.isArray(m.allowed_file_substrate) && m.shared_substrate?.[0] === "s/**" && m.hill_phase === "UPHILL_UNKNOWN") {
      ok("the scan stops at the closing bracket — every key after a multi-line sequence still parses, so the fix cannot silently swallow fields");
    } else fail(`keys after the sequence were lost: ${JSON.stringify({ shared: m.shared_substrate, hill: m.hill_phase })}`);
  }

  // --- (1c) The variants a writer actually produces, none of which may change type. --------------
  {
    const variants = [
      ["members beginning on the opening line", 'allowed_file_substrate: ["x/**",\n  "y/**"]', ["x/**", "y/**"]],
      ["a trailing comma before the close", 'allowed_file_substrate: [\n  "x/**",\n  "y/**",\n]', ["x/**", "y/**"]],
      ["an empty sequence", "allowed_file_substrate: []", []],
    ];
    for (const [label, body, want] of variants) {
      const v = meta(body).meta.allowed_file_substrate;
      if (Array.isArray(v) && JSON.stringify(v) === JSON.stringify(want)) ok(`${label} parses to ${JSON.stringify(want)}`);
      else fail(`${label} parsed to ${JSON.stringify(v)}, wanted ${JSON.stringify(want)}`);
    }
    // And a bracket that opens PROSE is not a sequence at all — the value is the prose.
    const prose = meta("note: [draft] rewrite before betting").meta.note;
    if (prose === "[draft] rewrite before betting") ok("a line whose bracket closes mid-prose stays the prose — the fix reads sequences, not any line starting with a bracket");
    else fail(`bracketed prose was mangled: ${JSON.stringify(prose)}`);
  }

  // --- (2) The two forms that already worked keep working, byte for byte. ------------------------
  {
    const inline = meta('allowed_file_substrate: ["a/**", "b/**"]').meta.allowed_file_substrate;
    if (Array.isArray(inline) && inline.join("|") === "a/**|b/**") ok("the single-line flow sequence is unchanged");
    else fail(`the one-line form regressed: ${JSON.stringify(inline)}`);

    const block = meta("allowed_file_substrate:\n  - a/**\n  - b/**").meta.allowed_file_substrate;
    if (Array.isArray(block) && block.join("|") === "a/**|b/**") ok("the indented block sequence is unchanged");
    else fail(`the block form regressed: ${JSON.stringify(block)}`);
  }

  // --- (3) A bracket inside quotes is a character, not structure — which is why the scanner tracks
  //         quoting rather than counting brackets. A substrate glob can carry one. ----------------
  {
    const v = meta('allowed_file_substrate: [\n  "src/[id]/page.ts",\n  "src/b.ts"\n]').meta.allowed_file_substrate;
    if (Array.isArray(v) && v.length === 2 && v[0] === "src/[id]/page.ts") {
      ok("a bracket inside a quoted member does not close the sequence — a route-parameter path stays one glob");
    } else fail(`a quoted bracket was read as structure: ${JSON.stringify(v)}`);
  }

  // --- (4) A sequence that never closes is REPORTED, never guessed at. The whole point of the fix
  //         is that a value the dialect cannot read is distinguishable from one it read. ----------
  {
    const { meta: m } = meta('allowed_file_substrate: [\n  "a/**",\n  "b/**"');
    if (m.allowed_file_substrate === null && (m[UNREADABLE] || []).some((u) => u.field === "allowed_file_substrate")) {
      ok("an unclosed flow sequence yields null AND a diagnostic naming the field — unreadable and read-as-something are different facts");
    } else fail(`an unclosed sequence produced ${JSON.stringify(m.allowed_file_substrate)} with diagnostics ${JSON.stringify(m[UNREADABLE])}`);
  }

  // --- (5) THROUGH THE REAL COMPILER AND THE REAL HOOK. The parse is only interesting because the
  //         substrate is a build leg's write permission; this is the failure the run actually hit. -
  const ws = mkdtempSync(join(tmpdir(), "flow-seq-"));
  try {
    spawnSync("git", ["init", "-q", "-b", "main"], { cwd: ws });
    mkdirSync(join(ws, "shapeup/demo/scopes"), { recursive: true });
    writeFileSync(join(ws, "shapeup/demo/scopes/sc-flow.md"),
      contract('allowed_file_substrate: [\n  "app/ui/**",\n  "app/profile/route_map.json"\n]'));
    const compiled = spawnSync(process.execPath,
      [join(ROOT, "kernel/harness.mjs"), "compile", "--scope", join(ws, "shapeup/demo/scopes/sc-flow.md"),
        "--round", "1", "--attempt", "1", "--cwd", ws], { cwd: ws, encoding: "utf8" });
    const orderPath = join(ws, ".shapeup/demo/orders/sc-flow-r1-a1.json");
    if (compiled.status === 0 && existsSync(orderPath)) {
      ok("a scope declaring its substrate this way compiles — before the fix the order failed its own envelope schema and the scope could not be dispatched at all");
    } else {
      fail(`compile refused the order (exit ${compiled.status}): ${(compiled.stderr || compiled.stdout || "").slice(0, 200)}`);
      return;
    }

    const allowed = JSON.parse(readFileSync(orderPath, "utf8")).substrate.allowed;
    if (allowed.includes("app/ui/**") && allowed.includes("app/profile/route_map.json")) {
      ok("and the order's allowed substrate carries both members, so the leg may write what its contract says it owns");
    } else fail(`the compiled substrate lost the members: ${JSON.stringify(allowed)}`);

    const ask = (rel) => {
      const payload = JSON.stringify({ tool_name: "Write", cwd: ws, tool_input: { file_path: join(ws, rel), content: "x" } });
      const r = spawnSync(process.execPath, [join(ROOT, "hooks/sandbox-guard.mjs")], { encoding: "utf8", input: payload });
      return (r.stdout || "").includes('"permissionDecision":"deny"');
    };
    if (!ask("app/ui/ListPage.ets")) ok("the hook permits a write the contract declares — the parse reaches the enforcement layer, which is the only place it matters");
    else fail("the hook denied a write inside the scope's own declared substrate");
    if (ask("app/other/Thing.ets")) ok("and still denies one it does not — the fix widened a parse, not a permission");
    else fail("a write outside the declared substrate was permitted — the fix must not have turned the substrate into a wildcard");
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }

  // --- (6) The per-scope reachability arm skips a contract it cannot read rather than throwing
  //         over it. The oracle is advisory, so one bad contract must not silence every arm. -------
  {
    const { scopeReachability } = await import(join(ROOT, "kernel/verify/trace.mjs"));
    let rows;
    try {
      rows = scopeReachability(
        [{ contract: { scope_id: "broken", allowed_file_substrate: "[" } },
          { contract: { scope_id: "fine", allowed_file_substrate: ["src/**"] } }],
        new Set(["src/a.js"]), ["src/a.js"]);
    } catch (e) {
      fail(`a malformed contract threw out of the per-scope arm (${e.message}) — the oracle runs advisory, so this loses covers-closure too`);
      return;
    }
    if (rows.length === 1 && rows[0].scope_id === "fine") {
      ok("a contract whose substrate is not a list of globs is skipped, and its readable sibling is still measured");
    } else fail(`the arm mishandled a malformed contract: ${JSON.stringify(rows)}`);
  }
}
