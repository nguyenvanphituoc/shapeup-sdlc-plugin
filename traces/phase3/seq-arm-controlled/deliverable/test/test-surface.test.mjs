// Integration test suite covering every TS-* row of shapeup/envlint/spec/usecases/UC-01.md
// (Test-Surface section). Drives the built bin/envlint.mjs binary via child_process.spawnSync
// against throwaway fixtures written to a temp directory per run. Per TASK-004's Non-Go: a
// failing assertion here means TASK-001/002/003 is incomplete, not this scope.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/envlint.mjs', import.meta.url));

function run(args) {
  return spawnSync('node', [BIN, ...args], { encoding: 'utf8' });
}

function tmpFile(name, contents) {
  const dir = mkdtempSync(join(tmpdir(), 'envlint-ts-'));
  const path = join(dir, name);
  writeFileSync(path, contents);
  return path;
}

function schemaFile(schema) {
  return tmpFile('schema.json', JSON.stringify(schema));
}

// ---------------------------------------------------------------------------
// TS-INV-*
// ---------------------------------------------------------------------------

test('TS-INV-01: key present in env file but absent from schema is never a finding', () => {
  const schemaPath = schemaFile({ PORT: { required: true, type: 'int' } });
  const envFile = tmpFile('.env', 'PORT=3000\nEXTRA_KEY=whatever\n');
  const result = run(['--schema', schemaPath, envFile]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'ok: 1 keys checked\n');
});

test('TS-INV-02: duplicate key, earlier invalid value produces nothing, winning valid value -> no finding', () => {
  const schemaPath = schemaFile({ PORT: { required: true, type: 'int' } });
  const envFile = tmpFile('.env', 'PORT=abc\nPORT=8080\n');
  const result = run(['--schema', schemaPath, envFile]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'ok: 1 keys checked\n');
});

test('TS-INV-02b: duplicate key, winning invalid value -> exactly one finding, not two', () => {
  const schemaPath = schemaFile({ PORT: { required: true, type: 'int' } });
  const envFile = tmpFile('.env', 'PORT=8080\nPORT=abc\n');
  const result = run(['--schema', schemaPath, envFile]);
  assert.equal(result.status, 1);
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[1], '1 problem(s)');
});

test('TS-INV-03: exit code is always 0/1/2 across E1/E2/E3/E4/clean/findings, never a stack trace', () => {
  const schemaPath = schemaFile({ PORT: { required: true, type: 'int' } });
  const cases = [
    ['--schema', '/no/such/schema.json', tmpFile('.env', 'PORT=3000\n')], // E1-ish, actually E_SCHEMA_UNREADABLE
    ['--schema', schemaFile({}), '/no/such/env'], // E1
    ['--schema', tmpFile('bad-schema.json', 'not json'), tmpFile('.env', 'PORT=3000\n')], // E2
    ['--schema', schemaPath, tmpFile('empty.env', '\n# only comments\n')], // E3
    ['--schema', schemaPath, tmpFile('bad-line.env', 'not an assignment at all\n')], // E4
    ['--schema', schemaPath, tmpFile('clean.env', 'PORT=3000\n')], // clean
  ];
  for (const args of cases) {
    const result = run(args);
    assert.ok([0, 1, 2].includes(result.status), `unexpected status ${result.status} for ${args.join(' ')}`);
    assert.doesNotMatch(result.stderr, /at .*\.mjs:\d+/);
  }
});

test('TS-INV-04: --json vs plain on a findings fixture -> same exit code, --json prints exactly one JSON doc', () => {
  const schemaPath = schemaFile({ PORT: { required: true, type: 'int' } });
  const envFile = tmpFile('.env', '# no PORT here\n');
  const plain = run(['--schema', schemaPath, envFile]);
  const withJson = run(['--schema', schemaPath, '--json', envFile]);
  assert.equal(plain.status, 1);
  assert.equal(withJson.status, 1);
  assert.doesNotThrow(() => JSON.parse(withJson.stdout));
  assert.equal(withJson.stdout.trim().split('\n').length, 1);
});

test('TS-INV-05: each of E_NOFLAG/E_SCHEMA_UNREADABLE/E2/E1 -> exit 2, stderr "Error: " prefix, single line', () => {
  const schemaPath = schemaFile({ PORT: { required: true, type: 'int' } });
  const envFile = tmpFile('.env', 'PORT=3000\n');
  const cases = [
    run([envFile]), // E_NOFLAG
    run(['--schema', '/no/such/schema.json', envFile]), // E_SCHEMA_UNREADABLE
    run(['--schema', tmpFile('bad.json', 'not json'), envFile]), // E2
    run(['--schema', schemaPath, '/no/such/env']), // E1
  ];
  for (const result of cases) {
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^Error: /);
    assert.equal(result.stderr.trim().split('\n').length, 1);
  }
});

