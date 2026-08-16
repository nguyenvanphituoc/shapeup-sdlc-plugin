"""Integration tests — full todo CLI round-trip across all commands.

Drives the real bin/todo binary as a subprocess (never imports internals),
against a $TODO_STORE pointed at a throwaway path per test. Covers the full
command set plus the named edge cases: empty list, bad index (non-integer
and out-of-range), and both corrupted-store variants.

Per TASK-007.
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_BIN_TODO = os.path.join(_REPO_ROOT, "bin", "todo")


def run_todo(store_path, *args, unset_store=False, home=None):
    """Spawn `python3 bin/todo <args>` as a real OS process.

    Returns the completed process (has .returncode, .stdout, .stderr).
    """
    env = dict(os.environ)
    if unset_store:
        env.pop("TODO_STORE", None)
    else:
        env["TODO_STORE"] = store_path
    if home is not None:
        env["HOME"] = home
    return subprocess.run(
        [sys.executable, _BIN_TODO, *args],
        capture_output=True,
        text=True,
        env=env,
    )


class FullRoundTripTest(unittest.TestCase):
    """Scenario: Happy-path round-trip."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.store_path = os.path.join(self.tmpdir.name, "todo.json")

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_full_round_trip(self):
        # add "a"
        p = run_todo(self.store_path, "add", "a")
        self.assertEqual(p.returncode, 0)
        self.assertEqual(p.stdout, "added #1: a\n")
        self.assertEqual(p.stderr, "")

        # add "b"
        p = run_todo(self.store_path, "add", "b")
        self.assertEqual(p.returncode, 0)
        self.assertEqual(p.stdout, "added #2: b\n")
        self.assertEqual(p.stderr, "")

        # list shows both, 1-based, correct done markers
        p = run_todo(self.store_path, "list")
        self.assertEqual(p.returncode, 0)
        self.assertEqual(p.stdout, "1. [ ] a\n2. [ ] b\n")
        self.assertEqual(p.stderr, "")

        # done 1
        p = run_todo(self.store_path, "done", "1")
        self.assertEqual(p.returncode, 0)
        self.assertEqual(p.stdout, "done #1: a\n")
        self.assertEqual(p.stderr, "")

        # list shows item 1 as [x]
        p = run_todo(self.store_path, "list")
        self.assertEqual(p.returncode, 0)
        self.assertEqual(p.stdout, "1. [x] a\n2. [ ] b\n")
        self.assertEqual(p.stderr, "")

        # rm 2
        p = run_todo(self.store_path, "rm", "2")
        self.assertEqual(p.returncode, 0)
        self.assertEqual(p.stdout, "removed #2: b\n")
        self.assertEqual(p.stderr, "")

        # list shows only item 1, renumbered to 1.
        p = run_todo(self.store_path, "list")
        self.assertEqual(p.returncode, 0)
        self.assertEqual(p.stdout, "1. [x] a\n")
        self.assertEqual(p.stderr, "")

        # underlying store file reflects the same state (TS-INV-01/02/03)
        with open(self.store_path) as f:
            data = json.load(f)
        self.assertEqual(data, [{"text": "a", "done": True}])


