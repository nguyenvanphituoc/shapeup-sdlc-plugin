#!/usr/bin/env node
// probe concurrency — "how many legs actually ran at once, and what did that buy?"
//
// WHY IT EXISTS. Fanning the scope loop out has three acceptance questions — did two scopes ever
// run at the same time, did shared state survive it, did wall-clock improve — and all three are
// MEASUREMENTS. The pipeline emitted no measurement: the first claim that legs ran in parallel came
// from a probe that counted green results, which is satisfied by three legs run one after another.
// This is the missing instrument. It writes nothing and answers only from records on disk.
//
// THE RULE IT IS BUILT AROUND. A predicate that an ABSENCE can satisfy must report that absence in
// the same value. `max_concurrent: 1` over four legs and one usable record is not a small number,
// it is a false one — and it reads exactly like a run that was genuinely sequential. So every
// figure here travels with the completeness of the record set it came from and with a `bound`
// saying whether it is exact or a floor, and a speedup that cannot be supported is `null` with the
// reason, never a plausible-looking ratio.
//
// WHERE THE TWO ENDS OF A LEG COME FROM.
//
//   start  `receipts/dispatch.jsonl` — a PostToolUse row, written when the Skill RESOLVED. Measured
//          across real runs it lands 1.8–47 s after the order was compiled, on legs that then ran
//          for minutes: it is a start, and being hook-written and append-only it is the one start
//          that survives a relaunch re-writing the order file.
//   end    `legs.jsonl` — the reducer's leg-completion row. EXACT.
//          Falling back, for a run recorded before that ledger existed: the last T0 trial the leg
//          wrote inside its own dispatch window. That is a landmark near the end, not the end, so
//          every figure derived through it is marked a LOWER bound.
//
// WHAT IS DELIBERATELY NOT USED: result-file mtimes. A trace that has been copied carries the copy
// time on every file, so a measurement built on them is fabricated rather than approximate.
//
// Usage: node kernel/harness.mjs probe concurrency --slug <slug> [--cwd <dir>] [--run-root <dir>]
//                                                  [--round N] [--gap-s N] [--format json|table]
// Exit:  0 = a report was produced with at least one usable leg · 1 = ran, and no leg in scope had
//        a usable interval (the report still prints, and says why) · 2 = malformed argv.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import { localRoot, runIdFromRoot, RECEIPT_FILE } from "../lib/paths.mjs";

/** The round-addressed order id forms `<scope>-r<N>-a<M>` and `<phase>-r<N>`. */
const ROUND_SUFFIX = /^(.*?)-r(\d+)(?:-a(\d+))?$/;

/** Default fan-out width when a run's `run-args.json` declares none — mirrors the orchestrator. */
export const DEFAULT_MAX_PARALLEL_SCOPES = 4;

/** Default relaunch gap, in seconds. A run resumed after this long is a different launch. */
export const DEFAULT_GAP_S = 900;

/**
 * Read a JSONL ledger into rows, skipping torn lines rather than throwing.
 * @param {string} path - Path to a `.jsonl` file.
 * @returns {{rows:Array<object>, malformed:number, present:boolean}} Parsed rows and how many
 *   lines could not be parsed — reported, because a ledger half of which is unreadable must not
 *   look like a short one.
 */
export function readLedger(path) {
  if (!existsSync(path)) return { rows: [], malformed: 0, present: false };
  let malformed = 0;
  const rows = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { malformed++; }
  }
  return { rows, malformed, present: true };
}

/**
 * Split an order id into the scope/phase name and the round-attempt address it encodes.
 * @param {string} orderId - e.g. `todo-cli/foundation-r2-a1`.
 * @returns {{name:(string|null), round:(number|null), attempt:(number|null)}}
 */
export function addressOf(orderId) {
  const suffix = String(orderId ?? "").split("/").slice(1).join("/");
  if (!suffix) return { name: null, round: null, attempt: null };
  const m = suffix.match(ROUND_SUFFIX);
  if (!m) return { name: suffix, round: null, attempt: null };
  return { name: m[1], round: Number(m[2]), attempt: m[3] === undefined ? null : Number(m[3]) };
}

