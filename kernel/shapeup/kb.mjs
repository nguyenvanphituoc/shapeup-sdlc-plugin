// kb — the rule table: Shape Up's readers, the keys a rule's `when` may name, the lint, the migration of
// the old one-file-per-reader layout, and the selector that turns an order into the rules it loads.
//
// WHY THE KERNEL CHOOSES. A reader that loads a whole file loads every rule in it for every order, and a
// prose instruction to "read what applies" is a decision made by the party the rule steers. The kernel
// reads the order, applies each rule's `when`, stays inside a token budget and writes down what it
// chose — so which rules a dispatch had is a fact on a record rather than a recollection.
//
// A RULE STEERS CRAFT AND NOTHING ELSE. It never decides a gate: lint refuses a body that tells a gate
// what to answer, and a rule for the judge or the census is refused outright.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { parseRule, normalizeText, revOf, idOf, slugOf, canonicalWhen, whenMatches, specificity, tokensOf, sha } from "../core/rules.mjs";
import { SCHEMAS_DIR } from "../verify/envelope.mjs";
import { GATE_IDS } from "./gates.mjs";
import { knowledgeBaseDir, knowledgeRulesDir, kbCompiledDir, projectProfile } from "./paths.mjs";
import { checkNames, paramProblems } from "./checks.mjs";
import { signalsFor } from "./signals.mjs";

/** reader → its short code and the file names a consumer may still have it under. */
export const READERS = {
  "task-executor": { code: "te", legacy: ["task-executor"] },
  "orient": { code: "or", legacy: ["orient"] },
  "qa-edge-hunter": { code: "qa", legacy: ["qa-edge-hunter"] },
  "plan": { code: "pl", legacy: ["plan", "ba-pitch-analyzer", "scope-architect", "solution-architect"] },
  "building": { code: "bu", legacy: ["building", "tech-lead"] },
};
export const SHARED_DIR = "_shared";
export const KINDS = ["guide", "check", "ask"];
export const STATUSES = ["active", "probation", "retired", "expired"];
/** The default token budget for one order's compiled file. */
export const DEFAULT_BUDGET = 2000;
/** A body longer than this reads as an essay, and an essay is not loaded twice. */
export const MAX_BODY_WORDS = 140;

const schema = () => JSON.parse(readFileSync(join(SCHEMAS_DIR, "domain.schema.json"), "utf8"));

/**
 * The keys a rule's `when` may name, each with the values it may take — read off the schema's own enums and
 * the gate table, so a value cannot be valid here and unknown to the thing that emits it.
 * @returns {Object<string, string[]>} key → allowed values.
 */
export function whenKeys() {
  const d = schema().$defs;
  return {
    operation: d.Operation.enum,
    step: d.WorkOrderPayload.properties.step.enum,
    archetype: d.ProjectProfile.properties.archetype.enum,
    topology_type: d.ScopeContract.properties.topology_type.enum,
    gate: GATE_IDS,
    signal: d.KbSignal?.enum ?? [],
  };
}

/** Render a rule file. Field order is fixed so the same rule is the same bytes. */
export function renderRule(meta, body) {
  const lines = ["---", `id: ${meta.id}`, `reader: ${meta.reader}`, `kind: ${meta.kind ?? "guide"}`, `when: ${canonicalWhen(meta.when ?? {})}`, `status: ${meta.status ?? "active"}`];
  if (meta.targets) lines.push(`targets: ${meta.targets}`);
  if (meta.check) lines.push(`check: ${meta.check}`);
  if (meta.params) lines.push(`params: ${JSON.stringify(meta.params)}`);
  if (meta.overrides?.length) lines.push(`overrides: ${JSON.stringify(meta.overrides)}`);
  if (meta.aliases?.length) lines.push(`aliases: ${JSON.stringify(meta.aliases)}`);
  lines.push("---", "", normalizeText(body), "");
  return lines.join("\n");
}

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else if (e.name.endsWith(".md")) acc.push(p);
  }
  return acc;
};

