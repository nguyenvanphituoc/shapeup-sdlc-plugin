#!/usr/bin/env node
// Demo recorder — renders docs/assets/demo-gate.svg (+ a plain-text transcript).
//
// Honesty contract (the reason this is a script and not a hand-drawn asset):
// the ⚠ GATE L2 block in the demo is NOT written by hand. This script builds a real
// partial task board in a temp dir, pipes a real PreToolUse payload into the real
// `hooks/gate-l2.mjs`, and embeds the hook's verbatim stdout. It then flips the board
// green and re-runs the same hook to prove the silent path. If the hook's behaviour or
// wording ever changes, re-running `npm run demo` changes the asset — and if the hook
// stopped detecting a partial board, or stopped naming which tasks were unfinished,
// this script fails loudly rather than shipping a flattering picture.
//
// It asserted a `deny` until GATE L2 became advisory (ADR-0001) — and it did fail loudly,
// which is the contract working.
//
// Everything outside the GATE L2 block is scripted narration of the pipeline steps and is
// labelled as such in docs/assets/demo-gate.txt.
//
// Usage: npm run demo

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const HOOK = join(ROOT, "hooks", "gate-l2.mjs");
const SLUG = "dark-mode";

// ─── 1. Drive the real hook ────────────────────────────────────────────────────

const TASKS = [
  { id: "TASK-001", scope: "tokens", partial: "done" },
  { id: "TASK-002", scope: "toggle-ui", partial: "done" },
  { id: "TASK-003", scope: "persist", partial: "ready" },
  { id: "TASK-004", scope: "wiring", partial: "in-progress" },
];

const box = mkdtempSync(join(tmpdir(), "shapeup-demo-"));
const tasksDir = join(box, ".shapeup", SLUG, "tasks");
mkdirSync(tasksDir, { recursive: true });

function writeBoard(statusOf) {
  for (const t of TASKS) {
    writeFileSync(
      join(tasksDir, `${t.id}.md`),
      `---\nid: ${t.id}\nstatus: ${statusOf(t)}\n---\n# ${t.scope}\n`,
    );
  }
  const rows = TASKS.map((t) => `| ${t.id} | ${t.scope} | ${statusOf(t)} |`).join("\n");
  writeFileSync(
    join(tasksDir, "_index.md"),
    `# Board — ${SLUG}\n\n| Task | Scope | Status |\n|---|---|---|\n${rows}\n`,
  );
}

function runHook() {
  const payload = JSON.stringify({
    tool_name: "Skill",
    tool_input: {
      skill_name: "spec-evaluator",
      skill_args: `--spec shapeup/${SLUG}/spec --feature ${SLUG} --single-pass`,
    },
    cwd: box,
  });
  return execFileSync("node", [HOOK], { input: payload, encoding: "utf8" }).trim();
}

// (a) partial board → must WARN, naming every unfinished task.
//
// GATE L2 is ADVISORY (ADR-0001): it permits the call and reports what it found. The assertion
// below is therefore about the WARNING, not a denial — but it is exactly as strict, because the
// thing worth protecting is unchanged: the hook must still detect a partial board and must still
// name the offenders. A demo that rendered a hand-written warning would be the lie this script
// exists to prevent, whichever decision the hook returns.
writeBoard((t) => t.partial);
const warnRaw = runHook();
if (!warnRaw) {
  rmSync(box, { recursive: true, force: true });
  throw new Error("gate-l2 said nothing about a partial board — refusing to render a demo that lies.");
}
const warn = JSON.parse(warnRaw);
if (typeof warn?.systemMessage !== "string") {
  rmSync(box, { recursive: true, force: true });
  throw new Error(`expected a systemMessage from gate-l2, got ${JSON.stringify(warn)}`);
}
for (const t of TASKS.filter((t) => t.partial !== "done")) {
  if (!warn.systemMessage.includes(t.id)) {
    rmSync(box, { recursive: true, force: true });
    throw new Error(`gate-l2 warned but never named ${t.id} — the warning does not identify the offenders`);
  }
}

