// The registry of install targets. A target is `{ name, steps(), next[] }`; it never imports another
// target — anything two targets share belongs in `../steps/`.
import { claude } from "./claude/index.mjs";
import { codex } from "./codex/index.mjs";

export const TARGETS = { claude, codex };
export const TARGET_NAMES = Object.keys(TARGETS);
