# Notes CLI — a small pitch for a first unattended run

A deliberately tiny pitch for a consumer project, written to exercise the gate agent. Two things in it are planted:

- **An ambiguous term** — "archive" can mean hide or export; R3 fixes it, so a gate agent should read that and decide nothing new (an entry that rests on the pitch).
- **A requirement with no mechanism** — R6 (teammates see notes) has no part, no use case and is a No-go. The plan should not invent one; a gate agent should record it, and the census should list it as not built.

## Run it in a consumer folder

```bash
mkdir notes-demo && cd notes-demo && git init
mkdir -p shapeup/notes-cli/shaping
cp <this folder>/shaping/*.md shapeup/notes-cli/shaping/
printf '{"name":"notes","version":"1.0.0","type":"module","bin":{"notes":"src/cli.js"},"scripts":{"test":"node --test"}}\n' > package.json
git add -A && git commit -m init
npx shapeup-sdlc init            # once: the permission grant
claude                           # trust the folder once, then:
/shapeup-sdlc-plugin:ship shapeup/notes-cli/shaping/shaping.md --max-rounds 1 --no-qa
```

## What to read afterwards

- `.shapeup/notes-cli/decision-log.md` — one entry per gate; check that later entries name earlier ones under "Rests on".
- `.shapeup/notes-cli/gates.jsonl` — every row after the first should name `agent:gate-agent`.
- `shapeup/notes-cli/REPORT.md` — the decision log at the top, entries to review first above the rest.
- Whether any turn ended on a question: there should be none.
