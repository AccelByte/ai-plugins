---
name: ags-install-cli
description: Install the AGS CLI for namespace and IAM management. Required by `/ags
  connect-portal` (for IAM client provisioning), and by `/ags observe` (for read-only
  namespace queries). NOT the same as `extend-helper-cli` - that's an Extend tool
  installed via /ags-extend.
allowed-tools: Read Bash Glob
model: sonnet
last-verified: 2026-07-20
sources:
- https://github.com/AccelByte/accelbyte-ags-cli/releases/latest
- https://github.com/AccelByte/accelbyte-ags-cli/releases/tag/v0.3.0
see-also:
- '[cli-commands.md](../references/observe/cli-commands.md)'
- '[connect-portal.md](connect-portal.md)'
- '[observe.md](observe.md)'
---

# AGS CLI Installer

Install the AGS CLI on the user's machine. The current CLI binary is `ags` (`ags.exe` on Windows). It is used for namespace, IAM, profile, authentication, diagnostics, and generated AGS API commands.

> **Important:** this is the **AGS CLI** (binary: `ags`), **not** `extend-helper-cli`. The Extend CLI is owned by `/ags-extend install-cli`.
>
> If the user is asking about `extend-helper-cli` - building, pushing, or deploying Extend apps - route to `/ags-extend install-cli`.

## Behavior Constraints

<grounding_rules>

- AGS CLI is distributed as prebuilt release archives from `https://github.com/AccelByte/accelbyte-ags-cli/releases/latest`.
- Always fetch the latest release metadata first, then select the asset that matches the user's OS and architecture. Do not pin to a historical release unless the user asks for that version.
- Compare the semantic version reported by `ags --version` with the latest release `tag_name` after removing a leading `v`. Treat malformed or missing version output as unparseable; never infer freshness from the binary's presence alone.
- Use only assets from the official `AccelByte/accelbyte-ags-cli` GitHub release. Do not install from package managers, mirrors, local caches, or the old Bitbucket source checkout as the primary path.
- Verify the downloaded archive with the matching `.sha256` asset before extracting when checksum download is available.
- Build from source only as an explicit fallback when no release asset exists for the user's platform and the user accepts that fallback.

</grounding_rules>

<tool_usage_rules>

- `Bash` for OS / arch detection, release metadata fetch, download, checksum verification, extraction, PATH setup, and verification commands.
- `Read` for `references/observe/cli-commands.md` if the user asks what the CLI can do.
- Don't read other subskills.
- Never use `sudo` without explicit user confirmation. Prefer a user-writable directory on `PATH` first.
- Do not modify shell profiles, PowerShell profiles, or persistent user `PATH` without showing the exact change and receiving confirmation.

</tool_usage_rules>

<dependency_checks>

Before installing:

1. Detect OS and architecture (`uname -s -m` on macOS/Linux; PowerShell equivalent on Windows).
2. Check whether `ags` is already on `PATH`:
   - macOS/Linux: `command -v ags && ags --version`
   - Windows PowerShell: `Get-Command ags -ErrorAction SilentlyContinue; ags --version`
3. Check download/extract tools:
   - macOS/Linux: `curl` or `wget`, `tar`, and `shasum` or `sha256sum`.
   - Windows PowerShell: `Invoke-RestMethod` or `curl.exe`, `Expand-Archive`, and `Get-FileHash`.
4. Fetch `https://api.github.com/repos/AccelByte/accelbyte-ags-cli/releases/latest` and select a non-checksum asset for the detected platform.
5. Classify the installation as `missing`, `current`, `outdated`, or `unparseable` by comparing the installed semantic version with the latest release tag. Do not run an installer or replace an existing binary without explicit confirmation.
6. If a requested capability appears absent, complete the freshness check before declaring it unsupported. When the CLI is outdated, offer an upgrade and retry capability discovery after an approved upgrade. Do not suggest an upgrade as a remedy for authentication or authorization failures.

</dependency_checks>

<action_safety>

Installing the CLI downloads an archive and writes `ags` / `ags.exe` into a directory intended to be on the user's `PATH`. Confirm before:

- Downloading the release archive.
- Copying or moving `ags` / `ags.exe` into the install directory.
- Creating a user bin directory.
- Modifying persistent user `PATH`.
- Retrying with elevated privileges for a system directory.

Prefer user-writable install locations:

