// contract-md — read and write the committed contracts as markdown.
//
// WHY (ADR-0001). Scope contracts, the wiring map and the project profile are *low-level design*:
// which files a slice may touch, which seam each use case attaches to, where the app starts. A
// teammate should be able to read them in a pull request. As `.json` they were machine artifacts
// sitting in the tier meant for prose, and nobody read them.
//
// THE FORMAT, and why it is not YAML. Every script in this repo holds a zero-dependency rule, and
// a real YAML parser is a dependency. But the shapes barely need one: `ProjectProfile` is four
// scalars, and `ScopeContract`/`WiringMap` are scalars and string arrays plus exactly ONE
// array-of-objects each. So:
//
//   • scalars and string arrays  → frontmatter, in the `key: value` / `key: [a, b]` dialect the
//     repo already parses in `compile-order.frontmatter`;
//   • arrays of objects          → markdown TABLES, which `trace-lint.parseRequirements` and
//     `compile-order.ledgerDecisions` already demonstrate reading;
//   • everything else in the file is prose, and is preserved on round-trip.
//
// Both parsers existed before this file; what is new is putting them behind one contract so a
// reader and a writer cannot disagree about the dialect.
//
// THE BOUNDARY THAT MATTERS: **markdown is the on-disk format, JSON is the wire format.**
// `compile-order` parses a contract off disk and embeds the resulting OBJECT in
// `payload.scope_contract`, so the WorkOrder envelope, its schema and `validate-envelope` are
// completely unchanged. Nothing downstream of the parse knows the file was markdown.
//
// A CONSEQUENCE WORTH STATING: these files are now hand-editable, where they used to be
// machine-written and schema-validated on every write. `spec-lint` re-validates every parsed
// contract against `domain.schema.json`, so a hand-edit that breaks the shape fails loudly
// instead of silently widening a sandbox.
//
// Zero dependencies, zero network.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Per-type layout: which array-of-objects field lives under which heading.
// ---------------------------------------------------------------------------

/** `ScopeContract` — the substrate whitelist and fixtures for one vertical slice. */
export const SCOPE_CONTRACT = { tables: { affordance_manifest: "Affordances" } };

/** `WiringMap` — per use case: engine → seam → entry-point call site → affordance. */
export const WIRING_MAP = { tables: { entries: "Wiring" } };

/** `ProjectProfile` — archetype + entry point. All scalars; no tables. */
export const PROJECT_PROFILE = { tables: {} };

// ---------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------

/**
 * Coerce one frontmatter or table-cell value.
 *
 * ONE RULE IN BOTH PLACES, deliberately: a value wrapped in `[...]` is a list of strings,
 * anything else is a scalar. `required_states` inside an affordance row and
 * `allowed_file_substrate` in the frontmatter are then written the same way, so an author never
 * has to remember which context they are in.
 *
 * @param {string} raw - The raw text.
 * @returns {(string|number|boolean|string[])} The coerced value.
 */
