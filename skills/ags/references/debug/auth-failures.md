---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
see-also:
- '[iam.md](../modules/iam.md)'
- '[auth-flow.md](../integrate/auth-flow.md)'
- '[debug.md](../../subskills/debug.md)'
- '[doctor.md](../../subskills/doctor.md)'
---

# Debug — Auth Failures

Common auth-error signatures and what they usually mean. Used by `subskills/debug.md` and `subskills/doctor.md` when an integration is failing on login or token-bearing API calls.

---

## Signature: 401 / "invalid_token" on any call

**Likely cause:** access token expired or revoked.

Check:

1. Is the SDK's token refresh logic firing? Check your SDK version's refresh window in the SDK docs — the pre-expiry interval varies by version.
2. Did the player explicitly log out? Logout revokes the refresh token AGS-side; subsequent calls fail.
3. Is the token's `exp` claim sane? Decode the JWT (middle segment, base64) and check.

Fix: usually re-trigger login. If token refresh isn't firing, that's an SDK config bug — check the SDK version and refresh callback wiring.

## Signature: 401 / "invalid_namespace" or namespace mismatch

**Likely cause:** using a token issued for one namespace against a different namespace's API.

Check:

1. Decode the JWT, look at the `namespace` claim.
2. Compare against the namespace the failing API call targets.
3. Common scenario: a dev build pointing at a prod namespace URL (or vice versa).

Fix: align the namespace URL the SDK is configured with against the IAM client's namespace. This is almost always an env-config mismatch.

## Signature: 401 on first-ever call after login

**Likely cause:** wrong IAM client kind. A public IAM client is being used in a server context (or vice versa), so the token type AGS issued isn't valid for the call.

Check:

1. Confirm whether the build is a game client (public IAM client) or a dedicated server (confidential IAM client + secret).
2. Confirm the client ID / secret config matches.

Fix: switch to the correct IAM client for the build target. **Never** ship a confidential client secret in a game-client build.

## Signature: 400 / "invalid_request" on login

**Likely cause:** the requested login method is not enabled, not implemented, or not configured for this namespace/IAM client. This is backend IAM/login-method configuration, not automatically a C++/Blueprint integration bug.

This is the common case when:

1. The project builds with `OnlineSubsystemAccelByte` / SDK modules.
2. The game has an SDK/OSS login entry point for a specific method (Device ID, platform login, email/password, etc.).
3. `DefaultEngine.ini` / `.env` has real-looking AGS values.
4. Runtime login reaches AGS but returns HTTP 400 `invalid_request`.

Check backend state before editing game code:

1. Confirm the configured IAM client is a **public** game-client IAM client.
2. Confirm the game namespace matches the SDK config.
3. Identify the exact login method the game attempted.
4. Confirm that login method is enabled/implemented for the namespace or IAM client, depending on the current AGS API shape.
5. Use the AGS CLI to discover the exact command surface:

```bash
ags auth status --format json
ags describe iam
ags describe iam clients list
ags iam clients list --namespace <namespace> --format json
```

Then inspect login-method, identity-provider, platform, or namespace auth-settings resources if the generated CLI exposes them. Use `ags describe` and `--skeleton` / `--dry-run` where available before mutating anything.

Fix: route to `/ags connect-portal`. That subskill owns creating/selecting the public IAM client, enabling the required login method when exposed by the CLI, and writing real `.env` / `DefaultEngine.ini` values. Do **not** add more client-side guard code as the primary fix once the build and login call path are already correct.

### Platform credential runbook

Use this when Unreal/Unity reaches AGS and login returns HTTP 400 `invalid_request` with a platform-config error such as "platform client not found".

First hypothesis: the attempted platform/login method is not enabled or configured in IAM. Identify the exact AGS platform ID from the SDK/OSS login path or CLI shape, such as `device`, `steam`, `epicgames`, `psn`, or `xbox`.

Do **not** rely on:

```bash
ags iam platform-credentials check-availability --platform-id <platform-id>
```

That check can be a supportability/availability check rather than proof that the namespace has a configured credential. For `device`, it can report "third-party platform not supported" and mislead the agent. Check the actual platform credential config directly:

```bash
ags iam platform-credentials get --namespace <namespace> --platform-id <platform-id> --format json
ags iam platform-credentials list --namespace <namespace> --format json
```

If the platform credential is missing, the portal-equivalent action is:

`Game Setup > 3rd Party Configuration > Auth & Account Linking > Add New > <Platform> > fill required platform fields > Active`

For Device, the required fields usually include `Redirect URI http://127.0.0.1`.

If the user approves a CLI mutation, discover the exact create command and body first:

```bash
ags describe iam platform-credentials create
```

Use `--skeleton` if available. Do not reuse the Device body for every platform; other platforms usually require their own fields, such as client ID, client secret, app ID, environment, or issuer values.

Device minimal body example (verify required fields first via `ags describe iam platform-credentials create --platform-id device --skeleton` — the Device ID provider docs don't list `RedirectUri` as a required field, so this body may differ from what your AGS version expects):

```json
{
  "RedirectUri": "http://127.0.0.1",
  "IsActive": true
}
```

On PowerShell, write the body to a JSON file and pass it with `--json @file` to avoid quoting failures. After mutation, verify:

```bash
ags iam platform-credentials get --namespace <namespace> --platform-id <platform-id> --format json
```

Then rerun the SDK/OSS login smoke test.

## Signature: 403 / insufficient scope / "permission denied"

**Likely cause:** the token doesn't have the scope the API requires.

Check:

1. The scopes assigned to the IAM client in the Admin Portal.
2. The scope claims in the JWT.
3. The required scope per the AGS API documentation.

Fix: enable the missing scope on the IAM client (Admin Portal). Re-authenticate to mint a token with the new scopes.

## Signature: platform-credential failures (Steam ticket invalid, PSN auth failed, etc.)

**Likely cause:** platform credential is expired, revoked, or never reached AGS in the right shape.

Check:

1. Is the platform-side login itself succeeding? Try the platform's own SDK independently of AGS.
2. Is the credential being passed to AGS in the form AGS expects? (Steam wants the auth ticket obtained via GetAuthTicketForWebApi; PSN wants the auth code; etc.)
3. Time skew on the device — Steam tickets are time-sensitive.

Fix: depends on which side is broken. Platform-side failures are platform-side fixes; AGS-side failures usually mean credential format mismatch.

## Signature: 5xx on auth endpoint

**Likely cause:** AGS-side incident or rate-limit.

Check:

1. AccelByte status / Admin Portal for incident notifications.
2. Volume of auth attempts — rate-limits exist; a stuck retry loop can trip them.

Fix: stop the retry loop, wait, retry with backoff. Open a support ticket if the issue persists beyond minutes.

## When to escalate

- Repeated 5xx with no platform-status incident → AccelByte support.
- Auth working in dev but failing in prod (after env review) → check the prod Admin Portal IAM client config; common to find a misconfigured production client.
- Player-reported auth issues that don't reproduce internally → use IAM's real-time auth debugging tooling (per `references/modules/iam.md`).
