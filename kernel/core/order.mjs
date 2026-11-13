// order — arming and retiring the write fence, free of any workflow: stamp an order with the real time,
// write the pointer the fence reads, read it back; and retire both run pointers when a run ends.
//
// The order's own validation is the caller's (`validate`), so the same check the dispatch gate makes can
// run BEFORE the order is armed.
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Stamp the order with the real time, write the active-order pointer, then read it back.
 *
 * THE STAMP IS THE KERNEL'S, NOT THE LOOP'S. The fence decides an order is answered when its result
 * is at least as new as the order's `compiled_at`, so a time the loop typed by hand and got wrong —
 * a few minutes in the future — keeps the order live after its worker has returned and stalls every
 * write the run makes. A real run did exactly that; the clock is read here instead.
 *
 * @param {object} trace - The run trace (`runTrace(...)`).
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} orderPath - Path to the order the pointer names.
 * @param {{validate:function(object):{valid:boolean, errors:string[]}}} hooks - The order check.
 * @returns {{ok: boolean, reason?: string}} Whether the pointer reads back as written.
 */
export function openOrder(trace, cwd, slug, orderPath, { validate }) {
  let order;
  try { order = JSON.parse(readFileSync(orderPath, "utf8")); }
  catch (e) { return { ok: false, reason: `order is not readable JSON: ${e.message}` }; }
  if (!order || typeof order !== "object") return { ok: false, reason: "order is not an object" };
  // The same check the dispatch gate makes, made BEFORE the order is armed: an invalid order that was
  // opened first is live with no way to be edited (the fence freezes it) and no way to be withdrawn.
  const { valid, errors } = validate(order);
  if (!valid) return { ok: false, reason: `order fails the order schema, so it was not opened: ${errors.slice(0, 5).join("; ")}` };
  order.compiled_at = new Date().toISOString();
  writeFileSync(orderPath, `${JSON.stringify(order, null, 2)}\n`);
  const p = trace.activeOrder(cwd);
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
 * @param {object} trace - The run trace.
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} status - One of a close status.
 * @param {string} [cause] - Why the run ended.
 * @param {object} [extra] - Further fields of the record, e.g. the sign-off a `shipped` ending rests on.
 * @returns {{status: string, cause: (string|null), at: string}} The recorded close.
 */
export function closeRun(trace, cwd, slug, status, cause, extra = {}) {
  const close = { status, cause: cause || null, at: new Date().toISOString(), ...extra };
  const dir = trace.localRoot(cwd, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "close.json"), `${JSON.stringify(close, null, 2)}\n`);
  // The breadcrumb the decisions taken after this close (the census, the ship phase, the export) join through,
  // written before the pointers it replaces are retired.
  writeFileSync(trace.lastRun(cwd), `${JSON.stringify({ slug, run_id: trace.readRunId(cwd, slug), closed_at: close.at, closed_status: status }, null, 2)}\n`);
  rmSync(trace.activeOrder(cwd), { force: true });
  rmSync(trace.activeScope(cwd), { force: true });
  return close;
}

