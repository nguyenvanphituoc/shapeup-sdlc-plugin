// paths — the path resolver every consumer and hook imports. A facade: the names live in
// `../shapeup/paths.mjs` (the two roots and Shape Up's own artifacts) over the run-trace mechanism in
// `../core/runtrace.mjs`. Kept at this path because `bin/init.mjs` and every hook import it.
export * from "../shapeup/paths.mjs";
