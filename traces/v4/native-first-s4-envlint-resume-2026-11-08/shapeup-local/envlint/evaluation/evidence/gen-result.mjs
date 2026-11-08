// Builds results/evaluate-r1.json from the evaluator's grades. Usage: node gen-result.mjs <projectRoot>
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = process.argv[2];
const EV = '.shapeup/envlint/evaluation/evidence/probe-r1.json';
const P = (c, d, e, t = [], conf = 'high') => ({ criterion: c, dimension: d, verdict: 'PASS', confidence: conf, reprobed: false, evidence: e, traces_to: t });
const F = (c, d, e, t = [], conf = 'high') => ({ criterion: c, dimension: d, verdict: 'FAIL', confidence: conf, reprobed: true, evidence: e, traces_to: t });
const TS = 'test-surface-conformance', SC = 'spec-conformance', TD = 'tdd-surface', CM = 'completeness';
const ev = (k, s) => `${s} [evaluator probe ${EV} key ${k}]`;

const criteria = [
  // UC-01 Test Surface
  P('UC-01 / TS-INV-01', TS, ev('UC01/TS-INV-01', 'blank/comment/assignment text: A@3, B@5, problem@6, C@8 = physical lines'), ['REQ-15']),
  P('UC-01 / TS-INV-02', TS, ev('UC01/TS-INV-02', 'src/parse.mjs has no import/require; two calls on same input give identical results'), ['REQ-16', 'REQ-22']),
  P('UC-01 / TS-INV-03', TS, ev('UC01/TS-INV-03', 'A=${HOME}/x -> value "${HOME}/x" literal'), ['REQ-26']),
  P('UC-01 / TS-INV-04', TS, ev('UC01/TS-INV-04', '"", "\\n\\n", "=", "\'", BOM, CRLF (+ NUL, bare export) all return {pairs, problems} arrays, none threw'), ['REQ-15']),
  P('UC-01 / TS-ERR-MISSING_EQUALS', TS, ev('UC01/TS-ERR-MISSING_EQUALS', 'JUSTAKEY on line 2 -> {line:2, message:"missing \'=\'"}'), ['REQ-15']),
  P('UC-01 / TS-ERR-INVALID_KEY', TS, ev('UC01/TS-ERR-INVALID_KEY', '1BAD=x and =x -> invalid key at lines 1 and 2'), ['REQ-15']),
  P('UC-01 / TS-ERR-UNTERMINATED_QUOTE', TS, ev('UC01/TS-ERR-UNTERMINATED_QUOTE', 'A="abc and B=\'x -> unterminated quote at lines 1 and 2'), ['REQ-14']),
  // UC-02 Test Surface
  P('UC-02 / TS-INV-01', TS, ev('UC02/TS-INV-01', 'src/rules.mjs: no import, no network/fs reference; url on http://unreachable.invalid -> no finding'), ['REQ-20', 'REQ-22', 'REQ-30', 'REQ-31']),
  P('UC-02 / TS-INV-02', TS, ev('UC02/TS-INV-02', 'A on lines 1 and 3, failing int on line 3 -> exactly one finding line 3'), ['REQ-17']),
  P('UC-02 / TS-INV-03', TS, ev('UC02/TS-INV-03', 'EXTRA not in schema -> [] findings'), ['REQ-17']),
  P('UC-02 / TS-ERR-REQUIRED_MISSING', TS, ev('UC02/TS-ERR-REQUIRED_MISSING', '{key:"PORT", line:null, rule:"required", message:"required key is missing"}'), ['REQ-17']),
  P('UC-02 / TS-ERR-TYPE_MISMATCH', TS, ev('UC02/TS-ERR-TYPE_MISMATCH', 'type finding for int 1.0/0x10/1e3/""/" 7", bool yes, url localhost:3000/javascript:alert(1)/file:///etc'), ['REQ-18', 'REQ-31']),
  P('UC-02 / TS-REQ-type-boundary', TS, ev('UC02/TS-REQ-type-boundary', 'int 0/-5/42, bool true/false, url https://a.example/x, string "" -> no finding'), ['REQ-18']),
  P('UC-02 / TS-ERR-ENUM_MISMATCH', TS, ev('UC02/TS-ERR-ENUM_MISMATCH', 'enum [dev,prod]: Dev and staging -> enum finding each; dev -> none'), ['REQ-19']),
  P('UC-02 / TS-ERR-SCHEMA_INVALID', TS, ev('UC02/TS-ERR-SCHEMA_INVALID', '[], null, type float, enum [], required "yes", min:1 -> non-empty errors; {} and a valid schema -> []'), ['REQ-1']),
  // UC-03 Test Surface (oracle: process)
  P('UC-03 / TS-INV-01', TS, ev('UC03/TS-INV-01', '17 argv/error/garbage cases: no stack lines; exit 2 cases print one envlint: line (+usage); garbage env -> findings exit 1'), ['REQ-7']),
  P('UC-03 / TS-INV-02', TS, ev('UC03/TS-INV-02', 'stdout "e.env:2: PORT: expected int, got \\"abc\\"\\ne.env: TOKEN: required key is missing\\n", exit 1'), ['REQ-2', 'REQ-3']),
  P('UC-03 / TS-INV-03', TS, ev('UC03/TS-INV-03', 'comments/blank-only env: schema {} -> exit 0 empty stdout; required A -> exit 1 "e.env: A: required key is missing"'), ['REQ-6']),
  P('UC-03 / TS-INV-04', TS, ev('UC03/TS-INV-04', 'cwd listing [e.env, s.json] before and after 4 runs; no .env created'), ['REQ-25']),
  F('UC-03 / TS-INV-05', TS, 'Findings run on env "PORT=\\x1b[31mred" with schema {"PORT":{"type":"int"}} prints a raw 0x1b byte on stdout ("esc.env:1: PORT: expected int, got \\"\\x1b[31mred\\"") - value echoed unescaped at bin/envlint.mjs:67 from the message built at src/rules.mjs:66; re-probed with od -c, 033 present both times. Stdin not awaited: PASS part (exit 1 with stdin pipe left open).', ['REQ-2', 'REQ-28', 'REQ-29']),
  P('UC-03 / TS-ERR-USAGE', TS, ev('UC03/TS-ERR-USAGE', 'no args, --schema s.json alone, two positionals, --color, no --schema, duplicate --schema -> exit 2, stderr "envlint: ..." + "usage: envlint --schema <schema.json> <envfile>"'), ['REQ-8', 'REQ-21']),
  P('UC-03 / TS-ERR-ENV_NOT_FOUND', TS, ev('UC03/TS-ERR-ENV_NOT_FOUND', 'exit 2, stderr "envlint: cannot read env file missing.env: ENOENT"'), ['REQ-4', 'REQ-7']),
  P('UC-03 / TS-ERR-ENV_UNREADABLE', TS, ev('UC03/TS-ERR-ENV_UNREADABLE', 'directory -> exit 2, stderr "envlint: cannot read env file adir: EISDIR"'), ['REQ-7']),
  P('UC-03 / TS-ERR-SCHEMA_NOT_FOUND', TS, ev('UC03/TS-ERR-SCHEMA_NOT_FOUND', 'exit 2, stderr "envlint: cannot read schema file missing.json: ENOENT"'), ['REQ-5', 'REQ-7']),
  P('UC-03 / TS-ERR-SCHEMA_INVALID_JSON', TS, ev('UC03/TS-ERR-SCHEMA_INVALID_JSON', 'exit 2, stderr "envlint: invalid schema bad.json: not valid JSON"'), ['REQ-5', 'REQ-7']),
  P('UC-03 / TS-ERR-SCHEMA_INVALID', TS, ev('UC03/TS-ERR-SCHEMA_INVALID', 'exit 2, stderr "envlint: invalid schema inv.json: A: \\"type\\" must be one of string, int, bool, url"'), ['REQ-5', 'REQ-7']),
  P('UC-03 / TS-ERR-FINDINGS', TS, ev('UC03/TS-ERR-FINDINGS', 'stdout "e.env:3: parse error: missing \'=\'", exit 1'), ['REQ-2', 'REQ-3']),
  P('UC-03 / TS-NOGO-01', TS, ev('UC03/TS-NOGO-01', 'cwd holds .env with a type violation; --schema s.json alone -> exit 2 usage, empty stdout, no findings'), ['REQ-8', 'REQ-9']),
  P('UC-03 / TS-NOGO-02', TS, ev('UC03/TS-NOGO-02', 'A=${HOME} vs enum ["${HOME}"] -> exit 0, empty stdout'), ['REQ-26']),
  F('TSC-2: UC-02 Test Surface covers its own Invariants', TS, 'UC-02 declares [INV-04] at shapeup/envlint/spec/usecases/UC-02-check-pairs-against-schema.md:37 but its Test Surface (same file :52-65) has TS-INV-01..03 only - no TS-INV-04 row. UC-01 and UC-03 are complete (every INV and Error Case code has its row, every row cites D1-D4).', []),
  // spec-conformance
  P('UC-01 Steps 1-6 + C1 line rules', SC, ev('UC01/steps', 'KEY=value; quoted inner text verbatim (no escapes); unquoted "x # not a comment" kept; trimmed values; F=a=b split at first =; mismatched/lone quote -> unterminated; export+tab removed; duplicates kept in order'), ['REQ-10', 'REQ-11', 'REQ-12', 'REQ-13', 'REQ-14']),
  P('UC-02 Steps 1-5 + C3 ordering/messages', SC, ev('UC02/steps', 'type then enum on one key; lined ascending then required in schema key order (Z, Y); enum message "expected one of a, b, c, got \\"q\\""; url http:// rejected, https://x accepted'), ['REQ-17', 'REQ-18', 'REQ-19']),
  P('UC-02 INV-04 (behavior)', SC, ev('UC02/INV-04', 'checkPairs/checkSchema with __proto__/constructor/toString keys did not throw'), []),
  P('UC-03 Steps 1-6 + ux-behavior output order', SC, ev('UC03/output-order', 'K type+enum at line 1, parse error line 2, K2 enum line 3, then Z, Y required; --schema=<path> accepted; exit 0/1/2 per state table'), ['REQ-2', 'REQ-3', 'REQ-21']),
  F('UC-03 INV-05 (no ANSI escape sequences in output)', SC, 'User-supplied ESC bytes in an env value reach stdout verbatim: bin/envlint.mjs:67 renders f.message (built at src/rules.mjs:66 and :69 with the raw value) without escaping control characters; probe esc.env "PORT=\\x1b[31mred" -> stdout contains 0x1b (re-probed, od -c shows 033).', ['REQ-2', 'REQ-28', 'REQ-29']),
  P('Domain modules: imports per domain-model.md Modules table', SC, ev('UC03/static', 'bin/envlint.mjs shebang #!/usr/bin/env node, imports node:fs, node:util, ../src/parse.mjs, ../src/rules.mjs; src/* import nothing'), ['REQ-21', 'REQ-24']),
  P('Non-Go (_index boundaries): no .env write, no interpolation, no dotenv loading, no TUI/stdin, no network', SC, ev('UC03/static', 'no writeFile/appendFile/createWriteStream/fetch/node:http(s)/node:net in bin/ or src/; no stdin read; no default .env path; TS-INV-04/TS-NOGO-01/TS-NOGO-02 pass'), ['REQ-25', 'REQ-26', 'REQ-27', 'REQ-30']),
  P('_index decision 7: package.json bin entry, name unchanged', SC, 'git diff package.json: only "bin":{"envlint":"bin/envlint.mjs"} added; name "site" unchanged', ['REQ-21']),
  // tdd-surface
  P('TDD-1: project suite `node --test` green', TD, '`node --test` -> tests 46, pass 46, fail 0 (node v24.15.0); scope fixtures node --test test/parse.test.mjs 15/15, test/rules.test.mjs 15/15, test/cli.test.mjs 16/16, each exit 0', ['REQ-23']),
  P('TDD-2: companion test file per new source file', TD, 'src/parse.mjs -> test/parse.test.mjs; src/rules.mjs -> test/rules.test.mjs; bin/envlint.mjs -> test/cli.test.mjs', ['REQ-23']),
  P('TDD-3: tests target AC behaviors (advisory)', TD, 'test names carry the TS row ids; cli tests assert exact stdout/stderr/exit; rules/parse tests assert values, not just definedness', []),
  // completeness
  F('CMP-1: every [INV-NN] backed by a task AC', CM, 'UC-02 [INV-04] (shapeup/envlint/spec/usecases/UC-02-check-pairs-against-schema.md:37, "Neither function throws ...") is named by no TASK-002 AC by id or by assertion; all other 13 invariants across UC-01..03 are backed (TASK-001, TASK-002, TASK-003, TASK-004). The behavior is tested (test/rules.test.mjs:137) and passes - this is a plan gap, not a code defect.', []),
  P('CMP-2: every UC referenced by a task', CM, 'UC-01 <- TASK-001; UC-02 <- TASK-002; UC-03 <- TASK-003, TASK-004', []),
  P('CMP-3: discovery surprise rate (advisory)', CM, '.shapeup/envlint/discovery/ledger.md holds 8 Orient seeds, no [+] discovered items -> ratio 0, no finding', []),
];

