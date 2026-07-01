---
last-verified: 2026-06-24
sources:
- https://docs.accelbyte.io/
- https://github.com/AccelByte/ags-api-mcp-server
see-also:
- '[iam.md](../modules/iam.md)'
- '[auth-flow.md](../integrate/auth-flow.md)'
- '[cli-commands.md](../observe/cli-commands.md)'
- '[manage-permissions.md](../../subskills/manage-permissions.md)'
- '[install-mcp.md](../../subskills/install-mcp.md)'
- '[shared-cloud-client-permission-groups.md](../synthetic/shared-cloud-client-permission-groups.md)'
---

# IAM Authorization Preflight

Use this reference before wiring or debugging any AGS API call from a game, game server, backend service, or trusted tool.

## Caller Authorization Rule

Classify the caller before choosing credentials or writing code:

| Caller | Token source | IAM client rule | Secret rule |
|---|---|---|---|
| Game client | Authenticated player's user access token | Public IAM client is used for login/bootstrap; AGS module calls use the user token | Never store a client secret in the game client |
| Game server / backend / trusted tooling | Service/server token from backend credentials | Use a Confidential IAM client with the required client permissions | Store the client secret only in server-side config or secret storage |
| Web app / admin UI | User access token through the web flow, usually PKCE | Public client for user-facing web flows; admin tooling may need a higher-trust configured client depending on the operation | Do not expose a client secret to the browser |

If a game server, backend service, CI job, or trusted tool is configured with a Public client for AGS API calls, stop before implementation. Route to `/ags connect-portal` or the Admin Portal owner to select or create a Confidential client.

If a game client request appears to require a client secret or client-credentials token, stop and reclassify the caller. That path belongs in a server-side component.

### Tokenless Public-Client Gate

A Public IAM client may make a resource/API call only with a player's user access token attached. The single exception is the login / token-minting call itself — that is how the user token is obtained, so it legitimately runs with no user token yet.

If any other AGS call is about to go out over a Public client with no user token — for example a display-name, profile, or any cross-player lookup — stop before implementation and reclassify the caller:

- If a player is logged in, the fix is to attach that player's user access token. This stays a Public-client path; the bug was the missing token, not the client kind.
- If there is no logged-in user context (backend enrichment, tooling, server-side lookup), the call belongs on a Confidential client with the required permission. Route to `/ags connect-portal`.

Do not reflexively "switch to Confidential" for every tokenless Public-client call — route by whether a logged-in user exists. A tokenless Public-client resource call is never correct as-is; it is always either a missing user token or a misclassified caller.

## Environment Detection

Detect the deployment model before reporting any permission, because the required answer format differs:

- For game projects, start from the project's runtime config rather than memory or CLI defaults. For Godot, read `project.godot`; for Unreal, read `Config/DefaultEngine.ini` and the AccelByte SDK settings; for Unity, read the AccelByte SDK config asset/json if present; for Web/custom projects, read `.env` or the app config.
- Use AGS CLI profile/config as supporting evidence for the active operator target. If project config and CLI profile point at different base URLs or namespaces, stop before permission mapping and report the mismatch.
- **Shared Cloud** — the AGS base URL contains `gamingservices.accelbyte.io` (e.g. `https://prod.gamingservices.accelbyte.io` or `https://{studio_namespace}.prod.gamingservices.accelbyte.io`). IAM client permissions are exposed as predefined module/group entries, so the answer must be in permission-group format (module / group / `groupId` / actions) — not a bare resource string.
- **Private Cloud / BYOC** — any AGS base URL *not* on `gamingservices.accelbyte.io`. These run on a customer-managed host, which may be a fully custom domain or an `{environment_name}.accelbyte.io` host — so detect this branch by exclusion, not by matching a fixed pattern. Permissions are free-form resource strings, so the discovered resource permission and action *is* the final answer.

The URL is a fast heuristic, and only the `gamingservices.accelbyte.io` marker is reliable — a non-matching host alone does not prove Private Cloud, since custom domains vary. The authoritative check is behavioral: run `ags iam client-config list-permissions --exclude-permissions false --output -`. If it returns a grouped catalog, treat the environment as the Shared Cloud permission-group model regardless of hostname. If the host is not on `gamingservices.accelbyte.io` and the catalog command is unavailable, report the environment as unknown rather than guessing the format.

