#!/usr/bin/env node
// Session rehydrate — SessionStart hook, matcher "startup|compact|resume|clear".
//
// Fires when a session begins with a harness run already in flight, and injects the RunSnapshot's
// rehydrate_hint as additionalContext: re-derive round/attempt/hill from the files, never from
// memory. This is the reflex that makes the file-first run-state load-bearing at the exact moment
// the in-context copy is absent or degraded: without it the orchestrator can re-dispatch an
// already-ingested order, miscount attempts off a lossy summary, or — measured, below — re-open a
// run that is already open and rebuild the whole pipeline from phase 1.
//
// v1.4.1 — `startup` ADDED TO THE MATCHER, and this is a measured correction, not a widening.
//
// The matcher was `compact|resume`. Both of those are continuations of a conversation that still
// exists. The commonest continuity event in real use has neither: you close the terminal and come
// back tomorrow, or a teammate picks the work up in a fresh checkout. The CLI reports that as
// `SessionStart:startup`, and the reflex whose entire purpose is "trust the files, not your
// memory" did not fire in the one case where there IS no memory to distrust.
//
// The cost is concrete. A fresh session in a workspace where a prior one was cut mid-build sees
// only `SessionStart:startup` — the plugin's load echo, not this hook. With no pointer to the run
// in flight, the orchestrator re-enters at phase 1 and spends its whole budget rebuilding a
// pipeline that is already on disk, closing none of the gap, while the run receipt and board sit
// there the entire time. A session can reach GATE L4 — ship sign-off — having advanced the
// deliverable by zero criteria.
//
// Firing on `startup` is free when there is nothing to say: `findRun` returns a run only for an
// `active-scope` pointer or a `harness-run.md` whose status is mid-run, so an ordinary session in a
// repo with no run — or with a shipped one — gets silence and exit 0, exactly as before.
//
// `clear` is included for the same reason: it discards the conversation and keeps the workspace,
// which is the same problem wearing a different name.
//
// Derivation is always FRESH (files beat any persisted copy); the run-snapshot.json written
// by hooks/compact-snapshot.mjs is only the fallback if live derivation throws. Fail-open:
// no active run, or any error → silent exit 0.
//
// Contract: SessionStart stdin JSON { cwd, source: "startup"|"resume"|"clear"|"compact" }.
// Inject via { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } }.

import { readFileSync } from "node:fs";
import { deriveSnapshot, snapshotPath } from "../kernel/reduce/snapshot.mjs";
import { isMain } from "../kernel/lib/argv.mjs";
import { runHook, readStdin } from "./lib/decision.mjs";
import { activeScope } from "../kernel/lib/paths.mjs";

// The snapshot's own hint says "trust the files, not the conversation summary" — correct after a
// compaction, and slightly wrong on a cold start, where there is no summary and no conversation
// either. The two sources also fail in DIFFERENT directions, so they need different first sentences:
//
//   compact / resume — the risk is acting on a lossy summary of work you remember doing.
//   startup / clear  — the risk is not knowing the run exists, and OPENING IT AGAIN. That is the
//                      failure that actually happens: a fresh session re-enters at phase 1 and
//                      spends its budget rebuilding a pipeline that was already on disk.
//
// Naming the right failure is the whole value of the injection. A generic pointer to the files is
// what a competent agent finds anyway; "there is a run open, do not re-open it" is not.
function lead(source) {
  if (source === "startup" || source === "clear") {
    return "A shapeup-sdlc run is ALREADY OPEN in this workspace and you have no memory of it. " +
      "Do NOT open a new run, re-run intake, or restart the pipeline from phase 1 — the receipt, " +
      "the board and the ledger already exist. RESUME from the phase the files say the run is in. ";
  }
  return "";
}

async function main() {
  await runHook("session-rehydrate", async () => {
    const raw = await readStdin();
    let p;
    try { p = JSON.parse(raw || "{}"); }
    catch (e) { return { verdict: "error", event: "SessionStart", reason: `unparseable payload: ${e.message}` }; }
    const cwd = p.cwd || process.cwd();

    let snapshot = null;
    let source = "live";
    try {
      snapshot = deriveSnapshot(cwd);
    } catch {
      // Live derivation failed → fall back to the pre-compaction anchor, best effort.
      source = "anchor";
      try {
        const pointer = JSON.parse(readFileSync(activeScope(cwd), "utf8"));
        if (pointer?.slug) snapshot = JSON.parse(readFileSync(snapshotPath(cwd, pointer.slug), "utf8"));
      } catch { /* no anchor either → stay silent */ }
    }
    if (!snapshot?.rehydrate_hint) {
      return { verdict: "allow", event: "SessionStart", cwd, subject: p.source ?? null, reason: "no active run — nothing to rehydrate" };
    }

    return {
      verdict: "allow", event: "SessionStart", cwd, rule: `injected:${source}`,
      subject: snapshot.slug ?? p.source ?? null,
      reason: `rehydrate_hint injected on SessionStart:${p.source ?? "?"}`,
      // additionalContext is not a deny, but it IS output, so it rides the same channel.
      payload: {
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: `${lead(p.source)}${snapshot.rehydrate_hint}\n${JSON.stringify(snapshot)}`,
        },
      },
      emit: true,
    };
  });
}

if (isMain(import.meta.url)) {
  main();
}
