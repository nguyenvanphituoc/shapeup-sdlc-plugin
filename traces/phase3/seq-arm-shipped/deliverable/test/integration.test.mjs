import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/envlint.mjs', import.meta.url));

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'envlint-integration-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

// E1 — missing env file
test('E1: missing env file → exit 2, stderr Error: cannot read env file', () => {
  withTempDir((dir) => {
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(schemaPath, '{}');
    const envPath = join(dir, 'nope.env');
    const result = run(['--schema', schemaPath, envPath]);
    assert.equal(result.status, 2);
    assert.equal(result.stderr.trim(), `Error: cannot read env file: ${envPath}`);
    assert.equal(result.stdout, '');
  });
});

// E2 — schema not valid JSON
test('E2: schema not valid JSON → exit 2, stderr Error: schema is not valid JSON', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, 'PORT=8080\n');
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(schemaPath, 'not json at all');
    const result = run(['--schema', schemaPath, envPath]);
    assert.equal(result.status, 2);
    assert.equal(result.stderr.trim(), `Error: schema is not valid JSON: ${schemaPath}`);
  });
});

// E3 — zero-assignment env file
test('E3: zero-assignment env file → every required key missing, exit 1, no ok line', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, '# nothing here\n\n');
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(
      schemaPath,
      JSON.stringify({ PORT: { required: true, type: 'int' }, API_URL: { required: true, type: 'url' } })
    );
    const result = run(['--schema', schemaPath, envPath]);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /^ok:/);
    assert.match(result.stdout, /PORT/);
    assert.match(result.stdout, /API_URL/);
  });
});

// E4 — malformed line
test('E4: malformed line → truncated line text + not a KEY=VALUE assignment, exit 1', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    const badLine = 'this line has no equals sign in it at all';
    writeFileSync(envPath, `${badLine}\n`);
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(schemaPath, '{}');
    const result = run(['--schema', schemaPath, envPath]);
    assert.equal(result.status, 1);
    const truncated = badLine.slice(0, 30);
    assert.equal(
      result.stdout.trim().split('\n')[0],
      `${envPath}:1: ${truncated}: not a KEY=VALUE assignment`
    );
  });
});

// E5 — --json emits exactly one JSON document, exit unchanged by --json
test('E5: --json emits exactly one JSON document; exit code unchanged by --json', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, '');
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(schemaPath, JSON.stringify({ PORT: { required: true, type: 'int' } }));

    const humanResult = run(['--schema', schemaPath, envPath]);
    const jsonResult = run(['--schema', schemaPath, '--json', envPath]);

    assert.equal(jsonResult.status, humanResult.status);
    assert.equal(jsonResult.status, 1);

    const lines = jsonResult.stdout.split('\n').filter((l) => l.length > 0);
    assert.equal(lines.length, 1);
    const doc = JSON.parse(lines[0]);
    assert.deepEqual(Object.keys(doc).sort(), ['checked', 'findings', 'ok']);
  });
});

// clean/findings human + --json, via the real binary
test('clean run: exit 0 via the real binary, human mode', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, 'PORT=8080\nAPI_URL=https://example.com\n');
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(
      schemaPath,
      JSON.stringify({ PORT: { required: true, type: 'int' }, API_URL: { required: true, type: 'url' } })
    );
    const result = run(['--schema', schemaPath, envPath]);
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), 'ok: 2 keys checked');
  });
});

test('findings run: exit 1 via the real binary, --json mode', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, 'PORT=not-an-int\n');
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(schemaPath, JSON.stringify({ PORT: { required: true, type: 'int' } }));
    const result = run(['--schema', schemaPath, '--json', envPath]);
    assert.equal(result.status, 1);
    const doc = JSON.parse(result.stdout);
    assert.equal(doc.ok, false);
    assert.equal(doc.findings.length, 1);
  });
});

test('no network access occurs during a run (offline-safe url check)', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, 'API_URL=https://example.invalid.doesnotexist.test\n');
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(schemaPath, JSON.stringify({ API_URL: { required: true, type: 'url' } }));
    const start = Date.now();
    const result = run(['--schema', schemaPath, envPath]);
    const elapsedMs = Date.now() - start;
    assert.equal(result.status, 0);
    // A real network attempt against an unresolvable host would take far longer
    // than a purely local string/protocol check.
    assert.ok(elapsedMs < 5000, `expected a fast local-only run, took ${elapsedMs}ms`);
  });
});
