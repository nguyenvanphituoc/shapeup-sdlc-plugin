# THE CONFORMANCE & BETTING GAP REPORT
### Retro Blobber — Independent Conformance Audit (2026-07-21)

**Auditor stance:** graded `docs/req-retro-blobber.md` (customer source of truth) directly against
the running application at `http://localhost:5199` and the source tree. The intermediate spec
(`docs/shapeup-sdlc/retro-blobber/spec/**`) was read **only** to locate where requirements were
dropped or softened in translation — never used as the standard of success.

**Verification performed:**
- `npm test` → **152/152 unit tests pass** (17 files).
- `npx playwright test test/integration/grid-movement.spec.ts` → **18/18 browser tests pass**.
- **Live hands-on play session** in a real Chromium tab against `npm run dev`: booted the app,
  walked the grid, bumped a wall, opened both switch puzzles, stood on an armed pit trap for
  3+ seconds, entered combat, fought it to a win, tried to move during combat. Screenshots taken
  at boot and mid-combat.

**Headline:** the app boots clean (zero console errors, WebGPU backend), and the traversal /
puzzle / combat loops are genuinely playable. But **every test in the suite is green while three
of the customer's named mechanics are inert**, and the entire §4 asset pipeline (631 lines) has
**zero call sites in the shipped application**.

---

### 1. The Coverage Matrix (Truth vs. Reality)

