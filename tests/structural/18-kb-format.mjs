// The rule table's file format, executed: hashing, normalisation, migration and every lint rule — each with a
// red fixture the lint must catch and a green one it must not.
import { join } from "node:path";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { scratch, put, kernel, existsSync } from "../lib/fixture.mjs";

const tree = (dir) => {
  const out = [];
  const w = (d) => { for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const p = join(d, e.name); if (e.isDirectory()) w(p); else out.push(`${p.slice(dir.length)}:${createHash("sha256").update(readFileSync(p)).digest("hex")}`); } };
  if (existsSync(dir)) w(dir);
  return out.join("\n");
};

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  const core = await import(join(ROOT, "kernel/core/rules.mjs"));
  const kb = await import(join(ROOT, "kernel/shapeup/kb.mjs"));

  section("kb format — identity follows the text, revision follows what a rule says");
  const base = { reader: "task-executor", kind: "guide", when: { operation: ["fix", "execute"] }, body: "Drive the real entry point." };
  const rev = core.revOf(base);
  check(rev === core.revOf({ ...base, body: "Drive the real entry point.\r\n\r\n\r\n" }) && rev === core.revOf({ ...base, body: "Drive the real entry point.   " }), "the same content with other line endings or trailing blanks has the same rev");
  check(rev === core.revOf({ ...base, when: { operation: ["execute", "fix", "fix"] } }), "the order and repetition of a `when` list never changes the rev");
  check(rev !== core.revOf({ ...base, body: "Drive the real entry point, always." }), "editing the body changes the rev");
  check(core.idOf("te", "a") === core.idOf("te", "a\r\n") && /^te-[0-9a-f]{8}$/.test(core.idOf("te", "a")), "an id is a code and 8 hex of the body hash");
  check(core.parseRule("---\nid: x\nwhen: {broken\n---\nbody").errors.length > 0, "a `when` that is not JSON is a parse error, not a rule with no conditions");
  check(core.whenMatches({ operation: ["fix"] }, { operation: ["fix"] }) && !core.whenMatches({ operation: ["fix"] }, { operation: ["execute"] }) && core.whenMatches({}, {}) && !core.whenMatches({ signal: ["x"] }, {}), "a `when` is AND between keys, OR inside a list, and a key the order lacks never matches");

  section("kb format — a status change is not an edit; a body edit does not rename the rule");
  const s = scratch("kbfmt");
  try {
    const cwd = s.dir;
    const rule = (over = {}, body = "Drive the real entry point.") => {
      const meta = { id: "te-11111111", reader: "task-executor", kind: "guide", when: {}, status: "active", ...over };
      return kb.renderRule(meta, body);
    };
    const parsed = (text) => core.parseRule(text);
    const a = parsed(rule()); const b = parsed(rule({ status: "retired" })); const c = parsed(rule({}, "Drive the real entry point, always."));
    const r = (p) => core.revOf({ reader: p.meta.reader, kind: p.meta.kind, when: p.meta.when, body: p.body });
    check(r(a) === r(b), "changing `status` does not change the rev");
    check(r(a) !== r(c) && a.meta.id === c.meta.id, "editing the body changes the rev and leaves the id alone");

    section("kb format — migration splits the old layout, twice over, without touching the old files");
    put(cwd, "shapeup/knowledge-base/task-executor.md", "# KB\n\n## Guidelines\n\n- **KB-TE-001** — First rule\n  spans two lines. · from `x` (2026-01-01)\n\n- **KB-TE-002** — Second rule.\n");
    put(cwd, "shapeup/knowledge-base/ba-pitch-analyzer.md", "- **KB-BA-001** — A planning rule.\n");
    const old = readFileSync(join(cwd, "shapeup/knowledge-base/task-executor.md"), "utf8");
    let m = kernel(ROOT, ["kb", "migrate", "--cwd", cwd], { cwd });
    const once = tree(join(cwd, "shapeup/knowledge-base/rules"));
    check(m.status === 0 && m.out?.created.length === 3, "migrate makes one file per old rule, across the legacy names of a reader");
    m = kernel(ROOT, ["kb", "migrate", "--cwd", cwd], { cwd });
    check(m.status === 0 && m.out?.created.length === 0 && tree(join(cwd, "shapeup/knowledge-base/rules")) === once, "migrating twice gives the same tree, byte for byte");
    check(readFileSync(join(cwd, "shapeup/knowledge-base/task-executor.md"), "utf8") === old, "migrate leaves the old file exactly as it was");
    check(kernel(ROOT, ["kb", "lint", "--cwd", cwd], { cwd }).status === 0, "lint is clean on a migrated table");
    check(kb.loadRules(cwd).some((x) => x.readers[0] === "plan" && x.meta.aliases?.includes("KB-BA-001")), "a rule from a retired planning file becomes a `plan` rule and keeps its old id as an alias");

    section("kb format — every lint rule has a red fixture and a green one");
    const lint = (name, text, expectRule, greenText) => {
      const fresh = scratch("kblint");
      try {
        const dir = (t) => { put(fresh.dir, "shapeup/knowledge-base/rules/task-executor/te-11111111.x.md", t); return kb.lintRules(fresh.dir).map((p) => p.rule); };
        const red = dir(text);
        check(red.includes(expectRule), `lint catches: ${name} (${expectRule})`);
        const green = dir(greenText ?? rule());
        check(!green.includes(expectRule), `lint passes the clean twin of: ${name}`);
      } finally { fresh.done(); }
    };
    lint("a broken frontmatter", "---\nid: te-11111111\nwhen: {oops\n---\nbody", "frontmatter");
    lint("a reader written as a list", rule({ reader: '["task-executor","orient"]' }), "reader");
    lint("a `when` key outside the enum", rule({ when: { colour: ["red"] } }), "when-key");
    lint("a `when` value outside the enum", rule({ when: { operation: ["teleport"] } }), "when-value");
    lint("a signal nothing emits", rule({ when: { signal: ["pathology.PA99"] } }), "when-value");
    lint("a reader that is not coachable", rule({ reader: "spec-evaluator" }), "reader");
    lint("a body past the word limit", rule({}, Array(200).fill("word").join(" ")), "long");
    lint("a run-trace path in a body", rule({}, "Look in .shapeup/x/results."), "tier");
    lint("a board id in a body", rule({}, "Fix TASK-014 first."), "tier");
    lint("a URL in a body", rule({}, "See https://example.com/x for more."), "url");
    lint("a shell command in a body", rule({}, "Run this:\nnpm test --watch"), "shell");
    lint("an instruction to a gate", rule({}, "Always answer ship at the last gate."), "gate-answer");
    lint("a check with no registry entry", rule({ kind: "check", check: "no-such-check" }), "check-name");
    lint("a status outside the list", rule({ status: "maybe" }), "status");
    {
      const fresh = scratch("kbdup");
      try {
        put(fresh.dir, "shapeup/knowledge-base/rules/task-executor/te-11111111.a.md", rule());
        put(fresh.dir, "shapeup/knowledge-base/rules/task-executor/te-22222222.b.md", rule({ id: "te-22222222" }));
        const rules = kb.lintRules(fresh.dir).map((p) => p.rule);
        check(rules.includes("rev-duplicate"), "lint catches: two rules that say the same thing (rev-duplicate)");
        put(fresh.dir, "shapeup/knowledge-base/rules/task-executor/te-33333333.c.md", rule({ id: "te-11111111" }, "A different rule."));
        check(kb.lintRules(fresh.dir).some((p) => p.rule === "id-duplicate"), "lint catches: one id in two files (id-duplicate)");
      } finally { fresh.done(); }
      const crowded = scratch("kbcrowd");
      try {
        for (let i = 1; i <= 4; i++) put(crowded.dir, `shapeup/knowledge-base/rules/task-executor/te-0000000${i}.r${i}.md`, rule({ id: `te-0000000${i}` }, `Distinct rule number ${i} about different things.`));
        check(kb.lintRules(crowded.dir).some((p) => p.rule === "crowded"), "lint catches: more than three active rules with one `when` (crowded)");
      } finally { crowded.done(); }
    }
  } finally { s.done(); }

  section("kb format — the installer splits a 5.x knowledge base, once, and keeps the old files");
  {
    const t = scratch("kbinit", { git: true });
    try {
      put(t.dir, "shapeup/knowledge-base/task-executor.md", "- **KB-TE-001** — A legacy rule kept from 5.x.\n");
      const init = () => spawnSync(process.execPath, [join(ROOT, "bin/init.mjs"), "-d", t.dir, "-y"], { cwd: t.dir, encoding: "utf8", env: { ...process.env, PATH: "/usr/bin:/bin" } });
      const a = init(); const once = tree(join(t.dir, "shapeup/knowledge-base/rules"));
      const b = init();
      check(a.status === 0 && once.length > 0 && /1 rule file/.test(a.stdout), "init writes one rule file for the old rule");
      check(b.status === 0 && tree(join(t.dir, "shapeup/knowledge-base/rules")) === once && /0 rule file/.test(b.stdout), "init run twice does not duplicate a rule");
      check(readFileSync(join(t.dir, "shapeup/knowledge-base/task-executor.md"), "utf8").includes("KB-TE-001"), "the old file is untouched");
    } finally { t.done(); }
  }

  section("kb format — this repository's own rule table is clean");
  const own = kernel(ROOT, ["kb", "lint", "--cwd", ROOT], { cwd: ROOT });
  check(own.status === 0, `kb lint is clean on this repository's table${own.status === 0 ? "" : `: ${own.err.slice(0, 300)}`}`);
}
