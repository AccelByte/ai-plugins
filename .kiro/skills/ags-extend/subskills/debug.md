---
last-verified: 2026-05-07
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[local-run.md](../references/debug/local-run.md)'
- '[test-guide.md](../references/debug/test-guide.md)'
---

# AGS Extend Local Debugger

Run an Extend app locally and guide the developer through invoking it to verify it works — before they commit, before they deploy. Four steps: identify the app, check prerequisites, start the local server, walk through testing.

## Behavior Constraints

<grounding_rules>

- Read `references/debug/local-run.md` for startup commands, default ports, and ready-signal patterns. The commands there are per-pattern and per-language — do not reuse a Go command for a Python app.
- Read `references/debug/test-guide.md` for invocation strategies (gRPC with grpcurl, REST with curl, simulating AGS events, tunneling via ngrok for Override).
- Do not invent startup commands, ports, or env vars not in the reference files. If something is missing, tell the user to check the app's own README.

</grounding_rules>

<tool_usage_rules>

- Use `Bash` to run environment checks, app discovery (`test -f Makefile`, `ls */Makefile`), start the local server (foreground, streaming), and run test commands on the user's behalf.
- Use `Read` for `.env` and reference files.
- Use `Glob` to enumerate Extend app dirs (`*/Makefile` siblings) or to find an app's `README.md` when the user didn't specify.
- Use `Edit` **only** to update `.env` values the user explicitly asks to change (e.g. fill in `AB_BASE_URL`). Never edit source code from this subskill.
- Never start the server without explicit confirmation in Step 3.
- If the app is started with `run_in_background`, the logs stream comes from `BashOutput`; report a short excerpt (not 500 lines) in responses.

</tool_usage_rules>

<dependency_checks>

Before starting the server, verify:

1. The current directory has `Makefile` + `Dockerfile` (or one level up holds app-dir siblings, or the user pointed at an app directory).
2. The language runtime for the app is present and at/above minimum (see `subskills/install-dep.md#runtime-minimums`).
3. For Go apps: `go.sum` exists, meaning dependencies have been fetched. If not, direct the user to `/ags-extend install-dep`.
4. For Python/Java/C#: equivalent signals (`__pycache__` or `.venv` for Python, `build/` or `target/` for Java, `bin/` or `obj/` for C#).
5. The app's `.env` file exists. If not, check for `.env.template` and offer to copy it.
6. The default ports aren't already in use: `6565` (gRPC) and `8080` (Prometheus metrics) for every pattern, plus `8000` (HTTP/REST gateway) for Service Extension.
7. Docker is running if the app uses integrations that bring up sidecars (mongodb container, kafka container) via `docker-compose`.

</dependency_checks>

<action_safety>

Starting a local server is a non-destructive foreground operation, but:

- Confirm the command and working directory before launching.
- If `docker-compose` is part of the flow, confirm before running `docker-compose up` — it'll pull images and spin up containers.
- Never auto-kill processes holding the port. Report the occupier and let the user decide.
- Never edit the user's source. If a startup error points at a bug in their code, surface it and stop — don't "helpfully" patch `main.go`.

</action_safety>

<user_updates_spec>

During Step 4, stream the server's output. When the ready signal appears, immediately print the testing guide. Continue streaming logs until the user stops the process with Ctrl+C. If the process exits on its own (crash), print the last output and the "unexpected exit" block.

</user_updates_spec>

<output_contract>

Output progresses through these blocks, each printed once:

1. **App selection block** — which app was chosen, pattern/language/path.
2. **Prerequisites block** — checklist of environment signals, pass/fail per item.
3. **Launch plan block** — command, working dir, port(s), confirmation prompt.
4. **Startup stream** — the server's own stdout/stderr, live.
5. **Ready block** (printed once the ready signal appears) — how to test, which ports, sample commands.
6. **Exit block** (on crash or stop) — final status and next step.

</output_contract>

## Workflow

### Step 1 — Identify the app

```bash
# Are we already inside an app dir?
test -f Makefile && test -f Dockerfile && echo "in app: $(basename $(pwd))"
# Or are app dirs one level down?
ls */Makefile 2>/dev/null
```

If neither pattern matches:

> No `Makefile`+`Dockerfile` here or as a sibling one level down. Either `cd` into your Extend app directory (or its parent for a multi-app project), or run `/ags-extend wizard` to scaffold one. Stopping.

Single app dir → use it. Multiple `*/Makefile` siblings → list and ask:

```
Found 2 Extend app dirs in this project:
  1. matchmaking-override (go) — ./matchmaking-override
  2. match-event-handler (go) — ./match-event-handler

Which one?
```

