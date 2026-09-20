// 62 — HD-010: THE RUN-ARGUMENT SURFACE IS DERIVED, AND A DRIFT BETWEEN ANY TWO TIERS GOES RED.
//
// THE DEFECT THIS CLOSES. A run argument was spelled three ways across three tiers with nothing
// joining them: `references/gates.md` L0.9b documented `--wall-clock-budget` as a `RunArgs` field;
// `shapeup-run.js`'s own RunArgs contract comment named `budgets.wallClockS`; and
// `kernel/verify/budget.mjs` read `wall_clock_budget_s` off the run RECEIPT — a field
// `budgets.wallClockS` never was and never reached. A caller following the documented shape got no
// wall-clock breaker and no warning that it had asked for one. Exit 0. Nothing was red.
//
// THE FIX has two halves: `wallClockS` is gone from `RunArgs` (the schema, the L0.9b table and
// `shapeup-run.js`'s header comment all now agree there is no third `budgets` member — see §97
// below for the executed proof that the real deadline breaker never needed one), and this module IS
// the join `gates.md`, `domain.schema.json` and `shapeup-run.js` never had: it reads all three at
// runtime and reds the moment any two disagree.
//
// WHY THIS MUST BE DERIVED, NEVER TRANSCRIBED (the failure this repo already committed once inside
// its own checker — see `tests/structural/13-argv-contract.mjs`'s own banner for the sibling case).
// Every field name and every flag name below comes from Object.keys() over the parsed schema, a
// regex scan of `shapeup-run.js`'s actual source, and a parse of `gates.md`'s own L0.9b table — NOT
// from an array of strings typed into this file. A field added to the schema, a row added to the
// table, or a line added to `shapeup-run.js` that reads `args.<x>` changes what this module reports
// on its very next run, with no line here touched.
//
// THE THREE CHECKS, each independently sufficient to catch one of the three mutation shapes that
// produced HD-010 and its siblings:
//
//   (1) TABLE -> SCHEMA   every RunArgs field an L0.9b row names (expanding `{a,b}` and `{…}` —
//                         the latter from the SCHEMA's own sub-properties, never a hand list) is a
//                         real property of `$defs/RunArgs` in `domain.schema.json`.
//   (2) SCHEMA -> READER  every one of those same fields is actually read in `shapeup-run.js`
//                         (`args.<path>` appears in its source) — UNLESS the row is explicitly
//                         marked exempt (a field cell starting `*(…)*`, `gates.md`'s own convention
//                         for "this flag is consumed somewhere else"), in which case its ALTERNATE
//                         path is checked instead (see below, and §97).
//   (3) READER -> SCHEMA  every `args.<field>` (one level of nesting included) `shapeup-run.js`
//                         actually reads names a real RunArgs property — a reader of a flag nothing
//                         declares is exactly as wrong as a flag nothing reads.
//
// A documented flag with no reader reds via (2). A reader with its declaration deleted reds via (2)
// AND (3) (the field vanishes from the schema too, so nothing documents it either). A field renamed
// on exactly one side reds via whichever of (1)/(2)/(3) spans the tier that did NOT get the rename —
// every renamed-on-one-side case exercised by hand while writing this module hit at least one.
//
// THE EXEMPTION ITSELF WAS ONCE THE HOLE. Marking a row exempt used to be sufficient on its own —
// `ok()` and move on, whatever the reason text said. EXECUTED against this repo: rewriting the
// `--no-qa` row to `*(not a \`RunArgs\` field)* — consumed elsewhere` and deleting its real reader
// left the suite green, because "consumed elsewhere" is prose nothing ever reads. So an exempt row
// must now name its alternate path in a shape this module can verify — `consumed by \`<file>\` as
// \`<needle>\`` — and this module reads that file and checks the needle is really there. A row
// marked exempt with no such claim, or a false one, FAILS exactly like a documented flag with no
// reader; see `parseAlternatePath`'s own banner.

import { join } from "node:path";

