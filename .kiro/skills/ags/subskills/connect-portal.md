---
name: ags-connect-portal
description: Bootstrap or repair AGS namespace/IAM client/login-method config for
  a project. Uses the AGS CLI to discover existing namespace state, create or select
  IAM clients, enable required login methods when exposed by the CLI, and write .env
  / engine config.
allowed-tools: Read Write Edit Bash Glob
model: sonnet
last-verified: 2026-06-24
sources:
- https://docs.accelbyte.io/
- https://github.com/AccelByte/ags-api-mcp-server
- https://github.com/AccelByte/accelbyte-unreal-oss
see-also:
- '[iam.md](../references/modules/iam.md)'
- '[auth-flow.md](../references/integrate/auth-flow.md)'
- '[iam-authorization-preflight.md](../references/security/iam-authorization-preflight.md)'
- '[auth-provider-configuration.md](../references/platforms/auth-provider-configuration.md)'
- '[cli-commands.md](../references/observe/cli-commands.md)'
- '[manage-permissions.md](manage-permissions.md)'
- '[install-cli.md](install-cli.md)'
- '[install-mcp.md](install-mcp.md)'
- '[install-sdk.md](install-sdk.md)'
---

# AGS Portal Connector

Bootstrap the connection between an AccelByte namespace and a project on disk: discover or create the IAM client, enable required login methods when the CLI exposes those operations, write the project-specific runtime config, and confirm the SDK is pointing at the right URLs and namespace. **Does not create production namespaces on its own.** Namespace creation and tier upgrades stay in the Admin Portal with an authorized human in the loop.

## Behavior Constraints

<grounding_rules>

Operate against information the user provides, files on disk, AGS CLI results, and `references/platforms/auth-provider-configuration.md`. Don't fabricate namespace names, IAM client IDs, secrets, AGS URLs, login-method state, command shapes, platform App IDs, platform client secrets, platform keys, redirect URIs, issuer URLs, or platform-holder configuration. Follow `references/observe/cli-commands.md#rules-of-engagement-for-llms`: use `ags describe` as the primary structured discovery path, plus `--skeleton` / `--dry-run` where available, to discover the exact generated command and request body before mutating AGS. Use `--help` only as a fallback when `describe` does not cover the command family.

When the handoff comes from an authorization preflight, follow `references/security/iam-authorization-preflight.md`: game clients use Public IAM clients for login/bootstrap and user-token calls; game server / backend / trusted tooling uses a Confidential IAM client; permission changes must be based on AGS CLI discovery or explicit user/Admin Portal evidence, not guessed strings.

</grounding_rules>

<tool_usage_rules>

- `Read` / `Glob` to find existing config files.
- `Write` / `Edit` only for project-side files (`.env`, SDK config, `.gitignore` updates).
- `Bash` for the AGS CLI when it's installed and authenticated. Use read-only discovery freely; use state-changing commands only after showing the command/body and receiving explicit confirmation.
- When the AGS API MCP server is configured for this environment, its `search-apis` / `describe-apis` / `run-apis` tools are an alternative to the AGS CLI for discovering and applying IAM client and permission changes — useful when the CLI is not installed or authenticated. Treat `run-apis` write operations (`POST` / `PUT` / `PATCH` / `DELETE`) as mutations under the same confirmation gate as CLI mutations; the tool itself also prompts for consent.
- `Read` `references/platforms/auth-provider-configuration.md` before configuring any platform/login provider such as Steam, Epic, PSN, Xbox, Apple, Google, Google Play Games, Facebook, Discord, Twitch, Snapchat, Oculus, Microsoft, OIDC, AWS Cognito, Nintendo, or Device ID.
- Don't read other subskills.

</tool_usage_rules>

<dependency_checks>

Before writing anything, confirm:

