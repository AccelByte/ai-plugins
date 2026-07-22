---
last-verified: 2026-07-21
sources:
- https://github.com/AccelByte/ags-api-mcp-server
see-also:
- '[ags install-mcp.md](../../ags/subskills/install-mcp.md)'
- '[ags doctor.md](../../ags/subskills/doctor.md)'
- '[ags-extend install-mcp.md](../../ags-extend/subskills/install-mcp.md)'
- '[ags-extend doctor.md](../../ags-extend/subskills/doctor.md)'
- '[auth-failures.md](../../ags/references/debug/auth-failures.md)'
- '[iam-authorization-preflight.md](../../ags/references/security/iam-authorization-preflight.md)'
---

# Recovering from an Invalid Cached MCP Client

Single source of truth for one failure mode: an MCP client cached an IAM client ID created through Dynamic Client Registration (DCR), and that IAM client no longer exists on the authorization server. Routed from the `install-mcp` subskills (setup-time auth check and recovery) and `doctor` subskills (symptom-to-cause diagnosis) of both the `ags` and `ags-extend` skills.

Applies to AccelByte MCP servers: the **AGS API MCP server** (`ags-api`) and the **Extend SDK MCP server**. Do not generalize these steps to other OAuth failures — reach the recovery action only after the evidence below points at a stale registration, not any time sign-in fails.

## What happens

MCP clients that use DCR cache the IAM client ID they registered, keyed by server URL, and reuse it across token refreshes and reauthentication. If an administrator manually removes that IAM client, or a future inactive-client cleanup job removes it, the cached registration becomes invalid. The client keeps reusing the deleted client ID and authentication fails *before* a fresh DCR registration is ever attempted. The client does not automatically start a new DCR flow — the stale local state has to be cleared first.

## Recognize the symptom

Treat stale MCP authentication state as a supported hypothesis when the evidence fits. Look for:

- An **"invalid client ID"** or **"client ID not found"** error at sign-in.
- IAM's generic **"Invalid Request"** page during MCP authentication — it may mention an invalid redirect URI, client ID, or target path, and it does not name the cause.
- Authentication that **worked before** but began failing **after** the IAM client was manually removed or cleaned up.
- Repeated reuse of a **known stale client ID** across retries — the same client ID keeps appearing in the failing flow.

The IAM error page is generic, so a single "Invalid Request" is a clue, not proof. Confirm with the surrounding evidence (previously working, client since removed, same stale ID reused) before acting.

## Distinguish token expiry from a missing client registration

This is the pivotal distinction. **Do not prescribe clearing authentication for an ordinary token refresh failure** — that discards a still-valid registration for no reason and forces an avoidable sign-in.

| | Expired access token (refresh / re-auth succeeds) | Missing / invalid cached DCR client |
|---|---|---|
| Client ID | Still valid — refresh or reauthorization against the **same** client ID works | Deleted — no longer exists |
| Recovery path | Silent refresh or reauthorize against the **same** client ID | Must clear the cached registration and run DCR **again** |
| Typical signal | `401` / `invalid_token`; clears on re-auth | "invalid client ID" / "client ID not found" / `invalid_client` / generic "Invalid Request" at sign-in |
| Was it working before? | Usually a live session that aged out | Worked before, broke after the IAM client was removed |

A plain expired token proves nothing about the client on its own: **token expiry alone leaves client validity unknown.** So try a normal refresh / re-authorization first, and only escalate to the stale-registration path when invalid-client evidence actually appears.

That said, a refresh or authorization *failure* is not automatically ordinary expiry. If the token or authorization endpoint returns `invalid_client`, or names an unknown or invalid client ID, that **is** invalid-client evidence — treat it as the stale-registration path, not as a token refresh problem. If the only evidence is a `401 invalid_token` that clears on re-auth, **do not claim the IAM client was deleted**; route it through `../../ags/references/debug/auth-failures.md` (Signature: 401 / "invalid_token") instead.

## Explain the effect before recommending it

State this before recommending any clear/logout action, so the user knows what they are agreeing to:

> Clearing authentication removes the **local OAuth state** — the cached client registration and tokens — for this one MCP server. It triggers a fresh DCR registration and requires you to sign in again. It does **not** remove or re-add the MCP server, and it is scoped to this server only.

## Recovery by client

Clear the cached authentication for the affected AccelByte MCP server, then sign in again:

- **Claude Code:** run `/mcp`, select the affected server (`ags-api` or the configured Extend SDK MCP server), and choose **Clear authentication**. Then reconnect (via `/mcp` or by restarting the IDE) to trigger a new sign-in and a fresh DCR registration.
- **Codex:** run `codex mcp logout <server-name>`, then `codex mcp login <server-name>`. For the AGS API MCP's standard name, that is `codex mcp logout ags-api`, then `codex mcp login ags-api`.
- **`mcp-remote` clients:** the cached registration lives under `~/.mcp-auth/`. See the AGS API MCP `README.md` troubleshooting FAQ for clearing it — note that clearing that cache signs you out of **every** `mcp-remote` server, not just this one.

Do **not** tell the user to reinstall or remove the MCP server, and do **not** wipe all MCP credentials globally unless the client offers no way to clear a single server on its own.

## Confirm recovery

After the user signs in again, a fresh DCR registration is created and access is restored. Confirm by running one lightweight read-only MCP call (capability discovery or a harmless read).

If it still fails, check *which* client ID is now in use before concluding. If the **same** stale client ID is still being reused, the clear/logout did not take effect (or the cached state lives somewhere else) — retry the clear for that server. Only when a genuinely **new** client ID has been registered and sign-in still fails is the cause something other than stale local state; re-diagnose via `../../ags/references/debug/auth-failures.md`.

## Reference

The AGS API MCP server documents the same recovery in its troubleshooting FAQ, which stays the source of truth for server-side behavior: [Authentication fails with "Invalid Request", "invalid client ID", or "client ID not found"](https://github.com/AccelByte/ags-api-mcp-server#authentication-fails-with-invalid-request-invalid-client-id-or-client-id-not-found).
