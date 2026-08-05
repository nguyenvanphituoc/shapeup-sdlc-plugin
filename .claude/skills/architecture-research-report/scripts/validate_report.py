#!/usr/bin/env python3
"""Lint an architecture research report.

Checks the mechanical failures that are tedious to catch by rereading:
  * Mermaid syntax errors that break rendering (the top cause of broken reports)
  * Missing spine sections (negative space and falsifiers are the ones usually dropped)
  * Citation density -- claims the reader cannot check
  * Hedge phrases that signal an unformed position

Usage:  python3 validate_report.py REPORT.md [REPORT2.md ...]
        python3 validate_report.py --quiet REPORT.md   # errors only

Exit code 1 if any ERROR was found; WARN and INFO do not fail the run.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

# --------------------------------------------------------------------------- model

ERROR, WARN, INFO = "ERROR", "WARN", "INFO"


@dataclass
class Finding:
    level: str
    line: int
    message: str
    hint: str = ""


@dataclass
class Report:
    path: Path
    text: str
    findings: list[Finding] = field(default_factory=list)

    def add(self, level: str, line: int, message: str, hint: str = "") -> None:
        # Several patterns can flag the same defect; report each one once.
        if any(f.line == line and f.message == message for f in self.findings):
            return
        self.findings.append(Finding(level, line, message, hint))


# --------------------------------------------------------------------------- mermaid

# Longest openers first so `[(` is not mistaken for `[`.
LABEL_DELIMS: list[tuple[str, str]] = [
    ("[(", ")]"), ("((", "))"), ("[[", "]]"), ("]]", "]]"),
    ("{{", "}}"), ("([", "])"), ("[/", "/]"), ("[\\", "\\]"),
    ("[", "]"), ("(", ")"), ("{", "}"),
]

# Words that break when used as a flowchart node id. `o` and `x` are deliberately
# excluded: they only misparse when glued directly to an edge (`A---oB`), and treating
# them as reserved produces false positives on ordinary ids like `X2`.
RESERVED_IDS = {
    "end", "graph", "subgraph", "class", "classdef", "click", "style",
    "linkstyle",
}

FLOWCHART_KINDS = ("flowchart", "graph")

DIAGRAM_KINDS = (
    "flowchart", "graph", "sequencediagram", "classdiagram", "statediagram",
    "statediagram-v2", "erdiagram", "journey", "gantt", "pie", "quadrantchart",
    "requirementdiagram", "gitgraph", "mindmap", "timeline", "zenuml",
    "sankey-beta", "xychart-beta", "block-beta", "packet-beta", "kanban",
    "architecture-beta", "radar-beta", "treemap-beta", "c4context", "c4container",
    "c4component", "c4dynamic", "c4deployment",
)

BREAKING_IN_LABEL = set("()[]{}")


def _strip_strings(s: str) -> str:
    """Blank out quoted spans so their contents are not inspected."""
    return re.sub(r'"[^"]*"', lambda m: " " * len(m.group(0)), s)


def _extract_labels(line: str) -> list[tuple[int, str, str]]:
    """Return (col, opener, inner_text) for each node/edge label on the line."""
    out: list[tuple[int, str, str]] = []
    i, n = 0, len(line)
    while i < n:
        for open_d, close_d in LABEL_DELIMS:
            if line.startswith(open_d, i):
                depth, j = 1, i + len(open_d)
                while j < n and depth:
                    if line.startswith(close_d, j):
                        depth -= 1
                        if depth == 0:
                            break
                        j += len(close_d)
                    elif line.startswith(open_d, j):
                        depth += 1
                        j += len(open_d)
                    else:
                        j += 1
                if j < n:
                    out.append((i, open_d, line[i + len(open_d): j]))
                    i = j + len(close_d)
                    break
                i += len(open_d)
                break
        else:
            i += 1
    return out


def _edge_label_spans(line: str) -> list[str]:
    """Text between the pipes of an edge label: A -->|text| B."""
    return re.findall(r"\|([^|]*)\|", line)


def check_mermaid_block(rep: Report, body: list[str], start_line: int, index: int) -> None:
    tag = f"mermaid block #{index}"
    meaningful = [
        (k, ln) for k, ln in enumerate(body)
        if ln.strip() and not ln.strip().startswith("%%")
    ]
    if not meaningful:
        rep.add(ERROR, start_line, f"{tag} is empty")
        return

    first_off, first = meaningful[0]
    kind = first.strip().split()[0].lower().rstrip(";")
    if kind not in DIAGRAM_KINDS:
        rep.add(
            ERROR, start_line + first_off + 1,
            f"{tag} does not begin with a diagram type (found {first.strip()[:40]!r})",
            "First line must be flowchart/sequenceDiagram/erDiagram/... "
            "Renderers fail closed on an unknown type.",
        )
        return

    is_flow = kind in FLOWCHART_KINDS
    depth, node_ids = 0, set()

    for off, raw in meaningful:
        lineno = start_line + off + 1
        stripped = raw.strip()
        low = stripped.lower()

        # Only flowcharts pair `subgraph`/`end`. In sequence diagrams `end` closes
        # loop/alt/opt/par/critical/rect, and in class diagrams it closes namespaces --
        # counting those here produces false "unmatched end" errors.
        if is_flow:
            if low.startswith("subgraph"):
                depth += 1
            elif low == "end" or low.startswith("end "):
                depth -= 1
                if depth < 0:
                    rep.add(ERROR, lineno, f"{tag}: `end` without a matching `subgraph`")
                    depth = 0
        else:
            continue

        scrubbed = _strip_strings(stripped)

        # Bare `->` arrows: flowchart needs at least two dashes.
        if re.search(r"(?<![-.<>=])->", scrubbed):
            rep.add(
                ERROR, lineno, f"{tag}: `->` is not a valid flowchart arrow",
                "Use `-->` (solid), `-.->` (dotted) or `==>` (thick).",
            )

        # Unquoted characters that terminate a label early.
        for _, open_d, inner in _extract_labels(stripped):
            t = inner.strip()
            if t.startswith('"') and t.endswith('"') and len(t) >= 2:
                continue
            bad = sorted(BREAKING_IN_LABEL & set(t))
            if bad:
                rep.add(
                    ERROR, lineno,
                    f"{tag}: label {t[:40]!r} contains unquoted {' '.join(bad)}",
                    'Wrap the label in double quotes: A["Ingest (batch)"]',
                )
            if "\\n" in t:
                rep.add(
                    WARN, lineno, f"{tag}: label uses `\\n` for a line break",
                    "Mermaid needs `<br/>`.",
                )

        for lab in _edge_label_spans(scrubbed):
            t = lab.strip()
            if t and not (t.startswith('"') and t.endswith('"')):
                bad = sorted(BREAKING_IN_LABEL & set(t))
                if bad:
                    rep.add(
                        ERROR, lineno,
                        f"{tag}: edge label {t[:40]!r} contains unquoted {' '.join(bad)}",
                        'Quote it: A -->|"retry (3x)"| B',
                    )

        # Node ids: an identifier immediately before a label opener, or after an arrow.
        for m in re.finditer(r"(?:^|[\s|])([A-Za-z_][\w-]*)\s*(?=[\[\(\{])", scrubbed):
            node_ids.add(m.group(1))
            if m.group(1).lower() in RESERVED_IDS:
                rep.add(
                    ERROR, lineno,
                    f"{tag}: `{m.group(1)}` is a reserved word and cannot be a node id",
                    "Rename it (e.g. `n_end`). Lowercase `end` silently closes the subgraph.",
                )
        endpoint_res = [
            r"(?:-->|---|-\.->|==>|===)\s*([A-Za-z_][\w-]*)",   # A --> B
            r"\|[^|]*\|\s*([A-Za-z_][\w-]*)",                    # A -->|label| B
        ]
        for pat in endpoint_res:
            for m in re.finditer(pat, scrubbed):
                node_ids.add(m.group(1))
                if m.group(1).lower() in RESERVED_IDS:
                    rep.add(
                        ERROR, lineno,
                        f"{tag}: `{m.group(1)}` is a reserved word and cannot be a node id",
                        "Rename it (e.g. `n_end`). Lowercase `end` silently closes "
                        "the enclosing subgraph.",
                    )

    if depth > 0:
        rep.add(ERROR, start_line, f"{tag}: {depth} unclosed `subgraph` (missing `end`)")

    if is_flow and len(node_ids) > 15:
        rep.add(
            INFO, start_line,
            f"{tag}: {len(node_ids)} nodes -- past ~15 a diagram stops being readable",
            "Split it by concern and cross-reference.",
        )


def check_all_mermaid(rep: Report) -> int:
    lines = rep.text.splitlines()
    count, i = 0, 0
    while i < len(lines):
        m = re.match(r"^\s*```+\s*mermaid\s*$", lines[i], re.I)
        if not m:
            i += 1
            continue
        fence_start = i
        j = i + 1
        while j < len(lines) and not re.match(r"^\s*```+\s*$", lines[j]):
            j += 1
        if j >= len(lines):
            rep.add(ERROR, fence_start + 1, "unclosed ```mermaid fence")
            break
        count += 1
        check_mermaid_block(rep, lines[i + 1: j], fence_start + 1, count)
        i = j + 1
    return count


# --------------------------------------------------------------------------- structure

SECTION_PATTERNS: list[tuple[str, str, str, str]] = [
    ("finding",
     r"(finding|diagnos|executive|bottom line|the answer|in one paragraph|tl;?dr)",
     WARN,
     "No lead finding section. A report that makes the reader hunt for the conclusion "
     "gets skimmed instead of decided from. See SKILL.md Phase 2."),
    ("negative space",
     r"(not to (do|build|adopt)|don'?t build|deliberately not|avoid|out of scope|"
     r"non-goals?|what we are not)",
     WARN,
     "No negative-space section. Saying what NOT to build is the section that proves you "
     "modelled cost, and experienced readers check it first."),
    ("falsifiers",
     r"(change (this|the|my) answer|falsif|revisit|open questions?|what would|"
     r"when to reconsider|review trigger|assumptions?|risks? to this)",
     WARN,
     "No 'what would change this answer' section. Without it the report cannot be "
     "re-evaluated when the facts move."),
    ("recommendation",
     r"(recommend|proposal|roadmap|plan|next steps?|the pick|decision)",
     WARN,
     "No recommendation section. You were asked because a decision is pending."),
]

HEDGES: list[tuple[str, str]] = [
    (r"\bit depends\b(?!\s+on\b)", "'It depends' without naming what it depends on"),
    (r"\bmay(?:\s+\w+){0,2}\s+potentially\b", "doubled hedge ('may ... potentially')"),
    (r"\bcould potentially\b", "doubled hedge ('could potentially')"),
    (r"\bmight possibly\b", "doubled hedge ('might possibly')"),
    (r"\bboth (?:options|approaches|solutions) have (?:their )?(?:pros and cons|"
     r"strengths and weaknesses|merits)\b", "manufactured balance"),
    (r"\bdepends on your (?:specific )?(?:use ?case|needs|requirements)\b",
     "deferring the judgement back to the reader"),
    (r"\bin (?:today'?s|this) (?:fast[- ]paced|ever[- ]changing|rapidly evolving)\b",
     "filler opener"),
    (r"\bit(?:'s| is) (?:important|worth) (?:to )?(?:note|noting|considering) that\b",
     "throat-clear"),
    (r"\bleverag(?:e|ing) synerg", "consultant filler"),
    (r"\brobust,? scalable,? and\b", "adjective stack with no measurement"),
    (r"\bbest[- ]in[- ]class\b", "unfalsifiable superlative"),
    (r"\bcomprehensive (?:analysis|overview|report) of\b", "promise instead of a claim"),
    (r"\bseveral (?:considerations|factors) (?:to consider|exist)\b", "unformed position"),
]

CITATION_PATTERNS = [
    r"`[^`\n]*\.\w{1,5}:\d+`",          # file.py:412
    r"`[^`\n]*\.(?:py|ts|js|mjs|go|rs|java|rb|sql|yaml|yml|json|md|tf)`",
    r"\[[^\]\n]+\]\((?:https?|\.{0,2}/)[^)\n]+\)",   # markdown link
    r"§\s*[\w.]+",                       # §VI.G
    r"\*\*Inference:?\*\*",
    r"\b20\d{2}-\d{2}(?:-\d{2})?\b",     # dated evidence
    r"\bv?\d+\.\d+(?:\.\d+)?\b",         # version number
    r"\bp(?:50|95|99)\b",                # latency percentile
]


def check_structure(rep: Report, mermaid_count: int) -> None:
    lines = rep.text.splitlines()
    headings = [(i + 1, ln.lstrip("#").strip()) for i, ln in enumerate(lines)
                if re.match(r"^#{1,4}\s", ln)]
    heading_blob = "\n".join(h for _, h in headings).lower()

    if not headings:
        rep.add(ERROR, 1, "no markdown headings found -- is this a report?")
        return

    head = "\n".join(lines[:40]).lower()
    if not re.search(r"\*{0,2}(question|decision|scope|sources?)\*{0,2}\s*:", head):
        rep.add(
            WARN, 1,
            "no metadata block near the top (Question / Scope / Sources / Confidence)",
            "A reader six months from now cannot tell whether this is still valid.",
        )

    for name, pattern, level, hint in SECTION_PATTERNS:
        if not re.search(pattern, heading_blob):
            rep.add(WARN, 1, f"no {name} section found", hint)

    if mermaid_count == 0:
        rep.add(
            WARN, 1, "no Mermaid diagrams",
            "At minimum an architecture or flow diagram usually earns its place. "
            "If prose genuinely carries it, ignore this.",
        )

    # Hedges -- skip fenced code.
    in_fence = False
    for i, ln in enumerate(lines, 1):
        if re.match(r"^\s*```", ln):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        low = ln.lower()
        for pattern, label in HEDGES:
            m = re.search(pattern, low)
            if m:
                rep.add(WARN, i, f"hedge/filler: {label} -- {m.group(0)!r}",
                        "See references/report-craft.md §8 for rewrites.")

    # Citation density.
    prose = re.sub(r"```.*?```", "", rep.text, flags=re.S)
    citations = sum(len(re.findall(p, prose)) for p in CITATION_PATTERNS)
    sections = max(1, len([h for _, h in headings]))
    per_section = citations / sections
    if per_section < 1.0:
        rep.add(
            WARN, 1,
            f"low citation density: {citations} checkable references across "
            f"{sections} sections ({per_section:.1f}/section)",
            "Every load-bearing claim needs a file:line, a measured number, a §-ref, "
            "or an explicit **Inference:** marker.",
        )
    else:
        rep.add(INFO, 1,
                f"citation density: {citations} references across {sections} sections "
                f"({per_section:.1f}/section)")

    words = len(re.findall(r"\b\w+\b", prose))
    rep.add(INFO, 1, f"length: ~{words} words, {sections} sections, "
                     f"{mermaid_count} diagram(s)")


# --------------------------------------------------------------------------- output

COLOR = {ERROR: "\033[31m", WARN: "\033[33m", INFO: "\033[36m"}
RESET = "\033[0m"


def emit(rep: Report, quiet: bool, color: bool) -> tuple[int, int]:
    order = {ERROR: 0, WARN: 1, INFO: 2}
    findings = sorted(rep.findings, key=lambda f: (order[f.level], f.line))
    if quiet:
        findings = [f for f in findings if f.level == ERROR]

    print(f"\n\033[1m{rep.path}\033[0m" if color else f"\n{rep.path}")
    if not findings:
        print("  clean")
    for f in findings:
        tag = f"{COLOR[f.level]}{f.level:<5}{RESET}" if color else f"{f.level:<5}"
        print(f"  {tag} line {f.line}: {f.message}")
        if f.hint:
            print(f"        -> {f.hint}")

    errs = sum(1 for f in rep.findings if f.level == ERROR)
    warns = sum(1 for f in rep.findings if f.level == WARN)
    return errs, warns


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("reports", nargs="+", type=Path)
    ap.add_argument("--quiet", action="store_true", help="show errors only")
    ap.add_argument("--no-color", action="store_true")
    args = ap.parse_args()

    color = sys.stdout.isatty() and not args.no_color
    total_e = total_w = 0

    for path in args.reports:
        if not path.exists():
            print(f"{path}: not found", file=sys.stderr)
            total_e += 1
            continue
        rep = Report(path, path.read_text(encoding="utf-8", errors="replace"))
        n = check_all_mermaid(rep)
        check_structure(rep, n)
        e, w = emit(rep, args.quiet, color)
        total_e += e
        total_w += w

    print(f"\n{total_e} error(s), {total_w} warning(s)")
    return 1 if total_e else 0


if __name__ == "__main__":
    sys.exit(main())
