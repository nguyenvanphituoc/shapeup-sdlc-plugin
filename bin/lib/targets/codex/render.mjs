// Turning the shipped Claude-shaped files into the Codex-shaped ones. Pure functions of text, so a test
// renders into a temp directory and reads the result.
//
// Every Codex shape here comes from OpenAI's public documentation and the open-source CLI and has NOT
// been measured against a running session.

/** The two skill files that spell the plugin root with a variable Codex does not expand. */
export const ROOT_FILES = ["skills/building/SKILL.md", "skills/building/resources/intake/open-run.md"];

export const rootVar = "${CLAUDE_PLUGIN_ROOT}";

/**
 * Replace the plugin-root variable with the runtime's absolute path, and stamp the file.
 * @param {string} text - A skill file as shipped.
 * @param {string} runtimeRoot - Absolute path of the installed runtime.
 * @param {string} version - Plugin version, for the stamp `init --check` compares.
 * @returns {string} The rendered text.
 */
export function renderRoot(text, runtimeRoot, version) {
  return text.split(rootVar).join(runtimeRoot) + `\n<!-- rendered by shapeup-sdlc ${version} -->\n`;
}

/** The version a rendered file was stamped with, or null. */
export const stampOf = (text) => text.match(/<!-- rendered by shapeup-sdlc (\S+) -->\s*$/)?.[1] ?? null;

/** Split `---\nkey: value\n---\nbody` into a flat frontmatter map and the body. */
export function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) { key = kv[1]; meta[key] = kv[2]; } else if (key && /^\s+-\s+/.test(line)) meta[key] = (meta[key] ? meta[key] + "," : "") + line.replace(/^\s+-\s+/, "");
  }
  return { meta, body: m[2] };
}

/**
 * A sub-agent definition in Codex's TOML form, from a Claude agent file. Codex has no allowlist of
 * tools and no field that preloads a skill, so the skill is named in the instructions instead, and the
 * `model` is left to the spawn (`inherit`).
 * @param {string} md - The agent file as shipped.
 * @returns {{name: string, toml: string}} The agent name and its TOML text.
 */
export function agentToml(md) {
  const { meta, body } = splitFrontmatter(md);
  const skills = (meta.skills ?? "").split(",").filter(Boolean);
  const load = skills.length ? `Before anything else, load the skill ${skills.map((s) => "$" + s).join(", ")} and follow it.\n\n` : "";
  const lit = (s) => (s.includes("'''") ? JSON.stringify(s) : `'''\n${s}\n'''`);
  const q = (s) => JSON.stringify(String(s));
  return {
    name: meta.name,
    toml: `name = ${q(meta.name)}\ndescription = ${q(meta.description ?? meta.name)}\ndeveloper_instructions = ${lit(load + body.trim())}\n`,
  };
}

/**
 * A slash command as a skill (Codex's custom prompts are deprecated and not shared through a repo).
 * `$ARGUMENTS` becomes a plain-language pointer: whatever the user typed after the skill's name.
 * @param {string} name - The command name, which becomes the skill name.
 * @param {string} md - The command file as shipped.
 * @returns {string} A `SKILL.md`.
 */
export function commandSkill(name, md) {
  const { meta, body } = splitFrontmatter(md);
  const text = body.split("$ARGUMENTS").join("the arguments the user typed after the skill name (flags such as `--no-qa` included)");
  return `---\nname: ${name}\ndescription: ${JSON.stringify(meta.description ?? name)}\n---\n${text}`;
}
