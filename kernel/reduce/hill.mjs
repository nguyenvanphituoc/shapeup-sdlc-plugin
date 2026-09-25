#!/usr/bin/env node
// Hill Phase Derivation — phases are derived from facts, never authored
// Mechanical derivation of a scope's hill position based on facts (T0 verdicts, T1 evaluation, and discovery ledger).
// Writes to shapeup/<slug>/hill/<scope-id>.yml

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import { scopesDir, hillDir, verdictsDir, resultsDir, discoveryLedger, receipt, readRunId } from "../lib/paths.mjs";
import { readAllContracts, SCOPE_CONTRACT } from "../lib/contract.mjs";
import { evalVerdict } from "../probe/eval.mjs";
import { redBuildRounds } from "../verify/build.mjs";

// ---------------------------------------------------------------------------------------------
// THE DISCOVERY LEDGER, AND WHY ITS ABSENCE IS NOT A ZERO.
//
// The ledger arm is the only thing that promotes a scope from UPHILL_UNKNOWN to UPHILL_SOLVED —
// "the open questions are closed". It used to be read as `scopeUnknowns[id] || 0`, which made
// "nobody has filed a ledger yet" and "every unknown is closed" the same value, and that value
// selects the FLATTERING phase. An absent value and a real one must not share a signature; when
// they do, the run reports progress it has no evidence for. So the count is `null` — not `0` —
// whenever the ledger could not actually be read and understood, and `null` promotes nothing.
//
// THE HEADING IS THE ATTRIBUTION KEY, and it has to match what the ingest step really writes:
// `## Discovered — <order_id> (<date>)`, where `order_id` is `<slug>/<suffix>`. Two ways that
// parse used to fail silently, both ending in the same false zero:
//   * It required a COLON between the slug and the suffix. The order-envelope schema pins
//     `order_id` to a slug, a SLASH, and a suffix drawn from `[a-z0-9.-]` — a colon cannot appear
//     in a schema-valid order id at all, so the scope was never captured from any real ledger and
//     every scope on every project read zero unknowns regardless of what was open.
//   * It matched the em dash only, so a heading typed with a plain hyphen contributed nothing.
// Both are fixed by matching the dash as a class and splitting the order id on its "/", and by
// resolving the scope against the CONTRACTS ON DISK rather than guessing at the suffix's shape: a
// build suffix is `<scope>-r<N>-a<M>` and a scoped operation's is `<operation>-<scope>[-r<N>]`, so
// a pattern that tried to carve the scope out positionally captured the round suffix along with it.
// ---------------------------------------------------------------------------------------------

/** A ledger block heading, naming the order it files: `## Discovered — <slug>/<suffix> (<date>)`. */
const LEDGER_HEADING = /^##\s+Discovered\s+[—–-]\s+(\S+)/;

/**
 * Index the scopes by the filename-safe form `harness compile` puts in an order suffix, so a
 * heading is matched against ids that actually exist rather than parsed speculatively.
 *
 * @param {Array<object>} scopes - Parsed scope contracts.
 * @returns {Map<string,string>} Compile's suffix form → the contract's own `scope_id`.
 */
function scopeSuffixIndex(scopes) {
  const ix = new Map();
  for (const s of scopes) {
    const id = String(s?.scope_id || "");
    if (!id) continue;
    // Mirrors `harness compile`'s own normalisation of a scope id into an order suffix.
    const key = id.toLowerCase().replace(/[^a-z0-9.-]/g, "-").replace(/^[^a-z0-9]+/, "");
    if (key) ix.set(key, id);
  }
  return ix;
}

/**
 * The scope a ledger heading's order belongs to, or `null` when it belongs to none.
 *
 * Operation-level dispatches (orient, analyze, wire, evaluate, hunt, hammer) carry no scope in
 * their order id by construction, so "no scope" is a real and common answer here, not a parse
 * failure — their rows are feature-wide and are deliberately credited to nobody.
 *
 * @param {string} orderId - The order id as the heading names it (`<slug>/<suffix>`).
 * @param {Map<string,string>} ix - The index from `scopeSuffixIndex`.
 * @returns {string|null} The owning contract's `scope_id`, or null.
 */
