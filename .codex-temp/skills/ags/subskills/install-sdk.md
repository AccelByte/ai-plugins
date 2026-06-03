---
name: ags-install-sdk
description: Detect the target engine/runtime and install the matching AGS SDK. Owns
  Unreal, Unity, Godot, Roblox, the TypeScript Web SDK, and custom-engine REST fallback.
allowed-tools: Read Write Edit Bash Glob
model: sonnet
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
see-also:
- '[_index.md](../references/sdks/_index.md)'
- '[unreal.md](../references/sdks/game-engine/unreal.md)'
- '[unreal-install.md](../references/sdks/game-engine/unreal/install.md)'
- '[unity.md](../references/sdks/game-engine/unity.md)'
- '[unity-install.md](../references/sdks/game-engine/unity/install.md)'
- '[godot.md](../references/sdks/game-engine/godot.md)'
- '[roblox.md](../references/sdks/game-engine/roblox.md)'
- '[typescript.md](../references/sdks/web/typescript.md)'
- '[sdk-quickstart.md](../references/init/sdk-quickstart.md)'
- '[connect-portal.md](connect-portal.md)'
---

# AGS SDK Installer

Detect the project's engine or runtime and install the right AGS SDK. This is the single install entry point for AGS game and web SDK work: Unreal, Unity, Godot, Roblox, the standalone TypeScript Web SDK, and custom-engine REST fallback.

