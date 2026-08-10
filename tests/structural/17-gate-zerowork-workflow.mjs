// Structural test module: gate-zerowork's Workflow arm (migration A5).
// Section: 51.
//
// WHY THIS MODULE EXISTS, AND WHY IT IS ITS OWN FILE.
//
// Section 37 (tests/structural/10-run-receipt.mjs) already proves the zero-work gate blocks the
// benchmark transcript and fails open everywhere else. It could not prove this arm, because until
// the workflow cutover the gate had exactly one dispatch spelling — `Skill(tech-lead)` — and
// section 37's fixtures are all built from it.
//
// The cutover moved the scoped lane's front door. `skills/tech-lead/SKILL.md` Step 2 launches
// `Workflow({scriptPath: "…/skills/tech-lead/workflows/shapeup-run.js", args})`, so a session can
// now reach the orchestrator without ever emitting `Skill(tech-lead)`. `SKILL.md:12-14` told
// operators the gate watched that door; `hooks/gate-zerowork.mjs` did not. An invariant living in
// a prompt and not in the runtime is the one thing AGENTS.md says must never happen, and structural
// #26 cannot catch it — doc-drift checks paths and counts, not claimed predicates.
//
// So the checks below are written against the CLAIM, not the happy path. The question each one
// answers is "would this go red if the arm were removed?" — which is why the module asserts both
// polarities. A detector that only ever says true is not a detector; the negative case (an
// unrelated `Workflow` call must NOT arm the gate) is what keeps this from firing on every session
// that runs somebody else's workflow script, and a gate users disable enforces nothing.
//
// One subtlety the negative case exists for. On a normal install `CLAUDE_PLUGIN_ROOT` itself ends
// in `shapeup-sdlc-plugin/`, so a substring test for `shapeup-` over the whole scriptPath would
// count EVERY workflow script under the plugin root — including one a user wrote for something
// else. The predicate matches the anchored BASENAME instead, and check (b) below is what holds it
// there.
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/** A transcript event carrying one `tool_use` block, in the shape the hook reads. */
const toolUse = (name, input) => ({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } });

