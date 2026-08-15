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
  section("14. GATE L2 PreToolUse hook WARNS on a red board and stays quiet on a green one");
  // =============================================================================
  // ADVISORY SINCE ADR-0001. This hook used to hard-deny the once-per-round EVAL on a partial
  // board; it now permits the dispatch and emits a systemMessage naming the unfinished tasks.
  //
  // WHAT THESE CASES STILL PROVE, and why they are worth as much as they were when the verdict was
  // a denial: every one of them exercises the DETECTION, which is unchanged. The island-escape
  // regression (case 6 — a board under the LOCAL root that a spec-dir-only hook cannot see) and the
  // envelope-shape regression (case 10 — the pure-skill `--order` dispatch bypassing the read) are
  // both defects of *finding the board*, not of *what to do about it*. Downgrading the verdict does
  // not retire either guard.
  //
  // Case 0 is new and pins the downgrade itself: the hook must never emit a denial again, or the
  // ADR silently reverts the moment someone restores the old return block.
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
      const out = r.stdout || "";
      // `warned` is the advisory verdict; `denied` must now be false everywhere (case 0).
      const denied = out.includes('"permissionDecision":"deny"');
      const warned = out.includes("systemMessage") && out.includes("GATE L2");
      return { denied, warned, out };
    };
    // v0.4.0 Local Tasks Architecture fixture: committed spec dir is boardless; the board lives
    // under the LOCAL gitignored root .shapeup/<slug>/tasks/. `withBoard: false` models a
    // teammate's machine that pulled the spec but never generated a local board (must fail-open —
    // spec-evaluator v0.9 grades from the committed spec there).
    const makeLocalSpec = (secondDone, withBoard = true) => {
      const dir = mkdtempSync(join(tmpdir(), "gate-l2-local-"));
      mkdirSync(join(dir, "shapeup", "demo", "spec", "usecases"), { recursive: true });
      if (withBoard) {
        const tasks = join(dir, ".shapeup", "demo", "tasks");
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
      // 0. THE DOWNGRADE ITSELF (ADR-0001). Not one of these payloads may produce a denial —
      //    including the reddest board we can build. Restoring the old return block fails here.
      const everyShape = [
        ask(red, "--spec spec --feature demo --single-pass"),
        ask(lRed, "--spec shapeup/demo/spec --feature demo --single-pass"),
        ask(red, "--spec spec --task TASK-001"),
      ];
      if (everyShape.every((r) => !r.denied)) ok("gate NEVER denies — the L2 downgrade to advisory holds (ADR-0001)");
      else fail("gate emitted permissionDecision:deny — GATE L2 is meant to be advisory since ADR-0001");

      // 1. Red board + round mode → WARN, naming the unfinished task.
      const a = ask(red, "--spec spec --feature demo --single-pass");
      if (a.warned && a.out.includes("TASK-002")) ok("gate WARNS on a partial board (names TASK-002)");
      else fail(`gate said nothing about a red-board round EVAL — the board read is broken\n${a.out}`);

      // 2. Green board + round mode → silent (defer, no message).
      const b = ask(green, "--spec spec --feature demo --single-pass");
      if (!b.warned) ok("gate is SILENT on a fully-green board");
      else fail(`gate warned about a green board — false positive\n${b.out}`);

      // 3. Red board but per-task eval (--task) → silent (not in scope).
      const c = ask(red, "--spec spec --task TASK-001");
      if (!c.warned) ok("gate does NOT warn on a per-task eval (--task)");
      else fail("gate warned on a per-task eval — the board rule is round-only");

      // 4. Other skill → silent.
      const d = ask(red, "--spec spec --single-pass", "task-executor");
      if (!d.warned) ok("gate ignores non-spec-evaluator skills");
      else fail("gate spoke about a non-spec-evaluator skill");

      // 5. Non-Skill tool → silent.
      const e = ask(red, "--spec spec --single-pass", "spec-evaluator", "Bash");
      if (!e.warned) ok("gate ignores non-Skill tool calls");
      else fail("gate spoke about a non-Skill tool call");

      // 6. v0.4.0 layout, red LOCAL board → WARN. The island-escape regression: the board is not
      //    in <spec>/tasks/, and a hook that only looks there sees a green board that isn't.
      const f = ask(lRed, "--spec shapeup/demo/spec --feature demo --single-pass");
      if (f.warned && f.out.includes("TASK-002")) ok("gate WARNS on a red LOCAL board (LOCAL <slug>/tasks/ layout)");
      else fail(`gate missed a red LOCAL board — the island-escape hole is back\n${f.out}`);

      // 7. v0.4.0 layout, green LOCAL board → silent.
      const g = ask(lGreen, "--spec shapeup/demo/spec --feature demo --single-pass");
      if (!g.warned) ok("gate is SILENT on a green LOCAL board");
      else fail(`gate warned about a green LOCAL board — false positive\n${g.out}`);

      // 8. No --feature → slug derived from the spec path convention (<shared>/<slug>/spec).
      const h = ask(lRed, "--spec shapeup/demo/spec --single-pass");
      if (h.warned && h.out.includes("TASK-002")) ok("gate derives <slug> from the spec path when --feature is absent");
      else fail(`gate did not find the LOCAL board without --feature — slug derivation broken\n${h.out}`);

      // 9. Committed spec present but NO local board anywhere → silent (fail-open). A grading
      //    machine that never generated a board is legitimate (spec-evaluator v0.9).
      const i = ask(lBoardless, "--spec shapeup/demo/spec --feature demo --single-pass");
      if (!i.warned) ok("gate is silent when no board exists on this machine (boardless grading is legitimate)");
      else fail("gate warned on a boardless machine — breaks the remote-grading flow");

      // 10. Pure-skill envelope shape (v1.0): the round EVAL dispatches as
      //     `spec-evaluator --order <WorkOrder operation:evaluate>` — the gate must read the
      //     order and warn on a red board just like the legacy flag shape, and stay quiet for
      //     a non-evaluate order (some other worker's dispatch).
      const mkOrder = (dir, operation, worker = "spec-evaluator") => {
        const op = join(dir, ".shapeup", "demo", "orders");
        mkdirSync(op, { recursive: true });
        const pth = join(op, `${operation}-r1.json`);
        writeFileSync(pth, JSON.stringify({
          schema_version: 1, order_id: `demo/${operation}-r1`, worker, mode: "orchestrated",
          operation, payload: { feature: "demo", spec_folder: "shapeup/demo/spec" },
        }));
        return pth;
      };
      const jr = ask(lRed, `--order ${mkOrder(lRed, "evaluate")}`);
      if (jr.warned && jr.out.includes("TASK-002")) ok("gate WARNS on an --order round EVAL over a red board (envelope shape read)");
      else fail(`gate missed an --order eval dispatch — the pure-skill port bypasses the board read\n${jr.out}`);
      const jg = ask(lGreen, `--order ${mkOrder(lGreen, "evaluate")}`);
      if (!jg.warned) ok("gate is SILENT on an --order round EVAL over a green board");
      else fail(`gate warned on a green-board --order eval — false positive\n${jg.out}`);
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
  // The write-whitelist hook (design spec §4.5/Blueprint E). Same fixture style as #14: craft
  // PreToolUse payloads against a temp checkout and assert the hook's allow/deny decisions.
  //
  // THE FIXTURE DRIVES THE ORDER, NOT THE SCOPE CONTRACT, because that is what the guard reads.
  // It follows `.shapeup/active-order` to the compiled WorkOrder and enforces that order's own
  // `substrate` block. Building a scope contract here instead would leave no pointer, the guard
  // would defer, and every deny assertion below would pass vacuously against a hook that never
  // enforced anything — a green check for an absent guard, which is the one failure this module
  // exists to make impossible.
  const sandboxGuardPath = join(ROOT, "hooks/sandbox-guard.mjs");
  if (existsSync(sandboxGuardPath)) {
    const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const makeCheckout = (withOrder) => {
      const dir = mkdtempSync(join(tmpdir(), "sandbox-guard-"));
      if (withOrder) {
        const ordersDir = join(dir, ".shapeup", "demo", "orders");
        mkdirSync(ordersDir, { recursive: true });
        const orderPath = join(ordersDir, "r1-a1.json");
        writeFileSync(orderPath, JSON.stringify({
          schema_version: 1,
          order_id: "demo/r1-a1",
          worker: "task-executor",
          mode: "orchestrated",
          operation: "execute",
          substrate: {
            allowed: ["apps/web/cart/*.tsx", "apps/api/cart/*.ts"],
            shared: ["packages/shared/http.ts"],
            append_only: ["shapeup/demo/spec/usecases/UC-01.md"],
            frozen: ["shapeup/demo/spec/domain-model.md"],
          },
          payload: { feature: "demo" },
        }, null, 2));
        writeFileSync(join(dir, ".shapeup", "active-order"),
          JSON.stringify({ slug: "demo", order_path: orderPath }));
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
      if (!a.denied) ok("sandbox guard ALLOWS a write inside the order's allowed substrate");
      else fail(`sandbox guard wrongly denied an in-substrate write\n${a.out}`);

      // 2. Declared shared substrate write → allow.
      const b = ask(scoped, join(scoped, "packages/shared/http.ts"));
      if (!b.denied) ok("sandbox guard ALLOWS a write to the order's declared shared substrate");
      else fail(`sandbox guard wrongly denied a shared-substrate write\n${b.out}`);

      // 3. Out-of-substrate write → deny, naming the offending path.
      const c = ask(scoped, join(scoped, "apps/api/payments/handler.ts"));
      if (c.denied && c.out.includes("apps/api/payments/handler.ts")) ok("sandbox guard DENIES an out-of-substrate write (names the path)");
      else fail(`sandbox guard did not deny an out-of-substrate write — the guard is not enforcing\n${c.out}`);

      // 4. Pathology telemetry: the deny above must have appended a PA3 event to metrics/.
      const metricsDir = join(scoped, ".shapeup", "metrics");
      const shard = existsSync(metricsDir) ? readdirSync(metricsDir).find((f) => f.endsWith(".jsonl")) : null;
      if (shard && read(join(metricsDir, shard)).includes('"PA3"')) ok("sandbox guard logs a PA3 pathology event to metrics/*.jsonl on deny");
      else fail("sandbox guard did not log a PA3 pathology event on deny");

      // 5. Run-trace carve-out: the doer MUST be able to write the active feature's LOCAL root —
      //    task board status/AC ticks (task-executor P3) and the discovery ledger (P3.7). Blocking
      //    these strands the board (island-escape: 16/20 task files stale on a shipped feature).
      const rt1 = ask(scoped, join(scoped, ".shapeup/demo/tasks/TASK-001-a.md"));
      if (!rt1.denied) ok("sandbox guard ALLOWS a task-board write under the active run-trace root");
      else fail(`sandbox guard denied the doer's own board bookkeeping (P3 doc update would strand)\n${rt1.out}`);
      const rt2 = ask(scoped, join(scoped, ".shapeup/demo/discovery/ledger.md"));
      if (!rt2.denied) ok("sandbox guard ALLOWS a discovery-ledger write under the active run-trace root");
      else fail(`sandbox guard denied the P3.7 discovery-ledger write\n${rt2.out}`);

      // 6. The guard's own pointer is NOT carved out — a worker must never rewrite its sandbox.
      //    `active-order` is the load-bearing one now (it names the substrate being enforced);
      //    `active-scope` is asserted alongside it because both sit at the `.shapeup/` root,
      //    outside the active slug's carve-out, and both must stay that way.
      const rt3 = ask(scoped, join(scoped, ".shapeup/active-order"));
      if (rt3.denied) ok("sandbox guard DENIES writing .shapeup/active-order (a worker cannot repoint its own substrate)");
      else fail("sandbox guard allowed a write to .shapeup/active-order — a worker could widen its own sandbox");
      const rt3b = ask(scoped, join(scoped, ".shapeup/active-scope"));
      if (rt3b.denied) ok("sandbox guard still DENIES writing .shapeup/active-scope (pointer stays guard-only)");
      else fail("sandbox guard allowed a write to .shapeup/active-scope — a worker could widen its own sandbox");

      // 7. Another feature's run-trace root is NOT carved out (carve-out is active-slug only).
      const rt4 = ask(scoped, join(scoped, ".shapeup/other-feature/tasks/_index.md"));
      if (rt4.denied) ok("sandbox guard still DENIES a different feature's run-trace root");
      else fail("sandbox guard allowed a write to another feature's run-trace — carve-out too wide");

      // 7b. FROZEN outranks everything. These two surfaces are the reason the guard reads the
      //     order at all: `substrateFor` has always stamped them, and while the guard resolved a
      //     scope contract instead, nothing on the machine enforced either one.
      const fz = ask(scoped, join(scoped, "shapeup/demo/spec/domain-model.md"));
      if (fz.denied && /frozen/i.test(fz.out)) ok("sandbox guard DENIES a write to a frozen path (says it is frozen)");
      else fail(`sandbox guard allowed a write to the order's frozen spec core\n${fz.out}`);

      // 7c. APPEND_ONLY splits on the tool: Edit appends, Write overwrites what the append was
      //     meant to preserve. Same path, opposite decisions — the discrimination IS the check.
      const ao1 = ask(scoped, join(scoped, "shapeup/demo/spec/usecases/UC-01.md"), "Edit");
      if (!ao1.denied) ok("sandbox guard ALLOWS an Edit to an append-only path");
      else fail(`sandbox guard denied an Edit to an append-only path\n${ao1.out}`);
      const ao2 = ask(scoped, join(scoped, "shapeup/demo/spec/usecases/UC-01.md"), "Write");
      if (ao2.denied && /append-only/i.test(ao2.out)) ok("sandbox guard DENIES a Write to an append-only path (Write overwrites)");
      else fail(`sandbox guard allowed a Write to overwrite an append-only path\n${ao2.out}`);

      // 8. No active-order pointer (no harness dispatch in progress) → defer, never break a plain
      //    edit. This is the fail-open direction, and it is why `compile-order.mjs` publishes the
      //    pointer as it writes the order: a lane that never publishes one is a lane that is never
      //    fenced, silently.
      const d = ask(unscoped, join(unscoped, "anything.ts"));
      if (!d.denied) ok("sandbox guard defers (fail-open) when no active-order pointer exists");
      else fail("sandbox guard wrongly denied a write with no harness dispatch in progress");

      // 9. Non Edit/Write/MultiEdit tool → defer.
      const e = ask(scoped, join(scoped, "apps/api/payments/handler.ts"), "Bash");
      if (!e.denied) ok("sandbox guard ignores non-Edit/Write/MultiEdit tool calls");
      else fail("sandbox guard wrongly gated a non-write tool call");

      // 10. CONCURRENCY. Two scopes build at once; the pointer names only one of them. Under the
      //     old single-pointer read, the other scope's every write was denied — a false block that
      //     scales with the fan-out, and one that only appears when scopes actually run in
      //     parallel, which is exactly when nobody is watching a single leg.
      //
      //     The guard reads every LIVE order instead: compiled, with no matching result on disk.
      //     So the assertions are (a) the un-pointed scope's own substrate is honoured, (b) a path
      //     no live order claims is still denied — the enforcement did not simply widen to
      //     everything — and (c) an order whose result HAS landed stops authorising writes.
      const twoOrderPath = join(scoped, ".shapeup", "demo", "orders", "sc-02-r1-a1.json");
      writeFileSync(twoOrderPath, JSON.stringify({
        schema_version: 1, order_id: "demo/sc-02-r1-a1", worker: "task-executor",
        mode: "orchestrated", operation: "execute",
        substrate: { allowed: ["apps/web/checkout/*.tsx"], shared: [], append_only: [], frozen: [] },
        payload: { feature: "demo" },
      }, null, 2));

      const par1 = ask(scoped, join(scoped, "apps/web/checkout/Checkout.tsx"));
      if (!par1.denied) ok("sandbox guard ALLOWS a write inside a LIVE order the pointer does not name (concurrent scopes)");
      else fail(`sandbox guard denied a write inside a live sibling scope's substrate — a fanned-out build would be blocked on every leg but one\n${par1.out}`);

      const par2 = ask(scoped, join(scoped, "apps/api/payments/handler.ts"));
      if (par2.denied) ok("sandbox guard still DENIES a path no live order claims (enforcement did not widen to everything)");
      else fail("sandbox guard allowed a path outside every live order — reading all orders turned into reading none");

      // (c) an ingested order is finished, and a finished scope's substrate closes with it.
      const resultsDirPath = join(scoped, ".shapeup", "demo", "results");
      mkdirSync(resultsDirPath, { recursive: true });
      writeFileSync(join(resultsDirPath, "sc-02-r1-a1.json"), JSON.stringify({ order_id: "demo/sc-02-r1-a1" }));
      const par3 = ask(scoped, join(scoped, "apps/web/checkout/Checkout.tsx"));
      if (par3.denied) ok("sandbox guard DENIES a write to an INGESTED order's substrate — a finished scope stops authorising writes");
      else fail("sandbox guard still honoured an order whose result has landed — every finished scope would stay open for the rest of the run");
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
    denies(bash("echo '{}' > .shapeup/safety-overrides.json"), "self-protect", "redirect into overrides file");
    denies({ tool_name: "Read", cwd: d, tool_input: { file_path: join(d, ".env") } }, "secret-read", "Read(.env)");
    denies({ tool_name: "Write", cwd: d, tool_input: { file_path: ".shapeup/safety-overrides.json", content: "{}" } }, "self-protect", "Write(overrides)");

    allows(bash("rm -rf ./build"), "rm -rf ./build (relative multi-segment)");
    allows(bash("git push"), "plain git push");
    allows(bash("git push --force-with-lease origin feat-x"), "--force-with-lease");
    allows(bash("git reset --soft HEAD~1"), "git reset --soft");
    allows(bash("cat .env.example"), ".env.example");
    allows(bash("npm test"), "npm test");
    allows({ tool_name: "Read", cwd: d, tool_input: { file_path: join(d, "README.md") } }, "Read(README.md)");

    // Denies are telemetry, not just defense: a SAFETY pathology row must have been logged.
    const spineMetricsDir = join(d, ".shapeup/metrics");
    const spineRows = existsSync(spineMetricsDir)
      ? readdirSync(spineMetricsDir).flatMap((f) => read(join(spineMetricsDir, f)).trim().split("\n")).map((l) => JSON.parse(l))
      : [];
    if (spineRows.some((r) => r.pathology === "SAFETY" && r.category === "destructive-fs")) ok("denies append SAFETY pathology rows to the metrics shard");
    else fail("no SAFETY pathology row was logged for a deny");

    // Override file: exempts the matching command, is itself logged, and fails CLOSED when corrupt.
    mkdirSync(join(d, ".shapeup"), { recursive: true });
    writeFileSync(join(d, ".shapeup/safety-overrides.json"),
      JSON.stringify({ schema_version: 1, allow_commands: ["^git push origin main$"], note: "CI deploy branch" }));
    allows(bash("git push origin main"), "push to main WITH override");
    const overrideRows = readdirSync(spineMetricsDir).flatMap((f) => read(join(spineMetricsDir, f)).trim().split("\n")).map((l) => JSON.parse(l));
    if (overrideRows.some((r) => r.pathology === "SAFETY-OVERRIDE")) ok("an exercised override is logged as SAFETY-OVERRIDE (visible, never silent)");
    else fail("override was exercised but no SAFETY-OVERRIDE row was logged");
    writeFileSync(join(d, ".shapeup/safety-overrides.json"), "broken{");
    denies(bash("git push origin main"), "git-destructive", "push to main with CORRUPT override (override channel fails closed)");

    // Fail-open on garbage stdin.
    const garbage = spawnSync("node", [spinePath], { encoding: "utf8", input: "not json" });
    if (garbage.status === 0 && !garbage.stdout.trim()) ok("garbage stdin → silent exit 0 (fail-open)");
    else fail(`garbage stdin should fail open, got status=${garbage.status} stdout=${garbage.stdout}`);
    rmSync(d, { recursive: true, force: true });
  }


  // =============================================================================
  section("28. The leftovers scan moved into the ship report, and stayed advisory");
  // =============================================================================
  // It was an advisory Stop hook: it printed once, into a transcript, at the moment a session
  // ended — the channel least likely to be read and impossible to check afterwards. The scan is
  // unchanged; where its answer lands is not. These checks are on the SCANNER (a pure function,
  // which is why it was worth keeping) and on the report carrying it as a SECTION rather than a
  // verdict, because "QA is a level-up, not a gate" has to survive the move.
  {
    const { scanDiff, summarize } = await import(join(ROOT, "kernel/reduce/leftovers.mjs"));
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

    // The report carries it as a section, and the section is absent when there is nothing to say —
    // a "Leftovers: none" heading on every report is how a signal becomes furniture.
    const { buildReport } = await import(join(ROOT, "kernel/reduce/ship.mjs"));
    const base = {
      slug: "demo", at: "2026-08-14", verdict: "PASS", qa: "run", rounds: 1,
      board: { done: 1, total: 1, unfinished: [] }, t0: [], artifacts: 0, ratchet: null,
    };
    const withSlop = buildReport({ ...base, leftovers: ["src/x.ts: TODO/FIXME ×1"] });
    if (/## Leftovers \(advisory\)/.test(withSlop) && withSlop.includes("src/x.ts")) ok("the ship report carries a Leftovers section naming the file");
    else fail("the ship report dropped the leftovers scan — the check moved out of the hook and into nothing");
    if (!/verdict: .*leftover/i.test(withSlop)) ok("leftovers do not touch the verdict — still advisory after the move");
    else fail("leftovers reached the verdict — an advisory scan became a gate");
    const clean = buildReport({ ...base, leftovers: [] });
    if (!/## Leftovers/.test(clean)) ok("no leftovers → no section (a heading on every report is furniture, not a signal)");
    else fail("the report prints an empty Leftovers section");
  }


  // =============================================================================
  section("29. run-snapshot derives mid-run state from files only");
  // =============================================================================
  {
    const rsPath = join(ROOT, "kernel/reduce/snapshot.mjs");
    const d = mkdtempSync(join(tmpdir(), "snap-"));
    const w = (rel, body) => { mkdirSync(dirname(join(d, rel)), { recursive: true }); writeFileSync(join(d, rel), body); };
    w(".shapeup/active-scope", JSON.stringify({ slug: "demo", scope_id: "cart" }));
    w(".shapeup/demo/harness-run.md", `---\nfeature: demo\nstatus: building\nrounds_used: 1\nmax_rounds: 3\nauto_level: interactive\n---\n# run\n`);
    w(".shapeup/demo/tasks/TASK-001.md", `---\nid: TASK-001\nstatus: done\n---\n`);
    w(".shapeup/demo/tasks/TASK-002.md", `---\nid: TASK-002\nstatus: ready\n---\n`);
    w(".shapeup/demo/t0/verdicts/r1-a1.json", JSON.stringify({ overall: "green" }));
    w(".shapeup/demo/t0/verdicts/r1-a2.json", JSON.stringify({ overall: "red" }));
    w(".shapeup/demo/orders/r1-a2.json", "{}");

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

    const { validate: veValidateSnap } = await import(join(ROOT, "kernel/verify/envelope.mjs"));
    const snapCheck = veValidateSnap(snap, { $ref: "domain.schema.json#/$defs/RunSnapshot" });
    if (snapCheck.valid) ok("derived snapshot validates against domain.schema.json#/$defs/RunSnapshot");
    else fail(`snapshot fails its own registry def: ${snapCheck.errors.join("; ")}`);

    const rWrite = spawnSync("node", [join(ROOT, "kernel/harness.mjs"), "reduce", "snapshot", "--cwd", d, "--write"], { encoding: "utf8" });
    if (rWrite.status === 0 && existsSync(join(d, ".shapeup/demo/run-snapshot.json"))) ok("--write persists run-snapshot.json");
    else fail(`--write failed: ${rWrite.stderr}`);

    const empty = mkdtempSync(join(tmpdir(), "snapempty-"));
    const rEmpty = spawnSync("node", [join(ROOT, "kernel/harness.mjs"), "reduce", "snapshot", "--cwd", empty], { encoding: "utf8" });
    if (rEmpty.status === 0 && !rEmpty.stdout.trim()) ok("no active run → exit 0, empty stdout (fail-open)");
    else fail(`empty dir should be silent, got status=${rEmpty.status} stdout=${rEmpty.stdout}`);

    // REHYDRATION IS A COMMAND NOW, not two hooks. `session-rehydrate` injected this snapshot as
    // additionalContext on SessionStart and `compact-snapshot` froze it before compaction; both are
    // gone, because the same answer is one query a relaunch already makes — and a query the
    // orchestrator can run at any point, not only at the two moments a hook happened to fire.
    const rGraph = spawnSync("node", [join(ROOT, "kernel/harness.mjs"), "reduce", "graph", "--slug", "demo", "--cwd", d, "--subgraph", "run"],
      { encoding: "utf8" });
    let sub = null;
    try { sub = JSON.parse(rGraph.stdout); } catch { /* asserted below */ }
    if (rGraph.status === 0 && sub && typeof sub.orders === "number") ok("`reduce graph --subgraph run` answers the rehydration question the retired hooks used to carry");
    else fail(`the graph query does not answer for a mid-run tree: exit ${rGraph.status}, ${String(rGraph.stdout).slice(0, 120)}`);
    rmSync(d, { recursive: true, force: true });
    rmSync(empty, { recursive: true, force: true });
  }

  // =============================================================================
  section("57. dispatch-receipt attests a completed dispatch, and attests nothing else");
  // =============================================================================
  // The hook half of the D2 fix. Its counterpart in 05-tech-lead §22 proves ingest REFUSES an
  // unattested result; this proves the receipt those checks depend on is written when — and only
  // when — a dispatch really ran. Both halves are needed: a gate reading a channel nobody fills
  // refuses every result in the run, and a channel that fills itself on a failed dispatch restores
  // the false green the gate exists to end.
  //
  // The payload shapes are not invented. They were measured from a live session with the plugin
  // loaded and a SUB-AGENT making the Skill calls: `tool_input` is `{skill, args}`, a completed
  // dispatch reports `tool_response = {success:true, commandName:"<namespace>:<skill>"}`, and a
  // dispatch that failed produces no PostToolUse event at all.
  const drPath = join(ROOT, "hooks/dispatch-receipt.mjs");
  if (!existsSync(drPath)) {
    fail("hooks/dispatch-receipt.mjs missing — orchestrated ingests have no attestation channel");
  } else {
    const drBox = mkdtempSync(join(tmpdir(), "dispatch-receipt-"));
    const orderPath = join(drBox, ".shapeup/demo/orders/orient.json");
    mkdirSync(dirname(orderPath), { recursive: true });
    writeFileSync(orderPath, JSON.stringify({
      schema_version: 1, order_id: "demo/orient", run_id: "demo-20260815T000000Z-deadbeef",
      compiled_at: "2026-08-15T12:00:00.000Z", worker: "orient", mode: "orchestrated",
      substrate: { allowed: [".shapeup/demo/orient/**"] }, payload: { feature: "demo" },
    }));
    const ledgerPath = join(drBox, ".shapeup/demo/receipts/dispatch.jsonl");
    const rowsNow = () => (existsSync(ledgerPath)
      ? readFileSync(ledgerPath, "utf8").split("\n").filter((l) => l.trim())
        .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
      : []);
    // The decision ledger is checkout-wide, resolved the way lib/paths.mjs resolves it. It is read
    // here because exit code alone cannot distinguish "handled this case" from "threw": runHook
    // catches everything and exits 0 either way, so an assertion on the exit code is satisfied by a
    // hook that crashed on every payload.
    const decisionsNow = () => {
      const p = join(drBox, ".shapeup", "decisions.jsonl");
      return existsSync(p)
        ? readFileSync(p, "utf8").split("\n").filter((l) => l.trim())
          .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
        : [];
    };
    const firePost = (payload) => {
      const env = { ...process.env };
      delete env.SHAPEUP_DECISIONS_PATH;
      const r = spawnSync("node", [drPath], { encoding: "utf8", input: JSON.stringify(payload), cwd: drBox, env });
      const decisions = decisionsNow();
      return { exit: r.status, rows: rowsNow(), decision: decisions[decisions.length - 1] };
    };
    const dispatch = (over = {}) => ({
      hook_event_name: "PostToolUse", tool_name: "Skill", cwd: drBox,
      agent_id: "abc123", agent_type: "general-purpose",
      tool_input: { skill: "shapeup-sdlc-plugin:orient", args: `--order '${orderPath}'` },
      tool_response: { success: true, commandName: "shapeup-sdlc-plugin:orient" },
      ...over,
    });

    // (a) the completed dispatch — the only state that earns a receipt.
    const okFire = firePost(dispatch());
    const row = okFire.rows[okFire.rows.length - 1];
    if (okFire.exit === 0 && okFire.rows.length === 1 && row.order_id === "demo/orient"
        && row.skill_invoked === "orient" && row.worker_declared === "orient" && row.dispatch_ok === true) {
      ok("dispatch-receipt writes an attestation for a completed dispatch, keyed by order_id");
    } else {
      fail(`no usable receipt for a completed dispatch: exit ${okFire.exit}, rows ${JSON.stringify(okFire.rows)}`);
    }
    // The host namespaces the command and the order does not. A receipt carrying
    // "shapeup-sdlc-plugin:orient" would never equal the order's "orient", so the gate downstream
    // would refuse every result in the run — a wall that denies everything is not a wall.
    if (row && row.skill_invoked === "orient" && !String(row.skill_invoked).includes(":")) {
      ok("the namespaced commandName is reduced to the bare skill name the WorkOrder declares");
    } else {
      fail(`skill_invoked is "${row?.skill_invoked}" — it must match order.worker, which is never namespaced`);
    }
    if (row && row.agent_id === "abc123") ok("the receipt records sub-agent provenance, separating an orchestrated leg from a hand-driven skill call");
    else fail("the receipt drops agent_id — an operator's own dispatch is indistinguishable from a leg's");

    // (b) a dispatch that resolved nothing. This is the shape an `Agent` call has, and the shape
    //     any host result has when no skill ran. Minting a receipt here would forge the fact.
    const before = rowsNow().length;
    const noSkill = firePost(dispatch({ tool_response: { status: "completed" } }));
    if (noSkill.exit === 0 && noSkill.rows.length === before) {
      ok("a dispatch whose result names no resolved skill gets NO receipt (the false green stays refused)");
    } else {
      fail(`a result naming no skill produced a receipt: ${JSON.stringify(noSkill.rows.slice(before))}`);
    }

    // (c) not an orchestrated dispatch at all — a plain skill call an operator made. Out of scope,
    //     and it must not accumulate rows that a later order could match against.
    const noOrder = firePost(dispatch({ tool_input: { skill: "shapeup-sdlc-plugin:orient", args: "" } }));
    if (noOrder.exit === 0 && noOrder.rows.length === before) ok("a Skill call with no --order is not attested — standalone use stays out of the ledger");
    else fail(`an unorchestrated Skill call wrote a receipt: ${JSON.stringify(noOrder.rows.slice(before))}`);

    // (d) a broken channel is HANDLED, not merely survived. Asserting exit 0 here would be
    //     vacuous — runHook catches every throw and exits 0 regardless, so that assertion is
    //     satisfied by a hook that crashed. The fact worth guarding is the one the receipt layer
    //     exists to make visible: an unreadable order is a reasoned defer, not an exception. Drop
    //     the guard around the order read and this row becomes verdict:"error".
    const brokenFire = firePost(dispatch({ tool_input: { skill: "x", args: `--order '${join(drBox, "nope.json")}'` } }));
    if (brokenFire.exit === 0 && brokenFire.decision?.verdict === "allow" && brokenFire.decision?.rule === "order-unreadable") {
      ok("an unreadable order is a reasoned defer, not a thrown exception — the hook never denies and never crashes");
    } else {
      fail(`an unreadable order was not handled: exit ${brokenFire.exit}, decision ${JSON.stringify(brokenFire.decision)}`);
    }

    rmSync(drBox, { recursive: true, force: true });
  }

}