**Game Engine SDKs only** (Unreal / Unity / Godot / Roblox) plus the **TypeScript Web SDK** for web apps. **Extend SDKs (Go / Python / C# / Java) are not installed here** - they are for Extend apps and live in `/ags-extend`.

## Behavior Constraints

<grounding_rules>

Per-engine details (paths, install commands, version compatibility) trace to the matching reference:

- Unreal: `references/sdks/game-engine/unreal/install.md`
- Unity: `references/sdks/game-engine/unity/install.md`
- Godot: `references/sdks/game-engine/godot.md`
- Roblox: `references/sdks/game-engine/roblox.md`
- Web: `references/sdks/web/typescript.md`

Do not fabricate version compatibility, package names, repository tags, config keys, or install paths. When in doubt, point at the SDK's official GitHub release notes or ask the user to provide the pinned version.

</grounding_rules>

<tool_usage_rules>

- `Glob` to detect engine/runtime.
- `Read` references and existing project config.
- `Bash` for SDK install commands (`git submodule add`, `git clone`, `npm install`, etc.) **after explicit user confirmation**.
- `Write` / `Edit` for project-side config after showing the planned diff.
- Do not read other subskills to perform SDK installation. References own engine-specific details.

</tool_usage_rules>

<dependency_checks>

Before installing:

1. The engine/runtime is detected and confirmed.
2. A `.env` or equivalent config source exists with `ACCELBYTE_BASE_URL`, `ACCELBYTE_NAMESPACE`, and `ACCELBYTE_CLIENT_ID` before config and login verification. If missing, route to `/ags connect-portal`.
3. Engine-specific project files and tooling are present:
   - Unreal: `.uproject`, target project `Plugins/`, build files, and enough Unreal tooling to regenerate or compile after plugin install.
   - Unity: `Assets/`, `ProjectSettings/ProjectVersion.txt`, and `Packages/manifest.json`.
   - Godot: `project.godot`.
   - Roblox: Studio environment (warning, not blocker).
   - Web: `package.json` and `node`.

If a runtime is missing (no Node for web, no engine project for game), surface the gap and stop. Do not install Node, Unreal, Unity, Godot, Roblox Studio, or other runtimes for the user.

</dependency_checks>

<parallel_tool_calling>

Run engine-detection `Glob` calls in parallel - one for each engine signature. Do the same for read-only env/config detection.

</parallel_tool_calling>

<action_safety>

Installs SDKs and edits project files. Specifically:

- **Plugin/package installs** (Unreal `Plugins/`, Unity Package Manager Git URL, Godot addon, Roblox model import) - confirm the version with the user before installing.
- **Unreal installs** - follow `references/sdks/game-engine/unreal/install.md`.
- **Unity installs** - follow `references/sdks/game-engine/unity/install.md`.
- **npm install** for the TypeScript SDK - confirm the version and dependency type (`dependencies` vs `devDependencies`).
- **Project-config edits** (Unreal `.uproject` / `Build.cs` / `.ini`, Unity `manifest.json` / resources config, Godot `project.godot`, web `tsconfig.json`) - show the diff before applying.
- **Never** install an Extend SDK from here. If the user asks for a Go / Python / C# / Java SDK, route to `/ags-extend`.

</action_safety>

<output_contract>

End with an "installed" block:

```text
SDK installed

  Engine:           <Unreal / Unity / Godot / Roblox / Web>
  SDK version:      <version>
  Install path:     <path / package name>
  AGS config:       <present / missing - reason>
  Verification:     <login call result>

Next step: /ags integrate (start with IAM)
```

</output_contract>

<completeness_contract>

The install is complete when:

1. The engine/runtime is identified and confirmed.
2. The SDK is installed at a version pinned in the project file or install directory.
3. The SDK is configured against the `.env` values where the engine requires local config.
4. A test login call succeeded, using `references/init/sdk-quickstart.md` and any engine-specific verification reference.
5. The "installed" block is printed.

If AGS config is missing but the engine-specific reference allows package/plugin installation without config, stop after install and route to `/ags connect-portal`. If verification fails, do not print the "installed" block; surface the failure and point at `references/debug/auth-failures.md` or `/ags debug`.

</completeness_contract>

## Workflow

### Step 1: Detect engine

In parallel:

```bash
ls **/*.uproject 2>/dev/null
ls Assets/ ProjectSettings/ Packages/manifest.json 2>/dev/null
ls project.godot 2>/dev/null
ls *.rbxlx *.rbxl 2>/dev/null
ls package.json 2>/dev/null
```

Confirm the target with the user, especially in monorepos.

### Step 2: Verify dependencies

Use `dependency_checks`. Surface gaps clearly. If `.env` or IAM client values are missing, route to `/ags connect-portal` before config/login verification.

### Step 3: Read the matching reference

Read exactly the reference for the confirmed target:

- Unreal: `references/sdks/game-engine/unreal/install.md`
- Unity: `references/sdks/game-engine/unity/install.md`
- Godot: `references/sdks/game-engine/godot.md`
- Roblox: `references/sdks/game-engine/roblox.md`
- Web: `references/sdks/web/typescript.md`

Stay in `/ags install-sdk`; do not route to engine-specific installer subskills.

### Step 4: Install and configure

Follow the selected reference. Show the install plan and version pin, confirm with the user, then run the command or edit the project config.

Configure against `.env` or the project's chosen config source:

- Unreal: enable/configure the plugin set per `references/sdks/game-engine/unreal/install.md`.
- Unity: update UPM packages and SDK config JSON per `references/sdks/game-engine/unity/install.md`.
- Godot: add the SDK/addon and project config per `references/sdks/game-engine/godot.md`.
- Roblox: add the model/module and server-side config per `references/sdks/game-engine/roblox.md`.
- TypeScript Web: install packages and initialize from `process.env.*` or an explicit init call.

### Step 5: Verify login

Use `references/init/sdk-quickstart.md` plus any engine-specific verification notes:

1. Trigger a login call.
2. Confirm a token comes back.
3. Confirm a second call, such as profile lookup, works.

If verification fails, route to `/ags debug` or `references/debug/auth-failures.md`. Do not print the "installed" block.

### Step 6: Print the "installed" block

Use `output_contract`.

## Examples

### Unreal

```text
User: /ags install-sdk

Skill: Detected: Unreal Engine project (myteam.uproject).
       Confirming Unreal? (y/n)

User: y

Skill: Reading references/sdks/game-engine/unreal/install.md.
       Will install OnlineSubsystemAccelByte, AccelByteUe4Sdk, and
       AccelByteNetworkUtilities under Plugins/AccelByte/ at confirmed tags.
```

### Unity

```text
User: /ags install-sdk

Skill: Detected: Unity project (ProjectSettings/ProjectVersion.txt).
       Confirming Unity? (y/n)

User: y

Skill: Reading references/sdks/game-engine/unity/install.md.
       Will update Packages/manifest.json with pinned UPM Git URLs.
```

### TypeScript Web SDK

```text
User: /ags install-sdk

Skill: Detected: package.json with Next.js dependencies.
       Confirming Web (TypeScript Web SDK)? (y/n)

User: y

Skill: Will install: @accelbyte/sdk (latest)
       Dependency type: dependencies
       Confirm? (y/n)

User: y

Skill: Installed packages, wrote the client initializer, and verified login.

       SDK installed
         ...

       Next step: /ags integrate (start with IAM admin scopes for an
       admin tool, or auth flow for a player-facing web app).
```

## Error Handling

- **Multiple engines detected** (for example, Unreal plus a Next.js admin tool) - ask which install this round is for. Do not install both.
- **Engine version unsupported by SDK** - surface the gap and point at official release notes for a matching version range.
- **`.env` missing required values** - name the missing keys and route to `/ags connect-portal`.
- **User asks for "Go SDK" / "Python SDK" / "C# SDK" / "Java SDK"** - these are Extend SDKs. Route to `/ags-extend`. Do not install here.
- **Custom engine** (not Unreal / Unity / Godot / Roblox / Web) - say there is no Game Engine SDK for that engine; integrate via REST + OpenAPI directly. From `https://docs.accelbyte.io/`, navigate to SDK & Tools > SDK References > API Explorer for the OpenAPI specs.
