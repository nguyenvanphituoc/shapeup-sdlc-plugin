#!/usr/bin/env node
// Envelope schema gate (pure-skill architecture v1.0, plan P0).
//
// The lesson already in the repo: structured artifacts + deterministic tooling beat prose
// conventions (t0-verify.mjs is the most reliable component in the harness). This script makes
// the WorkOrder/WorkResult ports mechanically checkable: a malformed order never reaches a
// worker, a malformed result never reaches ingest.
//
// Zero dependencies, zero network — same discipline as the oracles and gate-l2.mjs. Implements
// the JSON-Schema subset the shipped schemas use (type, required, properties, items, enum,
// pattern, $ref) rather than pulling in a validator dependency. $ref supports two forms:
//   #/$defs/Name                       — a definition in the SAME schema document
//   domain.schema.json#/$defs/Name     — a definition in a SIBLING file (the central domain
//                                        registry; resolved against the schema's own dir,
//                                        falling back to skills/tech-lead/schemas/)
//
// Usage (CLI):    node skills/tech-lead/scripts/validate-envelope.mjs <envelope.json> <schema.json>
//                 exit 0 = valid, 1 = invalid (errors printed one per line)
// Usage (hook):   PreToolUse on Skill|Agent — when the tool input carries `--order <path>`,
//                 the order file is validated against schemas/work-order.schema.json; an
//                 invalid or missing order DENIES the dispatch (fail-closed on a malformed
//                 order, fail-open when no --order is present — standalone runs stay free).

import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { runArgs } from "./lib/argv.mjs";
import { runHook, readStdin, settle } from "../../../hooks/lib/decision.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMAS_DIR = resolve(HERE, "../schemas");

/**
 * Validate a value against the JSON-Schema subset the envelope schemas use (type, required,
 * properties, items, enum, pattern, anyOf, $ref).
 * @param {*} data - The value to validate.
 * @param {object} schema - The (sub)schema to validate against; may itself be a bare `{$ref}`.
 * @param {string} [schemaDir=SCHEMAS_DIR] - Directory cross-file $refs (e.g.
 *   "domain.schema.json#/$defs/X") resolve from; defaults to the shipped schemas dir so in-memory
 *   schemas keep working.
 * @returns {{valid:boolean, errors:string[]}} valid=true with [] when data conforms; otherwise
 *   valid=false and one "`<path>: <message>`" string per violation.
 */
export function validate(data, schema, schemaDir = SCHEMAS_DIR) {
  const errors = [];
  walk(data, schema, "$", errors, { doc: schema, dir: schemaDir }, 0);
  return { valid: errors.length === 0, errors };
}

// --- $ref resolution ---------------------------------------------------------
// ctx = { doc, dir }: the schema DOCUMENT the current subschema belongs to (same-doc
// `#/...` pointers resolve inside it) and the directory sibling files load from.
const REF_DOC_CACHE = new Map();
/**
 * Load and cache a sibling schema document for a cross-file $ref.
 * @param {string} file - Schema filename referenced by the $ref (e.g. "domain.schema.json").
 * @param {string} dir - Primary directory to look in (falls back to the shipped schemas dir).
 * @param {string} path - Current data path, for error messages.
 * @param {string[]} errors - Error accumulator, appended to on a missing/unparseable file.
 * @returns {{doc:object, dir:string}|null} The parsed document and its directory (cached), or null
 *   when the file is absent or not readable JSON (an error is pushed in that case).
 */
function loadRefDoc(file, dir, path, errors) {
  for (const base of [dir, SCHEMAS_DIR]) {
    const abs = resolve(base, file);
    if (REF_DOC_CACHE.has(abs)) return REF_DOC_CACHE.get(abs);
    if (existsSync(abs)) {
      try {
        const entry = { doc: JSON.parse(readFileSync(abs, "utf8")), dir: dirname(abs) };
        REF_DOC_CACHE.set(abs, entry);
        return entry;
      } catch (e) {
        errors.push(`${path}: $ref file ${file} is not readable JSON (${e.message})`);
        return null;
      }
    }
  }
  errors.push(`${path}: $ref file not found: ${file}`);
  return null;
}

/**
 * Resolve a `$ref` (same-doc `#/…` or `file#/…`) to its target subschema.
 * @param {string} ref - The $ref string.
 * @param {{doc:object, dir:string}} ctx - The document the ref belongs to and the dir siblings load from.
 * @param {string} path - Current data path, for error messages.
 * @param {string[]} errors - Error accumulator, appended to when the ref resolves to nothing.
 * @returns {{schema:object, ctx:{doc:object,dir:string}}|null} The target subschema and the context
 *   it lives in (so nested refs resolve correctly), or null on an unresolved ref.
 */
