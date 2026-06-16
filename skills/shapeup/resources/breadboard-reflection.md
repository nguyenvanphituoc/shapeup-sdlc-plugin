# Breadboard Reflection — Reference

> Source: rjs/shaping-skills (upstream). Loaded on demand by the shapeup skill.

---

## What This Does

Reviews an existing breadboard for **design smells** and structural issues. Fixes wiring, naming, and causality problems before handing off to implementation.

**Input:** Existing breadboard document  
**Output:** Updated breadboard with issues annotated or fixed, plus change summary.

---

## Naming Smells

```
- [ ] Affordances named after UI framework types (Modal, Toast, Drawer, Card)
      → Rename to behavior: "error-notification" not "ErrorToast"
- [ ] Code affordances named after data structures not operations
      → Rename to verb+noun: "fetch-user-profile" not "userObject"
- [ ] Place names that are routes not contexts
      → Rename: "Account Settings" not "/dashboard/settings"
```

---

## Wiring Smells

```
- [ ] Dangling wire — "Wires Out" target not in any table
      → Add the target affordance or remove the wire
- [ ] Orphaned affordance — no incoming wire, no outgoing wire
      → Remove or connect
- [ ] UI → UI wire with no Code affordance in between
      → Either it's a direct UI event (document it) or a missing code step
- [ ] Multiple affordances returning to same place with no condition label
      → Add condition labels to distinguish paths
```

---

## Causality Smells

```
- [ ] Code affordance that reads AND writes in one step
      → Split into fetch + mutate (separate affordances)
- [ ] Guard logic buried in neutral-named affordance
      → Rename to show condition: "overview-guard (count > 0)"
- [ ] Missing return condition when two paths diverge from same affordance
      → Add explicit condition to both branches
```

---

## Scope Smells

```
- [ ] Place with 9+ affordances
      → Split the place or reconsider its boundary
- [ ] Single affordance spanning multiple scopes
      → Verify or split into separate affordances
```

---

## Mechanism Smell (from upstream)

When reviewing each Code affordance, ask:
> "Is this actually an affordance, or is it just detailing the mechanism for how something happens?"

If it's just the "how" — skip it and wire directly to the destination or outcome.

```
❌ N8 --> N22 --> P3     (N22 is modalService.open — just mechanism)
✅ N8 --> P3             (handler navigates to modal)
```

---

## Review Process

1. Read the full breadboard before making any changes
2. List all smells found (don't fix yet)
3. Prioritize: wiring smells > naming smells > scope smells
4. Fix in order, re-checking each fix doesn't introduce new smells
5. Output: updated breadboard + summary of changes made
