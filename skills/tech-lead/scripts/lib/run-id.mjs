// run-id — the join key, and its single home.
//
// WHY THIS FILE EXISTS (measured against the records on disk, not theorized).
//
// Every boundary in this harness already writes JSON: `orders/` and `results/` are the dispatch's
// input and output, `journal.jsonl` carries model/wall/cost per agent call, `decisions.jsonl`
// carries one row per hook evaluation, `t0/trials.jsonl` carries the ratchet's history with a
// genuine parent edge. What none of them carried was an answer to the only question an analyst
// ever asks first: **which run is this row from?**
//
// The nearest thing to a key was `order_id` — `<slug>/r<N>-a<M>`, or `<slug>/<scope>-r<N>-a<M>`.
// It identifies a dispatch WITHIN a run and collides across every run of the same slug: run the
// same feature twice and `checkout/analyze` names two different dispatches with no field to tell
// them apart. So "compare run A against run B" — the entire point of recording anything — was not
// expressible, and neither was "how much did THIS run cost", because the cost rows and the
// verdict rows had no field in common.
//
// THE ID IS DERIVED, NEVER DRAWN. `crypto.randomUUID()` would be one line and would forfeit the
// property this repo keeps paying for elsewhere: re-derivability from artifacts. A random key
// exists only where it was first written, so a record that missed the stamp can never be joined
// afterwards, and a receipt copied between machines describes a run whose id cannot be recomputed
// to check it. This id is a pure function of three fields the receipt already holds — slug,
// started_at, intake_sha256 — so:
//
//   • every writer that can see the receipt computes the SAME id without being handed it;
//   • runs that predate this field are BACKFILLABLE — {@link runIdFromReceipt} mints the id an old
//     receipt would have been given, so the warehouse can key history it never stamped;
//   • two runs of the same slug in the same second still differ, because the intake digest and the
//     millisecond field both feed the hash.
//
// SHAPE: `<slug>-<YYYYMMDDTHHMMSSZ>-<8 hex>`. Slug first because it is the aggregate root every
// path is already keyed off, so the natural partition order is the sort order; timestamp second so
// a lexical sort within a slug is chronological; hash last as the tiebreak. Filesystem-safe by
// construction, because the export tier uses it as a directory name.
//
// FAIL-OPEN, EVERYWHERE. Every reader here returns `null` rather than throwing. These functions are
// called from hooks, which must never break a tool call over telemetry — a run key that can fail a
// run is a run key that gets removed.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { RECEIPT_FILE, receipt as receiptPath, activeScope } from "./paths.mjs";

/**
 * The id's shape, as one regex. Exported so the schema, the tests and the export tier check the
 * same pattern instead of three drifting copies of it.
 */
export const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]*-\d{8}T\d{6}Z-[0-9a-f]{8}$/;

/**
 * Compact an ISO timestamp into the id's sortable middle segment.
 * @param {string} iso - An ISO-8601 timestamp, e.g. `2026-08-13T09:12:33.456Z`.
 * @returns {(string|null)} e.g. `20260813T091233Z`, or null when the input is not ISO-shaped.
 */
export function compactStamp(iso) {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}${m[6]}Z` : null;
}

/**
 * Mint the run key from the three receipt fields it is a function of.
 *
 * Pure and total: same inputs → same id, on every machine and at any later date. That is what makes
 * an unstamped record joinable after the fact.
 *
 * @param {object} o - The identity inputs (destructured):
 * @param {string} o.slug - The feature slug — the aggregate root, and the id's partition prefix.
 * @param {string} o.startedAt - The run's ISO start time (`receipt.started_at`).
 * @param {string} [o.intakeSha256=""] - The intake digest, which separates two runs of the same
 *   slug started in the same second.
 * @returns {(string|null)} `<slug>-<YYYYMMDDTHHMMSSZ>-<8 hex>`, or null when slug or timestamp is
 *   missing or malformed — never a partial id, which would join wrongly rather than not at all.
 */
export function mintRunId({ slug, startedAt, intakeSha256 = "" }) {
  const stamp = compactStamp(startedAt);
  const clean = String(slug ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
  if (!clean || !stamp) return null;
  // NUL as the field separator — it cannot occur in a slug, an ISO timestamp or a hex digest, so
  // no two different field triples can concatenate to the same string. Written as the ESCAPE
  // `\u0000`, never as a literal control byte: a source file carrying a raw NUL is classified as
  // binary, and every line-oriented tool — `grep -r`, a diff viewer, this repo's own
  // non-delivered-content sweep — skips it in silence. A file no grep can see is a file no audit
  // can check, and this one hid a real finding until it was read another way.
  const h = createHash("sha256")
    .update(`${clean}\u0000${startedAt}\u0000${intakeSha256 ?? ""}`, "utf8")
    .digest("hex").slice(0, 8);
  return `${clean}-${stamp}-${h}`;
}

/**
 * The run key for a parsed receipt — stamped if present, minted if not.
 *
 * The backfill branch is the load-bearing one: a receipt written before this field existed still
 * yields the id it would have been given, so the export tier can key runs it never stamped.
 *
 * @param {(object|null)} r - A parsed `receipt.json`.
 * @returns {(string|null)} The run key, or null when the receipt is absent or lacks identity fields.
 */
export function runIdFromReceipt(r) {
  if (!r || typeof r !== "object") return null;
  if (typeof r.run_id === "string" && RUN_ID_PATTERN.test(r.run_id)) return r.run_id;
  return mintRunId({ slug: r.slug, startedAt: r.started_at, intakeSha256: r.intake_sha256 });
}

/**
 * Read a receipt from disk without throwing.
 * @param {string} path - Path to a `receipt.json`.
 * @returns {(object|null)} The parsed receipt, or null when missing or unparseable.
 */
export function readReceipt(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

/**
 * The run key for a run whose LOCAL root is known directly.
 *
 * `t0-verify.mjs` is the caller this exists for: it is handed the run root as `--out` and never
 * derives a slug, so asking it for one would mean inferring identity from a directory name.
 *
 * @param {string} runRoot - The feature's LOCAL root, e.g. `<cwd>/.shapeup/<slug>`.
 * @returns {(string|null)} The run key, or null when no readable receipt lives there.
 */
export function runIdFromRoot(runRoot) {
  return runIdFromReceipt(readReceipt(join(runRoot, RECEIPT_FILE)));
}

/**
 * The run key for a feature slug under a project root.
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {(string|null)} The run key, or null when that run has no readable receipt.
 */
export function readRunId(cwd, slug) {
  return runIdFromReceipt(readReceipt(receiptPath(cwd, slug)));
}

/**
 * Best-effort run key for a caller that may not know the slug — the shape hooks need.
 *
 * Resolution order: the slug it was given, else the `active-scope` pointer `init-run.mjs` writes.
 * A hook firing outside any run resolves to null, which is the correct answer and not an error:
 * "this row belongs to no run" is a fact the warehouse must be able to record.
 *
 * @param {string} cwd - Project root.
 * @param {(string|null)} [slug=null] - Feature slug when the caller already knows it.
 * @returns {(string|null)} The run key, or null when no run is active or readable.
 */
export function resolveRunId(cwd, slug = null) {
  if (slug) return readRunId(cwd, slug);
  try {
    const ptr = JSON.parse(readFileSync(activeScope(cwd), "utf8"));
    return ptr?.slug ? readRunId(cwd, ptr.slug) : null;
  } catch { return null; }
}
