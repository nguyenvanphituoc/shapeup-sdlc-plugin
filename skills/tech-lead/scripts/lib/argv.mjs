// parseArgs — the typed argv boundary.
//
// WHY THIS FILE EXISTS (measured by executing the shipped scripts, not theorized).
//
// This project's envelope boundary is rigorously typed: 38 `$defs` in `domain.schema.json`,
// both directions validated, and a `PreToolUse` hook that DENIES a malformed WorkOrder before a
// worker ever sees it. That discipline stopped dead at `process.argv` — which is where the
// pipeline actually executes.
//
// The reproduced defect. `t0-verify.mjs` parsed its own flags with
//
//     if (a === "--round") out.round = Number(argv[++i]);      // then: args.round ?? 1
//
// `Number(undefined)` is `NaN`, and `??` does not catch `NaN`. So passing a flag WITHOUT a value
// wrote a real verdict artifact to `t0/verdicts/rNaN-a1.json` and **exited 0**:
//
//     $ t0-verify.mjs contract.json --round --attempt 1
//     { "path": "t0/verdicts/rNaN-a1.json", "overall": "green", ... }   exit=0
//
// The orchestrator then looks for `r1-a1.json`, finds nothing, and the evaluator's MANDATORY T0
// citation cannot resolve — on the single artifact the judge is structurally required to cite.
// A green verdict at an address nobody will look up is the same failure class as a silent no-op:
// indistinguishable from working.
//
// THE CONTRACT, mirroring `validate-envelope`'s: reject BEFORE anything runs, exit 2, and put a
// machine-readable reason on stderr. Nothing here touches the filesystem, so a rejected parse
// cannot leave a half-written artifact behind.
//
//     const SPEC = {
//       _:           { arity: 1, name: "scope-contract.json" },
//       round:       { type: "int", min: 1, required: true },
//       "no-seesaw": { type: "flag" },
//     };
//     const args = runArgs(SPEC, process.argv.slice(2));   // args.round, args.noSeesaw, args._
//
// Flag names reach the caller camelCased (`--no-seesaw` → `noSeesaw`), so adoption does not
// rewrite call sites. Unknown flags are rejected rather than silently swallowed as positionals:
// a typo'd `--rounds 2` that lands in `_` is the same defect wearing a different hat.
//
// `tests/structural/13-argv-contract.mjs` executes every entry point with each declared int flag
// both empty and non-numeric, and asserts exit 2 with a parseable reason and no artifact on disk.

/** Thrown by {@link parseArgs} when argv does not satisfy the spec. `detail` is the wire shape. */
export class ArgvError extends Error {
  /**
   * @param {object} detail - Machine-readable rejection record; `detail.error` names the class.
   */
  constructor(detail) {
    super(detail.error);
    this.name = "ArgvError";
    this.detail = detail;
  }
}

