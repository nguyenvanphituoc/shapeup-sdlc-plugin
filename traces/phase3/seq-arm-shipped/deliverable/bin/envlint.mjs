#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseEnv } from '../lib/parse.mjs';
import { checkRules } from '../lib/rules.mjs';

function truncate(text, max) {
  return text.length > max ? text.slice(0, max) : text;
}

function parseArgv(argv) {
  let schemaPath;
  let json = false;
  let envfile;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--schema') {
      i += 1;
      schemaPath = argv[i];
    } else if (arg === '--json') {
      json = true;
    } else if (!envfile) {
      envfile = arg;
    }
  }
  return { schemaPath, json, envfile };
}

function main(argv) {
  const { schemaPath, json, envfile } = parseArgv(argv);

  if (!schemaPath) {
    throw new Error('--schema <schema.json> is required');
  }

  let envText;
  try {
    envText = readFileSync(envfile, 'utf8');
  } catch {
    throw new Error(`cannot read env file: ${envfile}`);
  }

  let schemaText;
  try {
    schemaText = readFileSync(schemaPath, 'utf8');
  } catch {
    throw new Error(`cannot read schema file: ${schemaPath}`);
  }

  let schema;
  try {
    schema = JSON.parse(schemaText);
  } catch {
    throw new Error(`schema is not valid JSON: ${schemaPath}`);
  }

  const parsed = parseEnv(envText);
  const { findings, checked, ok } = checkRules(parsed, schema);

  const problemsByLine = new Map(parsed.problems.map((p) => [p.line, p.rawText]));

  if (json) {
    process.stdout.write(`${JSON.stringify({ ok, findings, checked })}\n`);
  } else if (ok) {
    process.stdout.write(`ok: ${checked} keys checked\n`);
  } else {
    for (const finding of findings) {
      const rawText = problemsByLine.get(finding.line);
      const label = finding.key === '' && rawText !== undefined
        ? truncate(rawText, 30)
        : finding.key;
      process.stdout.write(`${envfile}:${finding.line}: ${label}: ${finding.message}\n`);
    }
    process.stdout.write(`${findings.length} problem(s)\n`);
  }

  return ok ? 0 : 1;
}

try {
  const exitCode = main(process.argv.slice(2));
  process.exitCode = exitCode;
} catch (err) {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exitCode = 2;
}
