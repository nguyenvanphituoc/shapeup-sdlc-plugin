// 62 — THE LAUNCH-RECORD SURFACE IS DERIVED, AND A DRIFT BETWEEN ANY TWO TIERS GOES RED.
//
// THE DEFECT THIS CLOSES. A run argument was spelled three ways across three tiers with nothing joining
// them: the intake documentation said `--wall-clock-budget` was a record field, a run script's own comment
// named `budgets.wallClockS`, and `kernel/verify/budget.mjs` read `wall_clock_budget_s` off the run RECEIPT —
// a field `budgets.wallClockS` never was and never reached. A caller following the documented shape got no
// wall-clock breaker and no warning that it had asked for one. Exit 0. Nothing was red.
//
// THE TIERS NOW. The switch table in `skills/building/resources/intake.md` (§7), the `$defs/RunArgs` schema
// def, the argv contract of `init run` (which parses the switches and writes the record) and the kernel
// readers of the record (`probe next`, `reduce ship`, the floor check). The run script that used to be the
// reader is retired; this module is the join those tiers never had, and it reds the moment any two disagree.
//
// WHY THIS MUST BE DERIVED, NEVER TRANSCRIBED (the failure this repo already committed once inside its own
// checker — see `tests/structural/13-argv-contract.mjs`'s banner for the sibling case). Every field and flag
// below comes from Object.keys() over the parsed schema and the imported argv spec, a regex scan of the
// readers' actual source, and a parse of the intake table's own rows — NOT from an array typed into this
// file. A field added to the schema, a row added to the table, or a line added to a reader changes what
// this module reports on its very next run, with no line here touched.
//
// THE FOUR CHECKS, each independently sufficient to catch one of the mutation shapes that produced the defect:
//
//   (0) SWITCH -> LAUNCH  every `--flag` a table row names is declared in `init run`'s argv contract.
//   (1) TABLE -> SCHEMA   every record field a row names (expanding `{a,b}` and `{…}` — the latter from the
//                         SCHEMA's own sub-properties, never a hand list) is a real `$defs/RunArgs` property.
//   (2) SCHEMA -> READER  every one of those fields is actually read by a kernel reader — UNLESS the row is
//                         explicitly marked exempt (a field cell starting `*(…)*`, the table's own convention
//                         for "this switch is consumed somewhere else"), in which case its ALTERNATE path is
//                         checked instead.
//   (3) READER -> SCHEMA  every record field a reader accesses names a real RunArgs property — a reader of a
//                         field nothing declares is exactly as wrong as a switch nothing reads.
//
// THE EXEMPTION ITSELF WAS ONCE THE HOLE. Marking a row exempt used to be sufficient on its own — `ok()` and
// move on, whatever the reason text said. EXECUTED against this repo: rewriting a row to `*(not a field)* —
// consumed elsewhere` and deleting its real reader left the suite green, because "consumed elsewhere" is
// prose nothing ever reads. So an exempt row must name its alternate path in a shape this module can verify —
// `consumed by \`<file>\` as \`<needle>\`` — and this module reads that file and checks the needle is
// really there; see `parseAlternatePath`'s own banner.

import { join } from "node:path";

