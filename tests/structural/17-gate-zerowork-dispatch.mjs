// Structural test module: what counts as dispatching the orchestrator for the zero-work gate.
// Section: 51.
//
// WHY THIS MODULE EXISTS, AND WHY IT IS ITS OWN FILE.
//
// Section 37 (tests/structural/10-run-receipt.mjs) proves the zero-work gate blocks the narrated
// run and fails open everywhere else, from a single dispatch spelling. The gate's predicate is
// "the session dispatched the orchestrator AND the run left no receipt", and the dispatch
// detector is the half of it that makes the predicate non-vacuous: without it a session that never
// opened a run has not done "zero work", it has done nothing it was asked to. So the detector is
// pinned on its own, in both polarities — a detector that only ever says true blocks every
// session, and one that only ever says false blocks none.
//
// The loop runs in the session itself, so there are exactly TWO front doors:
//
//   1. a `Skill` dispatch of `building` (namespaced or bare), and
//   2. a message that LEADS with the `/ship` slash command — bare (`/ship …`, a headless prompt)
//      or in the tag-wrapped form the host writes into the transcript for a typed command
//      (`<command-message>…</command-message>` then `<command-name>/ns:ship</command-name>`).
//
// The wrapped spelling is not hypothetical: the transcripts of the real nested runs lead with it,
// and the bare-only pattern the gate used to carry did not match them. Those runs were still seen
// because they also emit `Skill(building)`; the slash arm is the one that sees a session which
// typed `/ship` and never reached the skill.
//
// WHAT NO LONGER COUNTS, and each is pinned as a negative below so it cannot creep back:
//   - a `Workflow` tool launch, however it is spelled. The loop is not a script; there is no
//     script launch to watch, and counting one would arm the gate on any session that ran
//     somebody else's workflow.
//   - a Bash command that runs an orchestrator script. Same reason.
//   - a message that merely MENTIONS `/ship` or `building`. A gate that fires on a session
//     talking about the harness is a gate users turn off, and it takes the real block down too.
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/** A transcript event carrying one `tool_use` block, in the shape the hook reads. */
const toolUse = (name, input) => ({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } });
/** A transcript event carrying user text. */
const userText = (text) => ({ type: "user", message: { content: text } });

