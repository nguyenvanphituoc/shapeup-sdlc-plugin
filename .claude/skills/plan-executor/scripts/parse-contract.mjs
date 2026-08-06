#!/usr/bin/env node
// The one parser for an execution contract's `## Acceptance` table — the parser both readers
// (the acceptance verifier and the stage executor) go through, so a cell's `\|` escaping
// decodes the same way for both. Before this, each read the markdown table by eye: one
// unescaped `\|` to a literal pipe, the other split on it as a column separator, and the
// divergence produced a comment written to satisfy a grep rather than a fix.
//
// Usage:
//   node parse-contract.mjs <contract.md> [--stage=<id>]   prints matching rows as JSON
//   node parse-contract.mjs --selftest                     exercises the escaping rule itself

import { readFileSync } from 'node:fs';

const COLUMNS = ['stage', 'cmd', 'cwd', 'expect_exit', 'expect_match', 'expect_absent', 'note', 'review'];

// The one escaping rule the format defines: a literal pipe inside a cell is written `\|`.
// Anything else is a column separator.
export function splitRow(line) {
  const cells = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\' && line[i + 1] === '|') { cur += '|'; i++; continue; }
    if (line[i] === '|') { cells.push(cur); cur = ''; continue; }
    cur += line[i];
  }
  cells.push(cur);
  // A well-formed table row opens and closes with `|`, which produces one empty artifact cell
  // on each end — drop those, keep the columns between them.
  return cells.slice(1, -1).map((c) => c.trim());
}

// Reads the `## Acceptance` table out of a contract.md and returns one object per row, in
// table order, with every column present (as an empty string when the cell was blank).
export function parseContract(contractPath) {
  const src = readFileSync(contractPath, 'utf8');
  const afterHeading = src.split('\n## Acceptance')[1];
  if (afterHeading === undefined) throw new Error(`${contractPath} has no "## Acceptance" section`);
  const body = afterHeading.split('\n## Guardrails')[0];
  return body
    .split('\n')
    .filter((l) => l.trim().startsWith('|'))
    .map(splitRow)
    .filter((c) => c.length >= COLUMNS.length && c[0] !== 'stage' && !/^-+$/.test(c[0]))
    .map((c) => Object.fromEntries(COLUMNS.map((k, i) => [k, c[i] || ''])));
}

export function rowsForStage(contractPath, stageId) {
  return parseContract(contractPath).filter((r) => r.stage === stageId);
}

// ---------------------------------------------------------------------------
// selftest — the case that matters is the escaped pipe inside a `cmd` cell. Two independently
// written readers disagreeing on it is the defect this file exists to close; this proves the
// one parser decodes it the same way every time, not just once by inspection.
// ---------------------------------------------------------------------------
function selftest() {
  const cases = [
    {
      name: 'plain row, no escapes',
      line: '| S0 | npm test | $CLONE | 0 | ok | forbidden | a note | |',
      expect: ['S0', 'npm test', '$CLONE', '0', 'ok', 'forbidden', 'a note', ''],
    },
    {
      name: 'escaped pipe inside a cmd cell',
      line: '| S2 | node -e "a\\|b" | $CLONE | 0 |  |  | rule 1 | |',
      expect: ['S2', 'node -e "a|b"', '$CLONE', '0', '', '', 'rule 1', ''],
    },
    {
      name: 'two escaped pipes in one cmd cell',
      line: '| S1 | node -e "x\\|y\\|z" | $CLONE | 1 |  |  |  | |',
      expect: ['S1', 'node -e "x|y|z"', '$CLONE', '1', '', '', '', ''],
    },
    {
      name: 'an escaped pipe does not create an extra column',
      // If `\|` were mis-read as a plain separator this row would parse to 9 columns, not 8.
      line: '| S4 | echo a\\|b\\|c | $CLONE | 0 |  |  |  | |',
      expect: ['S4', 'echo a|b|c', '$CLONE', '0', '', '', '', ''],
    },
  ];

  let failed = 0;
  for (const c of cases) {
    const got = splitRow(c.line);
    const ok = JSON.stringify(got) === JSON.stringify(c.expect);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
    if (!ok) {
      failed++;
      console.log(`      got:      ${JSON.stringify(got)}`);
      console.log(`      expected: ${JSON.stringify(c.expect)}`);
    }
  }

  if (failed) {
    console.log(`\nFAIL  ${failed}/${cases.length} selftest case(s) failed`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nescaped pipe inside a cell decodes the same way every time (${cases.length}/${cases.length} passed)`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) {
    selftest();
  } else {
    const stageFlag = argv.find((a) => a.startsWith('--stage='));
    const contractPath = argv.find((a) => !a.startsWith('--'));
    if (!contractPath) {
      console.error('usage: parse-contract.mjs <contract.md> [--stage=<id>] | --selftest');
      process.exitCode = 1;
    } else {
      const rows = stageFlag ? rowsForStage(contractPath, stageFlag.slice('--stage='.length)) : parseContract(contractPath);
      console.log(JSON.stringify(rows, null, 2));
    }
  }
}
