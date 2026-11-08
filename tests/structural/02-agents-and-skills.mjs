// The agents, skills and commands, executed as readers would read them: frontmatter parses, every
// agent preloads a skill that exists, and no instruction a model will follow names a kernel command
// that is not in the routing table.
//
// That last check is the one a doc review cannot do. A skill that tells the loop to run a verb the
// kernel no longer has is a broken instruction handed over mid-run, and the prose around it reads
// perfectly. So every `harness.mjs <verb> <action>` and every `K <verb> <action>` in shipped Markdown
// is resolved against the real table.
import { join, basename } from "node:path";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";

export async function run(ctx) {
  const { ROOT, ok, fail, section, frontmatter, walk } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

  section("agents — frontmatter, and the skill each one preloads");
  const agentFiles = readdirSync(join(ROOT, "agents")).filter((f) => f.endsWith(".md"));
  const skillDirs = readdirSync(join(ROOT, "skills")).filter((d) => statSync(join(ROOT, "skills", d)).isDirectory());
  const { roster } = await import(join(ROOT, "kernel/verify/skills.mjs"));
  const workers = roster(ROOT);
  check(agentFiles.length === workers.length && workers.every((w) => agentFiles.includes(`${w}.md`)), `one agent per worker in the schema's roster (${workers.join(", ")})`);
  for (const f of agentFiles) {
    const text = readFileSync(join(ROOT, "agents", f), "utf8");
    const fm = frontmatter(text);
    check(fm?.name === basename(f, ".md") && fm.description && fm.tools && fm.model, `${f}: frontmatter names itself, says what it is, lists its tools and its model`);
    const preloads = [...(/^skills:\s*\n((?:\s+-\s*\S+\s*\n?)+)/m.exec(text.split("---")[1] + "\n")?.[1] ?? "").matchAll(/-\s*(\S+)/g)].map((m) => m[1]);
    check(preloads.length > 0 && preloads.every((p) => existsSync(join(ROOT, "skills", p, "SKILL.md"))), `${f}: every skill it preloads has a SKILL.md`);
  }

  section("skills and commands — frontmatter");
  for (const d of skillDirs) {
    const fm = frontmatter(readFileSync(join(ROOT, "skills", d, "SKILL.md"), "utf8"));
    check(fm?.name === d && fm.description?.length > 40, `skills/${d}: name matches its folder and the description says when to use it`);
  }
  for (const f of readdirSync(join(ROOT, "commands"))) {
    const fm = frontmatter(readFileSync(join(ROOT, "commands", f), "utf8"));
    check(fm?.description, `commands/${f}: has a description`);
  }

  section("instructions — every kernel command a model is told to run exists");
  const { ROUTES } = await import(join(ROOT, "kernel/harness.mjs"));
  const known = (verb, action) => {
    const t = ROUTES[verb];
    if (t === undefined) return false;
    if (typeof t === "string") return true;
    return !action || action in t;
  };
  const files = [...walk(join(ROOT, "skills")), ...walk(join(ROOT, "commands")), ...walk(join(ROOT, "agents")), join(ROOT, "AGENTS.md")];
  const stale = [];
  let seen = 0;
  for (const f of files) {
    for (const m of readFileSync(f, "utf8").matchAll(/(?:harness\.mjs"?|\bK|<kernel>"?|kernel\/harness\.mjs"?)\s+([a-z]+)(?:\s+([a-z][a-z0-9-]*))?/g)) {
      seen++;
      const [, verb, action] = m;
      const actionIsWord = ROUTES[verb] && typeof ROUTES[verb] === "object";
      if (!known(verb, actionIsWord ? action : undefined)) stale.push(`${f.slice(ROOT.length + 1)}: ${verb}${action ? " " + action : ""}`);
    }
  }
  check(seen > 10, `the scan found ${seen} kernel commands in shipped instructions (a scan that finds none proves nothing)`);
  check(stale.length === 0, `no shipped instruction names a kernel command the routing table lacks${stale.length ? `:\n    ${[...new Set(stale)].join("\n    ")}` : ""}`);
}
