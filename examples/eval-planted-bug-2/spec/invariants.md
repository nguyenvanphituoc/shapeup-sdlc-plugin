# Spec amendments — invariants added after UC-01 was first committed

UC-01 carries INV-01 … INV-05 inline, in the section it was written with. Anything added to the
spec *after* that use case was committed lands here instead, so the amendment history stays
readable rather than being smuggled into the original text.

## INV-06 — stored text is trimmed text

`add` stores the item text with leading and trailing whitespace removed, and the confirmation it
prints echoes the **stored** text.

`todo add "  write the pitch  "` therefore stores `write the pitch` and prints exactly:

```
added: write the pitch
```

— not the spacing the shell handed over.

**Rationale.** The list renderer aligns every row on its `<n>. [ ] ` prefix, so a leading space
inside the text breaks the alignment for every later reader of the store, and a trailing one makes
two items that look identical compare unequal.
