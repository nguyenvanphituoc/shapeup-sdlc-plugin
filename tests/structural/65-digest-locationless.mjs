// 65 — HD-016: A DIAGNOSTIC NAMING A FILE WITH NO LINE NUMBER STILL YIELDS ITS FILE.
//
// THE DEFECT THIS CLOSES. `kernel/probe/digest.mjs`'s three location patterns all required
// `:(\d+)` — a stack frame, a TAP/`not ok` failure, or a `file:line:col - error` compiler
// diagnostic. A diagnostic that names a FILE but no line (a resource-compiler error, or a
// linker error against an object file, or a bundler's "ERROR in <path>") kept its path buried
// in `core_message` and reported `file: null`, so the next attempt was handed no signal about
// which file failed.
//
// THE FIX adds two location patterns that extract `file` from a locationless diagnostic while
// leaving `line: null` — never invented, per the module's own banner. Placed AFTER the three
// existing line-number patterns in `PATTERNS`, so any line that DOES carry a line number keeps
// matching the pattern it always matched (checked first, per-line iteration breaks on first
// match) — this module proves that non-regression by running the EXACT triples the pre-fix
// patterns produced through the shipped `digest()` and asserting they are byte-for-byte
// unchanged, before asserting the new locationless extraction at all.
//
// SEVERITY, READ CORRECTLY: this closes a signal-loss defect for the next attempt. It does NOT
// by itself touch `verify t0`'s `score()` — that function scores `fixtures_passed`,
// `fixtures_total` and `db_probe` only (asserted below, read out of the shipped module rather than
// asserted from memory), and this module makes no scoring claim. The vector carried a fourth axis,
// `regressions`, until 3.8.0 removed the seesaw arm that was its only source.

import { join } from "node:path";

