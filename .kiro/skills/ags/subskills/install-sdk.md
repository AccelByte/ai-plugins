---
name: ags-install-sdk
description: Detect the target engine/runtime and route to the right AGS SDK installer.
  Unreal and Unity have dedicated installers; this subskill still owns Godot, Roblox,
  Web SDK, and custom-engine REST fallback.
allowed-tools: Read Write Edit Bash Glob
model: sonnet
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[_index.md](../references/sdks/_index.md)'
- '[unreal.md](../references/sdks/game-engine/unreal.md)'
- '[unity.md](../references/sdks/game-engine/unity.md)'
- '[godot.md](../references/sdks/game-engine/godot.md)'
- '[roblox.md](../references/sdks/game-engine/roblox.md)'
- '[typescript.md](../references/sdks/web/typescript.md)'
- '[sdk-quickstart.md](../references/init/sdk-quickstart.md)'
- '[connect-portal.md](connect-portal.md)'
- '[install-unreal-sdk.md](install-unreal-sdk.md)'
- '[install-unity-sdk.md](install-unity-sdk.md)'
---

# AGS SDK Installer

Detect the project's engine / runtime and install the right AGS SDK. Unreal and Unity are split into dedicated subskills; route there after detection. For Godot, Roblox, and the TypeScript Web SDK, this subskill wires the SDK into the project, points it at the namespace and IAM client from the `.env`, and runs a verification step before handing off to `/ags integrate`.

