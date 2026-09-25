// A CHECK THAT IS RED FOR EVERY INPUT IS NOT A CHECK, AND IT MUST NOT CLAIM TO HAVE LOOKED.
//
// The reachability arm walks the import graph from the project profile's entry point and reds any
// use-case engine it does not reach. It resolved imports by trying six suffixes — the JS/TS family
// — so on a stack whose modules end in anything else it followed no relative import at all: the
// walk stopped at the entry file, every engine came back "never imported from the entry point",
// and the report said `checked: true`. Measured on a real consumer: 2 files reachable out of 53,
// every engine orphaned, red on every run of every feature.
//
// TWO PROPERTIES CLOSE IT, and this module drives both through the shipped oracle against real
// files on disk rather than asserting on the helpers:
//
//   1. The walk uses the extensions the PROJECT declares — `source_extensions` in the profile, and
//      always the entry point's own suffix, which is a module extension of this project by
//      construction. An edge it still cannot follow makes the graph incomplete, and an incomplete
//      graph grades nothing: it reports unchecked and warns, rather than reporting the destination
//      orphaned.
//
//   2. The arm needs one positive control. With NO engine reachable, "every engine is dead" and "I
//      am walking the wrong tree" produce byte-identical evidence — and whole archetypes wire
//      screens by name at runtime, so their entry file imports no engine and the import graph is
//      complete and beside the point. The arm reports unchecked instead of choosing. The cost is
//      named in the oracle and pinned below: a single-engine wiring map can no longer red.
//
// What must NOT change: a genuinely orphaned module among reachable siblings is still red. That is
// the defect the arm exists for, and every relaxation above is written so it survives.
//
// SECTION TWO asks the same graph a second question, for a defect the first arm cannot see. A
// per-scope build fixture can be green while the scope's own code never compiles, on any toolchain
// that compiles only what the entry point reaches: three scopes were T0-green on an assemble
// fixture while their files were outside the compiled set, and the errors surfaced only when a
// later scope wired the screens in. The oracle now reports, per scope, how much of its own source
// substrate the app reaches — and warns, never reds, when the answer is none.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

/** Write a file, creating its directory. */
function w(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
}

/**
 * Build a project fixture and run the shipped oracle over it.
 *
 * @param {{files:Record<string,string>, entry:string, exts?:string[],
 *   engines:Array<[string,string]>, scopes?:Array<[string,string[]]>}} spec - Source files, the
 *   declared entry point, an optional `source_extensions` declaration, the wiring map's
 *   [use_case, engine] rows, and optional [scope_id, substrate globs] contracts.
 * @param {string} ROOT - The plugin checkout root.
 * @returns {object} The parsed trace report.
 */