/** First backtick-quoted span in a table cell, or null. */
function firstBacktickSpan(cell) {
  const m = cell.match(/`([^`]+)`/);
  return m ? m[1].trim() : null;
}

/**
 * Parse the L0.9b flag -> RunArgs-field table out of `gates.md`'s own markdown, at runtime.
 *
 * @param {string} gatesMd - The full text of `references/gates.md`.
 * @returns {Array<{flags:string[], raw:string, exempt:boolean, reason:(string|null), fieldsRaw:(string|null)}>}
 *   One entry per table row, in document order.
 */
export function parseLaunchRecordTable(gatesMd) {
  const idx = gatesMd.indexOf("L0.9b");
  if (idx === -1) throw new Error("gates.md: no L0.9b section found — has the anchor moved or been renamed?");
  const lines = gatesMd.slice(idx).split("\n");
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    if (!inTable) {
      if (/^\|\s*Flag\s*\|/.test(line)) inTable = true;
      continue;
    }
    if (/^\|\s*---/.test(line)) continue;
    if (!line.startsWith("|")) break; // table ended
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const [flagsCell, fieldCell] = cells;
    const flags = flagsCell.replace(/`/g, "").split("/")
      .map((s) => (s.trim().match(/^--([a-z][a-z0-9-]*)/) || [])[1])
      .filter(Boolean);
    const exempt = /^\*\(/.test(fieldCell);
    rows.push({ flags, raw: `${flagsCell} -> ${fieldCell}`, exempt, reason: exempt ? fieldCell : null, fieldsRaw: exempt ? null : fieldCell });
  }
  if (!rows.length) throw new Error("gates.md: L0.9b table parsed to zero rows — the table shape has changed under the parser");
  return rows;
}

/**
 * Expand one row's field cell into concrete, dotted RunArgs paths.
 *
 * `{a,b}` expands literally; `{…}` expands from the SCHEMA's own sub-properties for that prefix —
 * derived, never a hand-kept list of what `models` or `budgets` currently contain.
 *
 * @param {string} fieldCell - A non-exempt row's raw field-cell text (carries a backtick span).
 * @param {object} runArgsProps - `$defs/RunArgs.properties` from the parsed schema.
 * @returns {string[]} Dotted field paths, e.g. `["budgets.maxRounds", "budgets.attemptBudget"]`.
 */
export function expandFieldPaths(fieldCell, runArgsProps) {
  const span = firstBacktickSpan(fieldCell);
  if (!span) throw new Error(`gates.md L0.9b row has no backtick field span and is not marked exempt: ${fieldCell}`);
  const spec = span.replace(/:\s*.+$/, "").trim();
  const brace = spec.match(/^([\w.]+)\.\{([^}]*)\}$/);
  if (!brace) return [spec];
  const [, prefix, inner] = brace;
  if (inner.trim() === "…" || inner.trim() === "...") {
    const sub = runArgsProps?.[prefix]?.properties || {};
    return Object.keys(sub).map((k) => `${prefix}.${k}`);
  }
  return inner.split(",").map((s) => s.trim()).filter(Boolean).map((k) => `${prefix}.${k}`);
}

