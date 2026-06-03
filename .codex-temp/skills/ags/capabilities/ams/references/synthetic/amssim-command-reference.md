---
last-verified: 2026-05-26
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/
---

# AMS Simulator Command Reference

Use this synthetic reference when a user asks about `amssim` command behavior that is not fully covered in the public CLI tables, especially interactive controls and observed defaults.

## Command Shape

`amssim` is a local watchdog-emulator binary for AMS DS protocol testing.

- The most common command is `run`.
- A config path can be provided with `--configPath` when running.
- In some releases, `generate-config` is available to scaffold a starter `config.json`.
- Interactive controls (`info`, `help`, `ds status`, etc.) are entered **after** `amssim` has started.

## Core Commands

### `amssim run`

Starts the local simulator.

```text
amssim run
```

Starts with default config if `config.json` exists in the current directory.

```text
amssim run --configPath config.json
```

Starts with an explicit config file.

Expected startup behavior:

- Prints local WebSocket endpoint (`ws://localhost:5555/watchdog` by default).
- Prints a DS ID token in `ds_<uuid>` format (`amssim ds status` uses this identity).
- Keeps the session open for interactive commands.

### `amssim generate-config`

Observed in typical local workflows to create `config.json` templates from an interactive shell.

```text
amssim generate-config
```

If this command is not available in the user's local binary version, fall back to creating `config.json` manually.

### `amssim --help`, `amssim run --help`

Use these first when a user reports version drift:

```text
amssim --help
amssim run --help
```

Before following this file as source of truth, run these two commands and re-check flag names.

## Interactive Commands (After `run`)

Issue these at the running `amssim` prompt.

```text
info
help
ds status
ds ready
ds claim
ds drain
exit
```

Use `ds status` to confirm DS connectivity:
- `connected`: DS is attached to watchdog.
- `no connected dedicated server`: DS not yet attached; check DS id/watchdog URL.

`ds ready`, `ds claim`, and `ds drain` should be treated as simulator controls and not as proof of DS-internal behavior. They are useful for protocol/edge-case simulation but do not replace real DS logs.

## Presence Checks

Use a shell presence check before a run:

```bash
command -v amssim || echo "amssim not found"
```

Version-sensitive note: some builds do not support `--version`.

```bash
amssim --version
```

If unsupported, rely on presence check + `amssim --help`.

## Startup and DS-ID Rules

- Always copy the full `ds_<uuid>` token from current simulator output.
- Do not use friendly names in DS launch parameters; they must match the simulator-issued `ds_<uuid>` format.
- If a previously launched DS is still alive, old `dsid` values can become stale quickly.

## Useful Error/Output Patterns

| Pattern | Meaning | Next step |
|---|---|---|
| `invalid provided DS ID` | Launch args and simulator `ds_<uuid>` are out of sync | Restart DS with the latest `ds_<uuid>` from `amssim info` |
| `Received heartbeat before ready` | Watchdog connected, but DS ready path not confirmed yet | Inspect DS logs for ready API / session-registration path |
| `no connected dedicated server` | Simulator has not accepted a DS connection | Check `-watchdog_url`, `-dsid`, and DS lifecycle startup sequence |
| `Ready to accept local DS` | Simulator is running and waiting for DS | Start DS now |

## What Not to Assume

- `amssim` output is version-sensitive and can change command names or flags.
- Do not hardcode flag names without checking `amssim --help` in the current environment.
- Treat this reference as a local runtime guide, not a replacement for your exact binary behavior.
