#!/usr/bin/env node
// Negative control for the `ui` oracle — the build that must FAIL every criterion.
//
// It is deliberately the kind of broken that LOOKS fine: the page renders, the heading is right,
// the buttons are there and clickable, and a screenshot would be almost indistinguishable from
// `server.mjs`. Every defect is behavioural, and each one is aimed at exactly one criterion of
// `counter.contract.json`:
//
//   U1  the readout starts at "NaN", not "0"
//   U2  the click handler updates a variable but never the DOM, and never sets data-state
//   U3  Reset stays disabled forever — the affordance state change never happens
//   U4  the handler throws on every click, so the console is not clean
//   U5  an `export` affordance is rendered — the pitch no-go, breached
//
// A grader that rubber-stamps this is worthless, which is the whole point of keeping it.

import { createServer } from "node:http";

const PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Counter</title></head>
<body>
  <h1>Counter</h1>
  <output data-testid="count">NaN</output>
  <button data-testid="inc" type="button">+1</button>
  <button data-testid="reset" type="button" disabled>Reset</button>
  <button data-testid="export" type="button">Export CSV</button>
  <script>
    let n = 0;
    document.querySelector('[data-testid="inc"]').addEventListener("click", () => {
      n += 1;
      missingHelper(n);
    });
  </script>
</body>
</html>`;

createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(PAGE);
}).listen(Number(process.env.PORT) || 3000, "127.0.0.1");
