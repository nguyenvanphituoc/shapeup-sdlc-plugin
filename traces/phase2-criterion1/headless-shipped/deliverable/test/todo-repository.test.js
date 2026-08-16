'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function withTempHome(fn) {
  const originalHome = process.env.HOME;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-test-'));
  process.env.HOME = tmpDir;
  // Force a fresh require so os.homedir() (cached internally by Node in some
  // versions) is re-evaluated against the new HOME for this test.
  delete require.cache[require.resolve('../lib/todo-repository.js')];
  const repo = require('../lib/todo-repository.js');
  try {
    fn(repo, tmpDir);
  } finally {
    process.env.HOME = originalHome;
    delete require.cache[require.resolve('../lib/todo-repository.js')];
  }
}

test('load() on a missing file returns []', () => {
  withTempHome((repo) => {
    assert.deepEqual(repo.load(), []);
  });
});

test('load() on invalid JSON throws StoreCorruptedError tagged E_STORE_CORRUPTED', () => {
  withTempHome((repo) => {
    fs.writeFileSync(repo.storePath(), '{not valid json,,,');
    assert.throws(() => repo.load(), (err) => {
      assert.equal(err.name, 'StoreCorruptedError');
      assert.equal(err.code, 'E_STORE_CORRUPTED');
      return true;
    });
  });
});

test('load() on valid JSON that is not an array throws E_STORE_CORRUPTED', () => {
  withTempHome((repo) => {
    fs.writeFileSync(repo.storePath(), JSON.stringify({}));
    assert.throws(() => repo.load(), (err) => {
      assert.equal(err.code, 'E_STORE_CORRUPTED');
      return true;
    });
  });
});

test('save(items) writes JSON that load() reads back unchanged (round-trip)', () => {
  withTempHome((repo) => {
    const items = [
      { text: 'buy milk', done: false },
      { text: 'write spec', done: true },
    ];
    repo.save(items);
    assert.deepEqual(repo.load(), items);
  });
});

test('empty array file ([] on disk): load() returns []', () => {
  withTempHome((repo) => {
    fs.writeFileSync(repo.storePath(), '[]');
    assert.deepEqual(repo.load(), []);
  });
});

test('load() never returns null', () => {
  withTempHome((repo) => {
    assert.notEqual(repo.load(), null);
    repo.save([]);
    assert.notEqual(repo.load(), null);
  });
});

test('save(items) writing an empty array produces a valid empty-array file', () => {
  withTempHome((repo) => {
    repo.save([]);
    const raw = fs.readFileSync(repo.storePath(), 'utf8');
    assert.deepEqual(JSON.parse(raw), []);
  });
});