1. The AGS CLI is installed (`ags --version` or `ags describe`; use `ags --help` only as a fallback). If not, route to `/ags install-cli` and stop here.
2. The CLI is authenticated to the right Admin Portal (`ags auth status`). If not, point at `ags auth login`.
3. The target namespace and base URL are known from the project runtime config when this is a game project. For Unreal, read `Config/DefaultEngine.ini` first. For Unity, read the AccelByte SDK config asset/json first. For Web/custom projects, read `.env` or app config first. Use CLI profile/config only to verify or fill missing values; do not let CLI defaults override project config.
4. The project target is known (game client, dedicated server, web/admin tool) so the IAM client kind and login methods can be chosen.
5. The project type is known (Unreal / Unity / Godot / Roblox / Web / custom engine). If this subskill is invoked from `/ags init`, use the project type detected in Stage 1 and confirmed by the wizard. Do not ask again or fall back to generic `.env` behavior when the project type is already known.
6. For third-party provider login, the provider-specific prerequisites in `references/platforms/auth-provider-configuration.md` are satisfied or explicitly handed off to the user.

If any of those are missing, stop and surface the gap before doing work.

</dependency_checks>

<action_safety>

This subskill writes to disk and can call AccelByte APIs. Specifically:

- **Writes the `.env` file** — confirm with the user before overwriting an existing `.env`.
- **Updates `.gitignore`** to ensure `.env` isn't committed — confirm with the user.
- **Creates an IAM client via the CLI** — only with explicit confirmation, and only after showing the user the client config that will be created.
- **Enables login methods / IAM settings via the CLI** - only with explicit confirmation, and only after showing the discovered command and JSON body.
- **Configures third-party provider credentials** - only after the user supplies the provider-owned values listed in `references/platforms/auth-provider-configuration.md`. If values are missing, stop and ask for them with the official setup reference; do not create placeholders or continue into login code.
- **Never creates a namespace** — that's an Admin Portal operation with a human in the loop.
- **Never creates production IAM clients** without explicit confirmation that the target is intentionally production.

If the CLI isn't available or the user doesn't want to script it, the AGS API MCP server's `run-apis` tool can perform the same IAM client and permission mutations when it's configured for this environment (under the same confirmation gate). If neither is available, fall back to the Admin Portal: print the manual steps and stop.

For Unreal projects, treat `Config/DefaultEngine.ini` as a project config file covered by these write-safety rules. `.env` is optional for Unreal local tooling and does not replace the engine runtime config.

</action_safety>

<output_contract>

End with a "ready" block:

```
Portal connection ready

  Namespace:        <name>
  Environment:      <dev / staging / prod>
  Base URL:         <URL>
  IAM client:       <client-id> (<public / confidential>)
  Project config:   <path>  (<engine config / .env / SDK config>)
  .env:             <path or not written>  (added to .gitignore when written)
  CLI authenticated: yes

Next step: /ags install-sdk
```

If anything was skipped or done manually, note it in the block.

</output_contract>

<completeness_contract>

The connect step is complete when:

1. The namespace name and base URL are known from CLI config, project config, or user input.
2. An IAM client exists in that namespace (created here or already present).
3. Required login methods for the target integration are enabled, or the CLI has reported that the operation is unavailable and manual portal action is required.
4. The project has the correct runtime config for its project type, carrying client ID, base URL, namespace name, and publisher namespace when the SDK requires it. Client secret only if it's a confidential server-side target.
5. If `.env` is written, `.env` is in `.gitignore`.
6. The "ready" block is printed.

</completeness_contract>

## Workflow

### Step 1: Confirm preconditions

Run dependency checks. If any fail, surface the gap.

Also inspect what is already configured:

```bash
ags auth status --format json
ags doctor --format json
ags describe config
ags describe iam clients list
```

Use the actual CLI command surface. For existing game projects, inspect project runtime config before choosing a namespace:

- Unreal: `Config/DefaultEngine.ini`, especially `[/Script/AccelByteUe4Sdk.AccelByteSettings]` and server settings.
- Unity: the project's AccelByte SDK settings asset/json.
- Web/custom: `.env` or app config.

If `ags config get base-url` / `ags config get namespace` or equivalent is available, use it only as a consistency check against project config. If project config and CLI profile disagree, stop and ask which target to use before running namespace-scoped commands.

### Step 2: Decide on the IAM client kind and login methods

Ask:

> Is this for a **game client** (player-facing — Unreal / Unity / Godot / Roblox), a **dedicated game server**, or a **web app / admin tool**?
> • Game client → public IAM client.
> • Dedicated server → confidential IAM client.
> • Web app → public IAM client (PKCE flow).

If the target is backend service, CI automation, dedicated server tooling, or any trusted server-side integration, treat it like dedicated-server authorization: use a confidential IAM client and do not continue with a public client.

