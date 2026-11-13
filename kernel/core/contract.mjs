// contract — read and write markdown contracts: frontmatter scalars, string arrays and tables.
//
// WHY. Contracts are *low-level design* — which files a slice may touch, which seam each use case
// attaches to, where the app starts. A teammate should be able to read them in a pull request. As
// `.json` they were machine artifacts sitting in the tier meant for prose, and nobody read them.
//
// This is the parser: it knows the dialect and takes the per-type layout (`spec`) as an argument. The
// specs a workflow declares live with that workflow.
//
// THE FORMAT, and why it is not YAML. Every script in this repo holds a zero-dependency rule, and
// a real YAML parser is a dependency. But the shapes barely need one: `ProjectProfile` is four
// scalars, and `ScopeContract`/`WiringMap` are scalars and string arrays plus exactly ONE
// array-of-objects each. So:
//
//   • scalars and string arrays  → frontmatter, in the `key: value` / `key: [a, b]` dialect the
//     repo already parses in `compile-order.frontmatter`;
//   • arrays of objects          → markdown TABLES, which `requirements.parseRequirements` and
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
// contract against its schema, so a hand-edit that breaks the shape fails loudly
// instead of silently widening a sandbox.
//
// Zero dependencies, zero network.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Per-type layout: which array-of-objects field lives under which heading.
//
// `signatures` names the columns that identify a table as THAT field's, and it exists because of
// The heading match is exact, so a table written under `# Wiring map — <slug>` instead of
// `## Wiring` parsed as ABSENT, and every reader downstream treats absent as "none declared". The
// observed consequence was a wiring check reporting green with 0/0 engines reached
// for a committed map holding six correct rows — the gate whose whole purpose is that no engine
// ships orphaned, failing OPEN.
//
// A signature makes the difference detectable without loosening the format: a table carrying
// `use_case` AND `engine` columns is the wiring table wherever it was put, so finding one under a
// heading this spec does not claim is a PARSE FAILURE, not an empty field. Prose tables are
// unaffected — a comparison table under "Why this slice" does not carry these columns.
// ---------------------------------------------------------------------------

/**
 * The key an unreadable-table diagnostic is attached under.
 *
 * Non-enumerable would be tidier, but the object is JSON-serialised into the WorkOrder envelope and
 * a non-enumerable property would vanish there — silently, which is the failure mode being fixed.
 * The `$` prefix keeps it out of collision with any schema field; readers strip it before validating.
 */
export const UNREADABLE = "$unreadable_tables";

/** `found_under` marker: a table field that was also declared in the frontmatter, where nothing reads it. */
export const FRONTMATTER_COPY = "the frontmatter, where it is silently discarded";

/**
 * Marks a contract that parsed only via a MIGRATION reader — readable, but not in the canonical
 * shape. Without it the fallback is permanent by silence: the file works, nothing says it is the
 * old form, and one artifact quietly keeps two formats forever. Readers surface it as a warn so a
 * regeneration converges the file instead of the reader carrying it indefinitely.
 */
export const LEGACY_LAYOUT = "$legacy_layout";

// ---------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------

/**
 * Remove ONE matching pair of surrounding quotes, and unescape what was inside them.
 *
 * The pairing check is the whole point. Stripping a leading or trailing quote INDEPENDENTLY eats a
 * character from any value that merely ends in one — a shell fixture like
 * `export STORE="$T/s.json"` came back missing its final quote and was handed to `bash` as a
 * syntax error. Nothing reports that as a parse failure: the verification step simply scores the
 * implementation red, attempt after attempt, against code that was correct the whole time. A lossy
 * reader is indistinguishable from a builder that cannot make progress, which is what makes this
 * expensive rather than merely wrong.
 *
 * A double-quoted scalar that parses as JSON is read as JSON, because that is the escaping
 * convention {@link uncoerce} emits — the two are exact inverses, and the round trip is asserted.
 *
 * EVERYTHING ELSE IS UNWRAPPED BUT NOT UNESCAPED, deliberately. A backslash inside a scalar that
 * is not valid JSON belongs to whatever will consume the value, not to this dialect: shell
 * verification fixtures are the common case, and there `echo "[{\"text\": \"ok\"}]"` needs its
 * backslashes delivered intact. Unescaping on this path would corrupt them exactly as surely as
 * the missing pair check corrupted the values that end in a quote — the same defect, from the
 * other side. So the escaping convention applies only where it is unambiguous.
 *
 * @param {string} s - The trimmed raw text.
 * @returns {string} The value with its surrounding quotes removed, or `s` unchanged.
 */
