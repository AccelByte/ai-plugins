---
last-verified: 2026-07-20
sources:
- https://github.com/AccelByte/extend-helper-cli
- https://api.github.com/repos/AccelByte/extend-helper-cli/releases/latest
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
- Before writing any `extend-helper-cli <subcommand>` invocation in a response or example, Read `references/deploy/cli-commands.md`. Do not restate flags from memory. If `cli-commands.md` doesn't document the flag you want to use, the flag does not exist — use a documented alternative, surface the gap to the user, or stop and ask.
- Fetch the latest official release metadata and compare its `tag_name` with the semantic version reported by the installed CLI. Remove a leading `v` before comparison; do not compare versions as plain strings. Official releases starting with v0.0.13 support top-level version reporting; still verify every downloaded candidate before installation.

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
3. Fetch `https://api.github.com/repos/AccelByte/extend-helper-cli/releases/latest` and capture `tag_name`, `html_url`, and the published assets.
4. If `command -v extend-helper-cli` returns a path, run `extend-helper-cli --version` and classify the result against the latest release as `current`, `outdated`, or `unparseable`.
5. If `--version` fails, run `extend-helper-cli --help`. A successful help command identifies a `legacy/pre-version` install whose freshness cannot be proven. If both commands fail, classify it as `unparseable` and surface both failures.
6. For a legacy/pre-version or unparseable install, offer an upgrade to the latest official release. After download confirmation, run the candidate's `--version` and `--help` before offering replacement.
7. If the latest candidate does not report the semantic version from the selected release tag, treat it as a verification failure. Do not install it or replace an existing binary, even when its `--help` succeeds.
8. Do not reinstall or overwrite an existing binary without showing its path and status and receiving explicit confirmation.
9. Before declaring a requested capability unsupported, check freshness. If the CLI is outdated or legacy/pre-version, offer an upgrade check and retry the capability only after a version-capable candidate is approved and installed. Do not use an upgrade to bypass authentication or authorization failures.

</dependency_checks>

<action_safety>

This writes a file to an install directory (`/usr/local/bin/` by default on macOS/Linux) and may replace an existing binary. Confirm with the user before downloading, before replacing an installed binary, and again if `sudo` is needed. Never auto-escalate.

If the download succeeds but `chmod +x`, `--version`, or `--help` fails, surface the failure and keep any existing working binary in place.

</action_safety>

<output_contract>

End every path with this status block, including when no mutation occurs:

```
Extend Helper CLI

  Executable path:    <path or not installed>
  Installed version:  <version or unknown>
  Latest version:     <version or unknown when metadata fetch failed>
  Status:             missing / current / outdated / legacy/pre-version / unparseable
  Action:             none / candidate checked / installed / upgraded / upgrade declined / stopped - <reason>
```

When the CLI was installed or upgraded, add the exact PATH step still needed, if any, and point to `/ags-extend deploy` as the next workflow.

</output_contract>

## Workflow

### Step 1 — Detect environment

```bash
uname -s -m
command -v extend-helper-cli || echo "not installed"
extend-helper-cli --version
curl --version 2>&1 | head -1
```

If `command -v` finds the binary, preserve its exact path. Parse the stable output `extend-helper-cli <semver>` from `--version` (see `references/deploy/cli-commands.md#presence-and-freshness-check`). If `--version` fails, run `--help`:

- `--version` succeeds with valid semantic output -> compare it after Step 2.
- `--version` succeeds but output cannot be parsed -> `unparseable`.
- `--version` fails and `--help` succeeds -> `legacy/pre-version`; freshness cannot be proven.
- both fail -> `unparseable`; show both errors and do not overwrite without confirmation.

### Step 2 — Fetch latest release and classify freshness

Fetch:

```bash
curl -fsSL https://api.github.com/repos/AccelByte/extend-helper-cli/releases/latest
```

Capture `tag_name`, `html_url`, and the asset names. Remove one leading `v` from the tag and compare semantic versions:

- no executable -> `missing`.
- installed equals latest -> `current`; report the full status block and stop without changing anything.
- installed lower than latest -> `outdated`; offer an upgrade.
- installed higher than latest -> `current` (newer/development build); report it and do not downgrade.
- legacy or unparseable -> report that the installed version cannot be determined and offer to upgrade to the latest official release.

### Step 3 — Resolve the asset

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

### Step 4 — Show install or upgrade plan and confirm

```
Will {install|upgrade} extend-helper-cli for {os}/{arch}.

  Latest release: {tag_name}
  Download: https://github.com/AccelByte/extend-helper-cli/releases/latest/download/{asset}
  Install to: {default install path}
  Replaces: {installed version or legacy/unparseable} at {existing path, or "nothing"}

Continue? (yes/no)
```

Do not download until the user says yes. If the user wants a different install path, accept an absolute path and use it.

### Step 5 — Download and install

**macOS / Linux:**

```bash
curl -fsSL "https://github.com/AccelByte/extend-helper-cli/releases/latest/download/{asset}" \
  -o {temporary-path} && chmod +x {temporary-path}
```

Verify the temporary binary with `{temporary-path} --version` and `{temporary-path} --help`:

- Version is parseable and matches the latest release tag -> candidate is version-capable. If `{install-path}` exists, show the verified version and repeat replacement confirmation immediately before moving it.
- `--version` fails, its output is unparseable, the version mismatches the release tag, or `--help` fails -> stop, delete only the temporary download, and keep any installed binary untouched.

Never ask the user to delete the working binary first.

