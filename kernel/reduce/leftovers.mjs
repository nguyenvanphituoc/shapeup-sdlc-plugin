// leftovers — what the run's own diff still carries that nobody meant to ship.
//
// TODO/FIXME markers, `console.log`/`debugger`, blocks of commented-out code, one file swallowing
// hundreds of added lines. Added lines only: a marker the feature did not introduce is somebody
// else's, and a report that lists those is a report people learn to skim.
//
// WHY IT IS PART OF THE SHIP REPORT AND NOT A STOP HOOK. It used to be an advisory Stop hook that
// printed once, into a transcript, at the moment a session ended — the channel least likely to be
// read and impossible to check later. The ship report is the artifact a human actually reads at
// GATE L4 and the one a teammate finds on `git pull`, so a leftover recorded there is a leftover
// somebody can act on. Nothing about the check changed; only where its answer lands.
//
// Advisory by construction: it is a SECTION, never a verdict. QA is a level-up, not a gate.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { LOCAL, SHARED, resultsDir } from "../lib/paths.mjs";

// Harness bookkeeping is never a leftover — skip both storage roots, whichever names they carry.
const SKIP_PATH = new RegExp(`^(${[LOCAL, SHARED].map((r) => r.replace(/[.\\]/g, "\\$&")).join("|")})/`);
const MAX_FILES = 30;
const MAX_ADDED_LINES_PER_FILE = 400;

const MARKERS = [
  { name: "TODO/FIXME", re: /\b(TODO|FIXME|XXX|HACK)\b/ },
  { name: "console.log", re: /\bconsole\.(log|debug)\s*\(/ },
  { name: "debugger", re: /^\s*debugger\b/ },
];

/**
 * Scan a unified diff for leftovers in ADDED lines only.
 *
 * Added lines only, deliberately: a TODO the feature did not introduce is somebody else's, and a
 * report that lists it is a report people learn to skim.
 *
 * @param {string} diffText - A unified diff.
 * @returns {Array<{file:string, markers:Object<string,number>, added:number, big:boolean, commented_code:boolean}>}
 *   One entry per dirty file, capped at MAX_FILES.
 */
export function scanDiff(diffText) {
  const findings = [];
  let current = null;
  let commentRun = 0;
  let filesSeen = 0;

  const push = () => {
    if (!current) return;
    const dirty = current.added > MAX_ADDED_LINES_PER_FILE ||
      current.commented_code ||
      Object.keys(current.markers).length > 0;
    current.big = current.added > MAX_ADDED_LINES_PER_FILE;
    if (dirty) findings.push(current);
  };

  for (const line of (diffText || "").split("\n")) {
    if (line.startsWith("+++ ")) {
      push();
      commentRun = 0;
      const file = line.replace(/^\+\+\+ (b\/)?/, "").trim();
      if (file === "/dev/null" || SKIP_PATH.test(file) || ++filesSeen > MAX_FILES) {
        current = null;
        continue;
      }
      current = { file, markers: {}, added: 0, big: false, commented_code: false };
      continue;
    }
    if (!current || !line.startsWith("+") || line.startsWith("+++")) { commentRun = 0; continue; }
    const added = line.slice(1);
    current.added++;
    for (const { name, re } of MARKERS) {
      if (re.test(added)) current.markers[name] = (current.markers[name] || 0) + 1;
    }
    // ≥4 consecutive added comment lines that look like code = a commented-out block
    if (/^\s*(\/\/|#)/.test(added) && /[;{}()=]/.test(added)) {
      if (++commentRun >= 4) current.commented_code = true;
    } else {
      commentRun = 0;
    }
  }
  push();
  return findings;
}

/**
 * One human-readable fragment per finding.
 * @param {Array} findings - The result of {@link scanDiff}.
 * @returns {string[]} At most six lines, each naming a file and what it carries.
 */
export function summarize(findings) {
  return findings.slice(0, 6).map((f) => {
    const bits = Object.entries(f.markers).map(([name, n]) => `${name} ×${n}`);
    if (f.commented_code) bits.push("commented-out code block");
    if (f.big) bits.push(`+${f.added} lines in one file`);
    return `${f.file}: ${bits.join(", ")}`;
  });
}

/**
 * Run git, returning stdout on success and null otherwise.
 * @param {string} cwd - Working directory.
 * @param {string[]} args - Arguments after `git`.
 * @returns {(string|null)} stdout, or null when git failed or is absent.
 */
function git(cwd, args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}

/**
 * The run's change set as a unified diff — git first, WorkResult fallback.
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {(string|null)} A unified diff, or null when there is nothing to scan.
 */
export
function collectDiff(cwd, slug) {
  const tracked = git(cwd, ["diff", "HEAD"]);
  if (tracked !== null) {
    // Untracked files never show in `diff HEAD`; synthesize +lines for small text ones.
    let extra = "";
    const status = git(cwd, ["status", "--porcelain"]) || "";
    for (const line of status.split("\n")) {
      const m = /^\?\?\s+(.+)$/.exec(line);
      if (!m || SKIP_PATH.test(m[1])) continue;
      const p = join(cwd, m[1]);
      try {
        if (statSync(p).size > 200 * 1024) continue;
        const body = readFileSync(p, "utf8");
        if (body.includes("\u0000")) continue; // binary
        extra += `+++ b/${m[1]}\n` + body.split("\n").map((l) => `+${l}`).join("\n") + "\n";
      } catch { /* unreadable → skip */ }
    }
    return tracked + extra;
  }
  // Not a git repo → fall back to the newest WorkResult's files_touched.
  const resultsPath = resultsDir(cwd, slug);
  if (!existsSync(resultsPath)) return null;
  const newest = readdirSync(resultsPath).filter((f) => f.endsWith(".json"))
    .map((f) => join(resultsPath, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  if (!newest) return null;
  let diff = "";
  try {
    const result = JSON.parse(readFileSync(newest, "utf8"));
    for (const t of (result.files_touched || []).slice(0, MAX_FILES)) {
      const rel = t?.path;
      if (!rel || SKIP_PATH.test(rel)) continue;
      const p = join(cwd, rel);
      try {
        if (statSync(p).size > 200 * 1024) continue;
        const body = readFileSync(p, "utf8");
        if (body.includes("\u0000")) continue;
        diff += `+++ b/${rel}\n` + body.split("\n").map((l) => `+${l}`).join("\n") + "\n";
      } catch { /* unreadable → skip */ }
    }
  } catch { return null; }
  return diff || null;
}
