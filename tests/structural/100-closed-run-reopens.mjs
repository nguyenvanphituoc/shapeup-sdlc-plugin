// A CLOSED RUN THAT IS RESUMED IS REOPENED — ON THE RECORD — SO ITS NEXT CLOSE IS ITS OWN.
//
// A relaunch resumes the same run by design, and a run closed `aborted` can be resumed and carried
// on to a ship. Two correct rules then met and produced a wrong record: the close is written once
// and refuses to flip an outcome, and `init run` called any run with a receipt "ALREADY OPEN". The
// resumed run shipped, its close was refused, and the ledger read `status: shipped` over
// `closed_status: aborted` with the abort's own cause — every reader of the close reported an abort
// for a run that shipped.
//
// The move to a live status is the one act that takes a close back, so it is recorded there: the
// prior close joins `prior_closes`, the close fields return to `~`, the breadcrumb that names the
// run as over is retired, and the next terminal close is written as the run's own. A terminal
// status still cannot flip a close, and `init run` names a closed run as closed. Asserted against
// the real kernel.
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/** Open a real run exactly as the orchestrator does. */
function openRun(ROOT, ws, slug, intake) {
  const r = spawnSync(process.execPath, [
    join(ROOT, "kernel/harness.mjs"), "init", "run",
    "--slug", slug, "--intake-text", intake, "--auto-level", "unattended", "--cwd", ws,
  ], { cwd: ws, encoding: "utf8", timeout: 30_000 });
  if (r.status !== 0) throw new Error(`init run failed: ${r.stderr || r.stdout}`);
}