// (b) green board → must stay SILENT (defer = empty stdout)
writeBoard(() => "done");
const allowRaw = runHook();
rmSync(box, { recursive: true, force: true });
if (allowRaw) throw new Error(`gate-l2 warned about a green board: ${allowRaw}`);

const REASON = warn.systemMessage.replace(/\n/g, " ");

// ─── 2. Compose the frames ─────────────────────────────────────────────────────

// Reason text is wrapped narrow enough that its 5-space indent still clears the
// right edge under the conservative advance-width below.
const wrap = (s, w = 64) =>
  s.split(/\s+/).reduce((ls, word) => {
    if (!ls.length || (ls[ls.length - 1] + " " + word).length > w) ls.push(word);
    else ls[ls.length - 1] += " " + word;
    return ls;
  }, []);

const C = {
  dim: "#7d8590", fg: "#c9d1d9", cyan: "#79c0ff", green: "#3fb950",
  red: "#ff7b72", yellow: "#d29922", mag: "#d2a8ff", white: "#f0f6fc",
};

// [text, colour, pauseAfter(beats)] — one beat ≈ BEAT seconds
const script = [
  ["$ claude", C.dim, 1],
  ["> /ship \"add dark mode\"", C.white, 2],
  ["", C.fg, 0],
  ["  GATE L0   intake + config ................. ok", C.dim, 0],
  ["  GATE L1a  orient (code surface, risk) ..... ok", C.dim, 0],
  ["  GATE L1a.5 wiring map: 4 use cases ........ ok", C.dim, 0],
  ["  GATE L1b  board: 4 tasks .................. ok", C.dim, 2],
  ["", C.fg, 0],
  ["  BUILD  TASK-001  tokens ........... ✅ T0 green", C.green, 1],
  ["  BUILD  TASK-002  toggle-ui ........ ✅ T0 green", C.green, 1],
  ["  BUILD  TASK-003  persist .......... ⬜ ready", C.yellow, 0],
  ["  BUILD  TASK-004  wiring ........... 🔄 in-progress", C.yellow, 2],
  ["", C.fg, 0],
  ["> looks good — running EVAL now", C.white, 1],
  ["  (the agent decides it is done. it is not.)", C.dim, 2],
  ["", C.fg, 0],
  ["  ⚠ PreToolUse hook — GATE L2   Skill(spec-evaluator)", C.yellow, 1],
  ...wrap(REASON).map((l) => ["     " + l, C.fg, 0]),
  ["", C.fg, 2],
  ["  ↑ verbatim stdout from hooks/gate-l2.mjs.", C.mag, 0],
  ["    Not a prompt. A script that read the board twice,", C.mag, 0],
  ["    named the offenders, and logged a `warn` row.", C.mag, 3],
  ["", C.fg, 0],
  ["  BUILD  TASK-003  persist .......... ✅ T0 green", C.green, 1],
  ["  BUILD  TASK-004  wiring ........... ✅ T0 green", C.green, 2],
  ["", C.fg, 0],
  ["> EVAL", C.white, 1],
  ["  ✅ allowed — board green, 4/4", C.green, 1],
  ["  hill 4/4 · derived from T0 artifacts, not self-report", C.cyan, 4],
];

// ─── 3. Render the animated SVG ────────────────────────────────────────────────

const BEAT = 0.55;          // seconds per beat
const LINE_T = 0.16;        // seconds per line reveal
const PAD = 22, HEAD = 36, LH = 21, FS = 14;
// 0.62 rather than the 0.60 nominal advance of Menlo/SF Mono: the asset must not clip
// on a viewer that falls back to a wider monospace face. +2 cols of slack, and emoji
// render double-width so they count twice.
const CH = FS * 0.62;
const cols = (s) => [...s].reduce((n, ch) => n + (/\p{Extended_Pictographic}/u.test(ch) ? 2 : 1), 0);

let t = 0.6;
const timed = script.map(([text, fill, pause]) => {
  const at = t;
  t += LINE_T + (pause || 0) * BEAT;
  return { text, fill, at };
});
const TOTAL = t + 2.2; // hold on the last frame before looping

