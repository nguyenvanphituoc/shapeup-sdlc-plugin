#!/usr/bin/env node
// envlint CLI — composition root. Implements UC-LintEnvFile
// (shapeup/envlint/spec/usecases/UC-LintEnvFile.md) and the output contract in
// shapeup/envlint/spec/ux-behavior.md#Screen: TerminalOutput. Reads only the two paths given.

import { readFileSync } from 'node:fs';
import { parse } from '../src/parse.mjs';
import { validateSchema, evaluate } from '../src/rules.mjs';

const USAGE = 'envlint: usage: envlint --schema <schema.json> <envfile>';

class CliError extends Error {
  constructor(lines) {
    super(lines[0]);
    this.lines = lines;
  }
}

function parseArgs(argv) {
  let schemaPath = null;
  let envPath = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--schema') {
      if (schemaPath !== null || i + 1 >= argv.length) throw new CliError([USAGE]);
      schemaPath = argv[++i];
    } else if (arg.startsWith('-') || envPath !== null) {
      throw new CliError([USAGE]);
    } else {
      envPath = arg;
    }
  }
  if (schemaPath === null || envPath === null) throw new CliError([USAGE]);
  return { schemaPath, envPath };
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new CliError([`envlint: cannot read ${path}`]);
  }
}

function loadSchema(schemaPath) {
  const text = readText(schemaPath);
  let schema;
  try {
    schema = JSON.parse(text);
  } catch {
    throw new CliError([`envlint: invalid schema ${schemaPath}: not valid JSON`]);
  }
  const messages = validateSchema(schema);
  if (messages.length > 0) {
    throw new CliError(messages.map((m) => `envlint: invalid schema ${schemaPath}: ${m}`));
  }
  return schema;
}

function formatLines(envPath, problems, findings) {
  const numbered = [
    ...problems.map((p) => ({ line: p.line, text: `${envPath}:${p.line}: parse error: ${p.message}` })),
    ...findings
      .filter((f) => f.line !== null)
      .map((f) => ({ line: f.line, text: `${envPath}:${f.line}: ${f.key}: ${f.message}` })),
  ].sort((a, b) => a.line - b.line);
  const missing = findings.filter((f) => f.line === null).map((f) => `${envPath}: ${f.key}: ${f.message}`);
  return [...numbered.map((n) => n.text), ...missing];
}

function main(argv) {
  const { schemaPath, envPath } = parseArgs(argv);
  const envText = readText(envPath);
  const schema = loadSchema(schemaPath);
  const { pairs, problems } = parse(envText);
  const lines = formatLines(envPath, problems, evaluate(pairs, schema));
  if (lines.length > 0) process.stdout.write(lines.join('\n') + '\n');
  return lines.length > 0 ? 1 : 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  const lines =
    err instanceof CliError ? err.lines : [`envlint: ${String(err && err.message ? err.message : err).replace(/\s+/g, ' ')}`];
  process.stderr.write(lines.join('\n') + '\n');
  process.exitCode = 2;
}
