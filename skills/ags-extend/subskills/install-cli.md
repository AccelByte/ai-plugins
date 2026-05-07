---
last-verified: 2026-05-07
sources:
- https://github.com/AccelByte/extend-helper-cli
see-also:
- '[cli-commands.md](../references/deploy/cli-commands.md)'
- '[init.md](init.md)'
---

# AGS Extend CLI Installer

Install `extend-helper-cli` — the command-line tool that drives `image-upload`, `deploy-app`, `get-app-info`, `update-var`, `tunnel`, and other supported subcommands (see `references/deploy/cli-commands.md`). Downloads a single binary from the official GitHub release, validates it, and places it on the user's `PATH`.

## Behavior Constraints

<grounding_rules>

- Use only the asset filenames in the OS/arch table below. Do not invent filenames or follow redirect chains unless explicitly allowed.
- Always pull from `https://github.com/AccelByte/extend-helper-cli/releases/latest/download/{asset}`. Do not pin to a specific version unless the user asks.
- Do not install from any other source (package manager, mirror, cached tarball). If GitHub is unreachable, stop and tell the user.

</grounding_rules>

<tool_usage_rules>

- Use `Bash` for OS detection, download, permission changes, and version verification.
- Never use `sudo` without explicit user confirmation — and only after a plain install has failed with a permission error.
- Never modify the user's shell profile (`.bashrc`, `.zshrc`, etc.) to add a directory to `PATH`. Tell the user the manual step to take instead.

</tool_usage_rules>

<dependency_checks>

Before downloading:

1. `curl` is present (`curl --version`). If not, try `wget` as a fallback. If neither is present, stop and tell the user to install one.
2. The OS/arch combination is in the supported table. Anything else stops the install.
3. If `command -v extend-helper-cli` returns a path AND `extend-helper-cli --help` exits 0, the CLI is already installed. Stop and report — do not reinstall without the user asking. (The CLI does not have a `--version` flag; see `references/deploy/cli-commands.md#presence-check-is-the-cli-installed`.)

</dependency_checks>

<action_safety>

This writes a file to a system directory (`/usr/local/bin/` by default on macOS/Linux). Confirm with the user before downloading and again if `sudo` is needed. Never auto-escalate.

If the download succeeds but `chmod +x` fails, or if `extend-helper-cli --help` after install doesn't run cleanly, surface the failure; do not leave a broken binary behind without telling the user.

</action_safety>

<output_contract>

Four possible end states, each with a specific final message:

- **Already installed** → `extend-helper-cli is already installed at {path}. Nothing to do.`
- **Installed** → `✓ extend-helper-cli installed to {path}.`
- **Installed, PATH manual step needed** (Windows) → `✓ Downloaded extend-helper-cli.exe to {path}. Add {dir} to your PATH to use it from anywhere.`
- **Stopped** → `Stopped: {reason}.` with concrete remediation on the next line.

</output_contract>

## Workflow

### Step 1 — Detect environment

```bash
uname -s -m
command -v extend-helper-cli || echo "not installed"
curl --version 2>&1 | head -1
```

`extend-helper-cli` does NOT have a `--version` flag (it exits 1 with "flag provided but not defined"). Use `command -v` for presence detection — see `references/deploy/cli-commands.md#presence-check-is-the-cli-installed`.

If `command -v extend-helper-cli` prints a path, stop and report:

```
extend-helper-cli is already installed at $(which extend-helper-cli). Nothing to do.

If you want to upgrade, remove the existing binary first:
  rm $(which extend-helper-cli)
…then re-run /ags-extend install-cli.
```

