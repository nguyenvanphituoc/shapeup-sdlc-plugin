// The four evaluation oracles, executed against the worked examples: each must PASS a deliverable
// that meets its contract and FAIL one that does nothing, because a grader that cannot fail is a
// rubber stamp. The examples are fixtures here; they are not shipped.
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

export async function run(ctx) {
  const { ROOT, ok, fail, section, readJSON } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  const node = (args, opts = {}) => spawnSync("node", args, { encoding: "utf8", cwd: ROOT, ...opts });

  section("oracles — registered, present, and discriminating");
  const { ORACLES } = await import(join(ROOT, "oracles/index.mjs"));
  for (const name of ["process", "test", "snapshot", "http"]) {
    check(typeof ORACLES[name] === "function" && existsSync(join(ROOT, `oracles/${name}-oracle.mjs`)), `oracle "${name}" is registered and its runner is on disk`);
  }

  const todo = join(ROOT, "examples/todo-cli");
  check(node([join(todo, "eval-cli-contract.mjs"), `node ${join(todo, "reference/todo.js")}`]).status === 0, "process oracle PASSes the reference CLI");
  check(node([join(todo, "eval-cli-contract.mjs"), 'node -e ""']).status === 1, "process oracle FAILs a do-nothing CLI");
  const contract = readJSON(join(todo, "todo.contract.json"));
  check(contract.criteria.length > 0 && contract.criteria.every((c) => c.id && c.probe && c.expect), "a contract's criteria each carry an id, a probe and an expectation");
  check(!/"store"\s*:/.test(readFileSync(join(todo, "todo.contract.json"), "utf8")) || /TODO_STORE/.test(readFileSync(join(todo, "idea.md"), "utf8")),
    "the pitch states every convention its oracle seeds, so the grader tests nothing the brief withheld");

  const mathx = join(ROOT, "examples/lib-mathx");
  check(node([join(ROOT, "oracles/test-oracle.mjs"), join(mathx, "mathx.contract.json")]).status === 0, "test oracle PASSes the green suite");
  const red = await ORACLES.test({ criteria: [{ id: "T1", desc: "red", probe: { cmd: "node --test --test-reporter=tap mathx.redtest.mjs", cwd: mathx }, expect: { exit: "==0", min_tests: 1, no_failures: true } }] });
  check(red.fails === 1, "test oracle FAILs a red suite");

  const greet = join(ROOT, "examples/refactor-greet/greet.contract.json");
  check(node([join(ROOT, "oracles/snapshot-oracle.mjs"), greet, "node examples/refactor-greet/greet.mjs"]).status === 0, "snapshot oracle PASSes output identical to its golden");
  check(node([join(ROOT, "oracles/snapshot-oracle.mjs"), greet, "node -e undefined"]).status === 1, "snapshot oracle FAILs a do-nothing implementation");

  const ping = readJSON(join(ROOT, "examples/http-ping/ping.contract.json"));
  const good = await ORACLES.http({ server: { ...ping.server, cwd: ROOT }, criteria: ping.criteria });
  check(good.fails === 0 && good.results.length > 0, "http oracle PASSes the working server");
  const bad = await ORACLES.http({ server: { ...ping.server, cmd: "node examples/http-ping/broken-server.mjs", cwd: ROOT }, criteria: ping.criteria });
  check(bad.fails === bad.results.length && bad.results.length > 0, "http oracle FAILs a broken server");
}
