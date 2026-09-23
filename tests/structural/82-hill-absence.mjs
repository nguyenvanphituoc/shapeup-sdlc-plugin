// 82 — HD-042: `reduce hill` derived a phase from an ABSENCE, and wrote it over the COMMITTED tier.
// Section: 136.
//
// THE DEFECT, driven on 3.7.1 before the fix. `hillDir` resolves under the committed root
// (`shapeup/<slug>/hill/`), while every source `deriveHill()` reads — T0 verdicts, EVAL results,
// round build gates, the discovery ledger — lives in the gitignored `.shapeup/` tree. So the
// function reads the LOCAL tier and writes the COMMITTED one, and nothing checked that the tier it
// read from was there at all. A checkout with the committed shards present and `.shapeup/` absent
// re-derived every scope to `UPHILL_SOLVED` and reported `changed: true`:
//
//   before:  SC-A phase: FINISHED           after:  SC-A phase: UPHILL_SOLVED
//   before:  SC-B phase: DOWNHILL_EXECUTION after:  SC-B phase: UPHILL_SOLVED
//
// That is the most destructive shape a defect in this repo takes: it loses committed history rather
// than misreporting it. The triggering state is one the design documents as SUPPORTED — a second
// developer who pulls a branch mid-run has the shared spec and no local board — and the hill
// dashboard renders an Archived pitch *entirely* from these shards, so the record the archived view
// exists to show is the record this erased. `reduce hill` runs five times per run, starting at Map
// Scopes, so the first launch on that checkout flattened everything.
//
// THREE ABSENCES SHARED ONE SIGNATURE, which is this repo's stated cardinal sin.
//   (1) `unknowns = scopeUnknowns[id] || 0` — "no ledger on disk" and "every unknown closed" are
//       both `0`, and with no green T0 that `0` selects the OPTIMISTIC phase, `UPHILL_SOLVED`.
//   (2) The ledger heading was matched with an em dash, so a heading written with a plain hyphen
//       contributed nothing and read as zero unknowns.
//   (3) Measured while fixing (1) and (2), and worse than either: the heading pattern required a
//       COLON (`/^## Discovered — .*?:([\w.-]+)-a\d+/`) between the slug and the order suffix.
//       `reduce ingest` writes `## Discovered — <slug>/<suffix> (<date>)` with a SLASH, and
//       `work-order.schema.json` pins `order_id` to `^[a-z0-9][a-z0-9-]*/[a-z0-9][A-Za-z0-9.-]*$`
//       — a colon cannot appear in a schema-valid order id. The scope was therefore NEVER captured
//       from any real ledger, so `scopeUnknowns` was permanently `{}` and EVERY scope on EVERY
//       project read zero unknowns no matter how many `~` rows were open. (The colon form was
//       doubly dead: it captured `sc-01-r1`, the scope id with the round suffix still attached,
//       which matches no `scope_id` either.)
//
// WHAT THIS MODULE PINS, and the two traps it is arranged against:
//   (A) The load-bearing case, driven end to end through the real `node kernel/harness.mjs reduce
//       hill` CLI rather than through `deriveHill()`: committed shards present, local tier absent,
//       shards must survive BYTE-FOR-BYTE, and the report must SAY it derived nothing — a refusal
//       that is only visible as a missing write is indistinguishable from a derivation that
//       happened to agree.
//   (B) A legitimate FIRST RUN must still work. Before Orient there is genuinely no ledger, and the
//       run must derive and write — at `UPHILL_UNKNOWN`, the enum's floor, which is exactly what
//       the shipped dashboard already calls "deriveHill()'s own starting default before any
//       evidence promotes it".
//   (C) NON-MONOTONICITY, both directions. The wrong fix for (A) is "never write a lower phase",
//       which would look green against every check above and silently convert a derived value into
//       a high-water mark. A green T0 must still move the dot UP, and deleting that verdict must
//       still move it back DOWN with `changed: true`.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/** Write a file (JSON object or raw string), creating its directory. */
function w(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return p;
}

const SLUG = "hill-absence-demo";

/** One scope contract in the committed tier. */
function scope(cwd, id) {
  w(cwd, `shapeup/${SLUG}/scopes/${id}.json`, {
    schema_version: 1, scope_id: id, allowed_file_substrate: [`src/${id}/**`],
  });
}

