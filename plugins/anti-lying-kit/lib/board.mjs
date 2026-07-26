// Board adapter — the whole point of the anti-lying kit.
//
// The enforcement idea ("don't let the agent grade work it hasn't finished") is universal.
// The thing that makes it non-portable is that every workflow stores its task list somewhere
// different, in a different shape. This module is the only place that difference lives: given
// a config, it answers one question — WHICH TASKS ARE NOT DONE?
//
// Everything else in the kit is workflow-agnostic because it only ever calls readBoard().
//
// Config: `.antilying.json` at the project root (or ANTILYING_CONFIG env var).
//   { "preset": "spec-kit" }                              — a known workflow
//   { "board": { "glob": "...", "done": "...", "id": "..." } }  — anything else
//
// Design rule inherited from the harness, and the reason these hooks are safe to install:
// FAIL OPEN. No config, no board, nothing parseable → this returns null and the caller defers.
// A gate only ever fires when it can positively prove a task is unfinished. A gate that blocks
// legitimate work gets uninstalled, and then it protects nobody.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Built-in presets for the workflows this kit is most likely to be dropped into.
 * Each is just a board descriptor — there is nothing special about the bundled ones, and
 * `--preset` is only sugar for writing the same three fields by hand.
 *
 * `done` / `notDone` are matched per LINE for markdown checklists, or against a whole file's
 * frontmatter for file-per-task layouts (`perFile: true`).
 */
export const PRESETS = {
  // github/spec-kit — specs/<feature>/tasks.md, GitHub-flavoured task checkboxes.
  "spec-kit": {
    glob: "specs/**/tasks.md",
    perFile: false,
    id: "(T\\d+|\\bTASK-[\\w.-]+)",
    done: "^\\s*[-*]\\s*\\[[xX]\\]",
    notDone: "^\\s*[-*]\\s*\\[\\s*\\]",
  },
  // Fission-AI/OpenSpec — openspec/changes/<change>/tasks.md, same checkbox convention.
  openspec: {
    glob: "openspec/changes/**/tasks.md",
    perFile: false,
    id: "(\\d+\\.\\d+|\\bTASK-[\\w.-]+)",
    done: "^\\s*[-*]\\s*\\[[xX]\\]",
    notDone: "^\\s*[-*]\\s*\\[\\s*\\]",
  },
  // Any markdown checklist anywhere — the catch-all for bespoke workflows.
  "markdown-checklist": {
    glob: "**/tasks.md",
    perFile: false,
    id: "(T\\d+|TASK-[\\w.-]+|\\S.{0,48})",
    done: "^\\s*[-*]\\s*\\[[xX]\\]",
    notDone: "^\\s*[-*]\\s*\\[\\s*\\]",
  },
  // This kit's parent harness — one file per task, `status:` in frontmatter.
  "shapeup-sdlc": {
    glob: ".shapeup-sdlc/*/tasks/TASK-*.md",
    perFile: true,
    id: "^id:\\s*(TASK-[\\w.-]+)",
    done: "^status:\\s*done\\s*$",
    notDone: "^status:\\s*(ready|in-progress|blocked)\\s*$",
  },
};

/** @returns {object|null} the resolved config, or null when the project has not opted in. */
export function loadConfig(cwd) {
  const explicit = process.env.ANTILYING_CONFIG;
  const path = explicit ? explicit : join(cwd, ".antilying.json");
  if (!existsSync(path)) return null;
  let raw;
  try { raw = JSON.parse(readFileSync(path, "utf8")); } catch { return null; } // malformed → fail open
  const preset = raw.preset ? PRESETS[raw.preset] : null;
  if (raw.preset && !preset) return null; // unknown preset → fail open rather than guess
  const board = { ...(preset || {}), ...(raw.board || {}) };
  if (!board.glob || !board.done) return null; // not enough to prove anything
  return { ...raw, board };
}

/**
 * Expand a restricted glob (`*`, `**`) against the filesystem without a dependency.
 * Deliberately small: enough for board paths, and it never escapes `root`.
 */