/** First backtick-quoted span in a table cell, or null. */
function firstBacktickSpan(cell) {
  const m = cell.match(/`([^`]+)`/);
  return m ? m[1].trim() : null;
}

/**
 * Parse the switch -> launch-record-field table out of the intake resource's own markdown, at runtime.
 *
 * @param {string} intakeMd - The full text of `skills/building/resources/intake.md`.
 * @returns {Array<{flags:string[], raw:string, exempt:boolean, reason:(string|null), fieldsRaw:(string|null)}>}
 *   One entry per table row, in document order.
 */
export function parseLaunchRecordTable(intakeMd) {
  const idx = intakeMd.indexOf("## 7. The launch record");
  if (idx === -1) throw new Error("intake.md: no `## 7. The launch record` section found — has the anchor moved or been renamed?");
  const lines = intakeMd.slice(idx).split("\n");
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    if (!inTable) {
      if (/^\|\s*Switch on/.test(line)) inTable = true;
      continue;
    }
    if (/^\|\s*---/.test(line)) continue;
    if (!line.startsWith("|")) break; // table ended
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const [flagsCell, fieldCell] = cells;
    const flags = [...flagsCell.matchAll(/--([a-z][a-z0-9-]*)/g)].map((m) => m[1]);
    const exempt = /^\*\(/.test(fieldCell);
    rows.push({ flags, raw: `${flagsCell} -> ${fieldCell}`, exempt, reason: exempt ? fieldCell : null, fieldsRaw: exempt ? null : fieldCell });
  }
  if (!rows.length) throw new Error("intake.md: the launch-record table parsed to zero rows — the table shape has changed under the parser");
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
  if (!span) throw new Error(`intake.md launch-record row has no backtick field span and is not marked exempt: ${fieldCell}`);
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
 * a row to `*(not a \`RunArgs\` field)* — consumed elsewhere` and then deleting its real
 * reader left the suite green, because "consumed elsewhere" is
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
 * Every launch-record field the kernel's readers actually access — a regex scan of the real sources, never a
 * hand-kept list of what they are believed to read. Each reader names the record by its own variable.
 *
 * @param {Array<[string, string]>} readers - `[variableName, sourceText]` per reader module.
 * @returns {string[]} Distinct dotted paths, in first-seen order.
 */
