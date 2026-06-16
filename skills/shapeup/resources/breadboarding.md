# Breadboarding — Reference

> Source: rjs/shaping-skills (upstream). Loaded on demand by the shapeup skill.

---

## What Breadboarding Does

Breadboarding transforms a workflow description (existing system or shaped parts) into a complete map of **affordances** and their **relationships**. The output is always a set of tables showing numbered UI and Code affordances with their Wires Out and Returns To relationships.

**The tables are the truth. Mermaid diagrams are optional visualizations.**

---

## Use Cases

### 1. Mapping an Existing System

Input:
- Code repo(s) to analyze
- Workflow description (always from the perspective of an operator trying to make an effect happen — through UI or as a caller)

Output:
- UI Affordances table
- Code Affordances table
- (Optional) Mermaid visualization

Note: If the workflow spans multiple applications (frontend + backend), create ONE breadboard. Label places to show which system they belong to.

### 2. Designing from Shaped Parts

Input:
- Parts list (mechanisms from shaping)
- The R (requirement/outcome) the parts are meant to achieve
- Existing system (optional) — if the new parts must interoperate with existing code

### 3. Mixtures

Often you have both: an existing system that must remain as-is, plus new pieces or changes defined in a shape. Breadboard both together — existing affordances and new ones — showing how they connect.

---

## Core Concepts

### Places

A Place is a **bounded context of interaction**. While you're in a Place:
- You have a specific set of affordances available to you
- You **cannot** interact with affordances outside that boundary
- You must take an action to leave

**Place is perceptual, not technical.** It's not about URLs or components — it's about what the user experiences as their current context.

#### The Blocking Test

The simplest test for whether something is a different Place: **Can you interact with what's behind?**

| Answer | Meaning |
|--------|---------|
| **No** | You're in a different Place |
| **Yes** | Same Place, with local state changes |

#### Examples

| UI Element | Blocking? | Place? | Why |
|---|---|---|---|
| Modal | Yes | Yes | Can't interact with page behind |
| Confirmation popover | Yes | Yes | Must respond before returning |
| Edit mode (whole screen transforms) | Yes | Yes | All affordances changed |
| Checkbox reveals extra fields | No | No | Surroundings unchanged |
| Dropdown menu | No | No | Can click away, non-blocking |
| Tooltip | No | No | Informational, non-blocking |

#### Mode-Based Places

When a mode transforms the entire screen — different buttons, different affordances everywhere — model as separate Places:

```
PLACE: CMS Page (Read Mode)
PLACE: CMS Page (Edit Mode)
```

#### Labeling Conventions

| Pattern | Use |
|---|---|
| `PLACE: Page Name` | Standard page/route |
| `PLACE: Page Name (Mode)` | Mode-based variant |
| `PLACE: Modal Name` | Modal dialog |
| `PLACE: Backend` | API/database boundary |

### Place IDs

Each Place gets an ID. IDs enable explicit navigation wiring and Mermaid subgraph matching.

| # | Place | Description |
|---|---|---|
| P1 | CMS Page (Read Mode) | View-only state |
| P2 | CMS Page (Edit Mode) | Editing state |
| P2.1 | widget-grid (subplace) | Letter editing widget within P2 |
| P3 | Letter Form Modal | Form for adding/editing |
| P4 | Backend | API resolvers and database |

### Navigation Wiring

Wire to the **Place itself**, not to an affordance inside:

```
✅ N1 Wires Out: → P2          (navigate to Edit Mode)
❌ N1 Wires Out: → U3          (affordance inside P2)
```

### Affordances

- **UI affordances (U)**: inputs, buttons, displayed elements, scroll regions
- **Code affordances (N)**: methods, subscriptions, data stores, framework mechanisms

### Wiring

**Wires Out** — control flow (what an affordance triggers or calls):
- Call wires, write wires, navigation wires