If the user named an app in their invocation ("/ags-extend debug the event handler"), pick it directly and confirm in one line.

### Step 2 — Prerequisites

Read `references/debug/local-run.md` for the target app's pattern + language.

Run checks in parallel:

```bash
# Runtime
{language-specific --version command from reference}

# Docker (only if integrations need it)
docker --version 2>&1
docker info 2>/dev/null | grep "Server Version"

# Port occupation (gRPC + metrics, every pattern)
lsof -i :6565 2>/dev/null | head -2
lsof -i :8080 2>/dev/null | head -2
# For Service Extension only, also the REST gateway:
lsof -i :8000 2>/dev/null | head -2

# .env sanity
ls {app-path}/.env 2>/dev/null
```

Read `.env` if present. Check `AB_BASE_URL` and `AB_NAMESPACE`. Anything like `"<fill in>"`, empty, or literally `TBD` is a warning (not a blocker — the server will start, but any outbound call to AGS will fail).

Report:

```
Prerequisites for matchmaking-override (override, go):
  ✓ go 1.22.0
  ✓ docker running                (skip if no docker-compose.yaml)
  ✓ ports 6565, 8080 free
  ✓ .env found
  ⚠ AB_BASE_URL = "<fill in>"     — set this to your AGS base URL, or calls to AGS will fail
  ⚠ AB_NAMESPACE = ""
```

If the runtime is missing or at wrong version, stop — direct to `/ags-extend install-dep` or to the language's install URL. If the port is taken, show the occupier:

```
✗ port 6565 is in use
  PID  1234 — process: go-build-dev (started 14:02)
  kill it with: kill 1234
```

Do not auto-kill.

### Step 3 — Launch plan and confirm

Read `references/debug/local-run.md` for the exact startup command.

```
Ready to start matchmaking-override locally.

  Working dir: ./matchmaking-override
  Command:     go run main.go
  Ports:       6565 (gRPC), 8080 (metrics)

To connect this to real AGS traffic, tunnel the port with ngrok and register
the endpoint in the Admin Portal — see the "Option A" flow in
references/debug/test-guide.md. Otherwise use grpcurl locally (Option B).

Start now? (yes/no)
```

Service Extension adds the REST gateway — mention all three (`6565 gRPC + 8000 REST gateway + 8080 metrics`).

Do not start until yes.

### Step 4 — Run and guide testing

Launch the command as a foreground process streaming output.

Watch stdout for the ready signal from `references/debug/local-run.md` (the app binding gRPC on `:6565` and metrics on `:8080`; Service Extension also logs the gateway on `:8000` — exact wording varies by language). Once seen, print:

```
{app-name} is up on localhost:{port}.

Test it ({pattern}):

{pattern-specific snippets from references/debug/test-guide.md — grpcurl / curl / ngrok instructions}

To stop: Ctrl+C
Continuing to stream logs…
```

Keep streaming. If the user runs a test command, surface request/response in the log stream.

If the process exits before the ready signal, print the **Exit block**:

```
✗ {app-name} exited before reaching ready state.

Last 30 lines:
  …

Likely causes:
  • bind: address already in use → another process grabbed port 6565 (or 8000 / 8080) after the pre-check
  • missing env var → check the error above against the required vars in references/debug/local-run.md
  • proto: not found → run `make proto` in the app directory
  • missing dependency → run /ags-extend install-dep

Fix and re-run /ags-extend debug.
```

If the process is still running when the user sends Ctrl+C:

```
Stopped {app-name}.

What next?
  • Edit code → re-run /ags-extend debug
  • Ship it → /ags-extend deploy
```

## Error Handling

| Situation | Response |
|---|---|
| No app dir found (no Makefile+Dockerfile here or as siblings) | Stop. Direct to `/ags-extend wizard` or `cd` into a project. |
| Nested deeper than one level up from an app dir | Only check current dir and one level up. If the user is nested deeper, ask them to `cd` closer. |
| Runtime missing or wrong version | Stop. Direct to `/ags-extend install-dep`. |
| `go.sum` missing (or equivalent for other languages) | Deps never installed. Direct to `/ags-extend install-dep`. |
| `.env` missing but `.env.template` exists | Offer: "Run `cp .env.template .env`? (yes/no)". Do not edit either file beyond that copy. |
| `.env` missing and `.env.template` missing | Surface the issue — the app was scaffolded oddly or the template changed. Tell the user to check the template README. |
| Port 6565 / 8000 / 8080 in use | Show the occupier (PID, process name) and how to kill it. Offer to retry after they kill it. |
| Process starts but never prints the ready signal | After ~30s, print: "No ready signal yet. Is the app hitting a startup blocker? Check logs above for errors." Let the user decide to wait longer or stop. |
| App crashes with `panic:` | Print last 30 lines. Do not try to fix the code. Suggest reading the stack trace from top to find the line in their package. |
| App logs `SIGSEGV` or immediate container crash | Same as above — stop and surface the raw log. These are usually runtime mismatches or corrupted binary. |
| `docker-compose up` fails pulling an image | Surface the error. If it's an auth issue with `ghcr.io`, suggest `docker login ghcr.io`. |
| User tries to test before ready signal | Say: "Server isn't ready yet — wait for the `{ready-pattern}` line." |
| User asks to "connect this to real AGS" | Explain the Override-specific ngrok + Admin Portal flow from `references/debug/test-guide.md` Option A. For Event Handler, explain that triggering the real AGS action is the way to test. For Service Extension, point out that it can be called directly without AGS routing. |
| Test command (grpcurl/curl) fails with `connection refused` | Server may not be ready or may have exited. Check the log stream. |