/**
 * Run the reopen checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { closeRun, setRunStatus, parseFrontmatter } = await import(join(ROOT, "kernel/probe/resume.mjs"));
  const { readRunId } = await import(join(ROOT, "kernel/lib/paths.mjs"));

  section("153. A closed run that is resumed is reopened on the record, and its next close is its own");

  const roots = [];
  const ws = () => { const d = mkdtempSync(join(tmpdir(), "reopen-")); roots.push(d); return d; };
  const ledger = (w) => parseFrontmatter(readFileSync(join(w, ".shapeup/checkout/harness-run.md"), "utf8"));
  const crumb = (w) => join(w, ".shapeup/last-run");
  const initAgain = (w) => spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "init", "run",
    "--slug", "checkout", "--intake-text", "Add checkout flow", "--auto-level", "unattended", "--cwd", w],
    { cwd: w, encoding: "utf8", timeout: 30_000 });
  const ABORT = 'L3: verdict:r1: sha256 undefined — "handed" hash refused';

  try {
    // --- (a) a live run that was never closed: moving it is only a status write ------------------
    const a = ws(); openRun(ROOT, a, "checkout", "Add checkout flow");
    const live = setRunStatus(a, "checkout", "building");
    if (live.ok && !("reopened" in live) && !("decision" in live) && !("prior_closes" in ledger(a))) {
      ok("a run that was never closed moves between live statuses with no reopen recorded");
    } else fail(`a live status write on an open run reported ${JSON.stringify(live)}`);
    const openMsg = initAgain(a);
    if (openMsg.status === 3 && /ALREADY OPEN/.test(openMsg.stderr + openMsg.stdout) && !/CLOSED as/.test(openMsg.stderr + openMsg.stdout)) {
      ok("init run over an open run still says ALREADY OPEN");
    } else fail(`init run over an open run said: ${(openMsg.stderr + openMsg.stdout).slice(0, 200)} (exit ${openMsg.status})`);

    // --- (b) close aborted, then resume: the move to a live status reopens it --------------------
    const b = ws(); openRun(ROOT, b, "checkout", "Add checkout flow");
    const c1 = closeRun(b, "checkout", { status: "aborted", cause: ABORT, withExport: false });
    if (!c1.ok) fail(`fixture: closing aborted failed: ${JSON.stringify(c1)}`);
    const closedAt = ledger(b).closed_at;
    const said = initAgain(b);
    const text = said.stderr + said.stdout;
    if (said.status === 3 && /CLOSED as "aborted"/.test(text) && /REOPENS/.test(text) && !/ALREADY OPEN/.test(text)) {
      ok("init run over a closed run names it CLOSED, with its status, and says resuming reopens it");
    } else fail(`init run over a closed run said: ${text.slice(0, 240)} (exit ${said.status})`);
    if (existsSync(crumb(b))) ok("fixture: the close left its breadcrumb");
    else fail("fixture: closing left no last-run breadcrumb to retire");

    const re = setRunStatus(b, "checkout", "evaluating");
    const fm = ledger(b);
    if (re.ok && re.decision === "reopened" && re.reopened?.closed_status === "aborted" && re.reopened.closed_at === closedAt) {
      ok("moving a closed run to a live status reports decision=reopened, naming the close it took back");
    } else fail(`the resume did not report a reopen: ${JSON.stringify(re)}`);
    // `~` is the dialect's null: read back it is null, and on disk it is the literal the ledger was
    // opened with — both are checked, so neither a parser change nor a stray value passes silently.
    const raw = readFileSync(join(b, ".shapeup/checkout/harness-run.md"), "utf8");
    const tilde = ["closed_status", "closed_at", "close_cause"].every((k) => new RegExp(`^${k}: ~$`, "m").test(raw));
    if (fm.status === "evaluating" && fm.closed_status == null && fm.closed_at == null && fm.close_cause == null && tilde) {
      ok("the reopened ledger's close fields are back to ~ — the run is no longer recorded as closed");
    } else fail(`after the reopen the ledger reads status=${fm.status} closed_status=${fm.closed_status} closed_at=${fm.closed_at} close_cause=${fm.close_cause}`);
    if (typeof fm.prior_closes === "string" && fm.prior_closes.includes(`aborted at ${closedAt}`) && fm.prior_closes.includes(ABORT)) {
      ok("the abort is kept, verbatim, under prior_closes — nothing about the earlier close is lost");
    } else fail(`prior_closes does not carry the abort and its cause: ${JSON.stringify(fm.prior_closes)}`);
    if (!existsSync(crumb(b))) ok("the breadcrumb naming this run as over is retired on reopen");
    else fail("the reopened run is still named as over by its last-run breadcrumb");

    // --- (c) the next terminal close is written as the run's own -------------------------------
    const ship = closeRun(b, "checkout", { status: "shipped", cause: "verdict=fail rounds=1 after=gate_h", withExport: false });
    const after = ledger(b);
    if (ship.ok && after.closed_status === "shipped" && after.status === "shipped" && /verdict=fail/.test(after.close_cause)) {
      ok("after the reopen, the ship closes the run as shipped — status and closed_status agree");
    } else fail(`the ship after a reopen was not recorded: ${JSON.stringify(ship)} ledger=${after.status}/${after.closed_status}`);
    if (after.prior_closes?.includes(ABORT)) ok("the shipped close keeps the abort beside it in prior_closes");
    else fail("the shipped close dropped the earlier abort from the record");

    // --- (d) a TERMINAL status on a closed run still cannot flip it -----------------------------
    const d = ws(); openRun(ROOT, d, "checkout", "Add checkout flow");
    closeRun(d, "checkout", { status: "aborted", cause: ABORT, withExport: false });
    const stamp = setRunStatus(d, "checkout", "shipped");
    const refused = closeRun(d, "checkout", { status: "shipped", cause: "x", withExport: false });
    if (stamp.ok && !("reopened" in stamp) && ledger(d).closed_status === "aborted" && refused.ok === false && refused.closed_status === "aborted") {
      ok("stamping a terminal status is not a reopen — an unresumed abort still cannot be closed shipped");
    } else fail(`a terminal status write reopened or flipped a close: ${JSON.stringify({ stamp, refused, ledger: ledger(d).closed_status })}`);

    // --- (e) a second reopen appends; a breadcrumb for another run is left alone ------------------
    const e = ws(); openRun(ROOT, e, "checkout", "Add checkout flow");
    closeRun(e, "checkout", { status: "aborted", cause: "first", withExport: false });
    setRunStatus(e, "checkout", "building");
    closeRun(e, "checkout", { status: "escalated", cause: "second", withExport: false });
    mkdirSync(join(e, ".shapeup"), { recursive: true });
    writeFileSync(crumb(e), JSON.stringify({ slug: "other", run_id: "other-20260101T000000Z-deadbeef", closed_status: "aborted" }));
    setRunStatus(e, "checkout", "evaluating");
    const pc = ledger(e).prior_closes || "";
    if (/^aborted at .*: first \| escalated at .*: second$/.test(pc)) ok("a second reopen appends to prior_closes in order, separated by ' | '");
    else fail(`prior_closes after two reopens reads ${JSON.stringify(pc)}`);
    if (existsSync(crumb(e)) && readRunId(e, "checkout") !== "other-20260101T000000Z-deadbeef") {
      ok("a breadcrumb naming a different run is not retired by this run's reopen");
    } else fail("this run's reopen removed another run's breadcrumb");
  } finally {
    for (const r of roots) rmSync(r, { recursive: true, force: true });
  }
}