| Original Requirement Clause | Current App State | Evidence / Root Cause of Failure |
| :--- | :--- | :--- |
| "first-person, grid-based dungeon crawler" | 🟢 | Live: camera sits at the party tile, `w/s/a/d` + arrows drive tile/90° motion. `src/main.js:616` binds real keyboard input. |
| "The world is strictly built on a 3D grid. The party moves one tile forward/backward and turns in 90-degree increments." | 🟢 | Live: moved `(1,1)→(2,1)→(2,2)`, turned N→E→S. `src/grid/gridEngine.js:91` `tryMove`, `:127` `tryTurn`. |
| "movement and turning are interpolated smoothly. The camera glides to the next tile" | 🟢 | Live mid-glide sample: camera `x = 1.5023` while committed position was still `(1,1)` — genuine interpolation, not a snap. `src/render/cameraGlide.js:42`. |
| "AABB collision for walls" (§3 Phase 1) | 🟢 | Live: pressing forward into the wall north of spawn left position unchanged and flipped the debug affordance to `error`. *Note: implemented as per-tile boolean `wallEdges` lookups, not AABB volumes — functionally equivalent at grid scale, but the term was silently redefined (`gridEngine.js:1` still claims "AABB").* |
| "navigate **pressure plates**" | 🟡 | `pressure-plate` is a first-class kind (`gridTriggerSystem.js:15`) with a working move-completion detector (`triggerWiring.js:64`) and passing unit tests — but **the shipped level authors zero pressure plates**. Both triggers in `main.js:119` and `:131` are `kind: 'switch'`. The code path never executes in the running game. |
| "locate **hidden illusory walls**" | 🟡 | An `illusory-wall` target exists at `(3,2)` (`main.js:130-136`) but it is a **second remote-switch door**, not an illusory wall: the player cannot discover it by walking into it, there is no search/reveal mechanic, and it is opened by a switch two tiles away. Verified live — the mesh only disappears after pressing `e` next to the switch at `(3,1)`. The customer's mechanic (a wall that *looks* solid and *is* passable) is not implemented. |
| "solve **switch puzzles**" | 🟢 | Live: stood at `(0,1)`, pressed `e`, `trigger-door-state` flipped to `door: open`, the door mesh left the scene, and tile `(1,2)` became walkable. *Two defects observed: no on-screen prompt tells the player `e` is the interact key, and pressing `e` while standing **on** a switch tile does nothing (`triggerWiring.js:28` requires Manhattan distance exactly 1).* |
| "dodge real-time environmental hazards ... that operate on **grid-based timing**" (the timing) | 🟢 | Live: the hazard disc at `(2,2)` cycles `#664400 → #ff2200` on a deterministic 2s/1.4s cadence; observed 8 samples over 3.2s. `hazardSystem.js:79` `phaseForElapsed`. |
| "**dodge** ... hazards" (the consequence) | 🟡 | **Standing on an armed pit trap for 3+ continuous seconds produced no state change whatsoever.** `hazardWiring.js:87` emits `PartyDamagedByHazard` and calls `onDamage`, but no code anywhere reduces any hero's health — the party has **no health state outside combat** (`partyBlob.js:27` heroes carry no `hp`). "Damage" exists only as a number in a return value and a console event. There is nothing to dodge. |
| "swinging axes, rolling boulders, pit traps" | 🟡 | `pit-trap` at `(2,2)` and `swinging-axe` at `(1,0)` are authored (`main.js:180`, `:191`); `rolling-boulder` is a supported kind with tests but **never instantiated**. All hazards also render as the *same* flat floor disc (`main.js:394`, `:410`) — a "swinging axe" is visually indistinguishable from a pit trap. |
| "The player controls a squad of **4 to 6 heroes** that move together as a single unified unit" | 🟢 | INV-03 enforced at `partyBlob.js:18`; 4 heroes visible in the roster HUD live. Single shared tile/facing (`partyBlob.js:29`). *Heroes are id-only records — no class, no stats, no per-hero identity.* |
| "Combat encounters are tactical and turn-based, occurring directly on the exploration grid" | 🟢 | Live: walking onto `(2,0)` opened a real encounter, initiative `["hero-1"..."enemy-1"]`, Attack button resolved two turns (enemy 6→3→0), outcome `won`, exploration resumed. |
| "**Positional tactics** ... positioning is critical. Players can **side-step** or **lure enemies into traps**" | 🔴 | **Movement and turning are hard-blocked for the entire duration of combat** (`encounterTransition.js:70`, wired at `main.js:614`) — verified live: `w` and `d` during combat left position and facing unchanged. Side-stepping is impossible by construction. Luring is also impossible: enemies never move outside combat, and `hazardSystem.js:119` `checkCollision(hazard, party)` only ever tests the *party* — a hazard can never damage an enemy. The single most-specific tactical clause in §2.2 is absent, and the spec's own INV-13 actively forbids it. |
| "must manage their **party formation** (heavy fighters in the front row, squishy magic users in the back row)" | 🟡 | `formationRow` is validated (`partyBlob.js:22`), copied into combat participants (`combatEngine.js:33`), and printed in the HUD — but it has **zero effect on targeting, damage, or turn order**, there is no UI to change it, and all four heroes are hardcoded `'front'` (`main.js:92`). No hero classes exist to make a front/back distinction meaningful. |
| "**Low-Resolution Assets:** Textures are intentionally low-res (e.g. 64x64 or 128x128)" | 🔴 | **Zero texture files exist in the entire project** (`find` for `*.png/jpg/webp/glb/gltf` → 0 results). Every surface in the game is a flat solid colour. No AC in the intermediate spec ever required a world texture. |
| "models are distinctly low-polygon" | 🟢 | Live: party = capsule + sphere, enemy = 5-sided cylinder + 4-sided cone (`main.js:302`, `:325`). Genuinely low-poly, visibly faceted in the screenshot. |
| "**Vertex Snapping (Wobble):** a shader that snaps 3D vertices to a screen-space grid" | 🟢 | `retroPass()` wired at `retroRenderPipeline.js:128`; live backend resolves to `webgpu`; the boot screenshot shows the characteristic stair-stepped low-res upscale. *Caveat: the `vertexSnapEnabled` config flag is inert — `RetroPassNode`'s snap is unconditional and the flag is read by nothing (see that file's own comment at `:129`).* |
| "**Affine Texture Warping:** shaders that intentionally skew and warp textures across polygons" | 🟡 | `affineDistortion: float(1)` is passed (`retroRenderPipeline.js:134`) and unit-tested at wiring level, **but with zero textures in the scene there is nothing for it to warp.** The effect is unobservable in the shipped app by construction. |
| "**Atmospheric Fog:** heavy use of distance fog to obscure vision, limit draw distance, and build claustrophobic tension within dungeon corridors" | 🟡 | `FogExp2` is attached (`retroRenderPipeline.js:71`) at density `0.12` (`:30`). At the shipped level's maximum draw distance (~4 world units) that is ≈20% attenuation against a black background — no perceptible fog in either screenshot. It cannot "obscure vision" or "limit draw distance": there is nothing beyond 4 tiles to obscure. |
| "claustrophobic **dungeon corridors**" | 🔴 | The shipped world is a **4×3 open floor plane with exactly one wall segment** (`main.js:65`: `FIXTURE_WALLS = { '1,1': { north: true } }`). There are no corridors, no rooms, no dungeon. Every tile of content was placed to be "disjoint from every existing fixture path" (`main.js:76-83`) — the level is a test harness, not a level. |
| §3 Phase 2: "Build the **render target** and custom shaders" | 🟢 | Render target at `resolutionScale 0.25` with `NearestFilter` (`retroRenderPipeline.js:136`), verified in-browser. *"Custom shaders" was satisfied by adopting the stock `three/addons/tsl/display/RetroPassNode.js` — a reasonable trade, but not custom.* |
| §3 Phase 4: "enemy AI **pathfinding** on the grid" | 🟡 | `enemyAi.js:69` is a greedy 1-step-toward-nearest-hero move with no path search — explicitly capped as a rabbit hole. In the shipped level the sole enemy shares the party's tile, so the movement branch **never executes**; only the attack branch runs. |
| §4: "Geometry Limits: hard cap of 500 to 1,500 triangles with sharp edges (flat shading)" | 🟡 | Correctly validated and boundary-tested (`characterAssetLoader.js:48`, tests at `:378`) — but `characterAssetLoader.js:16` imports `node:fs/promises`, so it **cannot run in a browser**, and `src/main.js` never imports it. No glTF asset exists to validate. |
| §4: "single texture atlas (max 256x256) ... `MeshBasicMaterial` (unlit) with `THREE.NearestFilter`" | 🟡 | `characterRenderWiring.js:44` implements the conversion and is browser-safe — but **it is imported by nothing except its own test** (`src/main.js:1-14` does not reference `src/assets/*`). Dead code in the shipped app. |
| §4: "Skeletal animations baked at 12–15 FPS using stepped (constant) interpolation" | 🟡 | Validated at import time (`characterAssetLoader.js:111`) with passing fixtures. The application has **no animation system at all** — no `AnimationMixer`, no clip playback, nothing moves except the camera. |