## Examples

### Single-app Go Override, straight path

```
User: /ags-extend debug

Skill: In ./matchmaking-override (Makefile + Dockerfile + go.mod).

       Prerequisites for matchmaking-override (go):
         ✓ go 1.22.0
         ✓ ports 6565, 8080 free
         ✓ .env found, AB_BASE_URL set, AB_NAMESPACE set

       Ready to start matchmaking-override locally.
         Working dir: ./matchmaking-override
         Command:     go run main.go
         Ports:       6565 (gRPC), 8080 (metrics)
       Start now? (yes/no)

User: yes

Skill: [launches]
       2026-04-18T10:22:01 serving prometheus metrics  port=8080
       2026-04-18T10:22:02 app server started

       matchmaking-override is up — gRPC on localhost:6565, metrics on localhost:8080.

       Test it (override):
         # List available RPCs
         grpcurl -plaintext localhost:6565 list
         # Call a method
         grpcurl -plaintext -d '{"request_id":"test"}' localhost:6565 \
           accelbyte.extend.matchmaking.MatchmakingOverride/GetPriority

       To connect this to real AGS traffic, see Option A in
       references/debug/test-guide.md.

       To stop: Ctrl+C
       Continuing to stream logs…
```

### Port conflict

```
Skill: Prerequisites for guild-service (service-extension, go):
         ✓ go 1.22.0
         ✗ port 6565 is in use
           PID 9412 — process: another-go-app (started 09:45)
         ✓ ports 8000, 8080 free
         ✓ .env found

       Stopping. Free port 6565 (`kill 9412`) and re-run /ags-extend debug.
```

### `.env` missing, template present

```
Skill: Prerequisites for match-event-handler (event-handler, go):
         ✓ go 1.22.0
         ✓ ports 6565, 8080 free
         ✗ .env not found
           found .env.template — copy it with:
             cp ./match-event-handler/.env.template ./match-event-handler/.env
           Shall I run that? (yes/no)

User: yes

Skill: [runs cp]
       ✓ .env created
       ⚠ AB_BASE_URL, AB_NAMESPACE, AB_CLIENT_ID, AB_CLIENT_SECRET all have placeholder values.
         The server will start, but calls to AGS will fail. Fill them in if you want to test against real AGS.

       Start now? (yes/no)
```

### Crash on startup

```
Skill: [launches]
       2026-04-18T10:30:01 initializing services
       panic: runtime error: invalid memory address or nil pointer dereference
       [signal SIGSEGV: segmentation violation code=0x1 addr=0x0 pc=0x...]
       goroutine 1 [running]:
       main.main()
           /app/matchmaking-override/main.go:38 +0x45

       ✗ matchmaking-override exited before reaching ready state.

       Stack trace points to main.go:38. The panic happened during init.
       Common causes at that line:
         • An env var is nil and dereferenced directly
         • A required config file isn't present in the working dir

       Fix the nil check at main.go:38, then re-run /ags-extend debug.
```

### Service Extension, happy path

```
Skill: [launches]
       starting gRPC-Gateway HTTP server  port=8000
       serving prometheus metrics         port=8080
       app server started

       guild-service is up — gRPC on localhost:6565, REST + Swagger on
       localhost:8000 (base path /guild), metrics on localhost:8080.

       Test it (service-extension):
         # Browse the endpoints in Swagger UI
         open http://localhost:8000/guild/apidocs/
         # Call a REST endpoint (path sits under the base path — confirm in Swagger)
         curl -X POST http://localhost:8000/guild/v1/... \
           -H "Content-Type: application/json" \
           -d '{"name":"test-guild"}'

       To stop: Ctrl+C
       Continuing to stream logs…
```
