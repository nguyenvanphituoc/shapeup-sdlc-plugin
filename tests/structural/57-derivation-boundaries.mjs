// Structural test module: the derived tier, checked ACROSS the boundaries it has to survive.
// Section: 91.
//
// THE DEFECT CLASS THIS MODULE EXISTS FOR. A fact is DERIVED from input order instead of from the
// input, then crosses a boundary it was not built to survive — a different filesystem, a rewrite.
// Every such defect is invisible to a single-pass fixture, so these checks permute the input and
// round-trip the values.

import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/** Materialise a file, creating its parents. */
const put = (root, rel, body) => {
  const abs = join(root, rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return abs;
};

export async function run(ctx) {
  const { ok, fail, section, ROOT } = ctx;
  section("91. Derived state across a boundary — a second pass, a second run, a rebuild");

  // --- (e) THE DERIVED CHAIN IS ORDER-INVARIANT --------------------------------------------------
  // THE BOUNDARY: a different filesystem. `criticalPath` iterates `for (const t of tasks)` and keeps
  // a chain only on strict `c.hours > best.hours`, so among EQUAL-hours chains it keeps whichever it
  // meets FIRST — which is input order. Its input was an unsorted readdir, so a derived value rode
  // on directory order: APFS returns sorted names and hides it, ext4's hash order does not.
  //
  // ASSERTED ON `criticalPath` DIRECTLY, over permutations of one task list. An earlier version of
  // this check compared `parseBoard`'s output against a sorted copy of itself, which on APFS is true
  // whether or not the code sorts — it asserted a property of this filesystem rather than of the
  // code, and stayed green against the very defect it was written for. Permuting the list in memory
  // reproduces on every machine what only some filesystems would produce on disk.
  {
    const board = await import(join(ROOT, "kernel/reduce/board.mjs"));
    const mk = (id, deps, hours) => ({ id, depends_on: deps, hours, status: "pending" });
    // Two disjoint chains of IDENTICAL summed hours (5) — exactly the tie the strict `>` resolves
    // by arrival order, and the shape a single-ordering fixture can never surface.
    const tasks = [
      mk("TASK-A1", [], 2), mk("TASK-A2", ["TASK-A1"], 3),
      mk("TASK-B1", [], 1), mk("TASK-B2", ["TASK-B1"], 4),
    ];
    const perms = [
      [0, 1, 2, 3], [3, 2, 1, 0], [2, 3, 0, 1], [1, 0, 3, 2], [0, 2, 1, 3],
    ].map((ix) => ix.map((i) => tasks[i]));
    const answers = [...new Set(perms.map((t) => JSON.stringify(board.criticalPath(t))))];
    if (answers.length === 1) {
      ok(`criticalPath returns one answer across ${perms.length} permutations of an equal-hours board — no derived value rides on input order`);
    } else {
      fail(`criticalPath returned ${answers.length} different chains for the same board, by input order alone: ${answers.join("  vs  ")}`);
    }

    // And the reader that feeds it must impose an order of its own rather than pass the directory's
    // through. On a filesystem that already returns sorted names this cannot discriminate, so it
    // SKIPS with a note instead of reporting a green it did not earn — or burning red forever.
    const ws = mkdtempSync(join(tmpdir(), "db-board-"));
    try {
      const dir = join(ws, "tasks");
      mkdirSync(dir, { recursive: true });
      for (const id of ["TASK-004", "TASK-001", "TASK-003", "TASK-002"]) {
        writeFileSync(join(dir, `${id}.md`), `---\nid: ${id}\nstatus: pending\nhours: 2\n---\n`);
      }
      const raw = readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
      const ids = board.parseBoard(dir).map((t) => t.id);
      const sorted = [...ids].sort();
      if (JSON.stringify(ids) !== JSON.stringify(sorted)) {
        fail(`parseBoard returned ${ids.join(", ")} — unsorted, so the tie-break above rides on directory order`);
      } else if (JSON.stringify(raw) === JSON.stringify(sorted)) {
        ok("parseBoard returns sorted tasks (this filesystem returns readdir sorted, so the permutation check above is what carries this property here)");
      } else {
        ok(`parseBoard sorts (${ids.join(", ")}) where readdir handed back ${raw.join(", ")} — directory order does not reach the board`);
      }
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // --- (f) THE CONTRACT ROUND TRIP IS TOTAL, NOT EXEMPLARY ---------------------------------------
  // THE BOUNDARY: a rewrite. A string whose text is a bareword literal changed TYPE on the way
  // through: "false" re-read as the boolean false, "123" as a number, "[a, b]" as a list, "~" as
  // null. Each is a value an author can legitimately put in a cell. Checked as a LAW over a value
  // set rather than at the one point a fixture happened to name.
  {
    const { coerce, uncoerce } = await import(join(ROOT, "kernel/lib/contract.mjs"));
    const VALUES = ["false", "true", "123", "-4", "0", "~", "null", "", "[a, b]", "a, b",
      "plain text", "src/**", '"quoted"', "P1: Composer", true, false, 123, -4, null,
      ["a", "b"], ["x, y"], []];
    const broken = VALUES.filter((v) => JSON.stringify(coerce(uncoerce(v))) !== JSON.stringify(v));
    if (broken.length === 0) ok(`coerce(uncoerce(v)) === v over ${VALUES.length} values spanning every type the dialect carries`);
    else fail(`the round trip changes ${broken.length} value(s): ${broken.map((v) => `${JSON.stringify(v)} -> ${JSON.stringify(coerce(uncoerce(v)))}`).join(" · ")}`);
  }
}
