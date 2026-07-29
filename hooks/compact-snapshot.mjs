#!/usr/bin/env node
// Compact snapshot — PreCompact hook (v1.2, absorb-audit P4).
//
// PreCompact provably CANNOT inject context (no additionalContext/systemMessage channel), so
// this hook is a pure side effect: when a harness run is mid-flight, freeze a RunSnapshot to
// .shapeup-sdlc/<slug>/run-snapshot.json before the conversation is compacted. It is the
// audit anchor ("what did the files say the moment the summary was made?") and the fallback
// hooks/session-rehydrate.mjs reads if live derivation ever throws post-compact.
//
// Never blocks compaction: the whole body is fail-open, exit 0 always.
//
// Contract: PreCompact stdin JSON { cwd, trigger: "manual"|"auto" }.

import { deriveSnapshot, writeSnapshot } from "../skills/tech-lead/scripts/run-snapshot.mjs";
import { isMain } from "../skills/tech-lead/scripts/lib/is-main.mjs";

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
    const snapshot = deriveSnapshot(cwd);
    if (snapshot) writeSnapshot(cwd, snapshot);
  } catch { /* a snapshot failure must never block compaction */ }
  process.exit(0);
}

if (isMain(import.meta.url)) {
  main();
}
