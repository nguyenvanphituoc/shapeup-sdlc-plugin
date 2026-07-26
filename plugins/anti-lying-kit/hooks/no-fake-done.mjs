#!/usr/bin/env node
// NO FAKE DONE — Stop hook. Advisory, never blocking.
//
// Reads what the agent just claimed and checks it against the board. If the reply says the work
// is complete while tasks are demonstrably unfinished, it says so.
//
//   Prevents: a session that ends with "all done!" over a board with three open tasks — the
//             quiet version of the same failure GATE DONE blocks loudly.
//
// Deliberately ADVISORY. It emits at most a `systemMessage` and always exits 0 — never
// `decision: "block"`, never exit 2. Rationale inherited from the parent harness: a Stop hook
// that can trap a session is a hook users disable. The loud gate is PreToolUse's job; this one
// is a mirror, not a wall.
//
// Contract: Stop stdin JSON { transcript_path?, cwd, ... }. Output { systemMessage }.

import { readFileSync, existsSync } from "node:fs";
import { readBoard } from "../lib/board.mjs";

const quiet = () => process.exit(0);

const raw = await new Promise((res) => {
  let d = "";
  process.stdin.on("data", (c) => (d += c));
  process.stdin.on("end", () => res(d));
  process.stdin.on("error", () => res(""));
});

let p;
try { p = JSON.parse(raw || "{}"); } catch { quiet(); }

const cwd = p.cwd || process.cwd();
const board = readBoard(cwd);
if (!board || board.unfinished.length === 0) quiet(); // nothing to contradict

// Pull the assistant's last message out of the transcript, when the host provides one.
// No transcript → we cannot know what was claimed, so we say nothing rather than nag on every
// stop. Silence is the correct default for an advisory hook with no evidence.
let claim = "";
const tp = p.transcript_path;
if (tp && existsSync(tp)) {
  try {
    const lines = readFileSync(tp, "utf8").trim().split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0 && !claim; i--) {
      let ev; try { ev = JSON.parse(lines[i]); } catch { continue; }
      const content = ev?.message?.content ?? ev?.content;
      if (ev?.message?.role !== "assistant" && ev?.role !== "assistant") continue;
      if (typeof content === "string") claim = content;
      else if (Array.isArray(content)) {
        claim = content.filter((b) => b?.type === "text").map((b) => b.text).join("\n");
      }
    }
  } catch { /* unreadable transcript → treated as absent */ }
}
if (!claim) quiet();

// Completion language. Kept narrow on purpose: this must not fire on "I finished reading the
// file" or on a sentence that is already hedging ("not done yet", "still need to").
const CLAIMS_DONE = /\b(all (?:tasks|tests|work|of it) (?:are|is)? ?(?:now )?(?:done|complete|passing)|everything (?:is )?(?:done|complete|working|passing)|implementation is complete|feature is (?:done|complete|shipped)|ready to ship|all set|fully implemented)\b/i;
const HEDGED = /\b(not (?:yet )?(?:done|complete)|still (?:need|needs|to do|open|unfinished)|remaining|outstanding|except|apart from|todo)\b/i;

if (!CLAIMS_DONE.test(claim) || HEDGED.test(claim)) quiet();

const shown = board.unfinished.slice(0, 8);
const more = board.unfinished.length - shown.length;
console.log(JSON.stringify({
  systemMessage:
    `⚠️  no-fake-done: that reply reads as "the work is finished", but the board disagrees — ` +
    `${board.unfinished.length} of ${board.total} tasks are still unfinished: ` +
    `${shown.join(", ")}${more > 0 ? `, +${more} more` : ""}. ` +
    `Either finish them or say plainly what is left. (Advisory only — nothing was blocked.)`,
}));
process.exit(0);