test('TS-INV-06: zero assignments + zero required schema keys -> exit 0, ok printed', () => {
  const schemaPath = schemaFile({ NAME: { type: 'string' } });
  const envFile = tmpFile('.env', '# only comments\n\n');
  const result = run(['--schema', schemaPath, envFile]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'ok: 1 keys checked\n');
});

// ---------------------------------------------------------------------------
// TS-ERR-*
// ---------------------------------------------------------------------------

test('TS-ERR-E_NOFLAG: no --schema -> exit 2, stderr "Error: " prefix', () => {
  const envFile = tmpFile('.env', 'PORT=3000\n');
  const result = run([envFile]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^Error: /);
});

test('TS-ERR-E_SCHEMA_UNREADABLE: nonexistent schema path -> exit 2, exact stderr message', () => {
  const envFile = tmpFile('.env', 'PORT=3000\n');
  const schemaPath = '/nonexistent/schema.json';
  const result = run(['--schema', schemaPath, envFile]);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, `Error: cannot read schema file: ${schemaPath}\n`);
});

test('TS-ERR-E2: schema file contains invalid JSON -> exit 2, exact stderr message', () => {
  const envFile = tmpFile('.env', 'PORT=3000\n');
  const schemaPath = tmpFile('schema.json', '{"PORT": {"required": true,}}');
  const result = run(['--schema', schemaPath, envFile]);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, `Error: schema is not valid JSON: ${schemaPath}\n`);
});

test('TS-ERR-E1: valid schema, nonexistent env file -> exit 2, exact stderr message', () => {
  const schemaPath = schemaFile({ PORT: { required: true, type: 'int' } });
  const envPath = '/no/such/envfile';
  const result = run(['--schema', schemaPath, envPath]);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, `Error: cannot read env file: ${envPath}\n`);
});

test('TS-ERR-E3: only comments/blanks, schema has >=1 required key -> exit 1, missing at line 0, no ok', () => {
  const schemaPath = schemaFile({ PORT: { required: true, type: 'int' } });
  const envFile = tmpFile('.env', '# nothing here\n\n');
  const result = run(['--schema', schemaPath, envFile]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, `${envFile}:0: PORT: PORT is required\n1 problem(s)\n`);
  assert.doesNotMatch(result.stdout, /^ok/);
});

test('TS-ERR-E4: unparsable line -> exit 1, finding with truncated raw text and message', () => {
  const schemaPath = schemaFile({});
  const envFile = tmpFile('.env', 'not an assignment at all\n');
  const result = run(['--schema', schemaPath, envFile]);
  assert.equal(result.status, 1);
  assert.equal(
    result.stdout,
    `${envFile}:1: not an assignment at all: not a KEY=VALUE assignment\n1 problem(s)\n`
  );
});

test('TS-ERR-E5: --json on clean and findings fixtures -> exactly one parseable JSON doc matching the contract', () => {
  const schemaPath = schemaFile({ PORT: { required: true, type: 'int' } });
  const cleanEnv = tmpFile('clean.env', 'PORT=3000\n');
  const findingsEnv = tmpFile('bad.env', '# no PORT here\n');

  const cleanResult = run(['--schema', schemaPath, '--json', cleanEnv]);
  const cleanParsed = JSON.parse(cleanResult.stdout);
  assert.deepEqual(Object.keys(cleanParsed).sort(), ['checked', 'findings', 'ok']);
  assert.equal(cleanParsed.ok, true);

  const findingsResult = run(['--schema', schemaPath, '--json', findingsEnv]);
  const findingsParsed = JSON.parse(findingsResult.stdout);
  assert.deepEqual(Object.keys(findingsParsed).sort(), ['checked', 'findings', 'ok']);
  assert.equal(findingsParsed.ok, false);
});

// ---------------------------------------------------------------------------
// TS-REQ-* / TS-TYPE-*
// ---------------------------------------------------------------------------

test('TS-REQ-schema-missing: omit --schema entirely -> E_NOFLAG behavior', () => {
  const envFile = tmpFile('.env', 'PORT=3000\n');
  const result = run([envFile]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^Error: /);
});

test('TS-REQ-envfile-missing: omit the positional envfile argument -> exit 2, tool error', () => {
  const schemaPath = schemaFile({ PORT: { required: true, type: 'int' } });
  const result = run(['--schema', schemaPath]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^Error: /);
});

test('TS-TYPE-int: 01 passes, 1.5/1e3/empty all fail', () => {
  const schemaPath = schemaFile({ N: { required: true, type: 'int' } });

  const passResult = run(['--schema', schemaPath, tmpFile('a.env', 'N=01\n')]);
  assert.equal(passResult.status, 0);

  for (const bad of ['1.5', '1e3', '']) {
    const result = run(['--schema', schemaPath, tmpFile('b.env', `N=${bad}\n`)]);
    assert.equal(result.status, 1, `expected N=${bad} to fail`);
    assert.match(result.stdout, /N: /);
  }
});

