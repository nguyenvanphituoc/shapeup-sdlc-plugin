// breadboard — read a `/shapeup` breadboard's element ids out of its markdown tables.
//
// WHY THIS EXISTS. A pitch is two files: `shaping.md` (problem, requirements, parts) and
// `breadboard.md` (Places, affordances, slices). The run used to take only the first, so a Place
// that existed only in the breadboard — a new sheet, a new modal — reached no planning worker, and
// the spec folded it into whichever screen the prose happened to mention. The ids read here are what
// the run pins at open (the receipt's counts) and what spec-lint checks placement against.
//
// WHAT IT READS, and nothing more. An element id is the FIRST cell of a markdown table row —
// `P1`, `P2.1`, `U3`, `N1b`, `S2`, `V4` — after stripping `**` and backticks, so both table layouts
// the breadboarding guide ships parse the same way: a `#` first column and an `ID` first column. A
// row's Places come from its `Place` column, every `P#` token in the cell (`P1 / P3`, `P2/P1`); a
// table with no Place column gives its rows no Places. Places may also be listed as prose under a
// `## Places` heading (`P1: Composer — …`), which is the guide's own output template.
//
// It skips fenced code blocks: a table inside a fence is an example of a breadboard, not this one.
//
// Tolerant by design. A layout this reader cannot parse yields zero ids, and every caller treats
// zero ids as "nothing to check" plus a warning — never as a hard stop. Zero dependencies.

/** A first-cell element id: a Place (`P1`, `P2.1`), or a UI/code affordance, store or slice. */
export const ID_PATTERN = /^(P\d+(?:\.\d+)*|[UNSV]\d+[a-z]?)$/;

/** Every Place reference inside a cell. Global — use with `match`, never `test`. */
const PLACE_REF = /\bP\d+(?:\.\d+)*\b/g;

/** A prose Place line under `## Places`: `P1: …`, `- P1 — …`, `**P2** – …`. */
const PROSE_PLACE = /^\s*(?:[-*+]\s+)?\**(P\d+(?:\.\d+)*)\**\s*[:—–-]\s*(.*)$/;

/**
 * Split one markdown table row into trimmed cells.
 * @param {string} line - A line that starts with `|`.
 * @returns {string[]} The cells between the outer pipes.
 */
function cells(line) {
  const t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return t.split("|").map((c) => c.trim());
}

/**
 * Strip the emphasis and code marks a breadboard author puts around an id.
 * @param {string} cell - A raw table cell.
 * @returns {string} The cell's text without `**` and backticks.
 */
function bare(cell) {
  return String(cell ?? "").replace(/\*\*/g, "").replace(/`/g, "").trim();
}

/**
 * Is this line a table's header separator (`|---|:--:|`)?
 * @param {string} line - A table line.
 * @returns {boolean} True for a separator row.
 */
function isSeparator(line) {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
}

/**
 * Parse a breadboard's element ids.
 *
 * @param {string} text - The breadboard markdown (or a pitch that carries one inline).
 * @returns {{places: {id: string, name: string}[], ui: {id: string, places: string[]}[],
 *   code: {id: string, places: string[]}[], stores: {id: string, places: string[]}[],
 *   slices: {id: string}[]}} Every id found, de-duplicated by id; a repeated row merges its Places.
 */
export function parseBreadboard(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const places = new Map();
  const byKind = { U: new Map(), N: new Map(), S: new Map(), V: new Map() };

  const addPlace = (id, name) => {
    if (!places.has(id)) places.set(id, { id, name: name || "" });
    else if (!places.get(id).name && name) places.get(id).name = name;
  };
  const addElement = (id, refs) => {
    const m = byKind[id[0]];
    if (!m.has(id)) m.set(id, new Set());
    for (const p of refs) m.get(id).add(p);
  };

  let inFence = false;
  let inPlacesSection = false;
  let header = null; // the current table's header cells, lower-cased
  let prevWasTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; prevWasTable = false; header = null; continue; }
    if (inFence) continue;

    const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (heading) {
      inPlacesSection = /^places\b/i.test(bare(heading[1]));
      prevWasTable = false; header = null;
      continue;
    }

    if (/^\s*\|/.test(line)) {
      if (!prevWasTable) {
        // A table starts here. Its first line is the header when the next line is a separator.
        header = isSeparator(lines[i + 1] ?? "") ? cells(line).map((c) => bare(c).toLowerCase()) : null;
        prevWasTable = true;
        if (header) continue;
      }
      if (isSeparator(line)) continue;
      const row = cells(line);
      const id = bare(row[0]);
      if (!ID_PATTERN.test(id)) continue;
      const placeCol = header ? header.indexOf("place") : -1;
      if (id[0] === "P") {
        const nameCol = placeCol > 0 ? placeCol : (header ? header.findIndex((h) => h === "name") : -1);
        addPlace(id, bare(row[nameCol > 0 ? nameCol : 1] ?? ""));
      } else {
        const cell = placeCol > 0 ? bare(row[placeCol] ?? "") : "";
        addElement(id, cell.match(PLACE_REF) ?? []);
      }
      continue;
    }
    prevWasTable = false; header = null;

    if (inPlacesSection) {
      const m = line.match(PROSE_PLACE);
      if (m) addPlace(m[1], bare(m[2]).split(/\s+[—–-]\s+/)[0]);
    }
  }

  const list = (m) => [...m].map(([id, refs]) => ({ id, places: [...refs] }));
  return {
    places: [...places.values()],
    ui: list(byKind.U),
    code: list(byKind.N),
    stores: list(byKind.S),
    slices: [...byKind.V.keys()].map((id) => ({ id })),
  };
}

/**
 * Does this text carry a breadboard of its own — at least one Place and one UI affordance?
 *
 * The test for a pitch that embeds its breadboard inline rather than as a second file. Both are
 * required: a shaping doc routinely has tables, and a Place with nothing to place is not a
 * breadboard anything downstream can check.
 *
 * @param {string} text - Markdown to inspect.
 * @returns {boolean} True when `parseBreadboard` finds a P# and a U#.
 */
export function hasBreadboardTables(text) {
  const bb = parseBreadboard(text);
  return bb.places.length > 0 && bb.ui.length > 0;
}

/**
 * Count a parsed breadboard's ids by kind, the shape the run receipt records.
 * @param {ReturnType<typeof parseBreadboard>} parsed - A `parseBreadboard` result.
 * @returns {{P: number, U: number, N: number, S: number, V: number}} Ids per kind.
 */
export function idCounts(parsed) {
  return {
    P: parsed.places.length,
    U: parsed.ui.length,
    N: parsed.code.length,
    S: parsed.stores.length,
    V: parsed.slices.length,
  };
}
