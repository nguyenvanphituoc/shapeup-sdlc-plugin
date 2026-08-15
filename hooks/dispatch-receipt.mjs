#!/usr/bin/env node
// Dispatch receipt — PostToolUse hook. The attestation that the SHIPPED skill ran.
//
// WHAT IT DEFENDS AGAINST, measured live rather than imagined. A worker dispatch that fails —
// plugin absent, disabled, or the wrong version loaded — comes back as `<tool_use_error>Unknown
// skill</tool_use_error>`, and the sub-agent then does the craft ITSELF from the prose in its own
// prompt. Everything downstream accepts the result: the artifacts are on disk, in exactly the right
// place, so the phase post-condition passes and the run advances. Both existing walls fire correctly
// and neither can help — the order gate validates the ORDER, the sandbox guard validates WHERE
// writes land, and an improvised write satisfies both. Nothing in the system attested WHICH SKILL
// produced an artifact, so a green run was consistent with zero shipped craft having been applied.
// That is not a failure, it is a FALSE GREEN, and it defeats "measured, not claimed" at the root:
// the measurement was "is the artifact on disk", which cannot distinguish skill-produced from
// improvised.
//
// WHY PostToolUse AND NOT PreToolUse. `PreToolUse` fires BEFORE the tool runs, so it cannot separate
// "the Skill returned" from "the Skill errored and the sub-agent improvised". It appears to catch the
// observed instance only by coupling — the plugin was not loaded, so these hooks were not registered
// either, so there was no receipt. The moment the environment is repaired, a dispatch that errors
// still gets a `PreToolUse` receipt written before it fails, and the fix expires exactly when the
// thing it guards starts working.
//
// WHAT WAS MEASURED, in a real session with the plugin loaded and a SUB-AGENT making the calls
// (every dispatch in this pipeline is a `Skill(...)` call made by a workflow leg, never by the main
// session, so a hook that is blind there is blind exactly where it is needed):
//
//   skill resolves and completes  →  PostToolUse fires, tool_response = {success, commandName}
//   skill name unknown            →  NO hook fires at all; the host rejects the name upstream
//   order missing → gate denies   →  PreToolUse deny, then nothing; a denied call never runs
//
// So the discriminator is stronger than a status field: A FAILED DISPATCH LEAVES NO ROW. The mere
// existence of a matching receipt is the wall; `dispatch_ok` is corroboration on top of it, recorded
// because a future host that reports failures through this event must not be able to satisfy the
// wall by firing at all.
//
// WHAT IT WILL NOT ATTEST. A receipt is written only when the tool result NAMES the skill that ran
// (`tool_response.commandName`). An `Agent` dispatch whose prompt merely mentions `--order` gets no
// receipt: the prompt is a plan to dispatch, not evidence of one, and minting attestation from it
// would forge the exact fact this file exists to establish.
//
// EVERY WRITE IS INSIDE try/catch AND THIS HOOK NEVER DENIES (`lib/decision.mjs`). An unguarded
// `writeFileSync` in a hook body becomes `verdict:"error"` → exit 0 → the dispatch proceeds WITHOUT
// a receipt, and the phase then dies at ingest instead — a receipt channel that can break a run
// gets the whole layer disabled, which is the outcome this file exists to prevent.
//
// Contract: PostToolUse stdin JSON { tool_name, tool_input:{skill,args}, tool_response, cwd }.

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { isMain } from "../kernel/lib/argv.mjs";
import { dispatchReceipts } from "../kernel/lib/paths.mjs";
import { runHook, readStdin, settle } from "./lib/decision.mjs";

/**
 * The `--order` matcher, character-for-character the one the PreToolUse order gate uses
 * (`kernel/verify/envelope.mjs`). Two dispatch hooks that disagree about what an order path IS
 * would gate one set of calls and attest another.
 */
export const ORDER_RE = /--order(?:\s+|=)(?:"([^"]+)"|'([^']+)'|(\S+))/;

/**
 * Pull the order path out of a dispatch's tool input.
 * @param {object} toolInput - The `tool_input` block from the hook payload.
 * @returns {string|null} The path as written, or null when no `--order` was threaded.
 */
export function orderPathFrom(toolInput) {
  const haystack = [toolInput?.skill_args, toolInput?.args, toolInput?.prompt].filter(Boolean).join(" ");
  const m = haystack.match(ORDER_RE);
  return m ? (m[1] || m[2] || m[3]) : null;
}

/**
 * Which skill actually ran, from the tool result.
 *
 * The host reports it NAMESPACED (`shapeup-sdlc-plugin:orient`) while a WorkOrder's `worker` field
 * carries the bare skill name (`orient`), so the comparison the ingest gate performs is only
 * meaningful against the segment after the last `:`.
 *
 * @param {object} toolResponse - The `tool_response` block from the hook payload.
 * @returns {string|null} The bare skill name, or null when the result names no command — which is
 *   the case for every dispatch that did not resolve to a skill.
 */
