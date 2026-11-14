// The Codex reader of the host seam, replayed against the fixtures in tests/fixtures/codex/. Those are
// documented shapes, not recordings (see the README beside them): this pins what the adapter does with
// them, and says nothing about what a live Codex session sends.
import { join } from "node:path";
import { readFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { parsePatch, normalizePayload } from "../../kernel/core/host.mjs";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  const fx = (n) => JSON.parse(readFileSync(join(ROOT, "tests/fixtures/codex", n), "utf8"));

  section("codex adapter — the patch reader");
  const multi = parsePatch(fx("apply-patch-multi.json").tool_input.command);
  check(multi.map((f) => `${f.op}:${f.path}`).join(",") === "update:src/a.js,add:shapeup/feat/ok.md,delete:src/b.js,update:src/c.js,move:shapeup/feat/moved.md",
    "a patch touching several files yields every file, including the delete and the move destination");
  check(multi[0].content === "new" && multi[1].content === "clean line", "only the added lines are content");
  const n = normalizePayload(fx("shell-rm.json"), "codex");
  check(n.tool_name === "Bash" && n.tool_input.command === "rm -rf /", "a Codex shell call becomes a Bash call, an argv `bash -lc <script>` judged as the script");
  check(normalizePayload({ tool_name: "Write", tool_input: {} }, "claude").tool_name === "Write", "a Claude payload is returned untouched");

  section("codex adapter — the hooks, end to end");
  const proj = mkdtempSync(join(tmpdir(), "struct-codex-"));
  mkdirSync(join(proj, ".git"));
  const fire = (script, payload) => {
    const dir = mkdtempSync(join(tmpdir(), "struct-codex-l-"));
    const ledger = join(dir, "d.jsonl");
    const r = spawnSync("node", [join(ROOT, script), "--host", "codex"], {
      cwd: proj, input: JSON.stringify({ ...payload, cwd: proj }), encoding: "utf8", env: { ...process.env, SHAPEUP_DECISIONS_PATH: ledger },
    });
    const rows = existsSync(ledger) ? readFileSync(ledger, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
    rmSync(dir, { recursive: true, force: true });
    let out = null; try { out = JSON.parse(r.stdout); } catch { /* empty */ }
    return { out, rows };
  };
  try {
    const leak = fire("hooks/sandbox-guard.mjs", fx("apply-patch-leak.json"));
    check(leak.out?.hookSpecificOutput?.permissionDecision === "deny" && /TIER-DIRECTION/.test(leak.out.hookSpecificOutput.permissionDecisionReason) && leak.rows[0]?.rule === "tier-direction",
      "an apply_patch that writes a run-trace path or a task id into the committed tier is denied, by name");
    const clean = fire("hooks/sandbox-guard.mjs", fx("apply-patch-multi.json"));
    check(clean.out === null && clean.rows[0]?.verdict === "allow", "a clean patch is allowed (no run in flight, nothing to fence) and the decision is recorded");
    const rm = fire("hooks/safety-spine.mjs", fx("shell-rm.json"));
    check(rm.out?.hookSpecificOutput?.permissionDecision === "deny", "the safety spine denies a destructive Codex shell command");
    const claudeTool = fire("hooks/sandbox-guard.mjs", { tool_name: "Write", tool_input: { file_path: join(proj, "a"), content: "x" } });
    check(claudeTool.rows.some((r) => r.rule === "host-mismatch"), "a Claude payload under --host codex is recorded as a host mismatch");
  } finally { rmSync(proj, { recursive: true, force: true }); }
}