/**
 * A discovery-ledger block in the EXACT shape `reduce ingest` appends — `## Discovered — <order_id>
 * (<date>)`, where `order_id` is `<slug>/<suffix>` and a BUILD suffix is `<scope>-r<N>-a<M>`.
 * @param {string} scopeId - The scope the block's order belongs to.
 * @param {string[]} rows - Ledger rows verbatim (`~ …` is an open unknown).
 * @param {string} [dash] - The dash character to write the heading with.
 * @returns {string} The block, leading newline included, as ingest writes it.
 */
const block = (scopeId, rows, dash = "—") =>
  `\n## Discovered ${dash} ${SLUG}/${scopeId}-r1-a1 (2026-09-24)\n${rows.join("\n")}\n`;

/** A green T0 verdict artifact for one scope in a round with no build gate on disk. */
function greenT0(cwd, scopeId, round = 1) {
  return w(cwd, `.shapeup/${SLUG}/t0/verdicts/r${round}-a1-t1.json`, {
    schema_version: 2, round, attempt: 1, trial: 1, scope_id: scopeId, overall: "green",
    fixtures_green: true, db_probe_green: true, seesaw_green: true, regression: false,
    seesaw: { ran: false, pass: true, scopes_checked: [], failing: [] },
  });
}

/** The run's own "a run started here" fact — the local tier exists from this file onwards. */
const receipt = (cwd) => w(cwd, `.shapeup/${SLUG}/receipt.json`, {
  schema_version: 1, run_id: `${SLUG}-20260924T000000Z-0badcafe`, slug: SLUG,
});

