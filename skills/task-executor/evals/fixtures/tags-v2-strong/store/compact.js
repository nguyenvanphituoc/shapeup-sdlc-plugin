import { writeFileSync } from "node:fs";
import { storePath } from "./paths.js";

// Compaction rewrites the store file DIRECTLY rather than going through json-store.write(), because
// it also drops the per-item bookkeeping the CLI stopped reading years ago. That means it names
// every field it keeps, and ANYTHING NOT LISTED HERE DOES NOT SURVIVE A COMPACTION — add a field to
// an item elsewhere in the codebase and this is where it quietly disappears.
const KEEP = ["text", "done", "completed_at", "tags"];

export function compact(items) {
  const slim = items.map((i) =>
    Object.fromEntries(KEEP.filter((k) => k in i).map((k) => [k, i[k]])));
  writeFileSync(storePath(), JSON.stringify({ v: 1, items: slim }, null, 2));
}
