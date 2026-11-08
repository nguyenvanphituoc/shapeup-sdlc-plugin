#!/usr/bin/env node
// harness — the kernel's single entry point.
//
// WHAT THIS IS. Everything in the pipeline that must be DETERMINISTIC — measured rather than
// claimed, an answer file rather than a vibe — is a subcommand of this one script:
//
//     node ${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs <verb> [<action>] [flags]
//
// WHY ONE ENTRY POINT. A permission rule is matched against a command string. With one executable
// the entire grant is two lines a person can read (`bin/lib/grant.mjs`); with twenty it is forty
// rules that must be regenerated on every add, rename or removal — and a rule that silently
// matches nothing is indistinguishable from a rule that works until the first dispatch fails.
// Subcommands are free; entry points are not.
//
// WHO CALLS IT. The loop that drives a run (the `building` skill, in the session), worker skills
// from their own shells, and the hooks.
//
// THE VERBS, and the invariant each one exists to keep:
//
//   verify   t0 · envelope · skills    Measured, not claimed. A model verifying itself is claiming;
//                                      these read artifacts and re-hash them. `t0` runs a scope's
//                                      fixtures and keeps or reverts the tree; `envelope` checks an
//                                      order or a result against its schema (and is the dispatch
//                                      gate when called as a hook); `skills` reads the worker roster
//                                      off disk.
//   gate                               An answer file with a source, not a vibe.
//   init     run                       Opens a run, or refuses it (exit 3). Writes the receipt and
//                                      the launch record, and refuses a model below the floor.
//   order    open · close              Arms and retires the write fence's pointer, and records how a
//                                      run ended.
//
// EXIT CODES are the subcommand's own and are part of its contract: 0 success · 1 ran, answer is
// no · 2 malformed input, nothing ran (`lib/argv.mjs`) · 3 `init run` refused to open · 4/5 gate
// stop/abort. This dispatcher adds exactly one of its own: 2 for an unknown verb, which is the same
// "the input was malformed" case.

import { isMain } from "./lib/argv.mjs";

/**
 * verb → action → module, the whole routing table.
 *
 * A verb whose value is a string takes no action word (`gate`, `order`); a verb whose value is an
 * object requires one, and `_default` names the action taken when it is omitted.
 *
 * Exported so the structural suite enumerates the subcommands from THIS table rather than from a
 * hand-kept list beside it — a second copy of the routing is a second thing to forget.
 */
export const ROUTES = {
  verify: {
    t0: "./verify/t0.mjs", envelope: "./verify/envelope.mjs", skills: "./verify/skills.mjs",
  },
  gate: "./gate.mjs",
  init: { run: "./init/run.mjs" },
  order: "./order.mjs",
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