/** Every rule file under the rule table, parsed. A file that does not parse is returned with its errors, never skipped. */
export function loadRules(cwd) {
  const root = knowledgeRulesDir(cwd);
  return walk(root).map((file) => {
    const rel = relative(root, file).split("\\").join("/");
    const { meta, body, errors } = parseRule(readFileSync(file, "utf8"));
    const readers = [].concat(meta.reader ?? []).map((r) => String(r).trim()).filter(Boolean);
    return { file, rel, dir: rel.split("/")[0], meta, body, errors, readers, rev: errors.length ? null : revOf({ reader: readers, kind: meta.kind ?? "guide", when: meta.when ?? {}, body }) };
  });
}

/** Whether a reader has been migrated to the rule table (its folder exists, or `_shared` carries a rule for it). */
export const hasTable = (cwd, reader) => existsSync(join(knowledgeRulesDir(cwd), reader)) || loadRules(cwd).some((r) => r.dir === SHARED_DIR && r.readers.includes(reader));

const IMPERATIVE_GATE = /\b(?:always|must|never|should)?\s*(?:answer|resolve|decide|say|reply|choose|pick)\s+["'`]?(proceed|ship|skip|abort|loop|stop|run|hold|accept-cut-list|ship-all)\b/i;
const SHELL_LINE = /^\s*(?:\$\s|(?:npm|npx|node|git|curl|rm|cd)\s)/m;

/**
 * Lint the rule table. Every finding names its file and says what to change.
 * @param {string} cwd - Project root.
 * @returns {{file: string, rule: string, message: string}[]} The problems; empty means clean.
 */
export function lintRules(cwd) {
  const out = []; const keys = whenKeys(); const rules = loadRules(cwd);
  const add = (r, rule, message) => out.push({ file: r.rel, rule, message });
  const byId = new Map(); const byRev = new Map(); const sigCount = new Map();
  const checks = new Set(checkNames());
  for (const r of rules) {
    for (const e of r.errors) add(r, "frontmatter", `${e} — a rule whose frontmatter is broken is refused, not loaded as one that applies everywhere`);
    if (r.errors.length) continue;
    const m = r.meta;
    if (!m.id) add(r, "id", "missing id"); else { if (byId.has(m.id)) add(r, "id-duplicate", `id ${m.id} is also in ${byId.get(m.id)}`); byId.set(m.id, r.rel); }
    if (!r.readers.length) add(r, "reader", "missing reader");
    for (const rd of r.readers) if (!READERS[rd]) add(r, "reader", `reader "${rd}" is not one that reads rules (${Object.keys(READERS).join(", ")}) — the judge and the census are not coachable`);
    const okDir = r.readers.length === 1 ? r.dir === r.readers[0] : r.dir === SHARED_DIR;
    if (r.readers.length && !okDir) add(r, "location", r.readers.length === 1 ? `a rule for ${r.readers[0]} lives under ${r.readers[0]}/` : `a rule for several readers lives under ${SHARED_DIR}/`);
    if (!KINDS.includes(m.kind ?? "guide")) add(r, "kind", `kind "${m.kind}" is not one of ${KINDS.join(", ")}`);
    if (!STATUSES.includes(m.status)) add(r, "status", `status "${m.status}" is not one of ${STATUSES.join(", ")}`);
    const when = m.when ?? {};
    if (typeof when !== "object" || Array.isArray(when)) add(r, "when", "`when` must be a JSON object");
    else for (const [k, v] of Object.entries(when)) {
      if (!(k in keys)) { add(r, "when-key", `"${k}" is not a key a rule may condition on (${Object.keys(keys).join(", ")})`); continue; }
      for (const val of [].concat(v)) if (!keys[k].includes(String(val))) add(r, "when-value", `"${val}" is not a value of ${k} (${keys[k].join(", ")}) — nothing would ever emit it`);
    }
    if (m.id && r.rel.split("/").pop().split(".")[0] !== m.id) add(r, "filename", `the file name starts with the id: ${m.id}.<slug>.md`);
    if (r.rev) { if (byRev.has(r.rev)) add(r, "rev-duplicate", `says the same thing as ${byRev.get(r.rev)} (same reader, kind, when and body)`); byRev.set(r.rev, r.rel); }
    if (m.status === "active" && (m.kind ?? "guide") !== "check") { const sig = `${r.readers.join(",")}|${canonicalWhen(when)}`; sigCount.set(sig, (sigCount.get(sig) ?? 0) + 1); if (sigCount.get(sig) === 4) add(r, "crowded", "more than 3 active rules share one reader and one `when` — merge them or narrow one"); }
    const words = r.body.split(/\s+/).filter(Boolean).length;
    if (words > MAX_BODY_WORDS) add(r, "long", `${words} words; keep a rule to about ${MAX_BODY_WORDS} or split it`);
    if (/\.shapeup\//.test(r.body) || /\bTASK-\d+/.test(r.body)) add(r, "tier", "a rule is committed: it cannot name a run-trace path or a board id, which resolve only where they were written");
    if (/https?:\/\//.test(r.body)) add(r, "url", "a rule carries no URL — it would be read as a source and followed");
    if (SHELL_LINE.test(r.body)) add(r, "shell", "a rule carries no shell command — a command is not guidance, and a pasted one gets run");
    if (IMPERATIVE_GATE.test(r.body)) add(r, "gate-answer", "a rule never tells a gate what to answer; it may add a question or a check to a gate");
    if (m.kind === "check") { if (!m.check || !checks.has(m.check)) add(r, "check-name", `check "${m.check ?? ""}" is not in the registry (${[...checks].join(", ") || "empty"}); a new check arrives only with a release`); }
    else if (m.check) add(r, "check-name", "only a rule of kind check names a check");
    if (m.kind === "check" && m.check && checks.has(m.check)) for (const e of paramProblems(m.check, m.params)) add(r, "check-params", e);
    if (m.kind === "check" && r.body.split(/\s+/).filter(Boolean).length > 30) add(r, "check-body", "a check carries no code and needs no essay: its body is a short note on why it exists");
    if (m.targets && !(keys.signal ?? []).includes(m.targets)) add(r, "targets", `targets "${m.targets}" is not a failure class of the vocabulary — nothing could show the rule worked`);
    for (const o of m.overrides ?? []) if (o === m.id) add(r, "overrides", "a rule cannot override itself");
  }
  return out;
}

const LEGACY_RULE = /^- \*\*(KB-[A-Z]+-\d+)\*\*\s*[—-]\s*([\s\S]*?)(?=^- \*\*KB-|\n## |\n# |$(?![\s\S]))/gm;

/**
 * Split the old per-reader files into one rule file each. Idempotent: a rule whose old id is already an
 * alias is skipped, and no old file is touched.
 * @param {string} cwd - Project root.
 * @returns {{created: string[], skipped: string[]}} Relative paths of what was written and which old ids were already present.
 */
export function migrateRules(cwd) {
  const have = new Set(loadRules(cwd).flatMap((r) => r.meta.aliases ?? []));
  const created = []; const skipped = [];
  for (const [reader, { code, legacy }] of Object.entries(READERS)) {
    for (const name of legacy) {
      const f = join(knowledgeBaseDir(cwd), `${name}.md`);
      if (!existsSync(f)) continue;
      const text = readFileSync(f, "utf8").replace(/\r\n?/g, "\n");
      for (const m of text.matchAll(LEGACY_RULE)) {
        const alias = m[1];
        const body = normalizeText(m[2].replace(/\s*·\s*from\s+`[^`]*`.*$/s, "").replace(/\n[ \t]+/g, "\n"));
        if (have.has(alias)) { skipped.push(alias); continue; }
        const id = idOf(code, body);
        const out = join(knowledgeRulesDir(cwd), reader, `${id}.${slugOf(body)}.md`);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, renderRule({ id, reader, kind: "guide", when: {}, status: "active", aliases: [alias] }, body));
        have.add(alias); created.push(relative(cwd, out).split("\\").join("/"));
      }
    }
  }
  return { created, skipped };
}

const title = (body) => body.split(/\s+/).slice(0, 8).join(" ");

/**
 * Choose the rules an order loads. Deterministic: the same rules and the same facts give the same set,
 * in the same order, to the byte.
 * @param {{cwd: string, reader: string, facts: Object<string,string[]>, budget?: number}} q - What to choose for.
 * @returns {{load_set: string[], text: string, entries: object[], over_budget: object[], checks: object[], asks: object[], dropped: string[]}} The choice.
 */
export function selectRules({ cwd, reader, facts, budget = DEFAULT_BUDGET }) {
  const all = loadRules(cwd).filter((r) => !r.errors.length && r.readers.includes(reader));
  const live = all.filter((r) => !["retired", "expired"].includes(r.meta.status));
  const matched = live.filter((r) => whenMatches(r.meta.when ?? {}, facts));
  const overridden = new Set(matched.flatMap((r) => r.meta.overrides ?? []));
  const kept = matched.filter((r) => !overridden.has(r.meta.id));
  const kind = (r) => r.meta.kind ?? "guide";
  const checks = kept.filter((r) => kind(r) === "check").map((r) => ({ id: r.meta.id, check: r.meta.check, params: r.meta.params ?? {}, rev: r.rev }));
  const asks = kept.filter((r) => kind(r) === "ask");
  const rank = (a, b) => specificity(b.meta.when) - specificity(a.meta.when)
    || (a.meta.status === "active" ? 0 : 1) - (b.meta.status === "active" ? 0 : 1) || a.meta.id.localeCompare(b.meta.id);
  const guides = kept.filter((r) => kind(r) === "guide").sort(rank);
  const entries = []; const over = []; let used = 0;
  for (const r of guides) {
    const line = `- **${r.meta.id}** — ${r.body.replace(/\n+/g, " ")}`;
    const t = tokensOf(line);
    if (used + t > budget) { over.push({ id: r.meta.id, title: title(r.body) }); continue; }
    used += t; entries.push({ id: r.meta.id, rev: r.rev, line });
  }
  const load_set = [...entries.map((e) => e.rev), ...asks.map((r) => r.rev), ...checks.map((c) => c.rev)].sort();
  // A check that finds nothing adds nothing: the compiled file names only the rules that are text in it.
  const head = [`<!-- load_set: ${[...entries.map((e) => e.rev), ...asks.map((r) => r.rev)].sort().join(",")} -->`];
  if (over.length) head.push(`<!-- over_budget (not loaded): ${over.map((o) => `${o.id} "${o.title}"`).join("; ")} -->`);
  const askText = asks.length ? ["", "## Questions to put to the gate", ...asks.map((r) => `- **${r.meta.id}** — ${r.body.replace(/\n+/g, " ")}`)] : [];
  const text = [...head, `# Rules for ${reader}`, "", ...entries.map((e) => e.line), ...askText, ""].join("\n");
  return { load_set, text, entries, over_budget: over, checks, asks: asks.map((r) => ({ id: r.meta.id, rev: r.rev })), dropped: [...overridden] };
}

/** Write a choice's compiled file, named by the set it holds; reuse it when it is already there. */
export function compile(cwd, reader, choice) {
  const name = `${reader}-${sha(`${reader}\n${choice.load_set.join(",")}\n${choice.text}`).slice(0, 12)}.md`;
  const p = join(kbCompiledDir(cwd), name);
  if (!existsSync(p)) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, choice.text); }
  return p;
}

/** The reader an order's worker reads as, or null when the worker reads no rules (the judge). */
export function readerOf(order) {
  if (order?.worker === "building") return order.payload?.step ? "plan" : null;
  return READERS[order?.worker] && order.worker !== "plan" && order.worker !== "building" ? order.worker : null;
}

/** The archetype the project profile declares, or null — read as a fact, never required. */
export function archetypeOf(cwd, slug) {
  try { return /^archetype:\s*["']?([a-z-]+)/m.exec(readFileSync(projectProfile(cwd, slug), "utf8"))?.[1] ?? null; } catch { return null; }
}

/**
 * The facts an order exposes to a rule's `when`. Only what the order or the project already states: a key
 * the order cannot supply is absent, and a rule conditioned on it does not load.
 */
export function factsOf(cwd, slug, order, extra = {}) {
  const f = {};
  if (order.operation) f.operation = [order.operation];
  if (order.payload?.step) f.step = [order.payload.step];
  const a = archetypeOf(cwd, slug); if (a) f.archetype = [a];
  for (const [k, v] of Object.entries(extra)) if (v?.length) f[k] = [...(f[k] ?? []), ...v];
  return f;
}

/**
 * Choose the rules an order loads and point the order at them. Called by `order open`, before the order is
 * validated and armed, so what the worker is told to read is what the receipt will say it had.
 *
 * With no rule table for the reader the order is left as it was — the legacy file is read, and one line says so.
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {object} order - The parsed order; mutated.
 * @param {{budget?: number, signals?: string[]}} [opt] - Budget and the order's signals.
 * @returns {{reader: (string|null), applied: boolean, load_set: string[], checks: object[]}} What was done.
 */
export function applyToOrder(cwd, slug, order, opt = {}) {
  const reader = readerOf(order);
  if (!reader) return { reader: null, applied: false, load_set: [], checks: [] };
  if (!hasTable(cwd, reader)) {
    // Said only when there is a legacy file to be read: a project with no knowledge base has nothing to announce.
    if (READERS[reader].legacy.some((n) => existsSync(join(knowledgeBaseDir(cwd), `${n}.md`)))) console.error(`kb: no rule table for ${reader} — its legacy file is read as before`);
    return { reader, applied: false, load_set: [], checks: [] };
  }
  const choice = selectRules({ cwd, reader, facts: factsOf(cwd, slug, order, { signal: opt.signals ?? signalsFor(cwd, slug, order) }), budget: opt.budget ?? DEFAULT_BUDGET });
  order.payload = order.payload ?? {};
  const plural = reader === "plan";
  delete order.payload.kb_rules_path; delete order.payload.kb_rules_paths;
  if (choice.entries.length || choice.asks.length) {
    const rel = relative(cwd, compile(cwd, reader, choice)).split("\\").join("/");
    if (plural) order.payload.kb_rules_paths = [rel]; else order.payload.kb_rules_path = rel;
  }
  order.payload.kb_load_set = choice.load_set;
  return { reader, applied: true, load_set: choice.load_set, checks: choice.checks };
}

/**
 * The loop's own rules, compiled once per run: a general section, then one section per gate a rule is
 * conditioned on. `building` is never dispatched, so it has no order to carry a load set; the launch
 * record carries it instead, and the gate agent reads the section of the gate it is answering.
 */
export function compileBuilding(cwd) {
  if (!hasTable(cwd, "building")) return null;
  const rules = loadRules(cwd).filter((r) => !r.errors.length && r.readers.includes("building") && !["retired", "expired"].includes(r.meta.status));
  const sections = [["general", rules.filter((r) => !r.meta.when?.gate)], ...GATE_IDS.map((g) => [g, rules.filter((r) => whenMatches(r.meta.when ?? {}, { gate: [g] }) && r.meta.when?.gate)])];
  const load_set = [...new Set(rules.map((r) => r.rev))].sort();
  const body = sections.filter(([, rs]) => rs.length).map(([name, rs]) => `## ${name}\n\n${rs.sort((a, b) => a.meta.id.localeCompare(b.meta.id)).map((r) => `- **${r.meta.id}** — ${r.body.replace(/\n+/g, " ")}`).join("\n")}\n`);
  const text = [`<!-- load_set: ${load_set.join(",")} -->`, "# Rules for the loop and its gates", "", ...body].join("\n");
  return { load_set, text, path: relative(cwd, compile(cwd, "building", { load_set, text })).split("\\").join("/") };
}