/**
 * Every build dispatch's start, from the hook-written receipt ledger.
 *
 * BUILD LEGS ONLY, and the count of what was skipped travels with the answer. ORIENT, ANALYZE,
 * WIRE, EVAL and GATE H are sequential phases in every lane; folding them into a concurrency figure
 * would dilute exactly the number the fan-out is judged on. A leg qualifies by carrying an attempt
 * address (`-r<N>-a<M>`), which only a scope build order does.
 *
 * @param {Array<object>} receipts - Rows from `receipts/dispatch.jsonl`.
 * @returns {{starts:Array<object>, phase_dispatches:number}} Starts sorted by time.
 */
export function startsFrom(receipts) {
  const starts = [];
  let phase = 0;
  for (const r of receipts) {
    const { name, round, attempt } = addressOf(r.order_id);
    const at = Date.parse(r.at);
    if (attempt === null || !Number.isFinite(at)) { phase++; continue; }
    starts.push({ order_id: r.order_id, scope_id: name, round, attempt, start: at, start_source: "dispatch-receipt", run_id: r.run_id ?? null });
  }
  starts.sort((a, b) => a.start - b.start || String(a.order_id).localeCompare(String(b.order_id)));
  return { starts, phase_dispatches: phase };
}

/**
 * Attach an end to every start.
 *
 * THE PAIRING PROBLEM THIS SOLVES. One order id is dispatched many times — a relaunch re-uses the
 * path verbatim — so "the completion row for this order" is ambiguous and picking the newest would
 * hand every earlier dispatch the last one's end. Each start therefore claims only what falls
 * inside its own window: from its own instant up to the NEXT dispatch OF THE SAME SCOPE AND ROUND.
 *
 * The window is keyed by scope+round rather than by order id, and the difference is not cosmetic.
 * Windowing by order id let one archived leg claim a T0 artifact written by a LATER dispatch of the
 * same scope under a different attempt number — a leg that had actually died came back with a
 * seventeen-minute duration. A leg for scope S in round R is over the moment anything else is
 * dispatched for S in R, whatever attempt it is addressed by.
 *
 * Exact ends come from the leg ledger. When a start's window holds none — every run recorded before
 * that ledger existed, and every leg that died before ingest — the last T0 trial the scope wrote
 * inside the same window stands in, and the leg is marked a lower bound rather than a fact.
 *
 * @param {Array<object>} starts - From {@link startsFrom}.
 * @param {Array<object>} legRows - Rows from `legs.jsonl`.
 * @param {Array<object>} trials - Rows from `t0/trials.jsonl`.
 * @returns {Array<object>} One leg per start, `end` null when nothing closed it.
 */
export function pairLegs(starts, legRows, trials) {
  const sameLeg = (a, b) => a.scope_id === b.scope_id && a.round === b.round;
  const nextOf = new Map();
  for (let i = 0; i < starts.length; i++) {
    for (let j = i + 1; j < starts.length; j++) {
      if (sameLeg(starts[j], starts[i])) { nextOf.set(i, starts[j].start); break; }
    }
  }
  return starts.map((s, i) => {
    const until = nextOf.get(i) ?? Infinity;
    const inWindow = (t) => Number.isFinite(t) && t >= s.start && t < until;

    const exact = legRows
      .filter((r) => r.order_id === s.order_id && inWindow(Date.parse(r.ingested_at)))
      .map((r) => Date.parse(r.ingested_at)).sort((a, b) => a - b);
    if (exact.length) {
      return { ...s, end: exact[exact.length - 1], end_source: "leg-record", bound: "exact" };
    }

    const landmarks = trials
      .filter((t) => t.scope_id === s.scope_id && Number(t.round) === s.round && inWindow(Date.parse(t.at)))
      .map((t) => Date.parse(t.at)).sort((a, b) => a - b);
    if (landmarks.length) {
      return { ...s, end: landmarks[landmarks.length - 1], end_source: "t0-landmark", bound: "lower" };
    }
    return { ...s, end: null, end_source: null, bound: null };
  });
}

/**
 * Split legs into launches.
 *
 * A run keeps one `run_id` across every relaunch — the key is derived from the receipt, and a
 * resumed run reads the same receipt — so a span taken over all of a run's legs fuses launches that
 * were hours apart. Measured on one archived run: four launches under one key, 17:18 to 03:35, of
 * which the great majority is a laptop being closed.
 *
 * There is no launch id in the record set, so this is a GAP HEURISTIC and it says so: the rule and
 * its threshold are in the report, because a heuristic that hides is indistinguishable from a fact.
 *
 * @param {Array<object>} legs - Legs with a usable interval, sorted by start.
 * @param {number} gapMs - A quiet period longer than this starts a new launch.
 * @returns {Array<Array<object>>} One group per launch.
 */