const COLS = Math.max(...script.map(([text]) => cols(text))) + 2;
const W = Math.round(COLS * CH + PAD * 2);
const H = HEAD + PAD + script.length * LH + PAD;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (s) => ((s / TOTAL) * 100).toFixed(3);

const keyframes = timed
  .map((l, i) => {
    const a = pct(l.at), b = pct(l.at + LINE_T);
    return `@keyframes r${i}{0%,${a}%{opacity:0}${b}%,100%{opacity:1}}.l${i}{animation:r${i} ${TOTAL}s steps(1,end) infinite}`;
  })
  .join("");

const lines = timed
  .map((l, i) =>
    l.text
      ? `<text class="l l${i}" x="${PAD}" y="${HEAD + PAD + i * LH + FS}" fill="${l.fill}">${esc(l.text)}</text>`
      : "",
  )
  .filter(Boolean)
  .join("\n  ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace" font-size="${FS}">
  <title>shapeup-sdlc-plugin — a gate the agent cannot talk past</title>
  <desc>A terminal recording: the agent runs EVAL on a board with two unfinished tasks, and a PreToolUse hook warns, naming both — advisory, so the call proceeds on the record. The warning text is verbatim output from hooks/gate-l2.mjs.</desc>
  <style>
    /* Base state is VISIBLE on purpose: where CSS animation is unavailable (some
       renderers, reader modes, PDF export) this degrades to the whole transcript
       shown at once rather than to an empty black rectangle. */
    .l{opacity:1;white-space:pre}
    ${keyframes}
    @keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
    .cur{animation:blink 1.06s steps(1,end) infinite}
  </style>
  <rect width="${W}" height="${H}" rx="10" fill="#0d1117"/>
  <rect width="${W}" height="${HEAD}" rx="10" fill="#161b22"/>
  <rect y="${HEAD - 10}" width="${W}" height="10" fill="#161b22"/>
  <circle cx="20" cy="18" r="5.5" fill="#ff5f57"/><circle cx="39" cy="18" r="5.5" fill="#febc2e"/><circle cx="58" cy="18" r="5.5" fill="#28c840"/>
  <text x="${W / 2}" y="23" fill="#7d8590" font-size="12" text-anchor="middle">shapeup-sdlc — GATE L2</text>
  ${lines}
  <rect class="cur" x="${PAD}" y="${HEAD + PAD + script.length * LH + 4}" width="${CH.toFixed(1)}" height="${FS}" fill="#3fb950"/>
</svg>
`;

// ─── 4. Write ──────────────────────────────────────────────────────────────────

const outDir = join(ROOT, "docs", "assets");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "demo-gate.svg"), svg);

writeFileSync(
  join(outDir, "demo-gate.txt"),
  [
    "shapeup-sdlc-plugin — GATE L2 demo, plain-text transcript",
    "Generated by tools/demo/record-demo.mjs (npm run demo).",
    "",
    "The GATE L2 block below is verbatim stdout captured from a real run of",
    "hooks/gate-l2.mjs against a real partial board. Every other line is scripted",
    "narration of the surrounding pipeline steps.",
    "",
    "GATE L2 is ADVISORY (ADR-0001): it names the unfinished tasks and permits the",
    "call, recording a `warn` row. The hooks that DENY are validate-envelope,",
    "sandbox-guard, gate-intake, safety-spine and gate-zerowork.",
    "",
    "-".repeat(72),
    ...script.map(([text]) => text),
    "-".repeat(72),
    "",
    "Raw hook stdout (partial board):",
    warnRaw,
    "",
    "Raw hook stdout (green board): <empty> — exit 0, i.e. defer, nothing to report.",
    "",
  ].join("\n"),
);

console.log(`✅ verified: gate-l2 named every unfinished task and stayed silent on a green board`);
console.log(`   docs/assets/demo-gate.svg  (${(svg.length / 1024).toFixed(1)} KB, ${TOTAL.toFixed(1)}s loop)`);
console.log(`   docs/assets/demo-gate.txt`);
