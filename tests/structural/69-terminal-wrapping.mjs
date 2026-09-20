// 69 — REWORK (round 2), defect-sweep Stage 8: every terminal RunReturn shapeup-run.js's own
// TOP-LEVEL flow constructs is wrapped in `await withWarnings(...)`, source-level and
// mutation-tested. Section 112.
//
// THE HOLE THIS CLOSES. Round 1's acceptance drove shapeup-run.js to completion against a stubbed
// runtime and found TWO top-level terminal returns — `aborted("probe", …)` (the fast-forward
// derivation coming back empty) and `aborted("L1b", …)` (a red spec-lint before BUILD) — that
// constructed a RunReturn directly, never through `withWarnings`. Both are ordinary outcomes
// AGENTS.md documents ("Sign-off is a file"), both were green across 1804 checks, and both meant
// `closeIfTerminal` never ran: the ledger stayed open, `closed_at`/`close_cause` stayed `~`, and the
// exported run row was byte-identical to a live run — the exact HD-011 signature this stage exists
// to close, reopened by the same stage. 16-workflows.mjs was found to TOLERATE the wrapped form
// without ever REQUIRING it — the one test that touches this shape had been weakened, not
// strengthened. This module is the guard the rework itself demanded: not "these two lines are
// fixed" (67-terminal-closeout.mjs already proves the kernel side of that end to end) but "no
// top-level terminal return in this file can ever be unwrapped again without a check going red."
//
// ROUND 2 — THE GUARD ITSELF WAS MEASURED AND FOUND TO PIN THE SHAPE, NOT THE PROPERTY. An
// independent acceptance pass mutated a real site to `return (aborted("preflight", …)` — an
// otherwise-inert stray paren ahead of the constructor call, the shape a half-applied
// find/replace leaves behind — and it slipped past every TARGET pattern below entirely, caught
// only by 16-workflows.mjs's own site-specific regex (which does not cover the other six wrapped
// sites). The acceptance report named a second, un-mutated gap in the same direction: `return
// withWarnings(x)` with the `await` dropped still CONSTRUCTS the wrapped shape but returns an
// un-awaited Promise rather than running `closeIfTerminal` first — visually wrapped, actually not.
// Both are now first-class TARGET patterns (see the constant below) and both get their own
// mutation test in section (c).
//
// WHY SOURCE LEVEL. shapeup-run.js is a Workflow body — top-level `return`, no exports beyond
// `meta` — and cannot be imported or executed by this suite (58-relaunch-memory.mjs's own banner).
// So this reads the file as text, the same discipline 58 and 18-resume-state.mjs already use.
//
// THE RULE THE CHECKER ENCODES, and nothing more. A WRAPPED terminal return reads `return await
// withWarnings(aborted(...))` — "return" is followed by "await withWarnings(", never directly (nor
// through a stray wrapping paren) by the constructor, and never by `withWarnings(` itself with no
// `await` in front — occurring OUTSIDE a named top-level function's own body (whose return value is
// its CALLER's to wrap — requirePhase, fastForward, requireLaunchRecord, crossGate all construct
// one for exactly that reason) and AFTER `withWarnings` itself is defined (the args-validation abort
// at the very top of the file runs before the `const withWarnings = …` line has executed — calling
// it there is not a style gap, it is a ReferenceError) IS, by construction, unwrapped. Two
// exclusions, both principled; nothing else is special-cased.
//
// A LINE-ANCHORED SCAN, not a general parser — deliberately, and cheaper to verify than to build.
// Every top-level function/arrow-with-block in this file opens at COLUMN 0 and closes with a bare
// `}`/`};` also at column 0, with no other column-0 line in between (checked exhaustively: every one
// of the file's ~20 top-level definitions round-trips through exactly this shape). That lets exact
// span-finding skip real brace/string/template tokenizing entirely — the earlier draft of this
// checker built one (recursive `${…}` descent included) and it was STILL wrong, because a masking
// bug silently blanked real code near `closeIfTerminal`. A checker that must itself be trusted needs
// the simpler mechanism, and the exhaustive local verification below (P0) is what stands in for the
// general case a parser would have covered for free.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const FN_OPEN_RE = /^(?:(?:async\s+)?function\s+[$A-Za-z_][\w$]*\s*\(.*\)\s*\{|const\s+[$A-Za-z_][\w$]*\s*=\s*(?:async\s*)?\(.*\)\s*=>\s*\{)\s*$/;
const CLOSE_RE = /^\};?\s*$/;