If the write fails with `Permission denied` and the default path is `/usr/local/bin/`, ask the user:

> `/usr/local/bin/` isn't writable by your user. Options:
>   1. Retry with sudo (I'll show the command before running).
>   2. Install to `~/.local/bin/` instead (make sure it's on your PATH).
>   3. Pick a different path.

Only run with `sudo` after explicit yes, and only for that single command.

**Windows:**

```bash
curl -fsSL "https://github.com/AccelByte/extend-helper-cli/releases/latest/download/extend-helper-cli-windows_amd64.exe" \
  -o extend-helper-cli.download.exe
```

Run `extend-helper-cli.download.exe --version` and `extend-helper-cli.download.exe --help` before offering to move it over an existing `extend-helper-cli.exe`. Follow the same candidate verification rules as macOS/Linux. Ask for replacement confirmation when the destination exists. After a successful move, say:

> Downloaded `extend-helper-cli.exe` to the current directory. To use it from any shell, move it to a directory on your `PATH` (e.g. `C:\Program Files\extend-helper-cli\`) and add that directory to your PATH environment variable through System Properties → Environment Variables.

Do not try to modify the PATH yourself.

### Step 6 — Verify and report

```bash
command -v extend-helper-cli
extend-helper-cli --version
extend-helper-cli --help > /dev/null
```

The reported version must match the release tag selected in Step 2; print the full status block with `Status: current` and `Action: installed` or `Action: upgraded`.

If the command isn't found immediately after install on macOS/Linux, the directory may not be on `PATH`:

- If `/usr/local/bin/` is the install path, it should be on PATH by default. If not, tell the user to add it via their shell profile.
- If the user picked a custom path, surface the exact line to add to their shell profile (e.g. `export PATH="$HOME/.local/bin:$PATH"`).

## Error Handling

| Situation | Response |
|---|---|
| Installed version is current | Report path, installed/latest versions, and `Status: current`; do not download. |
| Installed version is outdated | Offer an upgrade and preserve the existing binary unless a verified version-capable candidate exists and the user confirms replacement. |
| `--version` fails but `--help` succeeds | Report `Status: legacy/pre-version`, explain that the installed version cannot be determined, and offer to upgrade to the latest official release. |
| Version output is malformed | Report `Status: unparseable`, include the raw output, and offer to upgrade to the latest official release. |
| Latest candidate fails version or help verification | Stop, delete only the temporary download, and keep any installed binary untouched. |
| User declines upgrade | Leave the binary untouched and report `Action: upgrade declined`. |
| Neither `curl` nor `wget` present | Stop. Tell the user to install one; don't try to boot from scratch with `/dev/tcp` tricks. |
| `curl` returns 404 | The asset name may have shifted. Show the URL tried, link to `https://github.com/AccelByte/extend-helper-cli/releases` so the user can check. |
| `curl` returns 403 / rate-limited | Suggest retrying in a few minutes; if behind corporate proxy, confirm proxy env vars are set. |
| Network times out | Say so plainly: "No response from github.com — check network or corporate proxy, then retry." |
| `chmod +x` fails | Report; if the download ended up zero bytes or partial, suggest deleting and retrying. |
| `extend-helper-cli --version` or `--help` post-install returns non-zero or fails to execute | Do not replace the existing binary. The download may be wrong for this arch; show `file {temporary-path}` output. |
| Requested capability appears absent | Check installed/latest versions first. Offer an upgrade for outdated or legacy installs, then retry after approval; never treat auth failures as version gaps. |
| Windows user on 32-bit shell | There's no 32-bit asset. Stop with that note. |
| User on WSL2 | Treat as Linux (`uname -s` returns `Linux`). |
| Corporate proxy blocks GitHub | Stop. Suggest downloading the asset manually on another network and placing it at `/usr/local/bin/extend-helper-cli` with `chmod +x`. |

## Examples

### macOS arm64, clean install

```
User: /ags-extend install-cli

Skill: OS: darwin arm64
       curl: 8.1.2
       Latest release: <latest-version>

       Will install extend-helper-cli for darwin/arm64.
         Download: https://github.com/AccelByte/extend-helper-cli/releases/latest/download/extend-helper-cli-darwin_arm64
         Install to: /usr/local/bin/extend-helper-cli
       Continue? (yes/no)

User: yes

Skill: [downloads]
       [chmod]
       [verifies temporary binary reports the latest semantic version]

       Extend Helper CLI

         Executable path:    /usr/local/bin/extend-helper-cli
         Installed version:  <latest-version>
         Latest version:     <latest-version>
         Status:             current
         Action:             installed
```

### Outdated installation; upgrade declined

```
User: /ags-extend install-cli

Skill: Extend Helper CLI

         Executable path:    /usr/local/bin/extend-helper-cli
         Installed version:  <older-version>
         Latest version:     <latest-version>
         Status:             outdated
         Action:             upgrade declined
```

### Legacy/pre-version installation

```
Skill: `extend-helper-cli --version` failed, but `extend-helper-cli --help` succeeded.
       This is a legacy/pre-version installation, so freshness cannot be proven.

       Extend Helper CLI

         Executable path:    /usr/local/bin/extend-helper-cli
         Installed version:  unknown
         Latest version:     <latest-version>
         Status:             legacy/pre-version
         Action:             none

       Download and upgrade to the latest official release? (yes/no)
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
       Extend Helper CLI

         Executable path:    /Users/you/.local/bin/extend-helper-cli
         Installed version:  <latest-version>
         Latest version:     <latest-version>
         Status:             current
         Action:             installed

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
