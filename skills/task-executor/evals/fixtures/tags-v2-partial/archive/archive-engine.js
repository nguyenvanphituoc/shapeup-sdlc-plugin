// Reachable: dispatch.js imports this one.
import { read } from "../store/json-store.js";
import { compact } from "../store/compact.js";
import { formatItems } from "../review/format.js";
import { line } from "../render/lines.js";

export function archiveDone() {
  const items = read();
  const keep = items.filter((i) => !i.done);
  compact(keep);
  process.stdout.write(line(`archived ${items.length - keep.length} completed todo(s)`));
  process.stdout.write(formatItems(read()));   // show what is left, as it now stands on disk
  return 0;
}
