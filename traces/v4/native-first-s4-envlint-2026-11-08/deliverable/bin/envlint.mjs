#!/usr/bin/env node
// envlint CLI composition root. Output contract: shapeup/envlint/spec/ux-behavior.md;
// data contracts C1-C3: shapeup/envlint/spec/domain-model.md.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parseEnv } from '../src/parse.mjs';
import { checkSchema, checkPairs } from '../src/rules.mjs';

const USAGE = 'usage: envlint --schema <schema.json> <envfile>';

class CliError extends Error {
  constructor(message, usage = false) {
    super(message);
    this.usage = usage;
  }
}

function parseArgv(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: { schema: { type: 'string' } },
      allowPositionals: true,
      strict: true,
      tokens: true,
    });
  } catch (err) {
    throw new CliError(err.message, true);
  }
  const schemaTokens = parsed.tokens.filter((t) => t.kind === 'option' && t.name === 'schema');
  if (schemaTokens.length === 0) throw new CliError('missing --schema', true);
  if (schemaTokens.length > 1) throw new CliError('expected exactly one --schema', true);
  if (parsed.positionals.length !== 1) throw new CliError('expected exactly one env file', true);
  return { schemaPath: parsed.values.schema, envPath: parsed.positionals[0] };
}

function readText(path, kind) {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    throw new CliError(`cannot read ${kind} file ${path}: ${err.code ?? err.message}`);
  }
}

function main(argv) {
  const { schemaPath, envPath } = parseArgv(argv);

  const schemaText = readText(schemaPath, 'schema');
  let schema;
  try {
    schema = JSON.parse(schemaText);
  } catch {
    throw new CliError(`invalid schema ${schemaPath}: not valid JSON`);
  }
  const schemaErrors = checkSchema(schema);
  if (schemaErrors.length > 0) throw new CliError(`invalid schema ${schemaPath}: ${schemaErrors[0]}`);

  const envText = readText(envPath, 'env');
  const { pairs, problems } = parseEnv(envText);
  const findings = checkPairs(pairs, schema);

  const lined = [
    ...problems.map((p) => ({ line: p.line, rank: 0, text: `${envPath}:${p.line}: parse error: ${p.message}` })),
    ...findings
      .filter((f) => f.line !== null)
      .map((f) => ({ line: f.line, rank: 1, text: `${envPath}:${f.line}: ${f.key}: ${f.message}` })),
  ].sort((a, b) => a.line - b.line || a.rank - b.rank);
  const lineless = findings.filter((f) => f.line === null).map((f) => `${envPath}: ${f.key}: ${f.message}`);

  const out = [...lined.map((l) => l.text), ...lineless];
  if (out.length > 0) process.stdout.write(out.join('\n') + '\n');
  return out.length > 0 ? 1 : 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  if (err instanceof CliError) {
    process.stderr.write(`envlint: ${err.message}\n` + (err.usage ? `${USAGE}\n` : ''));
  } else {
    process.stderr.write(`envlint: internal error: ${err && err.message ? err.message : String(err)}\n`);
  }
  process.exitCode = 2;
}