**Game Engine SDKs only** (Unreal / Unity / Godot / Roblox) plus the **TypeScript Web SDK** for web apps. **Extend SDKs (Go / Python / C# / Java) are not installed here** — they're for Extend apps and live in `/ags-extend`.

## Behavior Constraints

<grounding_rules>

Per-engine details (paths, install commands, version compatibility) trace to `references/sdks/game-engine/<engine>.md` or `references/sdks/web/typescript.md`. Don't fabricate version compatibility or invent install paths; when in doubt, point at the SDK's GitHub release notes.

For Unreal, route to `subskills/install-unreal-sdk.md`. For Unity, route to `subskills/install-unity-sdk.md`. Do not inline those engine-specific workflows here.

</grounding_rules>

<tool_usage_rules>

- `Glob` to detect engine.
- `Read` references and existing project config.
- `Bash` for SDK install commands (`npm install`, plugin installer scripts, etc.) **after explicit user confirmation**.
- `Write` / `Edit` for project-side config (e.g. add the SDK package reference to `Build.cs` for Unreal, edit `package.json` for web).
- Don't read other subskills.

</tool_usage_rules>

<dependency_checks>

Before installing:

1. The engine is detected and confirmed.
2. A `.env` (or equivalent) exists with `ACCELBYTE_BASE_URL`, `ACCELBYTE_NAMESPACE`, `ACCELBYTE_CLIENT_ID`. If not, route to `/ags connect-portal`.
3. Engine-specific tooling is present:
   - Unreal: route to `/ags install-unreal-sdk`.
   - Unity: route to `/ags install-unity-sdk`.
   - Godot: `project.godot` engine version detected.
   - Roblox: Studio environment (warning, not blocker).
   - Web: `package.json` and `node` available.

If a runtime is missing (no Node for web, no engine for game), surface the gap and stop. Don't try to install Node / Unreal / Unity / etc. for the user.

</dependency_checks>

<parallel_tool_calling>

Run the engine-detection `Glob` calls in parallel — one for each engine signature — rather than serially. Same for any read-only env-detection commands.

</parallel_tool_calling>

<action_safety>

Installs SDKs and edits project files. Specifically:

- **Plugin-style installs** (Unreal `Plugins/`, Unity Package Manager Git URL, Godot addon, Roblox model import) — confirm the version with the user before installing.
- **Unreal plugin installs** — owned by `/ags install-unreal-sdk`.
- **Unity package installs** — owned by `/ags install-unity-sdk`.
- **npm install** for the TypeScript SDK — confirm the version and the dependency type (`dependencies` vs `devDependencies`).
- **Project-config edits** (Unreal `Build.cs`, Unity `manifest.json`, Godot `project.godot`, web `tsconfig.json`) — show the diff before applying.
- **Never** install an Extend SDK from here. If the user asks for a Go / Python / C# / Java SDK, route to `/ags-extend`.

</action_safety>

<output_contract>

End with an "installed" block:

```
SDK installed

  Engine:           <Unreal / Unity / Godot / Roblox / Web>
  SDK version:      <version>
  Install path:     <path / package name>
  .env consumed:    yes
  Verification:     <login call result>

Next step: /ags integrate (start with IAM)
```

</output_contract>

<completeness_contract>

The install is complete when:

1. The engine is identified (or the user confirmed Web).
2. The SDK is installed at a version pinned in the project file (Godot `project.godot`, Roblox model file, `package.json` for web; Unreal and Unity are completed by their dedicated installers).
3. The SDK is configured against the `.env` values.
4. A test login call succeeded (the verification step from `references/init/sdk-quickstart.md`).
5. The "installed" block is printed.

If verification fails, **do not** print the "installed" block. Surface the failure, point at `references/debug/auth-failures.md` or `subskills/debug.md`.

</completeness_contract>

## Workflow

### Step 1: Detect engine

In parallel:

```bash
ls **/*.uproject 2>/dev/null
ls Assets/ ProjectSettings/ 2>/dev/null
ls project.godot 2>/dev/null
ls *.rbxlx *.rbxl 2>/dev/null
ls package.json 2>/dev/null
```

Confirm with the user.

### Step 2: Verify dependencies

Per `dependency_checks`. Surface gaps; route to `/ags connect-portal` if `.env` missing.

### Step 3: Install the SDK

Read the matching `references/sdks/<family>/<engine>.md` for engine-specific install path. Show the install command, confirm with the user, run.

For specifics per engine, defer to that reference file rather than restating here.

If the detected engine is Unreal, stop this subskill and route to `/ags install-unreal-sdk`. If it is Unity, stop this subskill and route to `/ags install-unity-sdk`.

### Step 4: Configure against `.env`

Most SDKs read config either from `.env` directly (web) or from a per-engine config file pointing at the same values:

- Unreal: handled by `/ags install-unreal-sdk`.
- Unity: handled by `/ags install-unity-sdk`.
- Godot: a node / autoload pointing at `.env` or environment variables.
- Roblox: a server-side config script storing the values.
- TypeScript Web: `process.env.*` directly, or an init call passing the values from `.env`.

Wire it. Confirm the SDK can read the values.

### Step 5: Verify (run the test login)

Per `references/init/sdk-quickstart.md`:

1. Trigger a login call.
2. Confirm a token comes back.
3. Confirm a second call (e.g. `GetMyProfile` / equivalent) works.

If verification fails, route to `subskills/debug.md` or `references/debug/auth-failures.md`. Don't print the "installed" block.

### Step 6: Print the "installed" block

Per `output_contract`.

## Examples

### Unreal route

```
User: /ags install-sdk

Skill: Detected: Unreal Engine project (myteam.uproject).
       Confirming Unreal? (y/n)

User: y

Skill: Unreal has a dedicated installer. Routing to:
       /ags install-unreal-sdk
```

### Unity route

```
User: /ags install-sdk

Skill: Detected: Unity project (ProjectSettings/ProjectVersion.txt).
       Confirming Unity? (y/n)

User: y

Skill: Unity has a dedicated installer. Routing to:
       /ags install-unity-sdk
```

### TypeScript Web SDK

```
User: /ags install-sdk

Skill: Detected: package.json with Next.js dependencies.
       Confirming Web (TypeScript Web SDK)? (y/n)

User: y

Skill: Will install: @accelbyte/sdk (latest)
       Dependency type: dependencies
       Confirm? (y/n)

User: y

Skill: ✓ npm install @accelbyte/sdk
       ✓ Wrote src/lib/accelbyte-client.ts (initializes from .env)
       ✓ Test login (OAuth PKCE flow): succeeded. token received.

       SDK installed
         ...

       Next step: /ags integrate (start with IAM admin scopes for an
       admin tool, or auth flow for a player-facing web app).
```

### Verification failed

```
Skill: ...
       ✗ Test login failed: 401 invalid_token

       Stopped — the SDK is installed, but the login round-trip failed.

       Most common cause: the IAM client kind doesn't match the build
       target (e.g. trying to use a confidential client from a game-client
       build, or vice versa).

       See references/debug/auth-failures.md for the diagnosis tree.
       Or run /ags debug to walk through it interactively.
```

## Error handling

- **Multiple engines detected** (e.g. monorepo with Unreal + a Next.js admin tool) — ask which install this round is for. Don't install both.
- **Engine version unsupported by SDK** — surface the gap. Point at the SDK's release notes for the matching version range.
- **`.env` missing required values** — name the missing keys; route to `/ags connect-portal`.
- **User asks for "Go SDK" / "Python SDK" / "C# SDK" / "Java SDK"** — these are Extend SDKs. Route to `/ags-extend`. Do not install here.
- **Custom engine** (not Unreal / Unity / Godot / Roblox / Web) — say there's no Game Engine SDK for that engine; integrate via REST + OpenAPI directly. Point at `https://docs.accelbyte.io/` for the OpenAPI specs.
