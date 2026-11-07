# SPIKE-NOT-NEEDED

Risk scan ranked every area 0: there is no existing code, no third-party API and no data shape to confirm. All
needed capability is Node built-ins (`node:fs`, `node:test`, `node:child_process`, global `URL`). The one
behavioural unknown, `url` validation, was probed on Node v24.15.0 with `new URL(s)`: `http://a.b` ok,
`https://x.com/p?q=1` ok, `foo` throws, `http://` throws, but `a:b` and `mailto:x@y` are accepted
(protocol `a:` / `mailto:`). Shape-only validation via `new URL` therefore works; whether to require an
http(s)-like protocol is a spec decision for the planner, not a risk. Quoted-value and `export` parsing are
plain string handling with no prior-art gap.
