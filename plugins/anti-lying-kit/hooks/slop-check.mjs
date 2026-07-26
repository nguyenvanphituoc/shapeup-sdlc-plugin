#!/usr/bin/env node
// SLOP CHECK — Stop hook. Advisory, never blocking. Zero config required.
//
// Reads the session's own git diff and flags the leftovers that mean "this was left mid-thought":
// TODO/FIXME markers, stray debug logging, and blocks of commented-out code.
//
//   Prevents: shipping a diff that looks finished in prose and reads as abandoned in the file.
//
// This is the one piece of the kit that needs no board and no config — it works in any git repo,
// in any workflow, immediately after install. Like no-fake-done it emits at most a
// `systemMessage` and always exits 0.
//
// Contract: Stop stdin JSON { cwd, ... }. Output { systemMessage }.

import { spawnSync } from "node:child_process";

const quiet = () => process.exit(0);

const raw = await new Promise((res) => {
  let d = "";
  process.stdin.on("data", (c) => (d += c));
  process.stdin.on("end", () => res(d));
  process.stdin.on("error", () => res(""));
});

let p;
try { p = JSON.parse(raw || "{}"); } catch { quiet(); }
const cwd = p.cwd || process.cwd();

const git = (args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
};

// Uncommitted work first; if the tree is clean, look at the last commit instead, since a session
// that committed its work still deserves the check.
let diff = git(["diff", "--unified=0", "HEAD"]);
if (diff === null) quiet();               // not a git repo → nothing to read
if (!diff.trim()) diff = git(["show", "--unified=0", "--format=", "HEAD"]) || "";
if (!diff.trim()) quiet();

// Added lines only — pre-existing debt in the surrounding file is not this session's problem,
// and flagging it would make the hook noise that gets ignored.
const added = diff.split(/\r?\n/).filter((l) => l.startsWith("+") && !l.startsWith("+++"));
if (!added.length) quiet();

const PATTERNS = [
  { label: "TODO/FIXME/XXX left in the diff", re: /\b(TODO|FIXME|XXX|HACK)\b/ },
  { label: "debug logging left in the diff", re: /\b(console\.(log|debug|dir)|System\.out\.println|fmt\.Println|dbg!|binding\.pry|debugger)\b/ },
  { label: "commented-out code left in the diff", re: /^\+\s*(\/\/|#|--)\s*(if|for|while|return|import|const|let|var|def|class|function|fn|print)\b/ },
];

const findings = [];
for (const { label, re } of PATTERNS) {
  const hits = added.filter((l) => re.test(l));
  if (hits.length) findings.push(`${label} (${hits.length}×)`);
}
if (!findings.length) quiet();

console.log(JSON.stringify({
  systemMessage:
    `⚠️  slop-check: ${findings.join("; ")}. ` +
    `Intentional leftovers are fine — but say so rather than leaving them silent. ` +
    `(Advisory only — nothing was blocked.)`,
}));
process.exit(0);
