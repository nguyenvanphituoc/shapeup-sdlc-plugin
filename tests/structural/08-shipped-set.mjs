// What ships, and what the docs say about it.
//
// Two things rot silently in a repo that is both a product and its own blueprint. The first is
// bookkeeping leaking into files a user receives: an internal defect id, a path into folders the
// package does not carry. The second is prose that stops matching the tree: a hook the security page
// never mentions, a cited path that was deleted, a relative link that dangles. Each is checked
// against the thing itself — the package's own allowlist, the hook manifest, the filesystem.
import { join } from "node:path";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

const SRC = /\.(mjs|js|json|md|sh|yml|yaml)$/;

export async function run(ctx) {
  const { ROOT, ok, fail, section, readJSON } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  const text = (rel) => readFileSync(join(ROOT, rel), "utf8");

  const collect = (rel, out = []) => {
    for (const e of readdirSync(join(ROOT, rel), { withFileTypes: true })) {
      const p = `${rel}/${e.name}`;
      if (e.isDirectory()) collect(p, out); else if (SRC.test(e.name)) out.push(p);
    }
    return out;
  };
  const pkg = readJSON(join(ROOT, "package.json"));
  const shipped = pkg.files.flatMap((f) => {
    const rel = f.replace(/\/$/, "");
    if (!existsSync(join(ROOT, rel))) return [];
    return statSync(join(ROOT, rel)).isDirectory() ? collect(rel) : SRC.test(rel) ? [rel] : [];
  });

  section("shipped set — no bookkeeping a user cannot open");
  const idHits = [];
  for (const rel of [...shipped, "README.md"]) {
    for (const m of text(rel).matchAll(/\bHD-\d{3}\b/g)) {
      if (rel === "skills/building/resources/retro/retro.md" && m[0] === "HD-001") continue; // a placeholder for the consumer's own id
      idHits.push(`${rel}: ${m[0]}`);
    }
  }
  check(idHits.length === 0, `none of ${shipped.length} shipped files cites an internal defect id${idHits.length ? `:\n    ${idHits.join("\n    ")}` : ""}`);
  const PATHS = [["tests/", /\btests\//], ["docs/", /\bdocs\/(design|audit|visualize|assets)\//], ["tools/", /(?<![/\w])tools\//], ["evals/", /\bevals\//]];
  const pathHits = shipped.flatMap((rel) => PATHS.filter(([, re]) => re.test(text(rel))).map(([n]) => `${rel}: ${n}`));
  check(pathHits.length === 0, `none of the shipped files cites a path into tests/, docs/, tools/ or evals/${pathHits.length ? `:\n    ${pathHits.join("\n    ")}` : ""}`);
  const binary = [...shipped, "AGENTS.md", "README.md"].filter((rel) => [...readFileSync(join(ROOT, rel))].some((b) => b === 0 || (b < 32 && ![9, 10, 13].includes(b))));
  check(binary.length === 0, `every shipped file is text a line-oriented tool can read${binary.length ? `: ${binary.join(", ")}` : ""}`);

  section("docs — every hook is documented, and every hook file is registered");
  const manifest = readJSON(join(ROOT, "hooks/hooks.json"));
  const labels = new Set();
  for (const g of Object.values(manifest.hooks).flat()) {
    for (const h of g.hooks) {
      const m = h.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+?\.mjs)"?\s*(.*)$/);
      if (m) labels.add(m[2].trim() || m[1].split("/").pop());   // a kernel verb is named by its verb, a hook by its file
    }
  }
  for (const label of labels) {
    for (const doc of ["README.md", "SECURITY.md", "docs/design/03-system-design.md"]) {
      check(text(doc).includes(label), `${doc} documents the hook "${label}"`);
    }
  }
  const registered = new Set(Object.values(manifest.hooks).flat().flatMap((g) => g.hooks.map((h) => h.command)).join("\n").match(/hooks\/[\w-]+\.mjs/g));
  for (const f of readdirSync(join(ROOT, "hooks")).filter((f) => f.endsWith(".mjs"))) {
    check(registered.has(`hooks/${f}`), `hooks/${f} is registered, so it enforces something`);
  }

  section("docs — every cited path exists and every relative link resolves");
  const docsUnder = (rel) => readdirSync(join(ROOT, rel)).flatMap((f) =>
    statSync(join(ROOT, rel, f)).isDirectory() ? docsUnder(`${rel}/${f}`) : /\.(md|html)$/.test(f) ? [`${rel}/${f}`] : []);
  // A record of what was true when it was written names paths that are supposed to stop existing; a
  // changelog, an execution record, a superseded plan. Holding those to the tree would demand editing history.
  const isRecord = (rel) => /(^|\/)changelog[^/]*\.md$/i.test(rel) || /^docs\/design\/v4\/(execution|plan|review|proposal|constraints)-/.test(rel)
    || rel.startsWith("docs/design/v4/analysis/");
  const living = ["README.md", "CONTRIBUTING.md", "SECURITY.md", ...docsUnder("docs")].filter((r) => !isRecord(r));
  const historical = (l) => /\*\*Supersedes\*\*|Superseded by|Renamed from|\bWas `/.test(l);
  const pathRe = /(?:^|[\s`("'>])((?:hooks|skills|tests|commands|docs|tools|oracles)\/[A-Za-z0-9._/-]+\.(?:mjs|json|js|md|sh|html))(?![A-Za-z0-9])/g;
  const dirRe = /(?:^|[\s`("'>])(docs\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\/)(?![A-Za-z0-9])/g;
  const cited = new Map();
  const dead = [];
  for (const rel of living) {
    let fenced = false;
    for (const line of text(rel).split("\n")) {
      if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
      if (historical(line)) continue;
      for (const re of [pathRe, dirRe]) for (const m of line.matchAll(re)) if (!cited.has(m[1])) cited.set(m[1], rel);
      if (fenced) continue;
      for (const m of line.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const target = m[1].split("#")[0].split("?")[0];
        if (target && !/^[a-z][a-z0-9+.-]*:/i.test(target) && !existsSync(join(ROOT, rel, "..", target))) dead.push(`${rel} links to ${m[1]}`);
      }
    }
  }
  for (const [p, from] of cited) if (!existsSync(join(ROOT, p))) dead.push(`${from} cites ${p}`);
  check(cited.size > 10, `the scan found ${cited.size} cited paths in ${living.length} living docs (a scan that finds none proves nothing)`);
  check(dead.length === 0, `no living doc cites a path that is not on disk or links to a file that is not there${dead.length ? `:\n    ${dead.join("\n    ")}` : ""}`);

  section("docs — counted claims match the tree");
  const skillCount = readdirSync(join(ROOT, "skills")).filter((d) => statSync(join(ROOT, "skills", d)).isDirectory()).length;
  const words = { nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15 };
  for (const rel of ["README.md", "docs/design/README.md", "docs/design/06-appendix.md"]) {
    if (!existsSync(join(ROOT, rel))) continue;
    for (const m of text(rel).matchAll(/the ([0-9]+|nine|ten|eleven|twelve|thirteen|fourteen|fifteen) (?:harness )?skills/gi)) {
      check(Number(words[m[1].toLowerCase()] ?? m[1]) === skillCount, `${rel} says "${m[0]}" and skills/ holds ${skillCount}`);
    }
  }
}
