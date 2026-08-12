// One real dispatch through the control plane: a worker session is spawned headlessly under the
// same permission mode, does actual tool work (writes a file), and reports through a forced
// schema — the mech-courier shape shapeup-run.js uses everywhere (C4, the envelope port).
// args.token binds the worker's artifact to this exact run: the probe passes only if the file the
// worker wrote carries the token THIS launch supplied, so a stale file from a previous run cannot
// green it.
export const meta = { name: "one-agent-probe", description: "one schema-forced worker dispatch under acceptEdits" };

const SCHEMA = {
  type: "object",
  properties: {
    written: { type: "boolean" },
    path: { type: "string" },
    line: { type: "string" },
  },
  required: ["written", "path", "line"],
};

if (!args.token) return { ok: false, error: "one-agent probe needs args.token" };

phase("Dispatch");
const r = await agent(
  "Create a file named worker-proof.txt in the current working directory containing exactly this " +
  `single line and nothing else:\n${args.token}\n` +
  "Then report as data: written (true only if the write succeeded), path (the absolute path of " +
  "the file), line (the exact line you wrote).",
  { model: "sonnet", effort: "low", schema: SCHEMA, label: "worker-proof" },
);

return { ok: r !== null && r.written === true && r.line === args.token, worker: r };
