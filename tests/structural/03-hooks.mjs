// Structural test module: hooks. Split out of tests/structural.mjs (Track C).
// Sections: 4, 14, 17, 27, 28, 29. Byte-identical bodies; the runner threads the shared ctx.
import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/**
 * Run the hooks structural checks.
 * @param {object} ctx - Shared harness context from tests/lib/harness.mjs (makeCtx).
 *   Carries ROOT (repo root), the ok/fail/section counters, and the read/readJSON/
 *   frontmatter/walk helpers. ok()/fail() mutate ctx.checks/ctx.failures in place.
 * @returns {Promise<void>} Resolves when the section bodies finish; assertions are
 *   recorded as side effects on ctx (never thrown for an ordinary check failure).
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON, frontmatter, walk } = ctx;

  // =============================================================================
  section("4. Hooks manifest (if present) is valid JSON, uses real events, and resolves its scripts");
  // =============================================================================
  // Beyond parsing, guard the F2-class bug the audit found: a hook keyed on a NON-EXISTENT event
  // (the old `ShapeupSessionStart`) is silently ignored — it looks wired but enforces nothing. So we
  // also assert every event key is a real Claude Code hook event, and every `${CLAUDE_PLUGIN_ROOT}`
  // script a command invokes actually exists in a shipped dir (or it would dangle at install).
  const VALID_HOOK_EVENTS = new Set([
    "SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PostToolUse",
    "Notification", "Stop", "SubagentStop", "PreCompact", "Setup",
  ]);
  const hooksPath = join(ROOT, "hooks/hooks.json");
  if (existsSync(hooksPath)) {
    let hooksManifest;
    try { hooksManifest = readJSON(hooksPath); ok("hooks.json parses"); }
    catch (e) { fail(`hooks.json does not parse: ${e.message}`); }
    if (hooksManifest?.hooks) {
      for (const [event, groups] of Object.entries(hooksManifest.hooks)) {
        if (VALID_HOOK_EVENTS.has(event)) ok(`hook event "${event}" is a real Claude Code event`);
        else fail(`hook event "${event}" is not a valid event — it will be silently ignored (the F2 bug class)`);
        for (const g of groups || []) {
          for (const h of g.hooks || []) {
            // A command that runs a plugin-bundled script must point at a file that exists.
            const sm = (h.command || "").match(/\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+?\.(?:mjs|js|sh|cjs))/);
            if (sm) {
              if (existsSync(join(ROOT, sm[1]))) ok(`hook script ${sm[1]} exists`);
              else fail(`hook command references ${sm[1]} which does not exist (would dangle at install)`);
            }
          }
        }
      }
    }
  }


  // =============================================================================
  section("14. GATE L2 PreToolUse hook denies a red board and allows a green one (Stage E1)");
  // =============================================================================
  // The one gate the runtime actually enforces (audit E1 / F2). We feed the hook crafted PreToolUse
  // payloads against temp board fixtures and assert its decisions: deny the once-per-round EVAL on a
  // partial board, allow it on a green one, and never gate per-task evals / other skills / boardless
  // runs (fail-open so it can't break legitimate flows).
  const gatePath = join(ROOT, "hooks/gate-l2.mjs");
  if (existsSync(gatePath)) {
    const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    // Build a board fixture; `done` flips TASK-002 between done and in-progress.
    const makeSpec = (secondDone) => {
      const dir = mkdtempSync(join(tmpdir(), "gate-l2-"));
      const tasks = join(dir, "spec", "tasks");
      mkdirSync(tasks, { recursive: true });
      const mark = secondDone ? "✅ done" : "🔄 in-progress";
      writeFileSync(join(tasks, "_index.md"),
        `---\ntype: task-board\n---\n| ID | Title | Status |\n|---|---|---|\n| TASK-001 | A | ✅ done |\n| TASK-002 | B | ${mark} |\n`);
      writeFileSync(join(tasks, "TASK-001-a.md"), `---\nid: TASK-001\nstatus: done\n---\n`);
      writeFileSync(join(tasks, "TASK-002-b.md"), `---\nid: TASK-002\nstatus: ${secondDone ? "done" : "in-progress"}\n---\n`);
      return dir;
    };
    const ask = (cwd, skillArgs, skillName = "spec-evaluator", toolName = "Skill") => {
      const payload = JSON.stringify({ tool_name: toolName, cwd, tool_input: { skill_name: skillName, skill_args: skillArgs } });
      const r = spawnSync("node", [gatePath], { encoding: "utf8", input: payload });
      const denied = (r.stdout || "").includes('"permissionDecision":"deny"');
      return { denied, out: r.stdout || "" };
    };
    // v0.4.0 Local Tasks Architecture fixture: committed spec dir is boardless; the board lives
    // under the LOCAL gitignored root .shapeup-sdlc/<slug>/tasks/. `withBoard: false` models a
    // teammate's machine that pulled the spec but never generated a local board (must fail-open —
    // spec-evaluator v0.9 grades from the committed spec there).
    const makeLocalSpec = (secondDone, withBoard = true) => {
      const dir = mkdtempSync(join(tmpdir(), "gate-l2-local-"));
      mkdirSync(join(dir, "docs", "shapeup-sdlc", "demo", "spec", "usecases"), { recursive: true });
      if (withBoard) {
        const tasks = join(dir, ".shapeup-sdlc", "demo", "tasks");
        mkdirSync(tasks, { recursive: true });
        const mark = secondDone ? "✅ done" : "🔄 in-progress";
        writeFileSync(join(tasks, "_index.md"),
          `---\ntype: task-board\n---\n| ID | Title | Status |\n|---|---|---|\n| TASK-001 | A | ✅ done |\n| TASK-002 | B | ${mark} |\n`);
        writeFileSync(join(tasks, "TASK-001-a.md"), `---\nid: TASK-001\nstatus: done\n---\n`);
        writeFileSync(join(tasks, "TASK-002-b.md"), `---\nid: TASK-002\nstatus: ${secondDone ? "done" : "in-progress"}\n---\n`);
      }
      return dir;
    };
    const green = makeSpec(true), red = makeSpec(false);
    const lGreen = makeLocalSpec(true), lRed = makeLocalSpec(false), lBoardless = makeLocalSpec(true, false);
    try {
      // 1. Red board + round mode → DENY, naming the unfinished task.
      const a = ask(red, "--spec spec --feature demo --single-pass");
      if (a.denied && a.out.includes("TASK-002")) ok("gate DENIES round EVAL on a partial board (names TASK-002)");
      else fail(`gate did not deny a red-board round EVAL — the gate is not enforcing\n${a.out}`);

      // 2. Green board + round mode → ALLOW (defer, no deny).
      const b = ask(green, "--spec spec --feature demo --single-pass");
      if (!b.denied) ok("gate ALLOWS round EVAL on a fully-green board");
      else fail(`gate denied a green board — false block\n${b.out}`);

      // 3. Red board but per-task eval (--task) → defer (not gated).
      const c = ask(red, "--spec spec --task TASK-001");
      if (!c.denied) ok("gate does NOT gate a per-task eval (--task)");
      else fail("gate wrongly blocked a per-task eval — board-green rule must be round-only");

      // 4. Other skill → defer.
      const d = ask(red, "--spec spec --single-pass", "task-executor");
      if (!d.denied) ok("gate ignores non-spec-evaluator skills");
      else fail("gate blocked a non-spec-evaluator skill");

      // 5. Non-Skill tool → defer.
      const e = ask(red, "--spec spec --single-pass", "spec-evaluator", "Bash");
      if (!e.denied) ok("gate ignores non-Skill tool calls");
      else fail("gate blocked a non-Skill tool call");

      // 6. v0.4.0 layout, red LOCAL board → DENY. This is the island-escape regression: the board
      //    is not in <spec>/tasks/, and a hook that only looks there fail-opens on a stale board.
      const f = ask(lRed, "--spec docs/shapeup-sdlc/demo/spec --feature demo --single-pass");
      if (f.denied && f.out.includes("TASK-002")) ok("gate DENIES a red LOCAL board (.shapeup-sdlc/<slug>/tasks/, v0.4.0 layout)");
      else fail(`gate fail-opened on a red LOCAL board — v0.4.0 island-escape hole is back\n${f.out}`);

      // 7. v0.4.0 layout, green LOCAL board → ALLOW.
      const g = ask(lGreen, "--spec docs/shapeup-sdlc/demo/spec --feature demo --single-pass");
      if (!g.denied) ok("gate ALLOWS a green LOCAL board");
      else fail(`gate denied a green LOCAL board — false block\n${g.out}`);

      // 8. No --feature → slug derived from the spec path convention (docs/shapeup-sdlc/<slug>/spec).
      const h = ask(lRed, "--spec docs/shapeup-sdlc/demo/spec --single-pass");
      if (h.denied && h.out.includes("TASK-002")) ok("gate derives <slug> from the spec path when --feature is absent");
      else fail(`gate did not find the LOCAL board without --feature — slug derivation broken\n${h.out}`);

      // 9. Committed spec present but NO local board anywhere → defer (fail-open). A grading
      //    machine that never generated a board is legitimate (spec-evaluator v0.9).
      const i = ask(lBoardless, "--spec docs/shapeup-sdlc/demo/spec --feature demo --single-pass");
      if (!i.denied) ok("gate fail-opens when no board exists on this machine (boardless grading is legitimate)");
      else fail("gate blocked a boardless machine — breaks v0.4.0 remote-grading flow");

      // 10. Pure-skill envelope shape (v1.0): the round EVAL now dispatches as
      //     `spec-evaluator --order <WorkOrder operation:evaluate>` — the gate must read the
      //     order and deny on a red board just like the legacy flag shape, and stay quiet for
      //     a non-evaluate order (some other worker's dispatch).
      const mkOrder = (dir, operation, worker = "spec-evaluator") => {
        const op = join(dir, ".shapeup-sdlc", "demo", "orders");
        mkdirSync(op, { recursive: true });
        const pth = join(op, `${operation}-r1.json`);
        writeFileSync(pth, JSON.stringify({
          schema_version: 1, order_id: `demo/${operation}-r1`, worker, mode: "orchestrated",
          operation, payload: { feature: "demo", spec_folder: "docs/shapeup-sdlc/demo/spec" },
        }));
        return pth;
      };
      const jr = ask(lRed, `--order ${mkOrder(lRed, "evaluate")}`);
      if (jr.denied && jr.out.includes("TASK-002")) ok("gate DENIES an --order round EVAL on a red board (envelope shape gated)");
      else fail(`gate fail-opened on an --order eval dispatch — the pure-skill port bypasses GATE L2\n${jr.out}`);
      const jg = ask(lGreen, `--order ${mkOrder(lGreen, "evaluate")}`);
      if (!jg.denied) ok("gate ALLOWS an --order round EVAL on a green board");
      else fail(`gate denied a green-board --order eval — false block\n${jg.out}`);
    } finally {
      rmSync(green, { recursive: true, force: true });
      rmSync(red, { recursive: true, force: true });
      rmSync(lGreen, { recursive: true, force: true });
      rmSync(lRed, { recursive: true, force: true });
      rmSync(lBoardless, { recursive: true, force: true });
    }
  } else {
    console.log("  (gate-l2 hook not found — skipping)");
  }


  // =============================================================================
  section("17. Sandbox guard (PA3) denies an out-of-substrate write and allows an in-substrate one");
  // =============================================================================
  // The v0.3.0 write-whitelist hook (design spec §4.5/Blueprint E). Same fixture style as #14:
  // craft PreToolUse payloads against a temp checkout with a scope contract + active-scope
  // pointer, and assert the hook's allow/deny decisions.
  const sandboxGuardPath = join(ROOT, "hooks/sandbox-guard.mjs");
  if (existsSync(sandboxGuardPath)) {
    const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const makeCheckout = (withScope) => {
      const dir = mkdtempSync(join(tmpdir(), "sandbox-guard-"));
      if (withScope) {
        mkdirSync(join(dir, ".shapeup-sdlc"), { recursive: true });
        writeFileSync(join(dir, ".shapeup-sdlc", "active-scope"), JSON.stringify({ slug: "demo", scope_id: "cart-creation" }));
        const scopesDir = join(dir, "docs", "shapeup-sdlc", "demo", "scopes");
        mkdirSync(scopesDir, { recursive: true });
        writeFileSync(join(scopesDir, "cart-creation.json"), JSON.stringify({
          scope_id: "cart-creation",
          allowed_file_substrate: ["apps/web/cart/*.tsx", "apps/api/cart/*.ts"],
          shared_substrate: ["packages/shared/http.ts"],
        }));
      }
      return dir;
    };
    const ask = (cwd, filePath, toolName = "Edit") => {
      const payload = JSON.stringify({ tool_name: toolName, cwd, tool_input: { file_path: filePath } });
      const r = spawnSync("node", [sandboxGuardPath], { encoding: "utf8", input: payload });
      const denied = (r.stdout || "").includes('"permissionDecision":"deny"');
      return { denied, out: r.stdout || "" };
    };
    const scoped = makeCheckout(true), unscoped = makeCheckout(false);
    try {
      // 1. In-substrate write → allow (defer).
      const a = ask(scoped, join(scoped, "apps/web/cart/Cart.tsx"));
      if (!a.denied) ok("sandbox guard ALLOWS a write inside the scope's substrate");
      else fail(`sandbox guard wrongly denied an in-substrate write\n${a.out}`);

      // 2. Declared shared_substrate write → allow.
      const b = ask(scoped, join(scoped, "packages/shared/http.ts"));
      if (!b.denied) ok("sandbox guard ALLOWS a write to declared shared_substrate");
      else fail(`sandbox guard wrongly denied a shared_substrate write\n${b.out}`);

      // 3. Out-of-substrate write → deny, naming the offending path.
      const c = ask(scoped, join(scoped, "apps/api/payments/handler.ts"));
      if (c.denied && c.out.includes("apps/api/payments/handler.ts")) ok("sandbox guard DENIES an out-of-substrate write (names the path)");
      else fail(`sandbox guard did not deny an out-of-substrate write — the guard is not enforcing\n${c.out}`);

      // 4. Pathology telemetry: the deny above must have appended a PA3 event to metrics/.
      const metricsDir = join(scoped, "docs", "shapeup-sdlc", "metrics");
      const shard = existsSync(metricsDir) ? readdirSync(metricsDir).find((f) => f.endsWith(".jsonl")) : null;
      if (shard && read(join(metricsDir, shard)).includes('"PA3"')) ok("sandbox guard logs a PA3 pathology event to metrics/*.jsonl on deny");
      else fail("sandbox guard did not log a PA3 pathology event on deny");

      // 5. Run-trace carve-out: the doer MUST be able to write the active feature's LOCAL root —
      //    task board status/AC ticks (task-executor P3) and the discovery ledger (P3.7). Blocking
      //    these strands the board (island-escape: 16/20 task files stale on a shipped feature).
      const rt1 = ask(scoped, join(scoped, ".shapeup-sdlc/demo/tasks/TASK-001-a.md"));
      if (!rt1.denied) ok("sandbox guard ALLOWS a task-board write under the active run-trace root");
      else fail(`sandbox guard denied the doer's own board bookkeeping (P3 doc update would strand)\n${rt1.out}`);
      const rt2 = ask(scoped, join(scoped, ".shapeup-sdlc/demo/discovery/ledger.md"));
      if (!rt2.denied) ok("sandbox guard ALLOWS a discovery-ledger write under the active run-trace root");
      else fail(`sandbox guard denied the P3.7 discovery-ledger write\n${rt2.out}`);

      // 6. The guard's own pointer is NOT carved out — a worker must never rewrite its sandbox.
      const rt3 = ask(scoped, join(scoped, ".shapeup-sdlc/active-scope"));
      if (rt3.denied) ok("sandbox guard still DENIES writing .shapeup-sdlc/active-scope (pointer stays guard-only)");
      else fail("sandbox guard allowed a write to .shapeup-sdlc/active-scope — a worker could widen its own sandbox");

      // 7. Another feature's run-trace root is NOT carved out (carve-out is active-slug only).
      const rt4 = ask(scoped, join(scoped, ".shapeup-sdlc/other-feature/tasks/_index.md"));
      if (rt4.denied) ok("sandbox guard still DENIES a different feature's run-trace root");
      else fail("sandbox guard allowed a write to another feature's run-trace — carve-out too wide");

      // 8. No active-scope pointer (no harness round in progress) → defer, never break a plain edit.
      const d = ask(unscoped, join(unscoped, "anything.ts"));
      if (!d.denied) ok("sandbox guard defers (fail-open) when no active-scope pointer exists");
      else fail("sandbox guard wrongly denied a write with no harness round in progress");

      // 9. Non Edit/Write/MultiEdit tool → defer.
      const e = ask(scoped, join(scoped, "apps/api/payments/handler.ts"), "Bash");
      if (!e.denied) ok("sandbox guard ignores non-Edit/Write/MultiEdit tool calls");
      else fail("sandbox guard wrongly gated a non-write tool call");
    } finally {
      rmSync(scoped, { recursive: true, force: true });
      rmSync(unscoped, { recursive: true, force: true });
    }

    // Unit-level glob matcher check (no process spawn needed).
    const { globToRegExp, matchesAny } = await import(sandboxGuardPath);
    if (globToRegExp("apps/web/cart/*.tsx").test("apps/web/cart/Cart.tsx")) ok("globToRegExp matches a single-star glob");
    else fail("globToRegExp failed to match a single-star glob");
    if (!globToRegExp("apps/web/cart/*.tsx").test("apps/web/cart/sub/Cart.tsx")) ok("globToRegExp single-star does not cross a path segment");
    else fail("globToRegExp single-star wrongly crossed a path segment");
    if (matchesAny("apps/api/cart/route.ts", ["apps/web/cart/*.tsx", "apps/api/cart/*.ts"])) ok("matchesAny finds a match across multiple globs");
    else fail("matchesAny failed to find a match across multiple globs");
  } else {
    console.log("  (sandbox-guard.mjs not found — skipping)");
  }


  // =============================================================================
  section("27. safety-spine hook denies destructive/secret operations, honors overrides, fails open");
  // =============================================================================
  {
    const spinePath = join(ROOT, "hooks/safety-spine.mjs");
    const d = mkdtempSync(join(tmpdir(), "spine-"));
    const ask = (payload) => {
      const r = spawnSync("node", [spinePath], { encoding: "utf8", input: JSON.stringify(payload) });
      let out = null;
      try { out = JSON.parse(r.stdout); } catch { /* silent = allow */ }
      return { status: r.status, out };
    };
    const bash = (command) => ({ tool_name: "Bash", cwd: d, tool_input: { command } });
    const denies = (payload, category, label) => {
      const { status, out } = ask(payload);
      const decision = out?.hookSpecificOutput?.permissionDecision;
      const reason = out?.hookSpecificOutput?.permissionDecisionReason || "";
      if (status === 0 && decision === "deny" && reason.includes(category)) ok(`denies ${label} (${category})`);
      else fail(`should deny ${label} as ${category}, got decision=${decision} reason=${reason.slice(0, 80)}`);
    };
    const allows = (payload, label) => {
      const { status, out } = ask(payload);
      if (status === 0 && !out) ok(`allows ${label}`);
      else fail(`should allow ${label}, got ${JSON.stringify(out)}`);
    };

    denies(bash("rm -rf /"), "destructive-fs", "rm -rf /");
    denies(bash("rm -rf ~/"), "destructive-fs", "rm -rf ~/");
    denies(bash("cd /tmp && rm -rf .."), "destructive-fs", "rm -rf .. behind &&");
    denies(bash("git push --force origin main"), "git-destructive", "force push");
    denies(bash("git push origin main"), "git-destructive", "push to main");
    denies(bash("git reset --hard HEAD~3"), "git-destructive", "hard reset");
    denies(bash('psql -c "DROP TABLE users;"'), "sql-destructive", "DROP TABLE");
    denies(bash("cat .env"), "secret-read", "cat .env");
    denies(bash("grep KEY ~/.ssh/id_rsa"), "secret-read", "grep ssh private key");
    denies(bash("echo '{}' > .shapeup-sdlc/safety-overrides.json"), "self-protect", "redirect into overrides file");
    denies({ tool_name: "Read", cwd: d, tool_input: { file_path: join(d, ".env") } }, "secret-read", "Read(.env)");
    denies({ tool_name: "Write", cwd: d, tool_input: { file_path: ".shapeup-sdlc/safety-overrides.json", content: "{}" } }, "self-protect", "Write(overrides)");

    allows(bash("rm -rf ./build"), "rm -rf ./build (relative multi-segment)");
    allows(bash("git push"), "plain git push");
    allows(bash("git push --force-with-lease origin feat-x"), "--force-with-lease");
    allows(bash("git reset --soft HEAD~1"), "git reset --soft");
    allows(bash("cat .env.example"), ".env.example");
    allows(bash("npm test"), "npm test");
    allows({ tool_name: "Read", cwd: d, tool_input: { file_path: join(d, "README.md") } }, "Read(README.md)");

    // Denies are telemetry, not just defense: a SAFETY pathology row must have been logged.
    const spineMetricsDir = join(d, "docs/shapeup-sdlc/metrics");
    const spineRows = existsSync(spineMetricsDir)
      ? readdirSync(spineMetricsDir).flatMap((f) => read(join(spineMetricsDir, f)).trim().split("\n")).map((l) => JSON.parse(l))
      : [];
    if (spineRows.some((r) => r.pathology === "SAFETY" && r.category === "destructive-fs")) ok("denies append SAFETY pathology rows to the metrics shard");
    else fail("no SAFETY pathology row was logged for a deny");

    // Override file: exempts the matching command, is itself logged, and fails CLOSED when corrupt.
    mkdirSync(join(d, ".shapeup-sdlc"), { recursive: true });
    writeFileSync(join(d, ".shapeup-sdlc/safety-overrides.json"),
      JSON.stringify({ schema_version: 1, allow_commands: ["^git push origin main$"], note: "CI deploy branch" }));
    allows(bash("git push origin main"), "push to main WITH override");
    const overrideRows = readdirSync(spineMetricsDir).flatMap((f) => read(join(spineMetricsDir, f)).trim().split("\n")).map((l) => JSON.parse(l));
    if (overrideRows.some((r) => r.pathology === "SAFETY-OVERRIDE")) ok("an exercised override is logged as SAFETY-OVERRIDE (visible, never silent)");
    else fail("override was exercised but no SAFETY-OVERRIDE row was logged");
    writeFileSync(join(d, ".shapeup-sdlc/safety-overrides.json"), "broken{");
    denies(bash("git push origin main"), "git-destructive", "push to main with CORRUPT override (override channel fails closed)");

    // Fail-open on garbage stdin.
    const garbage = spawnSync("node", [spinePath], { encoding: "utf8", input: "not json" });
    if (garbage.status === 0 && !garbage.stdout.trim()) ok("garbage stdin → silent exit 0 (fail-open)");
    else fail(`garbage stdin should fail open, got status=${garbage.status} stdout=${garbage.stdout}`);
    rmSync(d, { recursive: true, force: true });
  }


  // =============================================================================
  section("28. Advisory Stop hooks inform but can never block (QA is a level-up, not a gate)");
  // =============================================================================
  {
    const arPath = join(ROOT, "hooks/anti-rationalization.mjs");
    const scPath = join(ROOT, "hooks/slop-cleaner.mjs");
    const d = mkdtempSync(join(tmpdir(), "stop-"));
    const w = (rel, body) => { mkdirSync(dirname(join(d, rel)), { recursive: true }); writeFileSync(join(d, rel), body); };
    w(".shapeup-sdlc/active-scope", JSON.stringify({ slug: "demo", scope_id: "cart" }));
    w(".shapeup-sdlc/demo/tasks/TASK-001.md", `---\nid: TASK-001\nstatus: done\n---\n`);
    w(".shapeup-sdlc/demo/tasks/TASK-002.md", `---\nid: TASK-002\nstatus: in-progress\n---\n`);
    w(".shapeup-sdlc/demo/t0/verdicts/r1-a1.json", JSON.stringify({ overall: "red" }));

    const stop = (path, payload) => {
      const r = spawnSync("node", [path], { encoding: "utf8", input: JSON.stringify(payload) });
      let out = null;
      try { out = JSON.parse(r.stdout); } catch { /* silent */ }
      return { status: r.status, out, raw: r.stdout };
    };

    const claim = { cwd: d, stop_hook_active: false, last_assistant_message: "All done — feature complete, all tests pass." };
    const red = stop(arPath, claim);
    if (red.status === 0 && red.out?.systemMessage) ok("claim + contradicting facts → advisory systemMessage");
    else fail(`expected systemMessage on red fixture, got: ${red.raw}`);
    if (red.out?.systemMessage?.includes("TASK-002") && red.out?.systemMessage?.includes("red")) ok("message names the specific facts (task + red T0)");
    else fail(`message doesn't name the facts: ${red.out?.systemMessage}`);
    if (red.out && !("decision" in red.out)) ok("output carries NO decision key — advisory can never block");
    else fail("advisory hook emitted a decision key — that's a gate, not a level-up");

    const claimless = stop(arPath, { ...claim, last_assistant_message: "Still investigating the parser." });
    if (claimless.status === 0 && !claimless.out) ok("no completion claim → silent");
    else fail(`claimless message should be silent, got: ${claimless.raw}`);

    const looping = stop(arPath, { ...claim, stop_hook_active: true });
    if (looping.status === 0 && !looping.out) ok("stop_hook_active → silent (no stop-hook loops)");
    else fail("hook fired while stop_hook_active");

    w(".shapeup-sdlc/demo/tasks/TASK-002.md", `---\nid: TASK-002\nstatus: done\n---\n`);
    w(".shapeup-sdlc/demo/t0/verdicts/r1-a2.json", JSON.stringify({ overall: "green" }));
    const green = stop(arPath, claim);
    if (green.status === 0 && !green.out) ok("green board + green T0 → claim stands, silent");
    else fail(`green fixture should be silent, got: ${green.raw}`);

    const noRun = mkdtempSync(join(tmpdir(), "norun-"));
    const idle = stop(arPath, { cwd: noRun, stop_hook_active: false, last_assistant_message: "All done." });
    if (idle.status === 0 && !idle.out) ok("no harness run → silent (harness-scoped, not an always-on nag)");
    else fail(`no-run case should be silent, got: ${idle.raw}`);

    // slop-cleaner: pure scanner unit + fail-open CLI.
    const { scanDiff, summarize } = await import(scPath);
    const dirtyDiff = [
      "+++ b/src/x.ts", "+console.log(1)", "+// TODO fix this later", "+const a = 1;",
      "+++ b/src/clean.ts", "+const b = 2;",
    ].join("\n");
    const findings = scanDiff(dirtyDiff);
    if (findings.length === 1 && findings[0].file === "src/x.ts" && findings[0].markers["console.log"] === 1 && findings[0].markers["TODO/FIXME"] === 1)
      ok("scanDiff flags console.log + TODO in added lines only");
    else fail(`scanDiff wrong: ${JSON.stringify(findings)}`);
    if (scanDiff(["+++ b/src/clean.ts", "+const b = 2;"].join("\n")).length === 0) ok("scanDiff stays quiet on a clean diff");
    else fail("scanDiff flagged a clean diff");
    const bigDiff = ["+++ b/src/gen.ts", ...Array.from({ length: 500 }, (_, i) => `+line ${i}`)].join("\n");
    if (scanDiff(bigDiff)[0]?.big && summarize(scanDiff(bigDiff))[0].includes("+500 lines")) ok("scanDiff flags a 500-line single-file add");
    else fail("scanDiff missed the big-file signal");
    const scIdle = stop(scPath, { cwd: noRun, stop_hook_active: false });
    if (scIdle.status === 0 && !scIdle.out) ok("slop-cleaner: no run → silent exit 0 (fail-open)");
    else fail(`slop-cleaner no-run case not silent: ${scIdle.raw}`);
    rmSync(d, { recursive: true, force: true });
    rmSync(noRun, { recursive: true, force: true });
  }


  // =============================================================================
  section("29. run-snapshot derives mid-run state from files only; compact/rehydrate hooks carry it");
  // =============================================================================
  {
    const rsPath = join(ROOT, "skills/tech-lead/scripts/run-snapshot.mjs");
    const csPath = join(ROOT, "hooks/compact-snapshot.mjs");
    const srPath = join(ROOT, "hooks/session-rehydrate.mjs");
    const d = mkdtempSync(join(tmpdir(), "snap-"));
    const w = (rel, body) => { mkdirSync(dirname(join(d, rel)), { recursive: true }); writeFileSync(join(d, rel), body); };
    w(".shapeup-sdlc/active-scope", JSON.stringify({ slug: "demo", scope_id: "cart" }));
    w(".shapeup-sdlc/demo/harness-run.md", `---\nfeature: demo\nstatus: building\nrounds_used: 1\nmax_rounds: 3\nauto_level: interactive\n---\n# run\n`);
    w(".shapeup-sdlc/demo/tasks/TASK-001.md", `---\nid: TASK-001\nstatus: done\n---\n`);
    w(".shapeup-sdlc/demo/tasks/TASK-002.md", `---\nid: TASK-002\nstatus: ready\n---\n`);
    w(".shapeup-sdlc/demo/t0/verdicts/r1-a1.json", JSON.stringify({ overall: "green" }));
    w(".shapeup-sdlc/demo/t0/verdicts/r1-a2.json", JSON.stringify({ overall: "red" }));
    w(".shapeup-sdlc/demo/orders/r1-a2.json", "{}");

    const { deriveSnapshot } = await import(rsPath);
    const snap = deriveSnapshot(d);
    if (snap && snap.slug === "demo" && snap.scope_id === "cart" && snap.round === 1 && snap.attempt === 2)
      ok("deriveSnapshot reads slug/scope from the pointer and round/attempt from the latest T0 filename");
    else fail(`deriveSnapshot wrong: ${JSON.stringify(snap)}`);
    if (snap?.board?.total === 2 && snap.board.done === 1 && snap.board.unfinished.includes("TASK-002"))
      ok("board totals derived from task frontmatter");
    else fail(`board wrong: ${JSON.stringify(snap?.board)}`);
    if (snap?.latest_t0?.overall === "red") ok("latest_t0 is the max (round, attempt) verdict");
    else fail(`latest_t0 wrong: ${JSON.stringify(snap?.latest_t0)}`);
    if (snap?.pending_orders?.length === 1 && snap.pending_orders[0] === "r1-a2.json")
      ok("pending_orders = dispatched-but-not-ingested (orders/ minus results/)");
    else fail(`pending_orders wrong: ${JSON.stringify(snap?.pending_orders)}`);

    const { validate: veValidateSnap } = await import(join(ROOT, "skills/tech-lead/scripts/validate-envelope.mjs"));
    const snapCheck = veValidateSnap(snap, { $ref: "domain.schema.json#/$defs/RunSnapshot" });
    if (snapCheck.valid) ok("derived snapshot validates against domain.schema.json#/$defs/RunSnapshot");
    else fail(`snapshot fails its own registry def: ${snapCheck.errors.join("; ")}`);

    const rWrite = spawnSync("node", [rsPath, "--cwd", d, "--write"], { encoding: "utf8" });
    if (rWrite.status === 0 && existsSync(join(d, ".shapeup-sdlc/demo/run-snapshot.json"))) ok("--write persists run-snapshot.json");
    else fail(`--write failed: ${rWrite.stderr}`);

    const empty = mkdtempSync(join(tmpdir(), "snapempty-"));
    const rEmpty = spawnSync("node", [rsPath, "--cwd", empty], { encoding: "utf8" });
    if (rEmpty.status === 0 && !rEmpty.stdout.trim()) ok("no active run → exit 0, empty stdout (fail-open)");
    else fail(`empty dir should be silent, got status=${rEmpty.status} stdout=${rEmpty.stdout}`);

    rmSync(join(d, ".shapeup-sdlc/demo/run-snapshot.json"));
    const rCompact = spawnSync("node", [csPath], { encoding: "utf8", input: JSON.stringify({ cwd: d, trigger: "auto" }) });
    if (rCompact.status === 0 && existsSync(join(d, ".shapeup-sdlc/demo/run-snapshot.json"))) ok("PreCompact hook persists the snapshot mid-run");
    else fail(`compact-snapshot failed: status=${rCompact.status} ${rCompact.stderr}`);
    const rCompactIdle = spawnSync("node", [csPath], { encoding: "utf8", input: JSON.stringify({ cwd: empty, trigger: "auto" }) });
    if (rCompactIdle.status === 0) ok("PreCompact hook exits 0 with no run (never blocks compaction)");
    else fail("compact-snapshot blocked on an empty dir");

    const rRehy = spawnSync("node", [srPath], { encoding: "utf8", input: JSON.stringify({ cwd: d, source: "compact" }) });
    let rehyOut = null;
    try { rehyOut = JSON.parse(rRehy.stdout); } catch { /* silent */ }
    const ctx = rehyOut?.hookSpecificOutput?.additionalContext || "";
    if (rehyOut?.hookSpecificOutput?.hookEventName === "SessionStart" && ctx.includes("mid-run") && ctx.includes("demo") && ctx.includes("round 1"))
      ok("SessionStart(compact) injects the rehydrate hint as additionalContext");
    else fail(`rehydrate output wrong: ${rRehy.stdout.slice(0, 120)}`);
    const rRehyIdle = spawnSync("node", [srPath], { encoding: "utf8", input: JSON.stringify({ cwd: empty, source: "compact" }) });
    if (rRehyIdle.status === 0 && !rRehyIdle.stdout.trim()) ok("rehydrate is silent with no active run");
    else fail("rehydrate spoke with no run active");
    rmSync(d, { recursive: true, force: true });
    rmSync(empty, { recursive: true, force: true });
  }

}