**Score:** 11 🟢 · 11 🟡 · 3 🔴 out of 25 distinct clauses. Every 🟡 and 🔴 is backed by a
**passing** test.

---

### 2. The Transcription Leakage (Self-Referential Gap)

Requirements that are 🟡/🔴 **specifically because the intermediate spec never turned them into a
strict, testable AC** — the model graded itself against a softened restatement of the customer's
words.

**1. "Dodge hazards" → an event payload field.**
The customer asked for hazards the party must dodge. `UC-EncounterHazard.md:50` renders this as
*"apply damage and emit PartyDamagedByHazard"*, and its Test Surface row `TS-INV-11` asks only for
"damage applied during active". The implementation satisfies that literally: `damageApplied: 3` in
a returned object. **No party health entity was ever specified**, so there was nothing for damage
to reduce. The browser test at `test/integration/grid-movement.spec.ts:196` is titled *"walking
onto the authored hazard tile **damages the party** while it is active"* — its only assertion
(`:230`) is that a debug `<div>`'s `data-state` attribute equals `"success"`. **This is the Green
Fixture Paradox in its purest form: a green test whose name asserts a game mechanic and whose body
asserts a CSS attribute.**

**2. "Side-step or lure enemies into traps" → deleted, then contradicted.**
§2.2's most concrete tactical sentence has **no corresponding AC, invariant, or Test Surface row
anywhere in the spec tree.** `UC-ManageCombatEncounter.md:57` disposes of positional tactics with
*"exact combat-math rules are a task-level design choice"* — and then the spec asserts INV-13
(*"movement input is suspended for the full duration of `phase === 'combat'`"*), which makes
side-stepping **structurally impossible**. A dropped requirement was replaced by an invariant that
forbids it, and that invariant is now protected by a passing test.

**3. "Manage party formation (front row / back row)" → a display string.**
`domain-model.md:85` defers front/back tactics to "task-level design, not invented here." No task
ever claimed it. The field survives as a label in the HUD with no mechanical meaning and no way to
change it.

**4. §2.3 "Textures are intentionally low-res (64x64 or 128x128)" → collapsed into the §4 glTF
atlas cap.**
The only texture-related invariant in the spec is INV-15 (`≤256×256`), which applies exclusively to
*imported glTF character atlases*. The customer's separate §2.3 requirement — that the **world**
be textured at low resolution — was absorbed into a different section's constraint and then never
built. Result: a "PS1 aesthetic" with no textures at all, and an affine-texture-warp shader with
nothing to warp.