For platform login methods in game clients, required setup is:

- Public IAM client for the game client.
- The attempted platform/login method configured for the game namespace or IAM client, depending on the current AGS API shape. Examples include `device`, Steam, Epic, PSN, and Xbox.
- No client secret stored in the game client.

For any third-party platform or social login method, read `references/platforms/auth-provider-configuration.md` now and apply its provider stop point before continuing. If the requested provider requires user-owned values such as Steam App ID, Steam Publisher Web API Key, Epic client secret, Apple private key, Google OAuth client secret, or OIDC issuer/JWKS URLs, ask for those values and stop. Do not continue with placeholder AGS configuration, CLI mutation, or game login code until the values are available.

### Step 3: Discover existing namespace and IAM state

Use `ags describe` before service commands, then run JSON output commands where exposed:

```bash
ags describe iam clients list
ags iam clients list --namespace <namespace> --format json
```

Discover login-method / identity-provider commands rather than guessing names:

```bash
ags describe iam
ags describe iam clients
```

If the generated CLI exposes login-method, platform, identity-provider, or namespace auth-settings resources, inspect them with `--format json` before deciding to create/update anything.

### Step 4: Create or update AGS resources

If the user wants to create a new client and the CLI is authenticated:

1. Show the client config that will be created (name, kind, scopes).
2. Use `ags describe <service> <resource> <method>` and `--skeleton` when available to get the exact request body.
3. Show the command/body, including `--namespace`, `--api-scope`, and `--api-version` if required.
4. Confirm with the user.
5. Run the CLI command. Capture the new client ID (and secret, for confidential).

If a required platform/login method is disabled or missing and the CLI exposes the update operation:

1. Use `ags describe` / `--skeleton` to build the request body.
2. Show a minimal diff from current state to desired state.
3. Confirm with the user.
4. Run the CLI update.

If the CLI does not expose the needed mutation, stop and give the exact Admin Portal action. Do not leave placeholder config and continue as if runtime verification can succeed.

If the authorization preflight identified missing permissions for an AGS API call during this bootstrap, apply the fix here. For a standalone permission change on a client that already exists outside a setup flow, `/ags manage-permissions` is the dedicated path; this in-flow handling mirrors it.

1. Discover the exact IAM client read/update operation and its request body. Use `ags describe` first and generated help only as a fallback, or — when the AGS API MCP server is configured for this environment — its `search-apis` / `describe-apis` tools against the IAM admin client and permission endpoints (`POST` / `PUT` `/iam/v3/admin/namespaces/{namespace}/clients/{clientId}/permissions`, `DELETE .../permissions/{resource}/{action}`).
2. Show the current client kind and permission gap.
3. For game server / backend / trusted tooling, require a confidential IAM client before any permission update.
4. Show the permission change and request body. Use `--skeleton` and `--dry-run` (CLI) where available.
5. Get explicit user confirmation before running any client update or permission grant — whether the mutation runs through the CLI or through the MCP server's `run-apis` tool. This subskill's confirmation gate applies regardless of which path executes it.
6. If neither the CLI nor the MCP server is available, or neither exposes the needed permission mutation, stop and give the Admin Portal owner the exact permission/evidence to add.

#### Platform credential runbook

Use this path when the integration reaches AGS and login returns HTTP 400 `invalid_request` with a platform-config error such as "platform client not found".

First hypothesis: the attempted platform/login method is not configured in IAM. Identify the exact AGS platform ID from the SDK/OSS login path or CLI shape, such as `device`, `steam`, `epicgames`, `psn` (some AGS versions use `ps4`/`ps5` separately — verify the exact ID with `ags describe iam`), or `xbox`.

Then read `references/platforms/auth-provider-configuration.md` and use the matching provider's "ask the user for" list as a hard gate before any AGS-side mutation or game-code work.

Do **not** use `check-availability` as the deciding check:

```bash
ags iam platform-credentials check-availability --platform-id <platform-id>
```

It can be a supportability/availability check rather than proof that the namespace has a configured credential. For `device`, it can report "third-party platform not supported" and send the agent down the wrong path. Check the configured credential directly:

