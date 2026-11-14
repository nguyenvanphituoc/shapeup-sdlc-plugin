// The Codex CLI target: the runtime at a stable per-user path, the hooks and agents Codex reads from the
// user's `.codex/`, the skills under `$HOME/.agents/skills`, and the harness block in the project's AGENTS.md.
import { installRuntime, installSkills, runtimeProblems, runtimeDir, readVersion } from "./runtime.mjs";
import { writeHooks, hooksProblems } from "./hooks-json.mjs";
import { writeAgents, agentsProblems } from "./agents-toml.mjs";
import { homedir } from "node:os";

const homeOf = (ctx) => ctx.home ?? process.env.SHAPEUP_HOME_DIR ?? homedir();

const runtimeStep = {
  id: "codex-runtime",
  plan(ctx) {
    const home = homeOf(ctx);
    return [{
      op: "run", describe: `copy the runtime to ${runtimeDir(home, readVersion(ctx.pkgRoot))} and install the skills under ${home}/.agents/skills`,
      fn: () => {
        const { rt } = installRuntime({ pkgRoot: ctx.pkgRoot, home });
        installSkills({ home, rt });
        console.log(`  [codex] runtime installed at ${rt}`);
      },
    }];
  },
  check: (ctx) => { const p = runtimeProblems({ pkgRoot: ctx.pkgRoot, home: homeOf(ctx) }); return { ok: !p.length, problems: p }; },
};

const hooksStep = {
  id: "codex-hooks",
  plan(ctx) {
    const home = homeOf(ctx);
    const rt = runtimeDir(home, readVersion(ctx.pkgRoot));
    return [{
      op: "run", describe: `merge the two guard hooks into ${home}/.codex/hooks.json`,
      fn: () => {
        writeHooks(home, rt);
        console.log(`  [codex] hooks merged into ${home}/.codex/hooks.json`);
        console.log("  [codex] ⚠ Codex loads hooks only from a trusted `.codex/` layer, and an unreviewed hook is skipped");
        console.log("           without an error — the write fence is then OFF. Review and approve the hooks in Codex");
        console.log("           before a run, and check `.shapeup/decisions.jsonl` gains a row on the first write.");
      },
    }];
  },
  check: (ctx) => { const home = homeOf(ctx); const p = hooksProblems(home, runtimeDir(home, readVersion(ctx.pkgRoot))); return { ok: !p.length, problems: p }; },
};

const agentsStep = {
  id: "codex-agents",
  plan(ctx) {
    const home = homeOf(ctx);
    const rt = runtimeDir(home, readVersion(ctx.pkgRoot));
    return [{ op: "run", describe: `write the worker definitions into ${home}/.codex/agents/`, fn: () => writeAgents(home, rt) }];
  },
  check: (ctx) => { const home = homeOf(ctx); const p = agentsProblems(home, runtimeDir(home, readVersion(ctx.pkgRoot))); return { ok: !p.length, problems: p }; },
};

export const codex = {
  name: "codex",
  steps: () => [runtimeStep, hooksStep, agentsStep],
  next: [
    "   Next: open Codex in this directory and run $ship \"<your idea>\".",
    "   (Codex support is new and its hook payloads are not yet measured against a live session: see SECURITY.md.)",
  ],
};