/**
 * Run the gate-zerowork dispatch-detector checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx): ROOT, ok, fail,
 *   section. ok()/fail() mutate the counters in place.
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("51. The zero-work gate recognises the loop's two front doors, and only those");
  // =============================================================================

  const ZW = join(ROOT, "hooks/gate-zerowork.mjs");
  if (!existsSync(ZW)) {
    fail("hooks/gate-zerowork.mjs is missing — the loop has no zero-work detector");
    return;
  }

  const { dispatchedOrchestrator } = await import(`file://${ZW}`);

  // --- (a) the two spellings are dispatches -------------------------------------------------
  if (dispatchedOrchestrator([toolUse("Skill", { skill: "shapeup-sdlc-plugin:building", args: "--unattended" })])) {
    ok("Skill(shapeup-sdlc-plugin:building) counts as dispatching the orchestrator");
  } else fail("a namespaced building dispatch is not seen — the gate is blind on the loop's own skill");
  if (dispatchedOrchestrator([toolUse("Skill", { skill: "building" })])) ok("Skill(building), bare, counts as well");
  else fail("a bare building dispatch is not seen");

  const LEADING = [
    ["the bare slash command", "/ship --unattended --pitch pitch.md"],
    ["the namespaced slash command", "/shapeup-sdlc-plugin:ship --pitch pitch.md"],
    ["the host's tag-wrapped form, as the real transcripts record it",
     "<command-message>shapeup-sdlc-plugin:ship</command-message>\n<command-name>/shapeup-sdlc-plugin:ship</command-name>\n<command-args>--unattended --pitch pitch.md</command-args>"],
    ["the tag-wrapped form with no command-message line", "<command-name>/ship</command-name>"],
    ["a bare command after leading whitespace", "  \n/ship"],
  ];
  for (const [label, text] of LEADING) {
    if (dispatchedOrchestrator([userText(text)])) ok(`a leading /ship counts as a dispatch: ${label}`);
    else fail(`a leading /ship is not seen (${label}) — a session that typed it and never reached the skill is invisible`);
  }

  // --- (b) what does NOT count ----------------------------------------------------------------
  // The Workflow arm is gone on purpose: the loop is not a script, so a `Workflow` launch is not a
  // dispatch of anything this gate watches. Previously a shapeup-* launch armed it.
  const NOT_DISPATCHES = [
    ["a Workflow launch of an orchestrator-named script",
     toolUse("Workflow", { scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/workflows/shapeup-run.js", args: { slug: "x" } })],
    ["a named Workflow launch", toolUse("Workflow", { name: "shapeup-run" })],
    ["somebody else's Workflow", toolUse("Workflow", { scriptPath: "/tmp/wf/review-changes.js" })],
    ["a Bash launch of an orchestrator script",
     toolUse("Bash", { command: 'node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" run "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/workflows/shapeup-run.js"' })],
    ["a Skill dispatch of a worker", toolUse("Skill", { skill: "shapeup-sdlc-plugin:orient" })],
    ["a Skill dispatch of an unrelated skill", toolUse("Skill", { skill: "my-plugin:building-blocks" })],
    ["a question about the loop", userText("how does the building skill decide what comes next?")],
    ["a message that mentions /ship mid-sentence", userText("how does /ship decide the lane? and what does /shapeup-sdlc-plugin:ship do on a resume?")],
    ["a message that quotes the wrapped tag mid-sentence", userText("the transcript shows <command-name>/ship</command-name> for a typed command")],
    ["a message that merely starts with the word ship", userText("shipping this tomorrow, /ship later")],
  ];
  for (const [label, ev] of NOT_DISPATCHES) {
    if (!dispatchedOrchestrator([ev])) ok(`does not count: ${label}`);
    else fail(`${label} armed the gate — the predicate is too loose to leave enabled`);
  }

  // --- (c) end to end: the detector changes the STOP decision, not just a boolean ---------------
  // (a) and (b) prove the predicate. This proves the predicate is wired to the block — a correct
  // function nothing calls is a class of defect, and testing the parts cannot see it.
  const ws = mkdtempSync(join(tmpdir(), "struct-zw-dispatch-"));
  try {
    const jsonl = (evts, name) => {
      const p = join(ws, name);
      writeFileSync(p, evts.map((e) => JSON.stringify(e)).join("\n") + "\n");
      return p;
    };
    const skillOnly = jsonl([toolUse("Skill", { skill: "shapeup-sdlc-plugin:building", args: "--unattended" })], "skill-only.jsonl");
    const slashOnly = jsonl([userText("<command-message>shapeup-sdlc-plugin:ship</command-message>\n<command-name>/shapeup-sdlc-plugin:ship</command-name>\n<command-args>--pitch pitch.md</command-args>")], "slash-only.jsonl");
    const bareSlash = jsonl([userText("/ship --pitch pitch.md")], "bare-slash.jsonl");
    const workflowOnly = jsonl([toolUse("Workflow", { scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/workflows/shapeup-run.js", args: { slug: "x" } })], "workflow-only.jsonl");
    const discussion = jsonl([
      userText("how does /ship decide the lane, and what does the building skill do before it opens a run?"),
      { type: "assistant", message: { content: [{ type: "text", text: "The building skill opens a run, then asks the kernel what comes next." }] } },
    ], "discussion.jsonl");

    const empty = join(ws, "empty");
    mkdirSync(empty, { recursive: true });
    const started = join(ws, "started");
    mkdirSync(join(started, ".shapeup", "todo-persist"), { recursive: true });
    writeFileSync(join(started, ".shapeup", "todo-persist", "receipt.json"),
      JSON.stringify({ started: true, slug: "todo-persist" }));

    const fire = (payload) => spawnSync("node", [ZW], { encoding: "utf8", input: JSON.stringify(payload) });
    const blocked = (r) => { try { return JSON.parse(r.stdout || "{}")?.decision === "block"; } catch { return false; } };

    if (blocked(fire({ cwd: empty, transcript_path: skillOnly }))) ok("BLOCKS a session that dispatched building and left no receipt");
    else fail("a Skill(building) session with no receipt was allowed to stop — the Skill arm is not wired to the block");
    if (blocked(fire({ cwd: empty, transcript_path: slashOnly }))) ok("BLOCKS a session that led with the wrapped /ship and left no receipt");
    else fail("a wrapped-/ship session with no receipt was allowed to stop — the slash arm is not wired to the block");
    if (blocked(fire({ cwd: empty, transcript_path: bareSlash }))) ok("BLOCKS a session that led with a bare /ship and left no receipt");
    else fail("a bare-/ship session with no receipt was allowed to stop");

    // A Workflow launch alone is not a dispatch any more, so it must not block: nothing in the
    // loop launches one, and blocking on it would punish an unrelated workflow.
    if (!fire({ cwd: empty, transcript_path: workflowOnly }).stdout.trim()) ok("a Workflow launch alone is not a dispatch — it does not block");
    else fail("blocked a session whose only 'dispatch' was a Workflow launch — the dropped arm is still wired");

    // A session that merely discussed the harness is the false positive the anchoring exists to
    // prevent, and it is checked through the whole hook, not only the predicate.
    if (!fire({ cwd: empty, transcript_path: discussion }).stdout.trim()) ok("a session that only discussed the harness is not blocked");
    else fail("blocked a session that merely talked about /ship and the building skill — this is how a gate gets disabled");

    if (!fire({ cwd: started, transcript_path: skillOnly }).stdout.trim()) ok("defers once the run receipt exists, whichever door the session came through");
    else fail("blocked a dispatched session that had a receipt on disk");
    if (!fire({ cwd: started, transcript_path: slashOnly }).stdout.trim()) ok("defers on the slash door too once a receipt exists");
    else fail("blocked a /ship session that had a receipt on disk");

    if (!fire({ cwd: empty, transcript_path: skillOnly, stop_hook_active: true }).stdout.trim()) ok("stop_hook_active still caps it at one block per stop chain");
    else fail("would loop: fired with stop_hook_active set");
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
