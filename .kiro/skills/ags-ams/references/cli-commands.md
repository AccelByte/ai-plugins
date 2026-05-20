---
last-verified: 2026-05-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/upload-a-dedicated-server-build/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/download-cli-tools-from-admin-portal/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/register-local-dedicated-servers/
see-also:
- '[overview.md](overview.md)'
---

# AMS CLI Command Reference

Authoritative reference for AMS CLI (`ams`) and AMS Simulator (`amssim`) commands. Subskills that mention a CLI command must defer to this file — do not restate flags from memory.

---

## Obtaining the CLI Tools

**Option A — Admin Portal:**
1. Navigate to your game namespace → AMS → **Download Resource**
2. Choose the appropriate download:
   - **AMS Command Line Interface** — the `ams` binary for uploading DS builds
   - **AMS Simulator** — the `amssim` binary for local watchdog emulation

**Option B — CDN (always latest):**

| Binary | URL |
|---|---|
| `ams` (Linux x64) | `https://cdn.prod.ams.accelbyte.io/linux_amd64/ams` |
| `ams` (macOS ARM) | `https://cdn.prod.ams.accelbyte.io/darwin_arm64/ams` |
| `ams` (Windows) | `https://cdn.prod.ams.accelbyte.io/windows_amd64/ams.exe` |
| `amssim` (Linux x64) | `https://cdn.prod.ams.accelbyte.io/ams-sim/linux_amd64/amssim` |
| `amssim` (macOS ARM) | `https://cdn.prod.ams.accelbyte.io/ams-sim/darwin_arm64/amssim` |
| `amssim` (Windows) | `https://cdn.prod.ams.accelbyte.io/ams-sim/windows_amd64/amssim.exe` |

Download the latest version before each major upload session — the tools receive periodic bug fixes.

---

## AMS CLI (`ams`)

### `ams upload` — upload a dedicated server build

Uploads a folder of server files to AMS and creates a server image.

**Syntax:**

```
ams upload [flags]
```

**Required flags:**

| Flag | Long form | Description |
|---|---|---|
| `-H` | `--hostURL` | AGS environment base URL **without** the `https://` prefix (e.g. `mystudio.prod.gamingservices.accelbyte.io`) |
| `-c` | `--clientId` | IAM client ID (must have `AMS:UPLOAD` permission) |
| `-n` | `--imageName` | Name to give this server image in AMS |
| `-p` | `--path` | Local directory containing all DS files |
| `-e` | `--executable` | Relative path (from `-p`) to the startup executable or script |

**Optional flags:**

| Flag | Long form | Description |
|---|---|---|
| `-s` | `--secret` | IAM client secret (omit if using another credential mechanism) |
| `-f` | `--symbolFiles` | Path to debug symbol files (enables readable crash stack traces in Grafana) |

**IAM permission required:** `AMS:UPLOAD` resource, with **Create** and **Update** actions. Configure this IAM client in the Admin Portal.

**Example:**

```bash
ams upload \
  -H mystudio.prod.gamingservices.accelbyte.io \
  -c abc123 \
  -s supersecretvalue \
  -n my-game-server-1.2.0 \
  -p ./server-build \
  -e ./my-game-server
```

**Server binary requirements:**
- Architecture: x86/x64 (Linux only)
- OS: Linux only
- File permissions must be set correctly — Windows builders should use a startup script that runs `chmod` before launching the binary
- Startup scripts: encode as UTF-8 without BOM; use Unix line endings (LF, not CRLF)

### Presence check: is `ams` installed?

```bash
command -v ams || echo "not installed"
```

Do not use `ams --version` — it may not exist depending on the CLI version. Use `command -v` or test with `ams --help`.

---

## AMS Simulator (`amssim`)

### `amssim run` — run the AMS Simulator locally

Emulates the AMS watchdog process locally. The DS connects to it as if it were a real AMS watchdog. Used to test watchdog integration without uploading to the cloud.

**Basic (no AGS connection):**

```bash
amssim run
```

Listens at `ws://localhost:5555/watchdog`. No AGS credentials needed. The DS connects using its normal watchdog address and the simulator logs the protocol messages.

**With AGS namespace registration (`config.json`):**

```bash
amssim run --config config.json
```

Registers the local DS with a real AGS namespace so it appears in the Admin Portal (AMS → Local Servers) and can be claimed by AGS Session.

**`config.json` fields:**

| Field | Type | Description |
|---|---|---|
| `AGSEnvironmentURL` | string | AGS environment URL (no `https://`) |
| `AGSNamespace` | string | Target namespace |
| `LocalDSHost` | string | IP or hostname reachable by game clients (often `localhost` when testing client and server on the same machine) |
| `LocalDSPort` | int | Game port exposed by the DS |
| `ServerName` | string | Identifier for this local server in the Admin Portal |
| `ClaimKeys` | string[] | Optional claim keys; must match session template claim keys to be claimed |

**IAM permission required for namespace registration:** `NAMESPACE:{namespace}:AMS:LOCALDS [CREATE]`

**Local DS registration limit:** 10 per namespace.

**Example `config.json`:**

```json
{
  "AGSEnvironmentURL": "mystudio-mygame.prod.gamingservices.accelbyte.io",
  "AGSNamespace": "my-namespace",
  "LocalDSHost": "203.0.113.42",
  "LocalDSPort": 7777,
  "ServerName": "my-local-ds",
  "ClaimKeys": ["battle-royale-v1"]
}
```

### Presence check: is `amssim` installed?

```bash
command -v amssim || echo "not installed"
```

---

## DS Command-Line Parameters

AMS does not auto-inject flags. It performs template substitution into the command-line string configured in the fleet setup. The fleet command line must include the template variables for any parameters the DS needs to receive.

**Available template variables:**

| Variable | Value |
|---|---|
| `${dsid}` | The server's unique DS ID |
| `${default_port}` | The game listen port |
| `${watchdog_url}` | The watchdog WebSocket URL |

**Recommended fleet command-line config:**

Unreal Engine:
```
-dsid=${dsid} -port=${default_port}
```

Unity:
```
-dsid ${dsid} -port ${default_port}
```

Custom engines can use any format — the DS just needs to parse the substituted values from its command line.

When running locally (via `amssim run` or `amssim run --config`), pass parameters directly:

```bash
./my-ds-binary -dsid ds_local_test -port 7777
```

`-watchdog_url` is not needed for local testing — the AGS SDK has `ws://localhost:5555/watchdog` baked in as the default. Only specify it if `amssim` is configured to listen on a non-default port.

---

## What the CLI Does NOT Have

To prevent hallucination of commands that don't exist:

- `ams list-images` — does not exist. Use Admin Portal → AMS → Fleet Manager → Images.
- `ams create-fleet` — does not exist. Fleet creation is Admin Portal-only.
- `ams logs` — does not exist. Logs are in Admin Portal (live logs) or Grafana Cloud (artifacts).
- `ams status` — does not exist. Fleet status is in the Admin Portal.
- `amssim --version` — may not exist. Use `command -v amssim` to check presence.
- `ams --version` — may not exist. Use `command -v ams` to check presence.

Any command not listed in this file does not exist in the AMS CLI. If a subskill wants to use an undocumented flag, stop and surface the gap rather than guessing.