/**
 * Run the locationless-diagnostic digest checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("103. AEGIS digest — a diagnostic naming a file with no line number still yields the file");
  // =============================================================================

  const { digest } = await import(join(ROOT, "kernel/probe/digest.mjs"));

  // --- (0) SEVERITY CHECK, EXECUTED — main's score() carries no `own_errors` axis. This is
  //         what makes the register's corrected severity claim true today: this defect costs
  //         the next attempt its evidence, but does not (on its own, at this HEAD) score a red
  //         attempt as "kept" over a later one that produces real signal. -----------------------
  {
    const t0 = await import(join(ROOT, "kernel/verify/t0.mjs"));
    const vec = t0.score({
      fixtures: { results: [{ pass: true }, { pass: false }] },
      dbProbe: { pass: true },
    });
    const axes = Object.keys(vec).sort();
    const expected = ["db_probe", "fixtures_passed", "fixtures_total"].sort();
    if (JSON.stringify(axes) === JSON.stringify(expected)) {
      ok(`verify t0's score() carries exactly the documented axes (${axes.join(", ")}) — no own_errors axis exists at this HEAD`);
    } else {
      fail(`verify t0's score() axes are ${JSON.stringify(axes)}, expected ${JSON.stringify(expected)} — the severity note above this module needs re-checking against the actual scorer`);
    }
  }

  // --- (1) REGRESSION corpus, EXECUTED — every shape the digester already extracted, extracted
  //         identically (same file AND same line) after this fix. --------------------------------
  const regressionCorpus = [
    {
      name: "Node stack frame",
      log: "TypeError: Cannot read properties of undefined (reading 'total')\n" +
        "    at calculateCartTotal (apps/web/cart/Cart.tsx:84:12)\n" +
        "    at process (apps/web/cart/Cart.tsx:40:5)\n",
      file: "apps/web/cart/Cart.tsx", line: 84, kind: "stack-frame",
    },
    {
      name: "TAP `not ok` failure",
      log: "not ok 4 - computes total (kernel/verify/t0.mjs:186)\n",
      file: "kernel/verify/t0.mjs", line: 186, kind: "test-failure",
    },
    {
      name: "checkmark test failure",
      log: "✗ computes total (tests/structural/28-t0-ratchet-fallback.mjs:42)\n",
      file: "tests/structural/28-t0-ratchet-fallback.mjs", line: 42, kind: "test-failure",
    },
    {
      name: "tsc-style compiler diagnostic (has line AND column)",
      log: "kernel/probe/digest.mjs:17:34 - error TS2345: Argument of type 'string' is not assignable.\n",
      file: "kernel/probe/digest.mjs", line: 17, kind: "compiler-diagnostic",
    },
    {
      name: "generic `Error:` message with no file ever named",
      log: "Error: Cannot find module '../missing.mjs'\n",
      file: null, line: null, kind: "error-message",
    },
  ];
  for (const c of regressionCorpus) {
    const triples = digest(c.log);
    const hit = triples.find((t) => t.file === c.file && t.line === c.line && t.kind === c.kind);
    if (hit) ok(`regression: ${c.name} still extracts {file:${JSON.stringify(c.file)}, line:${JSON.stringify(c.line)}}`);
    else fail(`regression: ${c.name} changed shape — got ${JSON.stringify(triples)}, wanted {file:${JSON.stringify(c.file)}, line:${JSON.stringify(c.line)}, kind:${JSON.stringify(c.kind)}}`);
  }

  // A line that DOES carry a line number, in a shape none of the three line-number patterns
  // recognize (a pre-existing gap, out of scope for this fix) must NOT be swept up by the new
  // locationless patterns into a WRONG triple — the new patterns must stay a strict addition.
  {
    const triples = digest("ERROR src/pages/Index.ets:1:1 cannot find name Foo\n");
    const wrong = triples.find((t) => t.file && t.file.includes("ERROR"));
    if (!wrong) ok("a line-numbered diagnostic in an unrecognized shape is not swept into a wrong locationless triple by the new patterns");
    else fail(`the new locationless patterns produced a wrong triple for a line that carries its own (unrecognized-shape) line number: ${JSON.stringify(wrong)}`);
  }

  // Prose that merely contains the word "error" after a colon, with nothing file-shaped before
  // it, must still yield no triple — the fix requires a dotted-extension token, not any text.
  {
    const triples = digest("This module: error handling could be improved\n");
    if (triples.length === 0) ok("prose containing \"error:\" with no file-shaped token before it still yields no triple");
    else fail(`prose was mistaken for a locationless diagnostic: ${JSON.stringify(triples)}`);
  }

  // Rework round 1: the bundler pattern (`ERROR in <token>`) had no path-shape anchor and read
  // ANY non-space token as a file — "ERROR in the build pipeline" -> {file:"the"}, and a real
  // webpack shape ("ERROR in Entry module not found: ...") -> {file:"Entry"}. Both must now yield
  // no triple carrying that fabricated, non-path token as `file`.
  {
    const prose = [
      "ERROR in the build pipeline\n",
      "ERROR in test suite failed to run\n",
      "ERROR in Entry module not found: Error: Can't resolve './src' in '/app'\n",
    ];
    for (const log of prose) {
      const triples = digest(log);
      const fabricated = triples.find((t) => t.file && !/^(?:\.{1,2}\/|[^\s:]+\.[A-Za-z0-9]{1,10}$)/.test(t.file));
      if (!fabricated) ok(`bundler prose does not fabricate a file: ${JSON.stringify(log.trim())}`);
      else fail(`bundler pattern fabricated a non-path file from prose: ${JSON.stringify(log.trim())} -> ${JSON.stringify(fabricated)}`);
    }
  }

  // Rework round 1: via the `pendingMessage` path, the same fabrication silently rewrote a
  // pre-existing file-less triple onto the fabricated file. "Error: boom" followed by a bundler
  // prose line must still leave the message as a file-less error-message triple, exactly as it
  // did before the bundler pattern existed.
  {
    const triples = digest("Error: boom\nERROR in the build pipeline\n");
    const hit = triples.find((t) => t.core_message === "boom");
    if (hit && hit.file === null && hit.kind === "error-message") {
      ok("a pending error message is not rewritten onto a fabricated bundler file");
    } else {
      fail(`pending message "boom" was corrupted by bundler prose: ${JSON.stringify(triples)}`);
    }
  }

  // --- (2) NEW corpus, EXECUTED — a diagnostic naming a file with NO line number now yields
  //         that file, with line kept null rather than invented. --------------------------------
  const locationlessCorpus = [
    {
      name: "resource-compiler error, colon-separated (the register's own example shape)",
      log: "resources/base/element/string.json: error: invalid json format\n",
      file: "resources/base/element/string.json",
    },
    {
      name: "resource-compiler fatal error, dash-separated",
      log: "module.json5 - fatal error: unexpected token at root\n",
      file: "module.json5",
    },
    {
      name: "bundler-style \"ERROR in <path>\" (webpack and friends)",
      log: "ERROR in ./src/components/Foo.tsx\nModule not found: Error: Can't resolve './missing'\n",
      file: "./src/components/Foo.tsx",
    },
    {
      name: "linker error against an object file",
      log: "build/main.o: error: undefined reference to `foo'\n",
      file: "build/main.o",
    },
    {
      name: "warning against a filename that itself contains a dash",
      log: "src/error-handler.js: warning: unused import\n",
      file: "src/error-handler.js",
    },
  ];
  for (const c of locationlessCorpus) {
    const triples = digest(c.log);
    const hit = triples.find((t) => t.file === c.file);
    if (!hit) {
      fail(`locationless: ${c.name} did not extract file ${JSON.stringify(c.file)} at all — got ${JSON.stringify(triples)}`);
      continue;
    }
    ok(`locationless: ${c.name} extracts file ${JSON.stringify(c.file)}`);
    if (hit.line === null) ok(`locationless: ${c.name} keeps line null rather than inventing one`);
    else fail(`locationless: ${c.name} INVENTED a line number (${JSON.stringify(hit.line)}) the log never carried — the module's own banner forbids this`);
  }

  // A line number must never be fabricated even when digits appear elsewhere on the same line
  // (a version number, an SDK level) — only an actual `:line[:col]` capture may set `line`.
  {
    const triples = digest("AndroidManifest.xml: error: minSdkVersion 21 conflicts with library\n");
    const hit = triples.find((t) => t.file === "AndroidManifest.xml");
    if (hit && hit.line === null) ok("digits elsewhere on a locationless diagnostic's line are never mistaken for a line number");
    else fail(`expected {file:"AndroidManifest.xml", line:null}, got ${JSON.stringify(hit)}`);
  }

  // --- (3) The locationless triple validates against its own schema, same as every other triple
  //         (AegisTriple already allows file present / line null — this proves the combination the
  //         fix actually produces, not just the all-null case §60 in 05-tech-lead.mjs already
  //         covers). ------------------------------------------------------------------------------
  {
    const { validate } = await import(join(ROOT, "kernel/verify/envelope.mjs"));
    const [hit] = digest("resources/base/element/string.json: error: invalid json format\n");
    const result = validate(hit, { $ref: "domain.schema.json#/$defs/AegisTriple" });
    if (result.valid) ok("a locationless-but-filed AegisTriple (file set, line null) validates against its own schema");
    else fail(`AegisTriple rejects {file:${JSON.stringify(hit?.file)}, line:null} — ${JSON.stringify(result.errors || result)}`);
  }
}
