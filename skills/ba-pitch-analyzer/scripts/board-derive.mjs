#!/usr/bin/env node
// Board derivation (pure-skill architecture v1.0, plan §8.2).
//
// The mechanical half of the old ba-pitch-analyzer Phase 7b + v3.3 link-field rules — pure
// graph math a model should never re-derive (and could get wrong: KB-BA-001's 10 asymmetric
// edges came from hand-authored `unlocks`):
//
//   • `unlocks` = the depends_on inverse, recomputed over the WHOLE board (--write persists
//     it into task frontmatter — run on every ingest; asymmetric edges become impossible)
//   • Σ estimated_hours, package distribution, critical path (longest depends_on chain)
//   • Appetite Guard arithmetic (--appetite-hours N → overflow flag; the HAMMER *pause* on
//     overflow is an orchestrator gate, never resolved here)
//   • board-vs-T0 drift check (a FINISHED scope whose tasks still read `ready`) when scope
//     contracts name their tasks — flag, never fix
//
// Zero dependencies. Usage:
//   node skills/ba-pitch-analyzer/scripts/board-derive.mjs --slug <slug> [--cwd <dir>] [--write]
//        [--appetite-hours N]
// Prints a JSON report; exit 0 (drift/overflow are flags for the caller's gate, not errors).

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { isMain } from "../../tech-lead/scripts/lib/is-main.mjs";

/**
 * Read an inline `[a, b]` list field from a frontmatter string.
 * @param {string} fm - The frontmatter text.
 * @param {string} key - The list key to read.
 * @returns {string[]} The trimmed, unquoted, non-empty members; [] when the key is absent.
 */
const listField = (fm, key) =>
  (fm.match(new RegExp(`^${key}:\\s*\\[([^\\]]*)\\]`, "im")) || [, ""])[1]
    .split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);

/**
 * Parse every TASK-*.md in a board directory into structured task records.
 * @param {string} tasksDir - Absolute path to the LOCAL tasks directory.
 * @returns {Array<{file:string, id:string, type:string, status:string, hours:number, pkg:string,
 *   depends_on:string[], unlocks:string[], use_case_refs:string[], body:string}>} One record per
 *   task file; [] when the directory does not exist.
 */
export function parseBoard(tasksDir) {
  if (!existsSync(tasksDir)) return [];
  return readdirSync(tasksDir)
    .filter((f) => /^TASK-[\w.-]+\.md$/i.test(f))
    .map((f) => {
      const body = readFileSync(join(tasksDir, f), "utf8");
      const fm = (body.match(/^---\r?\n([\s\S]*?)\r?\n---/) || [, ""])[1];
      return {
        file: join(tasksDir, f),
        id: (fm.match(/^id:\s*(TASK-[\w.-]+)/im) || [])[1] || f.replace(/\.md$/, ""),
        type: (fm.match(/^type:\s*(\S+)/im) || [, ""])[1],
        status: (fm.match(/^status:\s*(\S+)/im) || [, "unknown"])[1],
        hours: Number((fm.match(/^estimated_hours:\s*([\d.]+)/im) || [])[1]) || 0,
        pkg: (fm.match(/^package:\s*(.+)$/im) || [, ""])[1].trim(),
        depends_on: listField(fm, "depends_on"),
        unlocks: listField(fm, "unlocks"),
        use_case_refs: listField(fm, "use_case_refs"),
        body,
      };
    });
}

/**
 * Compute `unlocks` as the inverse of `depends_on` over the whole board (never hand-authored).
 * @param {Array<{id:string, depends_on:string[]}>} tasks - The parsed board.
 * @returns {Object<string,string[]>} Map of task id → sorted ids it unlocks.
 */
export function deriveUnlocks(tasks) {
  const unlocks = Object.fromEntries(tasks.map((t) => [t.id, []]));
  for (const t of tasks) for (const dep of t.depends_on) if (unlocks[dep]) unlocks[dep].push(t.id);
  for (const id of Object.keys(unlocks)) unlocks[id].sort();
  return unlocks;
}

/**
 * Find the critical path: the depends_on chain with the greatest summed hours.
 * @param {Array<{id:string, depends_on:string[], hours:number}>} tasks - The parsed board.
 * @returns {{hours:number, chain:string[]}} The longest chain's total hours and its task ids in
 *   dependency order (cycles are guarded and contribute nothing).
 */
export function criticalPath(tasks) {
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const memo = {};
  /**
   * Longest depends_on chain rooted at a task, by summed hours (memoized, cycle-guarded).
   * @param {string} id - Task id to start from.
   * @param {Set<string>} [seen=new Set()] - Ids on the current DFS path (cycle guard); callers omit it.
   * @returns {{hours:number, chain:string[]}} The heaviest chain's total hours and its task ids in
   *   dependency order; {hours:0, chain:[]} for an unknown id or a detected cycle.
   */
  const longest = (id, seen = new Set()) => {
    if (memo[id]) return memo[id];
    if (seen.has(id)) return { hours: 0, chain: [] }; // cycle guard — lint reports it separately
    seen.add(id);
    const t = byId[id];
    if (!t) return { hours: 0, chain: [] };
    let best = { hours: 0, chain: [] };
    for (const dep of t.depends_on) {
      const c = longest(dep, seen);
      if (c.hours > best.hours) best = c;
    }
    return (memo[id] = { hours: best.hours + t.hours, chain: [...best.chain, id] });
  };
  let best = { hours: 0, chain: [] };
  for (const t of tasks) {
    const c = longest(t.id);
    if (c.hours > best.hours) best = c;
  }
  return best;
}

