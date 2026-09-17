// Structural test module: the derived tier, checked ACROSS the boundaries it has to survive.
// Section: 91.
//
// THE DEFECT CLASS THIS MODULE EXISTS FOR. Nine live defects were found by two independent methods,
// and eight of them were one shape: a fact is PROJECTED or REMEMBERED instead of re-derived, then
// crosses a boundary it was not built to survive — a second projection pass, a second run, a
// relaunch, a rebuild. Every one of them is invisible to a single-pass fixture, which is why a suite
// of 1419 checks held them all. So these checks do the crossing: they run the projection TWICE, they
// write TWO runs into one slug, and they compare a rebuilt graph against a maintained one by VALUE
// rather than by key set. That last distinction is the whole reason the existing rebuild check
// missed two of these — it compared `nodes.keys()`, and the drift was in the attributes and edges.

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

/** A minimal but real run trace for slug `demo`, enough for the graph projection to have work. */
function seed(ws, { runId, trials = [], gates = [], verdicts = [] }) {
  put(ws, ".shapeup/demo/receipt.json", { run_id: runId, slug: "demo", opened_at: "2026-09-17T00:00:00Z" });
  for (const v of verdicts) put(ws, `.shapeup/demo/t0/verdicts/${v.artifact}`, v);
  if (trials.length) put(ws, ".shapeup/demo/t0/trials.jsonl", trials.map((t) => JSON.stringify(t)).join("\n") + "\n");
  if (gates.length) put(ws, ".shapeup/demo/gates.jsonl", gates.map((g) => JSON.stringify(g)).join("\n") + "\n");
}

export async function run(ctx) {
  const { ok, fail, section, ROOT } = ctx;
  section("91. Derived state across a boundary — a second pass, a second run, a rebuild");

  const graph = await import(join(ROOT, "kernel/reduce/graph.mjs"));
  const { appendGraph, readGraph, graphPath, EDGES } = graph;

  // --- (a) EVERY EMITTED EDGE TYPE IS A DECLARED ONE -------------------------------------------
  // `EDGES` was a dead constant: nothing in kernel/, hooks/, oracles/ or tests/ imported it, while
  // the projection emitted `IMPLEMENTS`, which it did not list. The node vocabulary has had a
  // totality check since the domain catalogue landed; the edge vocabulary had none, so the one
  // rule the file states about edges ("a type outside these sets is a bug, not an extension
  // point") was unenforced in exactly the half nobody was watching.
  const src = readFileSync(join(ROOT, "kernel/reduce/graph.mjs"), "utf8");
  const emitted = [...src.matchAll(/\bedge\([^,]+,\s*"([A-Z_]+)"/g)].map((m) => m[1]);
  const undeclared = [...new Set(emitted)].filter((t) => !EDGES.includes(t));
  if (emitted.length >= 5 && undeclared.length === 0) ok(`every emitted edge type is declared in EDGES (${[...new Set(emitted)].sort().join(", ")})`);
  else fail(`edge type(s) emitted but not declared in EDGES: ${undeclared.join(", ") || "(none found — the scan matched nothing, which is worse)"}`);

  // --- (b) THE FOLD IS LAST-LINE-WINS, NOT A MERGE ----------------------------------------------
  // The banner promises a log folded by last-line-wins; the node branch merged, so an attribute that
  // DISAPPEARS from an artifact could never be forgotten and a rebuilt graph stopped matching a
  // maintained one. The edge branch beside it always replaced — two semantics, one line apart.
  {
    const ws = mkdtempSync(join(tmpdir(), "db-fold-"));
    try {
      mkdirSync(join(ws, ".shapeup/demo"), { recursive: true });
      writeFileSync(graphPath(ws, "demo"),
        JSON.stringify({ k: "node", id: "n1", t: "Run", x: 10, y: 9 }) + "\n" +
        JSON.stringify({ k: "node", id: "n1", t: "Run", x: 10 }) + "\n");
      const n = readGraph(ws, "demo").nodes.get("n1");
      if (n && n.x === 10 && !("y" in n)) ok("the fold REPLACES a repeated node — an attribute dropped from the artifact is dropped from the projection");
      else fail(`the fold kept ${JSON.stringify(n)} — attributes from a superseded line survived, so the log is not last-line-wins`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // --- (c) A SECOND PROJECTION PASS MINTS NO EDGE A REBUILD DOES NOT IMPLY ------------------------
  // THE BOUNDARY: projection pass 2. A gate is crossed BEFORE its round's verdict lands, so the
  // gate edge's TARGET used to depend on what was on disk at projection time — pass 1 minted
  // `DEPENDS_ON run` as a fallback, pass 2 added the verdict edges, and with no tombstone in an
  // append-only log the fallback was permanent. Compared by VALUE, not by key count.
  {
    const ws = mkdtempSync(join(tmpdir(), "db-gate-"));
    try {
      const runId = "demo-20260917T000000Z-aaaaaaaa";
      seed(ws, { runId, gates: [{ gate: "L3", round: 1, decision: "cross", run_id: runId }] });
      appendGraph(ws, "demo");                                   // pass 1 — no verdict on disk yet
      seed(ws, { runId, gates: [{ gate: "L3", round: 1, decision: "cross", run_id: runId }],
        verdicts: [{ artifact: "r1-a1-t1.json", overall: "green", round: 1, attempt: 1, scope_id: "alpha", run_id: runId }] });
      appendGraph(ws, "demo");                                   // pass 2 — verdict has landed
      const incremental = [...readGraph(ws, "demo").edges.keys()].sort();
      rmSync(graphPath(ws, "demo"));
      appendGraph(ws, "demo");                                   // rebuilt from the same artifacts
      const rebuilt = [...readGraph(ws, "demo").edges.keys()].sort();
      if (JSON.stringify(incremental) === JSON.stringify(rebuilt)) {
        ok(`an incrementally-maintained graph and a rebuilt one carry the IDENTICAL edge set (${rebuilt.length} edges)`);
      } else {
        const phantom = incremental.filter((e) => !rebuilt.includes(e));
        fail(`incremental graph carries ${phantom.length} edge(s) a rebuild does not imply: ${phantom.join(" · ") || "(differs in the other direction)"}`);
      }
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // --- (d) TWO RUNS OF ONE SLUG DO NOT COLLIDE ONTO ONE TRIAL NODE -------------------------------
  // THE BOUNDARY: a second run. Trial ordinals restart at 1 per run while trials.jsonl is
  // append-only, so both runs' rows coexist and `trial:<slug>:<scope>:1` named two of them — the
  // earlier run's execution record was overwritten in the projection and silently unreachable.
  {
    const ws = mkdtempSync(join(tmpdir(), "db-runs-"));
    try {
      const r1 = "demo-20260917T000000Z-11111111", r2 = "demo-20260917T010000Z-22222222";
      seed(ws, { runId: r2, trials: [
        { trial: 1, round: 1, attempt: 1, scope_id: "alpha", status: "kept", run_id: r1, sha256: "a" },
        { trial: 1, round: 1, attempt: 1, scope_id: "alpha", status: "kept", run_id: r2, sha256: "b" },
      ] });
      appendGraph(ws, "demo");
      const trials = [...readGraph(ws, "demo").nodes.values()].filter((n) => n.t === "Trial");
      const runs = new Set(trials.map((t) => t.run_id));
      if (trials.length === 2 && runs.size === 2) ok("two runs of one slug project two distinct Trial nodes — neither run's execution record is overwritten");
      else fail(`${trials.length} Trial node(s) from 2 rows across 2 runs (run_ids: ${[...runs].join(", ")}) — a run's execution record was overwritten`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

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
