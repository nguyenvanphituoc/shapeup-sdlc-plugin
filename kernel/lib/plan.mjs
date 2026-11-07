// The planning activity's vocabulary, in one place — what a `plan` order is addressed to and what
// each of its substeps must leave behind.
//
// WHY THIS IS A MODULE. Planning used to be three workers; it is now four substeps the loop does in
// its own context, and what is left of the old envelope is a FENCE: a `plan` order the compiler
// stamps with the substep's write contract and `reduce ingest --close-plan` answers. Three callers
// need the same facts — `compile` (which substrate for which substep), `ingest` (what "the artifact
// is there" means when it closes the order) and `probe next` (what the loop must produce before it
// may close) — and a predicate written three times is how a phase gets recorded complete over an
// artifact that is not on disk.
//
// "COMPLETE" IS ASKED OF THE FILES, never of the order. A close that finds nothing is not refused (a
// refused close would leave the fence up with nobody to lift it); it records a `failed` result that
// names the missing artifact, so the leg row exists, the fence lifts, and the next step reports the
// real reason.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  requirements, wiringMap, scopesDir, usecasesDir, tasksDir, sharedRoot, relShared, relLocal, relKnowledgeBase,
  legLedger, resultsDir,
} from "./paths.mjs";
import { hasSpecTree, hasBoard } from "../probe/resume.mjs";

/** The substeps, in the order the loop does them. The order stem is `plan-<step>`. */
export const PLAN_STEPS = ["requirements", "spec", "wire", "scopes"];

/**
 * How a `spec` substep is scoped. `full` writes the tree and the board; `board-only` regenerates the
 * per-machine board from a committed tree that is frozen; `reconcile` folds discovered items in
 * (append-only to the invariants and Test Surface); `retrofit-surface` appends the Test Surface to a
 * spec that predates it. Each is a different write contract on the same substep.
 */
export const SPEC_MODES = ["full", "board-only", "reconcile", "retrofit-surface"];

/**
 * The knowledge-base files the plan activity reads, by the name they were filed under. `plan` is the
 * activity's own name and where new rules are written; the other three are what the activity's
 * parts were called before the fold, and a consumer's existing files keep their rules.
 */
export const PLAN_GUIDANCE = ["plan", "ba-pitch-analyzer", "scope-architect", "solution-architect"];

/**
 * The same, as the repo-relative paths a `plan` order carries in `payload.kb_rules_paths`.
 * @returns {string[]} One path per guidance name, whether or not the file exists.
 */
export const planGuidancePaths = () => PLAN_GUIDANCE.map((n) => relKnowledgeBase(n));

/**
 * Is a substep's artifact on disk? The ONE reading of "complete" for planning.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} step - One of {@link PLAN_STEPS}.
 * @param {string|null} [specFolder] - The ledger's `spec_folder`, when it names a non-default one.
 * @returns {boolean} True when the substep left what it must.
 */
export function planStepSatisfied(cwd, slug, step, specFolder = null) {
  switch (step) {
    case "requirements": return existsSync(requirements(cwd, slug));
    case "spec": return hasSpecTree(cwd, slug, specFolder) && hasBoard(cwd, slug);
    case "wire": return existsSync(wiringMap(cwd, slug));
    case "scopes": return scopeFiles(cwd, slug).length > 0;
    default: return false;
  }
}

/** The scope contracts on disk, by file name. */
function scopeFiles(cwd, slug) {
  try { return readdirSync(scopesDir(cwd, slug)).filter((f) => f.endsWith(".md")).sort(); } catch { return []; }
}

/**
 * The repo-relative paths a substep's artifact consists of, as they stand on disk.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} step - One of {@link PLAN_STEPS}.
 * @returns {string[]} Existing artifact paths; empty when the substep left nothing.
 */
export function planArtifacts(cwd, slug, step) {
  const files = (dir, rel, test) => { try { return readdirSync(dir).filter(test).sort().map((f) => rel(f)); } catch { return []; } };
  switch (step) {
    case "requirements": return existsSync(requirements(cwd, slug)) ? [relShared(slug, "requirements.md")] : [];
    case "spec":
      return [
        ...files(usecasesDir(cwd, slug), (f) => relShared(slug, "spec", "usecases", f), (f) => f.endsWith(".md") && f !== "_index.md"),
        ...files(tasksDir(cwd, slug), (f) => relLocal(slug, "tasks", f), (f) => /^TASK-[\w.-]+\.md$/i.test(f)),
      ];
    case "wire": return existsSync(wiringMap(cwd, slug)) ? [relShared(slug, "wiring-map.md")] : [];
    case "scopes":
      return [
        ...scopeFiles(cwd, slug).map((f) => relShared(slug, "scopes", f)),
        ...(existsSync(join(sharedRoot(cwd, slug), "scope-board.md")) ? [relShared(slug, "scope-board.md")] : []),
      ];
    default: return [];
  }
}

/**
 * The artifact a substep must leave, named for a message.
 * @param {string} step - One of {@link PLAN_STEPS}.
 * @param {string} slug - Feature slug.
 * @returns {string} Human-readable, repo-relative.
 */
export function planProduces(step, slug) {
  switch (step) {
    case "requirements": return relShared(slug, "requirements.md");
    case "spec": return `${relShared(slug, "spec", "usecases", "*.md")} and ${relLocal(slug, "tasks", "TASK-*.md")}`;
    case "wire": return relShared(slug, "wiring-map.md");
    case "scopes": return relShared(slug, "scopes", "*.md");
    default: return "";
  }
}

/**
 * Where a `plan` order stands, read off the files — never off a counter.
 *
 * A plan order has no dispatch receipt (nothing is dispatched), so "how many times has this been
 * tried" cannot be a receipt count, and the order's FILE is rewritten by every re-open: the same name
 * and the same result path, a newer `compiled_at`. `compile` retires the previous opening's result
 * when it re-opens the order, so a result file on disk is always THIS opening's. What separates a
 * close of this opening from a close of an earlier one is then the leg ledger asked against the
 * order's own stamp:
 *   `result`  — this opening has a result file.
 *   `closed`  — a leg row for this order was written at or after it was compiled: the single writer
 *               applied an answer to THIS opening.
 *   `closes`  — how many leg rows the order id has in all: what a "sent back once" rule counts.
 * An order with no parseable stamp falls back to any row, which is all it ever had.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {object} order - The parsed `plan` order.
 * @returns {{closed:boolean, result:boolean, closes:number}} The three facts.
 */
export function planOrderFacts(cwd, slug, order) {
  const stamp = Date.parse(order?.compiled_at ?? "");
  const stem = String(order?.order_id ?? "").split("/").slice(1).join("/");
  let rows = [];
  try {
    rows = readFileSync(legLedger(cwd, slug), "utf8").split("\n").filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((r) => r && r.order_id === order?.order_id && r.ingested_at);
  } catch { /* no ledger yet */ }
  return {
    closed: rows.some((r) => Number.isNaN(stamp) || Date.parse(r.ingested_at) >= stamp),
    result: existsSync(join(resultsDir(cwd, slug), `${stem}.json`)),
    closes: rows.length,
  };
}