function traceOver(spec, ROOT) {
  const cwd = mkdtempSync(join(tmpdir(), "struct-reach-"));
  try {
    for (const [rel, body] of Object.entries(spec.files)) w(cwd, rel, body);
    w(cwd, "shapeup/demo/project-profile.md",
      ["---", "schema_version: 1", "archetype: mobile", `entry_point: ${spec.entry}`,
        ...(spec.exts ? [`source_extensions: [${spec.exts.map((e) => `"${e}"`).join(", ")}]`] : []),
        "---", "", "# profile", ""].join("\n"));
    w(cwd, "shapeup/demo/wiring-map.md",
      ["---", "schema_version: 1", "---", "", "# Wiring", "", "## Wiring", "",
        "| use_case | engine | seam | entry_point_call_site | affordance |",
        "|---|---|---|---|---|",
        ...spec.engines.map(([uc, eng]) => `| ${uc} | ${eng} | S | ${spec.entry} | a |`), ""].join("\n"));
    for (const [id, globs] of spec.scopes || []) {
      w(cwd, `shapeup/demo/scopes/${id}.md`,
        ["---", "schema_version: 1", `scope_id: ${id}`, `title: ${id}`,
          `allowed_file_substrate: [${globs.map((g) => `"${g}"`).join(", ")}]`, "---", "", `# ${id}`, ""].join("\n"));
    }
    spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "verify", "trace", "--slug", "demo", "--cwd", cwd, "--quiet"],
      { cwd, encoding: "utf8" });
    return JSON.parse(readFileSync(join(cwd, ".shapeup/demo/trace/report.json"), "utf8"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/**
 * Run the reachability honesty checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("149. Reachability walks the project's own language, and says \"unchecked\" instead of red when it cannot");
  // =============================================================================

  const codes = (r) => r.findings.map((f) => f.code);

  // --- (1) The stack the walker could not read. The entry point's own suffix is a module extension
  //         of this project by construction, so nothing has to be declared for this to work. -------
  {
    const r = traceOver({
      entry: "src/pages/EntryAbility.ets",
      files: {
        "src/pages/EntryAbility.ets": "import { AboutEngine } from '../engine/about';\nexport class EntryAbility {}\n",
        "src/engine/about.ets": "export class AboutEngine {}\n",
        "src/engine/detail.ets": "export class DetailEngine {}\n",
      },
      engines: [["UC-01", "src/engine/about.ets"], ["UC-02", "src/engine/detail.ets"]],
    }, ROOT);
    const reach = r.reachability;
    if (reach.checked && (reach.module_extensions || []).includes(".ets")) {
      ok("the walk adopts the entry point's own suffix — an .ets entry makes .ets a module extension of this project, with nothing declared");
    } else fail(`the entry point's suffix did not reach the walker: checked=${reach.checked} exts=${JSON.stringify(reach.module_extensions)}`);

    // And with that suffix the arm still discriminates: about is imported, detail is not.
    const dead = (reach.unreachable || []).map((u) => u.engine);
    if (reach.checked && !reach.pass && dead.length === 1 && dead[0] === "src/engine/detail.ets") {
      ok("on that stack the arm still catches the dead module and only the dead one — the fix widened the alphabet, not the verdict");
    } else fail(`expected exactly src/engine/detail.ets orphaned, got checked=${reach.checked} pass=${reach.pass} dead=${JSON.stringify(dead)}`);
  }

  // --- (2) An edge the walk could not follow makes the graph incomplete — and an incomplete graph
  //         reports itself, instead of reporting the destination orphaned. ------------------------
  {
    const spec = {
      entry: "src/main.ts",
      files: {
        "src/main.ts": "import { E } from './engine/about';\nexport const main = 1;\n",
        "src/engine/about.ets": "export class E {}\n",
      },
      engines: [["UC-01", "src/engine/about.ets"], ["UC-02", "src/main.ts"]],
    };
    const r = traceOver(spec, ROOT);
    const reach = r.reachability;
    if (reach.checked === false && reach.pass === true && reach.unresolved_imports === 1 && codes(r).includes("GRAPH-INCOMPLETE")) {
      ok("a relative import that resolves to no file makes the arm report itself unchecked and warn — a missing edge is not evidence of a missing call site");
    } else fail(`an unfollowable edge did not stop the verdict: ${JSON.stringify({ checked: reach.checked, pass: reach.pass, unresolved: reach.unresolved_imports, codes: codes(r) })}`);

    if (!codes(r).includes("UC-UNREACHABLE")) ok("and it publishes no UC-UNREACHABLE while the graph is incomplete");
    else fail("the arm reported an engine orphaned over a graph it could not finish walking");

    // Declaring the extension completes the graph, and the same project then checks clean.
    const r2 = traceOver({ ...spec, exts: [".ets"] }, ROOT);
    if (r2.reachability.checked === true && r2.reachability.pass === true) {
      ok("declaring source_extensions in the profile completes the graph and the same project checks green — the declaration is the way out, and it works");
    } else fail(`source_extensions did not complete the walk: ${JSON.stringify(r2.reachability)}`);
  }

  // --- (3) The positive control. Every engine unreachable is the one result the arm cannot tell
  //         from a wrong root, so it refuses to publish it. -----------------------------------------
  {
    // A framework entry that loads its screens by NAME: the import graph is complete (every
    // specifier resolves) and reaches no engine at all.
    const r = traceOver({
      entry: "src/EntryAbility.ets",
      files: {
        "src/EntryAbility.ets": "import { hold } from './runtime/holder';\nexport class A { onWindowStageCreate(s){ s.loadContent('pages/Index'); } }\n",
        "src/runtime/holder.ets": "export const hold = 1;\n",
        "src/pages/Index.ets": "export struct Index {}\n",
        "src/features/about.ets": "export class About {}\n",
      },
      engines: [["UC-01", "src/pages/Index.ets"], ["UC-02", "src/features/about.ets"]],
    }, ROOT);
    const reach = r.reachability;
    if (reach.checked === false && reach.pass === true && reach.engines_reachable === 0 && codes(r).includes("REACH-NO-CONTROL")) {
      ok("with no engine reachable the arm reports unchecked and warns — a screen registered by name leaves a complete import graph that is beside the point");
    } else fail(`every-engine-orphaned was published as a verdict: ${JSON.stringify({ checked: reach.checked, pass: reach.pass, reachable: reach.engines_reachable, codes: codes(r) })}`);

    if (!codes(r).includes("UC-UNREACHABLE") && r.overall !== "red") {
      ok("it reds nothing and names the entry point in its reason, so the operator is told what to re-declare rather than handed six dead modules");
    } else fail(`the no-control path still reds: overall=${r.overall} codes=${JSON.stringify(codes(r))}`);

    // THE COST, PINNED RATHER THAN HIDDEN. A one-engine wiring map is exactly the indistinguishable
    // case, so its orphan is reported unchecked. This assertion exists so the loss is a recorded
    // decision and a future reader who wants it back knows what they are trading for.
    const one = traceOver({
      entry: "src/main.js",
      files: { "src/main.js": "export const m = 1;\n", "src/orphan.js": "export const o = 1;\n" },
      engines: [["UC-01", "src/orphan.js"]],
    }, ROOT);
    if (one.reachability.checked === false) {
      ok("KNOWN COST: a wiring map with one engine cannot red — its only engine being unreachable is the case the arm cannot distinguish, so it is reported unchecked");
    } else fail("a single-engine wiring map reported a verdict — the positive-control rule is not being applied consistently");
  }

  // --- (4) NON-REGRESSION, the defect the arm exists for: an orphan among reachable siblings is
  //         still red, and an asset import is not mistaken for a missing module. -------------------
  {
    const r = traceOver({
      entry: "src/main.js",
      files: {
        "src/main.js": "import './missing.css';\nimport { A } from './a';\nexport const m = 1;\n",
        "src/a.js": "export const A = 1;\n",
        "src/orphan.js": "export const B = 2;\n",
      },
      engines: [["UC-01", "src/a.js"], ["UC-02", "src/orphan.js"]],
    }, ROOT);
    const reach = r.reachability;
    const dead = (reach.unreachable || []).map((u) => u.engine);
    if (reach.checked && !reach.pass && dead.length === 1 && dead[0] === "src/orphan.js" && r.overall === "red") {
      ok("the dead module among live siblings is still red — 631 lines with no call site is what this arm is for, and none of the three relaxations reaches it");
    } else fail(`the original defect stopped reding: ${JSON.stringify({ checked: reach.checked, pass: reach.pass, dead, overall: r.overall })}`);

    if (!codes(r).includes("GRAPH-INCOMPLETE")) {
      ok("an import of a stylesheet that is not even on disk does not count as an unfollowable module edge — a non-module suffix is an asset, and assets are not engines");
    } else fail("a missing .css import was counted as an incomplete graph, which would silence the arm on any project that imports one");
  }

  // --- (5) The profile's declaration reaches the schema, so a project that needs it can write it
  //         without its contract being an undeclared field. ------------------------------------------
  {
    const schema = JSON.parse(readFileSync(join(ROOT, "kernel/schemas/domain.schema.json"), "utf8"));
    const prop = schema.$defs?.ProjectProfile?.properties?.source_extensions;
    if (prop && prop.type === "array") ok("ProjectProfile declares source_extensions, so the way out of an incomplete graph is a documented field rather than folklore");
    else fail("source_extensions is not in the ProjectProfile schema — the warning tells the operator to declare a field the contract does not have");
  }

  // =============================================================================
  section("150. A scope whose code the app never reaches is named, and only ever warned about");
  // =============================================================================

  // One graph, three scopes, and the three answers that matter: a scope the app partly reaches, a
  // scope it reaches none of, and a scope that owns no source at all. The fixture is the defect's
  // own shape — a build fixture compiling only what the entry point reaches is green for all three.
  {
    const r = traceOver({
      entry: "src/main.js",
      files: {
        "src/main.js": "import { A } from './wired/a';\nexport const m = 1;\n",
        "src/wired/a.js": "export const A = 1;\n",
        "src/wired/a.test.js": "export const t = 1;\n",   // owned, never imported: the normal case
        "src/orphan/b.js": "export const B = 2;\n",
        "src/res/strings.json": "{}\n",
      },
      engines: [["UC-01", "src/wired/a.js"]],
      scopes: [["wired", ["src/wired/**"]], ["orphan", ["src/orphan/**"]], ["res", ["src/res/**"]]],
    }, ROOT);
    const sr = r.scope_reachability;
    const by = Object.fromEntries((sr.scopes || []).map((x) => [x.scope_id, x]));

    if (sr.checked && by.wired?.source_files === 2 && by.wired?.reachable_files === 1 && by.orphan?.reachable_files === 0) {
      ok("the report says per scope how much of its own substrate the app reaches — the fact a per-scope build fixture cannot produce");
    } else fail(`per-scope reachability is wrong or absent: ${JSON.stringify(sr)}`);

    // THE THRESHOLD IS "NONE", NOT "ANY", and that is the whole difference between a signal and
    // noise. Every scope owns files no import graph reaches — a test, a fixture, a helper a later
    // scope will call — so warning on any unreached file would warn on every scope ever cut.
    if (!r.findings.some((f) => f.code === "SCOPE-UNREACHABLE" && f.scope === "wired")) {
      ok("a scope with one reached file and one unreached is not warned about — owning a file the app does not import is the normal case, not a finding");
    } else fail("a partly-reached scope was warned about, which would fire on essentially every scope ever cut");

    const warned = r.findings.filter((f) => f.code === "SCOPE-UNREACHABLE");
    if (warned.length === 1 && warned[0].scope === "orphan" && warned[0].severity === "warn") {
      ok("exactly the scope with no reachable file is named, and as a warn — everything that scope contributes sits outside the running app");
    } else fail(`expected one warn naming "orphan", got ${JSON.stringify(warned.map((f) => [f.scope, f.severity]))}`);

    if (r.overall !== "red") ok("and it does not red: wiring a scope in may legitimately be a later scope's job, which is a plan the PO made and not a defect an oracle found");
    else fail("SCOPE-UNREACHABLE turned the report red — a scope awaiting its wiring scope would block every board that cuts that way");

    if (!by.res) ok("a scope owning only non-source files is left out entirely rather than reported as unreachable — resources, route maps and manifests are not import-graph nodes");
    else fail(`the resource-only scope was measured as if it held code: ${JSON.stringify(by.res)}`);
  }

  // AND THE ARM HAS TO RUN WHERE IT CAN SEE SOMETHING. At Board Review the scopes' files do not
  // exist yet, so the per-scope measurement is over an empty set and its warning cannot fire — the
  // defect it answers is a post-build fact. The orchestrator therefore runs the oracle a second
  // time, after the round's build gate, and this pins both call sites: a check wired only where it
  // is blind is decoration, and a single grep for the verb would pass with either one missing.
  {
    const wf = readFileSync(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"), "utf8");
    const calls = [...wf.matchAll(/advisory\(`verify trace [^`]*`,\s*"([A-Za-z]+)"/g)].map((m) => m[1]);
    if (calls.includes("MapScopes") && calls.includes("Build")) {
      ok(`the run lints the trace twice — at Board Review, and again after the round's build gate where the scopes' code exists (${calls.join(", ")})`);
    } else fail(`verify trace is dispatched from ${JSON.stringify(calls)} — the post-build pass is where per-scope reachability can measure anything at all`);
  }

  // The second arm rests on the first. When reachability cannot root its walk there is no graph to
  // measure a scope against, and a per-scope claim derived from an empty set would be the same
  // false red this module exists to remove — one row per scope instead of one per engine.
  {
    const r = traceOver({
      entry: "src/EntryAbility.ets",
      files: {
        "src/EntryAbility.ets": "export class A { onWindowStageCreate(s){ s.loadContent('pages/Index'); } }\n",
        "src/pages/Index.ets": "export struct Index {}\n",
      },
      engines: [["UC-01", "src/pages/Index.ets"]],
      scopes: [["pages", ["src/pages/**"]]],
    }, ROOT);
    if (r.scope_reachability.checked === false && !codes(r).includes("SCOPE-UNREACHABLE")) {
      ok("with reachability unchecked the per-scope arm is skipped too, with its own reason — a scope is not orphaned by a walk that never ran");
    } else fail(`the per-scope arm ran over a graph the first arm refused to publish: ${JSON.stringify(r.scope_reachability)}`);
  }
}
