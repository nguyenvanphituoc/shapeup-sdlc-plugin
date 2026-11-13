// ledger — one append-only JSONL row, best-effort.
//
// Every ledger in a run (decisions, gate crossings, T0 trials) is the same act: make the directory,
// append one small line. `O_APPEND` of one line needs no lock, so concurrent writers cannot clobber each
// other's row, and a write that could fail the call it records would cost more than the row is worth —
// so a failure returns false instead of throwing.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Append one JSON row to a ledger file. Never throws.
 * @param {string} path - The ledger file; its directory is created.
 * @param {object} row - The row.
 * @returns {boolean} True when the row reached disk.
 */
export function appendLedger(path, row) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(row) + "\n");
    return true;
  } catch { return false; }
}
