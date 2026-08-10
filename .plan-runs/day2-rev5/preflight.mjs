#!/usr/bin/env node
// Phase-3 self-check runner. Throwaway, lives in the gitignored workdir.
// Parses contract.md's acceptance table and runs every row in a clean room.
// It answers two questions and no others: do the commands run as written, and
// how much of the plan is already done?
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Derived, never hardcoded: this file was force-added to git so the branch could move
// machines, and an absolute path baked into it defeats exactly that.
const WORKDIR = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(WORKDIR, "..", "..");
const CONTRACT = `${WORKDIR}/contract.md`;
const CLONE = `${WORKDIR}/clones/selfcheck`;

// The one escaping rule the format defines: a literal pipe inside a cell is written `\|`.
function splitRow(line) {
  const cells = [];
  let cur = "";
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\\" && line[i + 1] === "|") { cur += "|"; i++; continue; }
    if (line[i] === "|") { cells.push(cur); cur = ""; continue; }
    cur += line[i];
  }
  cells.push(cur);
  return cells.slice(1, -1).map((c) => c.trim());
}

// Two concurrent runs share this one clone path, and the second `rm -rf`s the first's clean
// room mid-flight — handing the first a RED that is an artifact of the harness rather than a
// fact about the repository. Measured here on 2026-08-08: an overlapping run turned S2 from
// GREEN to RED with nothing in the repository having changed. A false RED is the same species
// of instrument fault this plan was written about, so refuse to race rather than produce one.
mkdirSync(`${WORKDIR}/clones`, { recursive: true });
try {
  mkdirSync(`${WORKDIR}/clones/.lock`);
} catch {
  console.error(
    "REFUSING: another preflight is already running (clones/.lock exists).\n" +
      "Wait for it to finish — its result and yours would corrupt each other.\n" +
      `If no run is live the lock is stale: rm -rf ${WORKDIR}/clones/.lock`,
  );
  process.exit(2);
}
process.on("exit", () => {
  try { rmSync(`${WORKDIR}/clones/.lock`, { recursive: true, force: true }); } catch {}
});

const src = readFileSync(CONTRACT, "utf8");
const body = src.split("\n## Acceptance")[1].split("\n## Guardrails")[0];
const rows = body
  .split("\n")
  .filter((l) => l.trim().startsWith("|"))
  .map(splitRow)
  .filter((c) => c.length >= 8 && c[0] !== "stage" && !/^-+$/.test(c[0]));

// `--at=<ref>` checks the clean room out at a given commit. The contract marks one row
// **stage-local** — S1's `register byte-identical`, which S2 then edits on purpose — so verifying
// S1 against final HEAD would report a red that is the plan working as designed. Rows are
// evaluated at their own stage's commit; this is how.
const argv = process.argv.slice(2);
const at = (argv.find((a) => a.startsWith("--at=")) || "").slice(5);
const only = argv.find((a) => !a.startsWith("--"));
const selected = only ? rows.filter((r) => r[0] === only) : rows;

const withReview = rows.filter((r) => r[7]);
if (withReview.length) {
  console.error(`REFUSING: ${withReview.length} row(s) carry a review note`);
  process.exit(2);
}

console.log(`# contract rows: ${rows.length} (running ${selected.length})`);
execSync(`rm -rf ${CLONE} && git clone --local --no-hardlinks --quiet ${REPO} ${CLONE}`);
if (at) execSync(`git -C ${CLONE} checkout --quiet ${at}`);
const sha = execSync(`git -C ${CLONE} rev-parse --short HEAD`).toString().trim();
console.log(`# clean room at ${sha}${at ? ` (--at=${at})` : ""}\n`);

let pass = 0;
const fails = [];
for (const [stage, cmd, cwdRaw, exitRaw, match, absent, note] of selected) {
  const cwd = cwdRaw === "$CLONE" ? CLONE : REPO;
  const r = spawnSync("sh", ["-c", cmd.replaceAll("$CLONE", CLONE).replaceAll("$REPO", REPO)], {
    cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const want = Number(exitRaw);
  const why = [];
  if (r.status !== want) why.push(`exit ${r.status}, expected ${want}`);
  if (match && !new RegExp(match).test(out)) why.push(`missing /${match}/`);
  if (absent && new RegExp(absent).test(out)) why.push(`found forbidden /${absent}/`);
  const ok = why.length === 0;
  if (ok) pass++;
  else fails.push({ stage, cmd, why, tail: out.trim().split("\n").slice(-4).join("\n") });
  console.log(`${ok ? "PASS" : "FAIL"}  ${stage}  ${cmd.slice(0, 92).replace(/\s+/g, " ")}…`);
  if (!ok) console.log(`      ↳ ${why.join("; ")}`);
}

console.log(`\n${pass}/${selected.length} rows pass`);
if (fails.length) {
  console.log("\n--- failing rows ---");
  for (const f of fails) console.log(`\n[${f.stage}] ${f.why.join("; ")}\n${f.tail}`);
}
const byStage = {};
for (const r of selected) byStage[r[0]] ??= [];
for (const f of fails) byStage[f.stage].push(1);
console.log(`\nstage verdict: ${Object.entries(byStage).map(([s, f]) => `${s}=${f.length ? "RED" : "GREEN"}`).join(" ")}`);
