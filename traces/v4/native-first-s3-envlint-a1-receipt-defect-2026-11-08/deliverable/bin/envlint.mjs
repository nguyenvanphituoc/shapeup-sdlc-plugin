#!/usr/bin/env node
// envlint CLI: composes parse (src/parse.mjs) and check (src/rules.mjs). See ux-behavior.
import { readFileSync } from "node:fs";
import { parse } from "../src/parse.mjs";
import { check } from "../src/rules.mjs";

const USAGE = "usage: envlint --schema <schema.json> <envfile>";

function fail(msg) {
  process.stderr.write(msg + "\n");
  process.exit(2);
}

const args = process.argv.slice(2);
let schemaPath;
let envPath;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--schema") {
    schemaPath = args[++i];
  } else if (envPath === undefined) {
    envPath = args[i];
  } else {
    fail(USAGE);
  }
}
if (!schemaPath || !envPath) fail(USAGE);

let envText;
try {
  envText = readFileSync(envPath, "utf8");
} catch (e) {
  fail(`envlint: cannot read env file ${envPath}: ${e.code ?? "error"}`);
}

let schema;
try {
  schema = JSON.parse(readFileSync(schemaPath, "utf8"));
} catch (e) {
  fail(`envlint: cannot read schema file ${schemaPath}: ${e instanceof SyntaxError ? "not valid JSON" : (e.code ?? "error")}`);
}
if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
  fail(`envlint: cannot read schema file ${schemaPath}: not a JSON object`);
}

const { pairs, problems } = parse(envText);
const findings = check(pairs, schema);

const withLine = [
  ...problems.map((p) => ({ line: p.line, text: `${envPath}:${p.line}: ${p.message}` })),
  ...findings
    .filter((f) => f.line != null)
    .map((f) => ({ line: f.line, text: `${envPath}:${f.line}: ${f.key}: ${f.message}` })),
].sort((a, b) => a.line - b.line);
const missing = findings
  .filter((f) => f.line == null)
  .map((f) => `${envPath}: ${f.key}: ${f.message}`);

const out = [...withLine.map((x) => x.text), ...missing];
if (out.length > 0) {
  process.stdout.write(out.join("\n") + "\n");
  process.exitCode = 1;
}
