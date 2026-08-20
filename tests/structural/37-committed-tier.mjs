// 37 — nothing in the committed tier references the gitignored one.
//
// WHY THIS EXISTS. `shapeup/<slug>/` is committed and cloned; `.shapeup/<slug>/` is gitignored and
// its board ids renumber on every regeneration. A committed file naming a `TASK-` id or a path into
// `.shapeup/` resolves for whoever wrote it and for nobody else — silently, because a dangling join
// and an empty one return the same nothing.
//
// The rule for it already existed and could not see the violation. TIER-DIRECTION walked
// `[[tasks/...]]` wikilinks inside `spec/`, and one `tasks:` frontmatter key in `scopes/`. Neither
// is the form the leak actually takes. Measured across nine completed runs, in seven committed
// artifact types: 264 ids in `spec/synthesis.md`, 183 in `spec/scope-summary.md`, 142 in
// `scopes/*.md` prose, 136 in `scope-board.md`, plus `.shapeup/` paths in nine more files — every
// one of them a bare id in a table cell or a sentence, and every one reported clean.
//
// The template that motivates the strictness states the rule and then breaks it:
// `synthesis.tmpl.md` said "Record only the count + status — never task ids … spec-lint flags
// [[tasks/...]] here as a red TIER-DIRECTION finding", and 110 lines later printed a dependency
// chain, a wave table and a critical path entirely in `TASK-NNN` ids.
//
// WHAT THIS MODULE PROVES:
//   (a) a task id in a committed file is red — prose, table cell and frontmatter alike
//   (b) a path into the LOCAL tier is red
//   (c) naming the tier WITHOUT a path is not red — the rule targets references, not vocabulary
//   (d) a clean committed tree stays clean (the matcher is not merely broad)
//   (e) THE ROOT CAUSE: no shipped template that owns a COMMITTED artifact teaches a task id.
//       That is the check that would have caught synthesis.tmpl.md the day it was written.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const SLUG = "tierdemo";

/** Write a file, creating its directory. @param {string} r Root. @param {string} rel Path. @param {string} b Body. @returns {void} */
const w = (r, rel, b) => { mkdirSync(dirname(join(r, rel)), { recursive: true }); writeFileSync(join(r, rel), b); };

/**
 * Templates whose output lands in the LOCAL tier, where a task id is CORRECT.
 * Everything else under `assets/templates/` owns a committed artifact and must carry none.
 */
const LOCAL_TEMPLATES = new Set(["task.tmpl.md", "task-board.tmpl.md", "task-spike.tmpl.md", "run-state.tmpl.md"]);