/** `--seesaw-registry` → `seesawRegistry`. */
function camel(name) {
  return name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/** Human-readable expectation for one flag, used in the rejection record. */
function expectation(def) {
  switch (def.type) {
    case "int":
      if (def.min !== undefined && def.max !== undefined) return `int in [${def.min}, ${def.max}]`;
      if (def.min !== undefined) return `int ≥ ${def.min}`;
      if (def.max !== undefined) return `int ≤ ${def.max}`;
      return "int";
    case "num":
      return def.min !== undefined ? `number ≥ ${def.min}` : "number";
    case "enum": return `one of ${(def.values || []).join(" | ")}`;
    case "json": return "JSON";
    case "path": return "path";
    case "flag": return "no value";
    default: return "string";
  }
}

/**
 * Coerce and range-check one raw flag value.
 * @param {string} flagName - Flag name without dashes (for the rejection record).
 * @param {object} def - The spec entry.
 * @param {string} raw - The token following the flag.
 * @returns {(string|number|object)} The coerced value.
 * @throws {ArgvError} `invalid_value` when the token does not satisfy `def`.
 */
function coerce(flagName, def, raw) {
  const bad = () => {
    throw new ArgvError({ error: "invalid_value", flag: `--${flagName}`, got: raw, expected: expectation(def) });
  };
  switch (def.type) {
    case "int": {
      // Deliberately stricter than Number(): "1.5", "1e3", " 1 " and "0x2" are all rejected, so a
      // round number is a round number on every platform rather than whatever the coercion did.
      if (!/^-?\d+$/.test(raw)) bad();
      const n = Number(raw);
      if (!Number.isSafeInteger(n)) bad();
      if (def.min !== undefined && n < def.min) bad();
      if (def.max !== undefined && n > def.max) bad();
      return n;
    }
    case "num": {
      const n = Number(raw);
      if (raw.trim() === "" || !Number.isFinite(n)) bad();
      if (def.min !== undefined && n < def.min) bad();
      if (def.max !== undefined && n > def.max) bad();
      return n;
    }
    case "enum":
      if (!(def.values || []).includes(raw)) bad();
      return raw;
    case "json":
      try { return JSON.parse(raw); } catch { bad(); }
      return undefined; // unreachable — bad() throws
    case "path":
    case "str":
    default:
      if (raw === "") bad();
      return raw;
  }
}

/**
 * Parse argv against a declarative spec.
 *
 * Spec entries are keyed by flag name (no dashes). `_` declares positionals:
 * `{ arity, max, name }` — `arity` is the minimum required count.
 * Every other entry is `{ type, min, max, values, required, default, multiple }` where `type` is
 * one of `int | num | str | path | enum | json | flag`.
 *
 * @param {Object<string,object>} spec - The flag spec (see above).
 * @param {string[]} argv - Arguments after the script name (`process.argv.slice(2)`).
 * @returns {Object<string,*>} Coerced values keyed by camelCased flag name, plus `_` (positionals).
 * @throws {ArgvError} On an unknown flag, a missing value, a value that fails its type/range, a
 *   missing required flag, or too few/many positionals. Nothing is read or written before throwing.
 */
export function parseArgs(spec, argv) {
  const positional = spec._ || { arity: 0 };
  const out = { _: [] };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--") { out._.push(...argv.slice(i + 1)); break; }
    if (!token.startsWith("--")) { out._.push(token); continue; }

    // `--flag=value` and `--flag value` are the same thing to the caller.
    const eq = token.indexOf("=");
    const name = (eq === -1 ? token.slice(2) : token.slice(2, eq));
    const inlineValue = eq === -1 ? null : token.slice(eq + 1);
    const def = Object.hasOwn(spec, name) && name !== "_" ? spec[name] : null;
    if (!def) throw new ArgvError({ error: "unknown_flag", flag: `--${name}` });

    if (def.type === "flag") {
      if (inlineValue !== null) {
        throw new ArgvError({ error: "invalid_value", flag: `--${name}`, got: inlineValue, expected: "no value" });
      }
      out[camel(name)] = true;
      continue;
    }

    let raw = inlineValue;
    if (raw === null) {
      const next = argv[i + 1];
      // The reproduced defect, verbatim: `--round --attempt 1` consumed `--attempt` as the value
      // of `--round` (or, with Number(), consumed nothing and produced NaN). Both are rejections.
      if (next === undefined) {
        throw new ArgvError({ error: "missing_value", flag: `--${name}`, expected: expectation(def) });
      }
      if (next.startsWith("--")) {
        throw new ArgvError({ error: "invalid_flag", flag: `--${name}`, got: next, expected: expectation(def) });
      }
      raw = next;
      i++;
    }

    const value = coerce(name, def, raw);
    if (def.multiple) (out[camel(name)] ||= []).push(value);
    else out[camel(name)] = value;
  }

  for (const [name, def] of Object.entries(spec)) {
    if (name === "_" || def.type === "flag") continue;
    const key = camel(name);
    if (out[key] === undefined && def.default !== undefined) out[key] = def.default;
    if (out[key] === undefined && def.required) {
      throw new ArgvError({ error: "missing_required", flag: `--${name}`, expected: expectation(def) });
    }
  }

  if (out._.length < (positional.arity || 0)) {
    throw new ArgvError({
      error: "missing_operand", expected: positional.name || "operand",
      need: positional.arity || 0, got: out._.length,
    });
  }
  if (positional.max !== undefined && out._.length > positional.max) {
    throw new ArgvError({
      error: "unexpected_operand", expected: positional.name || "operand",
      max: positional.max, got: out._.length,
    });
  }
  return out;
}

/**
 * CLI wrapper for {@link parseArgs}: on rejection, print the record to stderr and exit 2.
 *
 * Exit 2 is this project's established "the input was malformed, nothing ran" code — the same one
 * `validate-envelope` uses for a WorkOrder that fails its schema. It is deliberately NOT 1, which
 * every oracle here uses to mean "ran, and the answer is no".
 *
 * @param {Object<string,object>} spec - The flag spec.
 * @param {string[]} [argv=process.argv.slice(2)] - Arguments after the script name.
 * @returns {Object<string,*>} The parsed args (see {@link parseArgs}). Does not return on failure.
 */
export function runArgs(spec, argv = process.argv.slice(2)) {
  try {
    return parseArgs(spec, argv);
  } catch (e) {
    if (!(e instanceof ArgvError)) throw e;
    process.stderr.write(JSON.stringify(e.detail) + "\n");
    if (spec.usage) process.stderr.write(`usage: ${spec.usage}\n`);
    process.exit(2);
  }
}
