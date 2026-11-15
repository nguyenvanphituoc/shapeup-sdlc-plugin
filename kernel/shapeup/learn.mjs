// learn — applying what the reflector proposed to the rule table, through the kernel.
//
// The loop that reflects is the party the rules will later steer, so it does not get to write a rule by hand.
// `applyDelta` takes a list of operations, each naming the candidate it rests on; the candidate must be one
// the kernel verified against its own ledgers (`verifyCandidates`), a rule is minted with the id and the
// revision the format defines, a new one starts on probation, and the table is linted before the result is
// kept — a delta that leaves it red is undone, file by file, and says why.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, rmdirSync, appendFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { parseRule, idOf, slugOf, normalizeText } from "../core/rules.mjs";
import { READERS, loadRules, lintRules, renderRule } from "./kb.mjs";
import { verifyCandidates, DEFECT, runClasses, attemptsCost } from "./learning.mjs";
import { review } from "./probation.mjs";
import { knowledgeRulesDir, knowledgeBaseDir, learningIndex, readRunId } from "./paths.mjs";

const DEFECTS = (cwd) => join(knowledgeBaseDir(cwd), "harness-defects.md");

/** The next defect id: one past the highest `HD-NNN` the register names anywhere. */
function nextDefectId(text) {
  const n = [...text.matchAll(/\bHD-(\d+)\b/g)].map((m) => Number(m[1]));
  return `HD-${String((n.length ? Math.max(...n) : 0) + 1).padStart(3, "0")}`;
}

/**
 * Apply a delta. Every operation needs `from_candidate`, a verified candidate of this run — except that nothing
 * here may name a reader the table does not have, or a gate answer.
 * @param {{cwd: string, slug: string, delta: object[], date?: string}} a - The run and the operations.
 * @returns {{ok: boolean, applied: object[], problems: string[]}} What was done, or why nothing was.
 */
export function applyDelta({ cwd, slug, delta, date }) {
  const { kept } = verifyCandidates(cwd, slug);
  const byId = new Map(kept.map((c) => [c.id, c]));
  const undo = []; const applied = []; const problems = [];
  const before = new Map();
  const touch = (p) => { if (!before.has(p)) before.set(p, existsSync(p) ? readFileSync(p, "utf8") : null); };
  const day = date ?? new Date().toISOString().slice(0, 10);
  const find = (id) => loadRules(cwd).find((r) => r.meta.id === id && !r.errors.length);
  for (const op of Array.isArray(delta) ? delta : []) {
    const c = byId.get(op?.from_candidate);
    if (!c) { problems.push(`${op?.op ?? "?"}: "${op?.from_candidate}" is not a candidate the kernel verified for this run`); continue; }
    if (op.op === "ADD") {
      if (c.reader === DEFECT) { problems.push(`ADD: candidate ${c.id} is a harness-defect; file it with DEFECT`); continue; }
      const body = normalizeText(op.body ?? c.body ?? "");
      if (!body) { problems.push(`ADD: candidate ${c.id} has no body`); continue; }
      const reader = c.reader; const id = idOf(READERS[reader].code, body);
      // The same lesson filed again is not a new rule — and must not reset a promoted or retired one to probation.
      const have = find(id);
      if (have) { applied.push({ op: "ADD", id, skipped: `already filed as ${have.meta.status}`, candidate: c.id }); continue; }
      const p = join(knowledgeRulesDir(cwd), reader, `${id}.${slugOf(body)}.md`);
      touch(p); mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, renderRule({ id, reader, kind: op.kind ?? "guide", when: op.when ?? c.when ?? {}, targets: c.class, status: "probation" }, body));
      applied.push({ op: "ADD", id, file: relative(cwd, p), candidate: c.id });
    } else if (op.op === "EDIT" || op.op === "RETIRE" || op.op === "MERGE") {
      const ids = op.op === "MERGE" ? (op.ids ?? []) : [op.id];
      const rules = ids.map(find);
      if (!rules.length || rules.some((r) => !r)) { problems.push(`${op.op}: no such rule ${ids.join(", ")}`); continue; }
      if (rules.some((r) => !r.readers.includes(c.reader))) { problems.push(`${op.op}: candidate ${c.id} is for ${c.reader}, a rule it would change is not`); continue; }
      if (op.op === "RETIRE") {
        const r = rules[0]; touch(r.file);
        writeFileSync(r.file, renderRule({ ...r.meta, status: "retired" }, r.body));
        applied.push({ op: "RETIRE", id: r.meta.id, candidate: c.id });
      } else {
        const body = normalizeText(op.body ?? "");
        if (!body) { problems.push(`${op.op}: needs a body`); continue; }
        const keep = rules[0]; touch(keep.file);
        writeFileSync(keep.file, renderRule({ ...keep.meta, when: op.when ?? keep.meta.when ?? {} }, body));
        for (const r of rules.slice(1)) { touch(r.file); writeFileSync(r.file, renderRule({ ...r.meta, status: "retired", overrides: undefined }, r.body)); }
        applied.push({ op: op.op, id: keep.meta.id, merged: ids.slice(1), candidate: c.id });
      }
    } else if (op.op === "DEFECT") {
      if (c.reader !== DEFECT) { problems.push(`DEFECT: candidate ${c.id} is addressed to ${c.reader}, not harness-defect`); continue; }
      const p = DEFECTS(cwd); touch(p);
      const text = existsSync(p) ? readFileSync(p, "utf8") : "# Harness Defect Register\n\n> Filed by the reflector from a run's own ledgers. **Read by no worker** — drafted raw ideas for the Betting Table.\n\n## Defects\n\n";
      const id = nextDefectId(text);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, `${text.replace(/\s*$/, "\n")}\n- **${id}** — ${normalizeText(op.body ?? c.body ?? "")} Class: ${c.class}. · from \`${slug}\` (${day})\n`);
      applied.push({ op: "DEFECT", id, candidate: c.id });
    } else problems.push(`unknown operation "${op?.op}"`);
  }
  const lint = problems.length ? [] : lintRules(cwd);
  if (problems.length || lint.length) {
    const root = knowledgeRulesDir(cwd);
    for (const [p, text] of before) {
      if (text !== null) { writeFileSync(p, text); continue; }
      rmSync(p, { force: true });
      // A folder the undone delta created goes with it, so "nothing written" is true of the tree and not only of the files.
      for (let d = dirname(p); d.startsWith(root); d = dirname(d)) { try { rmdirSync(d); } catch { break; } }
    }
    return { ok: false, applied: [], problems: [...problems, ...lint.map((l) => `lint: ${l.file} [${l.rule}] ${l.message}`)] };
  }
  return { ok: true, applied, problems: [] };
}

