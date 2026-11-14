// The metrics directory and the Tier C templates — common to every target.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { metricsDir } from "../../../kernel/lib/paths.mjs";

const TEMPLATES = [
  [".claude/settings.local.example.json", "copy to settings.local.json and edit"],
  [".env.shapeup.example", "copy to .env.shapeup.local and edit"],
];

export const scaffoldStep = {
  id: "scaffold",
  plan({ pkgRoot, target }) {
    const ops = [{ op: "mkdir", path: metricsDir(target) }];
    for (const [srcRel, note] of TEMPLATES) {
      const from = join(pkgRoot, srcRel);
      if (!existsSync(from)) continue;
      ops.push({
        op: "copy", from, to: join(target, srcRel), note: `Installed ${srcRel} (${note})`,
        same: `${srcRel} already present at the install target (self-install) — nothing to copy`,
      });
    }
    return ops;
  },
  check({ target }) {
    const ok = existsSync(metricsDir(target));
    return { ok, problems: ok ? [] : ["shapeup/metrics/ is missing"] };
  },
};
