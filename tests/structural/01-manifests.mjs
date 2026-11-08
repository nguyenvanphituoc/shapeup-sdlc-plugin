// The manifests, executed: the three that carry a version agree, everything the package ships exists,
// every hook command points at a file that is there, and the host's own validator accepts the plugin.
import { join } from "node:path";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section, readJSON } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

  section("manifests — version, allowlist, hook commands, the host's validator");
  const plugin = readJSON(join(ROOT, ".claude-plugin/plugin.json"));
  const market = readJSON(join(ROOT, ".claude-plugin/marketplace.json"));
  const pkg = readJSON(join(ROOT, "package.json"));
  check(plugin.name && plugin.version && plugin.description, "plugin.json names the plugin, its version and what it is");
  check(plugin.version === pkg.version, `package.json and plugin.json agree on the version (${pkg.version} / ${plugin.version}); release CI fails on a mismatch`);
  check((market.plugins || []).some((p) => p.name === plugin.name), "the marketplace lists the plugin by the same name");

  const missing = (pkg.files || []).filter((f) => !existsSync(join(ROOT, f.replace(/\/$/, ""))));
  check(missing.length === 0, `every entry of the package's \`files\` allowlist exists${missing.length ? ` — missing: ${missing.join(", ")}` : ""}`);
  for (const dir of ["agents/", "bin/", "commands/", "hooks/", "kernel/", "oracles/", "skills/"]) {
    check(pkg.files.includes(dir), `the allowlist ships ${dir}`);
  }

  const manifest = readJSON(join(ROOT, "hooks/hooks.json"));
  const commands = Object.values(manifest.hooks).flat().flatMap((g) => g.hooks.map((h) => h.command));
  check(commands.length >= 4, `hooks.json registers ${commands.length} commands`);
  for (const c of commands) {
    const rel = c.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+?\.mjs)/)?.[1];
    check(rel && existsSync(join(ROOT, rel)), `hook command points at a file that exists: ${rel}`);
  }

  const { ROUTES } = await import(join(ROOT, "kernel/harness.mjs"));
  const modules = Object.values(ROUTES).flatMap((t) => (typeof t === "string" ? [t] : Object.values(t)));
  for (const m of modules) {
    const mod = await import(join(ROOT, "kernel", m));
    check(typeof mod.cli === "function", `kernel route ${m} exports a cli`);
  }
  const help = spawnSync("node", [join(ROOT, "kernel/harness.mjs"), "--help"], { encoding: "utf8" });
  check(help.status === 0 && Object.keys(ROUTES).every((v) => help.stdout.includes(v)), "harness --help lists every verb in the routing table");
  check(spawnSync("node", [join(ROOT, "kernel/harness.mjs"), "nope"], { encoding: "utf8" }).status === 2, "an unknown verb is a usage error (exit 2)");

  // The host's own validator is the strictest reader of the manifests; skip loudly when it is absent.
  const have = spawnSync("claude", ["--version"], { encoding: "utf8" });
  if (have.status !== 0) { console.log("  (claude binary not found — `claude plugin validate` not run)"); return; }
  for (const target of [".", ".claude-plugin/marketplace.json"]) {
    const v = spawnSync("claude", ["plugin", "validate", target, "--strict"], { cwd: ROOT, encoding: "utf8" });
    check(v.status === 0, `claude plugin validate ${target} --strict passes${v.status === 0 ? "" : `\n${(v.stdout + v.stderr).slice(0, 400)}`}`);
  }
}
