// Builds results/evaluate-r2.json from the evaluator's round-2 grades. Usage: node gen-result-r2.mjs <projectRoot>
// T0 digests are recomputed here from the files on disk (node:crypto), never copied.
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const ROOT = process.argv[2];
const EV = '.shapeup/envlint/evaluation/evidence/probe-r2.json';
const EX = '.shapeup/envlint/evaluation/evidence/probe-r2-extra.json';
const P = (c, d, e, t = [], conf = 'high') => ({ criterion: c, dimension: d, verdict: 'PASS', confidence: conf, reprobed: false, evidence: e, traces_to: t });
const TS = 'test-surface-conformance', SC = 'spec-conformance', TD = 'tdd-surface', CM = 'completeness';
const ev = (k, s) => `${s} [evaluator probe ${EV} key ${k}]`;
const sha = (p) => createHash('sha256').update(readFileSync(join(ROOT, p))).digest('hex');

const criteria = [
  // UC-01 Test Surface (scope parsing, not reopened; re-run anyway)
  P('UC-01 / TS-INV-01', TS, ev('UC01/TS-INV-01', 'blank/comment/assignment text: A@3, B@5, problem@6, C@8 = physical lines'), ['REQ-15']),
  P('UC-01 / TS-INV-02', TS, ev('UC01/TS-INV-02', 'src/parse.mjs has no import/require; two calls on same input give identical results'), ['REQ-16', 'REQ-22']),
  P('UC-01 / TS-INV-03', TS, ev('UC01/TS-INV-03', 'A=${HOME}/x -> value "${HOME}/x" literal'), ['REQ-26']),
  P('UC-01 / TS-INV-04', TS, ev('UC01/TS-INV-04', '"", "\\n\\n", "=", "\'", BOM, CRLF (+ NUL, bare export) all return {pairs, problems} arrays, none threw'), ['REQ-15']),
  P('UC-01 / TS-ERR-MISSING_EQUALS', TS, ev('UC01/TS-ERR-MISSING_EQUALS', 'JUSTAKEY on line 2 -> {line:2, message:"missing \'=\'"}'), ['REQ-15']),
  P('UC-01 / TS-ERR-INVALID_KEY', TS, ev('UC01/TS-ERR-INVALID_KEY', '1BAD=x and =x -> invalid key at lines 1 and 2'), ['REQ-15']),
  P('UC-01 / TS-ERR-UNTERMINATED_QUOTE', TS, ev('UC01/TS-ERR-UNTERMINATED_QUOTE', 'A="abc and B=\'x -> unterminated quote at lines 1 and 2'), ['REQ-14']),
  // UC-02 Test Surface (scope rules, reopened)
  P('UC-02 / TS-INV-01', TS, ev('UC02/TS-INV-01', 'src/rules.mjs: no import, no network/fs reference; url on http://unreachable.invalid -> no finding'), ['REQ-20', 'REQ-22', 'REQ-30', 'REQ-31']),
  P('UC-02 / TS-INV-02', TS, ev('UC02/TS-INV-02', 'A on lines 1 and 3, failing int on line 3 -> exactly one finding line 3'), ['REQ-17']),
  P('UC-02 / TS-INV-03', TS, ev('UC02/TS-INV-03', 'EXTRA not in schema -> [] findings'), ['REQ-17']),
  P('UC-02 / TS-INV-04', TS, ev('UC02/TS-INV-04', 'new row: checkSchema on {U:{type:url,enum:[...]},R:{required:true},E:{type:string}} -> []; checkPairs on C1 pairs U="::::", E="", and on keys __proto__/constructor/toString -> returned findings, no throw; also JSON-parsed schema keyed __proto__/constructor/toString/hasOwnProperty -> checkSchema [] and checkPairs did not throw. Generator check test/rules.test.mjs:137 asserts the same (deepEqual [] + doesNotThrow), named PASS in T0 r2-a1-t1'), ['REQ-17']),
  P('UC-02 / TS-ERR-REQUIRED_MISSING', TS, ev('UC02/TS-ERR-REQUIRED_MISSING', '{key:"PORT", line:null, rule:"required", message:"required key is missing"}'), ['REQ-17']),
  P('UC-02 / TS-ERR-TYPE_MISMATCH', TS, ev('UC02/TS-ERR-TYPE_MISMATCH', 'type finding for int 1.0/0x10/1e3/""/" 7", bool yes, url localhost:3000/javascript:alert(1)/file:///etc'), ['REQ-18', 'REQ-31']),
  P('UC-02 / TS-REQ-type-boundary', TS, ev('UC02/TS-REQ-type-boundary', 'int 0/-5/42, bool true/false, url https://a.example/x, string "" -> no finding'), ['REQ-18']),
  P('UC-02 / TS-ERR-ENUM_MISMATCH', TS, ev('UC02/TS-ERR-ENUM_MISMATCH', 'enum [dev,prod]: Dev and staging -> enum finding each; dev -> none'), ['REQ-19']),
  P('UC-02 / TS-ERR-SCHEMA_INVALID', TS, ev('UC02/TS-ERR-SCHEMA_INVALID', '[], null, type float, enum [], required "yes", min:1 -> non-empty errors; {} and a valid schema -> []'), ['REQ-1']),
  // UC-03 Test Surface (scope cli, reopened; oracle: process)
  P('UC-03 / TS-INV-01', TS, ev('UC03/TS-INV-01', '17 argv/error/garbage cases: no stack lines; exit 2 cases print one envlint: line (+usage); garbage env -> findings exit 1'), ['REQ-7']),
  P('UC-03 / TS-INV-02', TS, ev('UC03/TS-INV-02', 'stdout "e.env:2: PORT: expected int, got \\"abc\\"\\ne.env: TOKEN: required key is missing\\n", exit 1'), ['REQ-2', 'REQ-3']),
  P('UC-03 / TS-INV-03', TS, ev('UC03/TS-INV-03', 'comments/blank-only env: schema {} -> exit 0 empty stdout; required A -> exit 1 "e.env: A: required key is missing"'), ['REQ-6']),
  P('UC-03 / TS-INV-04', TS, ev('UC03/TS-INV-04', 'cwd listing [e.env, s.json] before and after 4 runs; no .env created'), ['REQ-25']),
  P('UC-03 / TS-INV-05', TS, `BUG-1 fixed: findings runs with ESC in an env value, an enum member, a schema key, the env path, the schema path, a missing env path and an unknown flag, plus a C1 CSI (U+009B) value -> raw-Buffer check finds no 0x1b, no 0x9b, no 0x07 in stdout or stderr; ESC rendered as text "\\x1b" [${EV} key UC03/TS-INV-05-bug1]. Stdin not awaited: async spawn with the stdin pipe never ended exited 1 on its own, twice [${EX} key stdinHeldOpen]`, ['REQ-2', 'REQ-28', 'REQ-29']),
  P('UC-03 / TS-ERR-USAGE', TS, ev('UC03/TS-ERR-USAGE', 'no args, --schema s.json alone, two positionals, --color, no --schema, duplicate --schema -> exit 2, stderr "envlint: ..." + "usage: envlint --schema <schema.json> <envfile>"'), ['REQ-8', 'REQ-21']),
  P('UC-03 / TS-ERR-ENV_NOT_FOUND', TS, ev('UC03/TS-ERR-ENV_NOT_FOUND', 'exit 2, stderr "envlint: cannot read env file missing.env: ENOENT"'), ['REQ-4', 'REQ-7']),
  P('UC-03 / TS-ERR-ENV_UNREADABLE', TS, ev('UC03/TS-ERR-ENV_UNREADABLE', 'directory -> exit 2, stderr "envlint: cannot read env file adir: EISDIR"'), ['REQ-7']),
  P('UC-03 / TS-ERR-SCHEMA_NOT_FOUND', TS, ev('UC03/TS-ERR-SCHEMA_NOT_FOUND', 'exit 2, stderr "envlint: cannot read schema file missing.json: ENOENT"'), ['REQ-5', 'REQ-7']),
  P('UC-03 / TS-ERR-SCHEMA_INVALID_JSON', TS, ev('UC03/TS-ERR-SCHEMA_INVALID_JSON', 'exit 2, stderr "envlint: invalid schema bad.json: not valid JSON"'), ['REQ-5', 'REQ-7']),
  P('UC-03 / TS-ERR-SCHEMA_INVALID', TS, ev('UC03/TS-ERR-SCHEMA_INVALID', 'exit 2, stderr "envlint: invalid schema inv.json: A: \\"type\\" must be one of string, int, bool, url"'), ['REQ-5', 'REQ-7']),
  P('UC-03 / TS-ERR-FINDINGS', TS, ev('UC03/TS-ERR-FINDINGS', 'stdout "e.env:3: parse error: missing \'=\'", exit 1'), ['REQ-2', 'REQ-3']),
  P('UC-03 / TS-NOGO-01', TS, ev('UC03/TS-NOGO-01', 'cwd holds .env with a type violation; --schema s.json alone -> exit 2 usage, empty stdout, no findings'), ['REQ-8', 'REQ-9']),
  P('UC-03 / TS-NOGO-02', TS, ev('UC03/TS-NOGO-02', 'A=${HOME} vs enum ["${HOME}"] -> exit 0, empty stdout'), ['REQ-26']),
  P('TSC-2: UC-02 Test Surface covers its own Invariants', TS, 'BUG-3 fixed: UC-02 Invariants INV-01..04 (shapeup/envlint/spec/usecases/UC-02-check-pairs-against-schema.md:34-37) each have a TS-INV row (:57-60, TS-INV-04 at :60 sourced "D1: INV-04"); every Error Case code has a TS-ERR row; every row cites D1-D4. UC-01 and UC-03 unchanged and complete.', []),
  // spec-conformance
  P('UC-01 Steps 1-6 + C1 line rules', SC, ev('UC01/steps', 'KEY=value; quoted inner text verbatim (no escapes); unquoted "x # not a comment" kept; trimmed values; F=a=b split at first =; mismatched/lone quote -> unterminated; export+tab removed; duplicates kept in order'), ['REQ-10', 'REQ-11', 'REQ-12', 'REQ-13', 'REQ-14']),
  P('UC-02 Steps 1-5 + C3 ordering/messages', SC, ev('UC02/steps', 'type then enum on one key; lined ascending then required in schema key order (Z, Y); enum message "expected one of a, b, c, got \\"q\\""; url http:// rejected, https://x accepted'), ['REQ-17', 'REQ-18', 'REQ-19']),
  P('UC-02 INV-04 (behavior)', SC, ev('UC02/TS-INV-04', 'checkSchema/checkPairs on accepted schemas incl. prototype-named keys and C1 pairs with "::::" / "" values: no throw (6 calls)'), ['REQ-17']),
  P('UC-03 Steps 1-6 + ux-behavior output order', SC, ev('UC03/output-order', 'K type+enum at line 1, parse error line 2, K2 enum line 3, then Z, Y required; --schema=<path> accepted; exit 0/1/2 per state table'), ['REQ-2', 'REQ-3', 'REQ-21']),
  P('UC-03 INV-05 (no ANSI escape sequences in output)', SC, `bin/envlint.mjs:12-13 renders every C0/DEL/C1 control byte as \\xNN text, applied to all stdout lines (:76) and stderr lines (:84, :86); probes across 8 user-controlled channels show no 0x1b/0x9b/0x07 byte [${EV} key UC03/TS-INV-05-bug1]; no stdin read (static check + open-stdin run exits) [${EX}]. Note: printable non-ASCII (é) passes through as UTF-8 - see report Spec notes on "ASCII-safe"`, ['REQ-2', 'REQ-28', 'REQ-29']),
  P('Domain modules: imports per domain-model.md Modules table', SC, ev('UC03/static', 'bin/envlint.mjs shebang #!/usr/bin/env node, imports node:fs, node:util, ../src/parse.mjs, ../src/rules.mjs; src/* import nothing'), ['REQ-21', 'REQ-24']),
  P('Non-Go (_index boundaries): no .env write, no interpolation, no dotenv loading, no TUI/stdin, no network', SC, ev('UC03/static', 'no writeFile/appendFile/createWriteStream/fetch/node:http(s)/node:net in bin/ or src/; no stdin read; no default .env path; TS-INV-04/TS-NOGO-01/TS-NOGO-02 pass'), ['REQ-25', 'REQ-26', 'REQ-27', 'REQ-30']),
  P('_index decision 7: package.json bin entry, name unchanged', SC, 'git diff package.json: only "bin":{"envlint":"bin/envlint.mjs"} added; name "site" unchanged', ['REQ-21']),
  // tdd-surface
  P('TDD-1: project suite `node --test` green', TD, `\`node --test\` -> tests 47, pass 47, fail 0 (node v24.15.0); scope fixtures node --test test/parse.test.mjs 15/15, test/rules.test.mjs 15/15, test/cli.test.mjs 17/17, each exit 0 [${EX} key fixtures]`, ['REQ-23']),
  P('TDD-2: companion test file per new source file', TD, 'src/parse.mjs -> test/parse.test.mjs; src/rules.mjs -> test/rules.test.mjs; bin/envlint.mjs -> test/cli.test.mjs', ['REQ-23']),
  P('TDD-3: tests target AC behaviors (advisory)', TD, 'test names carry the TS row ids; new round-2 checks assert exact values: test/cli.test.mjs:124 asserts the escaped stdout string and no 0x1b on stdout/stderr; test/rules.test.mjs:137 asserts checkSchema deepEqual [] and doesNotThrow', []),
  // completeness
  P('CMP-1: every [INV-NN] backed by a task AC', CM, 'BUG-2 fixed: TASK-002 now carries "[INV-04] Neither checkSchema nor checkPairs throws ... (TS-INV-04) (covers: REQ-17)"; all 13 invariants across UC-01..03 are backed (UC-01 INV-01..04 by TASK-001, UC-02 INV-01..04 by TASK-002, UC-03 INV-01..05 by TASK-003/TASK-004)', []),
  P('CMP-2: every UC referenced by a task', CM, 'UC-01 <- TASK-001; UC-02 <- TASK-002; UC-03 <- TASK-003, TASK-004', []),
  P('CMP-3: discovery surprise rate (advisory)', CM, '.shapeup/envlint/discovery/ledger.md holds 8 Orient seeds (D-O1..D-O8) + 1 [+] round-2 discovery (D-R2-1, rules messages embed raw values) -> surprise ratio 1/9 = 0.11 <= 0.5, no finding', []),
];

