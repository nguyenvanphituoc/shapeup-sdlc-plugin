#!/usr/bin/env node
// Broken service — the negative control for the `http` oracle. It is reachable (so this is a
// stronger control than a server that never starts) but returns 500 for /health and the wrong
// body for /echo. A grader that always PASSes would wave this through; the oracle must FAIL it.
import { createServer } from "node:http";

const port = Number(process.env.PORT) || 3000;

createServer((_req, res) => {
  res.writeHead(500, { "content-type": "text/plain" });
  res.end("kaboom");
}).listen(port, "127.0.0.1");