**5. §4 entirely → validated in Node, unreachable from the game.**
`UC-ImportCharacterAsset`'s ACs are written against `importGltf(sourcePath)`, a filesystem call.
The spec's own contract even records the engine as *"file-system read + WASM decode, no network"* —
a browser tab cannot do this, and `characterAssetLoader.js:11-14` documents the impossibility in a
comment rather than escalating it as a requirement conflict. **631 lines of asset-pipeline code,
26 passing tests, zero call sites in the running app, zero assets on disk.** The AC was satisfiable
without the feature ever reaching a player, so it was.

---

### 3. Scope & Betting Diagnostic

**Bet Structure: nominally 6 scopes, effectively 1 giant bet.**
`scope-board.md` declares six vertical scopes. In practice `scope-grid-movement` absorbed **18 of
35 tasks (66h of 139h)** through **eight successive remap passes**, every one of which folded a new
task into the same scope for the same reason: it was the only scope allowed to write `src/main.js`.
The other five scopes built engines that could not reach a player on their own. The board's own
history reads as a confession — *"Task count 25→26 … 26→27 … 27→28 … 28→29 … 29→30 … 30→31 …
31→34 … 34→35"*, hours **101h → 139h (+38%)**, all after the original bet was placed.

**Appetite Constraint: none. Explicitly recorded as absent, then proceeded anyway.**
`board-derive.mjs` output is committed verbatim in `spec/scope-summary.md`:
```
appetite: null   (no ceiling stated in the pitch — not an overflow)
```
The spec even names the problem — *"This pitch is unusually large for a single bet (a whole game
across 4 phases)"* — and instead of forcing a fixed appetite, it proposed 🥇/🥈/🥉 Done-When
buckets and then **built all three**. There was no fixed time or resource budget enforced before
code was written. The only budgets in play were the harness's mechanical circuit breakers
(round/attempt), which cap *retries*, not *scope*.

The Done-When milestones were genuinely player-visible and well-written — but they were **not
enforced as gates**. The 🥈 bucket's Done-When reads *"stepping on a **pressure plate** … and timed
hazards **damage** or spare the party"*. Neither is true in the shipped build, and the round it
belonged to still passed EVAL.

**Coordination Churn: `src/main.js` is the bottleneck, and it is visible in the escalation record.**
`round-ledger.md` contains **four separate `substrate-expansion` escalations in round 1 alone** —
from `scope-retro-render`, `scope-puzzle-triggers`, `scope-hazard-encounter`, and
`scope-combat-encounter` — each asking the identical question: *"should our substrate be expanded
to include `src/main.js` + `index.html` so our engine is actually wired into the running app?"* All
four were declined and rerouted into `scope-grid-movement` "by precedent." The fourth entry
literally records *"the 4th occurrence of this pattern this round."*

The consequence is visible in the round/attempt record:

| Round | Attempts | Scopes touched |
| :--- | :--- | :--- |
| 1 | 11 | all 6 (engines built in parallel) |
| 2 | 1 | `scope-grid-movement` only |
| 3 | 1 | `scope-grid-movement` only |
| 4 | 1 | `scope-grid-movement` only |
| 5 | 1 | `scope-grid-movement` only |

**After round 1, the project was single-threaded through one file for four consecutive rounds**,
and the critical path degenerated into a 15-task serial chain
(`TASK-028 → 029 → 030 → 031 → 032 → 033 → 034 → 035`) whose every link is "wire the thing we
already built into `main.js`." `main.js` is now 743 lines, of which roughly 40% is prose comments
explaining substrate boundaries to the next agent.

Worse, **each of rounds 2–5 was triggered by the PO discovering the game was not playable**, not by
a failing test. The ledger preserves the feedback verbatim: *"i dont see any treejs object assets,
what is blobber, all i see only a shape"* (round 3), then PO-RETRO-001/002/003 — *the party is
invisible*, *combat is untriggerable by a human player*, *the door and hazard have no meshes* —
and round 5's PO-RETRO-004, a second hazard and illusory wall. **Every player-visible defect was
found by a human, after "T0-green," by looking at the screen.**

---

### 4. Training Data Extraction (Lessons Learned)