```bash
ags iam platform-credentials get --namespace <namespace> --platform-id <platform-id> --format json
ags iam platform-credentials list --namespace <namespace> --format json
```

If the platform credential is missing, show the portal-equivalent action:

`Game Setup > 3rd Party Configuration > Auth & Account Linking > Add New > <Platform> > fill required platform fields > Active`

(If this path doesn't match your portal version, look under IAM > Platform Credentials instead.)

If provider-owned values are missing, stop here and ask for them. Include the official setup reference from `references/platforms/auth-provider-configuration.md`. Examples:

- Steam: ask for Steam App ID and Steam Publisher Web API Key; use `http://127.0.0.1` for in-game redirect unless the user's AGS version says otherwise.
- Epic: ask for Epic client ID and client secret; use `http://127.0.0.1` for in-game redirect.
- Google / Google Play Games: ask for Google OAuth client ID and client secret; for Google Play Games, also ask for Android package/signing and Games App ID details when Unreal Android is in scope.
- Apple: ask for Apple Service ID, base64 `.p8` private key, Team ID, and Key ID.
- PSN / Xbox / Nintendo: public setup details are not available in the AGS docs; stop and ask the user to provide the confidential AccelByte/platform-holder setup outputs.
- Device ID: no external provider credentials; ask whether this is development-only or an intentional production flow with account-upgrade/linking mitigation.

Do not treat a CLI skeleton as permission to invent provider values. The skeleton can tell you the request shape; the user or provider console must supply the values.

If the user approves CLI mutation:

1. Discover the exact create command first:

   ```bash
   ags describe iam platform-credentials create
   ```

2. Use `--skeleton` if available and create the platform-specific JSON body. Do not reuse the Device body for other platforms.

   Device minimal body example:

   ```json
   {
     "RedirectUri": "http://127.0.0.1",
     "IsActive": true
   }
   ```

   Other platforms require their own fields, such as client ID, client secret, app ID, publisher keys, organization IDs, issuer/JWKS URLs, or provider metadata. Get those fields from `references/platforms/auth-provider-configuration.md` and user/provider-console input before mutating.

3. On PowerShell, write the body to a file and use `--json @file` rather than inline JSON to avoid quoting failures. Verify `--json @file` is a supported flag with `ags describe iam platform-credentials create` before using it; use `--help` only if `describe` does not expose flag details.
4. Run the confirmed create command.
5. Verify with:

   ```bash
   ags iam platform-credentials get --namespace <namespace> --platform-id <platform-id> --format json
   ```

6. Rerun the SDK/OSS smoke test.

If the user already has a client and just wants the wiring:

1. Ask for the client ID (and secret, for confidential).

### Step 5: Choose and write the project config

Use the detected project type to choose the primary runtime configuration target:

| Project type | Primary config target | Notes |
|---|---|---|
| Unreal game client | `Config/DefaultEngine.ini` | Required for OnlineSubsystemAccelByte / Unreal SDK runtime config. `.env` may be written as an auxiliary local tooling file, but it is not sufficient by itself. |
| Unreal dedicated server | `Config/DefaultEngine.ini` plus server-only secret handling | Do not put confidential client secrets in client builds. Confirm the target is server-only before writing a secret. |
| Unity / Godot / Roblox / Web / custom engine | `.env` or the SDK config file used by that project | Prefer the existing local convention if one is already present. |

Do not stop after writing `.env` for an Unreal project. If the project is Unreal and `Config/DefaultEngine.ini` exists or can be created under `Config/`, write or update the Unreal config after showing the diff and receiving confirmation.

### Step 6: Write the `.env` when applicable

Standard shape:

```
ACCELBYTE_BASE_URL=<URL>
ACCELBYTE_NAMESPACE=<name>
ACCELBYTE_CLIENT_ID=<client-id>
# Confidential clients only:
ACCELBYTE_CLIENT_SECRET=<client-secret>
```

If a `.env` already exists, **show the diff and confirm** before overwriting. Don't silently merge.

For Unreal, `.env` is optional and primarily useful for local scripts or later non-Unreal tooling. The Unreal runtime must still receive its AGS values in `Config/DefaultEngine.ini`.

### Step 7: Update engine SDK config when applicable

For Unreal, write real values into `Config/DefaultEngine.ini` only after the AGS values are known. Do not add empty placeholders for:

- `ClientId`
- `ClientSecret`
- `Namespace`
- `PublisherNamespace`
- `BaseUrl`

For a public game client, omit `ClientSecret` or leave it absent unless the current SDK docs require a blank key. Never put a confidential client secret into a game client config.

If the file already contains AccelByte settings, show the before/after diff and confirm whether to update the existing section. Preserve unrelated Unreal settings. If there is no AccelByte section, add the minimal section required by the installed Unreal SDK / OSS configuration pattern rather than inventing unrelated keys.

Unreal URL-like string values in `DefaultEngine.ini` must be double-quoted. In particular, write `RedirectURI` and `BaseUrl` with quotes; unquoted values can fail SDK config parsing.

Minimal public game-client example:

```ini
[OnlineSubsystem]
DefaultPlatformService=AccelByte
NativePlatformService=AccelByte

[OnlineSubsystemAccelByte]
bAutoLobbyConnectAfterLoginSuccess=false
bAutoChatConnectAfterLoginSuccess=false

[/Script/AccelByteUe4Sdk.AccelByteSettings]
ClientId=<client-id>
Namespace=<namespace>
PublisherNamespace=<publisher-namespace>
RedirectURI="http://127.0.0.1"
BaseUrl="https://development.accelbyte.io"
```

When invoked from `/ags init` and Stage 1 detected Unreal, the confirmation prompt must name `Config/DefaultEngine.ini` as a file that will be changed. A prompt that only proposes `.env` is incomplete and must be corrected before asking for approval.

### Step 8: Update `.gitignore`

Ensure `.env` is in `.gitignore`. If not, add it. Confirm before committing.

### Step 9: Print the ready block

Per `output_contract`.

## Examples

### Happy path (game client, fresh namespace)

```
User: /ags connect-portal

Skill: Confirming preconditions:
       OK AGS CLI installed (ags 0.1.0)
       OK CLI authenticated (`ags auth status`)
       ? Namespace name?

User: myteam-dev

Skill: ✓ Namespace 'myteam-dev' exists in your portal.

       Is this for a game client, a dedicated server, or a web app?

User: Game client (Unreal).

Skill: I'll create a public IAM client. Config:
         Name:       myteam-dev-unreal-client
         Kind:       public
         Scopes:     iam:user, lobby, matchmaking, session, store
       Confirm? (y/n)

User: y

Skill: ✓ Created client. ID: a1b2c3d4...
       ✓ Wrote .env
       ✓ Added .env to .gitignore

       Portal connection ready

         Namespace:         myteam-dev
         Environment:       dev
         Base URL:          https://accelbyte.example.com
         IAM client:        a1b2c3d4 (public)
         .env:              ./.env  (in .gitignore)
         CLI authenticated: yes

       Next step: /ags install-sdk
```

### CLI not installed (manual fallback)

```
User: /ags connect-portal

Skill: Confirming preconditions:
       AGS CLI not installed.

       Run /ags install-cli first, then re-run /ags connect-portal.

       (Alternative: do it manually in the Admin Portal — create the IAM
       client there, then come back here to write the .env.)
```

### Existing namespace, manual client capture

```
User: /ags connect-portal — I already have an IAM client.

Skill: ? Namespace name?

User: myteam-staging

Skill: ? IAM client kind (public / confidential / web)?

User: confidential (game server)

Skill: ? Client ID?

User: abc123

Skill: ? Client secret?

User: <pasted>

Skill: ? Base URL for staging?

User: https://accelbyte.example.com

Skill: ✓ Wrote .env
       ✓ Added .env to .gitignore

       Portal connection ready
       ...

       Next step: /ags install-sdk (server build target).
```

## Error handling

- **CLI authenticated to wrong portal** — surface and wait. Don't run anything against the wrong portal.
- **Namespace doesn't exist** — point at the Admin Portal namespace-creation flow. Don't try to create it via the CLI without explicit user instruction.
- **Existing `.env` with conflicting values** — show the diff, ask whether to overwrite, merge, or write to a different filename (`.env.local`, `.env.staging`, etc.).
- **User pastes a client secret in chat** — the secret stays in the `.env`; remind the user not to commit it; verify `.gitignore`.
- **Production namespace** — confirm before any change. "This is a prod IAM client; want to proceed?"