function unquote(s) {
  if (s.length < 2) return s;
  const q = s[0];
  if ((q !== '"' && q !== "'") || s[s.length - 1] !== q) return s;
  if (q === '"') {
    try { return JSON.parse(s); } catch { /* not JSON — unwrap only, see above */ }
  }
  return s.slice(1, -1);
}

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
  let trimmed = String(raw ?? "").trim();
  // A MARKDOWN CODE SPAN IS FORMATTING, NOT PART OF THE VALUE.
  //
  // These contracts are MARKDOWN on disk, and a code span is the idiomatic way to write a path or
  // an identifier in one; this repo's own prose backticks every path it names. Read literally,
  // `` `src/capture/add.js` `` is a filename with two backticks in it, which is on no disk
  // anywhere — so the wiring check reported "engine file not on disk" and then "reachability is not
  // demonstrated" for a wiring map whose engines all resolve AND all reach the entry point. The
  // gate that exists so no engine ships orphaned failing CLOSED, on a correct map, is the same
  // silent-format family as the parser defects above, arriving from the other direction.
  //
  // Stripped ONLY when the whole value is a single span: a cell like
  // "Registered as the `add` entry in `TABLE`" is prose that happens to contain spans, and its
  // value is the prose. The inner text may not itself contain a backtick, so `` `a` and `b` ``
  // is left alone rather than being spliced into one nonsense token.
  const span = trimmed.match(/^(`{1,3})([\s\S]+)\1$/);
  if (span && !span[2].includes("`")) trimmed = span[2].trim();
  // A LIST IS TESTED BEFORE THE QUOTES ARE STRIPPED. `"[a, b]"` is a quoted STRING; stripping first
  // would turn it into a list and change its type on a round-trip.
  if (/^\[.*\]$/.test(trimmed)) return splitList(trimmed.slice(1, -1));
  // A QUOTED SCALAR IS A STRING, VERBATIM — the same rule the list test above already applies, one
  // step further in. Unquoting FIRST and then testing the bareword literals meant the quotes bought
  // nothing: `"false"` unwrapped to `false` and then matched the boolean test, so a cell whose value
  // is genuinely the word "false" re-read as the boolean. Same for `"true"`, `"123"`, `"~"` and `""`
  // — a string changed TYPE on a round trip, silently, the first time its contract was rewritten.
  // Quoting is how an author says "this is text"; honouring that is what makes the round trip total.
  const quoted = trimmed.length >= 2 && (trimmed[0] === '"' || trimmed[0] === "'")
    && trimmed[trimmed.length - 1] === trimmed[0];
  const v = unquote(trimmed);
  if (quoted) return v;
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
  // The other half of the comma defect. A member containing the delimiter must go back out QUOTED, or the round
  // trip that wrote it re-reads as several members — the same shredding, arriving from the writer's
  // side instead of the reader's.
  if (Array.isArray(v)) return `[${v.map((x) => (/[,"]/.test(String(x)) ? JSON.stringify(String(x)) : String(x))).join(", ")}]`;
  const s = String(v);
  // THE READER IS THE ORACLE. Anything whose plain text would come back as a DIFFERENT VALUE goes
  // out quoted — and the only honest test of that is to ask `coerce` itself.
  //
  // This subsumes the older rule (a scalar that begins AND ends with a quote) and closes the family
  // it missed: a string whose text is a bareword literal changed TYPE on a round trip. The string
  // "false" re-read as the boolean false, "123" as the number 123, "[a, b]" as a two-member list,
  // "~" as null. Each is a value an author can legitimately write in a cell, and each silently
  // became something else the first time the contract was rewritten. `coerce(s) !== v` catches all
  // of them at once and leaves every value that already round-trips untouched — a path, a sentence,
  // a real boolean, a real number.
  if (coerce(s) !== v) return JSON.stringify(s);
  return s;
}

/**
 * Split a `[a, b]` list body on commas that are NOT inside quotes.
 *
 * The old implementation was `body.split(",")`, and it shredded any member carrying a
 * comma — even a correctly quoted one. Measured: a scope-contract run probed the running CLI,
 * confirmed `tag` was unimplemented, and wrote the honest entry its own SKILL.md asks for —
 *   ["TBD — `tag` is not in dispatch.js's TABLE (exits 1, confirmed against the running CLI). A
 *     fixture asserting the spec'd behaviour (attach/remove a tag, idempotent double-tag) can only
 *     be written once the command exists."]
 * — and the parser turned that one string into FOUR list members. Three of them are prose, and
 * `t0-verify` executes this field, so the run would have tried to spawn `idempotent double-tag)`.
 * A worker doing exactly what its contract asks, mangled on the way in.
 *
 * @param {string} body - The text between the brackets.
 * @returns {string[]} Members, unquoted and trimmed; empty members are dropped.
 */
function splitList(body) {
  const out = [];
  let cur = "", q = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (q) {
      if (c === "\\" && body[i + 1] === q) { cur += body[++i]; continue; }
      if (c === q) { q = null; continue; }
      cur += c;
    } else if (c === '"' || c === "'") {
      q = c;
    } else if (c === ",") {
      out.push(cur.trim()); cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
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
/**
 * Whether a flow sequence is closed: every `[` outside a quoted run has met its `]`.
 *
 * Quotes are tracked because a bracket inside a quoted path is a character, not structure — and a
 * scope substrate glob is exactly the kind of value that can carry one.
 *
 * @param {string} text - The accumulated text, starting at the opening bracket.
 * @returns {boolean} True once depth returns to zero, i.e. the sequence is complete.
 */
function flowClosed(text) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === quote && text[i - 1] !== "\\") quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (depth === 0) return true; }
  }
  return false;
}

