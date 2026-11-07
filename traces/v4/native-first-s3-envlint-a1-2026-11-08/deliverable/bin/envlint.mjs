#!/usr/bin/env node
// envlint --schema <schema.json> <envfile>
// Contract: shapeup/envlint/spec/contracts/envlint.contract.md
import { readFileSync } from "node:fs";
import { parse } from "../src/parse.mjs";
import { check } from "../src/rules.mjs";

const USAGE = "envlint: usage: envlint --schema <schema.json> <envfile>";
const TYPES = ["string", "int", "bool", "url"];

function fail(message) {
  process.stderr.write(message + "\n");
  process.exit(2);
}

function parseArgs(argv) {
  let schemaPath = null;
  let envPath = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--schema") {
      if (schemaPath !== null || i + 1 >= argv.length) return null;
      schemaPath = argv[++i];
    } else if (a.startsWith("-") || envPath !== null) {
      return null;
    } else {
      envPath = a;
    }
  }
  return schemaPath === null || envPath === null ? null : { schemaPath, envPath };
}

function validateSchema(schema) {
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) return "schema must be an object";
  for (const [key, rule] of Object.entries(schema)) {
    if (rule === null || typeof rule !== "object" || Array.isArray(rule)) return `rule for ${key} must be an object`;
    if ("required" in rule && typeof rule.required !== "boolean") return `required for ${key} must be a boolean`;
    if ("type" in rule && !TYPES.includes(rule.type)) return `unknown type for ${key}`;
    if ("enum" in rule && !(Array.isArray(rule.enum) && rule.enum.every((e) => typeof e === "string"))) {
      return `enum for ${key} must be a list of strings`;
    }
  }
  return null;
}

const args = parseArgs(process.argv.slice(2));
if (!args) fail(USAGE);
const { schemaPath, envPath } = args;

let text;
try {
  text = readFileSync(envPath, "utf8");
} catch (e) {
  fail(`envlint: cannot read env file ${envPath}: ${e.code || e.message}`);
}

let schema;
try {
  schema = JSON.parse(readFileSync(schemaPath, "utf8"));
} catch (e) {
  fail(`envlint: cannot read schema ${schemaPath}: ${e.code || e.message}`);
}
const bad = validateSchema(schema);
if (bad) fail(`envlint: cannot read schema ${schemaPath}: ${bad}`);

const { pairs, problems } = parse(text);
const findings = check(pairs, schema);

const located = [
  ...problems.map((p) => ({ line: p.line, text: `${envPath}:${p.line}: ${p.message}` })),
  ...findings
    .filter((f) => f.line !== null)
    .map((f) => ({ line: f.line, text: `${envPath}:${f.line}: ${f.key}: ${f.message}` })),
].sort((a, b) => a.line - b.line);
const unlocated = findings
  .filter((f) => f.line === null)
  .map((f) => ({ text: `${envPath}: ${f.key}: ${f.message}` }));

const lines = [...located, ...unlocated].map((l) => l.text);
if (lines.length) process.stdout.write(lines.join("\n") + "\n");
process.exitCode = lines.length ? 1 : 0;
