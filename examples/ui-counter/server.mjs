#!/usr/bin/env node
// Worked fixture for the `ui` oracle — the CORRECT build.
//
// A one-screen counter, served by a zero-dependency Node HTTP server on `process.env.PORT` (the
// port the oracle picks), deliberately shaped to exercise every part of the affordance grammar:
//
//   • `data-testid` on each affordance         → the oracle addresses elements the way a Test
//                                                 Surface row does, never by CSS path
//   • `data-state` on the readout               → the state transition the judge grades, instead
//                                                 of colour or position (the frozen styling layer)
//   • a disabled control that becomes enabled   → an affordance state change, observable
//   • no `export` affordance anywhere           → a pitch no-go, gradeable as an ABSENCE
//   • a clean console                           → nothing thrown while the flow runs
//
// `broken-server.mjs` is the negative control: same screen, every one of those five claims false.

import { createServer } from "node:http";

const PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Counter</title></head>
<body>
  <h1>Counter</h1>
  <output data-testid="count" data-state="clean">0</output>
  <button data-testid="inc" type="button">+1</button>
  <button data-testid="reset" type="button" disabled>Reset</button>
  <script>
    const out = document.querySelector('[data-testid="count"]');
    const reset = document.querySelector('[data-testid="reset"]');
    let n = 0;
    document.querySelector('[data-testid="inc"]').addEventListener("click", () => {
      n += 1;
      out.textContent = String(n);
      out.dataset.state = "dirty";
      reset.disabled = false;
    });
    reset.addEventListener("click", () => {
      n = 0;
      out.textContent = "0";
      out.dataset.state = "clean";
      reset.disabled = true;
    });
  </script>
</body>
</html>`;

createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(PAGE);
}).listen(Number(process.env.PORT) || 3000, "127.0.0.1");
