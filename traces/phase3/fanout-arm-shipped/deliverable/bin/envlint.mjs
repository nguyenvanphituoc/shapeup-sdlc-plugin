#!/usr/bin/env node
// CLI composition root: argv -> parseEnv -> evaluate -> render + exit code.
// No parsing/rule logic lives here — this file only wires and renders.

import { readFileSync } from 'node:fs';
import { parseEnv } from '../src/parsing.mjs';
import { evaluate } from '../src/rules.mjs';

function fail(message, code = 2) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = code;
}

function parseArgv(argv) {
  let schemaPath;
  let json = false;
  const positionals = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--schema') {
      schemaPath = argv[++i];
    } else if (arg === '--json') {
      json = true;
    } else {
      positionals.push(arg);
    }
  }

  return { schemaPath, envPath: positionals[0], json };
}

function main(argv) {
  const { schemaPath, envPath, json } = parseArgv(argv);

  if (!schemaPath) {
    fail('--schema is required');
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

  if (!envPath) {
    fail(`cannot read env file: ${envPath}`);
    return;
  }

  let envText;
  try {
    envText = readFileSync(envPath, 'utf8');
  } catch {
    fail(`cannot read env file: ${envPath}`);
    return;
  }

  const { pairs, problems } = parseEnv(envText);
  const findings = evaluate(pairs, problems, schema);
  const checked = Object.keys(schema).length;
  const report = { ok: findings.length === 0, findings, checked };

  if (json) {
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } else if (report.ok) {
    process.stdout.write(`ok: ${checked} keys checked\n`);
  } else {
    for (const finding of findings) {
      process.stdout.write(`${envPath}:${finding.line}: ${finding.key}: ${finding.message}\n`);
    }
    process.stdout.write(`${findings.length} problem(s)\n`);
  }

  process.exitCode = report.ok ? 0 : 1;
}

main(process.argv.slice(2));