export function readerFieldsFrom(readers) {
  const seen = new Set();
  for (const [name, src] of readers) {
    const re = new RegExp(`\\b${name}\\.([a-zA-Z_][a-zA-Z0-9_]*)(?:\\.([a-zA-Z_][a-zA-Z0-9_]*))?`, "g");
    let m;
    while ((m = re.exec(src))) seen.add(m[2] ? `${m[1]}.${m[2]}` : m[1]);
  }
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
  section("96. The launch-record surface — derived from the schema, the intake table, the launch and its readers, never typed");
  // =============================================================================

  const domain = readJSON(join(ROOT, "kernel/schemas/domain.schema.json"));
  const runArgsProps = domain.$defs?.RunArgs?.properties;
  if (!runArgsProps) { fail("domain.schema.json: $defs/RunArgs.properties is missing — nothing to derive a surface from"); return; }

  const intakeMd = read(join(ROOT, "skills/building/resources/intake.md"));
  const { ARGV_SPEC } = await import(join(ROOT, "kernel/init/run.mjs"));
  // The three readers of the record, each naming it by its own variable: the state machine (`L`), the
  // ship report's no-evaluation guard (`record`) and the launch check shared with `init run` (`a`).
  const readers = [["L", read(join(ROOT, "kernel/probe/next.mjs"))], ["record", read(join(ROOT, "kernel/reduce/ship.mjs"))], ["a", read(join(ROOT, "kernel/lib/floor.mjs"))]];

  let rows;
  try { rows = parseLaunchRecordTable(intakeMd); }
  catch (e) { fail(`could not parse intake.md's launch-record table: ${e.message}`); return; }
  ok(`parsed ${rows.length} operator-switch row(s) out of intake.md's launch-record table (not a hand-kept list)`);

  const schemaFields = flattenRunArgsFields(runArgsProps);
  ok(`derived ${schemaFields.length} RunArgs field path(s) from domain.schema.json's own $defs/RunArgs (grows with the schema, unedited)`);

  const readerFields = new Set(readerFieldsFrom(readers));
  ok(`derived ${readerFields.size} distinct launch-record access(es) out of the readers' real source`);

  // --- (0) SWITCH -> LAUNCH: every documented switch is one `init run` accepts ----------------------
  for (const row of rows) {
    for (const f of row.flags) {
      if (Object.hasOwn(ARGV_SPEC, f)) ok(`intake.md documents --${f}, and \`init run\` declares it in its own argv contract`);
      else fail(`intake.md documents --${f} but \`init run\` declares no such flag — a documented switch the launch rejects as unknown`);
    }
  }

  // --- (1) TABLE -> SCHEMA, and (2) SCHEMA -> READER for every non-exempt row ----------------------
  let documentedChecked = 0;
  let exemptChecked = 0;
  for (const row of rows) {
    if (row.exempt) {
      const flagLabel = row.flags.map((f) => `--${f}`).join("/");
      exemptChecked++;
      const alt = parseAlternatePath(row.reason);
      if (!alt) {
        fail(`intake.md: "${flagLabel}" is marked exempt (${row.reason.slice(0, 60)}…) but names no ` +
          `verifiable alternate path — an exempt row must read "consumed by \`<file>\` as \`<needle>\`", ` +
          `naming a real file and a literal string this module can check. A reason with no such claim is ` +
          `an unverified escape hatch, not an exemption.`);
        continue;
      }
      let altSrc;
      try { altSrc = read(join(ROOT, alt.path)); }
      catch (e) {
        fail(`intake.md: "${flagLabel}" claims its alternate path is "${alt.path}", which does not exist (${e.code || e.message}) — the exemption's claimed reader cannot be checked, so it does not hold`);
        continue;
      }
      if (altSrc.includes(alt.needle)) {
        ok(`intake.md: "${flagLabel}" is exempt from the record surface, and its claimed alternate path ${alt.path} really contains "${alt.needle}" — a verified escape hatch, not a documentation-only one`);
      } else {
        fail(`intake.md: "${flagLabel}" claims alternate path "${alt.path}" reads "${alt.needle}", but that file contains no such text — the exemption's claimed reader does not exist`);
      }
      continue;
    }
    let paths;
    try { paths = expandFieldPaths(row.fieldsRaw, runArgsProps); }
    catch (e) { fail(`intake.md row "${row.raw}": ${e.message}`); continue; }
    for (const p of paths) {
      documentedChecked++;
      if (!schemaFields.includes(p)) {
        fail(`intake.md documents launch-record field "${p}" (row: ${row.raw}) but domain.schema.json's $defs/RunArgs has no such property — a documented switch with no declared field`);
        continue;
      }
      ok(`launch-record field "${p}" (intake.md row: ${row.flags.map((f) => `--${f}`).join("/")}) is a real $defs/RunArgs property`);
      // A reader of the whole object (`models`) counts for its children only when a child is read; a
      // child that nothing reads is a documented switch that reaches no reader.
      if (readerFields.has(p)) {
        ok(`launch-record field "${p}" is read by a kernel reader — the documented switch reaches one`);
      } else {
        fail(`launch-record field "${p}" is documented (row: ${row.raw}) and declared in the schema, but no kernel reader accesses it — a documented switch that reaches no reader`);
      }
    }
  }
  if (documentedChecked === 0) fail("no non-exempt launch-record row yielded a field path to check — the table parse or the exemption detector is wrong");
  if (exemptChecked === 0) fail("no launch-record row is marked exempt — the exemption-verification path above never ran, so it is untested by this suite (the --wall-clock-budget row should be exempt; see its own text)");

  // --- (3) READER -> SCHEMA: a reader of a field nothing declares is exactly the same defect -----------
  let readerChecked = 0;
  for (const p of readerFields) {
    readerChecked++;
    if (schemaFields.includes(p)) ok(`a kernel reader's "${p}" names a real $defs/RunArgs property`);
    else fail(`a kernel reader accesses "${p}", which is not a $defs/RunArgs property in domain.schema.json — a reader of a field nothing declares`);
  }
  if (readerChecked === 0) fail("the readers yielded no launch-record accesses at all — the reader-extraction regex is not matching these files");

  // --- non-regression: wallClockS is gone from every tier, not merely undocumented ---------------------
  if (!schemaFields.includes("budgets.wallClockS")) ok("domain.schema.json's $defs/RunArgs.budgets does not declare wallClockS");
  else fail("domain.schema.json's $defs/RunArgs.budgets declares wallClockS — the deadline breaker reads the receipt, and a third field nothing reads is the defect");
  if (!/wallClockS/.test(readers.map(([, src]) => src).join("\n"))) ok("no kernel reader mentions wallClockS anywhere");
  else fail("a kernel reader still mentions wallClockS");
}
