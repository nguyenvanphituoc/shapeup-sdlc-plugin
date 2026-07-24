// Shared primitives for the structural test suite (Track C split).
//
// The suite counts assertions dynamically: every ok() call-site increments a live counter,
// and the checks-floor (§26d) asserts the grand total never silently drops. To preserve that
// semantic across modules, all modules share ONE ctx object built by makeCtx(); ok()/fail()
// close over its counters, so the total is byte-for-byte comparable to the pre-split suite.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Read a UTF-8 file.
 * @param {string} p - Absolute or cwd-relative path to the file.
 * @returns {string} The file contents decoded as UTF-8.
 * @throws {Error} If the path does not exist or is not readable (fs error propagates).
 */
export const read = (p) => readFileSync(p, "utf8");

/**
 * Read and parse a JSON file.
 * @param {string} p - Path to a JSON document.
 * @returns {*} The parsed value (object, array, or scalar per the file).
 * @throws {SyntaxError} If the contents are not valid JSON.
 * @throws {Error} If the file cannot be read.
 */
export const readJSON = (p) => JSON.parse(read(p));

/**
 * Extract top-level scalar keys from a Markdown YAML frontmatter block. A deliberately tiny
 * parser — enough for the SKILL.md schema (name/description and other one-line scalars),
 * including folded (`>`) and literal (`|`) blocks joined into a single trimmed string.
 * @param {string} md - Full Markdown document text.
 * @returns {Object<string,string>|null} A flat map of frontmatter key -> string value, or
 *   null when the document has no leading `---`-delimited frontmatter block. Nested/mapping
 *   values are not represented (only top-level scalars and folded/literal blocks).
 */
export function frontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const meta = {};
  let key = null, buf = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (buf !== null) {
      // continuation of a folded/literal block or quoted value spanning lines
      if (/^\S/.test(line) && line.includes(":")) {
        meta[key] = buf.trim(); buf = null; // fall through to new-key parse below
      } else { buf += " " + line.trim(); continue; }
    }
    const c = line.indexOf(":");
    if (c === -1 || /^\s/.test(line)) continue;
    key = line.slice(0, c).trim();
    let val = line.slice(c + 1).trim();
    if (val === ">" || val === "|") { buf = ""; continue; }
    val = val.replace(/^["']|["']$/g, "");
    meta[key] = val;
  }
  if (buf !== null && key) meta[key] = buf.trim();
  return meta;
}

/**
 * Recursively collect every Markdown file under a directory, skipping VCS/build dirs
 * (.git, node_modules, dist).
 * @param {string} dir - Directory to walk (absolute path recommended).
 * @param {string[]} [acc=[]] - Accumulator; callers normally omit it.
 * @returns {string[]} Absolute paths of all `.md` files found, in directory-traversal order.
 * @throws {Error} If `dir` is not a readable directory.
 */
export function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules" || e.name === "dist") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".md")) acc.push(p);
  }
  return acc;
}

/**
 * Build the shared test context threaded through every structural module's run(ctx).
 * @param {string} ROOT - Absolute path to the repository root; modules resolve every path
 *   against it.
 * @returns {{ROOT:string, checks:number, failures:number, checksFloor:(number|null),
 *   ok:(function(string):void), fail:(function(string):void),
 *   section:(function(string):void), read:(function(string):string),
 *   readJSON:(function(string):*), frontmatter:(function(string):(Object|null)),
 *   walk:(function(string, string[]=):string[])}} A live context object. `ok(msg)` increments
 *   `checks` (echoing under VERBOSE); `fail(msg)` increments `failures` and prints to stderr;
 *   `section(name)` prints a header. `checksFloor` starts null and is set by the docs module
 *   (§26d) for the runner's final floor assertion. Counters are mutated in place — callers
 *   read ctx.checks/ctx.failures after all modules run.
 */
export function makeCtx(ROOT) {
  const ctx = {
    ROOT,
    checks: 0,
    failures: 0,
    checksFloor: null,
    ok: (msg) => { ctx.checks++; if (process.env.VERBOSE) console.log(`  ✓ ${msg}`); },
    fail: (msg) => { ctx.failures++; console.error(`  ✗ ${msg}`); },
    section: (name) => console.log(`\n▸ ${name}`),
    read,
    readJSON,
    frontmatter,
    walk,
  };
  return ctx;
}
