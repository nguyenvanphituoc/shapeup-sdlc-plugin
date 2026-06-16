---
description: >-
  Use when tracking which features or domains the navigator (spike/POC) repo has proven that
  the driver (production) app hasn't implemented yet. Pair-programming context: the navigator
  colleague spikes domains, features, and simple UI to prove concepts ahead of the driver;
  the driver builds production-grade from those proven patterns. Typical asks — what has the
  navigator proven that the driver is missing; run a gap scan; is the driver keeping up with
  the navigator spikes; what navigator features should the driver pick up next; show me what's
  been proven but not yet built in prod; catch up the navigator clone and re-scan; what domains
  exist in the spike that aren't in the production app yet. Clones the navigator into the
  gitignored example/ on demand; output accumulates in tracked docs/bridge/. NOT for grading
  a single TASK against acceptance criteria (that's spec-evaluator), and NOT for reviewing a
  local git diff. --preview <slug> renders the navigator's UI as a standalone HTML prototype.
argument-hint: "[--pin] [--catchup [<ref>]] [--area ui|features|all] [--feature <slug>] [--preview <slug>]"
allowed-tools: Bash, Read, Glob, Grep, Write, Edit, Skill, Task
---

# /gap-scan

Measure **navigator → driver adoption lag**: discover what the navigator spike repo has
proven and find what the driver production app hasn't yet implemented.

**Pair-programming model:**
- **Navigator** (`osr-platform-vy`): colleague's spike repo. Proves concepts, explores
  domains, ships rough UI. It runs *ahead* and is the discovery source.
- **Driver** (`proj-idea-validation`): this repo. The production app. It follows the
  navigator's proven patterns and builds them to production quality.

The gap is: **navigator has it spiked → driver has not implemented it yet.**

Two halves, deliberately different lifecycles:

- **`docs/bridge/` is tracked.** `pins.json`, `gap-reports/`, `breadboarding/`, and
  `betting-table/` are committed here so adoption history **accumulates over time** — you
  build a record of how the driver converges on what the navigator proved.
- **`example/` is gitignored and disposable.** Holds only a clone of the navigator.
  Re-clone or fetch freely; nothing there is precious.

Args: `$ARGUMENTS`

## Inputs (read first)

- Run from the repo root (`proj-idea-validation/`). **All `pins.json` paths are relative to
  the repo root**, where this command runs.
- `PINS=docs/bridge/pins.json`. Read it for:
  - `navigator.path` (`example/osr-platform-vy-main`) — the spike/POC repo clone
  - `navigator.remote`, `navigator.ref`, `navigator.last_catchup`
  - `driver.path` (`.`) — this repo, the production app
  - `driver.src_globs` — where the driver's actual source code lives (`platforms/**`, `core/**`)
  - `bridge` (`docs/bridge`)
- Today's date for the report filename (from the environment — do not invent it).

## Step 0 — Ensure the navigator clone (clone / catchup)

The navigator lives only as a clone under `example/`. Before anything else, make sure it's
there and at a known commit. Never clone anywhere but `example/`, and never commit it.

- **Missing** (`example/osr-platform-vy-main` absent): tell the user it isn't cloned and
  **ask before cloning** — this pulls a remote repo. On confirmation:
  ```
  git clone --filter=blob:none <navigator.remote> example/osr-platform-vy-main
  git -C example/osr-platform-vy-main checkout <navigator.ref>
  ```
- **`--catchup [<ref>]`**: `git -C example/osr-platform-vy-main fetch origin`, then report
  how far `navigator.ref` is behind `origin/main` (`git log --oneline <ref>..origin/main`).
  Moving to a newer commit is a deliberate **re-pin** — check out the target ref (or
  `origin/main` if none given) and continue into `--pin` to record it.
- **Present, no flag**: leave it as-is and proceed.

## Modes

### `--pin` (snapshot the baseline, no scan)
1. `git -C example/osr-platform-vy-main rev-parse HEAD` (navigator) and
   `git -C . rev-parse HEAD` (driver).
2. Write both into `docs/bridge/pins.json` (`navigator.ref`, `driver.ref`) and append a
   `history` entry `{date, navigator_ref, driver_ref, report: null, note}`.
3. Report the two SHAs. Remind the user to commit `docs/bridge/pins.json`. Stop.

### default / `--area` / `--feature` (scan)

**Direction: navigator features → driver coverage.**

0. **Note the live refs.** Resolve the actual `HEAD` of each side at run time
   (`git -C example/osr-platform-vy-main rev-parse HEAD` for navigator;
   `git -C . rev-parse HEAD` for driver). These go in the report header. Never write a ref
   you didn't read live.

1. **Reconcile with the pin.** Compare each live `HEAD` to its `pins.json` `ref`. If they
   differ, flag the drift and ask whether to re-pin (`--pin`) or check out the pin first.

2. **Discover navigator features.** Scan the navigator clone to identify what has been spiked:
   - **Routes / pages**: `app/` and `pages/` structure reveals product surfaces.
   - **Domain models / services**: types, interfaces, service files in `lib/`, `utils/`,
     `src/`, `domain/` reveal what concepts are modeled.
   - **UI patterns**: components with meaningful names (not just primitives) indicate proven
     interaction patterns.
   - **DB schema / migrations**: `supabase/migrations/`, `prisma/schema.prisma`, or any
     schema file reveals persisted domain concepts.
   - **API surface**: route handlers, server actions, or RPC files reveal what operations
     are implemented.
   - Group by domain (e.g., auth, canvas/board, projects, AI generation, billing). Use the
     `orient` skill to build the navigator's code-surface map if the scan is broad.
   - `--area ui` → routes and components only; `--area features` → domain/services/schema
     only; `--feature <slug>` → limit to one domain area.

3. **Grade each navigator feature against the driver.** For each discovered navigator item,
   search the driver's actual source code (`platforms/web/src/`, `platforms/api/src/`,
   `core/`) for a corresponding implementation:
   - Classify: ✅ implemented · 🟡 partial · ❌ not yet built · ⚠️ deviates (driver built
     it differently than the navigator pattern).
   - Cite driver evidence as `path:line`, or `—` if absent.
   - For large scans, fan out with the Task tool (one domain area per subagent) and collect.

