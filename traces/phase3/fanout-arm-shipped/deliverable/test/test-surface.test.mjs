// Full Test Surface coverage for UC-01 (shapeup/envlint/spec/usecases/UC-01.md).
// One node --test run drives the built bin/envlint.mjs binary via spawnSync against
// throwaway fixtures written to a temp directory per run. Grouped by TS-* prefix for
// traceability back to the UC's D1-D4 sources. A failing assertion here means one of
// TASK-001/002/003 is incomplete, not this scope (see TASK-004's Non-Go).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/envlint.mjs', import.meta.url));

function run(args) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });
}

function fixture(name, content) {
  const dir = mkdtempSync(join(tmpdir(), 'envlint-ts-'));
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

// ---- TS-INV-* ----------------------------------------------------------

test('TS-INV-01: extra key not in schema -> exit 0, no finding for it', () => {
  const schema = fixture('schema.json', JSON.stringify({ PORT: { required: true, type: 'int' } }));
  const env = fixture('.env', 'PORT=8080\nEXTRA_KEY=whatever\n');
  const result = run(['--schema', schema, env]);
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /EXTRA_KEY/);
});

test('TS-INV-02: earlier invalid value, later valid value -> exit 0, no finding', () => {
  const schema = fixture('schema.json', JSON.stringify({ PORT: { required: true, type: 'int' } }));
  const env = fixture('.env', 'PORT=abc\nPORT=8080\n');
  const result = run(['--schema', schema, env]);
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /PORT/);
});

test('TS-INV-02b: earlier valid value, later invalid value -> exit 1, exactly one finding', () => {
  const schema = fixture('schema.json', JSON.stringify({ PORT: { required: true, type: 'int' } }));
  const env = fixture('.env', 'PORT=8080\nPORT=abc\n');
  const result = run(['--schema', schema, env]);
  assert.equal(result.status, 1);
  const portLines = result.stdout.split('\n').filter((l) => l.includes('PORT'));
  assert.equal(portLines.length, 1);
  assert.match(portLines[0], /PORT is invalid/);
});

test('TS-INV-03: exit code is always 0/1/2 across E1/E2/E3/E4/clean/findings, no uncaught exception', () => {
  const validSchema = fixture('schema.json', JSON.stringify({ PORT: { required: true, type: 'int' } }));
  const cases = [
    // E1: missing env file
    ['--schema', validSchema, '/no/such/env'],
    // E2: invalid schema JSON
    ['--schema', fixture('bad-schema.json', '{ not json'), fixture('.env', 'PORT=8080\n')],
    // E3: empty env file
    ['--schema', validSchema, fixture('.env', '# only comments\n')],
    // E4: unparsable line
    ['--schema', validSchema, fixture('.env', 'not an assignment\n')],
    // clean
    ['--schema', validSchema, fixture('.env', 'PORT=8080\n')],
    // findings
    ['--schema', validSchema, fixture('.env', 'PORT=abc\n')],
  ];
  for (const args of cases) {
    const result = run(args);
    assert.ok([0, 1, 2].includes(result.status), `unexpected exit code ${result.status} for ${args}`);
    assert.doesNotMatch(result.stderr, /at Object|at Module|\.mjs:\d+:\d+/);
  }
});

test('TS-INV-04: --json vs non-json, same fixture -> both exit 1, --json prints exactly one JSON doc', () => {
  const schema = fixture('schema.json', JSON.stringify({ PORT: { required: true, type: 'int' } }));
  const env = fixture('.env', 'PORT=abc\n');
  const plain = run(['--schema', schema, env]);
  const json = run(['--schema', schema, '--json', env]);
  assert.equal(plain.status, 1);
  assert.equal(json.status, 1);
  assert.doesNotThrow(() => JSON.parse(json.stdout));
  assert.equal(json.stdout.trim().split('\n').length, 1);
});

test('TS-INV-05: E_NOFLAG/E_SCHEMA_UNREADABLE/E2/E1 all exit 2 with single-line Error: stderr', () => {
  const validSchema = fixture('schema.json', JSON.stringify({}));
  const validEnv = fixture('.env', 'PORT=8080\n');
  const cases = [
    [validEnv], // E_NOFLAG
    ['--schema', '/no/such/schema.json', validEnv], // E_SCHEMA_UNREADABLE
    ['--schema', fixture('bad.json', '{ not json'), validEnv], // E2
    ['--schema', validSchema, '/no/such/env'], // E1
  ];
  for (const args of cases) {
    const result = run(args);
    assert.equal(result.status, 2, `expected exit 2 for ${args}`);
    assert.match(result.stderr, /^Error: /);
    assert.equal(result.stderr.split('\n').filter(Boolean).length, 1);
  }
});