const bugs = [
  { id: 'BUG-1', severity: 'major', criterion: 'UC-03 INV-05 / UC-03 / TS-INV-05', location: 'bin/envlint.mjs:67', also: ['src/rules.mjs:66', 'src/rules.mjs:69'],
    repro: 'printf \'PORT=\\033[31mred\\n\' > esc.env; echo \'{"PORT":{"type":"int"}}\' > s.json; node bin/envlint.mjs --schema s.json esc.env | od -c',
    expected: 'no 0x1b byte in stdout or stderr on any findings run (UC-03 INV-05, TS-INV-05)',
    actual: 'stdout "esc.env:1: PORT: expected int, got \\"<ESC>[31mred\\"" contains raw 033',
    fix_hint: 'escape control characters (C0, DEL) when the CLI renders a line (e.g. \\x1b -> "\\x1b" text) so src/rules.mjs messages keep the C3 shape; add an ESC-valued fixture to TS-INV-05 in test/cli.test.mjs. Same for the env path when echoed.',
    next: 'task-executor, scope cli, round 2' },
  { id: 'BUG-2', severity: 'critical', criterion: 'CMP-1', location: 'shapeup/envlint/spec/usecases/UC-02-check-pairs-against-schema.md:37',
    repro: 'grep INV-04 / "throw" across TASK-002 acceptance criteria -> no match',
    expected: '>=1 TASK-002 AC naming UC-02 INV-04 (neither checkSchema nor checkPairs throws for an accepted schema and C1 pairs)',
    actual: 'no task AC backs UC-02 INV-04; behavior is tested at test/rules.test.mjs:137 and passes',
    next: 'planner (ba-pitch-analyzer) reconcile: add the AC to TASK-002 - no code change needed' },
  { id: 'BUG-3', severity: 'major', criterion: 'TSC-2', location: 'shapeup/envlint/spec/usecases/UC-02-check-pairs-against-schema.md:52',
    repro: 'compare UC-02 ## Invariants (INV-01..04, :34-37) with ## Test Surface rows (:57-64)',
    expected: 'a TS-INV-04 row sourced D1: INV-04',
    actual: 'Test Surface carries TS-INV-01..03 only',
    next: 'planner retrofit-surface re-run for UC-02 (judge does not author rows)' },
];

