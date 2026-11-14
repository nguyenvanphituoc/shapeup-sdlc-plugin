// Host seam — what differs between the agent harnesses a hook can run under.
//
// A hook reads one payload shape and answers in one decision shape. Which shape is a property of the
// harness, so it is named explicitly on the hook's command line (`--host <name>`) rather than guessed
// from the payload: a payload the hook does not recognise must not silently switch enforcement off.
// A hook with no `--host` is a Claude Code hook, which is what every command written before this
// seam existed is.

export const HOSTS = Object.freeze(["claude", "codex"]);
export const DEFAULT_HOST = "claude";

// Tool names that belong to another harness. Seeing one under a host that does not own it means the
// hook was wired with the wrong `--host`, and its guard would be a no-op.
const OWNED_TOOLS = Object.freeze({
  claude: ["Edit", "Write", "MultiEdit", "Bash", "Read", "Skill", "Agent"],
  codex: ["apply_patch", "shell", "local_shell", "spawn_agent"],
});

/**
 * Read `--host <name>` / `--host=<name>` from an argv.
 * @param {string[]} argv - The hook's own arguments.
 * @returns {string} A known host name; an unknown or absent value yields the default.
 */
export function hostFrom(argv = []) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = a === "--host" ? argv[i + 1] : a.startsWith("--host=") ? a.slice(7) : undefined;
    if (v !== undefined) return HOSTS.includes(v) ? v : DEFAULT_HOST;
  }
  return DEFAULT_HOST;
}

/**
 * Drop `--host` and its value from an argv, so a subcommand's own parser never sees it.
 * @param {string[]} argv - Arguments possibly carrying the host flag.
 * @returns {string[]} The same arguments without it.
 */
export function withoutHost(argv = []) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--host") { i++; continue; }
    if (argv[i].startsWith("--host=")) continue;
    out.push(argv[i]);
  }
  return out;
}

/**
 * Does this payload belong to a different host than the one the hook was told to expect?
 * @param {object} payload - The parsed hook payload.
 * @param {string} host - The declared host.
 * @returns {string|null} A reason when the payload names another host's tool, else null.
 */
export function hostMismatch(payload, host) {
  const tool = payload?.tool_name;
  if (typeof tool !== "string") return null;
  for (const [other, names] of Object.entries(OWNED_TOOLS)) {
    if (other !== host && names.includes(tool)) {
      return `payload tool \`${tool}\` belongs to host \`${other}\`, but this hook was declared \`--host ${host}\``;
    }
  }
  return null;
}

/**
 * The deny answer, in the shape the host reads.
 * @param {string} event - The hook event name, e.g. `PreToolUse`.
 * @param {string} reason - The explanation shown to the model.
 * @param {string} [host] - The declared host.
 * @returns {object} The JSON object the hook prints.
 */
export function denyPayload(event, reason, host = DEFAULT_HOST) {
  void host; // both hosts read this shape (documented for Codex, not yet measured)
  return {
    hookSpecificOutput: {
      hookEventName: event,
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}

// ---- Codex payloads -------------------------------------------------------------------------
// Shapes taken from OpenAI's public documentation and the open-source CLI, NOT yet measured against a
// running session: `tool_input.command` of an `apply_patch` call carries the whole patch text, and the
// shell tool's command is a string or an argv array. The fixtures that would settle both are still to
// be recorded; until then this reader fails open on anything it does not recognise.

/**
 * Every file an `apply_patch` envelope touches, with the text it adds.
 * @param {string} patch - The patch text (`*** Begin Patch` … `*** End Patch`).
 * @returns {Array<{path: string, content: string, op: string}>} One entry per file section; a move
 *   yields the destination too; `content` is the concatenated `+` lines of the section.
 */
export function parsePatch(patch) {
  const out = [];
  let cur = null;
  for (const line of String(patch ?? "").split(/\r?\n/)) {
    const m = line.match(/^\*\*\* (Add|Update|Delete) File:\s*(.+?)\s*$/);
    if (m) { cur = { path: m[2], content: "", op: m[1].toLowerCase() }; out.push(cur); continue; }
    const mv = line.match(/^\*\*\* Move to:\s*(.+?)\s*$/);
    if (mv) { cur = { path: mv[1], content: "", op: "move" }; out.push(cur); continue; }
    if (line.startsWith("*** ")) { cur = null; continue; }
    if (cur && line.startsWith("+")) cur.content += (cur.content ? "\n" : "") + line.slice(1);
  }
  return out;
}

/** An argv `["bash", "-lc", "<script>"]` is judged as the script; any other argv as its joined words. */
function shellScript(argv) {
  const i = argv.findIndex((a) => /^-[a-z]*c$/.test(a));
  return /(^|\/)(ba|z|da|k)?sh$/.test(String(argv[0])) && i > 0 && typeof argv[i + 1] === "string" ? argv[i + 1] : argv.join(" ");
}

const CODEX_SHELL = new Set(["shell", "local_shell", "exec_command", "container.exec"]);

/**
 * Put a payload into the shape the hook logic reads. A Claude payload comes back untouched; a Codex
 * `apply_patch` becomes a multi-file edit and a Codex shell call becomes a `Bash` call.
 * @param {object} payload - The parsed hook payload.
 * @param {string} host - The declared host.
 * @returns {object} The payload to judge.
 */
export function normalizePayload(payload, host) {
  if (host !== "codex" || !payload || typeof payload !== "object") return payload;
  const tool = payload.tool_name;
  if (tool === "apply_patch") {
    const edits = parsePatch(payload.tool_input?.command ?? payload.tool_input?.input ?? payload.tool_input?.patch)
      .map((f) => ({ file_path: f.path, new_string: f.content }));
    return { ...payload, tool_name: "MultiEdit", tool_input: { edits }, host_tool: tool };
  }
  if (CODEX_SHELL.has(tool)) {
    const c = payload.tool_input?.command ?? payload.tool_input?.cmd;
    return { ...payload, tool_name: "Bash", tool_input: { ...payload.tool_input, command: Array.isArray(c) ? shellScript(c) : c }, host_tool: tool };
  }
  return payload;
}