export function coerce(raw) {
  const v = String(raw ?? "").trim().replace(/^["']|["']$/g, "");
  if (/^\[.*\]$/.test(v)) {
    return v.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "~" || v === "null" || v === "") return null;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}

/**
 * Render a value back into the frontmatter/cell dialect `coerce` reads.
 * @param {*} v - The value.
 * @returns {string} Its textual form; `null`/`undefined` become `~`.
 */
export function uncoerce(v) {
  if (v === null || v === undefined) return "~";
  if (Array.isArray(v)) return `[${v.join(", ")}]`;
  return String(v);
}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

/**
 * Split a document into its frontmatter map and the body after it.
 * @param {string} md - Full markdown text.
 * @returns {{meta:Object<string,*>, body:string}} Parsed scalars/lists and the remaining body
 *   ({}/whole document when there is no leading `---` block).
 */
export function splitFrontmatter(md) {
  const m = String(md ?? "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: String(md ?? "") };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const c = line.indexOf(":");
    // A leading space means a continuation/nested line, which this dialect does not support —
    // skipping it is what keeps the parser honest about its own limits.
    if (c === -1 || /^\s/.test(line)) continue;
    meta[line.slice(0, c).trim()] = coerce(line.slice(c + 1));
  }
  return { meta, body: m[2] };
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/**
 * Split one table row into cells, honouring `\|` as a literal pipe.
 *
 * `renderTable` escapes a `|` inside a value because an unescaped one would end the cell and shift
 * every column after it. A splitter that ignored the escape made the write side lossy in exactly
 * the case the escape existed for — the value came back truncated at the backslash, silently, with
 * the row still the right width. Escaping and unescaping have to be the same commit.
 *
 * @param {string} line - A trimmed row beginning with `|`.
 * @returns {string[]} The trimmed cells, outer delimiters dropped, `\|` restored to `|`.
 */
export function splitRow(line) {
  const cells = [];
  let cur = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\" && line[i + 1] === "|") { cur += "|"; i++; continue; }
    if (c === "|") { cells.push(cur); cur = ""; continue; }
    cur += c;
  }
  cells.push(cur);
  return cells.slice(1, -1).map((c) => c.trim()); // drop the empties outside the outer pipes
}

/**
 * Read every markdown table in a body, keyed by the heading immediately above it.
 * @param {string} body - Markdown after the frontmatter.
 * @returns {Object<string, Array<Object<string,*>>>} heading text → row objects, columns named by
 *   the table's own header row (so adding a schema field needs no parser change).
 */
export function parseTables(body) {
  const out = {};
  let heading = null;
  let header = null;
  for (const raw of String(body ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) { heading = h[1].trim(); header = null; continue; }
    if (!line.startsWith("|")) { if (!line) header = null; continue; }

    const cells = splitRow(line);
    if (!cells.length) continue;
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separator row
    if (!header) { header = cells.map((c) => c.toLowerCase().replace(/\s+/g, "_")); continue; }
    if (!heading) continue;

    const row = {};
    header.forEach((k, i) => {
      const v = coerce(cells[i] ?? "");
      if (v !== null && v !== "") row[k] = v;
    });
    (out[heading] ||= []).push(row);
  }
  return out;
}

/**
 * Render rows as a markdown table.
 * @param {Array<Object>} rows - Row objects.
 * @param {string[]} [columns] - Column order; defaults to the union of keys in first-seen order.
 * @returns {string} The table, or "" when there are no rows.
 */
export function renderTable(rows, columns) {
  if (!rows?.length) return "";
  const cols = columns?.length ? columns : [...new Set(rows.flatMap((r) => Object.keys(r)))];
  // A literal `|` inside a cell would end it; escaping is the only way a value survives.
  const cell = (v) => uncoerce(v).replace(/\|/g, "\\|");
  return [
    `| ${cols.join(" | ")} |`,
    `|${cols.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${cols.map((c) => (c in r ? cell(r[c]) : "")).join(" | ")} |`),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// The contract API
// ---------------------------------------------------------------------------

/**
 * Parse a markdown contract into the object the envelope carries.
 * @param {string} md - The contract file's text.
 * @param {{tables:Object<string,string>}} [spec=SCOPE_CONTRACT] - Field → heading map for the
 *   arrays of objects (see SCOPE_CONTRACT / WIRING_MAP / PROJECT_PROFILE).
 * @returns {Object} The contract object: frontmatter scalars/lists plus one array per table.
 *   A declared table with no matching heading is simply absent, never `[]` — an empty array and
 *   an undeclared field mean different things to the schema.
 */
export function parseContract(md, spec = SCOPE_CONTRACT) {
  const { meta, body } = splitFrontmatter(md);
  const tables = parseTables(body);
  const out = { ...meta };
  for (const [field, heading] of Object.entries(spec.tables || {})) {
    if (tables[heading]) out[field] = tables[heading];
  }
  return out;
}

/**
 * Render a contract object as markdown.
 *
 * Prose is preserved: pass the previous file's text as `existing` and any narrative under a
 * heading this spec does not own survives the round-trip. A generator that silently deleted a
 * teammate's "Why this slice" paragraph on every regeneration would make the format worse than
 * the JSON it replaced.
 *
 * @param {Object} obj - The contract object.
 * @param {{tables:Object<string,string>}} [spec=SCOPE_CONTRACT] - Field → heading map.
 * @param {{existing?:string, title?:string}} [opts] - existing: prior file text to keep prose from;
 *   title: an `# ` heading for a new file.
 * @returns {string} The markdown document, newline-terminated.
 */
export function renderContract(obj, spec = SCOPE_CONTRACT, opts = {}) {
  const tableFields = new Set(Object.keys(spec.tables || {}));
  const fm = Object.entries(obj)
    .filter(([k, v]) => !tableFields.has(k) && v !== undefined)
    .map(([k, v]) => `${k}: ${uncoerce(v)}`);

  const kept = opts.existing ? keepProse(opts.existing, spec) : "";
  const parts = ["---", ...fm, "---", ""];
  if (opts.title && !kept.includes("# ")) parts.push(`# ${opts.title}`, "");
  if (kept) parts.push(kept.trimEnd(), "");

  for (const [field, heading] of Object.entries(spec.tables || {})) {
    const rows = obj[field];
    if (!rows?.length) continue;
    parts.push(`## ${heading}`, "", renderTable(rows), "");
  }
  return parts.join("\n").replace(/\n{3,}/g, "\n\n");
}

/**
 * Read a contract from disk, markdown first, legacy JSON second.
 *
 * THE FALLBACK IS NOT PERMANENT KINDNESS — it is what makes the format change safe to roll out.
 * A project upgrades its plugin and its data at different moments: `migrate.sh` replaces the code
 * in step 1 and applies migrations in step 2, and a run started between them would otherwise find
 * every contract "missing" and take a fail-open branch. Reading the `.json` a beat longer turns
 * that window from a silently degraded run into a non-event.
 *
 * @param {string} path - Path to the contract, with or without an extension.
 * @param {{tables:Object<string,string>}} [spec=SCOPE_CONTRACT] - Field → heading map.
 * @returns {{contract:Object, path:string, format:("markdown"|"json")}|null} The parsed contract
 *   with the path and format it actually came from, or null when neither form exists.
 * @throws {SyntaxError} If a legacy `.json` exists but does not parse — a corrupt contract must
 *   be loud, and only the ABSENT case is allowed to be quiet.
 */
export function readContract(path, spec = SCOPE_CONTRACT) {
  const base = String(path).replace(/\.(md|json)$/, "");
  const md = `${base}.md`;
  if (existsSync(md)) {
    return { contract: parseContract(readFileSync(md, "utf8"), spec), path: md, format: "markdown" };
  }
  const json = `${base}.json`;
  if (existsSync(json)) {
    return { contract: JSON.parse(readFileSync(json, "utf8")), path: json, format: "json" };
  }
  return null;
}

/**
 * Read every contract in a directory, markdown and legacy JSON alike.
 *
 * A `.md` and a `.json` for the same id is a half-finished migration, not two scopes — the
 * markdown wins and the JSON is ignored, so a stale leftover cannot resurrect an old substrate.
 *
 * @param {string} dir - Directory of contracts (typically `scopes/`).
 * @param {{tables:Object<string,string>}} [spec=SCOPE_CONTRACT] - Field → heading map.
 * @returns {Array<{contract:Object, path:string, format:string, id:string}>} One entry per
 *   contract, sorted by id; [] when the directory is absent. Unparseable files are skipped.
 */
export function readAllContracts(dir, spec = SCOPE_CONTRACT) {
  if (!existsSync(dir)) return [];
  let names;
  try { names = readdirSync(dir); } catch { return []; }
  const ids = new Map();
  for (const f of names) {
    const m = f.match(/^(.+)\.(md|json)$/);
    if (!m) continue;
    // markdown wins over a legacy sibling of the same id
    if (m[2] === "json" && ids.has(m[1])) continue;
    if (m[2] === "md" || !ids.has(m[1])) ids.set(m[1], f);
  }
  const out = [];
  for (const [id, file] of [...ids].sort(([a], [b]) => a.localeCompare(b))) {
    try {
      const found = readContract(join(dir, file), spec);
      if (found) out.push({ ...found, id });
    } catch { /* an unparseable contract is reported by spec-lint, not here */ }
  }
  return out;
}

/**
 * Extract the prose a regeneration must not destroy — everything in the body except the sections
 * this spec owns.
 * @param {string} md - The prior file text.
 * @param {{tables:Object<string,string>}} spec - Field → heading map; those headings are dropped.
 * @returns {string} The surviving prose.
 */
export function keepProse(md, spec) {
  const owned = new Set(Object.values(spec.tables || {}));
  const { body } = splitFrontmatter(md);
  const out = [];
  let skipping = false;
  for (const line of String(body ?? "").split(/\r?\n/)) {
    const h = line.trim().match(/^#{1,6}\s+(.*)$/);
    if (h) skipping = owned.has(h[1].trim());
    if (!skipping) out.push(line);
  }
  return out.join("\n").trim();
}