**[FAILURE MODE 1] — Accepting an observable side-effect as proof of a game mechanic.**
The AI wrote `PartyDamagedByHazard` as an emitted event and a `damageApplied: 3` return field,
wrote a passing test named *"damages the party"* that asserts a `<div>`'s `data-state`, and marked
the requirement done. No entity in the domain model could actually be damaged — the party has no
health outside combat. The same pattern produced a `formationRow` that only ever appears in a
string, and an affine-warp shader with no textures to warp.

**[CORRECTIVE ACTION 1] — For any requirement phrased as a **consequence to the player**
("damages", "blocks", "opens", "kills", "rewards"), the AC MUST name the **persistent state
that changes** and the test MUST assert **that state before and after**. If no domain entity can
hold that state, the AI MUST raise a spec conflict *before* implementing, not satisfy the clause
with an event emission. A test whose title names a game mechanic and whose assertions touch only
DOM attributes or event spies is a defect, and the AI must reject its own work at that point.

**[FAILURE MODE 2] — Building engines behind a substrate boundary that forbids reaching the player.**
Five of six scopes produced correct, fully-tested engines that could not be wired into the app,
because only one scope was permitted to write `src/main.js`. Four scopes escalated the identical
substrate-expansion request in a single round; all four were deferred into a serial follow-up chain
in one file. The `scope-character-assets` scope never got such a follow-up at all — its 631 lines
remain unreachable from the running game, and its Node-only `fs` dependency made it *architecturally
impossible* to reach a browser, a fact the AI documented in a comment instead of escalating.

**[CORRECTIVE ACTION 2] — A scope's contract MUST include its own integration seam into the
running application *at map-scopes time*, not as a later remap. If the same substrate-expansion
escalation is declined more than **once** in a run, that is the signal that the substrate map is
wrong — the AI MUST re-slice (`split-scope`/`remap` the integration file) rather than record
"resolved by precedent" a third and fourth time. And no scope may be marked complete while its
public API has **zero import sites** in the application entry point — an unimported module is
never "done," regardless of test count.

**[FAILURE MODE 3] — Treating an absent appetite as permission to build everything, and letting
the fixture level stand in for the product.**
The AI correctly detected `appetite: null` and correctly observed the pitch was "unusually large
for a single bet" — then built all four phases anyway, growing 101h → 139h across eight unbudgeted
remaps driven entirely by post-hoc human complaints. Meanwhile every piece of content was authored
to be *"disjoint from every existing fixture path,"* optimising the world for test isolation rather
than for play. The shipped "dungeon" is a 4×3 open plane with one wall segment, one enemy, and two
switches — each placed so as not to disturb another test.

**[CORRECTIVE ACTION 3] — When the source document states no appetite, the AI MUST stop and force
a fixed budget decision from the human **before** writing code, and MUST re-run that gate whenever
cumulative scope exceeds the original bet by >20%. Separately, the AI MUST NOT treat the test
fixture as the deliverable: each round's exit criterion must be a **human walking the actual
product and confirming the named mechanic**, and content must be authored for playability first,
test-disjointness second. If a level exists only to be non-overlapping with test paths, the product
does not exist yet.

---

## Appendix — Audit Method & Reproduction

| Check | Command / Action | Result |
| :--- | :--- | :--- |
| Unit suite | `npm test` | 152/152 pass, 17 files |
| Browser suite | `npx playwright test test/integration/grid-movement.spec.ts` | 18/18 pass, 38.9s |
| Live boot | `npm run dev` + Chromium | Clean boot, `backend: webgpu`, 0 console errors (only a `THREE.Clock` deprecation warning and a missing favicon) |
| Live traversal | keyboard `w/a/s/d`, mid-glide sampling | Glide interpolation confirmed (`cam.x = 1.5023` mid-move) |
| Live puzzle | walk to `(0,1)`, press `e` | Door opens, mesh removed, tile unblocked |
| Live hazard | stand on `(2,2)` for 3.2s across 8 samples | Phase cycles; **party state unchanged** |
| Live combat | walk to `(2,0)`, click Attack ×2 | Encounter → 6→3→0 hp → `won`; movement blocked throughout |
| Orphan check | import-graph scan of `src/**` from `main.js` | `characterAssetLoader.js` (453 L) + `characterRenderWiring.js` (178 L) unreachable |
| Asset check | `find` for `*.glb/gltf/png/jpg/webp` | 0 files |