- macOS/Linux: an existing user-writable `PATH` directory such as `$HOME/.local/bin`; create it if the user confirms and it is not present. Use `/usr/local/bin` only if the user asks for a system-wide install or the directory is already writable.
- Windows: a user directory such as `%LOCALAPPDATA%\AccelByte\ags-cli\bin`; add it to the user's `PATH` only after showing the exact path and receiving confirmation.

If the download succeeds but checksum verification, extraction, or `ags --version` fails, surface the failure and do not claim installation succeeded.

</action_safety>

<output_contract>

End with an "installed" block:

```
AGS CLI installed

  OS / arch:          <os> <arch>
  Installed version:  <version or unknown>
  Latest version:     <version or unknown when metadata fetch failed>
  Install path:       <path>
  Status:             missing / current / outdated / unparseable
  Authenticated:      yes / no - run `ags auth login` to authenticate

Next step: /ags connect-portal (if you haven't done it yet)
            or /ags observe (to query a live namespace)
```

</output_contract>

<completeness_contract>

The install is complete when:

1. The user can run `ags` from `PATH`, or knows the exact binary path and the exact PATH step still needed.
2. `ags --version` returns a version string, or `ags describe` returns structured AGS CLI discovery output. Use `ags --help` only as a final fallback if `describe` is unavailable.
3. The user knows the next step: authenticate via `ags auth login` (interactive; don't run the browser flow for them) or use `ags auth login --grant client-credentials` for headless environments.
4. The "installed" block is printed.

If the CLI was already installed, "complete" means its path, installed version when parseable, latest version, freshness status, and authentication state are reported. An outdated or unparseable install must be offered an explicit upgrade; declining it is a valid non-mutating end state.

</completeness_contract>

## Workflow

### Step 1: Detect existing install

macOS / Linux:

```bash
command -v ags && ags --version || echo "not installed"
```

Windows PowerShell:

```powershell
Get-Command ags -ErrorAction SilentlyContinue
ags --version
```

If installed, capture the executable path and the complete `ags --version` output. Parse a semantic version from the output. If the command fails or no semantic version can be parsed, keep the path and classify the installed version as `unparseable` after fetching the latest release.

Then run:

```bash
ags auth status
ags doctor
```

Do not decide to skip installation until the latest release is known and freshness has been classified.

### Step 2: Detect platform and fetch latest release

macOS / Linux:

```bash
uname -s -m
curl -fsSL https://api.github.com/repos/AccelByte/accelbyte-ags-cli/releases/latest
```

Windows PowerShell:

```powershell
[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
Invoke-RestMethod -Uri https://api.github.com/repos/AccelByte/accelbyte-ags-cli/releases/latest
```

Capture the release `tag_name`, `html_url`, asset names, and `browser_download_url` values. Do not assume `v0.1.0` is still latest.

Normalize the installed version and release tag for comparison by removing a leading `v`; compare them as semantic versions, not as plain strings:

- installed equals latest -> `current`; report it and do not reinstall.
- installed lower than latest -> `outdated`; show both versions and offer an upgrade.
- installed higher than latest -> `current` (development or newer build); report that it is newer than the latest published release and do not downgrade.
- installed output cannot be parsed -> `unparseable`; explain that freshness cannot be proven and offer an upgrade.
- no executable on `PATH` -> `missing`; offer installation.

If multiple `ags` executables are discoverable, report every path and version before asking which one to keep or replace.

### Step 3: Resolve the release asset

Map the platform to the release asset name pattern. Select the actual matching asset from the latest release metadata, plus its matching `.sha256` asset:

| Platform | Architecture | Preferred asset |
|---|---|---|
| macOS | Apple Silicon / `arm64` / `aarch64` | `ags-aarch64-apple-darwin.tar.gz` |
| macOS | Intel / `x86_64` | `ags-x86_64-apple-darwin.tar.gz` |
| Linux glibc | `x86_64` | `ags-x86_64-unknown-linux-gnu.tar.gz` |
| Linux glibc | `arm64` / `aarch64` | `ags-aarch64-unknown-linux-gnu.tar.gz` (verify this asset exists in the latest release with `curl https://api.github.com/repos/AccelByte/accelbyte-ags-cli/releases/latest \| jq '.assets[].name'`) |
| Linux musl / Alpine | `x86_64` | `ags-x86_64-unknown-linux-musl.tar.gz` |
| Linux musl / Alpine | `arm64` / `aarch64` | `ags-aarch64-unknown-linux-musl.tar.gz` |
| Windows | `x86_64` / AMD64 | `ags-x86_64-pc-windows-msvc.zip` |

If Linux libc is unclear, default to GNU for normal desktop/server distributions and musl for Alpine. If the detected OS/arch has no release asset, stop and say exactly which platform was unsupported. Offer source build only as a fallback, not as the normal install flow.

### Step 4: Choose install directory

Choose a user-writable directory that is or can become part of user `PATH`:

- macOS/Linux: prefer `$HOME/.local/bin/ags`. If `$HOME/.local/bin` is not on `PATH`, show the PATH line the user needs to add and ask whether to create/use it anyway. If the user asks for a system-wide install, use `/usr/local/bin/ags` and ask before using `sudo`.
- Windows: prefer `%LOCALAPPDATA%\AccelByte\ags-cli\bin\ags.exe`. If that directory is not on the user `PATH`, show the exact user PATH addition and ask before applying it.

Show the plan before downloading:

```
Will install AGS CLI from the latest GitHub release.

  Release:      <tag_name>
  Asset:        <asset name>
  Checksum:     <asset name>.sha256
  Install path: <path to ags or ags.exe>
  Replaces:     <installed version and path, or "nothing">

Continue? (yes/no)
```

### Step 5: Download, verify, and extract

macOS / Linux:

```bash
tmpdir="$(mktemp -d)"
curl -fsSL "<asset-browser-download-url>" -o "$tmpdir/<asset>"
curl -fsSL "<sha256-browser-download-url>" -o "$tmpdir/<asset>.sha256"
(cd "$tmpdir" && shasum -a 256 -c "<asset>.sha256")
tar -xzf "$tmpdir/<asset>" -C "$tmpdir"
chmod +x "$tmpdir/ags"
"$tmpdir/ags" --version
install -m 0755 "$tmpdir/ags" "<install-path>.new"
"<install-path>.new" --version
mv -f "<install-path>.new" "<install-path>"
"<install-path>" --version
```

Parse the version from `"$tmpdir/ags" --version` and require it to match the selected release tag before writing beside or replacing the destination. When `<install-path>` already exists, show the verified candidate version and ask for replacement confirmation immediately before `mv -f`. The `.new` file is on the destination filesystem, so the final rename is atomic; if preparation or verification fails, remove only `.new` and keep the installed binary untouched.

On macOS, the first run of `ags` may be blocked by Gatekeeper. Go to System Settings → Privacy & Security and click Allow Anyway, then re-run `ags --version`.


If `shasum` is unavailable and `sha256sum` is available, use `sha256sum -c` instead.

Windows PowerShell:

```powershell
$Tmp = Join-Path $env:TEMP ("ags-cli-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $Tmp | Out-Null
Invoke-RestMethod -Uri "<asset-browser-download-url>" -OutFile (Join-Path $Tmp "<asset>")
Invoke-RestMethod -Uri "<sha256-browser-download-url>" -OutFile (Join-Path $Tmp "<asset>.sha256")
$Expected = (Get-Content (Join-Path $Tmp "<asset>.sha256")).Split(" ")[0].ToLower()
$Actual = (Get-FileHash (Join-Path $Tmp "<asset>") -Algorithm SHA256).Hash.ToLower()
if ($Expected -ne $Actual) { throw "Checksum mismatch" }
Expand-Archive (Join-Path $Tmp "<asset>") -DestinationPath $Tmp
& (Join-Path $Tmp "ags.exe") --version
New-Item -ItemType Directory -Path "<install-dir>" -Force | Out-Null
Copy-Item (Join-Path $Tmp "ags.exe") "<install-path>.new" -Force
& "<install-path>.new" --version
Move-Item "<install-path>.new" "<install-path>" -Force
& "<install-path>" --version
```

Require the temporary binary's parsed version to match the selected release tag. If `<install-path>` exists, ask for replacement confirmation immediately before `Move-Item`. Keep the existing destination intact unless the candidate has passed both version checks; if candidate preparation fails, remove only `<install-path>.new`.

If `ags --version` fails because the install directory is not yet on `PATH`, run the binary by direct path to verify, then complete the PATH step below.

### Step 6: Ensure `ags` is on PATH

macOS / Linux:

- If installing into a directory already on `PATH`, no profile change is needed.
- If installing into `$HOME/.local/bin` and it is not on `PATH`, show the shell-specific command the user can run, or ask before appending it to the appropriate shell profile.

Windows PowerShell:

- Check whether the install directory is already in the user PATH.
- If not, show the exact command and ask before applying it:

```powershell
[Environment]::SetEnvironmentVariable(
  "Path",
  [Environment]::GetEnvironmentVariable("Path", "User") + ";<install-dir>",
  "User"
)
```

Tell the user to open a new shell after a persistent PATH change. In the current PowerShell session, prepend the directory to `$env:Path` for verification only.

### Step 7: Authenticate (interactive - point at it, don't run)

For interactive use with a public IAM client:

```bash
ags auth login
```

Public IAM clients must allow the redirect URI `http://127.0.0.1:8080` unless the user passes a different `--port`.

For CI or service-to-service use with a confidential IAM client:

```bash
ags auth login --grant client-credentials
```

Then verify:

```bash
ags auth status
ags doctor
```

### Step 8: Print the "installed" block

Per `output_contract`.

Before saying that the AGS CLI does not support a requested command or flag, use `ags describe` (or the relevant `--help` fallback) and the freshness result. If the installation is outdated, offer the upgrade first; after an approved upgrade, retry discovery. If the user declines, report the version gap instead of declaring the capability universally unsupported. Authentication and authorization errors remain auth problems and must not be routed through an upgrade.

## Examples

### Already installed

```
User: /ags install-cli

Skill: Checking for existing install...
       OK ags 0.3.0 already installed at /usr/local/bin/ags
       OK latest official release is v0.3.0
       OK auth status checked with `ags auth status`

       AGS CLI installed

         OS / arch:         darwin arm64
         Installed version: 0.3.0
         Latest version:    0.3.0
         Install path:      /usr/local/bin/ags
         Status:            current
         Authenticated:     yes

       Next step: /ags connect-portal - looks like you're set up to go.
```

### Fresh release install

```
User: /ags install-cli

Skill: Checking for existing install... not found.
       Detected: windows x86_64.
       Latest release: v0.3.0
       Asset: ags-x86_64-pc-windows-msvc.zip

       I will download the release archive, verify its .sha256 checksum,
       extract ags.exe, and place it at:
         C:\Users\you\AppData\Local\AccelByte\ags-cli\bin\ags.exe
       Confirm? (y/n)

User: y

Skill: OK checksum verified
       OK ags --version

       AGS CLI installed

         OS / arch:         windows x86_64
         Installed version: 0.3.0
         Latest version:    0.3.0
         Install path:      C:\Users\you\AppData\Local\AccelByte\ags-cli\bin\ags.exe
         Status:            current
         Authenticated:     no - run `ags auth login` to authenticate

       Next step: run `ags auth login` (interactive), then `/ags connect-portal`.
```

### Wrong CLI requested

```
User: /ags install-cli - I need to deploy an Extend app.

Skill: That's the Extend CLI (extend-helper-cli), not the AGS CLI.
       Two different tools. Run /ags-extend install-cli instead - it
       owns extend-helper-cli setup.

       (`/ags install-cli` installs the AGS CLI for namespace and IAM
       management - not what you need for Extend deploys.)
```

## Error handling

- **GitHub release metadata fetch fails** - show the error and stop. If the user approves, retry with their proxy/auth/network settings. Do not fall back to stale asset names without release metadata unless the user explicitly asks for a pinned version.
- **No matching asset** - report the detected OS/arch and the assets present in the latest release. Offer source build as a fallback only if the user wants it.
- **Checksum mismatch** - stop, delete the downloaded archive if possible, and tell the user the expected and actual hashes.
- **Archive does not contain `ags` / `ags.exe`** - stop and report the asset name; the release format may have changed and this skill needs updating.
- **Install succeeds but `ags` is not on `PATH`** - report the direct binary path and offer the PATH setup.
- **Multiple versions present** - surface each path and version; ask which one the user wants to use.
- **Installed version is outdated** - show the installed path, installed version, and latest version; ask whether to replace that binary. If declined, leave it untouched and report `Status: outdated`.
- **Installed version is unparseable** - run `ags --help` only to distinguish a functioning legacy/unusual binary from a broken executable, report that freshness cannot be proven, and offer an upgrade with confirmation.
- **Requested capability is absent** - check freshness before declaring it unsupported. If outdated, offer an upgrade and retry discovery after confirmation; do not use this path for auth failures.
- **User asked for the Extend CLI by mistake** - route to `/ags-extend install-cli`.
