---
last-verified: 2026-05-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/upload-a-dedicated-server-build/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/download-cli-tools-from-admin-portal/
see-also:
- '[overview.md](../references/overview.md)'
- '[cli-commands.md](../references/cli-commands.md)'
- '[fleet.md](fleet.md)'
---

# AMS Uploader

Upload a dedicated server (DS) binary to AMS using the AMS CLI. Walks through prerequisites, constructs the upload command, and hands off to `fleet` when done.

## Behavior Constraints

<grounding_rules>

- Read `references/cli-commands.md` before quoting any AMS CLI command, flag, or env var. Do not restate flags from memory.
- Architecture constraint: AMS accepts **Linux x86 or x64** DS binaries. Confirm the target architecture before uploading.
- File permissions must be correctly set when uploading. Windows users need a startup script to set Unix permissions.
- The IAM client used for upload needs `AMS:UPLOAD` permission (Create + Update actions) in the target namespace.

</grounding_rules>

<tool_usage_rules>

- `Bash` for checking CLI presence, architecture, and running the upload command.
- `Read` for CLI reference file and any local `.env` or config.
- Never modify source files. This subskill is upload-only.
- Never print `iam_client_secret` values — reference where to find them, don't echo them.

</tool_usage_rules>

<action_safety>

The upload pushes a binary to AccelByte's infrastructure. Before running:

- Confirm the image name is correct (it determines how the fleet references it).
- Confirm the target namespace is correct.
- Confirm the executable path is relative to the folder being uploaded.

</action_safety>

## Workflow

### Step 1 — Prerequisites

Run in parallel:

```bash
uname -sm                          # OS/arch: should be Linux x86_64 or i686
command -v ams || echo "not found" # AMS CLI installed?
```

Check:

- **Linux x86/x64 target** → required. Warn if the user is building on macOS/Windows — they need a Linux cross-compile or a Linux build machine.
- **AMS CLI installed** → if missing, ask the user to download it from the Admin Portal: AMS → Download Resource → AMS Command Line Interface. See Step 1a below.
- **IAM client** → must have `AMS:UPLOAD` permission (Create, Update). Ask the user to confirm they have a client with this permission.

#### Step 1a — Download the AMS CLI

If the CLI isn't installed:

> Download the AMS CLI from the Admin Portal:
> 1. Go to your game namespace → AMS → Download Resource
> 2. Click "Download" next to "AMS Command Line Interface"
> 3. Extract the archive and add the binary to your PATH (or run it from the extracted directory)
>
> The CLI is updated periodically — download the latest version before each major upload session.

### Step 2 — Prepare the upload folder

The upload folder must contain all files the DS needs to run. Ask the user:

1. **Upload folder path** — the directory containing the DS binary and all dependencies
2. **Executable path** — relative path from the upload folder to the startup binary (or startup script)
3. **Image name** — a name for this build in AMS (e.g. `my-game-server-1.2.0`)

**Startup script notes (important for Windows builders):**
- If using a startup script, encode as UTF-8 without BOM and use Unix line endings (LF, not CRLF)
- Set file permissions in the script (executable bit on the DS binary)
- Windows Git Bash or WSL can convert: `dos2unix startup.sh`

### Step 3 — Construct and confirm the upload command

Read `references/cli-commands.md` for the exact flag names. The base form is:

```bash
ams upload \
  -H <host-url-without-https://> \
  -c <iam_client_id> \
  -s <iam_client_secret> \
  -n <image_name> \
  -p <path_to_upload_folder> \
  -e <relative_exec_path>
```

Show the user the command with their values substituted (mask the secret to `<your-client-secret>`). Confirm before running:

> About to upload `{image_name}` from `{folder}` to `{namespace}` at `{host}`.
> Executable: `{exec_path}`
> Proceed? (yes/no)

### Step 4 — Run the upload

```bash
ams upload \
  -H {host} \
  -c {client_id} \
  -s {client_secret} \
  -n {image_name} \
  -p {folder} \
  -e {exec_path}
```

Stream output. On success, the CLI confirms the image was uploaded.

After upload, the image is visible in the Admin Portal under AMS → Fleet Manager → Images. The user can edit the image name, add tags, mark it as protected (prevents deletion), or schedule deletion.

### Step 5 — Optional: include debug symbols

If the user wants crash analysis support, add the symbol files flag:

```bash
-f <path_to_symbol_files>
```

Symbol files enable readable crash stack traces in Grafana.

### Step 6 — Next step

```
Upload complete.
  Image: {image_name}
  Namespace: {namespace}

Next: Run /ags-ams fleet to create a fleet using this image.
```

## Error Handling

| Situation | Response |
|---|---|
| AMS CLI not found | Direct to Admin Portal download (Step 1a). Do not attempt to install from another source — the CLI is downloaded directly from the portal. |
| Architecture mismatch (unsupported platform or non-Linux binary) | Stop. AMS requires Linux x86/x64. The DS must be compiled for Linux before uploading. |
| IAM client lacks AMS:UPLOAD permission | Stop. Ask the user to add `Create` and `Update` actions on the `AMS:UPLOAD` resource to their IAM client in the Admin Portal. |
| Upload fails with auth error | Check that client ID and secret are correct. Verify the IAM client belongs to the same namespace as the target AMS account. |
| Startup script has Windows line endings | Warn. Convert with `dos2unix startup.sh` or create the script on a Linux/macOS machine. Carriage returns in shell scripts cause silent failures. |
| Image name collision | AMS allows overwriting — the new upload replaces the existing image with that name. Warn the user if the name matches an existing image that is in use by a fleet. |
| Upload folder path doesn't exist | Stop. The path must be an existing local directory. |
| Exec path resolves outside upload folder | Stop. The executable path must be relative to the upload folder root. |