function expand(root, pattern) {
  const parts = pattern.split("/").filter(Boolean);
  let dirs = [root];
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const last = i === parts.length - 1;
    const next = [];
    for (const dir of dirs) {
      let entries;
      try { entries = readdirSync(dir); } catch { continue; }
      if (part === "**") {
        // `**` matches this directory and every descendant; remaining parts re-match below.
        next.push(dir, ...walkDirs(dir));
        continue;
      }
      const re = new RegExp("^" + part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*") + "$");
      for (const e of entries) {
        if (!re.test(e)) continue;
        const full = join(dir, e);
        let st; try { st = statSync(full); } catch { continue; }
        if (last && st.isFile()) out.push(full);
        else if (!last && st.isDirectory()) next.push(full);
      }
    }
    if (part === "**") {
      // Re-run the remaining pattern against every directory `**` matched.
      const rest = parts.slice(i + 1).join("/");
      for (const d of next) out.push(...expand(d, rest));
      return dedupe(out);
    }
    dirs = next;
  }
  return dedupe(out);
}

function walkDirs(dir) {
  const acc = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries; try { entries = readdirSync(d); } catch { continue; }
    for (const e of entries) {
      if (e === "node_modules" || e === ".git") continue;
      const full = join(d, e);
      let st; try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) { acc.push(full); stack.push(full); }
    }
  }
  return acc;
}

const dedupe = (a) => [...new Set(a)];

/**
 * Read the board and report what is unfinished.
 *
 * @param {string} cwd - Project root.
 * @returns {{unfinished:string[], total:number, files:string[]}|null}
 *   null means "nothing to assert" — no config, no matching files, or zero recognisable tasks.
 *   Callers MUST treat null as defer, never as green and never as red.
 */
export function readBoard(cwd) {
  const config = loadConfig(cwd);
  if (!config) return null;
  const { glob, done, notDone, id, perFile } = config.board;

  const files = expand(cwd, glob);
  if (!files.length) return null;

  const doneRe = new RegExp(done, perFile ? "im" : "");
  const notDoneRe = notDone ? new RegExp(notDone, perFile ? "im" : "") : null;
  const idRe = id ? new RegExp(id, perFile ? "im" : "") : null;

  const unfinished = [];
  let total = 0;

  for (const file of files) {
    let body; try { body = readFileSync(file, "utf8"); } catch { continue; }
    const label = relative(cwd, file).split(sep).join("/");

    if (perFile) {
      total++;
      const isDone = doneRe.test(body);
      const isNotDone = notDoneRe ? notDoneRe.test(body) : !isDone;
      if (!isDone && isNotDone) unfinished.push((idRe && (body.match(idRe) || [])[1]) || label);
      continue;
    }

    for (const line of body.split(/\r?\n/)) {
      const isDone = doneRe.test(line);
      const isNotDone = notDoneRe ? notDoneRe.test(line) : false;
      if (!isDone && !isNotDone) continue; // not a task line at all
      total++;
      if (isDone) continue;
      const m = idRe ? line.match(idRe) : null;
      const name = (m && (m[1] || m[0])) || line.replace(/^\s*[-*]\s*\[\s*\]\s*/, "").trim().slice(0, 48);
      unfinished.push(`${name} (${label})`);
    }
  }

  if (total === 0) return null; // recognised no tasks → nothing to prove
  return { unfinished: dedupe(unfinished), total, files: files.map((f) => relative(cwd, f)) };
}

/** The gated tool calls, as regexes. Overridable per project via config.gate. */
export function gateMatchers(cwd) {
  const config = loadConfig(cwd);
  const g = config?.gate || {};
  return {
    // Skill/Agent/command names that mean "grade or finish the work".
    names: new RegExp(g.names || "(spec-evaluator|eval|review|verify|qa|ship|finish|complete)", "i"),
    // Argument shapes that mean "grade ONE item", which is never gated.
    //
    // `(?![\w-])` and not `\b`: `\b` matches inside a longer flag, so `--single\b` matched
    // `--single-pass` — a WHOLE-ROUND flag — and silently deferred the gate on exactly the call
    // it exists to catch. A false defer here is invisible, which makes it the worst kind of bug.
    perItem: new RegExp(g.perItem || "--task(?![\\w-])|--single(?![\\w-])|--only(?![\\w-])", "i"),
  };
}
