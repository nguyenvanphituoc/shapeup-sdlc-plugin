// A PHASE THAT WROTE ITS ARTIFACTS AND NO WORKRESULT IS SENT BACK ONCE.
//
// The orient leg did its craft and skipped its last step — no WorkResult, no leg row — on three runs of
// one consumer, across releases. The phase stood on its artifacts and the close named the order
// unanswered, which is honest and still leaves the run's own record of the phase empty. The run now
// dispatches the worker again, once, telling it its artifacts stand; only a second miss is named at the
// close. Executed against the shipped `requireLeg`, read off disk.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Pull one top-level `async function` out of the shipped workflow, by its name.
 * @param {string} src - The workflow's source.
 * @param {string} name - The function name.
 * @returns {string} Its source, from the declaration to the closing brace at column 0.
 */
function fnSource(src, name) {
  const start = src.indexOf(`async function ${name}(`);
  if (start < 0) throw new Error(`no async function ${name} in the workflow`);
  const end = src.indexOf("\n}\n", start);
  return src.slice(start, end + 2);
}

/**
 * Run the send-back checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  section("173. A phase whose leg returned no WorkResult is dispatched again once, then named");
  const src = readFileSync(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"), "utf8");
  const body = fnSource(src, "requireLeg");

  /** Evaluate the shipped requireLeg over a scripted sequence of leg-ledger answers. */
  const harness = (answers) => {
    const asked = [];
    const logs = [];
    const unansweredOrders = [];
    let i = 0;
    const query = async () => { asked.push(i); return answers[Math.min(i++, answers.length - 1)]; };
    const make = new Function("query", "log", "advisory", "aborted", "unansweredOrders", "slug", "ORDERLEG",
      `${body}\nreturn requireLeg;`);
    const requireLeg = make(query, (m) => logs.push(m), async () => ({}), (g, why) => ({ status: "aborted", why }), unansweredOrders, "demo", {});
    return { requireLeg, logs, unansweredOrders, asked };
  };
  const missing = { closed: false, found: true, order: "demo/orient", has_receipt: true, has_result: false, applied: false };
  const applied = { closed: true, found: true, order: "demo/orient", has_receipt: true, has_result: true, applied: true };

  // (a) no result, then the send-back lands one: proceeds, names nothing.
  {
    const h = harness([missing, applied]);
    const notes = [];
    const out = await h.requireLeg("ORIENT", "orient", "Orient", "orient", async (note) => { notes.push(note); return {}; });
    if (out === null && notes.length === 1 && /NO WorkResult/.test(notes[0]) && /do not redo them/.test(notes[0]) && h.unansweredOrders.length === 0) {
      ok("a leg with a receipt and no WorkResult is dispatched again once, told its artifacts stand, and the phase closes clean");
    } else fail(`send-back that lands: out=${JSON.stringify(out)} notes=${notes.length} unanswered=${JSON.stringify(h.unansweredOrders)}`);
  }
  // (b) still no result after the send-back: named at the close, never a second send-back.
  {
    const h = harness([missing, missing]);
    let n = 0;
    const out = await h.requireLeg("ORIENT", "orient", "Orient", "orient", async () => { n++; return {}; });
    if (out === null && n === 1 && h.unansweredOrders.includes("demo/orient")) ok("a second miss is not sent back again — it is named unanswered at the close");
    else fail(`second miss: out=${JSON.stringify(out)} dispatches=${n} unanswered=${JSON.stringify(h.unansweredOrders)}`);
  }
  // (c) no dispatch closure (a phase that has none): today's behavior, named at the close.
  {
    const h = harness([missing]);
    const out = await h.requireLeg("ANALYZE", "analyze", "Analyze");
    if (out === null && h.unansweredOrders.includes("demo/orient") && h.asked.length === 1) ok("a phase with no dispatch to repeat keeps naming the order at the close");
    else fail(`no closure: ${JSON.stringify(h.unansweredOrders)}`);
  }
  // (d) no receipt: the leg never ran the skill, so there is nothing to send back — named, not re-dispatched.
  {
    const h = harness([{ ...missing, has_receipt: false }]);
    let n = 0;
    await h.requireLeg("ORIENT", "orient", "Orient", "orient", async () => { n++; return {}; });
    if (n === 0 && h.unansweredOrders.includes("demo/orient")) ok("an order with no receipt is not sent back — the worker never ran, and that is a different failure");
    else fail(`no receipt: dispatches=${n}`);
  }
  // (e) the phases that recur carry their dispatch into the post-condition.
  if (/requirePhase\("ORIENT", "orient", "Orient", "orient", dispatchOrient\)/.test(src) && /requirePhase\("WIRE", "wire", "Wire", "wire", dispatchWire\)/.test(src)) {
    ok("ORIENT and WIRE hand their dispatch to the post-condition, so the send-back re-runs the same order");
  } else fail("ORIENT or WIRE no longer passes its dispatch to requirePhase");
}
