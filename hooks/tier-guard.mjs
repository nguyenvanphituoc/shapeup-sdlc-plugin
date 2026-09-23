#!/usr/bin/env node
// Tier guard — PreToolUse hook: the committed tier's write boundary.
//
// Refuses an Edit/Write/MultiEdit into `shapeup/<slug>/` whose CONTENT carries a reference the
// committed tier cannot hold — a path into the gitignored run trace, or a machine-local board id.
// It is the same rule spec-lint's TIER-DIRECTION already enforces, asked at a different moment.
//
// WHY A SECOND ENFORCEMENT POINT FOR A RULE THAT WAS NEVER IN DOUBT. Four different producers wrote
// committed files this harness's own lint then reds: the requirements registry, the ship report, the
// project profile, the coverage clauses. The lint was right every time and caught every one of them
// — at GATE L1b, a whole phase after the sentence was written, addressed to a worker that no longer
// holds the context needed to rephrase it. The run pays for the round trip, and the fix lands in
// whatever wording the next reader guesses at.
//
// TEACHING DOES NOT CLOSE IT, and that is measured rather than assumed. One of the four recurred
// INSIDE A SINGLE SESSION, an hour apart, on a different line of the same file, after that same
// author had fixed the first occurrence and watched its own lint go green. A worker carries no
// lesson across a dispatch. So the remedy has to be a precondition the model cannot talk past, and
// it has to speak AT THE WRITE — the one moment the writer still knows what it meant to say.
//
// THE PREDICATE IS IMPORTED, NEVER RESTATED. `tierLeaks` is the lint's own scanner
// (kernel/verify/spec.mjs), so this hook cannot become narrower than the rule it fronts — which
// would let the defect through to L1b exactly as before — nor wider, which is how a guard earns
// being switched off. The structural suite executes both over one corpus and requires agreement.
//
// Design (deliberately conservative, the shape `sandbox-guard.mjs` argues for):
//   • Fail-OPEN on everything it cannot positively prove: not a write tool, no resolvable path, a
//     path outside `shapeup/<slug>/`, a file form the lint does not scan, or a payload carrying no
//     content to read. A guard that blocks legitimate work gets disabled, and a disabled guard
//     enforces nothing.
//   • `shapeup/knowledge-base/` is OUTSIDE by construction, exactly as it is outside the lint's
//     walk: those files are instructions read by a worker at runtime, not references a reader is
//     expected to resolve, and the defect register they hold has every reason to quote a local path.
//   • Fail-CLOSED only on a leak the lint would red, with the file, the line, the offending token,
//     why it is wrong and what to write instead — all in the denial, because a denial the writer
//     cannot act on immediately just becomes the L1b round trip with extra steps.
//
// WHAT IT DOES NOT COVER, stated because the gap is the same one the substrate fence has: this is a
// PreToolUse hook, so it sees this assistant's own edit path and nothing else. A kernel subcommand
// writing a committed file, a shell heredoc, or any other editor writes straight through it. Those
// producers are answered where they are written; this closes the channel the four measured
// recurrences actually came through.
//
// Contract: PreToolUse stdin JSON { tool_name, tool_input:{file_path, content | new_string |
// edits[]}, cwd }. Deny via { hookSpecificOutput: { hookEventName, permissionDecision:"deny",
// permissionDecisionReason } }.

import { resolve, relative, sep } from "node:path";
import { isMain } from "../kernel/lib/argv.mjs";
import { SHARED } from "../kernel/lib/paths.mjs";
import { SCANNED, tierLeaks } from "../kernel/verify/spec.mjs";
import { runHook, readStdin, settle, projectRoot } from "./lib/decision.mjs";

/** Committed-tier trees that hold instructions rather than references — outside the lint's walk. */
const NOT_A_SLUG = new Set(["knowledge-base"]);

/**
 * The (path, content) pairs one write tool call is about to commit to disk.
 *
 * THE THREE WRITE TOOLS SPELL CONTENT THREE WAYS, and a guard that reads only `content` is blind to
 * the Edit that adds the same line — which is the form the measured recurrence took, since the file
 * already existed by then.
 *
 * @param {object} toolInput - The PreToolUse `tool_input` block.
 * @returns {Array<{path:string, content:string}>} Pairs with a usable path and string content.
 */
