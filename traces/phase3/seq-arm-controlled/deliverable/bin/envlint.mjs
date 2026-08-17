#!/usr/bin/env node
// CLI composition root — argv parsing, reading the two input files, wiring
// parseEnv -> evaluate, rendering (human/--json), setting the exit code.
// Never redefines parsing/rules logic — both live in src/parsing.mjs and
// src/rules.mjs (TASK-001/TASK-002); this file only wires and renders.

import { readFileSync } from 'node:fs';
import { parseEnv } from '../src/parsing.mjs';
import { evaluate } from '../src/rules.mjs';

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 2;
}

function parseArgs(argv) {
  let schemaPath = null;
  let json = false;
  let envPath = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--schema') {
      schemaPath = argv[i + 1];
      i++;
    } else if (arg === '--json') {
      json = true;
    } else if (envPath === null) {
      envPath = arg;
    }
  }

  return { schemaPath, json, envPath };
}

function main(argv) {
  const { schemaPath, json, envPath } = parseArgs(argv);

  if (!schemaPath) {
    fail('missing required --schema <schema.json>');
    return;
  }

  let schemaText;
  try {
    schemaText = readFileSync(schemaPath, 'utf8');
  } catch {
    fail(`cannot read schema file: ${schemaPath}`);
    return;
  }

  let schema;
  try {
    schema = JSON.parse(schemaText);
  } catch {
    fail(`schema is not valid JSON: ${schemaPath}`);
    return;
  }

  let envText;
  try {
    envText = readFileSync(envPath, 'utf8');
  } catch {
    fail(`cannot read env file: ${envPath}`);
    return;
  }

  const checked = Object.keys(schema).length;
  const { pairs, problems } = parseEnv(envText);
  const findings = evaluate(pairs, problems, schema);
  const ok = findings.length === 0;

  if (json) {
    process.stdout.write(`${JSON.stringify({ ok, findings, checked })}\n`);
    process.exitCode = ok ? 0 : 1;
    return;
  }

  if (ok) {
    process.stdout.write(`ok: ${checked} keys checked\n`);
    process.exitCode = 0;
    return;
  }

  for (const finding of findings) {
    process.stdout.write(`${envPath}:${finding.line}: ${finding.key}: ${finding.message}\n`);
  }
  process.stdout.write(`${findings.length} problem(s)\n`);
  process.exitCode = 1;
}

main(process.argv.slice(2));
