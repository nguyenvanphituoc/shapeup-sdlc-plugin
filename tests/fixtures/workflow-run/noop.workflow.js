// The HD-007-symmetric probe: the exact three-line shape whose Workflow-tool launch was DENIED
// under `--permission-mode acceptEdits` (docs/migration/stage3-evidence.md §7.5). If this returns
// {ok:true} through cp-run.mjs from a headless acceptEdits session, the lane starts where the
// tool's could not — same script shape, same permission mode, different launch surface.
export const meta = { name: "noop-probe", description: "lane-start probe: return without dispatching a single agent" };
log("noop probe: lane started");
return { ok: true };