function resolveRef(ref, ctx, path, errors) {
  const [file, pointer = ""] = ref.split("#");
  const target = file ? loadRefDoc(file, ctx.dir, path, errors) : ctx;
  if (!target) return null;
  let node = target.doc;
  for (const seg of pointer.split("/").filter(Boolean)) {
    node = node && typeof node === "object" ? node[seg.replace(/~1/g, "/").replace(/~0/g, "~")] : undefined;
  }
  if (!node || typeof node !== "object") {
    errors.push(`${path}: $ref "${ref}" resolves to nothing`);
    return null;
  }
  return { schema: node, ctx: target };
}

/**
 * Classify a value using JSON-Schema type names.
 * @param {*} v - Any value.
 * @returns {("array"|"null"|"integer"|"number"|"object"|"string"|"boolean"|"undefined"|"function")}
 *   The schema-type name; integral numbers report "integer", non-integral "number".
 */
function typeOf(v) {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

/**
 * Recursively check `data` against `schema`, pushing one message per violation (the validation core).
 * @param {*} data - The value (sub)tree being checked.
 * @param {object} schema - The (sub)schema to apply.
 * @param {string} path - JSON-path label for messages (e.g. "$.payload.tasks[0]").
 * @param {string[]} errors - Error accumulator, appended to in place.
 * @param {{doc:object, dir:string}} ctx - Schema document + directory for $ref resolution.
 * @param {number} refDepth - Current $ref chain depth; a chain deeper than 16 is reported as a cycle.
 * @returns {void} Nothing; violations are recorded on `errors`.
 */
function walk(data, schema, path, errors, ctx, refDepth) {
  if (!schema || typeof schema !== "object") return;
  if (schema.$ref) {
    if (refDepth > 16) { errors.push(`${path}: $ref chain too deep (cycle?) at "${schema.$ref}"`); return; }
    const resolved = resolveRef(schema.$ref, ctx, path, errors);
    if (resolved) walk(data, resolved.schema, path, errors, resolved.ctx, refDepth + 1);
    return; // $ref replaces the subschema (draft 2020-12 sibling keywords not used here)
  }
  if (Array.isArray(schema.anyOf)) {
    // Additive-union support (spine v1.3: acceptance_criteria = string | {text, covers?}).
    // Valid iff ≥1 branch validates with zero errors; each branch is tried against a throwaway
    // error collection so a failing branch never leaks into the report.
    const matched = schema.anyOf.some((sub) => {
      const branchErrors = [];
      walk(data, sub, path, branchErrors, ctx, refDepth);
      return branchErrors.length === 0;
    });
    if (!matched) errors.push(`${path}: ${JSON.stringify(data)} matches none of the ${schema.anyOf.length} allowed shapes (anyOf)`);
    return; // anyOf is terminal here (no sibling keywords combined with it in the shipped schemas)
  }
  if (schema.type) {
    const t = typeOf(data);
    // `type` may be a single name or a JSON-Schema union (`["integer", "null"]`). A nullable
    // field is a real thing in this registry — `T0Score.db_probe` is null when no probe is
    // DECLARED, which is an absence and never a failure — and a validator that cannot express it
    // would force every such field to be written in a shape it can only pretend to check.
    const accepted = Array.isArray(schema.type) ? schema.type : [schema.type];
    const okType = accepted.some((want) => (want === "number" ? t === "number" || t === "integer" : t === want));
    if (!okType) {
      errors.push(`${path}: expected ${accepted.join("|")}, got ${t}`);
      return; // deeper checks are meaningless on the wrong type
    }
  }
  if (schema.enum && !schema.enum.some((v) => v === data)) {
    errors.push(`${path}: value ${JSON.stringify(data)} not in enum [${schema.enum.join(", ")}]`);
  }
  if (schema.pattern && typeof data === "string" && !new RegExp(schema.pattern).test(data)) {
    errors.push(`${path}: "${data}" does not match pattern ${schema.pattern}`);
  }
  if (typeOf(data) === "object") {
    for (const req of schema.required || []) {
      if (!(req in data)) errors.push(`${path}: missing required field "${req}"`);
    }
    for (const [key, sub] of Object.entries(schema.properties || {})) {
      if (key in data) walk(data[key], sub, `${path}.${key}`, errors, ctx, 0);
    }
  }
  if (typeOf(data) === "array" && schema.items) {
    data.forEach((item, i) => walk(item, schema.items, `${path}[${i}]`, errors, ctx, 0));
  }
}

/**
 * Load an envelope file and a schema file from disk and validate one against the other.
 * @param {string} envelopePath - Path to the JSON envelope.
 * @param {string} schemaPath - Path to the JSON schema; cross-file $refs resolve from its own dir.
 * @returns {{valid:boolean, errors:string[]}} Same shape as {@link validate}.
 * @throws {SyntaxError} If either file is not valid JSON.
 * @throws {Error} If either file is not readable.
 */
export function validateFile(envelopePath, schemaPath) {
  const data = JSON.parse(readFileSync(envelopePath, "utf8"));
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  return validate(data, schema, dirname(resolve(schemaPath)));
}

// ---------------------------------------------------------------------------
// Entry point: CLI when args are given, PreToolUse hook when fed stdin JSON.
// ---------------------------------------------------------------------------
/**
 * The typed argv contract (see `./lib/argv.mjs`) — CLI mode only. In hook mode argv is empty and
 * the envelope arrives on stdin, so nothing here is consulted.
 */
export const ARGV_SPEC = {
  usage: "validate-envelope.mjs <envelope.json> <schema.json>   (no args → PreToolUse hook mode)",
  _: { arity: 2, max: 2, name: "<envelope.json> <schema.json>" },
};

const isMainModule = isMain(import.meta.url);
if (isMainModule) {
  if (process.argv[2]) {
    // CLI mode
    const [envelopePath, schemaPath] = runArgs(ARGV_SPEC)._;
    try {
      const { valid, errors } = validateFile(resolve(envelopePath), resolve(schemaPath));
      if (valid) {
        console.log(`✅ ${envelopePath} is a valid ${JSON.parse(readFileSync(resolve(schemaPath), "utf8")).title || "envelope"}`);
        process.exit(0);
      }
      for (const e of errors) console.error(`  ✗ ${e}`);
      process.exit(1);
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
      process.exit(1);
    }
  } else {
    // Hook mode (PreToolUse). Deny contract identical to gate-l2.mjs, and — since v1.5 — the same
    // receipt: `allow` carries evidence, so "validated the order and permitted it" is no longer
    // byte-identical to "this hook never ran" (hooks/lib/decision.mjs).
    await runHook("validate-envelope", async () => {
      /**
       * Fail-open with the reason on the record: the tool call proceeds, gating nothing.
       * @param {string} reason - Why this dispatch was not gated.
       * @param {string} [rule] - Which fail-open condition matched.
       * @returns {never} Does not return — settles the hook.
       */
      const defer = (reason, rule) => settle({
        verdict: "allow", event: "PreToolUse", tool: p?.tool_name ?? null, cwd: p?.cwd, reason, rule,
      });
      const raw = await readStdin();
      let p;
      try { p = JSON.parse(raw || "{}"); }
      catch (e) { settle({ verdict: "error", event: "PreToolUse", reason: `unparseable payload: ${e.message}` }); }
      if (p.tool_name !== "Skill" && p.tool_name !== "Agent") {
        defer(`${p.tool_name ?? "no tool_name"} is not a dispatch tool — out of scope`);
      }
      const haystack = [p.tool_input?.skill_args, p.tool_input?.args, p.tool_input?.prompt]
        .filter(Boolean).join(" ");
      const m = haystack.match(/--order(?:\s+|=)(?:"([^"]+)"|'([^']+)'|(\S+))/);
      // no order threaded → not an orchestrated dispatch, nothing to gate
      if (!m) defer("no --order threaded — not an orchestrated dispatch", "no-order");
      const orderPath = resolve(p.cwd || process.cwd(), m[1] || m[2] || m[3]);
      /**
       * Emit a PreToolUse deny decision for the dispatch.
       * @param {string} reason - Human-readable explanation surfaced to the caller.
       * @param {string} rule - Which denial rule fired.
       * @returns {never} Does not return — settles the hook with the deny payload.
       */
      const deny = (reason, rule) => settle({
        verdict: "deny", event: "PreToolUse", tool: p.tool_name, cwd: p.cwd, subject: orderPath, rule, reason,
        payload: {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: reason,
          },
        },
      });
      if (!existsSync(orderPath)) {
        deny(`WorkOrder gate — order file not found: ${orderPath}. Compile it first (compile-order.mjs) — a worker must never be dispatched against a dangling order.`, "order-missing");
      }
      try {
        const { valid, errors } = validateFile(orderPath, join(SCHEMAS_DIR, "work-order.schema.json"));
        if (!valid) {
          deny(`WorkOrder gate — ${orderPath} fails schema validation: ${errors.slice(0, 5).join("; ")}. A malformed order never reaches a worker; fix the order (or compile-order.mjs) and re-dispatch.`, "schema-invalid");
        }
      } catch (e) {
        if (e?.name === "HookDecision") throw e;
        deny(`WorkOrder gate — ${orderPath} is not readable JSON (${e.message}).`, "order-unreadable");
      }
      defer(`order validated against work-order.schema.json — permitted`, "order-valid");
    });
  }
}
