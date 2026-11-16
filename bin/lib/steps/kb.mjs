// The knowledge base's move to one rule per file — common to every target.
//
// A project that carries the old whole-file knowledge base gets it split into rules, once, and the old files are
// left exactly where they are. Re-running it adds nothing: a rule whose old id is already an alias is skipped.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { migrateRules, READERS } from "../../../kernel/shapeup/kb.mjs";
import { knowledgeBaseDir } from "../../../kernel/lib/paths.mjs";

const hasLegacy = (target) => Object.values(READERS).some((r) => r.legacy.some((n) => existsSync(join(knowledgeBaseDir(target), `${n}.md`))));

export const kbStep = {
  id: "kb",
  plan({ target }) {
    if (!hasLegacy(target)) return [];
    return [{
      op: "run", describe: "split the knowledge base into one rule per file (old files are kept)",
      fn: () => { const r = migrateRules(target); console.log(`Knowledge base: ${r.created.length} rule file(s) written, ${r.skipped.length} already present. The old files are untouched.`); },
    }];
  },
  check({ target }) {
    if (!hasLegacy(target)) return { ok: true, problems: [] };
    const dir = join(knowledgeBaseDir(target), "rules");
    const ok = existsSync(dir) && readdirSync(dir).length > 0;
    return { ok, problems: ok ? [] : ["the knowledge base has not been split into rules (run init again)"] };
  },
};
