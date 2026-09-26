// A TEST THAT FAILED BY NAME REACHES THE NEXT ATTEMPT.
//
// A runner that drives an app from outside it — a device flow, an end-to-end script — reports a
// failing case as one line, `FAIL <name> <why>`, with no file:line. The digester only kept lines it
// could anchor to a file, so a red fixture of that kind produced an EMPTY error list and the next
// attempt was told nothing about what failed. Such a line is now kept whole, with the name as the
// file only when it looks like a path: `TS-05-05` is an id, `src/cart.test.js` is a file.
import { join } from "node:path";

/**
 * Run the named-failure digest checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { digest } = await import(join(ROOT, "kernel/probe/digest.mjs"));

  section("157. A test that failed by name, with no file:line, reaches the next attempt's error list");

  const out = digest([
    "PASS TS-07-05",
    "FAIL TS-05-05 step 4: no text 'Bread' on screen (visible text: ['Buy eggs'])",
    "FAIL  src/cart.test.js",
    "ui-flow: 1/3 flows passed",
  ].join("\n"));
  const ts = out.find((t) => /TS-05-05/.test(t.core_message));
  if (ts && ts.file === null && ts.line === null && ts.kind === "named-test-failure" && /step 4: no text 'Bread'/.test(ts.core_message)) {
    ok("a FAIL line naming an id is kept whole, with no file invented for the id");
  } else fail(`TS-05-05 digested as ${JSON.stringify(ts)} — full: ${JSON.stringify(out)}`);
  const js = out.find((t) => /cart\.test\.js/.test(t.core_message));
  if (js?.file === "src/cart.test.js") ok("a FAIL line naming a path keeps the path as the file");
  else fail(`jest-style FAIL digested as ${JSON.stringify(js)}`);
  if (out.length === 2) ok("PASS lines and the summary line are not errors");
  else fail(`expected exactly 2 triples, got ${out.length}: ${JSON.stringify(out)}`);

  const quiet = digest(["> hvigor ERROR: BUILD FAILED in 3 s", "Tests run: 3, Failure: 0", "the FAIL case is handled elsewhere"].join("\n"));
  if (!quiet.some((t) => t.kind === "named-test-failure")) ok("prose containing FAIL mid-line, and hvigor's prefixed build line, are not read as a named test");
  else fail(`a non-test line was read as a named failure: ${JSON.stringify(quiet)}`);
}
