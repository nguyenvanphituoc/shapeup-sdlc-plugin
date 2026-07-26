// Structural test module: the anti-lying-kit sub-plugin (plugins/anti-lying-kit).
//
// This one is BEHAVIOURAL, not just well-formedness, because the kit's whole value is a single
// bit — deny or defer — and both wrong answers are damaging in opposite ways:
//   • a false DENY blocks legitimate work → the user uninstalls the kit → it protects nothing
//   • a false DEFER is INVISIBLE → the gate looks installed and enforces nothing
//
// The false-defer case is why these tests exist. The first implementation matched per-item
// calls with `--single\b`, which also matches `--single-pass` — a WHOLE-ROUND flag — so the
// gate silently deferred on exactly the call it exists to catch. Nothing surfaced that; only
// running it did. Section 31 pins it.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/**
 * Run the anti-lying-kit structural + behavioural checks.
 * @param {object} ctx - Shared harness context from tests/lib/harness.mjs (makeCtx).
 * @returns {Promise<void>} Resolves when the sections finish; assertions record on ctx.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, readJSON } = ctx;

  const KIT = join(ROOT, "plugins", "anti-lying-kit");
  if (!existsSync(KIT)) return; // sub-plugin absent → nothing to assert (non-regression)

  // =============================================================================
  section("30. anti-lying-kit is a well-formed, self-contained, dependency-free plugin");
  // =============================================================================
  const manifest = join(KIT, ".claude-plugin", "plugin.json");
  if (!existsSync(manifest)) {
    fail("anti-lying-kit has no .claude-plugin/plugin.json");
  } else {
    const m = readJSON(manifest);
    m.name === "anti-lying-kit"
      ? ok('kit manifest name is "anti-lying-kit"')
      : fail(`kit manifest name is "${m.name}"`);
    // A sub-product that ships a dependency is not adoptable in one command.
    !m.dependencies || m.dependencies.length === 0
      ? ok("kit declares no plugin dependencies (installable standalone)")
      : fail(`kit declares dependencies: ${JSON.stringify(m.dependencies)}`);
  }

  // The marketplace must actually list it, or `/plugin install anti-lying-kit@…` 404s.
  const mkt = readJSON(join(ROOT, ".claude-plugin", "marketplace.json"));
  const entry = (mkt.plugins || []).find((p) => p.name === "anti-lying-kit");
  entry
    ? ok("marketplace lists anti-lying-kit")
    : fail("marketplace does not list anti-lying-kit — it would not be installable");
  if (entry) {
    existsSync(join(ROOT, entry.source))
      ? ok(`marketplace source resolves (${entry.source})`)
      : fail(`marketplace source does not exist: ${entry.source}`);
  }

  // Hooks manifest wiring: real events, and every referenced script present.
  const VALID = new Set(["SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse",
    "PostToolUse", "Notification", "Stop", "SubagentStop", "PreCompact", "Setup"]);
  const hooks = readJSON(join(KIT, "hooks", "hooks.json"));
  for (const evt of Object.keys(hooks.hooks || {})) {
    VALID.has(evt) ? ok(`kit hook event "${evt}" is real`) : fail(`kit hook event "${evt}" is not a Claude Code event — silently ignored`);
  }
  for (const group of Object.values(hooks.hooks || {}).flat()) {
    for (const h of group.hooks || []) {
      const rel = (h.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s"]+)/) || [])[1];
      if (!rel) continue;
      existsSync(join(KIT, rel))
        ? ok(`kit hook script exists: ${rel}`)
        : fail(`kit hook script dangles: ${rel}`);
    }
  }

  // The trust claim in the kit's README, asserted rather than believed.
  const NET = /\b(fetch|node:http|node:https|node:net|node:dgram)\b|\bcurl\b|\bwget\b/;
  for (const f of ["hooks/gate-done.mjs", "hooks/no-fake-done.mjs", "hooks/slop-check.mjs", "lib/board.mjs"]) {
    const src = ctx.read(join(KIT, f));
    // Strip line comments so prose about grepping for these words doesn't trip the check.
    const code = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    NET.test(code)
      ? fail(`${f} appears to make a network call — the kit claims it never does`)
      : ok(`${f} makes no network call`);
  }

  // =============================================================================
  section("31. anti-lying-kit gate: denies a partial board, defers everywhere it cannot prove one");
  // =============================================================================
  const GATE = join(KIT, "hooks", "gate-done.mjs");

  /**
   * Drive the real gate hook in a throwaway project.
   * @returns {{denied:boolean, reason:string}}
   */
  const probe = ({ config, tasks, toolInput, toolName = "Skill" }) => {
    const box = mkdtempSync(join(tmpdir(), "alk-"));
    try {
      mkdirSync(join(box, "specs", "001-f"), { recursive: true });
      if (config !== null) writeFileSync(join(box, ".antilying.json"), config);
      if (tasks !== null) writeFileSync(join(box, "specs", "001-f", "tasks.md"), tasks);
      const payload = JSON.stringify({ tool_name: toolName, tool_input: toolInput, cwd: box });
      const r = spawnSync("node", [GATE], { input: payload, encoding: "utf8", timeout: 20_000 });
      const out = (r.stdout || "").trim();
      if (!out) return { denied: false, reason: "" };
      const d = JSON.parse(out).hookSpecificOutput;
      return { denied: d?.permissionDecision === "deny", reason: d?.permissionDecisionReason || "" };
    } finally {
      rmSync(box, { recursive: true, force: true });
    }
  };

  const PARTIAL = "- [x] T001 done thing\n- [ ] T002 open thing\n";
  const GREEN = "- [x] T001 done thing\n- [x] T002 also done\n";
  const CFG = '{"preset":"spec-kit"}';

  // The one case that MUST deny.
  const r1 = probe({ config: CFG, tasks: PARTIAL, toolInput: { skill: "review" } });
  r1.denied && /T002/.test(r1.reason)
    ? ok("gate DENIES a review call on a partial board, naming the unfinished task")
    : fail(`gate failed to deny a partial board (denied=${r1.denied}, reason="${r1.reason.slice(0, 120)}")`);

  // Every case that must DEFER. A false deny here is a rage-quit; a false defer is invisible.
  const deferCases = [
    ["green board", { config: CFG, tasks: GREEN, toolInput: { skill: "review" } }],
    ["no config (not opted in)", { config: null, tasks: PARTIAL, toolInput: { skill: "review" } }],
    ["malformed config", { config: "{broken", tasks: PARTIAL, toolInput: { skill: "review" } }],
    ["unknown preset", { config: '{"preset":"nope"}', tasks: PARTIAL, toolInput: { skill: "review" } }],
    ["no board file", { config: CFG, tasks: null, toolInput: { skill: "review" } }],
    ["board with no task lines", { config: CFG, tasks: "# Notes\n\nprose only\n", toolInput: { skill: "review" } }],
    ["unrelated tool", { config: CFG, tasks: PARTIAL, toolInput: { skill: "prettier-format" } }],
    ["per-item grading (--task T002)", { config: CFG, tasks: PARTIAL, toolInput: { skill: "review", skill_args: "--task T002" } }],
  ];
  for (const [label, args] of deferCases) {
    const r = probe(args);
    !r.denied ? ok(`gate defers: ${label}`) : fail(`gate wrongly DENIED on: ${label} — "${r.reason.slice(0, 110)}"`);
  }

  // Regression pin: `--single-pass` is a WHOLE-ROUND flag and must still be gated. The original
  // `--single\b` matcher matched it and silently deferred, disabling the gate invisibly.
  const r2 = probe({ config: CFG, tasks: PARTIAL, toolInput: { skill: "spec-evaluator", skill_args: "--single-pass" } });
  r2.denied
    ? ok("gate still DENIES with --single-pass (whole-round flag is not mistaken for per-item)")
    : fail("gate deferred on --single-pass — the per-item matcher is over-matching a whole-round flag again");

  // And the mirror: a bare `--single` IS per-item and must defer.
  const r3 = probe({ config: CFG, tasks: PARTIAL, toolInput: { skill: "review", skill_args: "--single" } });
  !r3.denied
    ? ok("gate defers on a bare --single (genuine per-item check)")
    : fail("gate denied a bare --single, which is a per-item check");
}