const t0 = [
  { scope_id: 'parsing', path: '.shapeup/envlint/t0/verdicts/r1-a1-t1.json' },
  { scope_id: 'rules', path: '.shapeup/envlint/t0/verdicts/r2-a1-t1.json' },
  { scope_id: 'cli', path: '.shapeup/envlint/t0/verdicts/r2-a1-t2.json' },
].map((c) => ({ ...c, sha256: sha(c.path) }));

const result = {
  schema_version: 1,
  order_id: 'envlint/evaluate-r2',
  worker: 'spec-evaluator',
  status: 'done',
  verdict: {
    overall: 'PASS',
    report_path: '.shapeup/envlint/evaluation/EVAL-FEATURE-envlint.md',
    t0_citations: t0,
    criteria,
    refuted: [],
    bugs: [],
  },
  deviations: [
    'T0 digests recomputed with node:crypto sha256 over the files on disk; the `probe t0` verb named in the skill is absent from this kernel (harness.mjs answers unknown_verb, expected verify | gate | init | order). Each cited artifact is present, overall green, and its check_files digest equals the current test file (test/parse.test.mjs, test/rules.test.mjs, test/cli.test.mjs).',
    'Run identity mismatch (non-blocking, recorded for the harness): this order and the round-2 dispatch receipts carry run_id envlint-20261108T052834Z-3e0ef920, while .shapeup/envlint/receipt.json (plugin root plugin-s4-1) and both round-2 T0 verdicts (r2-a1-t1, r2-a1-t2, written 05:34-05:36Z, inside the 3e0ef920 window) carry envlint-20261108T050016Z-c40aa663. The artifacts are listed, present and green, so the round was graded.',
    'payload.build_gate is absent from the order (the round build gate did not run or was not handed over). No [ui] rows exist in this spec, so no criterion depended on it.',
    'No .verdicts-*.jsonl ledger exists on disk (round 1 lines were not appended), so flip detection used results/evaluate-r1.json: 4 criteria moved FAIL->PASS (UC-03 / TS-INV-05, UC-03 INV-05, TSC-2, CMP-1), each after the targeted round-2 fix of BUG-1/BUG-3/BUG-2 - expected flips per verdict-ledger.md section 3, confidence kept high; no unexplained flip.',
    '`npm test` was not run (the permission layer refused it); no criterion names it - the order names `node --test` as the project suite and the task ACs name `node --test test/<x>.test.mjs`, which were run as named.',
  ],
};
writeFileSync(join(ROOT, '.shapeup/envlint/results/evaluate-r2.json'), JSON.stringify(result, null, 2) + '\n');
console.log('criteria', criteria.length, 'fail', criteria.filter((c) => c.verdict === 'FAIL').length, JSON.stringify(t0));