/** The cross-run index row for a run that is closing — facts only, from the run's own ledgers. */
export function indexRow(cwd, slug, status) {
  return { schema_version: 1, run_id: readRunId(cwd, slug) ?? null, slug, at: new Date().toISOString(), status, classes: runClasses(cwd, slug), attempts_cost: attemptsCost(cwd, slug) };
}

/** Append the index row. Best effort: an index that cannot be written must never keep a run from ending. */
export function writeIndexRow(cwd, slug, status) {
  try {
    const p = learningIndex(cwd);
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(p, `${JSON.stringify(indexRow(cwd, slug, status))}\n`);
    return true;
  } catch { return false; }
}

/**
 * Apply the status changes a review found: promote, expire or retire — a change of the file's `status` and nothing
 * else. A retirement because the class came back is also a defect: the rule did not hold, which is a fact about the
 * harness or the rule, and it goes to the register with an id.
 * @returns {{ok: boolean, applied: object[], problems: string[]}} The changes made.
 */
export function applyReview({ cwd, slug, date }) {
  const day = date ?? new Date().toISOString().slice(0, 10);
  const applied = [];
  for (const d of review(cwd, slug)) {
    if (!d.to) continue;
    const r = loadRules(cwd).find((x) => x.meta.id === d.id && !x.errors.length);
    if (!r) continue;
    writeFileSync(r.file, renderRule({ ...r.meta, status: d.to }, r.body));
    const row = { op: d.to === "active" ? "PROMOTE" : d.to === "expired" ? "EXPIRE" : "RETIRE", id: d.id, why: d.why };
    if (d.to === "retired") {
      const p = DEFECTS(cwd); const text = existsSync(p) ? readFileSync(p, "utf8") : "# Harness Defect Register\n\n> Read by no worker.\n\n## Defects\n\n";
      const id = nextDefectId(text); mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, `${text.replace(/\s*$/, "\n")}\n- **${id}** — Rule ${d.id} did not hold: ${d.why}. Class: ${d.targets}. · from \`${slug}\` (${day})\n`);
      row.defect = id;
    }
    applied.push(row);
  }
  const bad = lintRules(cwd);
  return { ok: bad.length === 0, applied, problems: bad.map((l) => `lint: ${l.file} [${l.rule}] ${l.message}`) };
}