test('TS-INV-06: zero assignments, schema with zero required keys -> exit 0, ok printed', () => {
  const schema = fixture('schema.json', JSON.stringify({ PORT: { type: 'int' } }));
  const env = fixture('.env', '# nothing here\n');
  const result = run(['--schema', schema, env]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'ok: 1 keys checked\n');
});

// ---- TS-ERR-* -----------------------------------------------------------

test('TS-ERR-E_NOFLAG: no --schema -> exit 2, stderr Error: prefix', () => {
  const env = fixture('.env', 'PORT=8080\n');
  const result = run([env]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^Error: /);
});

test('TS-ERR-E_SCHEMA_UNREADABLE: nonexistent schema -> exit 2, specific stderr', () => {
  const env = fixture('.env', 'PORT=8080\n');
  const result = run(['--schema', '/nonexistent/schema.json', env]);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, 'Error: cannot read schema file: /nonexistent/schema.json\n');
});

test('TS-ERR-E2: schema file invalid JSON (trailing comma) -> exit 2, specific stderr', () => {
  const schema = fixture('schema.json', '{"PORT":{"required":true},}');
  const env = fixture('.env', 'PORT=8080\n');
  const result = run(['--schema', schema, env]);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, `Error: schema is not valid JSON: ${schema}\n`);
});

test('TS-ERR-E1: valid schema, nonexistent env file -> exit 2, specific stderr', () => {
  const schema = fixture('schema.json', JSON.stringify({}));
  const result = run(['--schema', schema, '/no/such/envfile']);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, 'Error: cannot read env file: /no/such/envfile\n');
});

test('TS-ERR-E3: only comments/blanks, schema has >=1 required key -> exit 1, finding at line 0, no ok', () => {
  const schema = fixture('schema.json', JSON.stringify({ PORT: { required: true, type: 'int' } }));
  const env = fixture('.env', '# nothing\n\n');
  const result = run(['--schema', schema, env]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, new RegExp(`${env}:0: PORT: PORT is required but missing`));
  assert.doesNotMatch(result.stdout, /^ok/);
});

test('TS-ERR-E4: unparsable line -> exit 1, finding with truncated line text', () => {
  const schema = fixture('schema.json', JSON.stringify({}));
  const env = fixture('.env', 'not an assignment at all\n');
  const result = run(['--schema', schema, env]);
  assert.equal(result.status, 1);
  assert.match(
    result.stdout,
    new RegExp(`${env}:1: not an assignment at all: not a KEY=VALUE assignment`)
  );
});

test('TS-ERR-E5: --json on clean and findings fixtures -> exactly one parseable JSON doc each', () => {
  const schema = fixture('schema.json', JSON.stringify({ PORT: { required: true, type: 'int' } }));
  const cleanEnv = fixture('.env', 'PORT=8080\n');
  const findingsEnv = fixture('.env', '# nothing\n');

  const clean = run(['--schema', schema, '--json', cleanEnv]);
  const parsedClean = JSON.parse(clean.stdout);
  assert.deepEqual(Object.keys(parsedClean).sort(), ['checked', 'findings', 'ok']);

  const findings = run(['--schema', schema, '--json', findingsEnv]);
  const parsedFindings = JSON.parse(findings.stdout);
  assert.deepEqual(Object.keys(parsedFindings).sort(), ['checked', 'findings', 'ok']);
});

// ---- TS-REQ-* / TS-TYPE-* -------------------------------------------------

test('TS-REQ-schema-missing: omit --schema entirely -> E_NOFLAG behavior', () => {
  const env = fixture('.env', 'PORT=8080\n');
  const result = run([env]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^Error: /);
});

test('TS-REQ-envfile-missing: omit positional envfile -> exit 2, tool error', () => {
  const schema = fixture('schema.json', JSON.stringify({}));
  const result = run(['--schema', schema]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^Error: /);
});

