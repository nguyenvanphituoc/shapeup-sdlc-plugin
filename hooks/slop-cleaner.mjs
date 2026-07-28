#!/usr/bin/env node
// Slop cleaner — advisory Stop hook (v1.2, absorb-audit P2).
//
// Scans what actually changed this session (git diff of the working tree; fallback: the
// newest WorkResult's files_touched) for the classic leftovers — TODO/FIXME markers,
// console.log/debugger, blocks of commented-out code, one file swallowing hundreds of added
// lines — and mentions them to the user on stop.
//
// ADVISORY ONLY, same contract as anti-rationalization.mjs: exit 0 always, at most
// { systemMessage }, never { decision:"block" }, never exit 2 ("QA is a level-up, not a
// gate"). Harness-scoped: silent unless a run is active.
//
// Contract: Stop stdin JSON { cwd, stop_hook_active }.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { activeSlug } from "./anti-rationalization.mjs";
import { isMain } from "../skills/tech-lead/scripts/lib/is-main.mjs";

const defer = () => process.exit(0);

const SKIP_PATH = /^(\.shapeup-sdlc\/|docs\/shapeup-sdlc\/)/;
const MAX_FILES = 30;
const MAX_ADDED_LINES_PER_FILE = 400;

const MARKERS = [
  { name: "TODO/FIXME", re: /\b(TODO|FIXME|XXX|HACK)\b/ },
  { name: "console.log", re: /\bconsole\.(log|debug)\s*\(/ },
  { name: "debugger", re: /^\s*debugger\b/ },
];

/** Scan a unified diff for slop in ADDED lines only.
 *  Returns [{ file, markers: {name: count}, added, big, commented_code }]. */
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

/** One human-readable fragment per finding. */
export function summarize(findings) {
  return findings.slice(0, 6).map((f) => {
    const bits = Object.entries(f.markers).map(([name, n]) => `${name} ×${n}`);
    if (f.commented_code) bits.push("commented-out code block");
    if (f.big) bits.push(`+${f.added} lines in one file`);
    return `${f.file}: ${bits.join(", ")}`;
  });
}

function git(cwd, args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}

/** The session's change set as a unified diff — git first, WorkResult fallback. */
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
  const resultsDir = join(cwd, ".shapeup-sdlc", slug, "results");
  if (!existsSync(resultsDir)) return null;
  const newest = readdirSync(resultsDir).filter((f) => f.endsWith(".json"))
    .map((f) => join(resultsDir, f))
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

async function main() {
  const raw = await new Promise((res) => {
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => res(d));
    process.stdin.on("error", () => res(""));
  });
  let p;
  try { p = JSON.parse(raw || "{}"); } catch { defer(); return; }

  if (p.stop_hook_active) defer();

  const cwd = p.cwd || process.cwd();
  const slug = activeSlug(cwd);
  if (!slug) defer(); // no harness run → stay silent

  const diff = collectDiff(cwd, slug);
  if (!diff) defer();

  const findings = scanDiff(diff);
  if (findings.length === 0) defer();

  console.log(JSON.stringify({
    systemMessage:
      `slop-cleaner (advisory): recent edits carry leftovers — ${summarize(findings).join("; ")}. ` +
      `Not blocking — consider a cleanup pass.`,
  }));
  process.exit(0);
}

if (isMain(import.meta.url)) {
  main();
}
