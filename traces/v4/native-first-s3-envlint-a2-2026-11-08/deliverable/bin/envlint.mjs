#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { parseEnv } from "../src/parse.mjs";
import { checkRules } from "../src/rules.mjs";

const USAGE = "usage: envlint --schema <schema.json> <envfile>";

function fail(message, withUsage = false) {
  process.stderr.write(`envlint: ${message}\n${withUsage ? USAGE + "\n" : ""}`);
  process.exitCode = 2;
}

function main() {
  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: { schema: { type: "string" } },
      allowPositionals: true,
      strict: true,
    }));
  } catch (e) {
    return fail(e.message, true);
  }
  if (values.schema === undefined) return fail("missing --schema", true);
  if (positionals.length !== 1) return fail("expected exactly one env file", true);
  const schemaPath = values.schema;
  const envPath = positionals[0];

  let text;
  try {
    text = readFileSync(envPath, "utf8");
  } catch {
    return fail(`cannot read env file ${envPath}`);
  }
  let raw;
  try {
    raw = readFileSync(schemaPath, "utf8");
  } catch {
    return fail(`invalid schema ${schemaPath}: cannot read file`);
  }
  let schema;
  try {
    schema = JSON.parse(raw);
  } catch (e) {
    return fail(`invalid schema ${schemaPath}: ${e.message}`);
  }

  const { pairs, problems } = parseEnv(text);
  const { findings, schemaErrors } = checkRules(pairs, schema);
  if (schemaErrors.length > 0) {
    return fail(`invalid schema ${schemaPath}: ${schemaErrors.join("; ")}`);
  }

  const rows = [];
  for (const p of problems) {
    rows.push({ line: p.line, order: 0, text: `${envPath}:${p.line}: ${p.message}` });
  }
  for (const f of findings) {
    rows.push(
      f.line === null || f.line === undefined
        ? { line: Infinity, order: 1, text: `${envPath}: ${f.key}: ${f.message}` }
        : { line: f.line, order: 1, text: `${envPath}:${f.line}: ${f.key}: ${f.message}` },
    );
  }
  rows.sort((a, b) => (a.line === b.line ? a.order - b.order : a.line < b.line ? -1 : 1));
  if (rows.length > 0) {
    process.stdout.write(rows.map((r) => r.text).join("\n") + "\n");
    process.exitCode = 1;
  }
}

try {
  main();
} catch (e) {
  process.stderr.write(`envlint: internal error: ${e && e.message}\n`);
  process.exitCode = 2;
}
