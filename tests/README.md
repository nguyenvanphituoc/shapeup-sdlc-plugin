# Tests

One tier of automated proof, and one that needs a live host.

## Tier 0 — structural: `npm test`

Zero dependencies, no network, no Claude calls. Eleven modules under `structural/`, one shared context
(`lib/harness.mjs`) and a small fixture helper (`lib/fixture.mjs`). Each module executes shipped code
against a fixture, or validates a shipped file against the thing it names; none asserts wording.

| Module | Executes |
|---|---|
| `01-manifests` | the three versions agree; the package ships what exists; every hook command and kernel route resolves; `claude plugin validate --strict` when the host is present |
| `02-agents-and-skills` | frontmatter parses; each agent preloads a skill that exists; every kernel command a shipped instruction names exists in the routing table |
| `03-fence` | `sandbox-guard` against fixture orders, and the `order` verb that arms and retires it: outside-substrate deny, frozen, own, no-pointer allow, tier-rule deny, fail-open |
| `04-ledger` | every hook records a decision; `safety-spine` denies and allows; the dispatch receipt names the agent that ran |
| `05-t0` | green, red, truncated tails, the environment fingerprint, the ratchet's keep and revert, the cited hash |
| `06-gate` | presets, live answers, the Round Close and Ship Sign-off refusals, answer files, the source of every decision |
| `07-envelope` | the order gate in hook mode and the result check in command mode |
| `08-shipped-set` | no bookkeeping in shipped files; every hook documented and registered; cited paths and relative links resolve; counted claims match the tree |
| `09-init` | `init run`'s record and refusals, `--force`, and the installer's grant and harness block |
| `10-oracles` | each oracle passes a deliverable that meets its contract and fails one that does not |
| `11-skill-anatomy` | every file a skill points at is on disk; the loop's phase table, index and contract headers agree with each other, with the schema's operations and with the kernel's gates; every resource of the loop is reachable from its `SKILL.md` |

The runner holds a floor on the check count. A new check lands in the module that owns what it executes.

## Tier 1 — the host: `npm run test:grant`

Starts a real `claude` session under the rules the installer writes and decides allowed or denied by whether
a marker file landed on disk. It needs the binary and auth and skips loudly (exit 2) without them. Run it
on any change under `bin/` or `kernel/`, and after a host upgrade.

## Release candidate

`npm run verify:cross-dir` fires the fence from a `git archive` copy at another path against a project it has
never seen. A real run (`claude -p --plugin-dir <repo> --permission-mode acceptEdits` over a small pitch in a
scratch project) is the only check that exercises the loop itself, and it is a manual exercise: read a clean
run as "nothing surfaced in the phases it reached", never as "fit to ship".