// A backtick-quoted `path`, then a backtick-quoted `needle`, joined by the fixed phrase "consumed
// by ... as ...". This is the exemption convention itself, not a detail of this checker: a row
// gets to skip TABLE -> SCHEMA -> READER verification only by naming, in exactly this shape, a real
// file and a literal string inside it — never by prose alone. See parseAlternatePath's own banner.
const ALTERNATE_PATH_RE = /consumed by `([^`]+)` as `([^`]+)`/;

/**
 * Parse an exempt row's REQUIRED alternate-path claim out of its field-cell text.
 *
 * WHY THIS EXISTS. Marking a row exempt used to be enough on its own to skip every check below —
 * `ok()` and `continue`, no matter what the reason text said. EXECUTED against this repo: rewriting
 * the `--no-qa` row to `*(not a \`RunArgs\` field)* — consumed elsewhere` and then deleting its real
 * reader (`args.noQa` in `shapeup-run.js`) left the suite green, because "consumed elsewhere" is
 * prose no check ever reads. The exemption itself was the unverified escape hatch — not this file's
 * absence of a check, its PRESENCE of one that any doc-only edit could satisfy.
 *
 * So an exempt row must name its alternate path in a shape this function can verify: a real file and
 * a literal string inside that file, both backtick-quoted. A row that omits this, or whose file or
 * needle does not check out, is NOT a valid exemption — it is the documented-flag-with-no-reader
 * defect wearing the exempt marker as camouflage, and the caller must fail it exactly that way.
 *
 * @param {string} reasonCell - The exempt row's raw field-cell text (starts `*(`).
 * @returns {({path:string, needle:string}|null)} The claim, or null when the cell names none.
 */
export function parseAlternatePath(reasonCell) {
  const m = String(reasonCell || "").match(ALTERNATE_PATH_RE);
  return m ? { path: m[1].trim(), needle: m[2].trim() } : null;
}

/** Flatten `$defs/RunArgs.properties` one level deep into dotted paths (top-level + object children). */
export function flattenRunArgsFields(runArgsProps) {
  const out = [];
  for (const [k, def] of Object.entries(runArgsProps)) {
    out.push(k);
    if (def && def.type === "object" && def.properties) {
      for (const child of Object.keys(def.properties)) out.push(`${k}.${child}`);
    }
  }
  return out;
}

/**
 * Every `args.<field>[.<child>]` access `shapeup-run.js` actually contains — a regex scan of the
 * real source, never a hand-kept list of what the script is believed to read.
 *
 * @param {string} src - `shapeup-run.js`'s full source text.
 * @returns {string[]} Distinct dotted paths, in first-seen order.
 */
export function readerFieldsFrom(src) {
  const seen = new Set();
  const re = /\bargs\.([a-zA-Z_][a-zA-Z0-9_]*)(?:\.([a-zA-Z_][a-zA-Z0-9_]*))?/g;
  let m;
  while ((m = re.exec(src))) seen.add(m[2] ? `${m[1]}.${m[2]}` : m[1]);
  return [...seen];
}

/**
 * Run the run-argument surface checks (section 96).
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON } = ctx;

  // =============================================================================
  section("96. The run-argument surface — derived from the schema, gates.md and shapeup-run.js, never typed");
  // =============================================================================

  const domain = readJSON(join(ROOT, "kernel/schemas/domain.schema.json"));
  const runArgsProps = domain.$defs?.RunArgs?.properties;
  if (!runArgsProps) { fail("domain.schema.json: $defs/RunArgs.properties is missing — nothing to derive a surface from"); return; }

  const gatesMd = read(join(ROOT, "skills/tech-lead/references/gates.md"));
  const workflowSrc = read(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"));

  let rows;
  try { rows = parseLaunchRecordTable(gatesMd); }
  catch (e) { fail(`could not parse gates.md's L0.9b table: ${e.message}`); return; }
  ok(`parsed ${rows.length} operator-flag row(s) out of gates.md's L0.9b table (not a hand-kept list)`);

  const schemaFields = flattenRunArgsFields(runArgsProps);
  ok(`derived ${schemaFields.length} RunArgs field path(s) from domain.schema.json's own $defs/RunArgs (grows with the schema, unedited)`);

  const readerFields = new Set(readerFieldsFrom(workflowSrc));
  ok(`derived ${readerFields.size} distinct args.<field> access(es) out of shapeup-run.js's real source`);

  // --- (1) TABLE -> SCHEMA, and (2) SCHEMA -> READER for every non-exempt row ------------------
  let documentedChecked = 0;
  let exemptChecked = 0;
  for (const row of rows) {
    if (row.exempt) {
      const flagLabel = row.flags.map((f) => `--${f}`).join("/");
      exemptChecked++;
      const alt = parseAlternatePath(row.reason);
      if (!alt) {
        fail(`gates.md L0.9b: "${flagLabel}" is marked exempt (${row.reason.slice(0, 60)}…) but names no ` +
          `verifiable alternate path — an exempt row must read "consumed by \`<file>\` as \`<needle>\`", ` +
          `naming a real file and a literal string this module can check. A reason with no such claim is ` +
          `an unverified escape hatch, not an exemption.`);
        continue;
      }
      let altSrc;
      try { altSrc = read(join(ROOT, alt.path)); }
      catch (e) {
        fail(`gates.md L0.9b: "${flagLabel}" claims its alternate path is "${alt.path}", which does not exist (${e.code || e.message}) — the exemption's claimed reader cannot be checked, so it does not hold`);
        continue;
      }
      if (altSrc.includes(alt.needle)) {
        ok(`gates.md L0.9b: "${flagLabel}" is exempt from the RunArgs surface, and its claimed alternate path ${alt.path} really contains "${alt.needle}" — a verified escape hatch, not a documentation-only one`);
      } else {
        fail(`gates.md L0.9b: "${flagLabel}" claims alternate path "${alt.path}" reads "${alt.needle}", but that file contains no such text — the exemption's claimed reader does not exist`);
      }
      continue;
    }
    let paths;
    try { paths = expandFieldPaths(row.fieldsRaw, runArgsProps); }
    catch (e) { fail(`gates.md L0.9b row "${row.raw}": ${e.message}`); continue; }
    for (const p of paths) {
      documentedChecked++;
      if (!schemaFields.includes(p)) {
        fail(`gates.md documents RunArgs field "${p}" (row: ${row.raw}) but domain.schema.json's $defs/RunArgs has no such property — a documented flag with no declared field`);
        continue;
      }
      ok(`RunArgs field "${p}" (gates.md row: ${row.flags.map((f) => `--${f}`).join("/")}) is a real $defs/RunArgs property`);
      if (readerFields.has(p)) {
        ok(`RunArgs field "${p}" is read in shapeup-run.js (args.${p}) — the documented flag reaches a reader`);
      } else {
        fail(`RunArgs field "${p}" is documented at gates.md L0.9b (row: ${row.raw}) and declared in the schema, but shapeup-run.js contains no "args.${p}" — a documented flag that reaches no reader`);
      }
    }
  }
  if (documentedChecked === 0) fail("no non-exempt L0.9b row yielded a field path to check — the table parse or the exemption detector is wrong");
  if (exemptChecked === 0) fail("no L0.9b row is marked exempt — the exemption-verification path above never ran, so it is untested by this suite (gates.md's --wall-clock-budget row should be exempt; see its own text)");

  // --- (3) READER -> SCHEMA: a reader of a field nothing declares is exactly the same defect ----
  let readerChecked = 0;
  for (const p of readerFields) {
    readerChecked++;
    if (schemaFields.includes(p)) {
      ok(`shapeup-run.js's "args.${p}" names a real $defs/RunArgs property`);
    } else {
      fail(`shapeup-run.js reads "args.${p}", which is not a $defs/RunArgs property in domain.schema.json — a reader of a field nothing declares`);
    }
  }
  if (readerChecked === 0) fail("shapeup-run.js yielded no args.<field> reads at all — the reader-extraction regex is not matching this file");

  // --- non-regression: wallClockS is gone from every tier, not merely undocumented -------------
  if (!schemaFields.includes("budgets.wallClockS")) {
    ok("domain.schema.json's $defs/RunArgs.budgets no longer declares wallClockS");
  } else {
    fail("domain.schema.json's $defs/RunArgs.budgets still declares wallClockS — HD-010 chose removal, and the schema was not updated");
  }
  if (!/wallClockS/.test(workflowSrc)) {
    ok("shapeup-run.js's own source no longer mentions wallClockS anywhere");
  } else {
    fail("shapeup-run.js still mentions wallClockS — the RunArgs contract comment (or code) was not updated to match the schema");
  }
}