**Returns To** — data flow (where an affordance's output flows):
- Return wires, read wires

---

## Output Tables

### Places Table

| # | Place | Description |
|---|---|---|
| P1 | Search Page | Main search interface |
| P2 | Detail Page | Individual result view |

### UI Affordances Table

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|---|---|---|---|---|---|
| U1 | P1 | search-detail | search input | type | → N1 | — |
| U2 | P1 | search-detail | loading spinner | render | — | — |
| U3 | P1 | search-detail | results list | render | — | — |
| U4 | P1 | search-detail | result row | click | → P2 | — |

### Code Affordances Table

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|---|---|---|---|---|---|
| N1 | P1 | search-detail | `activeQuery.next()` | call | → N2 | — |
| N2 | P1 | search-detail | `activeQuery` subscription | observe | → N3 | — |
| N3 | P1 | search-detail | `performSearch()` | call | → N4, → N5, → N6 | — |
| N5 | P1 | search-detail | `loading` | write | store | → U2 |
| N6 | P1 | search-detail | `results` | write | store | → U3 |

### Data Stores Table

| # | Place | Store | Description |
|---|---|---|---|
| S1 | P1 | `results` | Array of search results |
| S2 | P1 | `loading` | Boolean loading state |

---

## Procedures

### Mapping an Existing System

1. Pick a specific user journey — frame as "operator trying to do something"
2. Walk through the journey, identify each distinct place
3. Trace through the code from entry point; find every component touched
4. For each component, list UI and Code affordances
5. **Name the actual thing, not an abstraction** — if you write "DATABASE", stop. What's the actual method?
6. Fill in Control column (what triggers each affordance)
7. Fill in Wires Out (what does it trigger)
8. Fill in Returns To (where does its output flow)
9. Add data stores as affordances (write + read)
10. Add framework mechanisms (e.g., `cdr.detectChanges()`)
11. Verify against the code

### Designing from Shaped Parts

1. List each part from the shape
2. Translate parts into affordances (UI + Code per part)
3. Verify every U has a supporting N
4. Classify places as existing or new
5. Wire the affordances (Wires Out + Returns To)
6. Connect to existing system if applicable
7. Check completeness: handlers → Wires Out; queries → Returns To; stores → Returns To
8. Treat user-visible outputs as Us (emails, notifications)

---

## Key Principles

### Never use memory — always check the data
When tracing a flow backwards, scan the Wires Out column for ALL affordances that wire to your target. The tables are the source of truth.

### Every affordance name must exist (when mapping)
Never invent abstractions. Every name must point to something real.

### Mechanisms aren't affordances
Things that look like affordances but are just implementation details:
- Visual containers (`modal-frame wrapper`) — just a Place boundary
- Internal transforms (`letterDataTransform()`) — internal to caller
- Navigation mechanisms (`modalService.open()`) — wire to destination directly

```
❌ N8 --> N22 --> P3     (N22 is modalService.open — just mechanism)
✅ N8 --> P3             (handler navigates to modal)
```

### Two flows: Navigation and Data
- **Navigation flow**: Movement from Place to Place (Wires Out → Places)
- **Data flow**: How state populates displays (Returns To → Us)

Trace both flows when reviewing a breadboard.

### Every U that displays data needs a source
```
❌ U6: letter list (no incoming wire)
✅ S1 -.-> U6 (store feeds the display)
```

### Every N must connect
- Handlers → should have Wires Out
- Queries → should have Returns To
- Data stores → should have Returns To

### Backend is a Place
The database and resolvers aren't floating infrastructure — they're a Place with their own affordances.

---

## Subplaces

A **subplace** is a defined subset of a Place. Use when a Place contains multiple distinct widgets. Notation: `P2.1`, `P2.2`, etc.

---

## Chunking

Collapse a subsystem with one wire in + one wire out into a single chunk node. Show internals separately in a chunk diagram. Use stadium shape in Mermaid: `dynamicForm[["CHUNK: dynamic-form"]]`

**Color**: `#b3e5fc` (light blue)

---

## Mermaid Visualization

### Line Conventions

| Line Style | Mermaid Syntax | Use |
|---|---|---|
| Solid (`-->`) | `A --> B` | Wires Out: calls, triggers, writes |
| Dashed (`-.->`) | `A -.-> B` | Returns To: return values, data store reads |
| Labeled | `A -.->|label| B` | Abbreviated flow |

### Color Conventions

```
classDef ui fill:#ffb6c1,stroke:#d87093,color:#000
classDef nonui fill:#d3d3d3,stroke:#808080,color:#000
classDef store fill:#e6e6fa,stroke:#9370db,color:#000
classDef chunk fill:#b3e5fc,stroke:#0288d1,color:#000,stroke-width:2px
classDef placeRef fill:#ffb6c1,stroke:#d87093,stroke-width:2px,stroke-dasharray:5 5
```

### Subgraph IDs = Place IDs
Use Place IDs as subgraph IDs so navigation wiring connects properly:
```
subgraph P1["P1: CMS Page (Read Mode)"]
    U1["U1: Edit button"]
end
N1 --> P2   ← wire connects to Place boundary
```

---

## Slicing a Breadboard

Slicing groups affordances into **vertical implementation slices** — each demonstrating a mechanism working.

### Rules
- **Every slice must have visible UI that can be demoed**
- Demo means: entry point (UI interaction) + observable output (UI renders, effect occurs)
- Aim for ≤ 9 slices
- Right size: coherent journey with clear "watch me do this" demo

### Procedure

1. **Identify minimal demo-able increment** — core data fetch + basic rendering (V1)
2. **Layer mechanisms as slices** — each slice = one mechanism from the shape
3. **Assign affordances** — each affordance in the slice where it's first needed
4. **Create per-slice affordance tables**
5. **Write a demo statement** for each slice: "Type 'dharma', results filter live"

### Slice Summary Format

| # | Slice | Mechanism | Demo |
|---|---|---|---|
| V1 | Widget with real data | F1, F4, F6 | "Widget shows letters from API" |
| V2 | Search works | F3 | "Type to filter results" |
| V3 | Infinite scroll | F5 | "Scroll down, more load" |

### Visualizing Slices

| Category | Style | Description |
|---|---|---|
| **This slice** | Bright color | Affordances being added |
| **Already built** | Solid grey | Previous slices |
| **Future** | Transparent, dashed border | Not yet built |

---

## Verification Checks

| Check | Question | If No... |
|---|---|---|
| Every U that displays data | Incoming wire present? | Add the data source |
| Every N | Has Wires Out or Returns To? | Investigate — may be dead code |
| Every S | Something reads from it? | Investigate — may be unused |
| Navigation mechanisms | Is N just "how" of getting somewhere? | Wire directly to Place |
| N with side effects | Affects external state? | Add a store for external state |
