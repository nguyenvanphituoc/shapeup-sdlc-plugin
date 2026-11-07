// Requirements registry — the two reads of the committed `requirements.md` and of the board's
// `covers:` clauses that the L1b REQ → AC table and the requirements probe share, so there is one
// definition of "covered" and one key space for a requirement id.
//
// Zero dependencies, zero network.

import { reqId } from "./contract.mjs";

// --- requirements.md registry parser -----------------------------------------
// A committed markdown table: | REQ-id | clause (verbatim) | source | status | note |
// The first two columns are load-bearing; source/note are optional. Status is normalized so
// "CUT (PO-approved)", "cut", "CUT" all read as cut and anything else non-covered stays covered.
/**
 * Parse the committed `requirements.md` table into RequirementClause rows.
 * @param {string} md - The registry Markdown ("" / null → []). Table columns:
 *   | REQ-id | clause | source | status | note |.
 * @returns {Array<{id:string, clause:string, source:string, status:("covered"|"CUT (PO-approved)"),
 *   note:string}>} One row per `REQ-\d+`; any status containing "cut" normalizes to CUT, all else
 *   to covered. Header/separator/prose rows are skipped.
 */
export function parseRequirements(md) {
  const clauses = [];
  if (!md) return clauses;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim()); // drop the leading/trailing empties
    if (!cells.length) continue;
    const id = (cells[0].match(/REQ-\d+/) || [])[0];
    if (!id) continue; // header row ("REQ-id"), separator row ("---"), or prose — skip
    const statusRaw = (cells[3] || cells[cells.length - 1] || "").toLowerCase();
    const status = /\bcut\b/.test(statusRaw) ? "CUT (PO-approved)" : "covered";
    clauses.push({
      id,
      clause: cells[1] || "",
      source: cells[2] || "",
      status,
      note: cells[4] || "",
    });
  }
  return clauses;
}

/**
 * Collect every REQ-id named by a `covers:` clause across the board's acceptance criteria.
 * @param {Array<object>} board - Task entries (see compile-order's parseTaskFile).
 * @returns {Set<string>} The set of `REQ-\d+` ids referenced by any AC's covers[].
 */
export function coveredReqIds(board) {
  const covered = new Set();
  for (const task of board) {
    for (const ac of task.acceptance_criteria || []) {
      const covers = typeof ac === "object" && Array.isArray(ac.covers) ? ac.covers : [];
      // ONE KEY SPACE. `R-2`, `[[REQ-5]]` and `req-4` are the same clause spelled three ways, and the
      // sibling rule accepts all of them; testing the raw string here counted every one as nothing, so
      // an author told at L1b to cover a requirement with an AC — which they had — stayed red.
      for (const raw of covers) { const id = reqId(raw); if (/^REQ-\d+$/.test(id)) covered.add(id); }
    }
  }
  return covered;
}
