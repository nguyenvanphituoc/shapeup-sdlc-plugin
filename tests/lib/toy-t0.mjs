// The T0 mechanism driven by the second workflow's profile, as a subprocess (the CLI exits the process).
import * as core from "../../kernel/core/t0.mjs";
import { snapshot, restore, keptRef } from "../../kernel/core/ratchet.mjs";
import { TRACE, NAMES, CONTRACT_SPEC } from "./toy-profile.mjs";

const profile = {
  spec: CONTRACT_SPEC,
  slugFromPath: () => "feat",
  outRoot: TRACE.localRoot,
  profilePath: () => null,
  unit: (c) => ({ id: c.id, fixtures: c.fixtures, dbProbe: null, substrate: c.writes }),
  runIdFromRoot: TRACE.runIdFromRoot,
  ratchet: { snapshot: (id, cwd) => snapshot(id, cwd, NAMES), restore: (id, cwd, p) => restore(id, cwd, p, NAMES), keptRef: (id) => keptRef(id, NAMES.refNamespace) },
};
await core.cli(process.argv.slice(2), profile);
