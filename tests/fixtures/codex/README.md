# Codex payload fixtures

**None of these was recorded from a running Codex session.** Each is built from the shapes OpenAI's
documentation and the open-source CLI describe (the whole patch in `tool_input.command`; a shell tool whose
command is a string or an argv array). They pin what the adapter does with those shapes. Replace them with
recorded payloads — carrying `codex --version` and the date — before relying on the adapter in production.