function scopeOfHeading(orderId, ix) {
  const slash = orderId.indexOf("/");
  const suffix = slash === -1 ? orderId : orderId.slice(slash + 1);
  const core = suffix.replace(/-r\d+(?:-a\d+)?$/, "");
  // Longest match wins, so a project holding both `pages` and `pages-admin` attributes each
  // heading to the scope it actually names rather than to whichever was indexed first.
  let best = null;
  let bestLen = -1;
  for (const [key, id] of ix) {
    if ((core === key || core.endsWith(`-${key}`)) && key.length > bestLen) { best = id; bestLen = key.length; }
  }
  return best;
}

/**
 * Open unknowns (`~` rows) per scope, read from the discovery ledger.
 *
 * @param {string} ledgerPath - Path to the run's discovery ledger.
 * @param {Array<object>} scopes - Parsed scope contracts, used to attribute each block.
 * @returns {Object<string,number>|null} Counts per `scope_id` — a scope with a block and no open
 *   row is a genuine `0`. `null` means the ledger was NOT read: it is absent, unreadable, or
 *   nothing in it could be attributed to a scope. `null` is never treated as zero, because "we
 *   understood none of this file" is not evidence that nothing is open.
 */
function ledgerUnknowns(ledgerPath, scopes) {
  if (!existsSync(ledgerPath)) return null;
  let text;
  try { text = readFileSync(ledgerPath, "utf8"); } catch { return null; }

  const ix = scopeSuffixIndex(scopes);
  const counts = {};
  let headings = 0;
  let attributed = 0;
  let current = null;

  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      // Reset on EVERY heading, matched or not. Carrying the previous block's scope across an
      // unrecognised heading would credit one scope's open rows to another.
      current = null;
      const m = line.match(LEDGER_HEADING);
      if (!m) continue;
      headings++;
      const id = scopeOfHeading(m[1], ix);
      if (id) { attributed++; current = id; counts[id] = counts[id] || 0; }
      continue;
    }
    if (current && line.startsWith("~ ")) counts[current]++;
  }

  // A ledger whose blocks we could not attribute to a single scope tells us nothing per scope.
  // Reporting that as all-zero is the same false signature the colon-vs-slash bug produced.
  if (headings === 0 || attributed === 0) return null;
  return counts;
}

/**
 * The phase currently recorded in a committed hill shard.
 *
 * @param {string} hDir - The committed hill directory.
 * @param {string} id - Scope id.
 * @returns {string|null} The recorded phase, or null when no shard exists for that scope.
 */
function committedPhase(hDir, id) {
  const p = join(hDir, `${id}.yml`);
  if (!existsSync(p)) return null;
  try { return readFileSync(p, "utf8").match(/^phase:\s*(\S+)/m)?.[1] ?? null; } catch { return null; }
}

/**
 * Derive and write the hill phase for all scopes mechanically based on T0, T1, and ledger facts.
 * 
 * The derived phase follows these progression rules (facts move dots, not authors):
 * - UPHILL_UNKNOWN: open unknowns > 0 in the ledger for this scope — and the floor the scope sits
 *   at whenever the ledger has not answered at all, which is where every run legitimately begins
 * - UPHILL_SOLVED: the ledger was read and reports zero open unknowns, no T0-green yet
 * - DOWNHILL_EXECUTION: ≥1 T0-green in a round whose build gate is not red; T1/seesaw pending
 * - FINISHED: T1 PASS ∧ seesaw green
 *
 * @param {string} cwd - The project root directory.
 * @param {string} slug - The feature slug being built.
 * @returns {Array<{scope_id: string, phase: (string|null), changed: boolean, derived: boolean,
 *   unknowns: (number|null), reason?: string}>} A report of all scopes processed. `derived` says
 *   whether the phase was computed from run evidence at all: when it is false the phase is
 *   whatever the committed shard already records (or null when there is none), nothing was
 *   written, and `reason` names why. `unknowns` is the ledger count behind the phase, or null
 *   when the ledger could not be read — the two are deliberately distinguishable in the output as
 *   well as in the derivation.
 *   Side effects: writes to `shapeup/<slug>/hill/<scope-id>.yml` for each scope, EXCEPT on the
 *   refusal path below, which writes nothing at all.
 */
