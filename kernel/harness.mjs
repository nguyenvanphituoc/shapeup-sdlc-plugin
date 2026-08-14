#!/usr/bin/env node
// harness — the kernel's single entry point.
//
// WHAT THIS IS. Everything in the pipeline that must be DETERMINISTIC — measured rather than
// claimed, single-writer rather than negotiated, an answer file rather than a vibe — is a
// subcommand of this one script:
//
//     node ${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs <verb> [<action>] [flags]
//
// WHY ONE ENTRY POINT. A permission rule is matched against a command string. With one executable
// the entire grant is two lines a person can read (`bin/lib/grant.mjs`); with twenty it is forty
// rules that must be regenerated on every add, rename or removal — and a rule that silently
// matches nothing is indistinguishable from a rule that works until the first dispatch fails.
// Subcommands are free; entry points are not.
//
// WHO CALLS IT. Worker skills, from their own shells, and the hooks. The control plane — the
// Workflow script — calls no shell at all: it branches on the structured return of an `agent()`
// and never parses stdout.
//
// THE VERBS, and the invariant each one exists to keep:
//
//   verify   t0 · budget · envelope ·        Measured, not claimed. A model verifying itself is
//            trace · spec                     claiming; these read artifacts and re-hash them.
//   reduce   ingest · hill · snapshot ·       Single writer. Shared state has exactly one author.
//            ship · board · verdict
//   gate                                      An answer file with a source, not a vibe.
//   probe    resume · t0 · stats · digest     Read-only queries over run state.
//   init     run · fit                        Opens a run, or refuses it (exit 3).
//   report   export                           Projects the run's records as fact tables.
//   compile                                   The WorkOrder: schema-valid or nothing is dispatched.
//
// EXIT CODES are the subcommand's own and are part of its contract: 0 success · 1 ran, answer is
// no · 2 malformed input, nothing ran (`lib/argv.mjs`) · 3 `init run` refused to open · 4/5 gate
// stop/abort · 6 budget tripped. This dispatcher adds exactly one of its own: 2 for an unknown
// verb, which is the same "the input was malformed" case.

import { isMain } from "./lib/argv.mjs";

/**
 * verb → action → module, the whole routing table.
 *
 * A verb whose value is a string takes no action word (`gate`, `compile`); a verb whose value is an
 * object requires one, and `_default` names the action taken when it is omitted.
 *
 * Exported so the structural suite enumerates the subcommands from THIS table rather than from a
 * hand-kept list beside it — a second copy of the routing is a second thing to forget.
 */
export const ROUTES = {
  verify: {
    t0: "./verify/t0.mjs", budget: "./verify/budget.mjs", envelope: "./verify/envelope.mjs",
    trace: "./verify/trace.mjs", spec: "./verify/spec.mjs",
  },
  reduce: {
    ingest: "./reduce/ingest.mjs", hill: "./reduce/hill.mjs", snapshot: "./reduce/snapshot.mjs",
    ship: "./reduce/ship.mjs", board: "./reduce/board.mjs", verdict: "./reduce/verdict.mjs",
  },
  probe: { resume: "./probe/resume.mjs", t0: "./probe/t0.mjs", stats: "./probe/stats.mjs", digest: "./probe/digest.mjs" },
  init: { run: "./init/run.mjs", fit: "./init/fit.mjs" },
  report: { export: "./report/export.mjs", _default: "export" },
  gate: "./gate.mjs",
  compile: "./compile.mjs",
};

/** Every `<verb> <action>` pair, for the usage text and the unknown-verb rejection. */
function usage() {
  const lines = [];
  for (const [verb, target] of Object.entries(ROUTES)) {
    if (typeof target === "string") lines.push(`  ${verb}`);
    else lines.push(`  ${verb} ${Object.keys(target).filter((a) => a !== "_default").join(" | ")}`);
  }
  return `usage: harness.mjs <verb> [<action>] [flags]\n${lines.join("\n")}\n\nEvery subcommand accepts --help through its own argv spec.`;
}

/**
 * Reject an invocation before anything runs, the same way `lib/argv.mjs` rejects a bad flag.
 * @param {object} detail - Machine-readable rejection record.
 * @returns {never} Exits 2.
 */
function reject(detail) {
  process.stderr.write(JSON.stringify(detail) + "\n");
  process.stderr.write(usage() + "\n");
  process.exit(2);
}

/**
 * Resolve `<verb> [<action>]` to a module path and the argv the subcommand should see.
 *
 * @param {string[]} argv - `process.argv.slice(2)`.
 * @returns {{module: string, rest: string[]}} The module to import and its own arguments.
 */
export function route(argv) {
  const [verb, ...rest] = argv;
  if (!verb || verb === "--help" || verb === "-h") { process.stdout.write(usage() + "\n"); process.exit(0); }
  const target = ROUTES[verb];
  if (!target) reject({ error: "unknown_verb", verb, expected: Object.keys(ROUTES).join(" | ") });
  if (typeof target === "string") return { module: target, rest };

  const action = rest[0] && !rest[0].startsWith("-") ? rest[0] : target._default;
  const module = action ? target[action] : null;
  if (!module) {
    reject({
      error: action ? "unknown_action" : "missing_action", verb, action: action ?? null,
      expected: Object.keys(target).filter((a) => a !== "_default").join(" | "),
    });
  }
  return { module, rest: rest[0] === action ? rest.slice(1) : rest };
}

if (isMain(import.meta.url)) {
  const { module, rest } = route(process.argv.slice(2));
  const mod = await import(module);
  await mod.cli(rest);
}
