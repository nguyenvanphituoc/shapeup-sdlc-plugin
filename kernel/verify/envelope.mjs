// envelope — Shape Up's envelope gate: the shipped schemas directory, the WorkOrder schema and the
// words the dispatch gate denies with, handed to the validator in `../core/envelope.mjs`.
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as core from "../core/envelope.mjs";
import * as hook from "../shapeup/hook.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMAS_DIR = resolve(HERE, "../schemas");

const PROFILE = {
  schemasDir: SCHEMAS_DIR,
  orderSchema: "work-order.schema.json",
  hook,
  messages: {
    missing: (p) => `WorkOrder gate — order file not found: ${p}. Write the order first (resources/orders.md in the building skill) — a worker must never be dispatched against a dangling order.`,
    invalid: (p, errors) => `WorkOrder gate — ${p} fails schema validation: ${errors.slice(0, 5).join("; ")}. A malformed order never reaches a worker; fix the order (or harness compile) and re-dispatch.`,
    unreadable: (p, why) => `WorkOrder gate — ${p} is not readable JSON (${why}).`,
  },
};

export const ARGV_SPEC = core.ARGV_SPEC;
/** Validate a value against the schema subset the envelope schemas use; siblings resolve from the shipped schemas. */
export const validate = (data, schema, schemaDir = SCHEMAS_DIR) => core.validate(data, schema, schemaDir, SCHEMAS_DIR);
export const validateFile = (envelopePath, schemaPath) => core.validateFile(envelopePath, schemaPath, SCHEMAS_DIR);
/** Validate an envelope against its schema, or run as the PreToolUse gate when given no args. */
export const cli = (rawArgv) => core.cli(rawArgv, PROFILE);
