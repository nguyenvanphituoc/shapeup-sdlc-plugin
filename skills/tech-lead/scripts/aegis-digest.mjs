#!/usr/bin/env node
// AEGIS digester (design spec v1.1 §3.4/§4.5, PA6 countermeasure).
//
// Distills raw build/test/Playwright logs into {file, line, core_message} triples so a
// task-executor's next attempt gets a few lines of signal instead of a full stack-trace dump.
// Script-first by design: regex over known log formats is free (no model tokens); an
// unrecognized line becomes a "raw" triple (file/line unknown) rather than being silently
// dropped, so a Sonnet fallback (or a human) still has something to look at — this module never
// invents a file:line it didn't find in the text.
//
// Zero dependencies, zero network — same discipline as oracles/*.

import { isMain } from "./lib/is-main.mjs";
import { runArgs } from "./lib/argv.mjs";

const PATTERNS = [
  // Node stack frame:  "    at fn (path/to/file.js:12:34)"  or  "    at path/to/file.js:12:34"
  { re: /^\s*at\s+(?:[\w.$<>\[\] ]+\s+\()?(.+?):(\d+):\d+\)?\s*$/, kind: "stack-frame" },
  // TAP/test-runner failure: "✗ some test name (path/to/file.js:12)"  or "not ok N - msg (file:line)"
  { re: /^(?:✗|not ok\b.*?)[^()]*\((.+?):(\d+)\)\s*$/, kind: "test-failure" },
  // ESLint/tsc style: "path/to/file.ts:12:34 - error TS2345: message"
  { re: /^(.+?):(\d+):\d+\s*[-–]\s*(?:error|warning)\b.*$/, kind: "compiler-diagnostic" },
  // Generic "Error: message" line followed later by a stack — capture the message alone.
  { re: /^\s*(?:Error|TypeError|ReferenceError|AssertionError)\s*:\s*(.+)$/, kind: "error-message" },
];

/**
 * Normalize a log line into a compact core message.
 * @param {string} line - A raw log line.
 * @returns {string} The line trimmed, whitespace-collapsed, and capped at 200 chars.
 */
function coreMessage(line) {
  return line.trim().replace(/\s+/g, " ").slice(0, 200);
}

/**
 * Distill raw build/test/Playwright log text into deduped {file,line,core_message,kind} triples —
 * never inventing a file:line it did not find in the text.
 * @param {string} rawText - The raw log output ("" / null tolerated).
 * @returns {Array<{file:(string|null), line:(number|null), core_message:string, kind:string}>}
 *   One triple per recognized failure/diagnostic (kind ∈ stack-frame|test-failure|
 *   compiler-diagnostic|error-message); unmatched error messages become file-less triples.
 */
export function digest(rawText) {
  const lines = (rawText || "").split(/\r?\n/);
  const triples = [];
  let pendingMessage = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    let matched = false;
    for (const { re, kind } of PATTERNS) {
      const m = line.match(re);
      if (!m) continue;
      matched = true;
      if (kind === "error-message") {
        pendingMessage = coreMessage(m[1]);
        continue; // wait for the stack frame that follows to get a file:line
      }
      const file = m[1]?.trim();
      const lineNo = m[2] ? Number(m[2]) : null;
      triples.push({
        file: file || null,
        line: lineNo,
        core_message: pendingMessage || coreMessage(line),
        kind,
      });
      pendingMessage = null;
      break;
    }
    if (!matched && pendingMessage) {
      // an error message with no stack frame ever followed — keep it as file-less signal
      triples.push({ file: null, line: null, core_message: pendingMessage, kind: "error-message" });
      pendingMessage = null;
    }
  }
  if (pendingMessage) {
    triples.push({ file: null, line: null, core_message: pendingMessage, kind: "error-message" });
  }

  // De-duplicate identical (file, line, core_message) triples — repeated retries/log noise.
  const seen = new Set();
  return triples.filter((t) => {
    const key = `${t.file}:${t.line}:${t.core_message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// --- CLI ---------------------------------------------------------------------
/** The typed argv contract (see `./lib/argv.mjs`). A bare `-`, or nothing, means stdin. */
export const ARGV_SPEC = {
  usage: "aegis-digest.mjs [<log-file>|-]   (no file → stdin)",
  _: { arity: 0, max: 1, name: "log-file" },
};

/**
 * CLI entry: read a log from a file arg or stdin, print the digested triples as JSON, exit 0.
 * @returns {Promise<void>} Resolves after printing.
 */
async function main() {
  const arg = runArgs(ARGV_SPEC)._[0];
  let raw;
  if (arg && arg !== "-") {
    const { readFileSync } = await import("node:fs");
    raw = readFileSync(arg, "utf8");
  } else {
    raw = await new Promise((resolve) => {
      let d = "";
      process.stdin.on("data", (c) => (d += c));
      process.stdin.on("end", () => resolve(d));
      process.stdin.on("error", () => resolve(""));
    });
  }
  const triples = digest(raw);
  console.log(JSON.stringify(triples, null, 2));
  process.exit(0);
}

if (isMain(import.meta.url)) {
  main();
}
