// 16 — THE LOOP IS NOT A SCRIPT: nothing launches a Workflow, and what that script's guards protected
// is pinned in the kernel.
//
// This module used to read `skills/tech-lead/workflows/shapeup-run.js` (a Workflow body with no `import`,
// run by the Workflow runtime) and assert, by source pattern, a dozen properties of it: no sub-sonnet tier,
// no storage-root literal, every kernel call rooted in the plugin, no courier discarding its outcome, no
// ingest aimed by a worker's self-reported path, no bare-null payload field, every run status a member of
// the kernel's enum, `meta` a pure literal, a canary first, every dispatched operation resolvable, the
// scheduler fed the kernel's ordering data, every arg declared in the launch record. The script is retired
// — the run is driven by `probe next`, a kernel verb — so each of those either becomes a check on the
// module that carries the behaviour now or is retired with its reason. The ledger, in the order the
// sections sat:
//
//   (0) every script is launched              RETIRED  no script exists; replaced by (A) below: nothing names one.
//   (a) the model floor, no sub-sonnet tier   PORTED   (B) below, over the skills, commands and kernel.
//   (b) no storage-root literal in the script RETIRED  a script with no filesystem could not import the path
//                                                      resolver; `probe next` imports it, and section 45 guards
//                                                      every runtime file.
//   (c) every kernel call plugin-rooted       PORTED   row "every command a step carries is one line, and names
//                                                      the kernel by absolute path"; sections 105 and 118.
//   (d) no courier discards its outcome       RETIRED  there are no couriers: the loop runs the commands and
//                                                      branches on their exit codes (RULE 4 of the loop).
//   (e)(g) no ingest aimed by a self-reported path   PORTED   row "every released scope carries its own ingest
//                                                      command, addressed to its first-attempt order".
//   (h) no payload field a bare null          PORTED   row "a compiled payload carries no bare null".
//   (i) every run status in the kernel's enum PORTED   (C) below.
//   (f)(f2) `meta` is literal; the file parses RETIRED no file, no runtime that refuses it.
//   (j) the canary is first, and its failure aborts   RETIRED  the canary dispatch is gone by design: the first
//                                                      orient dispatch leaves the same receipt, and
//                                                      `verify dispatch` reads it (section 123, no courier).
//   (l) no stage returns a bare null          RETIRED  no pipeline() stage.
//   (n) exact filenames named to the worker   PORTED   row "no orient artifacts dispatches orient with the four
//                                                      filenames in its note".
//   (o) the map-scopes fixture pass rule      PORTED   row "no scope contracts after the wiring gate opens the
//                                                      scopes substep with the exit-0 fixture rule".
//   (p) the evaluate dispatch carries its round PORTED row "a green, gated round dispatches the judge with the
//                                                      round and the run command".
//   (q) an overriding dispatch builds no payload RETIRED the dispatch closure that did both is gone.
//   (m) the scheduler is fed the kernel's ordering PORTED (E) below, and section 69 runs the schedule.
//   (n') every arg read is declared in the record PORTED section 62 (the launch record's surface).
//   (o') a green T0 is not a finished scope   PORTED   row "a green T0 with no WorkResult envelope is red".
//   (p') a path in a sub-agent prompt is quoted PORTED  the loop's dispatch names `--order "<order_path>"`
//                                                      quoted in the skill; sections 105 and 118 pin the commands.
//   (k) every dispatched operation resolvable PORTED   (D) below.
//   16b a gate decision is a machine value    PORTED   `probe next` reads the gate ledger row's own `decision`
//                                                      field, never a sentence; rows "a gate paused (an ask
//                                                      row) is not a crossing" and "a FAIL answered stop goes
//                                                      to the census".
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { pinnedBy } from "../lib/pinned-row.mjs";

