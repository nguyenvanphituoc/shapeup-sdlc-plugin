// The grant is constant: two Bash rules, no Workflow token written, none deleted. Section 180.
//
// 4.0 stopped asking for the unscoped `Workflow` permission, because the run is driven by the loop in the
// session and launches no script. The rule worth guarding is not only "the installer does not add it" but
// the other half, which is easy to break while removing the first: a `Workflow` token a user already has is
// THEIRS — a project may rely on it for workflow scripts of its own — so the installer must leave it exactly
// where it is. This module drives the real installer against a settings file that already carries the token.
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { pipelineRules, mergePipelinePermissions } from "../../bin/lib/grant.mjs";

/**
 * Run the grant-constant checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  section("180. The grant is two Bash rules; the installer writes no Workflow token and deletes none");

  const rules = pipelineRules();
  if (rules.length === 2 && rules.every((r) => /^Bash\(node "\*\/kernel\/harness\.mjs"( \*)?\)$/.test(r))) ok("pipelineRules() is exactly the two Bash rules for the kernel entry point");
  else fail(`pipelineRules() is ${JSON.stringify(rules)} — expected the two kernel Bash rules and nothing else`);

  // The merge, in memory: nothing added beside the two rules, and a user's own entries untouched.
  const merged = { permissions: { allow: ["Workflow", "Bash(npm test)", "Read(./docs/**)"], deny: ["Bash(rm -rf *)"] } };
  mergePipelinePermissions(merged);
  const allow = new Set(merged.permissions.allow);
  if (rules.every((r) => allow.has(r)) && allow.has("Workflow") && allow.has("Bash(npm test)") && allow.has("Read(./docs/**)") && merged.permissions.allow.length === 5) {
    ok("the merge adds the two rules and leaves the user's `Workflow`, Bash and Read entries exactly as they were");
  } else fail(`the merge changed what it should not have: ${JSON.stringify(merged.permissions.allow)}`);
  if (JSON.stringify(merged.permissions.deny) === JSON.stringify(["Bash(rm -rf *)"])) ok("the merge touches no deny rule");
  else fail("the merge changed the deny list");
  const fresh = {};
  mergePipelinePermissions(fresh);
  if (JSON.stringify(fresh.permissions.allow) === JSON.stringify(rules) && !fresh.permissions.allow.includes("Workflow")) ok("into empty settings the merge writes the two rules and no `Workflow` token");
  else fail(`merging into empty settings wrote ${JSON.stringify(fresh.permissions?.allow)}`);

  // The real installer, against a project whose settings already carry the token.
  const box = mkdtempSync(join(tmpdir(), "grant-constant-"));
  try {
    const proj = join(box, "proj");
    mkdirSync(join(proj, ".claude"), { recursive: true });
    spawnSync("git", ["init", "-q"], { cwd: proj });
    const file = join(proj, ".claude", "settings.json");
    writeFileSync(file, JSON.stringify({ permissions: { allow: ["Workflow", "Bash(npm test)"] } }, null, 2));
    // `claude` removed from PATH so the installer's own merge is what runs — the same path section 56 takes.
    const PATH = (process.env.PATH || "").split(":").filter((d) => d && !existsSync(join(d, "claude"))).join(":");
    const install = (extra = []) => spawnSync(process.execPath, [join(ROOT, "bin/init.mjs"), "init", "-d", proj, "-y", ...extra], { cwd: proj, env: { ...process.env, PATH }, encoding: "utf8", timeout: 60_000 });
    const read = () => new Set(JSON.parse(readFileSync(file, "utf8")).permissions.allow);
    const a = install();
    const after = read();
    if (a.status === 0 && after.has("Workflow") && after.has("Bash(npm test)") && rules.every((r) => after.has(r)) && after.size === 4) ok("the installer keeps a pre-existing `Workflow` token and the user's own rule, and adds only the two kernel rules (4 entries)");
    else fail(`the installer left ${JSON.stringify([...after])} (exit ${a.status})`);
    const b = install(["--no-native-workflow"]);
    const afterFlag = read();
    if (b.status === 0 && afterFlag.has("Workflow") && afterFlag.size === 4) ok("--no-native-workflow is accepted, does nothing, and does not delete the user's token");
    else fail(`--no-native-workflow changed the grant or was refused: exit ${b.status}, ${JSON.stringify([...afterFlag])}`);

    // A project that never had the token is not handed one.
    const proj2 = join(box, "proj2");
    mkdirSync(proj2, { recursive: true });
    spawnSync("git", ["init", "-q"], { cwd: proj2 });
    const c = spawnSync(process.execPath, [join(ROOT, "bin/init.mjs"), "init", "-d", proj2, "-y"], { cwd: proj2, env: { ...process.env, PATH }, encoding: "utf8", timeout: 60_000 });
    const fresh2 = new Set(JSON.parse(readFileSync(join(proj2, ".claude", "settings.json"), "utf8")).permissions.allow);
    if (c.status === 0 && fresh2.size === 2 && !fresh2.has("Workflow")) ok("a project that never had a `Workflow` token is given exactly the two rules and no token");
    else fail(`a fresh install wrote ${JSON.stringify([...fresh2])} (exit ${c.status})`);
  } finally { rmSync(box, { recursive: true, force: true }); }
}
