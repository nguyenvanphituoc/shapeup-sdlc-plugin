// Structural test module: the shipped set carries no internal bookkeeping.
//
// THE DEFECT THIS MODULE EXISTS FOR. CLAUDE.md's standing rule — "nothing in the shipped set may
// reference something the user did not receive" — has no enforcer of its own; it is caught, if at
// all, by a human audit pass reading prose. A stage can introduce an internal defect id (`HD-0xx`)
// or a citation into `tests/`, `docs/`, `tools/` or `evals/` inside a file that ships, and the
// structural suite stays green throughout, because nothing greps for it. Measured once: four such
// references landed across two shipped files in one stage and were caught only by a second-pass
// review, after the suite had already passed.
//
// THE SCOPE, DERIVED — never a hand-kept file list. `package.json`'s own `files` allowlist is the
// one place "what ships" is declared (release CI already trusts it to build the npm tarball); this
// module resolves it against the filesystem itself rather than re-typing the shipped roots.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = /\.(mjs|js|json|md|sh|yml|yaml)$/;

/** Recursively collect shippable source files under `abs`, repo-relative paths in `rel`. */
function collect(abs, rel, out) {
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const a = join(abs, e.name);
    const r = `${rel}/${e.name}`;
    if (e.isDirectory()) collect(a, r, out);
    else if (SRC.test(e.name)) out.push(r);
  }
}

/**
 * Resolve `package.json`'s `files` allowlist to the actual shipped file list on disk.
 * @param {string} ROOT - Repo root.
 * @returns {string[]} Repo-relative paths of every shippable (text, source-extension) file.
 */
function shippedFiles(ROOT) {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const out = [];
  for (const entry of pkg.files || []) {
    const rel = entry.replace(/\/$/, "");
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;
    if (statSync(abs).isDirectory()) collect(abs, rel, out);
    else if (SRC.test(rel)) out.push(rel);
  }
  return out;
}

/**
 * Run the shipped-set hygiene checks.
 * @param {object} ctx - Shared harness context from tests/lib/harness.mjs (makeCtx).
 * @returns {Promise<void>} Resolves when both section bodies finish.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const files = shippedFiles(ROOT);

  // =============================================================================
  section("101. The shipped set names no internal defect id");
  // =============================================================================
  // Product vocabulary carve-out: `skills/coach/SKILL.md`'s knowledge-base TEMPLATE uses `HD-001`
  // as the fill-in-the-blank example row (`<symptom observed at ship>` beside it makes the
  // placeholder-ness explicit to a reader) — that is taught craft, not a citation of this repo's
  // own defect ledger, and is the one standing exception.
  //
  // SCOPE, WIDER THAN `files` BY EXACTLY ONE ENTRY AND DELIBERATELY SO. npm publishes `README.md`,
  // `LICENSE` and `package.json` whether or not the allowlist names them — `npm pack --dry-run`
  // reports the README as the single largest published file, while `files` says nothing about it.
  // A scope derived from the allowlist alone therefore has a blind spot precisely where the
  // densest prose ships. This section covers it; section 102 deliberately does NOT, for the reason
  // recorded there.
  const ID = /\bHD-\d{3}\b/g;
  const npmImplicit = ["README.md"].filter((f) => existsSync(join(ROOT, f)));
  const idScope = [...files, ...npmImplicit];
  const hits = [];
  for (const rel of idScope) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    let m;
    while ((m = ID.exec(text))) {
      if (rel === "skills/coach/SKILL.md" && m[0] === "HD-001") continue;
      hits.push(`${rel}: ${m[0]}`);
    }
  }
  if (hits.length === 0) {
    ok(`none of ${idScope.length} shipped files cite an internal defect id (the allowlist plus the ` +
       `files npm publishes implicitly)`);
  } else {
    fail(`shipped file(s) cite an internal defect id — a consumer cannot open the ledger these ` +
         `name; keep the operative rationale, drop the id:\n    ${hits.join("\n    ")}`);
  }

  // =============================================================================
  section("102. The shipped set cites no path into tests/, docs/, tools/ or evals/");
  // =============================================================================
  // SCOPE: the allowlist only — this section does NOT extend to `README.md`, and that is a decision
  // rather than an oversight. The README is read on the repository page, where a link into `docs/`
  // resolves and is doing deliberate work; that those same links 404 on the npm package page is a
  // positioning question for the product, not a hygiene defect for a test to adjudicate. Section
  // 101 covers the README because an internal defect id is wrong in EITHER venue.
  //
  // Each pattern is scoped to what this repo has actually hit, not a blanket directory-name match:
  // consumer-facing skill prose legitimately shows a CONSUMER's own `docs/pitch.md` or
  // `docs/glossary.md` as an example CLI argument, and `kernel/verify/build.mjs` legitimately
  // quotes a HarmonyOS SDK path that happens to contain `/tools/…` inside an absolute path. Both
  // are excluded by construction below rather than by a per-file allowlist.
  const PATTERNS = [
    // `tests/` never appears in shipped prose for any legitimate reason — nothing shipped has a
    // test directory of its own to point a reader at.
    { name: "tests/", re: /\btests\// },
    // Only this repo's own internal-only doc trees, never a bare `docs/<file>.md` — that shape is
    // also how a consumer's own project docs are shown as CLI examples.
    { name: "docs/{design,audit,visualize,assets}/", re: /\bdocs\/(design|audit|visualize|assets)\// },
    // Excludes `/tools/…` reached as the tail of some OTHER absolute path (e.g. an SDK path in a
    // quoted shell example) by requiring the character before `tools/` not be `/` or a word char.
    { name: "tools/", re: /(?<![/\w])tools\// },
    { name: "evals/", re: /\bevals\// },
  ];
  const pathHits = [];
  for (const rel of files) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    for (const { name, re } of PATTERNS) {
      if (re.test(text)) pathHits.push(`${rel}: ${name}`);
    }
  }
  if (pathHits.length === 0) {
    ok(`none of ${files.length} shipped files cite a tests/, docs/, tools/ or evals/ path`);
  } else {
    fail(`shipped file(s) cite a path the consumer does not receive — keep the operative rationale, ` +
         `drop the citation:\n    ${pathHits.join("\n    ")}`);
  }
}
