// hook — the hook runtime bound to Shape Up's run trace. The mechanism is `../core/hook.mjs`; this
// supplies the one thing it is parameterised by, so the hooks keep calling `runHook(name, fn)`.
import * as core from "../core/hook.mjs";
import { shapeupTrace } from "./paths.mjs";

export const { readStdin, settle, HookDecision } = core;
export const runHook = (name, fn) => core.runHook(name, fn, shapeupTrace);
export const { projectRoot } = shapeupTrace;