(There is no version string to print — the binary doesn't expose one.)

### Step 2 — Resolve the asset

Map `uname` output to the release asset:

| `uname -s` | `uname -m` | Asset | Default install path |
|---|---|---|---|
| `Darwin` | `arm64` | `extend-helper-cli-darwin_arm64` | `/usr/local/bin/extend-helper-cli` |
| `Darwin` | `x86_64` | `extend-helper-cli-darwin_amd64` | `/usr/local/bin/extend-helper-cli` |
| `Linux` | `x86_64` | `extend-helper-cli-linux_amd64` | `/usr/local/bin/extend-helper-cli` |
| `Linux` | `aarch64` or `arm64` | `extend-helper-cli-linux_arm64` | `/usr/local/bin/extend-helper-cli` |
| `MINGW*`, `MSYS*`, `CYGWIN*` | `x86_64` | `extend-helper-cli-windows_amd64.exe` | current directory — see Windows notes |

Anything not in this table (FreeBSD, 32-bit, Linux `armv7l`) stops the install:

```
Stopped: OS/arch {os}/{arch} isn't a published release target. See https://github.com/AccelByte/extend-helper-cli/releases for available assets, or build from source.
```

### Step 3 — Show install plan and confirm

```
Will install extend-helper-cli for {os}/{arch}.

  Download: https://github.com/AccelByte/extend-helper-cli/releases/latest/download/{asset}
  Install to: {default install path}

Continue? (yes/no)
```

Do not download until the user says yes. If the user wants a different install path, accept an absolute path and use it.

### Step 4 — Download and install

**macOS / Linux:**

```bash
curl -fsSL "https://github.com/AccelByte/extend-helper-cli/releases/latest/download/{asset}" \
  -o {install-path} && chmod +x {install-path}
```

If the write fails with `Permission denied` and the default path is `/usr/local/bin/`, ask the user:

> `/usr/local/bin/` isn't writable by your user. Options:
>   1. Retry with sudo (I'll show the command before running).
>   2. Install to `~/.local/bin/` instead (make sure it's on your PATH).
>   3. Pick a different path.

Only run with `sudo` after explicit yes, and only for that single command.

**Windows:**

```bash
curl -fsSL "https://github.com/AccelByte/extend-helper-cli/releases/latest/download/extend-helper-cli-windows_amd64.exe" \
  -o extend-helper-cli.exe
```

After download, say:

> Downloaded `extend-helper-cli.exe` to the current directory. To use it from any shell, move it to a directory on your `PATH` (e.g. `C:\Program Files\extend-helper-cli\`) and add that directory to your PATH environment variable through System Properties → Environment Variables.

Do not try to modify the PATH yourself.

### Step 5 — Verify

```bash
command -v extend-helper-cli && extend-helper-cli --help > /dev/null && echo "ok"
```

`--help` exits 0 (unlike `--version` which doesn't exist). If both succeed, report success:

```
✓ extend-helper-cli installed to {path}.

Run /ags-extend deploy when you're ready to ship an app.
```

If the command isn't found immediately after install on macOS/Linux, the directory may not be on `PATH`:

- If `/usr/local/bin/` is the install path, it should be on PATH by default. If not, tell the user to add it via their shell profile.
- If the user picked a custom path, surface the exact line to add to their shell profile (e.g. `export PATH="$HOME/.local/bin:$PATH"`).

## Error Handling

| Situation | Response |
|---|---|
| Already installed, user still wants it | Suggest `rm $(which extend-helper-cli)` then re-run; or let the user supply a different install path to have two side-by-side. |
| Neither `curl` nor `wget` present | Stop. Tell the user to install one; don't try to boot from scratch with `/dev/tcp` tricks. |
| `curl` returns 404 | The asset name may have shifted. Show the URL tried, link to `https://github.com/AccelByte/extend-helper-cli/releases` so the user can check. |
| `curl` returns 403 / rate-limited | Suggest retrying in a few minutes; if behind corporate proxy, confirm proxy env vars are set. |
| Network times out | Say so plainly: "No response from github.com — check network or corporate proxy, then retry." |
| `chmod +x` fails | Report; if the download ended up zero bytes or partial, suggest deleting and retrying. |
| `extend-helper-cli --help` post-install returns non-zero or fails to execute | The binary may be wrong for this arch. Show `file {path}` output to the user. If it's the wrong arch, rerun with the correct asset. |
| Windows user on 32-bit shell | There's no 32-bit asset. Stop with that note. |
| User on WSL2 | Treat as Linux (`uname -s` returns `Linux`). |
| Corporate proxy blocks GitHub | Stop. Suggest downloading the asset manually on another network and placing it at `/usr/local/bin/extend-helper-cli` with `chmod +x`. |

## Examples

### macOS arm64, clean install

```
User: /ags-extend install-cli

Skill: OS: darwin arm64
       curl: 8.1.2

       Will install extend-helper-cli for darwin/arm64.
         Download: https://github.com/AccelByte/extend-helper-cli/releases/latest/download/extend-helper-cli-darwin_arm64
         Install to: /usr/local/bin/extend-helper-cli
       Continue? (yes/no)

User: yes

Skill: [downloads]
       [chmod]
       ✓ extend-helper-cli installed to /usr/local/bin/extend-helper-cli.

       Run /ags-extend deploy when you're ready to ship an app.
```

### Already installed

```
User: /ags-extend install-cli

Skill: extend-helper-cli is already installed at /usr/local/bin/extend-helper-cli. Nothing to do.

       If you want to upgrade, remove the existing binary first:
         rm /usr/local/bin/extend-helper-cli
       …then re-run /ags-extend install-cli.
```

### Permission denied, user chooses local bin

```
Skill: [curl fails]
       /usr/local/bin/extend-helper-cli: Permission denied

       /usr/local/bin/ isn't writable by your user. Options:
         1. Retry with sudo
         2. Install to ~/.local/bin/ instead (ensure it's on PATH)
         3. Pick a different path

User: 2

Skill: [re-downloads to ~/.local/bin/extend-helper-cli]
       ✓ extend-helper-cli installed to /Users/you/.local/bin/extend-helper-cli.

       If `extend-helper-cli` isn't found when you run it, add ~/.local/bin
       to your PATH. In zsh:
         echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
         source ~/.zshrc
```

### Unsupported arch

```
Skill: OS: Linux armv7l

       Stopped: OS/arch Linux/armv7l isn't a published release target. See
       https://github.com/AccelByte/extend-helper-cli/releases for available
       assets, or build from source.
```

### 404 — asset name drift

```
Skill: [curl returns 404]

       The expected asset name isn't on the latest release:
         https://github.com/AccelByte/extend-helper-cli/releases/latest/download/extend-helper-cli-darwin_arm64
       Check https://github.com/AccelByte/extend-helper-cli/releases for the
       current asset names. If the naming has changed, this skill's table in
       subskills/install-cli.md needs updating.
```