/**
 * Flag board-vs-T0 drift: FINISHED scopes whose named tasks are not yet done (flag only, never fix).
 * @param {Array<{id:string, status:string}>} tasks - The parsed board.
 * @param {Array<{scope_id:string, tasks?:string[], finished?:boolean}>} scopes - Scope facts.
 * @returns {Array<{scope_id:string, task_id:string, status:string}>} One entry per drifting task; [] when none.
 */
export function driftCheck(tasks, scopes) {
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const drift = [];
  for (const s of scopes) {
    if (!Array.isArray(s.tasks) || !s.finished) continue;
    for (const id of s.tasks) {
      const t = byId[id];
      if (t && t.status !== "done") drift.push({ scope_id: s.scope_id, task_id: id, status: t.status });
    }
  }
  return drift;
}

/**
 * Derive the full board report (unlocks, hours, packages, critical path, appetite overflow, drift).
 * @param {{cwd:string, slug:string, appetiteHours?:(number|null)}} opts - Working root, feature
 *   slug, and optional appetite budget (in hours) that drives the overflow flag.
 * @returns {object} The report: task_count, by_status, packages, total/keep hours, appetite
 *   overflow (or null), critical_path, unlocks + unlocks_stale, drift[], and `_tasks` (the parsed
 *   board, deleted before CLI output).
 */
export function derive({ cwd, slug, appetiteHours = null }) {
  const tasksDir = join(cwd, ".shapeup-sdlc", slug, "tasks");
  const tasks = parseBoard(tasksDir);
  const unlocks = deriveUnlocks(tasks);
  const keepHours = tasks.filter((t) => t.status !== "cut").reduce((a, t) => a + t.hours, 0);
  const packages = {};
  for (const t of tasks) packages[t.pkg || "(none)"] = (packages[t.pkg || "(none)"] || 0) + 1;

  // Scope facts for the drift check: contract `tasks` list + committed hill shard phase.
  const scopesDir = join(cwd, "docs", "shapeup-sdlc", slug, "scopes");
  const hillDir = join(cwd, "docs", "shapeup-sdlc", slug, "hill");
  const scopes = existsSync(scopesDir)
    ? readdirSync(scopesDir).filter((f) => f.endsWith(".json")).map((f) => {
        let c = {};
        try { c = JSON.parse(readFileSync(join(scopesDir, f), "utf8")); } catch { /* skip */ }
        const shard = join(hillDir, `${c.scope_id}.yml`);
        const finished = existsSync(shard) && /phase:\s*FINISHED/.test(readFileSync(shard, "utf8"));
        return { ...c, finished };
      })
    : [];

  return {
    slug,
    task_count: tasks.length,
    by_status: tasks.reduce((m, t) => ((m[t.status] = (m[t.status] || 0) + 1), m), {}),
    packages,
    total_hours: tasks.reduce((a, t) => a + t.hours, 0),
    keep_hours: keepHours,
    appetite: appetiteHours === null ? null : {
      appetite_hours: appetiteHours,
      overflow: keepHours > appetiteHours,
      overflow_hours: Math.max(0, keepHours - appetiteHours),
    },
    critical_path: criticalPath(tasks),
    unlocks,
    unlocks_stale: tasks.filter((t) => JSON.stringify([...t.unlocks].sort()) !== JSON.stringify(unlocks[t.id])).map((t) => t.id),
    drift: driftCheck(tasks, scopes),
    _tasks: tasks,
  };
}

/**
 * Persist derived `unlocks` into task frontmatter — the ONE write this script makes.
 * @param {{_tasks:Array<object>, unlocks:Object<string,string[]>}} report - A {@link derive} report.
 * @returns {string[]} The ids of task files actually rewritten (unchanged files are skipped).
 *   Side effect: writes those task files.
 */
export function writeUnlocks(report) {
  const written = [];
  for (const t of report._tasks) {
    const want = `[${report.unlocks[t.id].join(", ")}]`;
    const fmMatch = t.body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) continue;
    const fm = fmMatch[1];
    const next = /^unlocks:.*$/m.test(fm) ? fm.replace(/^unlocks:.*$/m, `unlocks: ${want}`) : `${fm}\nunlocks: ${want}`;
    if (next !== fm) {
      writeFileSync(t.file, t.body.replace(fm, next));
      written.push(t.id);
    }
  }
  return written;
}

const isMainModule = isMain(import.meta.url);
if (isMainModule) {
  const args = process.argv.slice(2);
  /**
   * Read a `--<n> <value>` CLI flag's value.
   * @param {string} n - Flag name without leading dashes.
   * @returns {(string|null)} The argument after `--<n>`, or null when the flag is absent.
   */
  const flag = (n) => { const i = args.indexOf(`--${n}`); return i !== -1 ? args[i + 1] : null; };
  const slug = flag("slug");
  if (!slug) { console.error("usage: board-derive.mjs --slug <slug> [--cwd <dir>] [--write] [--appetite-hours N]"); process.exit(2); }
  const cwd = resolve(flag("cwd") || process.cwd());
  const report = derive({ cwd, slug, appetiteHours: flag("appetite-hours") ? Number(flag("appetite-hours")) : null });
  if (args.includes("--write")) report.unlocks_written = writeUnlocks(report);
  delete report._tasks;
  console.log(JSON.stringify(report, null, 2));
}