const result = {
  schema_version: 1,
  order_id: 'envlint/evaluate-r1',
  worker: 'spec-evaluator',
  status: 'done',
  verdict: {
    overall: 'FAIL',
    report_path: '.shapeup/envlint/evaluation/EVAL-FEATURE-envlint.md',
    t0_citations: [
      { scope_id: 'parsing', path: '.shapeup/envlint/t0/verdicts/r1-a1-t1.json', sha256: '85626ecf1d62ad7b782a6b59bd4c5db5b80d365bb1e6878bdbb512f1fd2a55ad' },
      { scope_id: 'rules', path: '.shapeup/envlint/t0/verdicts/r1-a1-t2.json', sha256: 'a5ddb105dbe721687315de17c0aef099af08beb530bea63b01ca008eef4e041b' },
      { scope_id: 'cli', path: '.shapeup/envlint/t0/verdicts/r1-a1-t3.json', sha256: '83ced6c75d069bd59d9119f0f318cfd0279427afa197698e77c018ad7ea94867' },
    ],
    criteria,
    refuted: [
      { task_id: 'TASK-003', ac: 'Output lines and order exactly per [[ux-behavior#Output lines (findings state)]], no ANSI escapes, no stdin read (covers: REQ-2, REQ-28, REQ-29)' },
      { task_id: 'TASK-004', ac: 'Temp cwd listing is unchanged after a run; no `\\x1b` in output; `${HOME}` compared literally (covers: REQ-25, REQ-26, REQ-28, REQ-29)' },
    ],
    bugs,
  },
  deviations: [
    'T0 digests recomputed with node:crypto sha256 over the files on disk; the `probe t0` verb named in the skill is not present in this kernel (harness.mjs lists verify | gate | init | order). T0 check_files hashes equal the current test/*.test.mjs digests, so no check was rewritten after T0.',
    'No prior .verdicts-*.jsonl exists: no flip history; this run is the baseline.',
  ],
};
writeFileSync(join(ROOT, '.shapeup/envlint/results/evaluate-r1.json'), JSON.stringify(result, null, 2) + '\n');
console.log('criteria', criteria.length, 'fail', criteria.filter((c) => c.verdict === 'FAIL').length);
