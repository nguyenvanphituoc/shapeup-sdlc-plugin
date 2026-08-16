"""Command implementations for the todo CLI: add, list, done, rm."""
from todo import store


def add(path, text):
    items = store.load(path)
    items.append({"text": text, "done": False})
    store.save(path, items)
    print(f"added #{len(items)}: {text}")


def list_(path):
    items = store.load(path)
    if not items:
        print("(no items)")
        return
    lines = []
    for i, item in enumerate(items):
        marker = "x" if item["done"] else " "
        lines.append(f"{i + 1}. [{marker}] {item['text']}")
    print("\n".join(lines))


def _parse_index(n, items):
    """Parse n as an integer and validate it's in range [1, len(items)].

    Returns the validated integer, or raises ValueError with a message ready
    to print after "error: ".
    """
    try:
        idx = int(n)
    except (ValueError, TypeError):
        raise ValueError(f"invalid item number '{n}'")
    if idx < 1 or idx > len(items):
        raise ValueError(f"no item {idx} (list has {len(items)} items)")
    return idx


def done(path, n):
    items = store.load(path)
    idx = _parse_index(n, items)
    items[idx - 1]["done"] = True
    store.save(path, items)
    print(f"done #{idx}: {items[idx - 1]['text']}")


def rm(path, n):
    items = store.load(path)
    idx = _parse_index(n, items)
    removed = items.pop(idx - 1)
    store.save(path, items)
    print(f"removed #{idx}: {removed['text']}")
