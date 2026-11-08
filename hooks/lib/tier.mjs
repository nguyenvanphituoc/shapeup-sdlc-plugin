// The tier-direction rule, on a string: a committed file cannot carry a reference that only resolves
// on the machine that wrote it. Two forms — a board id (`TASK-NNN`, renumbered per machine) and a path
// into the gitignored run tier. The substrate fence calls this at the moment a tool writes the text,
// while the writer still holds the context to rephrase it.

import { LOCAL } from "../../kernel/lib/paths.mjs";

/** Text forms worth scanning; anything else in a committed tree is not a reference carrier. */
export const SCANNED = /\.(md|markdown|yml|yaml|json|txt)$/i;

/** A machine-local board id. Strict on purpose: a committed tree has no reason to carry one at all. */
const TASK_ID = /\bTASK-[A-Za-z0-9][\w.-]*/;

/**
 * The tier-direction violations one piece of text carries — the whole rule, on a string.
 *
 * The detail strings are the message the writer reads, so they carry the remedy, not just the
 * verdict: a board id resolves on the machine that wrote it and nowhere else, and a path into the
 * gitignored tier dangles on every clone.
 *
 * @param {string} text - The file body, or the fragment a tool is about to write.
 * @returns {Array<{kind:("board-id"|"local-path"), token:string, line:number, detail:string}>}
 *   One entry per offending line and form, in file order; [] when clean.
 */
export function tierLeaks(text) {
  // Built from the LOCAL constant, never a literal — the storage roots have exactly one home.
  const esc = LOCAL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // `\S+` where the walk's own rule is `\S`: the same LINES match either way (a path with one
  // non-space character after the slash has at least one), and the longer form yields the token to
  // quote back at the writer. Trailing punctuation the prose wrapped it in is trimmed off the
  // quote only — never off the test.
  const localPath = new RegExp(`${esc}/\\S+`);
  const leaks = [];
  String(text ?? "").split(/\r?\n/).forEach((line, i) => {
    const task = line.match(TASK_ID);
    if (task) {
      leaks.push({ kind: "board-id", token: task[0], line: i + 1, detail:
        `names ${task[0]} — a committed file cannot carry a board id. Boards live in ${LOCAL}/ ` +
        "(gitignored) and renumber on every regeneration, so this resolves on the machine that wrote it " +
        "and nowhere else. Cite the use case or the scope_id, which are stable." });
    }
    const path = line.match(localPath);
    if (path) {
      leaks.push({ kind: "local-path", token: path[0].replace(/[`)\]},.;:'"]+$/, ""), line: i + 1, detail:
        `points into ${LOCAL}/ — a committed file cannot reference the gitignored tier; the path ` +
        "dangles on every other clone. Name the committed artifact, or describe the tier without a path." });
    }
  });
  return leaks;
}