export function extractWrites(toolInput) {
  const out = [];
  const base = toolInput?.file_path;
  if (typeof toolInput?.content === "string" && base) out.push({ path: base, content: toolInput.content });
  if (typeof toolInput?.new_string === "string" && base) out.push({ path: base, content: toolInput.new_string });
  if (Array.isArray(toolInput?.edits)) {
    for (const e of toolInput.edits) {
      const p = e?.file_path || base;
      if (p && typeof e?.new_string === "string") out.push({ path: p, content: e.new_string });
    }
  }
  return out;
}

/**
 * Is this path inside the committed tier the lint walks — `shapeup/<slug>/…`, scanned form?
 *
 * @param {string} rel - Path relative to the project root, as the lint would name it.
 * @returns {boolean} True when a leak here is a leak the lint would red.
 */
export function inCommittedTier(rel) {
  if (!rel || rel.startsWith("..") || rel.startsWith(sep)) return false;
  const parts = rel.split(/[\\/]/);
  // `shapeup/<slug>/<file>` — the lint walks a slug's tree, so a file at the tier root belongs to
  // no run and is left alone, and `knowledge-base` is a sibling of the slugs, not one of them.
  if (parts[0] !== SHARED || parts.length < 3 || NOT_A_SLUG.has(parts[1])) return false;
  return SCANNED.test(rel);
}

async function main() {
  await runHook("tier-guard", async () => {
    const raw = await readStdin();
    let p;
    /** Fail-open, with the reason on the record (hooks/lib/decision.mjs). */
    const defer = (reason, rule) => settle({
      verdict: "allow", event: "PreToolUse", tool: p?.tool_name ?? null, cwd: p?.cwd, reason, rule,
    });
    try { p = JSON.parse(raw || "{}"); }
    catch (e) { settle({ verdict: "error", event: "PreToolUse", reason: `unparseable payload: ${e.message}` }); }

    if (!["Edit", "Write", "MultiEdit"].includes(p.tool_name)) {
      defer(`${p.tool_name ?? "no tool_name"} is not a write tool — out of scope`, "not-write-tool");
    }

    // The shell's cwd is where the call fired; the tier lives at the project root. Same split the
    // substrate fence has to make, and for the same reason: a worker that `cd`s into a sub-folder
    // must not thereby leave the tier unguarded. Raw tool paths still resolve against the shell.
    const cwd = p.cwd || process.cwd();
    const root = projectRoot(cwd);

    const writes = extractWrites(p.tool_input);
    if (writes.length === 0) defer("no readable path+content pair in the tool input", "no-content");

    const inTier = writes
      .map((w) => ({ ...w, rel: relative(root, resolve(cwd, w.path)) }))
      .filter((w) => inCommittedTier(w.rel));
    if (inTier.length === 0) defer(`${writes.length} write(s), none inside ${SHARED}/<slug>/ in a scanned form`, "not-committed-tier");

    const blocked = [];
    for (const w of inTier) {
      // THE TOKEN IS QUOTED BACK, which the lint's own message does not do and does not need to —
      // it reports against a file on disk the reader can open at that line. Here the line does not
      // exist yet, so "line 1 points into the local tier" leaves the writer hunting through a
      // fragment it is holding in its head. Naming the exact string is the difference between a
      // denial that is acted on and one that is retried verbatim.
      for (const leak of tierLeaks(w.content)) blocked.push(`${w.rel}:${leak.line} — \`${leak.token}\` ${leak.detail}`);
    }

    if (blocked.length === 0) {
      defer(`${inTier.length} committed-tier write(s) carry no tier-direction leak — permitted`, "tier-clean");
    }

    return {
      verdict: "deny", event: "PreToolUse", tool: p.tool_name, subject: inTier[0].rel, cwd: root,
      rule: "tier-direction",
      reason: `${blocked.length} tier-direction leak(s) refused at the write boundary: ${blocked.join("; ")}`,
      payload: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason:
            "Tier guard (TIER-DIRECTION) — this write would put a reference into the committed tier that " +
            "cannot survive the trip to another machine:\n" +
            `${blocked.join("\n")}\n` +
            `Refused here rather than at GATE L1b, where spec-lint reds the same file after the phase is over. ` +
            "Rephrase the line now: cite the committed artifact, the use case or the scope_id, or describe the " +
            "tier without naming a path.",
        },
      },
    };
  });
}

if (isMain(import.meta.url)) {
  main();
}
