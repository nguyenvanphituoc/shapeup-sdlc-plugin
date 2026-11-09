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
//
// The loop skill is also read against itself and against the kernel. Its last section is an index:
// one line per file, giving the phase rows that file answers. A file with rows under a phase folder
// is an activity file and opens with a four-row contract (resources/contract.md says what each row
// holds). The checks below hold the three to each other — the phase table, the index, the headers —
// and hold the headers to the schema's operations, the order templates and the kernel's gate list.
// The schema's operations and the order templates are also held to each other, both ways.
// Last, the names: a slash name the plugin's documents write has to be one the plugin answers.
//
// Reachability has one deliberate looseness. A file in a library folder — a folder some reachable
// file points at, holding no file the index lists — counts as named when its file name appears, or
// the name of the artifact it is the template for (`usecase` names `usecase.tmpl.md`). The planner
// reaches its templates that way, so a common word can name a template nothing really uses. Every
// other resource has to be named by its path.
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

  // ---- the loop skill: phase table, index, contract headers ----
  const rel = (abs) => abs.slice(ROOT.length + 1);
  const list = (items) => (items.length ? `:\n    ${items.join("\n    ")}` : "");
  const ticks = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const loopRoot = join(ROOT, "skills", "building");
  const skillMd = readFileSync(join(loopRoot, "SKILL.md"), "utf8");
  const sectionOf = (text, heading) => { const a = text.indexOf(heading); const b = text.indexOf("\n## ", a + heading.length); return a < 0 ? "" : text.slice(a, b < 0 ? text.length : b); };
  const phaseRows = [...sectionOf(skillMd, "## The phases").matchAll(/^\| (\d+) \|/gm)].map((m) => m[1]);
  const index = [...sectionOf(skillMd, "## Index").matchAll(/^\| (.+?) \| (.+?) \| (.+?) \|$/gm)]
    .map(([, rows, what, file]) => ({ rows: rows.trim() === "—" ? [] : ticks(rows), what, file: file.trim() === "this file" ? null : ticks(file)[0] }))
    .filter((l) => l.file !== undefined && !/^-+$/.test(l.what) && l.what !== "What");
  const PHASE_FOLDERS = ["intake", "plan", "build", "ship", "retro"];
  const isActivity = (l) => l.rows.length > 0 && l.file && PHASE_FOLDERS.some((d) => l.file.startsWith(`resources/${d}/`));
  const activities = index.filter(isActivity);

  /** The four contract rows of a file, or null when it has no header. */
  const header = (file) => {
    const lines = readFileSync(join(loopRoot, file), "utf8").split("\n");
    const at = lines.indexOf("| Contract | |");
    if (at < 0) return null;
    const rows = {};
    for (const l of lines.slice(at + 2)) { const m = l.match(/^\| (.+?) \| (.*) \|$/); if (!m) break; rows[m[1]] = m[2].trim(); }
    return rows;
  };

  section("skill anatomy — the loop's index, phase table and contract headers agree");
  check(phaseRows.length >= 10 && activities.length >= 10, `the scan found ${phaseRows.length} phase rows and ${activities.length} activity files on the index (a scan that finds none proves nothing)`);

  // C3 — every phase row, and step 0, is on exactly one index line.
  const misplaced = [...phaseRows.map((r) => [r, `row ${r}`]), ["step 0", "step 0"]]
    .map(([token, name]) => [name, index.filter((l) => l.rows.includes(token)).length])
    .filter(([, n]) => n !== 1).map(([name, n]) => `${name} is on ${n} index lines`);
  check(misplaced.length === 0, `every phase row and step 0 is on exactly one index line${list(misplaced)}`);

  // C3 — and the file an index line names says the same rows in its own header.
  const disagree = activities.filter((l) => { const h = header(l.file); return !h || [...ticks(h.Phase ?? "")].sort().join() !== [...l.rows].sort().join(); })
    .map((l) => `skills/building/${l.file}: the index says ${l.rows.join(", ")} and the header says ${header(l.file)?.Phase ?? "nothing"}`);
  check(disagree.length === 0, `every activity file's header names the rows the index gives it${list(disagree)}`);

  // C4 — every activity file carries the four rows, with values the tables that own them accept.
  const ops = ctx.readJSON(join(ROOT, "kernel/schemas/domain.schema.json")).$defs.Operation.enum;
  const orders = readFileSync(join(loopRoot, "resources/orders.md"), "utf8");
  const substrate = sectionOf(orders, "## Substrate per operation"), payload = sectionOf(orders, "## Payload per operation");
  const malformed = [];
  for (const l of activities) {
    const h = header(l.file), at = `skills/building/${l.file}`;
    if (!h) { malformed.push(`${at}: no contract header`); continue; }
    const names = Object.keys(h);
    if (names.join() !== "Phase,Order,Gate,Done when") { malformed.push(`${at}: the header's rows are ${names.join(", ") || "none"}, not Phase, Order, Gate, Done when`); continue; }
    for (const t of ticks(h.Phase)) if (!(phaseRows.includes(t) || t === "step 0" || t === "sub-command")) malformed.push(`${at}: Phase names \`${t}\`, which is no phase row`);
    if (!ticks(h.Phase).length) malformed.push(`${at}: Phase is empty`);
    const [op, step] = ticks(h.Order);
    if (op !== "none") {
      if (!ops.includes(op)) malformed.push(`${at}: Order names \`${op}\`, which is not an operation in the schema`);
      else if (op === "plan" ? !substrate.includes(`\`plan\` (\`${step}\`)`) : !(substrate.includes(`\`${op}\``) && payload.includes(`\`${op}\``))) malformed.push(`${at}: Order names ${op}${step ? " · " + step : ""}, which has no row in the order templates`);
    }
    if (!ticks(h.Gate).length) malformed.push(`${at}: Gate is empty (write \`none\`)`);
    if (!h["Done when"]) malformed.push(`${at}: Done when is empty`);
  }
  const indexed = new Set(activities.map((l) => l.file));
  for (const f of walk(join(loopRoot, "resources")).filter((f) => f.endsWith(".md"))) {
    const r = f.slice(loopRoot.length + 1);
    if (r !== "resources/contract.md" && !indexed.has(r) && header(r)) malformed.push(`skills/building/${r}: carries a contract header and the index gives it no rows`);
  }
  check(malformed.length === 0, `every activity file carries the four contract rows, and nothing else carries them${list(malformed)}`);

  // C5 — the schema's operations and the order templates name the same operations. An operation the
  // schema allows and the templates lack is one the loop has no order to write; one the templates
  // carry and the schema lacks is an order the envelope gate would refuse.
  const firstCells = (table) => new Set([...table.matchAll(/^\| ([^|]+) \|/gm)].flatMap((m) => ticks(m[1].split("(")[0])));
  const inSubstrate = firstCells(substrate), inPayload = firstCells(payload);
  const opDrift = [
    ...ops.filter((o) => !inSubstrate.has(o)).map((o) => `${o} is an operation in the schema and has no row in the substrate table of resources/orders.md`),
    ...ops.filter((o) => !inPayload.has(o)).map((o) => `${o} is an operation in the schema and has no row in the payload table of resources/orders.md`),
    ...[...new Set([...inSubstrate, ...inPayload])].filter((o) => !ops.includes(o)).map((o) => `resources/orders.md has a row for ${o}, which is not an operation in the schema`),
  ];
  check(opDrift.length === 0, `the schema's ${ops.length} operations and the order templates name the same operations, both ways${list(opDrift)}`);

  // C6 — the gates the loop names and the gates the kernel resolves are the same set.
  const { GATE_IDS } = await import(join(ROOT, "kernel/gate.mjs"));
  const named = new Map();
  for (const m of skillMd.matchAll(/\bGATE ([A-Z][A-Za-z0-9]*(?:[.-][0-9]+)?)/g)) named.set(m[1], "skills/building/SKILL.md");
  for (const l of activities) for (const g of ticks(header(l.file)?.Gate ?? "")) if (g !== "none") named.set(g, `skills/building/${l.file}`);
  const gateDrift = [
    ...[...named].filter(([g]) => !GATE_IDS.includes(g)).map(([g, from]) => `${from} names gate ${g}, which the kernel does not resolve`),
    ...GATE_IDS.filter((g) => !named.has(g)).map((g) => `the kernel resolves gate ${g}, and neither the phase table nor a header names it`),
  ];
  check(gateDrift.length === 0, `the gates the loop names are the gates the kernel resolves, both ways (${GATE_IDS.length})${list(gateDrift)}`);

  // C2 — every resource of the loop skill is reachable from SKILL.md.
  section("skill anatomy — every resource of the loop is reachable from its SKILL.md");
  const resources = walk(join(loopRoot, "resources")).filter((f) => f.endsWith(".md")).map((f) => f.slice(loopRoot.length + 1));
  const indexFiles = index.map((l) => l.file).filter(Boolean);
  const reached = new Set(), folders = new Set(), texts = [skillMd];
  const stem = (r) => basename(r).replace(/\.tmpl\.md$/, "").replace(/\.md$/, "");
  for (let grew = true; grew; ) {
    grew = false;
    for (const text of texts) for (const m of text.matchAll(pointerRe)) { const p = m[1].replace(/[.,;:]+$/, ""); if (p.endsWith("/")) folders.add(p); }
    const libraries = [...folders].filter((d) => !indexFiles.some((f) => f.startsWith(d)));
    for (const r of resources) {
      if (reached.has(r)) continue;
      const inLibrary = libraries.some((d) => r.startsWith(d));
      if (texts.some((t) => t.includes(r) || (inLibrary && (t.includes(basename(r)) || t.includes(stem(r)))))) {
        reached.add(r); texts.push(readFileSync(join(loopRoot, r), "utf8")); grew = true;
      }
    }
  }
  const orphans = resources.filter((r) => !reached.has(r)).map((r) => `skills/building/${r}`);
  check(orphans.length === 0, `each of the ${resources.length} resource files is named by a file SKILL.md leads to${list(orphans)}`);

  // C7 — a slash name the plugin's own documents write is one the plugin answers: a command file, a
  // skill folder, or, after `/ship`, a sub-command the loop lists. Read in the files that speak for the
  // plugin. docs/install.md is about the host's commands and the upgrade guide is where a removed name
  // belongs, so neither is read; of README.md only the Commands section is.
  section("skill anatomy — every slash name the plugin's documents write is one it answers");
  const commandNames = readdirSync(join(ROOT, "commands")).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
  const answers = new Set([...commandNames, ...skillRoots.map((d) => basename(d))]);
  const subCommands = new Set([...sectionOf(skillMd, "## Sub-commands").matchAll(/`([a-z]+)(?: [^`]*)?` (?:\(|—)/g)].map((m) => m[1]));
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const commandsSection = (() => { const a = readme.indexOf("### Commands"); const b = readme.indexOf("\n### ", a + 5); return a < 0 ? "" : readme.slice(a, b < 0 ? readme.length : b); })();
  const voices = [
    ["AGENTS.md", readFileSync(join(ROOT, "AGENTS.md"), "utf8")],
    ["README.md (Commands)", commandsSection],
    ["skills/building/SKILL.md", skillMd],
    ...commandNames.map((n) => [`commands/${n}.md`, readFileSync(join(ROOT, "commands", `${n}.md`), "utf8")]),
    ...["docs/quickstart.md", "docs/glossary.md", ...readdirSync(join(ROOT, "docs/design")).filter((f) => /^0.*\.md$/.test(f)).map((f) => `docs/design/${f}`)]
      .map((f) => [f, readFileSync(join(ROOT, f), "utf8")]),
  ];
  const unanswered = [];
  let slashNames = 0;
  for (const [file, text] of voices) {
    for (const m of text.matchAll(/(?:^|[\s`("])\/([a-z][a-z-]*)(?::([a-z][a-z-]*))?(?=[\s`.,;:)"]|$)/gm)) {
      const name = m[2] ?? m[1];
      slashNames++;
      if (!answers.has(name)) unanswered.push(`${file}: /${m[1]}${m[2] ? ":" + m[2] : ""} is neither a command file nor a skill`);
    }
    for (const m of text.matchAll(/(?:`|^)\/(?:[a-z-]+:)?ship ([a-z][a-z-]*)(?=[\s`]|$)/gm)) {
      if (!subCommands.has(m[1])) unanswered.push(`${file}: /ship ${m[1]} is not a sub-command the loop lists (${[...subCommands].join(", ")})`);
    }
  }
  check(slashNames > 20 && subCommands.size >= 4, `the scan found ${slashNames} slash names and ${subCommands.size} sub-commands (a scan that finds none proves nothing)`);
  check(unanswered.length === 0, `every slash name the plugin's documents write is a command, a skill or a sub-command of /ship${list([...new Set(unanswered)])}`);

  // C8 — where a document counts the slash commands, the count is the number of files in commands/.
  const WORDS = { two: 2, three: 3, nine: 9, ten: 10 };
  const counted = ["README.md", "docs/design/06-appendix.md", "docs/design/README.md", "docs/quickstart.md", "CONTRIBUTING.md"]
    .filter((f) => existsSync(join(ROOT, f)))
    .flatMap((f) => [...readFileSync(join(ROOT, f), "utf8").matchAll(/\b([0-9]+|two|three|nine|ten) slash commands/gi)].map((m) => [f, m[0], Number(WORDS[m[1].toLowerCase()] ?? m[1])]));
  const miscounted = counted.filter(([, , n]) => n !== commandNames.length).map(([f, text]) => `${f} says "${text}" and commands/ holds ${commandNames.length}`);
  check(counted.length > 0 && miscounted.length === 0, `each of the ${counted.length} places a document counts the slash commands says ${commandNames.length}${list(miscounted)}`);
}