test('TS-TYPE-int: 01 passes; 1.5, 1e3, empty fail', () => {
  const schema = fixture('schema.json', JSON.stringify({ N: { required: true, type: 'int' } }));

  const ok = run(['--schema', schema, fixture('.env', 'N=01\n')]);
  assert.equal(ok.status, 0);

  for (const value of ['1.5', '1e3', '']) {
    const result = run(['--schema', schema, fixture('.env', `N=${value}\n`)]);
    assert.equal(result.status, 1, `expected finding for N=${value}`);
    assert.match(result.stdout, /N is invalid/);
  }
});

test('TS-TYPE-bool: TRUE/1 pass; yes fails', () => {
  const schema = fixture('schema.json', JSON.stringify({ B: { type: 'bool' } }));

  for (const value of ['TRUE', '1']) {
    const result = run(['--schema', schema, fixture('.env', `B=${value}\n`)]);
    assert.equal(result.status, 0, `expected no finding for B=${value}`);
  }

  const bad = run(['--schema', schema, fixture('.env', 'B=yes\n')]);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /B is invalid/);
});

test('TS-TYPE-url-scheme-gate: ftp:// URL fails the protocol gate', () => {
  const schema = fixture('schema.json', JSON.stringify({ U: { type: 'url' } }));
  const result = run(['--schema', schema, fixture('.env', 'U=ftp://x.com\n')]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /U is invalid/);
});

test('TS-TYPE-url-leniency: http:/x.com (single slash) is not rejected', () => {
  const schema = fixture('schema.json', JSON.stringify({ U: { type: 'url' } }));
  const result = run(['--schema', schema, fixture('.env', 'U=http:/x.com\n')]);
  assert.equal(result.status, 0);
});

test('TS-TYPE-enum: warn not in [debug, info] -> finding', () => {
  const schema = fixture('schema.json', JSON.stringify({ L: { enum: ['debug', 'info'] } }));
  const result = run(['--schema', schema, fixture('.env', 'L=warn\n')]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /L is invalid/);
});

test('TS-TYPE-empty-value: S= satisfies string, N= fails int', () => {
  const schema = fixture(
    'schema.json',
    JSON.stringify({ S: { type: 'string' }, N: { type: 'int' } })
  );
  const result = run(['--schema', schema, fixture('.env', 'S=\nN=\n')]);
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /S is invalid/);
  assert.match(result.stdout, /N is invalid/);
});

// ---- TS-NOGO-* ------------------------------------------------------------

test('TS-NOGO-01: no ${VAR} interpolation -- literal string is checked', () => {
  const schema = fixture('schema.json', JSON.stringify({ U: { enum: ['${OTHER_VAR}'] } }));
  const env = fixture('.env', 'U=${OTHER_VAR}\n');
  const result = run(['--schema', schema, env]);
  assert.equal(result.status, 0);
});

test('TS-NOGO-02: envlint never writes to the .env file (contents/mtime unchanged)', () => {
  const schema = fixture('schema.json', JSON.stringify({ PORT: { required: true, type: 'int' } }));
  const env = fixture('.env', 'PORT=8080\n');
  const before = { content: readFileSync(env, 'utf8'), mtimeMs: statSync(env).mtimeMs };
  run(['--schema', schema, env]);
  const after = { content: readFileSync(env, 'utf8'), mtimeMs: statSync(env).mtimeMs };
  assert.equal(after.content, before.content);
  assert.equal(after.mtimeMs, before.mtimeMs);
});

test('TS-NOGO-03: no ANSI colors/TUI/prompts across clean, findings and --json runs', () => {
  const schema = fixture('schema.json', JSON.stringify({ PORT: { required: true, type: 'int' } }));
  const ANSI_RE = /\x1b\[[0-9;]*m/;

  const clean = run(['--schema', schema, fixture('.env', 'PORT=8080\n')]);
  const findings = run(['--schema', schema, fixture('.env', '# nothing\n')]);
  const jsonRun = run(['--schema', schema, '--json', fixture('.env', 'PORT=8080\n')]);

  for (const result of [clean, findings, jsonRun]) {
    assert.doesNotMatch(result.stdout, ANSI_RE);
  }
});

test('TS-NOGO-04: url type check works fully offline, no network fetch', () => {
  const schema = fixture('schema.json', JSON.stringify({ U: { type: 'url' } }));
  const env = fixture('.env', 'U=https://example.invalid/path\n');
  const result = run(['--schema', schema, env]);
  // Deterministic pass/fail with no network access available in the sandbox --
  // new URL() + protocol check never performs a fetch.
  assert.equal(result.status, 0);
});
