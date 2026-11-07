#!/usr/bin/env node
// envlint CLI (UC-LintEnvFile). Contract: shapeup/envlint/spec/usecases/UC-LintEnvFile.md
// Exit codes per PD-13, output format per PD-14. Never reads stdin, never writes a file.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parse } from '../src/parse.mjs';
import { checkSchema, check } from '../src/rules.mjs';

const USAGE_LINE = 'usage: envlint --schema <schema.json> <envfile>';

class Exit2 extends Error {}

// INV-03: input text reaches the output, so control characters (C0, DEL, C1 — ESC included)
// are printed as visible `\xHH` escapes rather than raw bytes.
const visible = (text) =>
  String(text).replace(/[\x00-\x1f\x7f-\x9f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`);

function fail(message, usage = false) {
  process.stderr.write(`envlint: ${visible(message)}\n${usage ? `${USAGE_LINE}\n` : ''}`);
  throw new Exit2(message);
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return fail(`cannot read ${path}`);
  }
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: { schema: { type: 'string' } }, allowPositionals: true, strict: true });
  } catch (err) {
    fail(String(err.message).split('\n')[0], true);
  }
  const schemaPath = parsed.values.schema;
  const positionals = parsed.positionals;
  if (!schemaPath) fail('--schema <schema.json> is required', true);
  if (positionals.length === 0) fail('an env file is required', true);
  if (positionals.length > 1) fail('exactly one env file is expected', true);
  const envPath = positionals[0];

  const schemaText = readText(schemaPath);
  let schema;
  try {
    schema = JSON.parse(schemaText);
  } catch (err) {
    fail(`invalid schema ${schemaPath}: ${err.message}`);
  }
  const reasons = checkSchema(schema);
  if (reasons.length > 0) fail(`invalid schema ${schemaPath}: ${reasons[0]}`);

  const { pairs, problems } = parse(readText(envPath));
  const findings = check(pairs, schema);

  const items = [
    ...problems.map((p) => ({ line: p.line, text: `${envPath}:${p.line}: ${p.message}` })),
    ...findings.map((f) => ({
      line: f.line,
      text: f.line == null ? `${envPath}: ${f.key}: ${f.message}` : `${envPath}:${f.line}: ${f.key}: ${f.message}`,
    })),
  ];
  // Ordered by line; missing-key findings (line null) last. Array.sort is stable.
  const rank = (i) => (i.line == null ? Number.MAX_SAFE_INTEGER : i.line);
  items.sort((a, b) => rank(a) - rank(b));

  if (items.length > 0) process.stdout.write(items.map((i) => `${visible(i.text)}\n`).join(''));
  return items.length > 0 ? 1 : 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  if (!(err instanceof Exit2)) process.stderr.write(`envlint: ${visible(String(err && err.message).split('\n')[0])}\n`);
  process.exitCode = 2;
}