## Permission Discovery Step

Before implementation or diagnosis, produce an authorization preflight:

1. Identify the caller type.
2. Identify the SDK method or REST endpoint for every AGS API call the flow will make. Include secondary lookups such as user profile, display name, entitlement, or statistic readback calls.
3. Discover the generated command/API metadata and required permission rather than guessing service/resource/method names. Two equivalent discovery paths:
   - **AGS CLI** — follow `../observe/cli-commands.md`: `ags describe` first, generated command `--help` only as a fallback, `--skeleton`, `--dry-run`, and JSON output.
   - **AGS API MCP server** — when it is configured for this environment, its `search-apis` and `describe-apis` tools return the matching operation and its auth requirements straight from the live API spec, with no local CLI install. See `../../subskills/install-mcp.md`.
4. Verify the configured IAM client or user-token flow can access those operations. For Confidential clients, check the client has the required permission. For game-client calls, check the Public client/login flow can issue the player token used by the SDK and that the user-token call is expected for that API.
5. If neither the CLI nor the MCP server exposes permission metadata for the operation, say that explicitly and fall back to official docs, SDK/OpenAPI references, or AccelByte support. Do not invent permission strings.
6. If required permission is missing or uncertain, stop before code edits and report the exact permission or evidence gap. To remediate a confirmed gap on an existing client, route to `/ags manage-permissions` (add/update/delete a client permission via the CLI or MCP server). For a missing client or first-time namespace setup, route to `/ags connect-portal`.

Prefer a live discovery path — AGS CLI or the AGS API MCP server — because both track the actual API shape for the target environment. Do not hardcode permission strings from another AGS version or from memory when either can discover them.

## Shared Cloud Permission Group Discovery

This step applies only when Environment Detection resolves to **Shared Cloud**. In Private Cloud / BYOC the discovered resource string is the final answer and there is no group to map to.

Shared Cloud IAM client permissions are exposed as predefined module/group entries rather than free-form private-cloud resource strings. After discovering the required resource permission with `ags describe`, use the IAM client configuration catalog to map that resource to the Shared Cloud group shown in the Admin Portal:

```sh
ags iam client-config list-permissions --exclude-permissions false --output -
```

Follow `../synthetic/shared-cloud-client-permission-groups.md` for the observed catalog shape, action bit mapping, and ambiguity handling. That detail is synthetic because it is based on CLI/API discovery rather than public documentation.

## Output Shape

Include this block in AGS game-flow plans, backend-only plans, and permission-related diagnosis:

```text
Authorization preflight

  Caller:                <game client | game server | backend service | trusted tool | web app/admin UI>
  Environment:           <shared cloud | private cloud | unknown>
  Environment evidence:  <project config path/value, CLI profile/config, catalog behavior, or mismatch>
  Token source:          <user access token | service/server token | unknown>
  IAM client type:       <public | confidential | unknown>
  Secret location:       <none | server-side config/secret store | unsafe/exposed | unknown>
  AGS calls:             <SDK methods or REST endpoints>
  Permission discovery:  <AGS CLI command/evidence, docs fallback, or gap>
  Required permissions:  <exact permissions or "not exposed by current CLI">
  Shared Cloud groups:   <module / group / groupId / actions; "N/A (private cloud)"; or "not checked">
  Verified access:       <yes | no | blocked>
```

## Common Failure Patterns

| Symptom | First authorization check |
|---|---|
| `401`, `403`, `insufficient_permission`, or forbidden API response | Token source, IAM client type, and required operation permission |
| Server-authoritative stat update fails | The caller must be a server/backend caller using a Confidential client with the required Statistics permission |
| Leaderboard UI only has `userId` but expects display name | Identify the display-name/profile lookup endpoint and verify its permission separately from the leaderboard query |
| SDK call works in a client build but fails in a dedicated server build | Dedicated server config may be using the wrong client kind or missing Confidential client permission |
| CLI command exists but returns an auth error | CLI session, target namespace, client kind, and permission for that generated command |

Do not treat a successful primary call as proof that secondary enrichment calls are authorized. For example, a leaderboard rank query and a display-name lookup can require different AGS calls and therefore separate permission checks.
