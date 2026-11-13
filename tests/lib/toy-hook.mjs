// One hook decision recorded through the core hook runtime under the second workflow's trace.
import { runHook } from "../../kernel/core/hook.mjs";
import { TRACE } from "./toy-profile.mjs";

await runHook("toy-hook", () => ({ verdict: "deny", reason: "toy refusal", rule: "toy-rule", cwd: process.cwd() }), TRACE);
