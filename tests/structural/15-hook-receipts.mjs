// Structural test module: every hook decision leaves a receipt (Day-2 leg 3).
//
// THE DEFECT THIS MODULE EXISTS FOR, reproduced by executing every shipped gate:
//
//     $ echo 'NOT JSON AT ALL {{{' | node hooks/<gate>.mjs
//     gate-intake        exit=0   stdout_len=0
//     gate-zerowork      exit=0   stdout_len=0
//     sandbox-guard      exit=0   stdout_len=0
//     safety-spine       exit=0   stdout_len=0
//     gate-deadline      exit=0   stdout_len=0
//     gate-intake        exit=0   stdout_len=0
//     validate-envelope  exit=0   stdout_len=0
//
// exit 0 + silence = allow. It is ALSO what "inspected the board and deferred" looks like, and
// what "no rule matched" looks like, and what a thrown exception looks like, and what F-16 looked
// like — a hook whose entire body silently never ran. Four states, one signature. That
// indistinguishability is why 26 enforcement points sat inert behind 610 green checks while every
// one of them reported success.
//
// FAIL-OPEN IS NOT THE DEFECT and is not changed here: every hook here argues for it correctly in
// its own header — a gate that breaks legitimate runs just gets disabled. This module asserts that
// the direction is UNCHANGED (still exit 0, still no block on a malformed payload) while the
// EVIDENCE is now present.
//
// The predicate is `spoke()` from 11-is-main.mjs — did the tool produce output? — promoted from
// the test harness to runtime and applied to hooks, which closes F-16's whole class rather than
// its instance. This module executes each hook three ways and asserts a decision row exists in
// all three, with the malformed case recorded as `verdict:"error"` specifically.