4. **Write the report.** Copy `docs/bridge/gap-reports/TEMPLATE.md` →
   `docs/bridge/gap-reports/<date>.md`. Fill the header with the **live refs from step 0**,
   the summary counts, and two tables (UI/surface patterns, Features/domain behavior). In
   each row's "Note / action" suggest a destination:
   - `→ breadboarding/` — a UI pattern the driver should wire up
   - `→ betting-table/` — a feature/domain the driver should formally plan
   - `→ navigator ahead` — navigator has drifted far enough that the driver team should
     decide whether to adopt or diverge.

5. **Update pins.** Set the latest `history[*].report` in `docs/bridge/pins.json` to the
   new report path.

6. **Hand back.** Print the summary table and the **top 3 navigator features the driver
   should adopt next** (highest-value gaps). Because `docs/bridge/` is tracked, remind the
   user to **commit the new report + pins** so this round joins the adoption history. Do NOT
   auto-promote to `breadboarding/` or `betting-table/` — that triage is the user's call.
   Do NOT touch navigator code.

### `--preview <slug>` (UI prototype from navigator)

Capture the navigator's latest UI for a feature as a **self-contained HTML prototype** —
visual fidelity of the spike, dummy domain data, no build step required. The goal is a
Figma-quality artifact in runnable code so the driver team can discuss adoption without
running the navigator locally.

1. **Locate the feature UI in the navigator.** Find the route/page for `<slug>` under
   `app/`, `pages/`, or similar. Identify the page component and all meaningful child
   components it composes (skip generic primitives like `<Button>` unless they carry
   domain-specific variants). Read each component file fully.

2. **Extract the visual contract.** From the component code derive:
   - Layout structure (grid, flex, card nesting, sidebar/main split, etc.)
   - Color tokens and spacing — check `tailwind.config.*`, `globals.css`, `tokens.css`,
     or CSS variables for the palette actually used. If Tailwind classes are used, note
     the exact class names so you can reproduce them via CDN.
   - Typography scale and font family.
   - Interactive states that matter for comprehension (hover highlight, selected row,
     loading skeleton, empty state).

3. **Infer the domain data shape.** Look at the component's props types, the page's
   `getServerSideProps` / server action / fetch call, or any adjacent `*.types.ts` /
   `schema.prisma` / Supabase migration. Build a clear mental model of what a realistic
   record looks like — field names, value ranges, enumerations.

4. **Synthesize dummy data.** Generate 3–8 records that feel real:
   - Domain-appropriate names and values (not "lorem ipsum", not "test1/test2").
   - Cover the interesting states: a healthy record, one in a warning/pending state, one
     that is empty or disabled — whatever the UI has distinct visual treatments for.
   - Keep data inline in the HTML (a JS `const DATA = [...]` block at the top of the
     `<script>` tag) so it is easy to edit.

5. **Generate the HTML file.** Output a single, fully self-contained file:
   - **No external local assets.** All CSS and JS must be inline or loaded from a CDN.
   - If the navigator uses Tailwind: load Tailwind CDN
     (`<script src="https://cdn.tailwindcss.com"></script>`) and reproduce the exact
     Tailwind classes from step 2. Extend the Tailwind config inline
     (`tailwind.config = { theme: { extend: { … } } }`) to register any custom tokens.
   - If the navigator uses plain CSS / CSS modules: inline an equivalent `<style>` block
     that faithfully reproduces colors, spacing, and typography.
   - Reproduce the layout structure from step 2 in plain HTML — one screen, no router.
   - Render all dummy records from `DATA` by injecting them via a small vanilla JS
     `document.addEventListener('DOMContentLoaded', …)` block. No React, no Vue, no
     framework runtime — just DOM manipulation or template literals.
   - Add hover/active states via CSS (`:hover`, `.active` class toggles) where the
     navigator has them. Keep interactions to what's needed to understand the concept —
     no business logic.
   - Add a thin banner at the top: `<!-- gap-scan preview: <slug> · navigator@<short-sha> · <date> -->`.

6. **Save and open.** Write to `docs/bridge/previews/<slug>-<date>.html`. Open it:
   ```
   open docs/bridge/previews/<slug>-<date>.html
   ```
   Then tell the user the path and what to look for (any fidelity gaps or data choices
   they should adjust before using it in a discussion).

**What this is not:** a runnable clone of the navigator. It does not need auth, routing,
or real API calls. It is a visual snapshot — the same role a Figma frame plays, but as
code anyone can open, fork, and modify without a design tool.

## Guardrails
- **Read-only against both repos' source.** Only writes under `docs/bridge/` (and clones
  into the gitignored `example/` when asked).
- Paths are repo-root-relative. The navigator clone is disposable; the bridge is durable.
- Absence of evidence in the driver is a gap, not a pass.
- The driver's `docs/**` are not the grading target — only actual source code counts as
  implementation evidence. A spec doc does not close a gap; running code does.
