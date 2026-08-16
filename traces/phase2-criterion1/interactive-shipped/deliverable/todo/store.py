"""TodoStoreRepository — load/save the JSON store file.

Per contracts/todo-store.contract.md and Orient's spike-store-persistence.md.
"""
import json
import os
import tempfile


class StoreCorruptedError(RuntimeError):
    """Raised when the store file exists but is not valid JSON, or its root
    is valid JSON but not a list."""


def default_store_path():
    """Return $TODO_STORE verbatim when set; otherwise ~/.todo.json.

    An empty (but set) $TODO_STORE is a scripting bug, not a silent
    fallback to the real store — raise so the caller reports a clean
    error instead of writing to ~/.todo.json.
    """
    env_val = os.environ.get("TODO_STORE")
    if env_val is None:
        return os.path.expanduser("~/.todo.json")
    if env_val == "":
        raise ValueError("$TODO_STORE is set but empty")
    return env_val


def load(path):
    """Return the list of items at path, or [] if the file does not exist.

    Raises StoreCorruptedError if the file exists but is invalid JSON, its
    root is not a list, or an element is missing a required key.
    """
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r") as f:
            data = json.load(f)
        if not isinstance(data, list):
            raise ValueError("store root is not a list")
        for item in data:
            if not isinstance(item, dict) or "text" not in item or "done" not in item:
                raise ValueError("store item missing required key")
        return data
    except (json.JSONDecodeError, ValueError) as e:
        raise StoreCorruptedError(f"corrupted store at {path}: {e}")


def save(path, items):
    """Atomically write items (the full list) to path."""
    d = os.path.dirname(path) or "."
    fd, tmp = tempfile.mkstemp(dir=d)
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(items, f)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
