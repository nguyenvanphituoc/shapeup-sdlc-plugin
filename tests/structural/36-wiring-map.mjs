// 36 — the wiring map parses, and the projection reads the fields it produces.
//
// WHY THIS EXISTS. `wiring-map.md` is the only artifact that says how each use case's engine
// attaches to the entry point, and it had never been read successfully. Three independent name
// mismatches were stacked on it, each sufficient on its own to yield nothing:
//
//   1. LAYOUT. `solution-architect` was told to write a `{schema_version, feature, entry_point,
//      entries[]}` OBJECT and never told the markdown shape, so every run invented one: a
//      `## Entries` section with a `### UC-xx — title` subsection per use case, each holding a
//      vertical `| Field | Value |` table. WIRING_MAP expects a horizontal table under `## Wiring`.
//   2. FIELD NAME. `reduce graph` read `contract.wiring` / `contract.rows`; WIRING_MAP produces
//      `entries`. So even a correctly-laid-out map projected nothing.
//   3. CELL NAMES. `reduce graph` read `row.seam` / `row.entry_point`; WiringEntry declares
//      `wiring_seam` / `entry_call_site`.
//
// None of them can fail loudly on its own: an absent field and an absent wiring map are the same
// empty array to every reader. Measured before the fix — 9 of 9 committed maps in the corpus parsed
// to ZERO entries with `unreadableReason() === null`, `reduce graph` had never emitted a single
// `Seam` node, and `trace-lint` certified `🟢 green · 0/0 engines reach bin/envlint.mjs` against a
// deliverable whose engines were on disk. That is the gate whose entire purpose is that no engine
// ships orphaned, reporting success for having checked nothing.
//
// WHAT THIS MODULE PROVES:
//   (a) the canonical horizontal table parses
//   (b) the legacy per-UC layout parses to an IDENTICAL object — two spellings of one format,
//       not two formats
//   (c) a map whose per-UC tables cannot be read is LOUD, not empty
//   (d) end to end: `reduce graph` emits Seam nodes and UseCase→Seam edges from a real map.
//       This is the assertion that binds all three mismatches at once.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const SLUG = "wiredemo";

/** Write a file, creating its directory. @param {string} r Root. @param {string} rel Path. @param {string} b Body. @returns {void} */
const w = (r, rel, b) => { mkdirSync(dirname(join(r, rel)), { recursive: true }); writeFileSync(join(r, rel), b); };

const FM = ["---", "schema_version: 1", `feature: ${SLUG}`, "entry_point: bin/app.mjs", "---", ""].join("\n");

/** The shape the skill now specifies. @returns {string} Markdown. */
const canonical = () => [
  FM, "# Wiring Map", "", "## Wiring", "",
  "| use_case | engine | wiring_seam | entry_call_site | affordance |",
  "|---|---|---|---|---|",
  "| UC-01 | src/parse.mjs | argv dispatch calls parseEnv | bin/app.mjs | app <file> |",
  "",
].join("\n");

/** The shape every completed run actually authored. @returns {string} Markdown. */
const legacy = () => [
  FM, "# Wiring Map", "", "## Entries", "", "### UC-01 — Lint Env File", "",
  "| Field | Value |", "|---|---|",
  "| `engine` | src/parse.mjs |",
  "| `wiring_seam` | argv dispatch calls parseEnv |",
  "| `entry_call_site` | bin/app.mjs |",
  "| `affordance` | app <file> |",
  "",
].join("\n");

