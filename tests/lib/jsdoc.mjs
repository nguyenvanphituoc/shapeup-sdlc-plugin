// JSDoc-coverage guard (skills-optimization plan, Track D). The harness scripts are the
// executable contracts other skills depend on (single-writer ingest-result, hook-validated
// compile-order, the trace-lint oracle); their signatures are the seams, so every top-level and
// exported function must carry a JSDoc block whose input/output shape is legible without reading
// the body. This module enumerates those functions with a deliberately conservative regex parser
// (no AST dependency) and asserts each has a preceding JSDoc with @param (when it takes args) and
// @returns. It under-flags multi-line-signature helpers rather than risk a false failure.
import { readFileSync } from "node:fs";

/**
 * Enumerate top-level / exported function definitions in a source file and their arg-ness.
 * @param {string} src - Full source text of a `.mjs` module.
 * @returns {Array<{name:string, line:number, hasArgs:boolean}>} One entry per detected function
 *   site: `name` is the identifier, `line` is the 1-indexed line the definition starts on,
 *   `hasArgs` is true when the parameter list is non-empty. Detects NAMED functions at ANY
 *   indentation — `function`/`async function` declarations, `const/let NAME = (…) =>` arrows,
 *   and `const/let NAME = function` expressions — and balances parens across lines, so
 *   MULTI-LINE signatures (e.g. a destructured `({ a, b }) =>`) and nested parens in defaults
 *   (e.g. `(x, y = new Set()) =>`) are caught too. A candidate is only reported when the balanced
 *   parameter list is followed by `=>` (arrow) or `{` (declaration/function-expression), which
 *   rejects grouping-paren expressions like `const r = (a || b).map(...)`. Anonymous callbacks
 *   and object-method properties (`ok: (m) => …`) are intentionally not reported.
 */
export function findFunctions(src) {
  const lines = src.split("\n");
  const sites = [];
  const declRe = /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/;
  const assignRe = /^\s*(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(function\b[^(]*)?\(/;
  for (let i = 0; i < lines.length; i++) {
    const md = lines[i].match(declRe);
    const ma = md ? null : lines[i].match(assignRe);
    if (!md && !ma) continue;
    const name = (md || ma)[1];
    const isDeclLike = !!md || !!(ma && ma[2]); // function decl or `= function` expression
    const openIdx = (md ? md[0].length : ma[0].length) - 1; // index of the opening '('

    // Balance parens from the opening '(' across lines to find the matching close.
    let depth = 0, li = i, ci = openIdx, found = null;
    outer: for (; li < lines.length; li++) {
      const L = lines[li];
      for (; ci < L.length; ci++) {
        if (L[ci] === "(") depth++;
        else if (L[ci] === ")" && --depth === 0) { found = { li, ci }; break outer; }
      }
      ci = 0;
    }
    if (!found) continue;

    // Parameter text (for hasArgs).
    let params;
    if (found.li === i) params = lines[i].slice(openIdx + 1, found.ci);
    else {
      params = lines[i].slice(openIdx + 1);
      for (let k = i + 1; k < found.li; k++) params += lines[k];
      params += lines[found.li].slice(0, found.ci);
    }

    // What follows the close paren (skipping blank lines) decides arrow vs declaration vs expression.
    let after = lines[found.li].slice(found.ci + 1), aj = found.li;
    while (after.trim() === "" && aj + 1 < lines.length) after = lines[++aj];
    const t = after.trimStart();
    const isFn = isDeclLike ? t.startsWith("{") : t.startsWith("=>");
    if (!isFn) continue;

    sites.push({ name, line: i + 1, hasArgs: params.trim().length > 0 });
  }
  return sites;
}

/**
 * Return the JSDoc block immediately preceding a 1-indexed line, if any.
 * @param {string[]} lines - The file split into lines (0-indexed array).
 * @param {number} line - 1-indexed line the function definition starts on.
 * @returns {string|null} The JSDoc block text (from `/**` through `*​/`) when the nearest
 *   non-blank line above the definition closes a block comment, else null. Blank lines between
 *   the block and the definition are allowed; any other intervening code returns null.
 */
export function precedingJsdoc(lines, line) {
  let i = line - 2; // 0-indexed line just above the definition
  while (i >= 0 && lines[i].trim() === "") i--;
  if (i < 0 || lines[i].trim() !== "*/") return null;
  const end = i;
  // Scan up to the block OPENING — a line that starts with `/**` — not merely any line that
  // mentions the token (a JSDoc body may reference `/**` in prose, as this very file does).
  while (i >= 0 && !lines[i].trim().startsWith("/**")) i--;
  if (i < 0) return null;
  return lines.slice(i, end + 1).join("\n");
}

/**
 * Assert JSDoc coverage over a set of in-scope scripts, recording one check per function.
 * @param {object} ctx - Shared harness context (uses ctx.ok / ctx.fail).
 * @param {string[]} absPaths - Absolute paths of the `.mjs` files to audit.
 * @param {function(string):string} [rel] - Optional path-prettifier for messages (e.g. strip ROOT).
 * @returns {number} The count of function sites audited across all files (0 when none matched).
 *   Side effect: ctx.ok for each function that carries a well-formed JSDoc, ctx.fail (naming the
 *   file:line and the missing tag) for each that lacks the block, an @param when it takes args,
 *   or an @returns.
 */
export function assertJsdocCoverage(ctx, absPaths, rel = (p) => p) {
  let audited = 0;
  for (const p of absPaths) {
    const src = readFileSync(p, "utf8");
    const lines = src.split("\n");
    for (const fn of findFunctions(src)) {
      audited++;
      const block = precedingJsdoc(lines, fn.line);
      if (!block) { ctx.fail(`${rel(p)}:${fn.line} ${fn.name}() has no preceding JSDoc block`); continue; }
      if (fn.hasArgs && !/@param\b/.test(block)) { ctx.fail(`${rel(p)}:${fn.line} ${fn.name}() JSDoc has no @param (takes args)`); continue; }
      if (!/@returns\b/.test(block)) { ctx.fail(`${rel(p)}:${fn.line} ${fn.name}() JSDoc has no @returns`); continue; }
      ctx.ok(`${rel(p).split("/").pop()} ${fn.name}() is JSDoc-covered`);
    }
  }
  return audited;
}
