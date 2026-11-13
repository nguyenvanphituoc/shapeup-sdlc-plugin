// ratchet — Shape Up's names for the core ratchet: the shadow-ref namespace and the stash label.
import { snapshot as snap, restore as rest, keptRef as kept } from "../core/ratchet.mjs";

const NAMES = { refNamespace: "refs/shapeup", stashLabel: "shapeup" };

export const snapshot = (scopeId, cwd) => snap(scopeId, cwd, NAMES);
export const restore = (scopeId, cwd, pathspec = []) => rest(scopeId, cwd, pathspec, NAMES);
export const keptRef = (scopeId) => kept(scopeId, NAMES.refNamespace);
