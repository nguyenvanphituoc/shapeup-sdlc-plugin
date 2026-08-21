---
description: Render the Hill Chart dashboard — a portfolio of pitches, or one pitch's detail
---
Use the **hill-chart** skill on $ARGUMENTS.

Renders a self-contained dashboard from committed hill shards (`shapeup/<slug>/hill/*.yml`) and
each pitch's local run graph (`.shapeup/<slug>/graph.jsonl`): a portfolio card per pitch, and
per-pitch detail with a mechanical Hill Chart, an attention list, a scope board, round history,
and the full run graph one click deeper. Give a slug to render one pitch only; no argument
renders the whole portfolio.
