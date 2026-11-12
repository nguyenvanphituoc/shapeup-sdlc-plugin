// Opening a run and installing the plugin, executed.
//
// `init run` is the one act that makes "a run started" a fact on disk, and it is the only place a typed
// switch survives, so what it writes and what it refuses are both pinned: the launch record, the model
// floor, the worker roster, the already-open refusal and the unwedge. The installer is run against a
// scratch project with no `claude` on the path, so it exercises the file work (the permission grant,
// the harness block, the ignore rules) without registering anything with the host.
import { join } from "node:path";
import { readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { scratch, put, kernel, json, slurp, existsSync } from "../lib/fixture.mjs";
import { pipelineRules, mergePipelinePermissions } from "../../bin/lib/grant.mjs";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

  section("init run — what it writes");
  const s = scratch("init", { git: true });
  try {
    const cwd = s.dir;
    const init = (args, env = {}) => kernel(ROOT, ["init", "run", "--cwd", cwd, ...args], { cwd, env });
    const opened = init(["--slug", "w", "--intake-text", "Add a widgets page", "--auto-level", "unattended",
      "--gate-answers", "ci", "--max-rounds", "2", "--attempts", "4", "--exec-model", "sonnet", "--eval-model", "opus", "--parallel-scopes", "2"]);
    const rec = existsSync(join(cwd, ".shapeup/w/run-args.json")) ? json(join(cwd, ".shapeup/w/run-args.json")) : null;
    const receipt = existsSync(join(cwd, ".shapeup/w/receipt.json")) ? json(join(cwd, ".shapeup/w/receipt.json")) : null;
    check(opened.status === 0 && receipt?.started === true && receipt.run_id && receipt.intake_sha256, "a run opens with a receipt carrying a run id and the intake digest");
    check(receipt?.plugin?.name && receipt.plugin.version, "the receipt names the plugin copy that opened the run");
    check(rec?.models?.exec === "sonnet" && rec.models.eval === "opus" && rec.models.qa === "sonnet", "the launch record carries the model matrix, qa following exec");
    check(rec?.budgets?.maxRounds === 2 && rec.budgets.attemptBudget === 4 && rec.maxParallelScopes === 2 && rec.runId === receipt.run_id,
      "the launch record carries the budgets, the dial and the same run id");
    check(rec && !("answers" in rec) && !("autoLevel" in rec) && /retired and ignored/.test(opened.err), "the retired --auto-level and --gate-answers open the run, say so in one line, and reach no record");
    check(slurp(join(cwd, ".shapeup/w/intake.md")).includes("widgets page"), "the intake is kept verbatim beside the receipt");
    check(existsSync(join(cwd, ".shapeup/active-scope")), "the pointer every hook reads to know a run is in flight is written");
    check(!existsSync(join(cwd, ".shapeup/workflows")), "opening a run stages nothing into the project");

    section("init run — what it refuses");
    check(init(["--slug", "x", "--intake-text", "t", "--exec-model", "claude-haiku-4-5"]).status === 2, "an exec model below the floor is refused (exit 2) before anything is written");
    check(!existsSync(join(cwd, ".shapeup/x")), "…and the refusal wrote nothing");
    check(init(["--slug", "x", "--intake-text", "t", "--eval-model", "mini"]).status === 2, "an eval model below the floor is refused too");
    check(init(["--slug", "y", "--intake-text", "t", "--eval-model", "haiku", "--no-eval"]).status === 0, "…but eval is not checked under --no-eval");
    check(init(["--slug", "z", "--intake-text", "t"], { SHAPEUP_EXEC_MODEL: "nano" }).status === 2, "the environment knob is held to the same floor");
    check(init(["--slug", "q", "--intake-text", "   "]).status === 2, "an empty intake is refused: a run over no requirement reads like a success");
    check(init(["--slug", "q", "--intake-text", "t", "--tiny"]).status === 2, "a retired switch is refused by name rather than ignored");
    const inTrace = kernel(ROOT, ["init", "run", "--slug", "n", "--intake-text", "t"], { cwd: join(cwd, ".shapeup") });
    check(inTrace.status === 2 && !existsSync(join(cwd, ".shapeup/.shapeup")), "init run refuses to run from inside a run trace instead of opening a nested run");
    const ghost = join(cwd, "ghost-plugin");
    put(cwd, "ghost-plugin/.claude-plugin/plugin.json", { name: "ghost", version: "0.0.1" });
    check(init(["--slug", "r", "--intake-text", "t", "--plugin-root", ghost]).status === 3, "a plugin copy that cannot name its roster is refused (exit 3), not thrown");
    put(cwd, "ghost-plugin/kernel/schemas/domain.schema.json", readFileSync(join(ROOT, "kernel/schemas/domain.schema.json"), "utf8"));
    const missing = init(["--slug", "r", "--intake-text", "t", "--plugin-root", ghost]);
    check(missing.status === 3 && /workers are missing/.test(missing.err), "a plugin copy whose worker skills are missing is refused (exit 3) naming them");
    check(!existsSync(join(cwd, ".shapeup/r")), "…and the refusal wrote nothing");

    const again = init(["--slug", "w", "--intake-text", "something else entirely", "--max-rounds", "9"]);
    check(again.status === 3 && /ALREADY OPEN/.test(again.err), "a run that is already open is refused (exit 3)");
    check(json(join(cwd, ".shapeup/w/run-args.json")).budgets.maxRounds === 2, "…and keeps the launch record it has: the switches typed to the refused call do nothing");

    put(cwd, ".shapeup/w/close.json", { status: "shipped", cause: "verdict=pass", at: "2026-11-08T00:00:00Z" });
    const closedRefusal = init(["--slug", "w", "--intake-text", "Add a widgets page"]);
    check(closedRefusal.status === 3 && /CLOSED as "shipped"/.test(closedRefusal.err), "a run that has closed is refused as CLOSED, with its recorded ending, not as open");
    rmSync(join(cwd, ".shapeup/w/close.json"));

    section("init run --force — the unwedge");
    put(cwd, ".shapeup/w/orders/build-r1-a1.json", { schema_version: 1, order_id: "w/build-r1-a1", worker: "task-executor", mode: "orchestrated", operation: "execute", payload: {} });
    put(cwd, ".shapeup/active-order", { slug: "w", order_path: join(cwd, ".shapeup/w/orders/build-r1-a1.json") });
    const forced = init(["--slug", "w", "--intake-text", "Add a widgets page", "--force"]);
    const marker = existsSync(join(cwd, ".shapeup/w/results/build-r1-a1.json")) ? json(join(cwd, ".shapeup/w/results/build-r1-a1.json")) : null;
    check(forced.status === 0 && marker?.synthetic === true && marker.status === "abandoned",
      "--force answers an order nobody answered with a self-labelled abandoned marker");
    check(existsSync(join(cwd, ".shapeup/w/orders/build-r1-a1.json")) && !existsSync(join(cwd, ".shapeup/active-order")),
      "…keeps the order file as the audit trail and retires the fence's pointer");
  } finally { s.done(); }

  section("installer — the grant, the harness block, the ignore rules");
  const grant = pipelineRules();
  check(grant.length === 2 && grant.every((r) => r.startsWith("Bash(node ") && r.includes("kernel/harness.mjs")), "the grant is exactly two rules, both for the kernel entry point");
  const settings = { permissions: { allow: ["Bash(npm test:*)", "Bash(node \"*/skills/orient/scripts/old.mjs\")"], deny: ["Read(./.env)"] }, custom: true };
  mergePipelinePermissions(settings);
  check(settings.permissions.allow.includes("Bash(npm test:*)") && grant.every((r) => settings.permissions.allow.includes(r)), "merging keeps a user's own rule and adds the two");
  check(!settings.permissions.allow.some((r) => r.includes("old.mjs")) && settings.custom && settings.permissions.deny.length === 1, "merging purges a rule this plugin once wrote and touches nothing else");

  const t = scratch("install");
  try {
    const run = () => spawnSync(process.execPath, [join(ROOT, "bin/init.mjs"), "-d", t.dir, "-y"], { cwd: t.dir, encoding: "utf8", env: { ...process.env, PATH: "/usr/bin:/bin" } });
    put(t.dir, "AGENTS.md", "# Our own rules\n\nKeep them.\n");
    put(t.dir, ".gitignore", "node_modules/\n");
    const first = run();
    const allow = () => json(join(t.dir, ".claude/settings.json")).permissions.allow;
    check(first.status === 0 && grant.every((r) => allow().includes(r)), "the installer writes the grant into the project's settings");
    const agents = slurp(join(t.dir, "AGENTS.md"));
    check(agents.includes("# Our own rules") && agents.includes("<!-- HARNESS_START -->") && agents.includes("<!-- HARNESS_END -->"), "it splices the harness block in beside the project's own rules");
    check(slurp(join(t.dir, ".gitignore")).includes(".shapeup/"), "it ignores the run workspace");
    const before = slurp(join(t.dir, ".claude/settings.json"));
    const second = run();
    check(second.status === 0 && slurp(join(t.dir, ".claude/settings.json")) === before && (slurp(join(t.dir, "AGENTS.md")).match(/HARNESS_START/g) || []).length === 1,
      "a second install changes nothing and leaves one harness block");
  } finally { t.done(); }
}