/**
 * Run the wiring-map checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("79. The wiring map parses, and reduce graph reads the fields it produces");
  // =============================================================================

  const C = await import(join(ROOT, "kernel/lib/contract.mjs"));

  // --- (a) + (b) both layouts, one object -------------------------------------------------------
  {
    const a = C.parseContract(canonical(), C.WIRING_MAP).entries;
    const b = C.parseContract(legacy(), C.WIRING_MAP).entries;
    const want = { use_case: "UC-01", engine: "src/parse.mjs", wiring_seam: "argv dispatch calls parseEnv", entry_call_site: "bin/app.mjs", affordance: "app <file>" };

    if (a?.length === 1 && JSON.stringify(a[0]) === JSON.stringify(want)) {
      ok("the canonical `## Wiring` table parses to the fields WiringEntry declares");
    } else fail(`canonical layout parsed to ${JSON.stringify(a)}; expected one entry ${JSON.stringify(want)}`);

    if (b?.length === 1 && JSON.stringify(b[0]) === JSON.stringify(want)) {
      ok("the legacy per-UC `| Field | Value |` layout parses to an IDENTICAL object — one format, two spellings");
    } else {
      fail(`the legacy layout parsed to ${JSON.stringify(b)}; expected the same entry as the canonical one. ` +
        "Every wiring map committed so far is written this way — if it does not parse, the reachability " +
        "oracle reports 0/0 and certifies green against engines it never looked at.");
    }
  }

  // --- (b2) the migration reader announces itself ------------------------------------------------
  //
  // A fallback that works silently is a fallback forever: the file parses, nothing says it is the
  // old shape, and one artifact keeps two layouts indefinitely. The marker is what lets a reader
  // warn, so the next `wire` converges the file instead of the parser carrying it.
  {
    const legacyParsed = C.parseContract(legacy(), C.WIRING_MAP);
    const canonParsed = C.parseContract(canonical(), C.WIRING_MAP);
    if (legacyParsed[C.LEGACY_LAYOUT] && !canonParsed[C.LEGACY_LAYOUT]) {
      ok("a map read through the migration path is marked legacy; the canonical one is not — the fallback cannot become permanent by silence");
    } else {
      fail(`legacy-layout marker wrong: legacy=${JSON.stringify(legacyParsed[C.LEGACY_LAYOUT])} ` +
        `canonical=${JSON.stringify(canonParsed[C.LEGACY_LAYOUT])}. Without it nothing can tell an ` +
        "author their map is in the old shape, and the reader carries two formats indefinitely.");
    }
  }

  // --- (c) an unreadable map is loud, never empty ------------------------------------------------
  {
    const broken = [FM, "## Entries", "", "### UC-01 — a use case", "", "Some prose and no table at all.", ""].join("\n");
    const c = C.parseContract(broken, C.WIRING_MAP);
    if (!("entries" in c) && C.unreadableReason(c)) {
      ok("a map carrying UC sections this dialect cannot read reports a reason instead of an empty field");
    } else {
      fail(`a UC-sectioned map with no readable table produced entries=${JSON.stringify(c.entries)} and ` +
        `unreadableReason=${JSON.stringify(C.unreadableReason(c))} — "I could not read your table" must never ` +
        "arrive as \"you declared no entries\", which is the whole defect class this contract format exists to close.");
    }
  }

  // --- (d) end to end: the projection actually emits the domain edge -----------------------------
  {
    const box = mkdtempSync(join(tmpdir(), "struct-wiring-"));
    try {
      w(box, `shapeup/${SLUG}/wiring-map.md`, legacy());       // the shape on disk today
      w(box, `shapeup/${SLUG}/project-profile.md`, [FM, "# Profile", ""].join("\n"));
      w(box, `shapeup/${SLUG}/spec/usecases/UC-01.md`, "---\nid: UC-01\n---\n\n# UC-01\n\n## Steps\n1. go\n");
      w(box, `shapeup/${SLUG}/spec/domain-model.md`, "# Domain model\n");

      const { execFileSync } = await import("node:child_process");
      execFileSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "reduce", "graph", "--slug", SLUG, "--cwd", box], { stdio: "pipe" });
      const rows = readFileSync(join(box, `.shapeup/${SLUG}/graph.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l));

      const seams = rows.filter((r) => r.t === "Seam");
      const edges = rows.filter((r) => r.t === "DEPENDS_ON" && String(r.to).startsWith("seam:"));
      if (seams.length === 1 && edges.length === 1 && String(edges[0].from).endsWith(":UC-01")) {
        ok("reduce graph projects a Seam node and a UseCase→Seam edge from a committed wiring map");
      } else {
        fail(`the projection emitted ${seams.length} Seam node(s) and ${edges.length} UseCase→Seam edge(s), expected 1 and 1. ` +
          "Three separate name mismatches each produce exactly this result — the contract field (`entries` vs " +
          "`wiring`), the cell names (`wiring_seam` vs `seam`), and the layout — and none of them can fail loudly.");
      }
    } finally { rmSync(box, { recursive: true, force: true }); }
  }
}