export function skillInvokedFrom(toolResponse) {
  const name = toolResponse?.commandName;
  if (typeof name !== "string" || !name) return null;
  return name.slice(name.lastIndexOf(":") + 1) || null;
}

/**
 * Build the receipt row for one dispatch.
 *
 * Exported so the suite can assert the row's SHAPE without a live session — the hook body is
 * otherwise reachable only through stdin.
 *
 * @param {object} order - The parsed WorkOrder the dispatch was aimed by.
 * @param {string} skillInvoked - The bare skill name the host reported running.
 * @param {object} payload - The whole hook payload, for the sub-agent provenance fields.
 * @returns {object} The row appended to the run's dispatch ledger.
 */
export function receiptRow(order, skillInvoked, payload) {
  return {
    at: new Date().toISOString(),
    order_id: order.order_id ?? null,
    run_id: order.run_id ?? null,
    worker_declared: order.worker ?? null,
    skill_invoked: skillInvoked,
    // Corroboration, not the wall — see the header. `success` is absent on hosts that do not
    // report one, and an absent field must not read as a successful dispatch.
    dispatch_ok: payload?.tool_response?.success === true,
    tool: payload?.tool_name ?? null,
    // Present when the dispatch came from a sub-agent, absent when the operator called it directly.
    // That is the difference between an orchestrated leg and someone driving a skill by hand.
    agent_id: payload?.agent_id ?? null,
    agent_type: payload?.agent_type ?? null,
  };
}

/**
 * Append one receipt to the run's dispatch ledger. Never throws.
 * @param {object} row - A {@link receiptRow}.
 * @param {string} cwd - Project root the LOCAL root resolves against.
 * @returns {string|null} The ledger path when the row reached disk, else null.
 */
export function writeReceipt(row, cwd) {
  try {
    const slug = String(row.order_id).split("/")[0];
    if (!slug) return null;
    const path = dispatchReceipts(cwd, slug);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(row) + "\n");
    return path;
  } catch { return null; }
}

/**
 * The hook body — attest a completed dispatch, defer on everything else.
 * @returns {Promise<void>} Settles through {@link runHook}, which always exits 0.
 */
export async function main() {
  await runHook("dispatch-receipt", async () => {
    /**
     * Permit with the reason on the record. This hook has no deny path at all.
     *
     * THE SKILL NAME TRAVELS ON EVERY ROW, including the defers, and that is load-bearing rather
     * than decorative. A dispatch whose skill name does not resolve fires no hook at all — measured,
     * not assumed — so a row naming a skill is itself proof that THIS SESSION resolved THAT skill.
     * That is the one question a file-existence check cannot answer, and `verify dispatch` answers
     * it by reading these rows. Without the name here, the evidence exists and is unattributable.
     *
     * @param {string} reason - Why no receipt was written.
     * @param {string} [rule] - Which defer condition matched.
     * @returns {never} Does not return — settles the hook.
     */
    const defer = (reason, rule) => settle({
      verdict: "allow", event: "PostToolUse", tool: p?.tool_name ?? null, cwd: p?.cwd, reason, rule,
      subject: p?.tool_input?.skill ?? null,
    });
    const raw = await readStdin();
    let p;
    try { p = JSON.parse(raw || "{}"); }
    catch (e) { settle({ verdict: "error", event: "PostToolUse", reason: `unparseable payload: ${e.message}` }); }

    if (p.tool_name !== "Skill" && p.tool_name !== "Agent") {
      defer(`${p.tool_name ?? "no tool_name"} is not a dispatch tool — out of scope`, "not-a-dispatch");
    }
    const cited = orderPathFrom(p.tool_input);
    if (!cited) defer("no --order threaded — not an orchestrated dispatch", "no-order");

    const skillInvoked = skillInvokedFrom(p.tool_response);
    if (!skillInvoked) {
      // The `Agent` case, and any host result that does not name what ran. Attesting here would
      // mint the fact rather than record it.
      defer("dispatch result names no resolved skill — nothing to attest", "no-skill-named");
    }

    const cwd = p.cwd || process.cwd();
    const orderPath = resolve(cwd, cited);
    let order;
    try { order = JSON.parse(readFileSync(orderPath, "utf8")); }
    catch (e) { defer(`order not readable (${e.message}) — cannot attest a dispatch it cannot identify`, "order-unreadable"); }
    if (!order?.order_id) defer("order carries no order_id — nothing to key a receipt by", "order-unkeyed");

    const row = receiptRow(order, skillInvoked, p);
    const written = writeReceipt(row, cwd);
    return {
      verdict: "allow", event: "PostToolUse", tool: p.tool_name, cwd, subject: row.order_id,
      rule: written ? "receipt-written" : "receipt-write-failed",
      reason: written
        ? `dispatch receipt: ${row.order_id} ran ${skillInvoked} (declared ${row.worker_declared}, ok=${row.dispatch_ok})`
        : `dispatch receipt could not be written for ${row.order_id} — ingest will refuse this result unless --no-receipt-check`,
    };
  });
}

if (isMain(import.meta.url)) main();
