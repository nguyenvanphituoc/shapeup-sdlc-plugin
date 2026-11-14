// `~/.codex/agents/<name>.toml` for each worker, generated from the shipped agent files.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { agentToml } from "./render.mjs";

export const agentsDir = (home) => join(home, ".codex", "agents");
const files = (rt) => readdirSync(join(rt, "agents")).filter((f) => f.endsWith(".md"));

export function writeAgents(home, rt) {
  mkdirSync(agentsDir(home), { recursive: true });
  for (const f of files(rt)) {
    const { name, toml } = agentToml(readFileSync(join(rt, "agents", f), "utf8"), join(rt, "kernel", "harness.mjs"));
    writeFileSync(join(agentsDir(home), `${name}.toml`), toml);
  }
}

export function agentsProblems(home, rt) {
  if (!existsSync(join(rt, "agents"))) return [];
  return files(rt).map((f) => f.slice(0, -3)).filter((n) => !existsSync(join(agentsDir(home), `${n}.toml`))).map((n) => `agent ${n}.toml is missing`);
}