/**
 * Run the committed-tier checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("80. No committed artifact references the gitignored tier");
  // =============================================================================

  const { lintCommittedTier } = await import(join(ROOT, "kernel/verify/spec.mjs"));

  /** Findings for a fixture body written at one committed path. @param {string} rel Path. @param {string} body Text. @returns {Array<object>} */
  const lintOne = (rel, body) => {
    const cwd = mkdtempSync(join(tmpdir(), "struct-tier-"));
    try { w(cwd, `shapeup/${SLUG}/${rel}`, body); return lintCommittedTier({ cwd, slug: SLUG }); }
    finally { rmSync(cwd, { recursive: true, force: true }); }
  };

  // --- (a) a task id, in each of the three forms it actually took --------------------------------
  {
    const cases = [
      ["prose",        "spec/synthesis.md",  "The critical path runs TASK-001 → TASK-004 → TASK-006."],
      ["a table cell", "scope-board.md",     "| rules-engine | ICEBERG | TASK-002 | 2 | green |"],
      ["frontmatter",  "scopes/a.md",        "---\nscope_id: a\ntasks: [TASK-004]\n---\n"],
    ];
    let bad = 0;
    for (const [form, rel, body] of cases) {
      const f = lintOne(rel, body).filter((x) => x.rule === "TIER-DIRECTION" && x.level === "red");
      if (!f.length) { bad++; fail(`a task id in ${form} (${rel}) produced no TIER-DIRECTION red — this is the dominant form of the leak, and the pre-fix rule reported every instance of it clean`); }
    }
    if (!bad) ok("a committed task id is red in prose, in a table cell and in frontmatter alike");
  }

  // --- (b) a path into the LOCAL tier ------------------------------------------------------------
  {
    const f = lintOne("REPORT.md", "→ details live in `.shapeup/tierdemo/discovery/ledger.md`.")
      .filter((x) => x.level === "red");
    if (f.length) ok("a path into the gitignored tier is red — it dangles on every other clone");
    else fail("a committed REPORT.md citing `.shapeup/<slug>/discovery/ledger.md` linted clean");
  }

  // --- (c) naming the tier is not referencing it -------------------------------------------------
  {
    const f = lintOne("spec/_index.md", "Run traces are written under `.shapeup` and are not committed.");
    if (!f.length) ok("naming the tier without a path is not a finding — the rule targets references, not vocabulary");
    else fail(`a bare mention of the tier was flagged: ${JSON.stringify(f.map((x) => x.detail.slice(0, 70)))}. ` +
      "A committed doc must still be able to explain the storage model.");
  }

  // --- (d) a clean tree stays clean --------------------------------------------------------------
  {
    const cwd = mkdtempSync(join(tmpdir(), "struct-tier-ok-"));
    try {
      w(cwd, `shapeup/${SLUG}/spec/usecases/UC-01.md`, "---\nid: UC-01\n---\n\n# UC-01\n\n## Steps\n1. [INV-01] go\n");
      w(cwd, `shapeup/${SLUG}/spec/domain-model.md`, "# Domain model\n\n## Entities\n- Todo\n");
      w(cwd, `shapeup/${SLUG}/scopes/add.md`, "---\nscope_id: add\nuse_cases: [UC-01]\ndepends_on: []\n---\n\n# add\n");
      w(cwd, `shapeup/${SLUG}/hill/add.yml`, "scope_id: add\nphase: UPHILL_UNKNOWN\n");
      const f = lintCommittedTier({ cwd, slug: SLUG });
      if (!f.length) ok("a committed tree anchored on UCs and scope_ids produces zero findings");
      else fail(`a clean tree produced ${f.length} finding(s): ${JSON.stringify(f.map((x) => x.detail.slice(0, 80)))}`);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }

  // --- (e) the root cause: no committed-artifact template teaches a task id ----------------------
  {
    // RECURSIVE, deliberately. A flat read missed `contracts/` and `cross-context/` — both of which
    // write into the committed spec tree, and both of which were carrying task ids.
    /** @param {string} d Directory. @param {string} [pre=""] Prefix. @returns {string[]} Relative template paths. */
    const walkTemplates = (d, pre = "") => (existsSync(d) ? readdirSync(d, { withFileTypes: true }) : [])
      .flatMap((e) => (e.isDirectory() ? walkTemplates(join(d, e.name), `${pre}${e.name}/`)
        : e.name.endsWith(".tmpl.md") ? [`${pre}${e.name}`] : []));
    const dir = join(ROOT, "skills/ba-pitch-analyzer/assets/templates");
    const files = walkTemplates(dir);
    if (!files.length) {
      fail(`no templates found under ${dir} — this check cannot run, and a check that silently covers nothing is worse than no check`);
    } else {
      // The LOCAL list must stay honest: an entry naming a template that no longer exists means
      // the exemption has outlived its file and is now blanket cover for whatever replaced it.
      const stale = [...LOCAL_TEMPLATES].filter((f) => !files.includes(f));
      if (!stale.length) ok(`the LOCAL-template exemption list resolves (${LOCAL_TEMPLATES.size} entries)`);
      else fail(`LOCAL_TEMPLATES names ${JSON.stringify(stale)}, which no longer exist — re-classify rather than leaving a dangling exemption`);

      const offenders = [];
      for (const f of files) {
        if (LOCAL_TEMPLATES.has(f)) continue;                 // writes the board — ids are correct there
        const body = readFileSync(join(dir, f), "utf8");
        const hits = body.split(/\r?\n/)
          .map((l, i) => [i + 1, l])
          .filter(([, l]) => /\bTASK-[A-Za-z0-9]/.test(l));
        if (hits.length) offenders.push(`${f}:${hits.map(([n]) => n).slice(0, 4).join(",")}${hits.length > 4 ? "…" : ""} (${hits.length})`);
      }
      if (!offenders.length) {
        ok(`no template owning a committed artifact teaches a task id (${files.length - LOCAL_TEMPLATES.size} checked)`);
      } else {
        fail(`template(s) owning COMMITTED artifacts still print task ids: ${JSON.stringify(offenders)}. ` +
          "A template is the root cause — the runtime lint catches the artifact, this catches the instruction " +
          "that produced it, which is where synthesis.tmpl.md printed 264 of them while stating the rule.");
      }
    }
  }
}
