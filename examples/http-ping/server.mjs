#!/usr/bin/env node
// Tiny self-contained service deliverable for the `http` oracle worked example.
// Binds to process.env.PORT (the oracle assigns a free one). Zero dependencies.
//   GET  /health        → 200 "ok"
//   POST /echo {msg}    → 200 {"msg": <msg>}
//   anything else       → 404 {"error":"not found"}
import { createServer } from "node:http";

const port = Number(process.env.PORT) || 3000;

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  if (req.method === "POST" && req.url === "/echo") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      let msg = null;
      try { msg = JSON.parse(body).msg; } catch { /* leave null */ }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ msg }));
    });
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
}).listen(port, "127.0.0.1");