export function segment(legs, gapMs) {
  if (!legs.length) return [];
  const out = [[legs[0]]];
  let high = legs[0].end;
  for (const leg of legs.slice(1)) {
    if (leg.start - high > gapMs) { out.push([leg]); } else { out[out.length - 1].push(leg); }
    high = Math.max(high, leg.end);
  }
  return out;
}

/**
 * The greatest number of legs open at one instant, and when it happened.
 *
 * Ends are processed before starts at the same millisecond, so a leg that closes exactly as the
 * next one opens is not counted as an overlap. Two legs are concurrent only if they were both
 * genuinely running, and a tie at the boundary is the case where that is least certain.
 *
 * @param {Array<object>} legs - Legs with `start` and `end`.
 * @returns {{max:(number|null), at:(number|null)}} `null` when there is nothing to measure — never
 *   `0` or `1`, which a reader would take for a sequential run.
 */
export function maxConcurrent(legs) {
  if (!legs.length) return { max: null, at: null };
  const events = [];
  for (const l of legs) { events.push([l.start, 1]); events.push([l.end, -1]); }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let open = 0, max = 0, at = null;
  for (const [t, delta] of events) {
    open += delta;
    if (open > max) { max = open; at = t; }
  }
  return { max, at };
}

/**
 * The waves the run actually ran, derived from the timings rather than from the scheduler.
 *
 * A wave is a connected component of overlapping intervals: legs that ran together, bounded by
 * quiet moments where nothing was in flight. This is an INDEPENDENT reading of the schedule — if
 * the scheduler claims a dependency ordering, this is where it either shows up or does not.
 *
 * @param {Array<object>} legs - Legs with a usable interval, sorted by start.
 * @returns {Array<{from:string, to:string, scopes:string[]}>} Waves in start order.
 */
export function wavesObserved(legs) {
  const waves = [];
  for (const leg of legs) {
    const last = waves[waves.length - 1];
    if (last && leg.start < last.endMs) {
      last.members.push(leg);
      last.endMs = Math.max(last.endMs, leg.end);
    } else {
      waves.push({ startMs: leg.start, endMs: leg.end, members: [leg] });
    }
  }
  return waves.map((w) => ({
    from: new Date(w.startMs).toISOString(),
    to: new Date(w.endMs).toISOString(),
    scopes: [...new Set(w.members.map((m) => m.scope_id))].sort(),
  }));
}

/**
 * Summarise one launch: overlap, span, work, and whether a speedup can honestly be stated.
 *
 * WHY A SPEEDUP IS REFUSED ON ANY LOWER-BOUND LEG, and it is not caution. Truncating every leg at
 * its T0 landmark shortens the numerator once per leg and the denominator only for whichever leg
 * finished last, so the ratio moves in a direction that depends on the shape of the round. Measured
 * on a real round that demonstrably ran four scopes at once, the truncated figure is 0.90 — a
 * "speedup" below 1. A ratio of two lower bounds is not a bound on the ratio.
 *
 * @param {number} index - 1-based launch number.
 * @param {Array<object>} legs - The launch's legs, each with a usable interval.
 * @returns {object} The launch block of the report.
 */
export function summarise(index, legs) {
  const { max, at } = maxConcurrent(legs);
  const exact = legs.every((l) => l.bound === "exact");
  const from = Math.min(...legs.map((l) => l.start));
  const to = Math.max(...legs.map((l) => l.end));
  const span = to - from;
  const sum = legs.reduce((a, l) => a + (l.end - l.start), 0);
  const bound = exact ? "exact" : "lower";
  return {
    launch: index,
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    legs: legs.length,
    max_concurrent: max,
    max_concurrent_at: at === null ? null : new Date(at).toISOString(),
    max_concurrent_bound: bound,
    span_ms: span,
    span_bound: bound,
    sum_leg_ms: sum,
    sum_leg_bound: bound,
    speedup: exact && span > 0 ? Math.round((sum / span) * 100) / 100 : null,
    speedup_refused_because: exact
      ? (span > 0 ? null : "the launch's legs span zero milliseconds — nothing to divide by")
      : `${legs.filter((l) => l.bound !== "exact").length} of ${legs.length} leg(s) end at a T0 landmark rather than a completion record, so both the span and the work sum are floors; their ratio bounds nothing`,
    waves_observed: wavesObserved(legs),
    scopes: [...new Set(legs.map((l) => l.scope_id))].sort(),
  };
}