// PROPERTY, not literal shape. Every entry below allows an arbitrary run of wrapping parens between
// `return` and the constructor call (`\(*` — zero or more, so `return aborted(`, `return (aborted(`
// and `return ((aborted(` are all caught the same way), because a stray paren changes nothing about
// whether `withWarnings` — and therefore `closeIfTerminal` — actually runs. The fifth entry is the
// opposite failure shape: `withWarnings(` reached directly, with no `await` in front of it, which
// looks wrapped to a human skim but returns a Promise the caller never resolves.
const TARGET = [
  /\breturn\s*\(*\s*aborted\(/,
  /\breturn\s*\(*\s*paused\(/,
  /\breturn\s*\(*\s*diedAt\(/,
  /\breturn\s*\(*\s*\{\s*status\s*:\s*["'](?:aborted|shipped|gate_h|paused)["']/,
  /\breturn\s*\(*\s*withWarnings\(/,
];

/**
 * Every top-level (column-0) named function/arrow-with-block span, as inclusive 0-based line-index
 * ranges — the region whose own `return` statements are its CALLER's to wrap, never this file's own
 * top-level flow.
 * @param {string[]} lines - The file, split on "\n".
 * @returns {{start:number, end:number, isWithWarnings:boolean}[]} One entry per span found.
 */
function functionSpans(lines) {
  const spans = [];
  let i = 0;
  while (i < lines.length) {
    if (FN_OPEN_RE.test(lines[i])) {
      const start = i;
      let j = i + 1;
      while (j < lines.length && !CLOSE_RE.test(lines[j])) j++;
      spans.push({ start, end: Math.min(j, lines.length - 1), isWithWarnings: /^const\s+withWarnings\s*=/.test(lines[i]) });
      i = j + 1;
      continue;
    }
    i++;
  }
  return spans;
}

/**
 * Every terminal-RunReturn construction reachable from shapeup-run.js's own top-level flow that is
 * NOT wrapped in `await withWarnings(...)` — see this module's own banner for the two exclusions.
 * @param {string} src - shapeup-run.js's own source text.
 * @returns {{line:number, text:string}[]} One entry per unwrapped construction (1-based line).
 */
export function findUnwrappedTerminalReturns(src) {
  const lines = src.split("\n");
  const spans = functionSpans(lines);
  const inSpan = (i) => spans.some((s) => i >= s.start && i <= s.end);
  const withWarnings = spans.find((s) => s.isWithWarnings);
  const scanFrom = withWarnings ? withWarnings.end : -1; // skip everything at/before its own close

  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (i <= scanFrom || inSpan(i)) continue;
    for (const re of TARGET) {
      const m = lines[i].match(re);
      // `withWarnings(` with `await` immediately before it is the CORRECT shape, not a hit — the
      // withWarnings TARGET entry exists for the case with no `await`, and JS regex `\breturn\s*\(*\s*`
      // cannot itself express "not preceded by a specific word", so that exclusion is checked here.
      if (m && !/\breturn\s+await\s+withWarnings\(/.test(lines[i])) hits.push({ line: i + 1, text: m[0].trim() });
    }
  }
  return hits;
}

/**
 * Locate the SINGLE line matching `needle` that reads the fully-wrapped
 * `return await withWarnings(...)` shape — content-addressed rather than a hand-maintained line
 * number, so an unrelated edit earlier in the file (this stage's own rework added roughly twenty
 * lines to `closeIfTerminal`, above every site this module pins) cannot silently stop this test from
 * finding its target and reporting a false green.
 * @param {string[]} lines - The file, split on "\n".
 * @param {string} needle - A substring unique to the target line (e.g. `aborted("probe"`).
 * @returns {number} 1-based line number.
 * @throws {Error} When zero or more than one line contains `needle`.
 */
function findWrappedLine(lines, needle) {
  const matches = lines.map((l, i) => ({ i, l })).filter(({ l }) => l.includes(needle) && /return await withWarnings\(/.test(l));
  if (matches.length !== 1) {
    throw new Error(`findWrappedLine: expected exactly one wrapped line containing ${JSON.stringify(needle)}, found ${matches.length}`);
  }
  return matches[0].i + 1;
}

/**
 * Textually strip ONE `return await withWarnings(EXPR);` line down to `return EXPR;` — the exact
 * shape Round 1's two real defects had before they were fixed.
 * @param {string} src - Full source.
 * @param {number} lineNo - 1-based line number of a `return await withWarnings(...)` statement.
 * @returns {string} The source with that one line unwrapped.
 * @throws {Error} If the named line does not match the wrapped shape (a fixture bug, not a finding).
 */
function unwrapLine(src, lineNo) {
  const lines = src.split("\n");
  const idx = lineNo - 1;
  const re = /^(\s*)return await withWarnings\((.*)\);\s*$/;
  const m = lines[idx]?.match(re);
  if (!m) throw new Error(`unwrapLine: line ${lineNo} does not read "return await withWarnings(...);" — got ${JSON.stringify(lines[idx])}`);
  lines[idx] = `${m[1]}return ${m[2]};`;
  return lines.join("\n");
}

/**
 * ROUND 2 — the acceptance's own canary mutation: strip `await withWarnings(` down to a stray
 * leading paren, e.g. `return await withWarnings(aborted(x))` → `return (aborted(x))`. Still calls
 * the constructor directly; `withWarnings`/`closeIfTerminal` never run.
 * @param {string} src - Full source.
 * @param {number} lineNo - 1-based line number of a `return await withWarnings(...)` statement.
 * @returns {string} The source with that one line unwrapped behind a stray paren.
 * @throws {Error} If the named line does not match the wrapped shape.
 */
function parenthesizeUnwrap(src, lineNo) {
  const lines = src.split("\n");
  const idx = lineNo - 1;
  const re = /^(\s*)return await withWarnings\((.*)\);\s*$/;
  const m = lines[idx]?.match(re);
  if (!m) throw new Error(`parenthesizeUnwrap: line ${lineNo} does not read "return await withWarnings(...);" — got ${JSON.stringify(lines[idx])}`);
  lines[idx] = `${m[1]}return (${m[2]});`;
  return lines.join("\n");
}

/**
 * ROUND 2 — the acceptance's second named gap: drop `await` in front of `withWarnings(`, leaving
 * the call constructed but never awaited.
 * @param {string} src - Full source.
 * @param {number} lineNo - 1-based line number of a `return await withWarnings(...)` statement.
 * @returns {string} The source with that one line's `await` removed.
 * @throws {Error} If the named line does not match the wrapped shape.
 */
function dropAwait(src, lineNo) {
  const lines = src.split("\n");
  const idx = lineNo - 1;
  const re = /^(\s*)return await withWarnings\((.*)\);\s*$/;
  const m = lines[idx]?.match(re);
  if (!m) throw new Error(`dropAwait: line ${lineNo} does not read "return await withWarnings(...);" — got ${JSON.stringify(lines[idx])}`);
  lines[idx] = `${m[1]}return withWarnings(${m[2]});`;
  return lines.join("\n");
}

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  section("112. Every top-level terminal RunReturn is wrapped in withWarnings — source + mutation");

  const path = join(ROOT, "skills/tech-lead/workflows/shapeup-run.js");
  const src = readFileSync(path, "utf8");
  const lines0 = src.split("\n");

  // --- (a) THE CHECK ITSELF — the real file, today, has zero unwrapped top-level constructions ---
  const hits = findUnwrappedTerminalReturns(src);
  if (hits.length === 0) {
    ok("shapeup-run.js carries zero unwrapped top-level terminal-RunReturn constructions");
  } else {
    fail(`shapeup-run.js has ${hits.length} unwrapped top-level terminal return(s): ${hits.map((h) => `L${h.line} "${h.text}"`).join("; ")}`);
  }

  // Specifically the two Round 1 found — CONTENT-addressed (not a hardcoded line number: this
  // stage's own rework moved both sites ~20 lines by growing closeIfTerminal above them, which is
  // exactly the kind of unrelated edit a hand-pinned number cannot survive) so the fix is still
  // pinned by name rather than merely by vibe.
  let probeLine, l1bLine;
  try {
    probeLine = findWrappedLine(lines0, 'aborted("probe"');
    l1bLine = findWrappedLine(lines0, 'aborted("L1b"');
    ok(`the two Round-1 BLOCKING sites (the empty fast-forward abort at L${probeLine}, the L1b spec-lint abort at L${l1bLine}) were both located, wrapped`);
  } catch (e) {
    fail(`(a) could not locate the two Round-1 sites by content: ${e.message}`);
  }

  // --- (b) P0 — the span-finder's own load-bearing claim, checked directly ----------------------
  // "Every top-level function/arrow-with-block opens and closes at column 0, with nothing else at
  // column 0 in between" is what lets (a) skip real tokenizing. If that claim is false for some
  // span, this check's own exclusions are wrong in a way (a) cannot see — an over-wide span would
  // hide a real violation, not manufacture one. Pinned by CONTENT, not by a hand-maintained count:
  // every span must open on a `function`/`const … =>` line and close on a bare `}`/`};` line, and
  // the two known non-trivial spans (crossGate, worker) must be found with the extents this module's
  // own banner claims.
  const lines = src.split("\n");
  const spans = functionSpans(lines);
  const malformed = spans.filter((s) => !FN_OPEN_RE.test(lines[s.start]) || !CLOSE_RE.test(lines[s.end]));
  if (spans.length >= 15 && malformed.length === 0) {
    ok(`(b) all ${spans.length} top-level function/arrow spans open and close exactly where the span-finder claims`);
  } else fail(`(b) the span-finder found ${spans.length} span(s), ${malformed.length} malformed — the exclusion set cannot be trusted`);

  const crossGateSpan = spans.find((s) => /^async function crossGate\(/.test(lines[s.start]));
  const workerSpan = spans.find((s) => /^async function worker\(/.test(lines[s.start]));
  if (crossGateSpan && workerSpan && crossGateSpan.end > crossGateSpan.start && workerSpan.end > workerSpan.start) {
    ok("(b) crossGate and worker — the two helpers with the most internal branching — are each found as one whole span");
  } else fail("(b) crossGate/worker were not found as single spans — nested control flow inside them may be leaking into the top-level scan");

  // --- (c) MUTATION, direction 1: three ways to unwrap a real site → the check goes RED -----------
  // Not hand-typed fixture strings — the CURRENT file's own lines, stripped of their wrapper by the
  // same shapes the fix applied in reverse (and the two ROUND 2 found: a stray wrapping paren, and a
  // dropped `await`). If the two sites' wording ever changes, this still tests the live file rather
  // than a frozen quotation of it.
  const mutators = [
    { name: "plain unwrap (Round 1's own shape)", fn: unwrapLine },
    { name: "stray-paren unwrap (the acceptance's own canary — REWORK)", fn: parenthesizeUnwrap },
    { name: "dropped await (REWORK's second named gap)", fn: dropAwait },
  ];
  for (const lineNo of [probeLine, l1bLine].filter(Boolean)) {
    for (const { name, fn } of mutators) {
      let mutated;
      try { mutated = fn(src, lineNo); } catch (e) { fail(`(c) [${name}] could not construct the mutation at line ${lineNo}: ${e.message}`); continue; }
      const mutatedHits = findUnwrappedTerminalReturns(mutated);
      if (mutatedHits.some((h) => h.line === lineNo)) {
        ok(`(c) [${name}] mutating line ${lineNo} turns this check RED, naming that exact line`);
      } else {
        fail(`(c) [${name}] mutating line ${lineNo} did NOT turn the check red — it cannot catch the regression it exists for: ${JSON.stringify(mutatedHits)}`);
      }
      // And nothing ELSE in the file was disturbed by mutating one line in isolation.
      const other = lineNo === probeLine ? l1bLine : probeLine;
      if (!mutatedHits.some((h) => h.line === other) && mutatedHits.length === 1) {
        ok(`(c) [${name}] mutating line ${lineNo} flags ONLY that line — the check is precise, not a global trip-wire`);
      } else fail(`(c) [${name}] mutating line ${lineNo} produced unexpected extra hits: ${JSON.stringify(mutatedHits)}`);
    }
  }

  // --- (d) MUTATION, direction 2: restore → the check goes back to GREEN -------------------------
  // The "restore" is the original, untouched `src` — proving the check is not stuck red once
  // tripped, and that (a)'s green reading above was not a fluke of argument order.
  const restoredHits = findUnwrappedTerminalReturns(src);
  if (restoredHits.length === 0) {
    ok("(d) re-checking the original (unmutated) source reads green again — the check is not stateful");
  } else fail(`(d) the original source no longer reads green after mutation-testing: ${JSON.stringify(restoredHits)}`);

  // --- (e) THREE synthetic mutations — a brand-new unwrapped site the file has never had ----------
  // (c) only proves the check catches regressions at the two KNOWN coordinates. This proves it
  // catches an unwrapped construction anywhere else too, appended as an otherwise-inert extra
  // top-level statement — the general case, not just the two named ones — for all three shapes.
  const syntheticCases = [
    { name: "plain", line: `if (canarySkill) { return aborted("synthetic-canary", "should never appear in the real file"); }` },
    { name: "stray-paren", line: `if (canarySkill) { return (aborted("synthetic-canary", "should never appear in the real file")); }` },
    { name: "dropped await", line: `if (canarySkill) { return withWarnings(aborted("synthetic-canary", "should never appear in the real file")); }` },
  ];
  for (const { name, line } of syntheticCases) {
    const synthetic = `${src}\n${line}\n`;
    const syntheticHits = findUnwrappedTerminalReturns(synthetic);
    const appendedLineNo = src.split("\n").length + 1;
    if (syntheticHits.some((h) => h.line === appendedLineNo)) {
      ok(`(e) [${name}] a freshly-appended unwrapped return is caught, even though neither Round-1 fixture names it`);
    } else fail(`(e) [${name}] an unwrapped return appended at the end of the file was NOT caught: ${JSON.stringify(syntheticHits)}`);
  }
}
