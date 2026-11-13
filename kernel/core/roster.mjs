// roster — the worker roster a plugin root must resolve: derived from the enum that defines it, so it
// cannot drift from a hand-kept list. A worker is present when its skill is readable and its agent
// definition preloads that skill. Which schema file and which `$defs` enum hold the roster is the
// caller's to say.
//
// A run refuses to open when a worker is missing: the roster check is what turns a dispatch that would
// fail into an error before anything is paid for, and printing which copy of the plugin answered is
// what makes a run against the wrong copy visible in a trace.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The complete worker roster, read from the schema that defines it.
 *
 * @param {string} root - Plugin root the schema is read from.
 * @param {{schemaFile:string, def:string}} spec - The schema file (relative to the root) and the `$defs` enum that holds the roster.
 * @returns {string[]} Every member of `roster enum`, in schema order.
 * @throws {Error} When the schema is missing or does not carry the enum — a kernel that cannot find
 *   its own domain registry has a broken installation, which is the very thing being checked.
 */
export function roster(root, { schemaFile, def }) {
  const schemaPath = join(root, schemaFile);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const names = schema?.$defs?.[def]?.enum;
  if (!Array.isArray(names) || !names.length) {
    throw new Error(`${schemaPath} carries no $defs/${def} enum — the roster cannot be derived`);
  }
  return names;
}

/**
 * The skills an agent definition preloads, read from its `skills:` frontmatter list.
 *
 * @param {string} path - The `agents/<worker>.md` file.
 * @returns {string[]} The listed skill names; [] when the file or the list is absent.
 */
export function preloadedSkills(path) {
  let text;
  try { text = readFileSync(path, "utf8"); } catch { return []; }
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
  const block = /^skills:[ \t]*\r?\n((?:[ \t]+-[ \t]*\S+[ \t]*\r?\n?)+)/m.exec(fm + "\n")?.[1] ?? "";
  return [...block.matchAll(/-[ \t]*(\S+)/g)].map((m) => m[1]);
}

/**
 * Resolve every worker in the roster against a plugin root.
 *
 * A worker is present when its `SKILL.md` is readable AND its agent definition (`agents/<worker>.md`)
 * is readable and preloads that skill. The agent is what a dispatch names, the skill is its craft, and
 * either one missing is the closest on-disk fact to "this dispatch will fail".
 *
 * @param {string} root - Plugin root to check.
 * @param {{schemaFile:string, def:string}} spec - Where the roster is declared.
 * @returns {{root:string, version:(string|null), name:(string|null), workers:Array<{worker:string,
 *   path:string, present:boolean}>, missing:string[]}} The full picture, including the version, so a
 *   wrong-version run is legible in the trace instead of silently green.
 */
export function resolveWorkers(root, spec) {
  let version = null, name = null;
  try {
    const manifest = JSON.parse(readFileSync(join(root, ".claude-plugin/plugin.json"), "utf8"));
    version = manifest.version ?? null;
    name = manifest.name ?? null;
  } catch { /* an unreadable manifest is reported as null, never as a failure of its own */ }
  const workers = roster(root, spec).map((worker) => {
    const path = join(root, "skills", worker, "SKILL.md");
    const agent = join(root, "agents", `${worker}.md`);
    const preloads = preloadedSkills(agent).includes(worker);
    return { worker, path, agent, present: existsSync(path) && preloads, skill: existsSync(path), agent_preloads_skill: preloads };
  });
  return { root, version, name, workers, missing: workers.filter((w) => !w.present).map((w) => w.worker) };
}