export function deriveHill(cwd, slug) {
  const scopes = readAllContracts(scopesDir(cwd, slug), SCOPE_CONTRACT).map((x) => x.contract);
  const vDir = verdictsDir(cwd, slug);
  const ledgerPath = discoveryLedger(cwd, slug);
  const hDir = hillDir(cwd, slug);

  // -------------------------------------------------------------------------------------------
  // A DERIVATION THAT CANNOT SEE THE RUN TRACE MUST NOT WRITE THE DELIVERABLE.
  //
  // This function reads one tier and writes the other. Every input below — T0 verdicts, the EVAL
  // results, the round build gates, the discovery ledger — lives in the gitignored run trace,
  // while the shards it writes are committed and outlive it: after a ship the run trace is cleaned
  // up and the shards are the ONLY surviving record of where the work got to. So when the run
  // trace for this slug is not on disk, every input is provably absent, and anything derived from
  // that is derived from nothing.
  //
  // This is not a hypothetical. Pulling a branch mid-run is a supported state: the puller gets the
  // committed spec, scopes and shards and no run trace of their own. Their first launch used to
  // re-derive every scope from the empty set and overwrite the shards with the result — losing
  // committed history rather than misreporting it.
  //
  // WHY REFUSE RATHER THAN WRITE AN "UNKNOWN" PHASE. Writing anything here destroys the record
  // just as thoroughly; a shard that says "I could not look" has still replaced the one that said
  // FINISHED, and the phase enum is a committed data format that a reader parses as current
  // status. Not writing already expresses "no opinion" exactly, and it needs no new enum value.
  //
  // WHY THE CONDITION IS THE TIER'S EXISTENCE AND NOT "the phase would go down". Moving a dot
  // backwards is correct and must stay possible — this is a pure function of the artifacts present
  // and reports what they currently support, in both directions. A guard phrased as "never lower a
  // phase" would quietly turn a derived value into a high-water mark, which is a different defect
  // wearing this one's clothes. The condition is the narrowest one that is positively provable:
  // the RUN is not there — its receipt, the record every run's first act writes. The condition used
  // to be the local root's existence, and any single file satisfies that: `reduce graph` creates
  // `graph.jsonl` under it as a side effect, so a committed-only checkout that ran graph and then
  // hill had its FINISHED shards flattened to UPHILL_UNKNOWN, exit 0, no warning. A backstop whose
  // condition another command satisfies is a backstop only in the order nobody varied.
  // -------------------------------------------------------------------------------------------
  // Evidence the derivation actually needs: the run's receipt, or the T0 verdicts it reads. A
  // `graph.jsonl` alone is neither.
  if (!existsSync(receipt(cwd, slug)) && !existsSync(verdictsDir(cwd, slug))) {
    return scopes.map((s) => ({
      scope_id: s.scope_id,
      phase: committedPhase(hDir, s.scope_id),
      changed: false,
      derived: false,
      unknowns: null,
      reason: "local-run-trace-absent",
    }));
  }

  if (!existsSync(hDir)) mkdirSync(hDir, { recursive: true });

  // 1. Check if T1 Evaluation passed — the LATEST evaluate round's verdict, read the same way
  // GATE L3's own pass/fail branch does (`probe/eval.mjs`'s `evalVerdict()`), not by re-parsing a
  // ledger filename (`.verdicts-run.jsonl`) that `reduce ingest` never actually writes (it writes
  // `.verdicts-<target>.jsonl`, keyed off the order id). That mismatch made `t1Pass` always false,
  // so FINISHED was unreachable through this path regardless of what the run actually produced.
  let t1Pass = false;
  const rDir = resultsDir(cwd, slug);
  if (existsSync(rDir)) {
    let maxRound = 0;
    for (const f of readdirSync(rDir)) {
      const m = f.match(/^evaluate-r(\d+)\.json$/);
      if (m) maxRound = Math.max(maxRound, Number(m[1]));
    }
    if (maxRound > 0) {
      const v = evalVerdict(cwd, slug, maxRound);
      t1Pass = v.found && v.overall === "PASS";
    }
  }

  // 2. T0 facts per scope: has it achieved a green overall verdict? was seesaw also green?
  //
  // MINUS THE ROUNDS WHOSE BUILD GATE IS RED. A T0 verdict is one scope's fixtures inside its own
  // substrate; the round build gate (`verify build`) is the feature's build and launch. Measured on
  // a live run, all fourteen committed shards read DOWNHILL_EXECUTION off T0 verdicts from rounds in
  // which the app never compiled and never launched — the dashboard showed a feature going downhill
  // that had not started. A green fixture in a round the gate failed is not evidence the scope
  // works; it is evidence the fixture does not test the build. No gate artifact at all leaves every
  // verdict counting exactly as before.
  const redRounds = redBuildRounds(cwd, slug);
  const t0Facts = {};
  // This run's verdicts only — a prior run's green over the same slug moved this run's dot.
  const hillRunId = readRunId(cwd, slug);
  if (existsSync(vDir)) {
    for (const f of readdirSync(vDir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const b = JSON.parse(readFileSync(join(vDir, f), "utf8"));
        if (hillRunId && b.run_id && b.run_id !== hillRunId) continue;
        if (!t0Facts[b.scope_id]) t0Facts[b.scope_id] = { hasGreen: false, seesawGreen: false };
        if (b.overall === "green" && !redRounds.has(Number(b.round))) {
          t0Facts[b.scope_id].hasGreen = true;
          // Read the REAL seesaw result off the verdict artifact (`t0.mjs`'s `writeArtifact()`
          // already persists the full `{ran, pass, scopes_checked, failing}` object), rather than
          // inferring it from a false `regression` flag. That inference was vacuously true on every
          // green T0 whether or not a seesaw check ever ran: nothing in this codebase currently
          // passes `--seesaw-registry` to `verify t0`, so `seesaw.ran` is always `false` today and
          // `regression` is always `false` too — "not asked" was being read as "clean," letting a
          // scope reach FINISHED on a regression check that had never executed.
          //
          // Betting Table decision (Phase 3.5 / S4): wiring the seesaw registry for real is a
          // genuine feature with a real running cost (re-running every finished scope's fixtures
          // on every later attempt) and is out of proportion to a certification-gap fix. Deferred,
          // not silently dropped — a scope with no registry wired simply cannot reach FINISHED via
          // this path today, which is the honest state of the system: this check was never really
          // gating FINISHED before either.
          if (b.seesaw?.ran && b.seesaw?.pass) {
            t0Facts[b.scope_id].seesawGreen = true;
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }
  
  // 3. Ledger unknowns per scope — `null` for every scope when the ledger itself was not readable
  //    or nothing in it named a scope (see `ledgerUnknowns`). Only a real count can promote.
  const scopeUnknowns = ledgerUnknowns(ledgerPath, scopes);

  const report = [];
  for (const s of scopes) {
    const id = s.scope_id;
    const t0 = t0Facts[id] || { hasGreen: false, seesawGreen: false };
    // `null` = the ledger did not answer; a number = it did. `|| 0` collapsed the two.
    const unknowns = scopeUnknowns === null ? null : (scopeUnknowns[id] || 0);

    // UPHILL_UNKNOWN is the floor, and the honest answer whenever nothing has promoted a scope off
    // it — including before Orient has filed anything, which is where every run legitimately
    // starts. Only an ANSWERED count of zero promotes to UPHILL_SOLVED; `null` never does.
    let phase = "UPHILL_UNKNOWN";
    if (t1Pass && t0.hasGreen && t0.seesawGreen) {
      phase = "FINISHED";
    } else if (t0.hasGreen) {
      phase = "DOWNHILL_EXECUTION";
    } else if (unknowns === 0) {
      phase = "UPHILL_SOLVED";
    }

    const yaml = `scope_id: ${id}\nphase: ${phase}\n`;
    const out = join(hDir, `${id}.yml`);
    let changed = false;
    if (!existsSync(out) || readFileSync(out, "utf8") !== yaml) {
      writeFileSync(out, yaml);
      changed = true;
    }
    report.push({ scope_id: id, phase, changed, derived: true, unknowns });
  }
  return report;
}

export const ARGV_SPEC = {
  usage: "harness.mjs reduce hill --slug <slug> [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  cwd: { type: "path" },
};

/**
 * Derive each scope's hill phase from its T0 and evaluation artifacts.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; most paths
 *   call `process.exit()` with the subcommand's documented code rather than returning.
 */
export async function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  const report = deriveHill(cwd, args.slug);
  // A refusal that is visible only as a missing write reads exactly like a derivation that
  // happened to agree with what was already on disk, so say it out loud. It is not an error —
  // the caller runs this advisorily several times a run, and declining to derive from nothing is
  // the correct outcome, not a failure — so the exit code stays 0 and the warning goes to stderr.
  const underived = report.filter((r) => r.derived === false);
  if (underived.length) {
    console.error(
      `hill: derived nothing for ${underived.length} scope(s) (${underived[0].reason}) — ` +
      `the run trace this phase is derived from is not on disk, so the committed shards were left as they are.`,
    );
  }
  console.log(JSON.stringify(report, null, 2));
}