/**
 * Which fan-out width the run was launched with — read, never assumed.
 *
 * The dial is written into `run-args.json` by the launcher. It is absent from every run recorded so
 * far, so the honest answer is the effective default WITH the fact that it is a default: reporting
 * `4` unqualified would assert an operator choice nobody made.
 *
 * @param {string} runRoot - The run's LOCAL root.
 * @returns {{max_parallel_scopes:number, source:string}} The value and where it came from.
 */
export function dialFrom(runRoot) {
  try {
    const a = JSON.parse(readFileSync(join(runRoot, "run-args.json"), "utf8"));
    const n = Number(a?.maxParallelScopes);
    if (Number.isFinite(n) && n >= 1) return { max_parallel_scopes: n, source: "run-args" };
    return { max_parallel_scopes: DEFAULT_MAX_PARALLEL_SCOPES, source: "default (run-args.json declares none)" };
  } catch {
    return { max_parallel_scopes: DEFAULT_MAX_PARALLEL_SCOPES, source: "default (no run-args.json)" };
  }
}

/**
 * The whole report for one run root.
 *
 * @param {string} runRoot - The run's LOCAL root (`<cwd>/.shapeup/<slug>`, or an archived copy).
 * @param {object} [opts] - `{round, gapS}`.
 * @returns {object} A byte-stable report — no clock reading anywhere in it, arrays sorted, key
 *   order fixed by this literal — so two runs over one tree produce identical bytes.
 */
export function report(runRoot, { round = null, gapS = DEFAULT_GAP_S } = {}) {
  const receipts = readLedger(join(runRoot, "receipts", "dispatch.jsonl"));
  const legLedger = readLedger(join(runRoot, "legs.jsonl"));
  const trials = readLedger(join(runRoot, "t0", "trials.jsonl"));

  const { starts, phase_dispatches } = startsFrom(receipts.rows);
  const scoped = round === null ? starts : starts.filter((s) => s.round === round);
  const legs = pairLegs(scoped, legLedger.rows, trials.rows);
  const usable = legs.filter((l) => l.end !== null);

  const warnings = [];
  if (!receipts.present) {
    warnings.push("no receipts/dispatch.jsonl — nothing recorded a dispatch, so no leg has a start. " +
      "An empty report here means the record set is empty, not that the run was sequential.");
  }
  if (!legLedger.present) {
    warnings.push("no legs.jsonl — this run was recorded before leg completions were written, so every " +
      "end falls back to the T0 landmark and every figure below is a floor.");
  }
  for (const l of [["receipts/dispatch.jsonl", receipts], ["legs.jsonl", legLedger], ["t0/trials.jsonl", trials]]) {
    if (l[1].malformed) warnings.push(`${l[0]}: ${l[1].malformed} unparseable line(s) skipped`);
  }
  const unkeyed = legs.filter((l) => !l.run_id).length;
  if (unkeyed) {
    warnings.push(`${unkeyed} of ${legs.length} leg(s) carry no run_id — order_id alone repeats across ` +
      "runs of one slug, so those rows cannot be attributed to this run rather than another.");
  }

  const launches = segment(usable, gapS * 1000).map((g, i) => summarise(i + 1, g));

  const best = launches.reduce((a, b) => (b.max_concurrent > (a?.max_concurrent ?? -1) ? b : a), null);
  return {
    schema_version: 1,
    run_root: runRoot,
    run_id: runIdFromRoot(runRoot),
    receipt_present: existsSync(join(runRoot, RECEIPT_FILE)),
    round,
    dial: dialFrom(runRoot),
    completeness: {
      // The absence, in the same value as the number. `max_concurrent` below is meaningless without
      // these four counts, so they are not an appendix.
      legs_total: legs.length,
      legs_exact: legs.filter((l) => l.bound === "exact").length,
      legs_lower_bound: legs.filter((l) => l.bound === "lower").length,
      no_completion_record: legs.filter((l) => l.end === null).length,
      legs_unkeyed: unkeyed,
      phase_dispatches_excluded: phase_dispatches,
      end_sources: {
        "leg-record": legs.filter((l) => l.end_source === "leg-record").length,
        "t0-landmark": legs.filter((l) => l.end_source === "t0-landmark").length,
        none: legs.filter((l) => l.end_source === null).length,
      },
    },
    concurrency: {
      max_concurrent: best ? best.max_concurrent : null,
      bound: best ? best.max_concurrent_bound : null,
      at: best ? best.max_concurrent_at : null,
      launch: best ? best.launch : null,
      // The acceptance predicate, answered rather than left to the reader — and `null` when the
      // record set cannot answer it, which is a third state and not a "no".
      two_or_more_concurrent: best ? best.max_concurrent >= 2 : null,
    },
    launches,
    segmentation: {
      rule: "a quiet period longer than gap_s starts a new launch",
      gap_s: gapS,
      launches: launches.length,
      note: "heuristic: nothing in the record set identifies a launch, and one run_id spans every relaunch",
    },
    legs: legs.map((l) => ({
      order_id: l.order_id,
      scope_id: l.scope_id,
      round: l.round,
      attempt: l.attempt,
      run_id: l.run_id,
      started_at: new Date(l.start).toISOString(),
      start_source: l.start_source,
      ended_at: l.end === null ? null : new Date(l.end).toISOString(),
      end_source: l.end_source,
      duration_ms: l.end === null ? null : l.end - l.start,
      bound: l.bound,
    })),
    warnings,
  };
}