import { existsSync, mkdtempSync, rmSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/** Every hook, plus validate-envelope's hook mode — discovered, not hand-listed. */
function hookEntries(ROOT) {
  const out = [];
  const hooksDir = join(ROOT, "hooks");
  for (const f of readdirSync(hooksDir)) {
    if (f.endsWith(".mjs")) out.push({ name: f.replace(/\.mjs$/, ""), abs: join(hooksDir, f) });
  }
  out.push({ name: "validate-envelope", abs: join(ROOT, "kernel/harness.mjs"), argv: ["verify", "envelope"] });
  return out.filter((h) => existsSync(h.abs)).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Run one hook against a payload in an isolated cwd, returning its result and the rows it wrote.
 *
 * `SHAPEUP_DECISIONS_PATH` is deliberately UNSET for these spawns. The runner sets it so the rest
 * of the suite cannot contaminate the developer's live ledger — but here the per-workspace path
 * resolution IS the thing under test, and a redirect would send every hook's row to one shared
 * file, making the per-sandbox assertions below vacuous.
 */
function fire(abs, payload, sandbox, argv = []) {
  const env = { ...process.env };
  delete env.SHAPEUP_DECISIONS_PATH;
  const r = spawnSync(process.execPath, [abs, ...argv], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    cwd: sandbox, encoding: "utf8", timeout: 30_000, env,
  });
  // The LOCAL root, resolved the same way lib/paths.mjs resolves it — NOT spelled independently.
  // A test that hardcodes its own copy of the root cannot catch the writer and the reader drifting
  // apart, which is exactly how the receipts ended up in a directory `stats --hooks` never opened.
  const ledger = join(sandbox, ".shapeup", "decisions.jsonl");
  let rows = [];
  if (existsSync(ledger)) {
    rows = readFileSync(ledger, "utf8").split("\n").filter((l) => l.trim())
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  }
  return { exit: r.status, stdout: r.stdout || "", stderr: r.stderr || "", rows };
}

/**
 * Run the structural checks for hook decision receipts.
 * @param {object} ctx - Shared harness context (see tests/lib/harness.mjs).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("44. Every hook records a decision — allow, deny and error stop looking identical");
  // =============================================================================
  const hooks = hookEntries(ROOT);
  // The floor moved 11 → 5 at the v2.0 hook diet, deliberately and on the record: six hooks were
  // deleted because their work moved into the runtime (the L2 signal into the gate block, the
  // deadline into `verify budget`'s round-boundary check, rehydration into `reduce graph
  // --subgraph run`, the leftovers scan into the ship report) — not because enforcement was
  // reduced. What survives is the set that is a WALL: it works under every permission mode and
  // there is no runtime path that can substitute for it.
  //
  // `dispatch-receipt` joined later and is the one entry point here that is NOT a wall — it denies
  // nothing. It belongs in this census anyway, because the failure this module exists for is an
  // enforcement point that silently never ran, and a recorder that never runs is the same defect
  // wearing a different hat: ingest then refuses every orchestrated result in the run.
  if (hooks.length < 6) fail(`expected ≥6 enforcement entry points, found ${hooks.length}`);
  else ok(`${hooks.length} enforcement entry points discovered (${hooks.map((h) => h.name).join(", ")})`);

  // (b) MALFORMED INPUT — the reproduced case. Must still fail open, and must now be recorded
  //     as `error` rather than as the same silence a clean allow produces.
  let recorded = 0;
  for (const { name, abs, argv = [] } of hooks) {
    const sandbox = mkdtempSync(join(tmpdir(), "receipt-"));
    try {
      const r = fire(abs, "NOT JSON AT ALL {{{", sandbox, argv);
      if (r.exit !== 0) { fail(`${name}: malformed payload exited ${r.exit} — fail-open is deliberate and must not change`); continue; }
      if (r.rows.length === 0) {
        fail(`${name}: malformed payload produced exit 0 and NO decision row — indistinguishable from never having run`);
        continue;
      }
      const row = r.rows[r.rows.length - 1];
      if (row.verdict !== "error") fail(`${name}: a malformed payload was recorded as "${row.verdict}", not "error"`);
      else if (row.hook !== name) fail(`${name}: decision row names hook "${row.hook}"`);
      else if (typeof row.pid !== "number" || !row.at) fail(`${name}: decision row lacks pid/at — a receipt must identify the run that wrote it`);
      else { recorded++; ok(`${name}: malformed payload → still exit 0 (fail-open), now recorded verdict:"error"`); }
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  }
  if (recorded === hooks.length) ok(`all ${recorded} enforcement points make "threw" a distinguishable fact`);

  // (a) A VALID, OUT-OF-SCOPE PAYLOAD — the commonest case, and previously the one that was
  //     byte-identical to a hook that never ran. It must record an `allow` with a reason.
  let allows = 0;
  for (const { name, abs, argv = [] } of hooks) {
    const sandbox = mkdtempSync(join(tmpdir(), "receipt-allow-"));
    try {
      // Deliberately something every hook should defer on: a Read of an ordinary file, in a
      // workspace with no harness run at all.
      const r = fire(abs, { tool_name: "Read", tool_input: { file_path: join(sandbox, "readme.md") }, cwd: sandbox, source: "startup", trigger: "manual" }, sandbox, argv);
      if (r.exit !== 0) { fail(`${name}: an out-of-scope payload exited ${r.exit}, expected 0`); continue; }
      if (r.rows.length === 0) { fail(`${name}: an out-of-scope payload left no decision row — "permitted" is still indistinguishable from "never ran"`); continue; }
      const row = r.rows[r.rows.length - 1];
      if (row.verdict !== "allow") { fail(`${name}: expected an allow on an out-of-scope payload, got "${row.verdict}" (${row.reason})`); continue; }
      if (!row.reason) { fail(`${name}: allow row carries no reason — the receipt has to say WHY it permitted`); continue; }
      allows++;
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  }
  if (allows === hooks.length) ok(`all ${allows} enforcement points record a REASONED allow — the four silent states are now separable`);
  else ok(`${allows}/${hooks.length} enforcement points recorded a reasoned allow on an out-of-scope payload`);

  // (c) A DENY-TRIGGERING PAYLOAD — the deny must still reach stdout AND be recorded.
  const denyCases = [
    {
      name: "gate-intake",
      payload: { tool_name: "Skill", tool_input: { skill_name: "tech-lead", skill_args: "--unattended --gate-answers ci" } },
      rule: "empty-intake",
    },
    {
      name: "safety-spine",
      payload: { tool_name: "Bash", tool_input: { command: "rm -rf /" } },
      rule: "destructive-fs",
    },
  ];
  for (const c of denyCases) {
    const hook = hooks.find((h) => h.name === c.name);
    if (!hook) { fail(`deny case names a missing hook: ${c.name}`); continue; }
    const sandbox = mkdtempSync(join(tmpdir(), "receipt-deny-"));
    try {
      const r = fire(hook.abs, { ...c.payload, cwd: sandbox }, sandbox, hook.argv || []);
      if (r.exit !== 0) { fail(`${c.name}: a deny must still exit 0 (the decision rides on stdout), got ${r.exit}`); continue; }
      if (!/permissionDecision"?\s*:\s*"deny"/.test(r.stdout)) { fail(`${c.name}: deny payload did not reach stdout`); continue; }
      const row = r.rows[r.rows.length - 1];
      if (!row) { fail(`${c.name}: a DENY left no decision row`); continue; }
      if (row.verdict !== "deny") fail(`${c.name}: deny recorded as "${row.verdict}"`);
      else if (row.rule !== c.rule) fail(`${c.name}: deny row names rule "${row.rule}", expected "${c.rule}"`);
      else ok(`${c.name}: deny reaches stdout AND is recorded with its rule (${c.rule})`);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  }

  // The receipt is best-effort: an unwritable ledger must never turn into a failed tool call.
  // A receipt that can break a run is a receipt that gets the whole layer disabled.
  {
    const sandbox = mkdtempSync(join(tmpdir(), "receipt-blocked-"));
    try {
      // Occupy the LOCAL root with a FILE, so mkdir/append cannot succeed.
      writeFileSync(join(sandbox, ".shapeup"), "not a directory");
      const probe = hooks.find((h) => h.name === "gate-intake");
      const r = fire(probe.abs, { tool_name: "Read", cwd: sandbox }, sandbox);
      if (r.exit === 0) ok("an unwritable decisions.jsonl does not break the hook — the receipt is best-effort by design");
      else fail(`gate-intake exited ${r.exit} when the decision ledger was unwritable — a receipt must never fail a run`);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  }

  // gate-zerowork's second condition: zero rows means the enforcement layer itself was inert.
  {
    const gz = await import(join(ROOT, "hooks/gate-zerowork.mjs"));
    const sandbox = mkdtempSync(join(tmpdir(), "receipt-census-"));
    // This block runs IN-PROCESS, where the runner's SHAPEUP_DECISIONS_PATH is set. The census
    // honours that override (it must — it has to look where rows are actually written), so clear
    // it here or the census reads the runner's own ledger instead of this sandbox.
    const saved = process.env.SHAPEUP_DECISIONS_PATH;
    delete process.env.SHAPEUP_DECISIONS_PATH;
    try {
      const none = gz.enforcementCensus(sandbox);
      if (none.rows === 0 && none.readable === false) ok("enforcementCensus reports an ABSENT ledger as unreadable — an absence proves nothing and must not sharpen the message");
      else fail(`enforcementCensus mis-read a missing ledger: ${JSON.stringify(none)}`);
      mkdirSync(join(sandbox, ".shapeup"), { recursive: true });
      writeFileSync(join(sandbox, ".shapeup", "decisions.jsonl"), JSON.stringify({ hook: "gate-intake", verdict: "allow" }) + "\n");
      const some = gz.enforcementCensus(sandbox);
      if (some.rows === 1 && some.readable) ok("enforcementCensus counts real decision rows — 'the gates didn't run' no longer depends on the gates running");
      else fail(`enforcementCensus mis-counted a populated ledger: ${JSON.stringify(some)}`);
    } finally {
      if (saved !== undefined) process.env.SHAPEUP_DECISIONS_PATH = saved;
      rmSync(sandbox, { recursive: true, force: true });
    }
  }

  // stats --hooks is the Day-2 instrument: it must separate a fire count from a denial count.
  {
    const { hooksReport } = await import(join(ROOT, "kernel/probe/stats.mjs"));
    const rep = hooksReport([
      { hook: "gate-intake", verdict: "allow", rule: "intake-present" },
      { hook: "gate-intake", verdict: "deny", rule: "no-intake" },
      { hook: "gate-intake", verdict: "error" },
      { hook: "compact-snapshot", verdict: "allow", rule: "snapshot-written" },
    ]);
    const l2 = rep.per_hook.find((h) => h.hook === "gate-intake");
    if (rep.evaluations === 4 && l2.evaluations === 3 && l2.deny === 1 && l2.error === 1 && l2.allow === 1) {
      ok("stats --hooks separates evaluations / denials / errors per hook — the Day-2 exit instrument");
    } else fail(`hooksReport mis-aggregated: ${JSON.stringify(rep)}`);
    const empty = hooksReport([]);
    if (empty.evaluations === 0 && empty.hooks === 0) ok("stats --hooks reports zero evaluations as a FACT (an inert layer), not as an error");
    else fail("hooksReport did not handle an empty ledger");
  }
}
