// A leg wrote its artifacts and never its envelope. The phase post-condition stood on the artifact
// (correctly), the run went on, and it closed `shipped` over an order still open by construction —
// the export's own dispatch row said `answered: false` and nothing upstream had noticed. Measured
// on a live consumer run. This module pins the probe that lists such orders and the close that
// names them.
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const WORKFLOW = join(ROOT, "skills/tech-lead/workflows/shapeup-run.js");

  section("139. A dispatched order that never answered is listed by the probe and named at the close");

  const ws = mkdtempSync(join(tmpdir(), "unanswered-"));
  try {
    spawnSync("git", ["init", "-q", "-b", "main"], { cwd: ws });
    const kernel = (...args) => spawnSync("node", [KERNEL, ...args, "--cwd", ws], { cwd: ws, encoding: "utf8" });
    const opened = kernel("init", "run", "--slug", "f", "--intake-text", "Add a cart badge");
    const compiled = kernel("compile", "--slug", "f", "--operation", "orient");
    if (opened.status !== 0 || compiled.status !== 0) { fail(`fixture: init=${opened.status} compile=${compiled.status}`); return; }
    const { dispatchReceipts } = await import(join(ROOT, "kernel/lib/paths.mjs"));
    const orderId = JSON.parse(readFileSync(join(ws, ".shapeup/f/orders/orient.json"), "utf8")).order_id;
    const runId = JSON.parse(readFileSync(join(ws, ".shapeup/f/receipt.json"), "utf8")).run_id;

    // No receipt, no result: an order nothing ever ran against — not "unanswered", just unattested.
    const before = JSON.parse(kernel("probe", "leg", "--slug", "f", "--open").stdout);
    if (before.unanswered_total === 0 && before.closed === true) ok("an order with neither receipt nor result is not reported as unanswered (nothing ran)");
    else fail(`an un-dispatched order was reported as unanswered: ${JSON.stringify(before)}`);

    // A receipt lands — the hook layer saw a Skill run against the order — and no result ever does.
    mkdirSync(dirname(dispatchReceipts(ws, "f")), { recursive: true });
    writeFileSync(dispatchReceipts(ws, "f"), JSON.stringify({ at: new Date().toISOString(), order_id: orderId, run_id: runId, skill_invoked: "orient", dispatch_ok: true }) + "\n");
    const r = kernel("probe", "leg", "--slug", "f", "--open");
    const after = JSON.parse(r.stdout);
    if (r.status === 1 && after.unanswered_total === 1 && after.unanswered_ids[0] === orderId && after.closed === false) ok("`probe leg --open` lists a dispatched order with no result as unanswered, and exits 1");
    else fail(`the unanswered order was not listed: exit ${r.status} ${JSON.stringify(after)}`);
    const one = JSON.parse(kernel("probe", "leg", "--slug", "f", "--order", "orient").stdout);
    if (one.has_receipt === true && one.has_result === false && one.applied === false) ok("`probe leg --order orient` reports the receipt present and the result absent");
    else fail(`--order orient reported ${JSON.stringify(one)}`);

    // A receipt from ANOTHER run over the same slug must not count — order ids repeat, run keys do not.
    writeFileSync(dispatchReceipts(ws, "f"), JSON.stringify({ at: new Date().toISOString(), order_id: orderId, run_id: "some-other-run", skill_invoked: "orient", dispatch_ok: true }) + "\n");
    const other = JSON.parse(kernel("probe", "leg", "--slug", "f", "--open").stdout);
    if (other.unanswered_total === 0) ok("a receipt keyed to a different run does not make this run's order unanswered");
    else fail(`a prior run's receipt was read as this run's dispatch: ${JSON.stringify(other)}`);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }

  const src = readFileSync(WORKFLOW, "utf8");
  if (/const unansweredOrders = \[\];/.test(src) && /unansweredOrders\.push\(leg\.order\)/.test(src)) ok("requireLeg records a dispatched-but-unanswered order instead of returning silently");
  else fail("requireLeg still returns silently when the result is absent — the order is never named");
  if (/unanswered_orders=\$\{unansweredOrders\.length\}/.test(src) && /causeArg\(cause \+ unanswered\)/.test(src)) ok("every close cause carries unanswered_orders=N when any order never answered — shipped included");
  else fail("the close cause does not name unanswered orders");
}
