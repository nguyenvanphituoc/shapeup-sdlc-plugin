# Directory submissions (P0-6)

Ready-to-send copy for each listing channel. **Nothing here has been sent.** Every one of these
posts to somebody else's repository or review queue, and one of them
([awesome-claude-code](#1-awesome-claude-code)) explicitly requires that the recommendation be
written by a human, so these are staged for you rather than fired automatically.

**Send them after the README lands on `main`** — every submission points a reviewer at it, and
a reviewer who arrives at the old README is a wasted, non-repeating shot.

Verified 2026-07-26 against each channel's current contribution docs; re-check the two form URLs
before sending, since they move.

---

## Shared copy

Reuse these so the project reads consistently everywhere.

**Name:** `shapeup-sdlc-plugin`

**Repository:** https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin

**One-line description** (factual register — required by awesome-claude-code, safe everywhere):

> A Claude Code plugin that runs a Shape Up software development lifecycle, using PreToolUse
> hooks to block evaluation until every task on the board is complete.

**Longer description** (for directories that allow a paragraph):

> Shape Up for coding agents, with the important rules enforced by the runtime rather than
> requested in a prompt. A PreToolUse hook hard-denies any worker dispatch whose work order is
> missing or malformed; build progress is derived from test artifacts on disk instead of
> self-reported; and each parallel scope gets a hook-enforced write-whitelist so concurrent
> work cannot corrupt shared state. Thirteen skills cover shaping, orientation, wiring, scope
> mapping, vertical building, evaluation, exploratory QA, and a retro that files feedback back
> into per-skill knowledge files.

**Install:**

```
/plugin marketplace add nguyenvanphituoc/shapeup-sdlc-plugin
/plugin install shapeup-sdlc-plugin@nvptuoc-marketplace
```

**License:** MIT · **Category:** workflow / plugin / SDLC harness

---

## 1. awesome-claude-code

- **Method:** web issue form **only** — pull requests are explicitly not accepted.
- **URL:** https://github.com/hesreallyhim/awesome-claude-code/issues/new?template=recommend-resource.yml

**House rules, verified — violating these is the usual reason a submission is dropped:**

- **Recommendations must be written by a human being.** The resource itself may be
  agent-written; the recommendation may not be. Submit this one yourself.
- Descriptions must be **one line stating what the software does** — not a sales pitch.
- **No emojis** in the description.
- Licensing must be discoverable by automated tooling (MIT `LICENSE` at the repo root — fine).
- Curation is selective and best-effort; there is no formal review process and no guarantee of
  a reply. Do not follow up more than once.

**Use the one-line description from [Shared copy](#shared-copy) verbatim.** It was written to
this channel's constraints — factual, no emoji, no marketing verbs.

---

## 2. Anthropic community plugin directory

- **Method:** submission form only. **PRs opened against
  `anthropics/claude-plugins-community` are closed automatically** — everything routes through
  the internal review pipeline.
- **URL:** https://clau.de/plugin-directory-submission

**Gate:** automated security scanning, then approval for distribution. Turnaround is on the
order of days.

**Before submitting**, make sure these still hold — they are what the scan and review look at:

- [ ] `claude plugin validate . --strict` passes
- [ ] No plugin file accesses anything outside its own directory
- [ ] All seven hooks are readable and make no network requests — worth being able to state
      plainly, since four sit in a `PreToolUse` position and can deny tool calls
- [ ] README explains what the plugin does before it explains how to install it

> This is also the channel most improved by finishing
> [issue #2](https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin/issues/2) (`SECURITY.md` +
> the per-hook table) first. A reviewer meeting seven deny-capable hooks with no security page
> is being asked to take it on trust.

The **official** directory (`anthropics/claude-plugins-official`) is curated at Anthropic's
discretion and is a later step — the report stages it after P0 and P1 are done, not now.

---

## 3. VoltAgent/awesome-agent-skills

- **URL:** https://github.com/VoltAgent/awesome-agent-skills
- **Method:** check `CONTRIBUTING.md` at submission time — this list has historically taken PRs,
  unlike awesome-claude-code. Confirm before opening one.

Use the longer description. This audience indexes on skill count and coverage, so it is worth
naming the thirteen skills and the multi-CLI targets (Claude Code, Cursor, Antigravity, Codex).

---

## 4. Plugin hubs and aggregators

Low effort, low individual yield, compounding in aggregate. Most accept a repo URL and scrape
the rest from the manifest and README — which is exactly why they should be done *after* the
README merges.

| Channel | URL | Notes |
|---|---|---|
| claudemarketplaces.com | https://claudemarketplaces.com | Marketplace registry; this repo is its own marketplace, so submit the repo URL |
| claudepluginhub.com | https://claudepluginhub.com | Plugin directory |
| skills.sh | https://skills.sh | Skill index |
| agentskills.io | https://agentskills.io | Showcase |
| tonsofskills.com | https://tonsofskills.com | Aggregator |

---

## Order of operations

1. Merge the P0 README PR to `main`.
2. Confirm the repo's social preview and description render correctly on a logged-out view.
3. Submit **awesome-claude-code** yourself, by hand (human-authored rule).
4. Submit the **Anthropic community directory** form.
5. VoltAgent, then the aggregator hubs.
6. Log what was sent and when in this file, then watch referrers weekly — the report's P3-4 is
   to double down on whichever channel actually converts, and that is only knowable if the
   sends are dated.

## Sent log

| Date | Channel | Status | Notes |
|---|---|---|---|
| — | — | not yet sent | — |
