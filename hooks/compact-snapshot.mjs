#!/usr/bin/env node
// Compact snapshot — PreCompact hook (v1.2).
//
// PreCompact provably CANNOT inject context (no additionalContext/systemMessage channel), so
// this hook is a pure side effect: when a harness run is mid-flight, freeze a RunSnapshot to
// .shapeup/<slug>/run-snapshot.json before the conversation is compacted. It is the
// audit anchor ("what did the files say the moment the summary was made?") and the fallback
// hooks/session-rehydrate.mjs reads if live derivation ever throws post-compact.
//
// Never blocks compaction: the whole body is fail-open, exit 0 always.
//
// Contract: PreCompact stdin JSON { cwd, trigger: "manual"|"auto" }.

// RECEIPTS (v1.5). This hook is the sharpest case for `hooks/lib/decision.mjs`: it is routinely
// scored `Unfired` — 0 `PreCompact` events observed — and that score is UNOBTAINABLE, because
// "never had to fire" and "never ran" produce identical evidence (exit 0, no output). With a
// decision row per invocation the two become separable facts.

import { deriveSnapshot, writeSnapshot } from "../skills/tech-lead/scripts/run-snapshot.mjs";
import { isMain } from "../skills/tech-lead/scripts/lib/is-main.mjs";
import { runHook, readStdin } from "./lib/decision.mjs";

async function main() {
  await runHook("compact-snapshot", async () => {
    const raw = await readStdin();
    let p;
    try { p = JSON.parse(raw || "{}"); }
    catch (e) { return { verdict: "error", event: "PreCompact", reason: `unparseable payload: ${e.message}` }; }
    const cwd = p.cwd || process.cwd();
    try {
      const snapshot = deriveSnapshot(cwd);
      if (!snapshot) return { verdict: "allow", event: "PreCompact", cwd, reason: "no active run — nothing to freeze" };
      writeSnapshot(cwd, snapshot);
      return {
        verdict: "allow", event: "PreCompact", cwd, rule: "snapshot-written",
        subject: snapshot.slug ?? null, reason: "RunSnapshot frozen before compaction",
      };
    } catch (e) {
      // A snapshot failure must never block compaction — but it is now a fact rather than silence.
      return { verdict: "error", event: "PreCompact", cwd, reason: `snapshot failed: ${e.message}` };
    }
  });
}

if (isMain(import.meta.url)) {
  main();
}
