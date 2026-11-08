#!/usr/bin/env node
// harness order — set and retire the pointers the fence reads.
//
//   harness.mjs order open  --slug <slug> --order <path>
//   harness.mjs order close --slug <slug> --status <shipped|escalated|aborted> [--cause <text>]
//
// WHY THIS IS A VERB AND NOT A FILE EDIT. The substrate fence defers (allows) every write while no
// active-order pointer exists, so a pointer the loop forgot to set turns the fence off without a
// single failing check. `open` names the live order and refuses an order that is not parseable JSON
// carrying a slug, so a malformed pointer cannot be written. `close` is the other half: it retires
// both pointers and records the ending — status, cause, timestamp — so a run that ended stops
// fencing the checkout, and the ending is a row instead of a recollection.
//
// Exit 0 done · 1 refused (the order is unreadable) · 2 malformed input. `open` also stamps the
// order's `compiled_at` with the current time.

import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { runArgs } from "./lib/argv.mjs";
import { activeOrder, activeScope, localRoot } from "./lib/paths.mjs";

/** The endings a run may record. */
export const CLOSE_STATUSES = ["shipped", "escalated", "aborted"];

/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs order open --slug <slug> --order <path> | order close --slug <slug> --status <shipped|escalated|aborted> [--cause <text>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  order: { type: "path" },
  status: { type: "enum", values: CLOSE_STATUSES },
  cause: { type: "str" },
  cwd: { type: "path" },
};

/**
 * Stamp the order with the real time, write the active-order pointer, then read it back.
 *
 * THE STAMP IS THE KERNEL'S, NOT THE LOOP'S. The fence decides an order is answered when its result
 * is at least as new as the order's `compiled_at`, so a time the loop typed by hand and got wrong —
 * a few minutes in the future — keeps the order live after its worker has returned and stalls every
 * write the run makes. A real run did exactly that; the clock is read here instead.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} orderPath - Path to the order the pointer names.
 * @returns {{ok: boolean, reason?: string}} Whether the pointer reads back as written.
 */
export function openOrder(cwd, slug, orderPath) {
  let order;
  try { order = JSON.parse(readFileSync(orderPath, "utf8")); }
  catch (e) { return { ok: false, reason: `order is not readable JSON: ${e.message}` }; }
  if (!order || typeof order !== "object") return { ok: false, reason: "order is not an object" };
  order.compiled_at = new Date().toISOString();
  writeFileSync(orderPath, `${JSON.stringify(order, null, 2)}\n`);
  const p = activeOrder(cwd);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify({ slug, order_path: orderPath }, null, 2)}\n`);
  const back = JSON.parse(readFileSync(p, "utf8"));
  return back.slug === slug && back.order_path === orderPath
    ? { ok: true }
    : { ok: false, reason: `pointer read back as ${JSON.stringify(back)}` };
}

/**
 * Retire both pointers and record the ending.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} status - One of {@link CLOSE_STATUSES}.
 * @param {string} [cause] - Why the run ended.
 * @returns {{status: string, cause: (string|null), at: string}} The recorded close.
 */
export function closeRun(cwd, slug, status, cause) {
  const close = { status, cause: cause || null, at: new Date().toISOString() };
  const dir = localRoot(cwd, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "close.json"), `${JSON.stringify(close, null, 2)}\n`);
  rmSync(activeOrder(cwd), { force: true });
  rmSync(activeScope(cwd), { force: true });
  return close;
}

/**
 * @param {string[]} rawArgv - `open` or `close`, then flags.
 * @returns {void} Exits with the documented code.
 */
export function cli(rawArgv) {
  const [action, ...rest] = rawArgv;
  const args = runArgs(ARGV_SPEC, rest);
  const cwd = args.cwd || process.cwd();
  if (action === "open") {
    if (!args.order) { console.error("order open: --order <path> is required"); process.exit(2); }
    const r = openOrder(cwd, args.slug, resolve(cwd, args.order));
    if (!r.ok) { console.error(`✋ order open: ${r.reason}`); process.exit(1); }
    console.log(JSON.stringify({ ok: true, slug: args.slug, order: args.order }));
    process.exit(0);
  }
  if (action === "close") {
    if (!args.status) { console.error("order close: --status is required"); process.exit(2); }
    console.log(JSON.stringify({ ok: true, ...closeRun(cwd, args.slug, args.status, args.cause) }));
    process.exit(0);
  }
  console.error("usage: harness.mjs order open|close …");
  process.exit(2);
}
