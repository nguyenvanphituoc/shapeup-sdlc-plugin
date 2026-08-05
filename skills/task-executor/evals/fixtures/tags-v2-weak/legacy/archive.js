// An earlier archiving implementation. Nothing imports it: it is not in dispatch.js's table and no
// other module references it, so nothing the running CLI does can ever reach this code.
import { read, write } from "../store/json-store.js";

export function archiveCompleted(olderThanDays = 0) {
  const cutoff = Date.now() - olderThanDays * 86400000;
  const items = read();
  write(items.filter((i) => !i.done || (i.completed_at || 0) > cutoff));
  return 0;
}
