// Structural test module: what the orchestrator must NOT keep only in memory.
// Section: 92.
//
// THE DEFECT CLASS. `shapeup-run.js` cannot be imported — it is a Workflow script, a function body
// over injected globals — so the suite reaches it by reading its source, the same way
// `18-resume-state.mjs` does. That limitation is itself the reason this module is needed: in-memory
// orchestration state is reachable by NO assertion in the suite except a source-level one, and two
// live defects lived exactly there.
//
// Both are the same shape, and this file has now paid for that shape three times — its own comments
// record `findings` in the temporal dead zone and `payload.bugs` "lived in a variable, which a
// relaunch between two rounds resets to empty". A gate PAUSE is a `return`: the PO's answer starts a
// FRESH LAUNCH, and every accumulator begins empty while the round loop fast-forwards past the
// rounds that filled it. So the rule these checks encode is not "declare it outside the loop" — that
// was the previous fix and it is insufficient. The rule is RE-DERIVE IT FROM DISK AT EVERY LAUNCH.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function run(ctx) {
  const { ok, fail, section, ROOT } = ctx;
  section("92. Orchestration state a relaunch must not lose");

  const src = readFileSync(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"), "utf8");

  // --- (a) GATE H's CENSUS IS RE-DERIVED, NOT ONLY ACCUMULATED ----------------------------------
  // `allHammer` is what `scope-hammer` is dispatched with, and AGENTS.md makes an attempt-budget
  // exhaustion a queued GATE H proposal. Accumulated only in memory, the PO's cut list came back
  // EMPTY after they answered a paused gate — in the `interactive` lane, the first census they ever
  // see. Unattended runs never pause, which is why no archived trace shows it.
  // THE REGEX MUST NAME THE DERIVATION, NOT THE LOOP THAT CONSUMES IT.
  //
  // The first version tested for the presence of the `for (const sid of (g?.scopes || []))` loop and
  // for the identifier `greenEver` — and both survive gutting the derivation to `new Set()`, which
  // is precisely the defect. It matched a source file in which the census was once again empty. So
  // this pins the SOURCE the set is built from: the graph's own green_scopes_by_round, flattened.
  const derives = /new Set\(\s*Object\.values\(\s*g\?\.green_scopes_by_round[\s\S]{0,40}?\)\.flat\(\)\s*\)/.test(src)
    && /for \(const sid of \(g\?\.scopes \|\| \[\]\)\)/.test(src);
  if (derives) ok("the GATE H census is rebuilt from the run graph's own green_scopes_by_round at each launch, not carried only in a variable");
  else fail("allGreen/allHammer are not re-derived from the graph — a relaunch after a paused gate hands the PO an empty cut list");

  // A census that is only ever appended to double-counts across launches, and a scope that goes
  // green later must LEAVE the cut list rather than sit on both.
  if (/const i = allHammer\.indexOf\(sid\); if \(i !== -1\) allHammer\.splice\(i, 1\)/.test(src)) {
    ok("a scope that turns green is removed from the cut list — the two lists cannot both claim it");
  } else {
    fail("nothing removes a now-green scope from allHammer — a scope fixed in a later round is still proposed for cutting");
  }
  if (/if \(!allGreen\.includes\(sid\)\) allGreen\.push\(sid\)/.test(src)) {
    ok("the census de-duplicates — re-deriving at every launch cannot inflate the counts");
  } else {
    fail("the census pushes without a membership test, so each relaunch re-adds every scope it re-derives");
  }

  // --- (b) A RESUMED SCOPE IS STILL ASKED WHETHER ITS WORK REACHED THE BOARD ---------------------
  // A green T0 says the fixtures passed; it says nothing about whether the WorkResult was APPLIED.
  // A relaunch happens because the previous launch died, and a leg that died between writing its
  // result and running `reduce ingest` leaves precisely this state — so the one scope class known to
  // be at risk was the one class the short-circuit excused from the check built for it, and the
  // late-ingest repair below it could never fire.
  const short = src.match(/if \(res\.resumed \|\| !res\.green\) return res;/);
  if (!short) ok("the resumed short-circuit no longer covers both completion stages");
  else fail("`if (res.resumed || !res.green) return res;` still skips BOTH the T0 re-read and the leg check for a resumed scope");

  const gatesOnlyT0 = /if \(!res\.green\) return[^\n]*\n[\s\S]{0,1400}?if \(!res\.resumed\) \{[\s\S]{0,600}?probe t0[\s\S]{0,900}?\n\s*\}/.test(src);
  if (gatesOnlyT0) ok("only the T0 re-read is gated on `resumed` — the leg question is asked of every settled scope");
  else fail("the `resumed` guard does not wrap the T0 re-read alone; the leg check must not sit inside it");

  // THE SINGLE WRITER IS ASKED BEFORE ANY VERDICT ON GREEN. The leg check used to sit behind
  // `if (!res.green) return` and the T0 re-read, so the state it detects — a result on disk nothing
  // applied — was reachable only for a scope already fully green. Measured live: a leg reported
  // green with no T0 at all, the T0 re-read said not green, the round returned, and the result was
  // never read. Now: leg question -> green gate -> T0 re-read (gated on resumed) -> late-ingest
  // repair. The repair still follows the check that decides the scope is green, because ingest
  // ticks acceptance boxes and must not apply work T0 never measured.
  const stage = src.slice(src.indexOf("async (res, s) => {"));
  const legAt = stage.indexOf("probe leg --slug");
  const greenAt = stage.indexOf("if (!res.green) return");
  const t0At = stage.indexOf("probe t0 --slug");
  const ingestAt = stage.indexOf("reduce ingest --order");
  if (legAt !== -1 && legAt < greenAt && greenAt < t0At && t0At < ingestAt) {
    ok("order inside the confirm stage: leg question for every settled scope -> green gate -> T0 re-read -> late-ingest repair");
  } else {
    fail(`the confirm stage's order is wrong (leg@${legAt}, green@${greenAt}, t0@${t0At}, ingest@${ingestAt}, relative to the stage) — the single writer must be asked before any early return, and the repair must follow the check that decides green`);
  }
  const deadAsked = /if \(res\.__failed\) return unapplied\.length/.test(stage);
  if (deadAsked) ok("a dead leg's result is still asked about — `__failed` returns after the leg question, carrying what it found");
  else fail("a dead leg returns before the leg question — a worker that died after writing its result leaves it unread");
}
