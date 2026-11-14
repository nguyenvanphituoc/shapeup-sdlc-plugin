// The ignore rules `init` manages — common to every target.
//
// Both roots are listed, deliberately. A project may still be carrying the earlier local root
// alongside the current one, and a run trace committed by accident from either is exactly the
// mistake the tier split exists to prevent. Ignoring a directory that does not exist costs nothing.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { LOCAL, LEGACY } from "../../../kernel/lib/paths.mjs";

export const GITIGNORE_RULE = `# Shape Up SDLC run workspace
${LOCAL}/
${LEGACY.local}/

# Shape Up SDLC Tier C — per-member local config (templates *.example stay committed).
# The env file is SHAPEUP_-namespaced (filename + keys) so it never collides with, or gets
# confused with, this project's own .env / .env.local.
.claude/settings.local.json
.env.shapeup.local
!.env.shapeup.example
!.claude/settings.local.example.json`;

export const gitignoreStep = {
  id: "gitignore",
  plan({ target }) {
    const file = join(target, ".gitignore");
    if (!existsSync(file)) return [{ op: "write", path: file, content: GITIGNORE_RULE + "\n", note: "Created .gitignore and added ignore rules" }];
    if (!readFileSync(file, "utf8").includes(`${LOCAL}/`)) {
      return [{ op: "append", path: file, content: "\n" + GITIGNORE_RULE + "\n", note: "Added Shape Up SDLC ignore rules to .gitignore" }];
    }
    return [{ op: "note", text: `${LOCAL}/ already ignored in .gitignore` }];
  },
  check({ target }) {
    const file = join(target, ".gitignore");
    const ok = existsSync(file) && readFileSync(file, "utf8").includes(`${LOCAL}/`);
    return { ok, problems: ok ? [] : [`.gitignore does not ignore ${LOCAL}/`] };
  },
};
