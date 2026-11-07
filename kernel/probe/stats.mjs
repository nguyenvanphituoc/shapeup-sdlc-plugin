#!/usr/bin/env node
// Stats — the hook-ledger reader: `probe stats --hooks`.
//
// Every hook evaluation appends a row to `.shapeup/decisions.jsonl` (hooks/lib/decision.mjs), so a
// hook that sat inert and a hook that inspected-and-permitted are separable facts. This is the one
// reader of that ledger: per hook, how many evaluations, how many were allowed, denied, blocked or
// errored, and which rules fired — plus any ledger a hook filed OUTSIDE the project root, whose rows
// the count above would otherwise silently omit. It is also how an evaluation that ran over a
// non-green board is countable, because that verdict is recorded as a `warn` row.
//
// Hard rules: READ-ONLY (the ledger stays the single source of truth), FACTS ONLY (counts, never a
// grade — a score here would be a second judge), and fail-open per row (a malformed line is skipped,
// never fatal).
//
// Usage: node `harness probe stats --hooks` [--cwd <dir>] [--format json|table]

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join, relative, sep } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import { decisions as decisionsPath } from "../lib/paths.mjs";

/**
 * `--hooks` — do the enforcement points actually fire?
 *
 * For a hook, "never had to fire" and "never ran" used to produce the same evidence: exit 0,
 * empty stdout. With a decision row per evaluation, a hook that sat inert and a hook that
 * inspected-and-permitted become SEPARABLE FACTS rather than the same blank.
 *
 * @param {Array<object>} decisions - Rows from `.shapeup/decisions.jsonl`.
 * @returns {{evaluations:number, hooks:number, per_hook:Array<object>}} Per-hook fire, allow, deny,
 *   block and error counts, plus the rules that fired.
 */
export function hooksReport(decisions) {
  const byHook = new Map();
  for (const d of decisions || []) {
    const name = d.hook || "unknown";
    if (!byHook.has(name)) byHook.set(name, { hook: name, evaluations: 0, allow: 0, deny: 0, block: 0, error: 0, rules: {} });
    const h = byHook.get(name);
    h.evaluations++;
    if (h[d.verdict] !== undefined) h[d.verdict]++;
    if (d.rule) h.rules[d.rule] = (h.rules[d.rule] || 0) + 1;
  }
  const per_hook = [...byHook.values()].sort((a, b) => a.hook.localeCompare(b.hook));
  return { evaluations: (decisions || []).length, hooks: per_hook.length, per_hook };
}

/**
 * Read the checkout-wide decision ledger.
 * @param {string} cwd - Project root.
 * @returns {Array<object>} Decision rows; [] when no hook has ever recorded one.
 */
export function readDecisions(cwd) {
  const p = decisionsPath(cwd);
  if (!existsSync(p)) return [];
  try {
    return readFileSync(p, "utf8").split("\n").filter((l) => l.trim())
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

/**
 * Decision ledgers that landed OUTSIDE the project root — the trace a hook left when it filed
 * under the shell's working directory instead of the project's.
 *
 * The hooks now resolve the root themselves, so a stray is either history from before that fix or
 * evidence the resolver missed a layout; either way the rows in it are missing from the ledger
 * `--hooks` reads, and a count that silently omits them is the inert-layer signature this report
 * exists to expose. Bounded walk: depth-limited, skipping dependency and VCS directories.
 *
 * @param {string} cwd - Project root.
 * @param {number} [maxDepth=8] - How deep to look.
 * @returns {Array<{path:string, rows:number}>} Each stray ledger and its row count.
 */
export function strayLedgers(cwd, maxDepth = 8) {
  const SKIP = new Set(["node_modules", ".git", ".hg", ".svn", ".hvigor", ".idea", "dist", "build", "target", ".next", ".cache"]);
  const out = [];
  const home = decisionsPath(cwd);
  /**
   * Visit one directory level.
   * @param {string} dir - Directory to scan.
   * @param {number} depth - Its depth below `cwd`.
   * @returns {void}
   */
  const walk = (dir, depth) => {
    if (depth > maxDepth) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory() || SKIP.has(e.name)) continue;
      const sub = join(dir, e.name);
      const candidate = decisionsPath(sub);
      if (candidate !== home && existsSync(candidate)) {
        let rows = 0;
        try { rows = readFileSync(candidate, "utf8").split("\n").filter((l) => l.trim()).length; } catch { /* unreadable */ }
        out.push({ path: relative(cwd, candidate).split(sep).join("/"), rows });
      }
      walk(sub, depth + 1);
    }
  };
  walk(cwd, 1);
  return out;
}

// --- CLI -----------------------------------------------------------------------

/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs probe stats --hooks [--cwd <dir>] [--format json|table]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  cwd: { type: "path" },
  format: { type: "enum", values: ["json", "table"], default: "json" },
  hooks: { type: "flag" },
};

/**
 * Render the hook report as text.
 * @param {object} r - Output of {@link hooksReport}.
 * @returns {string} The multi-line report.
 */
function renderHooks(r) {
  const lines = [`hooks: ${r.evaluations} evaluation(s) across ${r.hooks} hook(s)`, ""];
  lines.push("hook                      evals  allow  deny  block  error");
  for (const h of r.per_hook) {
    lines.push(`${h.hook.padEnd(26)}${String(h.evaluations).padEnd(7)}${String(h.allow).padEnd(7)}` +
      `${String(h.deny).padEnd(6)}${String(h.block).padEnd(7)}${h.error}`);
  }
  if (r.evaluations === 0) {
    lines.push("", "(zero rows: either no hook has run in this checkout, or the enforcement layer is inert —");
    lines.push(" and that distinction is exactly what this ledger exists to make.)");
  }
  if (Array.isArray(r.stray_ledgers) && r.stray_ledgers.length) {
    lines.push("", `stray ledgers: ${r.stray_ledgers.length} decisions.jsonl outside the project root — rows not counted above:`);
    for (const s of r.stray_ledgers) lines.push(`  ${s.path}  (${s.rows} row(s))`);
  }
  return lines.join("\n");
}

/**
 * Report the hook decision ledger.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {void} Writes the report and exits 0; exits 2 when `--hooks` is not given, because the
 *   hook ledger is the only thing this subcommand reads and a silent default would hide that.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  if (!args.hooks) {
    process.stderr.write(JSON.stringify({ error: "missing_required", flag: "--hooks",
      expected: "probe stats reads the hook decision ledger; pass --hooks" }) + "\n");
    process.stderr.write(`usage: ${ARGV_SPEC.usage}\n`);
    process.exit(2);
  }
  const cwd = resolve(args.cwd || process.cwd());
  const out = { hooks: { ...hooksReport(readDecisions(cwd)), stray_ledgers: strayLedgers(cwd) } };
  console.log(args.format === "table" ? renderHooks(out.hooks) : JSON.stringify(out, null, 2));
  process.exit(0);
}
