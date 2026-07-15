#!/usr/bin/env node
// Session rehydrate — SessionStart hook, matcher "compact|resume" (v1.2, absorb-audit P4).
//
// Fires immediately after a context compaction (or session resume). When a harness run is
// mid-flight, injects the RunSnapshot's rehydrate_hint as additionalContext: "re-read
// .shapeup-sdlc/<slug>/harness-run.md and the board before continuing — trust the files, not
// the conversation summary." This is the reflex that makes the file-first run-state
// load-bearing at the exact moment the in-context copy degrades: without it the orchestrator
// can re-dispatch an already-ingested order or miscount attempts off a lossy summary.
//
// Derivation is always FRESH (files beat any persisted copy); the run-snapshot.json written
// by hooks/compact-snapshot.mjs is only the fallback if live derivation throws. Fail-open:
// no active run, or any error → silent exit 0.
//
// Contract: SessionStart stdin JSON { cwd, source: "startup"|"resume"|"clear"|"compact" }.
// Inject via { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } }.

import { readFileSync } from "node:fs";
import { deriveSnapshot, snapshotPath } from "../skills/tech-lead/scripts/run-snapshot.mjs";

async function main() {
  const raw = await new Promise((res) => {
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => res(d));
    process.stdin.on("error", () => res(""));
  });
  try {
    const p = JSON.parse(raw || "{}");
    const cwd = p.cwd || process.cwd();

    let snapshot = null;
    try {
      snapshot = deriveSnapshot(cwd);
    } catch {
      // Live derivation failed → fall back to the pre-compaction anchor, best effort.
      try {
        const pointer = JSON.parse(readFileSync(`${cwd}/.shapeup-sdlc/active-scope`, "utf8"));
        if (pointer?.slug) snapshot = JSON.parse(readFileSync(snapshotPath(cwd, pointer.slug), "utf8"));
      } catch { /* no anchor either → stay silent */ }
    }
    if (!snapshot?.rehydrate_hint) process.exit(0);

    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: `${snapshot.rehydrate_hint}\n${JSON.stringify(snapshot)}`,
      },
    }));
  } catch { /* fail-open */ }
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
