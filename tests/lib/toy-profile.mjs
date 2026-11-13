// A second workflow's data, handed to the core: its own root names, ref namespace, two gates, one
// evidence rule, one contract layout and one fixture source. Imports nothing but kernel/core/.
import { runTrace } from "../../kernel/core/runtrace.mjs";
import { narrow } from "../../kernel/core/gate.mjs";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const TRACE = runTrace({ shared: "toy", local: ".toy-local", decisionsEnv: "TOY_DECISIONS_PATH" });
export const GATES = { ids: ["open", "close"], valid: { open: ["go", "stop"], close: ["ship", "hold"] } };
export const NAMES = { refNamespace: "refs/toy", stashLabel: "toy" };
/** `ship` needs a file the run's own work left behind: an answer chooses, it never supplies the evidence. */
export const RULES = [(r, { cwd, slug }) => (r.gate === "close" && r.decision === "ship" && !existsSync(join(TRACE.localRoot(cwd, slug), "evidence.txt"))
  ? { gate: r.gate, status: "ask", decision: "ask", refused: "ship", reason: "no evidence file" } : undefined)];
export const narrowToy = (r, ctx) => narrow(r, RULES, ctx);
export const CONTRACT_SPEC = { tables: {} };
