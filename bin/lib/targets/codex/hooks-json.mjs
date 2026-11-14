// The hook entries Codex reads (`~/.codex/hooks.json`), merged and never overwritten. The matcher names
// (`Edit|Write` for `apply_patch`, `Bash` for the shell tool) are the documented ones, not yet measured.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

export const hooksFile = (home) => join(home, ".codex", "hooks.json");
const TAG = "shapeup-sdlc";

/** The two guards, as commands naming the installed runtime and the host explicitly. */
export function ourEntries(rt) {
  const cmd = (f) => `node "${join(rt, "hooks", f)}" --host codex`;
  return [
    { matcher: "Bash|Edit|Write", hooks: [{ type: "command", command: cmd("safety-spine.mjs"), timeout: 10 }] },
    { matcher: "Edit|Write", hooks: [{ type: "command", command: cmd("sandbox-guard.mjs"), timeout: 10 }] },
  ];
}

const isOurs = (entry) => (entry?.hooks ?? []).some((h) => String(h.command ?? "").includes(`${TAG}/`) || /[\\/]\.shapeup-sdlc[\\/]/.test(String(h.command ?? "")));

/** Merge our entries into a parsed hooks file: replace ours, keep every other entry. */
export function mergeHooks(cfg, rt) {
  const hooks = (cfg.hooks = cfg.hooks ?? {});
  hooks.PreToolUse = [...(hooks.PreToolUse ?? []).filter((e) => !isOurs(e)), ...ourEntries(rt)];
  return cfg;
}

export function writeHooks(home, rt) {
  const file = hooksFile(home);
  let cfg = {};
  if (existsSync(file)) {
    try { cfg = JSON.parse(readFileSync(file, "utf8")); }
    catch (e) { throw new Error(`${file} is not valid JSON (${e.message}) — refusing to overwrite it`); }
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(mergeHooks(cfg, rt), null, 2) + "\n");
}

export function hooksProblems(home, rt) {
  const file = hooksFile(home);
  if (!existsSync(file)) return [`${file} is missing`];
  try {
    const have = (JSON.parse(readFileSync(file, "utf8")).hooks?.PreToolUse ?? []).flatMap((e) => (e.hooks ?? []).map((h) => h.command));
    return ourEntries(rt).flatMap((e) => e.hooks.map((h) => h.command)).filter((c) => !have.includes(c)).map((c) => `hooks.json lacks: ${c}`);
  } catch { return [`${file} is not valid JSON`]; }
}
