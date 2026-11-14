// attest — a worker reports, on the record, which skill it loaded.
//
// On a host that preloads a worker's skill into its definition, the host's own report of which agent ran
// is the evidence the shipped skill produced the artifact (the dispatch receipt). A host with no such
// preload cannot give that evidence, so the worker states it instead: this row is the worker's word and
// is labelled so (`attestation: "worker-reported"`), never mistaken for what the host measured. Nothing
// here changes what a gate reads; the label is for the person reading the ledger or the ship report.
//
//   harness.mjs attest skill <name> --order <path> [--cwd <dir>]
//
// Exit 0 recorded · 2 usage error or an order that cannot be read.
import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runArgs } from "./core/argv.mjs";
import { dispatchReceipts } from "./lib/paths.mjs";

export const ARGV_SPEC = {
  usage: "harness.mjs attest skill <name> --order <path> [--cwd <dir>]",
  _: { arity: 1, max: 1, name: "<skill name>" },
  order: { type: "str" },
  cwd: { type: "path" },
};

/**
 * The row a worker's own report writes. Pure.
 * @param {object} order - The parsed WorkOrder.
 * @param {string} skill - The skill the worker says it loaded.
 * @param {string} [now] - Timestamp, injectable for a test.
 * @returns {object} A dispatch-ledger row, shaped like the hook's with the provenance labelled.
 */
export function attestationRow(order, skill, now = new Date().toISOString()) {
  return {
    at: now,
    order_id: order.order_id ?? null,
    run_id: order.run_id ?? null,
    worker_declared: order.worker ?? null,
    skill_invoked: skill,
    dispatch_ok: null,
    tool: null,
    agent_id: null,
    agent_type: null,
    usage: null,
    model_requested: null,
    attested_by: "worker",
    attestation: "worker-reported",
  };
}

/** Record the attestation; exits with the documented code. */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = args.cwd || process.cwd();
  if (!args.order) { console.error(`usage: ${ARGV_SPEC.usage}`); process.exit(2); }
  let order;
  try { order = JSON.parse(readFileSync(resolve(cwd, args.order), "utf8")); }
  catch (e) { console.error(`attest: the order cannot be read (${e.message})`); process.exit(2); }
  if (!order?.order_id) { console.error("attest: the order carries no order_id"); process.exit(2); }
  const slug = String(order.order_id).split("/")[0];
  const path = dispatchReceipts(cwd, slug);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(attestationRow(order, args._[0])) + "\n");
  console.log(`recorded: ${order.order_id} — worker reports it loaded ${args._[0]}`);
  process.exit(0);
}