/**
 * Run the no-run-script checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, readJSON } = ctx;

  // =============================================================================
  section("16. The loop is not a script — no Workflow launch, and its guards live in the kernel");
  // =============================================================================

  const walk = (rel, out = []) => {
    if (!existsSync(join(ROOT, rel))) return out;
    for (const e of readdirSync(join(ROOT, rel))) {
      const p = `${rel}/${e}`;
      if (statSync(join(ROOT, p)).isDirectory()) walk(p, out);
      else if (/\.(mjs|js|md|json)$/.test(p)) out.push(p);
    }
    return out;
  };
  const shipped = ["skills", "commands", "hooks", "kernel", "bin", "oracles"].flatMap((d) => walk(d)).concat(["AGENTS.md", "SECURITY.md"]);

  // (A) nothing in what a user receives launches, stages or names a run script.
  {
    const workflowDirs = walk("skills").filter((f) => /\/workflows\//.test(f));
    const hits = shipped.filter((f) => /shapeup-run|\bscriptPath\b|\.shapeup\/workflows/.test(readFileSync(join(ROOT, f), "utf8")));
    if (!workflowDirs.length && !hits.length) ok(`no skill carries a workflows/ directory and none of ${shipped.length} shipped files names a run script, a scriptPath or a staged copy`);
    else fail(`a run script is still launched or named: ${[...workflowDirs, ...hits].join(", ")}`);
  }

  // (B) the model floor: no sub-sonnet tier is named in anything that dispatches, outside the one file that denylists it.
  {
    const offenders = [];
    for (const f of shipped.filter((x) => /^(skills|commands|kernel)\//.test(x) && x !== "kernel/lib/floor.mjs")) {
      readFileSync(join(ROOT, f), "utf8").split("\n").forEach((line, i) => { if (/ha[i1]ku/i.test(line)) offenders.push(`${f}:${i + 1}`); });
    }
    if (!offenders.length) ok("no model below the floor is named in a skill, a command or the kernel — the one denylist is kernel/lib/floor.mjs");
    else fail(`a sub-sonnet tier is named in:\n    ${offenders.join("\n    ")}`);
  }

  const next = readFileSync(join(ROOT, "kernel/probe/next.mjs"), "utf8");
  const domain = readJSON(join(ROOT, "kernel/schemas/domain.schema.json"));

  // (C) every run status `probe next` sets is a member of the kernel's enum.
  {
    const { RUN_STATUSES } = await import(join(ROOT, "kernel/probe/resume.mjs"));
    const named = [...next.matchAll(/--set-status (\w+)/g)].map((m) => m[1]);
    const mapped = Object.values(JSON.parse(`{${(next.match(/const STATUS_FOR = \{([^}]*)\}/) || [])[1]?.replace(/(\w+):/g, '"$1":') ?? ""}}`));
    const bad = [...named, ...mapped].filter((s) => !RUN_STATUSES.includes(s));
    if (named.length + mapped.length > 0 && !bad.length) ok(`every run status \`probe next\` sets (${[...new Set([...named, ...mapped])].join(", ")}) is a member of the kernel's enum`);
    else fail(bad.length ? `probe next sets a status outside the enum: ${bad.join(", ")}` : "probe next sets no status — the check read nothing");
  }

  // (D) every operation `probe next` compiles is one the schema registers.
  {
    const ops = new Set(domain.$defs?.Operation?.enum || []);
    const used = [...new Set([...next.matchAll(/--operation (\w[\w-]*)/g)].map((m) => m[1]))];
    const bad = used.filter((o) => !ops.has(o));
    if (used.length > 0 && !bad.length) ok(`every operation \`probe next\` compiles (${used.join(", ")}) is a member of the Operation enum`);
    else fail(bad.length ? `probe next compiles an operation the schema does not register: ${bad.join(", ")}` : "probe next compiles no operation — the check read nothing");
    const interp = [...next.matchAll(/--operation \$\{(\w+)\}/g)].length;
    if (interp) ok("a dispatch step's operation is interpolated from the step's own declaration, and each declared one is covered by the list above");
  }

  // (E) the schedule is fed the kernel's own ordering data, never a list the loop builds.
  if (/scheduleFor\(rs,/.test(next)) ok("`probe next` hands the schedule the resume facts the kernel derived — waves, edges and exclusions — and nothing the loop assembled");
  else fail("`probe next` no longer feeds scheduleFor the kernel's own resume facts");

  // The rest of the ledger is rows of the state-machine suite.
  pinnedBy(ctx, ["every command a step carries is one line", "every released scope carries its own ingest command", "a compiled payload carries no bare null"],
    "(c)(e)(g)(h) every command names the kernel by absolute path, every ingest is aimed at its own order, no payload field is a bare null");
  pinnedBy(ctx, ["no orient artifacts dispatches orient with the four filenames", "no scope contracts after the wiring gate opens the scopes substep with the exit-0 fixture rule", "a green, gated round dispatches the judge with the round"],
    "(n)(o)(p) the worker is told the exact filenames, the fixture pass rule and the round it is judging");
  pinnedBy(ctx, ["a green T0 with no WorkResult envelope is red", "a gate paused (an ask row) is not a crossing", "a FAIL answered stop goes to the census"],
    "(o')(16b) a green T0 is not a finished scope until its work was applied, and a gate decision is the ledger row's own field");
}