test('TS-TYPE-bool: TRUE/1 pass, yes fails', () => {
  const schemaPath = schemaFile({ B: { type: 'bool' } });

  for (const good of ['TRUE', '1']) {
    const result = run(['--schema', schemaPath, tmpFile('a.env', `B=${good}\n`)]);
    assert.equal(result.status, 0, `expected B=${good} to pass`);
  }

  const badResult = run(['--schema', schemaPath, tmpFile('b.env', 'B=yes\n')]);
  assert.equal(badResult.status, 1);
  assert.match(badResult.stdout, /B: /);
});

test('TS-TYPE-url-scheme-gate: wrong protocol (ftp://) -> finding even though new URL() parses it', () => {
  const schemaPath = schemaFile({ U: { type: 'url' } });
  const result = run(['--schema', schemaPath, tmpFile('a.env', 'U=ftp://x.com\n')]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /U: /);
});

test('TS-TYPE-url-leniency: single-slash http:/x.com -> no finding', () => {
  const schemaPath = schemaFile({ U: { type: 'url' } });
  const result = run(['--schema', schemaPath, tmpFile('a.env', 'U=http:/x.com\n')]);
  assert.equal(result.status, 0);
});

test('TS-TYPE-enum: value not in enum list -> finding', () => {
  const schemaPath = schemaFile({ L: { enum: ['debug', 'info'] } });
  const result = run(['--schema', schemaPath, tmpFile('a.env', 'L=warn\n')]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /L: /);
});

test('TS-TYPE-empty-value: empty string satisfies string, fails int', () => {
  const stringSchema = schemaFile({ S: { type: 'string' } });
  const stringResult = run(['--schema', stringSchema, tmpFile('a.env', 'S=\n')]);
  assert.equal(stringResult.status, 0);

  const intSchema = schemaFile({ N: { type: 'int' } });
  const intResult = run(['--schema', intSchema, tmpFile('b.env', 'N=\n')]);
  assert.equal(intResult.status, 1);
  assert.match(intResult.stdout, /N: /);
});

// ---------------------------------------------------------------------------
// TS-NOGO-*
// ---------------------------------------------------------------------------

test('TS-NOGO-01: ${OTHER_VAR} is never interpolated, checked as the literal string', () => {
  const schemaPath = schemaFile({ U: { type: 'url' } });
  const result = run(['--schema', schemaPath, tmpFile('a.env', 'U=${OTHER_VAR}\n')]);
  // literal "${OTHER_VAR}" is not a valid URL -> finding, proving no interpolation happened
  assert.equal(result.status, 1);
  assert.match(result.stdout, /U: /);
});

test('TS-NOGO-02: envlint never writes to the .env file (content/mtime diffed before/after)', () => {
  const schemaPath = schemaFile({ PORT: { required: true, type: 'int' } });
  const envFile = tmpFile('.env', 'PORT=3000\n');
  const before = { content: readFileSync(envFile, 'utf8'), mtimeMs: statSync(envFile).mtimeMs };
  const result = run(['--schema', schemaPath, envFile]);
  assert.equal(result.status, 0);
  const after = { content: readFileSync(envFile, 'utf8'), mtimeMs: statSync(envFile).mtimeMs };
  assert.equal(after.content, before.content);
  assert.equal(after.mtimeMs, before.mtimeMs);
});

test('TS-NOGO-03: no ANSI color codes, TUI redraw sequences, or interactive prompts in stdout', () => {
  const schemaPath = schemaFile({ PORT: { required: true, type: 'int' } });
  const cleanEnv = tmpFile('clean.env', 'PORT=3000\n');
  const findingsEnv = tmpFile('bad.env', '# no PORT here\n');

  const cleanResult = run(['--schema', schemaPath, cleanEnv]);
  const findingsResult = run(['--schema', schemaPath, findingsEnv]);
  const jsonResult = run(['--schema', schemaPath, '--json', cleanEnv]);

  for (const result of [cleanResult, findingsResult, jsonResult]) {
    // eslint-disable-next-line no-control-regex
    assert.doesNotMatch(result.stdout, /\x1b\[/);
  }
});

test('TS-NOGO-04: runs deterministically offline against a url-typed key -- never a network fetch', () => {
  const schemaPath = schemaFile({ U: { type: 'url' } });
  const envFile = tmpFile('a.env', 'U=https://example.invalid/path\n');
  const result = run(['--schema', schemaPath, envFile]);
  // deterministic and immediate — a network fetch would hang/error in the sandbox
  assert.equal(result.status, 0);
});