/**
 * Run the hill-absence checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const { deriveHill } = await import(join(ROOT, "kernel/reduce/hill.mjs"));

  section("136. A hill phase is never derived from an absence, and never written over a tier it could not read");

  const boxes = [];
  /** A fresh fixture root, cleaned up at the end of the section. */
  const box = () => { const c = mkdtempSync(join(tmpdir(), "struct-hill-absence-")); boxes.push(c); return c; };
  /** The phase currently recorded in a committed shard, or null when there is no shard. */
  const shard = (cwd, id) => {
    const p = join(cwd, "shapeup", SLUG, "hill", `${id}.yml`);
    return existsSync(p) ? (readFileSync(p, "utf8").match(/^phase:\s*(\S+)/m)?.[1] ?? null) : null;
  };

  try {
    // =========================================================================================
    // (A) THE LOAD-BEARING CASE — committed shards present, local tier absent. Driven through the
    //     real CLI, because that is what `shapeup-run.js` invokes five times a run.
    // =========================================================================================
    {
      const cwd = box();
      scope(cwd, "sc-a");
      scope(cwd, "sc-b");
      w(cwd, `shapeup/${SLUG}/hill/sc-a.yml`, "scope_id: sc-a\nphase: FINISHED\n");
      w(cwd, `shapeup/${SLUG}/hill/sc-b.yml`, "scope_id: sc-b\nphase: DOWNHILL_EXECUTION\n");
      const before = {
        "sc-a": readFileSync(join(cwd, "shapeup", SLUG, "hill", "sc-a.yml"), "utf8"),
        "sc-b": readFileSync(join(cwd, "shapeup", SLUG, "hill", "sc-b.yml"), "utf8"),
      };

      if (!existsSync(join(cwd, ".shapeup"))) ok("(A) fixture is the documented pull-mid-run state: committed shards on disk, no local tier at all");
      else fail("(A) fixture built wrong — the local tier exists, so this case proves nothing");

      const r = spawnSync(process.execPath, [KERNEL, "reduce", "hill", "--slug", SLUG, "--cwd", cwd],
        { cwd, encoding: "utf8", timeout: 60_000 });

      // The shards are the whole point: BYTE-for-byte, not merely "still a valid phase".
      const afterA = readFileSync(join(cwd, "shapeup", SLUG, "hill", "sc-a.yml"), "utf8");
      const afterB = readFileSync(join(cwd, "shapeup", SLUG, "hill", "sc-b.yml"), "utf8");
      if (afterA === before["sc-a"] && afterB === before["sc-b"]) {
        ok("(A) `reduce hill` over a checkout with no local tier leaves both committed shards byte-identical — FINISHED and DOWNHILL_EXECUTION both survive");
      } else {
        fail(`(A) COMMITTED SHARDS OVERWRITTEN FROM AN ABSENCE — sc-a ${JSON.stringify(before["sc-a"])} → ${JSON.stringify(afterA)}; sc-b ${JSON.stringify(before["sc-b"])} → ${JSON.stringify(afterB)}`);
      }

      // The refusal must be legible in the report. A no-op that reports a derived phase is
      // indistinguishable from a derivation that agreed with what was already there.
      let rows = null;
      try { rows = JSON.parse(r.stdout); } catch { /* reported below */ }
      if (Array.isArray(rows) && rows.length === 2 && rows.every((x) => x.derived === false && x.changed === false)) {
        ok("(A) every report row says `derived: false, changed: false` — the run can tell a refusal from a derivation");
      } else {
        fail(`(A) the report does not mark the rows underived (exit ${r.status}): ${String(r.stdout).slice(0, 400)}`);
      }
      if (Array.isArray(rows) && rows.every((x) => typeof x.reason === "string" && x.reason.length > 0)) {
        ok("(A) each underived row names why, rather than leaving the caller to infer it");
      } else {
        fail(`(A) underived rows carry no reason: ${String(r.stdout).slice(0, 400)}`);
      }

      // A refusal is the CORRECT answer to "derive from nothing", not a run-killing error: the
      // workflow calls this advisorily and a non-zero exit here would be noise on every pull.
      if (r.status === 0) ok("(A) the refusal exits 0 — deriving nothing from nothing is a correct no-op, not a failure");
      else fail(`(A) refusal exited ${r.status}: ${String(r.stderr).slice(0, 300)}`);
    }

    // =========================================================================================
    // (B) A LEGITIMATE FIRST RUN still works — local tier present, no ledger yet (Orient has not
    //     run), no verdicts. It must WRITE, and it must write the floor, not the optimistic phase.
    // =========================================================================================
    {
      const cwd = box();
      scope(cwd, "sc-a");
      receipt(cwd);
      const rep = deriveHill(cwd, SLUG).find((x) => x.scope_id === "sc-a");
      const wrote = shard(cwd, "sc-a");
      if (rep?.derived === true && rep.changed === true && wrote === rep.phase) {
        ok("(B) a first run with a local tier and no ledger still derives and writes its shard — the fix does not block the state every run starts in");
      } else {
        // Name which of the three conjuncts failed, so this never reads as "wrote nothing" when
        // what actually happened is "wrote, but did not mark the row derived".
        fail(`(B) first-run derive-and-write: derived=${JSON.stringify(rep?.derived)} (want true), changed=${JSON.stringify(rep?.changed)} (want true), shard on disk ${JSON.stringify(wrote)} vs reported phase ${JSON.stringify(rep?.phase)}`);
      }
      if (rep?.phase === "UPHILL_UNKNOWN") {
        ok("(B) no ledger derives UPHILL_UNKNOWN, not UPHILL_SOLVED — 'nobody has looked yet' is not 'every unknown is closed'");
      } else {
        fail(`(B) a missing ledger derived ${JSON.stringify(rep?.phase)} — an absence is still choosing a phase`);
      }
      // The distinction must exist in the OUTPUT too, not only inside the branch: a caller reading
      // the count back must be able to tell "did not answer" from "answered zero".
      if (rep?.unknowns === null) {
        ok("(B) the report carries unknowns: null for a missing ledger — the absent count is a distinct value, not a zero");
      } else {
        fail(`(B) a missing ledger reported unknowns: ${JSON.stringify(rep?.unknowns)} — the absent value still shares a signature with a real one`);
      }
    }

    // =========================================================================================
    // (C) A REAL ledger, in the exact shape `reduce ingest` writes, with one open unknown.
    // =========================================================================================
    {
      const cwd = box();
      scope(cwd, "sc-a");
      receipt(cwd);
      w(cwd, `.shapeup/${SLUG}/discovery/ledger.md`, `# Ledger\n${block("sc-a", ["~ the auth seam is undecided"])}`);
      const rep = deriveHill(cwd, SLUG).find((x) => x.scope_id === "sc-a");
      // ASSERT THE COUNT, NOT ONLY THE PHASE. Mutation-tested: reverting the attribution to the
      // old colon-separated pattern still lands on UPHILL_UNKNOWN, because an unattributable
      // ledger falls back to `unknowns: null` and null also sits at the floor. The phase alone
      // therefore cannot tell "the row was counted" from "the file was not understood"; the count
      // can, and the count is the thing the attribution fix actually restores.
      if (rep?.phase === "UPHILL_UNKNOWN" && rep.unknowns === 1) {
        ok("(C) an open `~` row under ingest's own `<slug>/<scope>-r1-a1` heading is COUNTED (unknowns: 1) and holds the scope at UPHILL_UNKNOWN — the heading a real run writes is actually attributed to its scope");
      } else {
        fail(`(C) an open unknown in a real-shaped ledger gave phase ${JSON.stringify(rep?.phase)} / unknowns ${JSON.stringify(rep?.unknowns)} — want UPHILL_UNKNOWN and a real count of 1; null means the scope was never captured from the heading`);
      }
    }

    // =========================================================================================
    // (D) THE GENUINE ZERO — a ledger that was read, attributed to the scope, with no open row.
    //     Without this, "no phase from an absence" could be satisfied by making UPHILL_SOLVED
    //     unreachable, which kills an enum value instead of fixing a signature collision.
    // =========================================================================================
    {
      const cwd = box();
      scope(cwd, "sc-a");
      receipt(cwd);
      w(cwd, `.shapeup/${SLUG}/discovery/ledger.md`, `# Ledger\n${block("sc-a", ["+ follow-up: rename the handler"])}`);
      const rep = deriveHill(cwd, SLUG).find((x) => x.scope_id === "sc-a");
      if (rep?.phase === "UPHILL_SOLVED" && rep.unknowns === 0) {
        ok("(D) a ledger that WAS read and holds no open `~` for the scope reports unknowns: 0 and derives UPHILL_SOLVED — the real zero survives, only the absent one is gone");
      } else {
        fail(`(D) a genuine zero derived phase ${JSON.stringify(rep?.phase)} / unknowns ${JSON.stringify(rep?.unknowns)} — UPHILL_SOLVED must stay reachable from a real count, or the fix has killed an enum value instead of a signature collision`);
      }
    }

    // =========================================================================================
    // (E) THE PLAIN-HYPHEN HEADING — the third absence that collapsed into the same answer.
    // =========================================================================================
    {
      const cwd = box();
      scope(cwd, "sc-a");
      receipt(cwd);
      w(cwd, `.shapeup/${SLUG}/discovery/ledger.md`, `# Ledger\n${block("sc-a", ["~ still undecided"], "-")}`);
      const rep = deriveHill(cwd, SLUG).find((x) => x.scope_id === "sc-a");
      // Same reasoning as (C): matching the em dash only still lands on UPHILL_UNKNOWN via the
      // null fallback, so the phase cannot see this fix and the COUNT is what pins it.
      if (rep?.phase === "UPHILL_UNKNOWN" && rep.unknowns === 1) {
        ok("(E) a heading written with a plain hyphen is parsed and its open unknown COUNTED (unknowns: 1) — a punctuation mismatch no longer silently discards a block");
      } else {
        fail(`(E) a hyphen-dashed heading gave phase ${JSON.stringify(rep?.phase)} / unknowns ${JSON.stringify(rep?.unknowns)} — want a real count of 1; null means the heading was not recognised at all`);
      }
    }

    // =========================================================================================
    // (F) NON-MONOTONIC, BOTH DIRECTIONS — the guard against the wrong fix for (A).
    // =========================================================================================
    {
      const cwd = box();
      scope(cwd, "sc-a");
      receipt(cwd);
      w(cwd, `.shapeup/${SLUG}/discovery/ledger.md`, `# Ledger\n${block("sc-a", ["+ follow-up: rename the handler"])}`);

      const base = deriveHill(cwd, SLUG).find((x) => x.scope_id === "sc-a");
      const t0Path = greenT0(cwd, "sc-a");
      const up = deriveHill(cwd, SLUG).find((x) => x.scope_id === "sc-a");
      if (base?.phase === "UPHILL_SOLVED" && up?.phase === "DOWNHILL_EXECUTION" && up.changed === true) {
        ok("(F) UP: a green T0 landing on disk moves the committed dot UPHILL_SOLVED → DOWNHILL_EXECUTION with changed: true");
      } else {
        fail(`(F) the dot did not move up on new evidence: ${JSON.stringify(base)} → ${JSON.stringify(up)}`);
      }

      rmSync(t0Path);
      const down = deriveHill(cwd, SLUG).find((x) => x.scope_id === "sc-a");
      if (down?.phase === "UPHILL_SOLVED" && down.changed === true && shard(cwd, "sc-a") === "UPHILL_SOLVED") {
        ok("(F) DOWN: with the verdict gone the dot goes BACK to UPHILL_SOLVED and the shard is rewritten — the fix did not turn a derivation into a high-water mark");
      } else {
        fail(`(F) the dot did not move back down when its evidence was removed: ${JSON.stringify(down)}, shard ${JSON.stringify(shard(cwd, "sc-a"))} — a monotonic derivation is not a derivation`);
      }
    }

    // =========================================================================================
    // (G) THE TIER ROOT IS NOT THE SLUG'S ROOT. Every fixture above puts exactly ONE slug in the
    //     tmp dir, so "`.shapeup/` exists" and "`.shapeup/<slug>/` exists" always happen to agree —
    //     a guard that checks the TIER root (`.shapeup/`) instead of THIS SLUG's own local root
    //     (`.shapeup/<slug>/`, what `localRoot(cwd, slug)` resolves to) would pass every case above
    //     unnoticed. A real repository always has a `.shapeup/` — other features' run traces, the
    //     run pointer, `metrics/`, `workflows/` — so that mutation would clobber committed hill
    //     shards on every pull that lands beside ANY other feature's in-flight run, not only on a
    //     pristine checkout. Here a SIBLING slug's own local trace is genuinely on disk (a second,
    //     unrelated feature mid-run in the same repo) while the slug under test has none at all.
    // =========================================================================================
    {
      const cwd = box();
      scope(cwd, "sc-a");
      w(cwd, `shapeup/${SLUG}/hill/sc-a.yml`, "scope_id: sc-a\nphase: FINISHED\n");
      const before = readFileSync(join(cwd, "shapeup", SLUG, "hill", "sc-a.yml"), "utf8");

      // A different feature, genuinely mid-run, sharing nothing with SLUG but the tier root.
      const SIBLING = "hill-absence-sibling";
      w(cwd, `.shapeup/${SIBLING}/receipt.json`, {
        schema_version: 1, run_id: `${SIBLING}-20260924T000000Z-0badc0de`, slug: SIBLING,
      });

      if (existsSync(join(cwd, ".shapeup")) && !existsSync(join(cwd, ".shapeup", SLUG))) {
        ok("(G) fixture actually separates the two roots: the tier root `.shapeup/` exists (a sibling slug's trace) while this slug's own `.shapeup/<slug>/` does not");
      } else {
        fail("(G) fixture built wrong — the tier root and this slug's own root do not actually differ, so this case cannot distinguish them");
      }

      const r = spawnSync(process.execPath, [KERNEL, "reduce", "hill", "--slug", SLUG, "--cwd", cwd],
        { cwd, encoding: "utf8", timeout: 60_000 });

      const after = readFileSync(join(cwd, "shapeup", SLUG, "hill", "sc-a.yml"), "utf8");
      if (after === before) {
        ok("(G) a sibling slug's local trace does not make `reduce hill` derive for THIS slug — the committed shard survives byte-identical");
      } else {
        fail(`(G) A SIBLING SLUG'S TRACE WAS ENOUGH TO TRIGGER DERIVATION — sc-a ${JSON.stringify(before)} → ${JSON.stringify(after)}; the guard is reading the tier root, not this slug's own`);
      }

      let rows = null;
      try { rows = JSON.parse(r.stdout); } catch { /* reported below */ }
      if (Array.isArray(rows) && rows.length === 1 && rows[0].derived === false && rows[0].changed === false) {
        ok("(G) the report marks the row underived even with a sibling slug's trace present on disk");
      } else {
        fail(`(G) the report does not mark the row underived with a sibling trace present (exit ${r.status}): ${String(r.stdout).slice(0, 400)}`);
      }
      if (r.status === 0) ok("(G) the refusal exits 0 with a sibling's trace on disk, same as with no `.shapeup/` at all");
      else fail(`(G) refusal exited ${r.status}: ${String(r.stderr).slice(0, 300)}`);
    }
  } catch (e) {
    fail(`hill-absence checks threw: ${e && e.stack ? e.stack : e}`);
  } finally {
    for (const c of boxes) rmSync(c, { recursive: true, force: true });
  }
}
