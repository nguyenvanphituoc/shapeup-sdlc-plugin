// Structural test module: docs. Split out of tests/structural.mjs (Track C).
// Sections: 5, 7, 25, 26, 49. Byte-identical bodies; the runner threads the shared ctx.
import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/**
 * Run the docs structural checks.
 * @param {object} ctx - Shared harness context from tests/lib/harness.mjs (makeCtx).
 *   Carries ROOT (repo root), the ok/fail/section counters, and the read/readJSON/
 *   frontmatter/walk helpers. ok()/fail() mutate ctx.checks/ctx.failures in place.
 * @returns {Promise<void>} Resolves when the section bodies finish; assertions are
 *   recorded as side effects on ctx (never thrown for an ordinary check failure).
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON, frontmatter, walk } = ctx;
  const skillsDir = join(ROOT, "skills");
  const skillDirs = readdirSync(skillsDir).filter((d) => statSync(join(skillsDir, d)).isDirectory());


  // =============================================================================
  section("26. Doc-drift — documented counts, hook inventory, and cited paths match the filesystem");
  // =============================================================================
  // The dwarves-kit failure mode observed locally: the comparison report went stale twice in
  // 24 hours. Docs that assert counts or cite paths are now checked against the tree.
  {
    // (a) skill counts: every "the N (harness) skills" claim equals the actual skill dir count.
    for (const rel of ["README.md", "docs/design/README.md", "docs/design/06-appendix.md"]) {
      const p = join(ROOT, rel);
      if (!existsSync(p)) continue;
      const WORDNUM = { nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15 };
      // Spelled-out counts drift too, and silently: "The twelve skills" sat above a 13-row table
      // because the digit-only pattern could not see it. A drift check that only reads one notation
      // is a drift check with a blind spot.
      for (const m of read(p).matchAll(/the ([0-9]+|nine|ten|eleven|twelve|thirteen|fourteen|fifteen) (?:harness )?skills/gi)) {
        m[1] = String(WORDNUM[m[1].toLowerCase()] ?? m[1]);
        if (Number(m[1]) !== skillDirs.length) fail(`${rel} claims "${m[0]}" but skills/ holds ${skillDirs.length}`);
        else ok(`${rel} skill count matches (${m[1]})`);
      }
    }

    // (b) hook inventory, both directions.
    const manifest = readJSON(join(ROOT, "hooks/hooks.json"));
    // The LABEL a doc has to carry, derived from the command rather than assumed. A hook in
    // `hooks/` is named by its filename; the envelope gate is a kernel subcommand, so what a reader
    // must be able to find is the verb, not `harness.mjs` — which names every subcommand at once
    // and would let the check pass on a mention of any of them.
    const registeredScripts = new Set();
    for (const groups of Object.values(manifest.hooks || {})) {
      for (const g of groups) for (const h of g.hooks || []) {
        const cmd = h.command || "";
        const m = cmd.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+?\.mjs)/);
        if (!m) continue;
        const verbs = cmd.slice(cmd.indexOf(m[1]) + m[1].length).replace(/^\\?"/, "").trim();
        registeredScripts.add(verbs ? `${m[1]}|${verbs}` : m[1]);
      }
    }
    const readme = read(join(ROOT, "README.md"));
    const design03 = read(join(ROOT, "docs/design/03-system-design.md"));
    // SECURITY.md is in this list for a reason, and it is the sharpest of the three: it SHIPS (it
    // is in the `files` allowlist), and it is the page a reviewer reads to decide whether to trust
    // the hook surface at all. While it sat outside this check, three hooks were added without it
    // — and its falsifiable claim "Stop hooks never block" went on asserting the opposite of
    // `gate-zerowork`, which returns `decision: "block"`. An undocumented hook in the README is
    // untidy; an undocumented deny in the security page is a wrong answer to a security question.
    const security = read(join(ROOT, "SECURITY.md"));
    for (const entry of registeredScripts) {
      const [script, verbs] = entry.split("|");
      const base = verbs || script.split("/").pop();
      if (!readme.includes(base)) fail(`hooks.json registers ${base} but README.md never mentions it (undocumented hook)`);
      else ok(`README documents hook ${base}`);
      if (!design03.includes(base)) fail(`hooks.json registers ${base} but docs/design/03-system-design.md never mentions it`);
      else ok(`design/03 documents hook ${base}`);
      if (!security.includes(base)) fail(`hooks.json registers ${base} but SECURITY.md never mentions it — the shipped security page must enumerate every hook`);
      else ok(`SECURITY.md documents hook ${base}`);
    }
    for (const f of readdirSync(join(ROOT, "hooks")).filter((f) => f.endsWith(".mjs"))) {
      if (![...registeredScripts].some((s) => s.split("|")[0].endsWith(`/${f}`) || s.split("|")[0] === `hooks/${f}`)) {
        fail(`hooks/${f} exists on disk but hooks.json never registers it (orphan hook — it enforces nothing)`);
      } else ok(`hooks/${f} is registered`);
    }

    // (c) cited concrete paths exist (placeholders/globs are excluded by the char class).
    // `docs` belongs in this alternation and its absence was a hole big enough to drive a purge
    // through: a commit deleting 26 files under `docs/migration/` and `docs/internal/` left live
    // pointers in README, upgrading.md, an ADR and the org diagram, and this suite stayed green
    // because it could not see a `docs/...` citation at all. A drift check blind to the directory
    // docs cite most is a drift check that certifies the next purge too.
    // `>` is in the leading class because the scan covers `.html`, where a path is a text node
    // sitting directly against the tag that opens it (`<span class="path">tools/foo.js</span>`).
    // Without it the org diagram was scanned and still reported nothing, which is the worst of both
    // — a file inside the checked set, immune to the check.
    const pathRe = /(?:^|[\s`("'>])((?:hooks|skills|scripts|tests|commands|docs|tools|oracles|evals)\/[A-Za-z0-9._/-]+\.(?:mjs|json|js|md|sh|html))(?![A-Za-z0-9])/g;
    // Directory citations are the other half, and the half that broke worst: README's repo-layout
    // tree names `docs/internal/` with no filename, so an extension-anchored pattern skips the very
    // line whose whole job is to describe the tree. Restricted to `docs/` because that is where
    // prose points readers at a folder rather than a file; the char class excludes `<`, so
    // placeholder roots like `<slug>/` cannot match and be reported as missing.
    const dirRe = /(?:^|[\s`("'>])(docs\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\/)(?![A-Za-z0-9])/g;
    // Recurse: `docs/design/` gained `adr/` (ADR-0001), and a flat readdir both skipped the
    // decision records and handed a directory to readFileSync. Decision records cite more concrete
    // paths than any other doc, so they are exactly what this drift check wants to cover.
    // `.html` joins `.md` because `docs/visualize/` renders the file-organization diagram, which is
    // prose about the tree in another notation and goes stale exactly like prose does.
    const docsUnder = (rel) => readdirSync(join(ROOT, rel)).flatMap((f) =>
      statSync(join(ROOT, rel, f)).isDirectory() ? docsUnder(`${rel}/${f}`)
        : (/\.(md|html)$/.test(f) ? [`${rel}/${f}`] : []));
    // Every living doc, not a hand-kept list that a new file joins only if someone remembers.
    // Changelogs are the deliberate exclusion, by basename rather than by a list of two: they record
    // what was true at each release, so a path they name is *supposed* to stop existing. Applying
    // this check to them would demand editing history to keep a test green, which is the opposite
    // of what it is for.
    const isChangelog = (rel) => /(^|\/)changelog[^/]*\.md$/i.test(rel);
    const docFiles = ["README.md", "CONTRIBUTING.md", "SECURITY.md", ...docsUnder("docs")]
      .filter((rel) => !isChangelog(rel));
    // The same exemption at line granularity, because a living doc still has historical sentences in
    // it. An ADR's `Supersedes` row and its "Renamed from `<old>`" clause name a dead path ON
    // PURPOSE — that is the decision being recorded. Flagging those would push an author to delete
    // the very lines that explain why the tree looks the way it does. Present-tense prose gets no
    // such pass: "generated on demand by `tools/distribute.js`" is a claim about now, and stays in
    // scope.
    const isHistoricalLine = (l) => /\*\*Supersedes\*\*|Superseded by|Renamed from|\bWas `/.test(l);
    const cited = new Map();
    for (const rel of docFiles) {
      for (const line of read(join(ROOT, rel)).split("\n")) {
        if (isHistoricalLine(line)) continue;
        for (const re of [pathRe, dirRe]) {
          for (const m of line.matchAll(re)) if (!cited.has(m[1])) cited.set(m[1], rel);
        }
      }
    }
    for (const [p, from] of cited) {
      if (!existsSync(join(ROOT, p))) fail(`${from} cites ${p} — not on disk (doc drift)`);
      else ok(`cited path exists: ${p}`);
    }

    // (c2) Relative markdown links. The path pattern above only matches a citation that starts at
    // the repo's top-level folder, so a doc linking its neighbour as `[x](sibling.md)` or
    // `[x](../adr/0004.md)` was invisible to it — a folder of dead links read green. A link is
    // resolved against the file that carries it. External URLs, mail links and bare anchors are not
    // files; `#fragment` and `?query` are stripped before the lookup. Historical lines keep the
    // same exemption as above, and a link inside a fenced block is an example, not a claim.
    {
      const linkRe = /\[[^\]]*\]\(([^)\s]+)\)/g;
      for (const rel of docFiles) {
        let fenced = false;
        for (const line of read(join(ROOT, rel)).split("\n")) {
          if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
          if (fenced || isHistoricalLine(line)) continue;
          for (const m of line.matchAll(linkRe)) {
            const target = m[1].split("#")[0].split("?")[0];
            if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
            const abs = join(ROOT, rel, "..", target);
            if (!existsSync(abs)) fail(`${rel} links to ${m[1]} — not on disk (relative-link drift)`);
            else ok(`relative link resolves: ${rel} -> ${target}`);
          }
        }
      }
    }

    // (d) checks-floor: docs state a floor ("N+ checks"), never an exact count that drifts.
    const floorM = read(join(ROOT, "docs/design/06-appendix.md")).match(/(\d+)\+ checks/);
    if (!floorM) fail(`docs/design/06-appendix.md states no "N+ checks" floor`);
    else { ctx.checksFloor = Number(floorM[1]); ok(`docs state a checks floor (${ctx.checksFloor}+)`); }
  }
}