/**
 * Render the report as a table for a human, from the already-built object.
 * @param {object} r - A {@link report}.
 * @returns {string} The human view.
 */
export function table(r) {
  const c = r.completeness;
  const lines = [
    `run_root      ${r.run_root}`,
    `run_id        ${r.run_id ?? "(none — records cannot be attributed to a run)"}`,
    `dial          maxParallelScopes=${r.dial.max_parallel_scopes} (${r.dial.source})`,
    `legs          ${c.legs_total} total · ${c.legs_exact} exact · ${c.legs_lower_bound} lower-bound · ${c.no_completion_record} with NO completion record` +
      `${c.phase_dispatches_excluded ? ` (+${c.phase_dispatches_excluded} non-build dispatch(es) excluded)` : ""}`,
    `concurrency   ${r.concurrency.max_concurrent ?? "unmeasurable"}` +
      `${r.concurrency.max_concurrent === null ? "" : ` (${r.concurrency.bound}) at ${r.concurrency.at}`}`,
    `≥2 concurrent ${r.concurrency.two_or_more_concurrent === null ? "UNKNOWN — no leg in scope has a usable interval" : r.concurrency.two_or_more_concurrent}`,
  ];
  for (const l of r.launches) {
    lines.push(`  launch ${l.launch}  ${l.from} → ${l.to}  legs=${l.legs} max=${l.max_concurrent} (${l.max_concurrent_bound})` +
      `  span=${(l.span_ms / 1000).toFixed(1)}s  work=${(l.sum_leg_ms / 1000).toFixed(1)}s  speedup=${l.speedup ?? "refused"}`);
    if (l.speedup === null) lines.push(`     refused: ${l.speedup_refused_because}`);
    for (const w of l.waves_observed) lines.push(`     wave  ${w.scopes.join(" + ")}`);
  }
  for (const w of r.warnings) lines.push(`  ! ${w}`);
  return lines.join("\n");
}

/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs probe concurrency (--slug <slug> | --run-root <dir>) [--cwd <dir>] [--round N] " +
         "[--gap-s N] [--format json|table]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str" },
  // The archived-trace and post-export cases, and the same escape `verify t0 --out` has: a caller
  // that already holds the run root should not have to reconstruct a slug from a directory name.
  "run-root": { type: "path" },
  cwd: { type: "path" },
  round: { type: "int", min: 1 },
  "gap-s": { type: "int", min: 1, default: DEFAULT_GAP_S },
  format: { type: "enum", values: ["json", "table"], default: "json" },
};

/**
 * Report a run's leg concurrency, span and observed waves.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {void} Exits 0 when at least one leg had a usable interval, 1 when none did — and the
 *   report prints either way, because "nothing was measurable" is the answer, not an error.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  if (!args.slug && !args.runRoot) {
    process.stderr.write(JSON.stringify({ error: "missing_required", flag: "--slug", expected: "a slug, or --run-root <dir>" }) + "\n");
    process.stderr.write(`usage: ${ARGV_SPEC.usage}\n`);
    process.exit(2);
  }
  const runRoot = args.runRoot
    ? resolve(args.runRoot)
    : localRoot(resolve(args.cwd || process.cwd()), args.slug);

  const r = report(runRoot, { round: args.round ?? null, gapS: args.gapS });
  console.log(args.format === "table" ? table(r) : JSON.stringify(r));
  process.exit(r.launches.length ? 0 : 1);
}
