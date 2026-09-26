// A PERMITTED COMMAND LEAVES THE NAME OF WHAT IT RAN.
//
// Every allowed Bash call used to be recorded with no subject. So when a judge reported "no UI driver
// was available", the ledger could not say whether it had tried the device tool and been stopped, or
// never tried at all — the same rows either way, and a diagnosis about permissions became a guess.
// The safety spine now records the program each segment runs, by basename. It never records the
// arguments: that is where a secret, a token or a private path would be.
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Run the program-name checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { programsOf } = await import(join(ROOT, "hooks/safety-spine.mjs"));

  section("156. A permitted command's ledger row names the programs it ran, and never their arguments");

  const cases = [
    ["/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc -t 127.0.0.1:5555 shell uitest dumpLayout", "hdc"],
    ["DEVECO_SDK_HOME=/x ./scripts/t0-test.sh", "t0-test.sh"],
    ["cd app && FOO=1 hvigorw test | grep ERROR; echo ok", "cd | hvigorw | grep | echo"],
    ["sudo env A=1 node \"/p q/kernel/harness.mjs\" probe t0", "node"],
    ["", null],
  ];
  const wrong = cases.filter(([c, want]) => programsOf(c) !== want).map(([c, want]) => `${JSON.stringify(c)} → ${programsOf(c)} (want ${want})`);
  if (!wrong.length) ok("programsOf reads each segment's executable past env assignments and wrappers, by basename");
  else fail(`programsOf: ${wrong.join("; ")}`);

  const d = mkdtempSync(join(tmpdir(), "spine-subject-"));
  try {
    mkdirSync(join(d, ".git"));
    const env = { ...process.env }; delete env.SHAPEUP_DECISIONS_PATH;
    const secret = "sk-live-abc123DO-NOT-LOG";
    const r = spawnSync(process.execPath, [join(ROOT, "hooks/safety-spine.mjs")], {
      input: JSON.stringify({ tool_name: "Bash", cwd: d, tool_input: { command: `curl -H "Authorization: ${secret}" https://x.example | jq .` } }),
      cwd: d, encoding: "utf8", env, timeout: 30_000,
    });
    const ledger = join(d, ".shapeup", "decisions.jsonl");
    const rows = existsSync(ledger) ? readFileSync(ledger, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
    const row = rows.find((x) => x.hook === "safety-spine" && x.tool === "Bash");
    if (r.status === 0 && row?.verdict === "allow" && row.subject === "curl | jq") ok("the hook's allow row carries subject 'curl | jq'");
    else fail(`allow row: ${JSON.stringify(row)} (exit ${r.status})`);
    if (!readFileSync(ledger, "utf8").includes(secret)) ok("the command's arguments — here a secret header — never reach the ledger");
    else fail("an argument of a permitted command was written to the decision ledger");
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}
