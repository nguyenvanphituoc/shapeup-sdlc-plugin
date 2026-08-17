import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/envlint.mjs', import.meta.url));

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'envlint-cli-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

test('cli-missing-schema-flag: --schema not given → stderr Error, exit 2, no stack trace', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, 'PORT=8080\n');
    const result = run([envPath]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^Error: /);
    assert.doesNotMatch(result.stderr, /at .*\(.*:\d+:\d+\)/);
  });
});

test('cli-env-unreadable: missing env file → stderr Error: cannot read env file, exit 2', () => {
  withTempDir((dir) => {
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(schemaPath, '{}');
    const envPath = join(dir, 'missing.env');
    const result = run(['--schema', schemaPath, envPath]);
    assert.equal(result.status, 2);
    assert.equal(result.stderr.trim(), `Error: cannot read env file: ${envPath}`);
  });
});

test('cli-schema-unreadable: missing schema file → stderr error pattern, exit 2', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, 'PORT=8080\n');
    const schemaPath = join(dir, 'missing.json');
    const result = run(['--schema', schemaPath, envPath]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^Error: /);
  });
});

test('cli-schema-invalid-json: schema not valid JSON → stderr Error: schema is not valid JSON, exit 2', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, 'PORT=8080\n');
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(schemaPath, '{not valid json');
    const result = run(['--schema', schemaPath, envPath]);
    assert.equal(result.status, 2);
    assert.equal(result.stderr.trim(), `Error: schema is not valid JSON: ${schemaPath}`);
  });
});

test('cli-clean-human: 0 findings, human mode → ok: N keys checked, exit 0', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, 'PORT=8080\n');
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(schemaPath, JSON.stringify({ PORT: { required: true, type: 'int' } }));
    const result = run(['--schema', schemaPath, envPath]);
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), 'ok: 1 keys checked');
  });
});

test('cli-clean-json: 0 findings, --json → exactly one JSON document, exit 0', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, 'PORT=8080\n');
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(schemaPath, JSON.stringify({ PORT: { required: true, type: 'int' } }));
    const result = run(['--schema', schemaPath, '--json', envPath]);
    assert.equal(result.status, 0);
    const doc = JSON.parse(result.stdout);
    assert.deepEqual(doc, { ok: true, findings: [], checked: 1 });
  });
});

test('cli-findings-human: >=1 finding, human mode → one line per finding + N problem(s) trailer, exit 1', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, '');
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(schemaPath, JSON.stringify({ PORT: { required: true, type: 'int' } }));
    const result = run(['--schema', schemaPath, envPath]);
    assert.equal(result.status, 1);
    const lines = result.stdout.trim().split('\n');
    assert.equal(lines[0], `${envPath}:0: PORT: required key missing`);
    assert.equal(lines[1], '1 problem(s)');
  });
});

test('cli-findings-json: >=1 finding, --json → exactly one JSON document, exit 1', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, '');
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(schemaPath, JSON.stringify({ PORT: { required: true, type: 'int' } }));
    const result = run(['--schema', schemaPath, '--json', envPath]);
    assert.equal(result.status, 1);
    const doc = JSON.parse(result.stdout);
    assert.equal(doc.ok, false);
    assert.equal(doc.checked, 1);
    assert.equal(doc.findings.length, 1);
  });
});

test('cli-malformed-line-e4: malformed line → truncated raw text + not a KEY=VALUE assignment, exit 1', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, 'this is not a valid assignment line at all\n');
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(schemaPath, '{}');
    const result = run(['--schema', schemaPath, envPath]);
    assert.equal(result.status, 1);
    const truncated = 'this is not a valid assignment line at all'.slice(0, 30);
    assert.equal(
      result.stdout.trim().split('\n')[0],
      `${envPath}:1: ${truncated}: not a KEY=VALUE assignment`
    );
  });
});

test('cli-empty-file-e3: zero-assignment env file → every required key reported missing, exit 1, no ok line', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, '# just a comment\n\n');
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(
      schemaPath,
      JSON.stringify({ PORT: { required: true, type: 'int' }, HOST: { required: true } })
    );
    const result = run(['--schema', schemaPath, envPath]);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /^ok:/);
    assert.match(result.stdout, /PORT/);
    assert.match(result.stdout, /HOST/);
  });
});

test('finding with no source line renders line as 0', () => {
  withTempDir((dir) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, '');
    const schemaPath = join(dir, 'schema.json');
    writeFileSync(schemaPath, JSON.stringify({ MISSING: { required: true } }));
    const result = run(['--schema', schemaPath, '--json', envPath]);
    const doc = JSON.parse(result.stdout);
    assert.equal(doc.findings[0].line, 0);
  });
});
