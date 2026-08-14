#!/usr/bin/env node
// Demo recorder — renders docs/assets/demo-gate.svg (+ a plain-text transcript).
//
// Honesty contract (the reason this is a script and not a hand-drawn asset): the DENIAL block in
// the demo is NOT written by hand. This script compiles a real WorkOrder substrate in a temp dir,
// pipes a real PreToolUse payload into the real `hooks/sandbox-guard.mjs`, and embeds the hook's
// verbatim denial reason. It then asks for a write INSIDE the substrate and re-runs the same hook
// to prove the permitting path. If the hook's behaviour or wording changes, re-running
// `npm run demo` changes the asset — and if it stopped denying, or stopped naming the offending
// path, this script fails loudly rather than shipping a flattering picture.
//
// It drove `gate-l2` until v2.0, where that hook was retired into the gate block it advised. The
// demo moved to a hook that DENIES, which is the harder claim and the one the README makes.
//
// Everything outside the denial block is scripted narration of the pipeline steps and is labelled
// as such in docs/assets/demo-gate.txt.
//
// Usage: npm run demo

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const HOOK = join(ROOT, "hooks", "sandbox-guard.mjs");
const SLUG = "dark-mode";

// ─── 1. Drive the real hook ────────────────────────────────────────────────────

// The scope being built and the one path it must not touch. Both are real inputs to the hook: the
// substrate comes off a compiled order, exactly as it does in a run.
const ALLOWED = "src/theme/*.ts";
const OUTSIDE = "src/billing/charge.ts";
const INSIDE = "src/theme/tokens.ts";

const box = mkdtempSync(join(tmpdir(), "shapeup-demo-"));
const ordersDir = join(box, ".shapeup", SLUG, "orders");
mkdirSync(ordersDir, { recursive: true });
const orderPath = join(ordersDir, "tokens-r1-a1.json");
writeFileSync(orderPath, JSON.stringify({
  schema_version: 1,
  order_id: `${SLUG}/tokens-r1-a1`,
  worker: "task-executor",
  mode: "orchestrated",
  operation: "execute",
  round: 1,
  attempt: 1,
  substrate: { allowed: [ALLOWED], shared: [], append_only: [], frozen: [] },
  payload: { feature: SLUG, scope_contract: { scope_id: "tokens" } },
}, null, 2));
writeFileSync(join(box, ".shapeup", "active-order"), JSON.stringify({ slug: SLUG, order_path: orderPath }));

/**
 * Ask the real hook to judge one write.
 * @param {string} rel - Repo-relative path the worker wants to edit.
 * @returns {string} The hook's verbatim stdout, trimmed.
 */
function runHook(rel) {
  const payload = JSON.stringify({
    tool_name: "Edit",
    tool_input: { file_path: join(box, rel) },
    cwd: box,
  });
  return execFileSync("node", [HOOK], { input: payload, encoding: "utf8" }).trim();
}

// (a) a write outside the substrate → must DENY, naming the path.
const denyRaw = runHook(OUTSIDE);
const bail = (msg) => { rmSync(box, { recursive: true, force: true }); throw new Error(msg); };
if (!denyRaw) bail("sandbox-guard said nothing about an out-of-substrate write — refusing to render a demo that lies.");
const deny = JSON.parse(denyRaw);
const decision = deny?.hookSpecificOutput?.permissionDecision;
const reason = deny?.hookSpecificOutput?.permissionDecisionReason;
if (decision !== "deny") bail(`expected a deny from sandbox-guard, got ${JSON.stringify(deny)}`);
if (typeof reason !== "string" || !reason.includes(OUTSIDE)) {
  bail(`sandbox-guard denied but never named ${OUTSIDE} — the denial does not identify the offender`);
}

// (b) a write INSIDE the substrate → must PERMIT (defer = no deny payload).
const allowRaw = runHook(INSIDE);
rmSync(box, { recursive: true, force: true });
if (allowRaw.includes('"permissionDecision":"deny"')) {
  throw new Error(`sandbox-guard denied a write inside its own substrate: ${allowRaw}`);
}

const REASON = reason.replace(/\n/g, " ");

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
  ["  BUILD  scope tokens   substrate: src/theme/*.ts", C.dim, 2],
  ["", C.fg, 0],
  ["> the worker decides billing needs a tweak too", C.white, 1],
  ["  Edit(src/billing/charge.ts)", C.dim, 2],
  ["", C.fg, 0],
  ["  ⛔ PreToolUse hook — sandbox-guard   DENIED", C.red, 1],
  ...wrap(REASON).map((l) => ["     " + l, C.fg, 0]),
  ["", C.fg, 2],
  ["  ↑ verbatim stdout from hooks/sandbox-guard.mjs.", C.mag, 0],
  ["    Not a prompt. A script that read the order's own", C.mag, 0],
  ["    substrate and named the path it does not cover.", C.mag, 3],
  ["", C.fg, 0],
  ["> back inside the scope", C.white, 1],
  ["  Edit(src/theme/tokens.ts) ......... ✅ permitted", C.green, 2],
  ["", C.fg, 0],
  ["  BUILD  scope tokens ............... ✅ T0 green", C.green, 1],
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
  <desc>A terminal recording: a worker tries to edit a file outside the scope it was given, and a PreToolUse hook denies the write, naming the path. The next edit, inside the scope, is permitted. The denial text is verbatim output from hooks/sandbox-guard.mjs.</desc>
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
  <text x="${W / 2}" y="23" fill="#7d8590" font-size="12" text-anchor="middle">shapeup-sdlc — sandbox-guard</text>
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
    "shapeup-sdlc-plugin — sandbox-guard demo, plain-text transcript",
    "Generated by tools/demo/record-demo.mjs (npm run demo).",
    "",
    "The denial block below is verbatim stdout captured from a real run of",
    "hooks/sandbox-guard.mjs against a real compiled order. Every other line is",
    "scripted narration of the surrounding pipeline steps.",
    "",
    "This is a DENY, not a warning: the write does not happen. The other walls are",
    "harness verify envelope, gate-intake, safety-spine and gate-zerowork.",
    "",
    "-".repeat(72),
    ...script.map(([text]) => text),
    "-".repeat(72),
    "",
    `Raw hook stdout (write to ${OUTSIDE}):`,
    denyRaw,
    "",
    `Raw hook stdout (write to ${INSIDE}): permitted — no deny payload.`,
    "",
  ].join("\n"),
);

console.log(`✅ verified: sandbox-guard denied the out-of-substrate write by name, and permitted the in-substrate one`);
console.log(`   docs/assets/demo-gate.svg  (${(svg.length / 1024).toFixed(1)} KB, ${TOTAL.toFixed(1)}s loop)`);
console.log(`   docs/assets/demo-gate.txt`);