/**
 * Run the gate-zerowork Workflow-arm checks (migration A5 / acceptance rows R4, R5).
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx): ROOT, ok, fail,
 *   section. ok()/fail() mutate the counters in place.
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("51. The zero-work gate watches the Workflow door too (migration A5)");
  // =============================================================================

  const ZW = join(ROOT, "hooks/gate-zerowork.mjs");
  if (!existsSync(ZW)) {
    fail("hooks/gate-zerowork.mjs is missing — the Workflow lane has no zero-work detector");
    return;
  }

  const { dispatchedOrchestrator } = await import(`file://${ZW}`);

  // --- (a) the arm itself: a shapeup-* Workflow launch IS a dispatch --------------------------
  // Behavioural, not a grep. `grep -qi workflow hooks/gate-zerowork.mjs` was the migration
  // contract's original row for this and it passes on a comment; the predicate is the claim.
  const RUN_SCRIPT = "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/workflows/shapeup-run.js";
  if (dispatchedOrchestrator([toolUse("Workflow", { scriptPath: RUN_SCRIPT, args: { slug: "todo-persist" } })])) {
    ok("Workflow({scriptPath: …/shapeup-run.js}) counts as dispatching the orchestrator");
  } else {
    fail("a shapeup-run.js Workflow launch is not seen as a dispatch — SKILL.md:12-14 claims it is");
  }

  // The inner script is a launchable entry point in its own right, and the plan's predicate is
  // `shapeup-`, not `shapeup-run`.
  if (dispatchedOrchestrator([toolUse("Workflow", { scriptPath: "/plugins/x/workflows/shapeup-build-round.js" })])) {
    ok("the predicate is shapeup-*, so the build-round script arms the gate too");
  } else {
    fail("shapeup-build-round.js does not arm the gate — the predicate is narrower than shapeup-*");
  }

  // A named (saved) workflow is the other launch spelling the runtime accepts.
  if (dispatchedOrchestrator([toolUse("Workflow", { name: "shapeup-run" })])) {
    ok("Workflow({name: 'shapeup-run'}) — the named-launch spelling — arms the gate");
  } else {
    fail("a named shapeup-run launch is invisible to the gate");
  }

  // --- (b) the negative: somebody else's workflow must NOT arm it -----------------------------
  const NEGATIVES = [
    ["an unrelated script under the plugin root",
     { scriptPath: "/Users/dev/.claude/plugins/shapeup-sdlc-plugin/workflows/review-changes.js" }],
    ["a script whose basename merely contains the token",
     { scriptPath: "/tmp/wf/port-to-shapeup-run.js" }],
    ["a named workflow that is not ours", { name: "find-flaky-tests" }],
    ["a Workflow call with neither scriptPath nor name", { args: { slug: "x" } }],
  ];
  for (const [label, input] of NEGATIVES) {
    if (!dispatchedOrchestrator([toolUse("Workflow", input)])) ok(`defers on ${label}`);
    else fail(`${label} armed the gate — the predicate is too loose to leave enabled`);
  }

  // --- (c) end to end: the arm changes the STOP decision, not just a boolean ------------------
  // (a) proves the predicate. This proves the predicate is wired to the block — `fd5ad3d`'s class
  // was a correct function nothing called, and testing the parts could not see it.
  const ws = mkdtempSync(join(tmpdir(), "struct-zw-workflow-"));
  try {
    const jsonl = (evts, name) => {
      const p = join(ws, name);
      writeFileSync(p, evts.map((e) => JSON.stringify(e)).join("\n") + "\n");
      return p;
    };
    const launch = toolUse("Workflow", { scriptPath: RUN_SCRIPT, args: { slug: "todo-persist" } });
    const workflowOnly = jsonl([launch], "workflow-only.jsonl");
    const skillOnly = jsonl([toolUse("Skill", { skill: "shapeup-sdlc-plugin:tech-lead", args: "--unattended" })], "skill-only.jsonl");
    const unrelated = jsonl([toolUse("Workflow", { scriptPath: "/tmp/wf/review-changes.js" })], "unrelated.jsonl");

    const empty = join(ws, "empty");
    mkdirSync(empty, { recursive: true });
    const started = join(ws, "started");
    mkdirSync(join(started, ".shapeup", "todo-persist"), { recursive: true });
    writeFileSync(join(started, ".shapeup", "todo-persist", "receipt.json"),
      JSON.stringify({ started: true, slug: "todo-persist" }));

    const fire = (payload) => spawnSync("node", [ZW], { encoding: "utf8", input: JSON.stringify(payload) });
    const blocked = (r) => { try { return JSON.parse(r.stdout || "{}")?.decision === "block"; } catch { return false; } };

    if (blocked(fire({ cwd: empty, transcript_path: workflowOnly })))
      ok("BLOCKS a Workflow-lane session that launched shapeup-run and left no receipt");
    else
      fail("a Workflow-only session with no receipt was allowed to stop — the arm is not wired to the block");

    // Preserved property 1 of A.3: the pre-cutover behaviour is untouched. A session that loaded
    // tech-lead and produced NEITHER a Workflow call nor a receipt still blocks.
    if (blocked(fire({ cwd: empty, transcript_path: skillOnly })))
      ok("still blocks Skill(tech-lead) with neither a Workflow call nor a receipt (non-regression)");
    else
      fail("the Skill(tech-lead) block regressed — widening the predicate must not narrow the gate");

    // Preserved property 2: non-harness sessions still fail open.
    if (!fire({ cwd: empty, transcript_path: unrelated }).stdout.trim())
      ok("still defers on a non-harness session that ran somebody else's workflow (fail-open)");
    else
      fail("fired on a session that never went near the orchestrator — this is how a gate gets disabled");

    // And a receipt is still the fact that settles it, whichever door the session came through.
    if (!fire({ cwd: started, transcript_path: workflowOnly }).stdout.trim())
      ok("defers once the run receipt exists — the Workflow lane starts runs like any other");
    else
      fail("blocked a Workflow-lane session that had a receipt on disk");
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