export function splitFrontmatter(md) {
  const m = String(md ?? "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: String(md ?? "") };
  const meta = {};
  const unreadable = [];
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s/.test(line) || !line.trim()) continue;   // continuation lines are consumed below
    const c = line.indexOf(":");
    if (c === -1) continue;
    const key = line.slice(0, c).trim();
    let inline = line.slice(c + 1).trim();

    // A FLOW SEQUENCE MAY SPAN LINES, and it used to parse as the single character "[".
    //
    // `field: [` followed by one quoted member per line and a closing `]` is the form a model
    // reaches for the moment a list is too long to read on one line, and this dialect took only
    // the text after the colon — so the value became the string "[", the members were counted as
    // unreadable strays, and every reader downstream saw a string where an array was declared.
    // Measured on a live run: three of five scope contracts were written this way, and each one
    // then failed its own envelope schema at compile — the run could not dispatch those scopes at
    // all. Accepted now: the lines are joined until the brackets balance and the whole thing is
    // coerced as the list it is. A sequence that never closes is still reported, never guessed at.
    if (inline.startsWith("[") && !flowClosed(inline)) {
      let buf = inline;
      let k = i + 1;
      for (; k < lines.length && !flowClosed(buf); k++) buf += " " + lines[k].trim();
      i = k - 1;
      if (flowClosed(buf)) { meta[key] = coerce(buf); continue; }
      meta[key] = null;
      unreadable.push({ field: key, expected_heading: `${key}: [a, b]  (or an indented \`- item\` list)`,
        found_under: "a flow sequence that is never closed", rows: k - (i + 1) });
      continue;
    }

    // An indented run beneath a key is a YAML BLOCK SEQUENCE, and it used to be skipped
    // entirely — so `e2e_verification_fixtures:` followed by two `- "node …"` lines parsed to
    // null, the members vanished, and no reader could tell "declared nothing" from "declared
    // something I discarded". Measured: a scope-contract run wrote three scopes of researched
    // fixtures in this form and every one evaporated. It is ACCEPTED now, because it is the form a
    // model reaches for by default and the one that carries prose members without the quoting
    // problem — and anything indented that is NOT a block sequence is reported rather than dropped.
    const block = [];
    let stray = 0;
    let j = i + 1;
    for (; j < lines.length && (/^\s/.test(lines[j]) || !lines[j].trim()); j++) {
      const t = lines[j].trim();
      if (!t) continue;
      if (t.startsWith("- ") || t === "-") block.push(t.replace(/^-\s*/, ""));
      else stray++;
    }
    i = j - 1;

    if (inline) {
      meta[key] = coerce(inline);
      if (block.length || stray) unreadable.push({ field: key, expected_heading: "an inline value OR an indented block, not both", found_under: "both", rows: block.length + stray });
      continue;
    }
    if (block.length) {
      meta[key] = block.map((v) => String(coerce(v)));
    } else if (stray) {
      meta[key] = null;
      unreadable.push({ field: key, expected_heading: `${key}: [a, b]  (or an indented \`- item\` list)`, found_under: "an indented block this dialect cannot read", rows: stray });
    } else {
      meta[key] = coerce(inline);
    }
  }
  if (unreadable.length) meta[UNREADABLE] = unreadable;
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
 * Fold per-entity `| Field | Value |` sections into the row array a horizontal table would give.
 *
 * The legacy wiring-map layout (see the wiring-map layout the caller declares): one `### UC-xx — title` subsection per use
 * case, each holding a vertical two-column table. The entity id comes from the HEADING, the fields
 * from the rows. Field names are unwrapped from backticks and snake-cased so they land on the same
 * keys the canonical horizontal table produces — the two layouts must yield identical objects or
 * this is a second format rather than a second spelling of one.
 *
 * @param {Object<string, Array<Object>>} tables - `parseTables` output, keyed by heading.
 * @param {{field:string, key:string, idPattern:RegExp}} desc - The `perSection` descriptor.
 * @returns {Array<Object>} One row per matching section, in document order; [] when none match.
 */
