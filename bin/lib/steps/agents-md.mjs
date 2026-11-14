// The harness block in the project's AGENTS.md — common to every target.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const START = "<!-- HARNESS_START -->";

export const agentsMdStep = {
  id: "agents-md",
  plan({ pkgRoot, target, rel }) {
    const src = join(pkgRoot, "AGENTS.md");
    const dst = join(target, "AGENTS.md");
    if (!existsSync(src)) return [{ op: "note", text: "Warning: AGENTS.md not found in package — skipping root AGENTS.md setup." }];
    const block = readFileSync(src, "utf8");
    if (!existsSync(dst)) return [{ op: "write", path: dst, content: block, note: `Created ${rel(dst)} from harness template` }];
    const existing = readFileSync(dst, "utf8");
    if (!existing.includes(START)) return [{ op: "append", path: dst, content: "\n" + block, note: `Appended harness block to existing ${rel(dst)}` }];
    // Replace the old block in place (block goes at the top).
    const stripped = existing.split(/\r?\n/).reduce((acc, line) => {
      if (line.includes(START)) acc.skip = true;
      else if (line.includes("<!-- HARNESS_END -->")) acc.skip = false;
      else if (!acc.skip) acc.out.push(line);
      return acc;
    }, { out: [], skip: false }).out.join("\n");
    return [{ op: "write", path: dst, content: block + stripped, note: `Updated harness block in ${rel(dst)}` }];
  },
  check({ target }) {
    const dst = join(target, "AGENTS.md");
    const ok = existsSync(dst) && readFileSync(dst, "utf8").includes(START);
    return { ok, problems: ok ? [] : ["AGENTS.md has no harness block"] };
  },
};