class EmptyListTest(unittest.TestCase):
    """UC-ListTodos TS-INV-04: empty list never crashes."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.store_path = os.path.join(self.tmpdir.name, "todo.json")

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_list_against_nonexistent_store(self):
        self.assertFalse(os.path.exists(self.store_path))
        p = run_todo(self.store_path, "list")
        self.assertEqual(p.returncode, 0)
        self.assertEqual(p.stdout, "(no items)\n")
        self.assertEqual(p.stderr, "")


class BadIndexTest(unittest.TestCase):
    """UC-CompleteTodo / UC-RemoveTodo: non-integer and out-of-range indices."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.store_path = os.path.join(self.tmpdir.name, "todo.json")
        run_todo(self.store_path, "add", "a")
        run_todo(self.store_path, "add", "b")

    def tearDown(self):
        self.tmpdir.cleanup()

    def _store_snapshot(self):
        with open(self.store_path) as f:
            return json.load(f)

    def test_done_non_integer(self):
        before = self._store_snapshot()
        p = run_todo(self.store_path, "done", "abc")
        self.assertEqual(p.returncode, 1)
        self.assertEqual(p.stderr, "error: invalid item number 'abc'\n")
        self.assertEqual(p.stdout, "")
        self.assertEqual(self._store_snapshot(), before)

    def test_done_out_of_range(self):
        before = self._store_snapshot()
        p = run_todo(self.store_path, "done", "9")
        self.assertEqual(p.returncode, 1)
        self.assertEqual(p.stderr, "error: no item 9 (list has 2 items)\n")
        self.assertEqual(p.stdout, "")
        self.assertEqual(self._store_snapshot(), before)

    def test_done_zero(self):
        before = self._store_snapshot()
        p = run_todo(self.store_path, "done", "0")
        self.assertEqual(p.returncode, 1)
        self.assertEqual(p.stderr, "error: no item 0 (list has 2 items)\n")
        self.assertEqual(self._store_snapshot(), before)

    def test_rm_non_integer(self):
        before = self._store_snapshot()
        p = run_todo(self.store_path, "rm", "xyz")
        self.assertEqual(p.returncode, 1)
        self.assertEqual(p.stderr, "error: invalid item number 'xyz'\n")
        self.assertEqual(p.stdout, "")
        self.assertEqual(self._store_snapshot(), before)

    def test_rm_out_of_range(self):
        before = self._store_snapshot()
        p = run_todo(self.store_path, "rm", "5")
        self.assertEqual(p.returncode, 1)
        self.assertEqual(p.stderr, "error: no item 5 (list has 2 items)\n")
        self.assertEqual(p.stdout, "")
        self.assertEqual(self._store_snapshot(), before)


class CorruptedStoreUniformTest(unittest.TestCase):
    """Scenario: Corrupted store rejected uniformly across commands."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.store_path = os.path.join(self.tmpdir.name, "todo.json")

    def tearDown(self):
        self.tmpdir.cleanup()

    def _seed_invalid_json(self):
        with open(self.store_path, "w") as f:
            f.write("not valid json")

    def _assert_corrupted_rejection(self, p, before_bytes):
        self.assertEqual(p.returncode, 1)
        self.assertRegex(p.stderr, r"^error: corrupted store at .*\n$")
        self.assertNotIn("Traceback", p.stderr)
        self.assertEqual(p.stdout, "")
        with open(self.store_path, "rb") as f:
            after_bytes = f.read()
        self.assertEqual(after_bytes, before_bytes)

    def test_corrupted_store_rejected_uniformly(self):
        self._seed_invalid_json()
        with open(self.store_path, "rb") as f:
            seeded_bytes = f.read()

        for args in (("add", "x"), ("list",), ("done", "1"), ("rm", "1")):
            with self.subTest(args=args):
                p = run_todo(self.store_path, *args)
                self._assert_corrupted_rejection(p, seeded_bytes)

    def test_corrupted_store_valid_json_wrong_shape(self):
        with open(self.store_path, "w") as f:
            json.dump({"not": "a list"}, f)
        with open(self.store_path, "rb") as f:
            seeded_bytes = f.read()

        for args in (("add", "x"), ("list",), ("done", "1"), ("rm", "1")):
            with self.subTest(args=args):
                p = run_todo(self.store_path, *args)
                self._assert_corrupted_rejection(p, seeded_bytes)


class StorePathFallbackTest(unittest.TestCase):
    """UC-AddTodo INV-05: $TODO_STORE unset falls back to ~/.todo.json."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_unset_todo_store_falls_back_to_home(self):
        p = run_todo(None, "add", "x", unset_store=True, home=self.tmpdir.name)
        self.assertEqual(p.returncode, 0)
        expected_path = os.path.join(self.tmpdir.name, ".todo.json")
        self.assertTrue(os.path.exists(expected_path))
        with open(expected_path) as f:
            data = json.load(f)
        self.assertEqual(data, [{"text": "x", "done": False}])


if __name__ == "__main__":
    unittest.main()
