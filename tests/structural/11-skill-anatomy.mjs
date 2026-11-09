// The skills' own structure, read against the tree.
//
// A skill is a router and the files it points at, and a pointer rots the same way a doc link does:
// a file is renamed and the sentence that named it reads as well as it did before. The path check in
// the shipped-set module opens the living docs; nothing opened skills/. Each instruction here is read
// against the thing it names — a file on disk — and no wording is asserted.
//
// One spelling is resolved, and it is the only one a skill should use: `resources/<...>`, a path from
// a skill's root. It is looked for under the skill the sentence is in, and then under the other
// skills, because one skill may name another's file by that same path (`task-executor` names the
// loop's order template). That second lookup is the check's known blind spot: a pointer that should
// reach its own skill's file and finds a file of the same path in another skill reads as resolved.
// A trailing slash names a folder; a `*` names at least one file.
import { join, dirname, basename } from "node:path";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

  const resolves = (abs) => {
    if (abs.includes("*")) {
      const dir = dirname(abs);
      const re = new RegExp("^" + basename(abs).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
      return existsSync(dir) && readdirSync(dir).some((f) => re.test(f));
    }
    if (abs.endsWith("/")) return existsSync(abs) && statSync(abs).isDirectory();
    return existsSync(abs);
  };

  section("skill anatomy — every file a skill points at is on disk");
  const pointerRe = /(?<![A-Za-z0-9_/.<>-])(resources\/[A-Za-z0-9_.*/-]+)/g;
  const dangling = [];
  let seen = 0;
  const skillRoots = readdirSync(join(ROOT, "skills")).map((d) => join(ROOT, "skills", d)).filter((d) => statSync(d).isDirectory());
  for (const skillRoot of skillRoots) {
    for (const file of walk(skillRoot).filter((f) => f.endsWith(".md"))) {
      for (const m of readFileSync(file, "utf8").matchAll(pointerRe)) {
        const pointer = m[1].replace(/[.,;:]+$/, "");
        seen++;
        const under = (root) => resolves(join(root, pointer) + (pointer.endsWith("/") ? "/" : ""));
        if (!under(skillRoot) && !skillRoots.some(under)) dangling.push(`${file.slice(ROOT.length + 1)}: ${pointer}`);
      }
    }
  }
  check(seen > 10, `the scan found ${seen} pointers in the skills (a scan that finds none proves nothing)`);
  check(dangling.length === 0, `no skill points at a file that is not there${dangling.length ? `:\n    ${dangling.join("\n    ")}` : ""}`);
}