export function perSectionRows(tables, desc) {
  const out = [];
  for (const [heading, rows] of Object.entries(tables)) {
    const id = heading.match(desc.idPattern)?.[1];
    if (!id || !rows.length) continue;
    const cols = new Set(Object.keys(rows[0]));
    if (!cols.has("field") || !cols.has("value")) continue; // not a Field/Value table — prose, skip
    const entry = { [desc.key]: id };
    for (const r of rows) {
      const k = String(r.field ?? "").replace(/`/g, "").trim().toLowerCase().replace(/\s+/g, "_");
      if (k && r.value !== undefined) entry[k] = r.value;
    }
    out.push(entry);
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
 * @param {{tables:Object<string,string>}} spec - Field → heading map for the
 *   arrays of objects (see the specs the caller declares).
 * @returns {Object} The contract object: frontmatter scalars/lists plus one array per table.
 *   A declared table with no matching heading is simply absent, never `[]` — an empty array and
 *   an undeclared field mean different things to the schema.
 */
export function parseContract(md, spec) {
  const { meta, body } = splitFrontmatter(md);
  const tables = parseTables(body);
  const out = { ...meta };
  // Frontmatter-level diagnostics and table-level ones share one channel, so a
  // reader asks `unreadableReason()` once and cannot check for one while missing the other.
  const unreadable = [...(meta[UNREADABLE] || [])];
  delete out[UNREADABLE];
  for (const [field, heading] of Object.entries(spec.tables || {})) {
    // A TABLE FIELD DECLARED IN THE FRONTMATTER TOO IS A DISCARDED DECLARATION, and it has to be
    // loud. `renderContract` writes table fields ONLY as a table — it filters them out of the
    // frontmatter it emits — so the table is the source by construction and the line below is right
    // to prefer it. What the old code did not say is that the frontmatter copy was then dropped
    // without a word, and `splitFrontmatter` cannot even represent this shape: a block sequence of
    // MAPPINGS flattens to a list of strings, so the copy is usually garbage as well as ignored.
    //
    // Measured: a planner wrote `affordance_manifest` in both places, the frontmatter copy carrying
    // the correct `required_states: [idle]` and the table cell a bare `idle`. The parser took the
    // table, the value was a string where the schema wants an array, `compile` refused the order,
    // and the scope was NEVER DISPATCHED — spec-lint passing the contract, the build leg reporting
    // `state: "done", error: null`, four of nine scopes gone every round, until EVAL refused to
    // grade a round whose scopes had never run. The contract even captioned its own table "rendered
    // here for reviewers": the author's model was the exact inverse of the parser's. That
    // disagreement is the defect; which side wins is not.
    //
    // ONLY WHEN A TABLE ACTUALLY WINS. With no rows under the heading the frontmatter value is what
    // the field becomes, and `affordance_manifest: []` meaning "none" is legal and current — five of
    // those nine contracts do exactly that and are correct. An earlier cut of this rule fired on all
    // nine and turned a working run red, which is the opposite of the fix.
    if (tables[heading]) {
      if (field in meta) {
        unreadable.push({ field, expected_heading: heading, found_under: FRONTMATTER_COPY,
          rows: Array.isArray(meta[field]) ? meta[field].length : 1 });
      }
      out[field] = tables[heading];
      continue;
    }
    // The field is absent — but is it absent because nobody declared it, or because the
    // author declared it somewhere this parser does not look? Those are opposite facts and the
    // old code returned the same thing for both. A table carrying this field's signature columns,
    // under a heading the spec does not claim, is the second case.
    const sig = (spec.signatures || {})[field];
    if (!sig) continue;
    for (const [seen, rows] of Object.entries(tables)) {
      if (seen === heading || !rows.length) continue;
      const cols = new Set(Object.keys(rows[0]));
      if (sig.every((c) => cols.has(c))) {
        unreadable.push({ field, expected_heading: heading, found_under: seen, rows: rows.length });
        break;
      }
    }
  }
  // THE PER-SECTION LAYOUT, read only when the canonical table is genuinely absent.
  //
  // Ordering matters: the canonical `## Wiring` table always wins, so a map carrying both shapes
  // never has the migration reader override the current one. If neither yields rows but the body
  // DOES carry sections this descriptor recognises, that is a parse failure and not an empty
  // field — the whole point of the banner above — so it is reported rather than returned as
  // silence. That case is what let 9 of 9 committed maps read as clean while holding nothing.
  const ps = spec.perSection;
  if (ps && !(ps.field in out)) {
    const rows = perSectionRows(tables, ps);
    if (rows.length) { out[ps.field] = rows; out[LEGACY_LAYOUT] = true; }
    // The headings come from the BODY, not from `tables` — `parseTables` only records a heading
    // that has a table under it, so a section whose table is missing or malformed leaves no trace
    // there. Looking for the evidence in the parsed output is looking where the failure already
    // erased it, which is the same mistake this whole diagnostic exists to correct.
    else if ([...String(body).matchAll(/^#{1,6}\s+(.*)$/gm)].some((m) => ps.idPattern.test(m[1].trim()))) {
      unreadable.push({
        field: ps.field, expected_heading: Object.entries(spec.tables || {}).find(([f]) => f === ps.field)?.[1] || ps.field,
        found_under: "per-entity sections whose tables this dialect could not read", rows: 0,
      });
    }
  }

  // A NON-TABLE FIELD WRITTEN AS A `## SECTION` VANISHES, and the loop above cannot see it.
  //
  // Everything above answers "was a declared TABLE written under the wrong heading". It says
  // nothing about the other half of the contract — the scalars and string lists that live in
  // frontmatter — because the parser has no heading to expect for them. So an author who writes
  //
  //     ## e2e_verification_fixtures
  //     - `node --test test/store.test.js` — round-trips load()/save()
  //
  // instead of a frontmatter key produces a contract where that field is simply `undefined`, and
  // every reader downstream treats it as "not declared". Measured: an architect did exactly this,
  // the fixtures reached `verify t0` as `undefined`, and six scopes were certified T0-green having
  // executed nothing — while the substrate list beside it, written as a frontmatter block list,
  // parsed perfectly. One field silently vanished between the writer and the reader.
  //
  // The detector is deliberately narrow: a heading whose text is a bare snake_case identifier is
  // an author naming a FIELD, not writing prose — `## Why this slice` and `## Affordances` cannot
  // match. Reported through the same channel, so `unreadableReason()` covers both halves and a
  // reader still asks once.
  for (const m of String(body).matchAll(/^##\s+([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\s*$/gm)) {
    const field = m[1];
    if (field in out) continue;                                   // also present in frontmatter — fine
    if (Object.prototype.hasOwnProperty.call(spec.tables || {}, field)) continue;  // handled above
    unreadable.push({
      field, expected_heading: field, rows: 0,
      found_under: "a `## " + field + "` markdown section, which this dialect reads as prose",
    });
  }
  if (unreadable.length) out[UNREADABLE] = unreadable;
  return out;
}

/**
 * The one-line reason a contract could not be read, or null when it read cleanly.
 *
 * Exported so every consumer asks the same question the same way. A reader that skips this is
 * back to treating "I could not see your table" as "you declared no table" — the whole defect class.
 * @param {Object|null} contract - A parsed contract (or a `readContract()` result's `.contract`).
 * @returns {string|null} A human-readable failure, or null if the contract parsed cleanly.
 */
export function unreadableReason(contract) {
  const u = contract && contract[UNREADABLE];
  if (!u || !u.length) return null;
  return u
    .map((x) => {
      if (x.found_under === "an indented block this dialect cannot read" || x.found_under === "both") {
        return `\`${x.field}\` was written as \`${x.expected_heading}\` but ${x.rows} indented line(s) beneath it could not be read, so the value parsed as ABSENT`;
      }
      // A frontmatter field written as a prose section. Phrased as its own case because telling an
      // author to "use a table heading" when the fix is "put it in frontmatter" sends them the
      // wrong way — and this is the field whose silent absence certified six scopes on no evidence.
      if (x.rows === 0 && String(x.found_under).includes("markdown section")) {
        return `\`${x.field}\` was written as a \`## ${x.field}\` markdown section, which this dialect reads as prose — ` +
          `it must be a FRONTMATTER key (a \`- \` block list or an inline [a, b] list), so as written the field parsed as ABSENT`;
      }
      // A table field ALSO declared in the frontmatter. Its own case because the fix is "delete the
      // frontmatter copy", not "move the table" — and because the copy is not merely redundant: the
      // parser takes the table, so whatever the copy said was discarded without a word.
      if (x.found_under === FRONTMATTER_COPY) {
        return `\`${x.field}\` is a TABLE field and was also declared in the frontmatter, ` +
          `where it is read by nothing and silently discarded — the \`## ${x.expected_heading}\` table is the only source. ` +
          `Delete the frontmatter copy, and check the table says what it said: a list cell is written \`[a, b]\``;
      }
      return `\`${x.field}\` must be a table under a \`## ${x.expected_heading}\` heading; found ${x.rows} matching row(s) under "${x.found_under}" instead, so the field parsed as ABSENT`;
    })
    .join("; ");
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
 * @param {{tables:Object<string,string>}} spec - Field → heading map.
 * @param {{existing?:string, title?:string}} [opts] - existing: prior file text to keep prose from;
 *   title: an `# ` heading for a new file.
 * @returns {string} The markdown document, newline-terminated.
 */
export function renderContract(obj, spec, opts = {}) {
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
 * @param {{tables:Object<string,string>}} spec - Field → heading map.
 * @returns {{contract:Object, path:string, format:("markdown"|"json")}|null} The parsed contract
 *   with the path and format it actually came from, or null when neither form exists.
 * @throws {SyntaxError} If a legacy `.json` exists but does not parse — a corrupt contract must
 *   be loud, and only the ABSENT case is allowed to be quiet.
 */
export function readContract(path, spec) {
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
