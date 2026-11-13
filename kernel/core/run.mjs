// run — opening a run, free of any workflow: the run root, the intake verbatim, the receipt that says a run
// started, the launch record written in the same act from the same parsed input, and the pointer every hook
// reads to find the open run. A run that left no receipt did not happen; what goes IN the receipt and the
// launch record, and which refusals come before this, are the caller's.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

/**
 * Write a run's opening records.
 * @param {object} trace - The run trace (`runTrace(...)`).
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {object} o - Destructured: the `receipt` and `launch` objects, the `intake` text, the ISO `startedAt`, and extra `dirs` to create under the run root.
 * @returns {{runRoot:string, receiptPath:string}} Where the run was opened.
 */
export function writeRun(trace, cwd, slug, { receipt, launch, intake, startedAt, dirs = [] }) {
  const runRoot = trace.localRoot(cwd, slug);
  for (const d of ["", ...dirs]) mkdirSync(join(runRoot, d), { recursive: true });
  const put = (p, text) => writeFileSync(p, text, "utf8");
  put(join(runRoot, "intake.md"), intake.endsWith("\n") ? intake : intake + "\n");
  const receiptPath = trace.receipt(cwd, slug);
  put(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
  put(trace.runArgsPath(cwd, slug), JSON.stringify(launch, null, 2) + "\n");
  const pointer = trace.activeScope(cwd);
  mkdirSync(dirname(pointer), { recursive: true });
  put(pointer, JSON.stringify({ slug, started_at: startedAt }, null, 2) + "\n");
  return { runRoot, receiptPath };
}
