// The runtime Codex runs against, and the skills it reads.
//
// WHERE IT LIVES. The hook commands and rendered skills name the kernel by absolute path. Written into a
// project those paths would be committed and resolve on nobody else's machine, and a path into the
// temporary cache `npx` runs from can vanish. So the runtime is copied to a versioned directory under the
// user's home and the configuration that names it is user-level; the project gets nothing but the
// harness block of its own AGENTS.md.
import { readFileSync, readdirSync, mkdirSync, writeFileSync, cpSync, existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROOT_FILES, renderRoot, stampOf, commandSkill } from "./render.mjs";

const SHIPPED = [".claude-plugin", "agents", "commands", "hooks", "kernel", "oracles", "skills"];
export const MARK = ".shapeup-sdlc";

export const runtimeDir = (home, version) => join(home, ".shapeup-sdlc", version);
export const skillsHome = (home) => join(home, ".agents", "skills");
export const readVersion = (pkgRoot) => JSON.parse(readFileSync(join(pkgRoot, ".claude-plugin/plugin.json"), "utf8")).version;

/** Copy the shipped set into the runtime directory and render the root-bound files. */
export function installRuntime({ pkgRoot, home }) {
  const version = readVersion(pkgRoot);
  const rt = runtimeDir(home, version);
  rmSync(rt, { recursive: true, force: true });
  for (const d of SHIPPED) if (existsSync(join(pkgRoot, d))) cpSync(join(pkgRoot, d), join(rt, d), { recursive: true });
  for (const f of ROOT_FILES) writeFileSync(join(rt, f), renderRoot(readFileSync(join(pkgRoot, f), "utf8"), rt, version));
  writeFileSync(join(rt, MARK), version + "\n");
  return { rt, version };
}

/** Install the rendered skills, and the commands as skills, into `$HOME/.agents/skills`. */
export function installSkills({ home, rt, log = console.log }) {
  const dest = skillsHome(home);
  const put = (name, writeInto) => {
    const dir = join(dest, name);
    // A directory this installer did not create is somebody else's skill: say so, never overwrite it.
    if (existsSync(dir) && !existsSync(join(dir, MARK))) { log(`  [codex] skipped skill "${name}": ${dir} exists and was not installed by shapeup-sdlc`); return; }
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeInto(dir);
    writeFileSync(join(dir, MARK), "1\n");
  };
  for (const name of readdirSync(join(rt, "skills"))) {
    if (!statSync(join(rt, "skills", name)).isDirectory()) continue;
    put(name, (dir) => cpSync(join(rt, "skills", name), dir, { recursive: true }));
  }
  for (const f of readdirSync(join(rt, "commands")).filter((x) => x.endsWith(".md"))) {
    const name = f.slice(0, -3);
    if (existsSync(join(rt, "skills", name))) continue; // a skill of that name already carries the craft
    put(name, (dir) => writeFileSync(join(dir, "SKILL.md"), commandSkill(name, readFileSync(join(rt, "commands", f), "utf8"))));
  }
}

/** Is the installed runtime present and at the version of the package that is checking? */
export function runtimeProblems({ pkgRoot, home }) {
  const version = readVersion(pkgRoot);
  const rt = runtimeDir(home, version);
  const out = [];
  if (!existsSync(join(rt, "kernel/harness.mjs"))) out.push(`the runtime is missing at ${rt}`);
  for (const f of ROOT_FILES) {
    const p = join(rt, f);
    if (existsSync(p) && stampOf(readFileSync(p, "utf8")) !== version) out.push(`${f} was rendered by another version than ${version}`);
  }
  return out;
}
