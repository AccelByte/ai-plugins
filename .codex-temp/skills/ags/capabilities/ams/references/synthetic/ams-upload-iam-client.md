---
last-verified: 2026-05-26
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/upload-a-dedicated-server-build/
see-also:
- '[cli-commands.md](../cli-commands.md)'
- '[connect-portal.md](../../../../subskills/connect-portal.md)'
---

# AMS Upload IAM Client

Use this synthetic reference when preparing credentials for `ams upload`.

## Requirement

`ams upload` requires an IAM client in the target game namespace with permission to create/update AMS uploaded server images.

Minimum shape:

- Client kind: confidential or otherwise able to authenticate service-to-service with a secret.
- Namespace: same game namespace / AMS account target as the upload.
- Permission: exact resource `AMS:UPLOAD` with `Create` and `Update` actions. Do not use `NAMESPACE:{namespace}:AMS:UPLOAD`.
- Values needed by `ams upload`:
  - AGS host URL without `https://`
  - IAM client ID
  - IAM client secret, unless the user's environment uses another supported credential mechanism

Never print or commit the client secret. Prefer reading it from a local ignored file, secret manager, or environment variable.

## Q&A Checklist

Ask before building the upload command:

1. What AGS host should the upload target? Use host without `https://`, for example `mystudio.prod.gamingservices.accelbyte.io`.
2. What game namespace / AMS account is this image for?
3. Do you already have an IAM client for AMS upload?
4. Is the client confidential / server-side, and does it have exact `AMS:UPLOAD` Create + Update, not `NAMESPACE:{namespace}:AMS:UPLOAD`?
5. Where should I read the client ID and secret from without printing the secret?

If the user does not have the IAM client yet, route to `/ags connect-portal` or provide Admin Portal steps. Do not guess client IDs, secrets, scopes, or command bodies.

## AGS CLI Setup Path

An agent can help create or configure the upload IAM client with the AGS CLI when the CLI is installed, authenticated, and pointed at the intended environment. Use `/ags connect-portal` for this path when possible because it owns IAM client discovery/creation and secret-safe project config.

Rules for CLI-based setup:

1. Discover the command shape before mutating anything:

```bash
ags auth status --format json
ags describe iam
ags iam --help
ags iam clients --help
ags describe iam clients list
```

2. If creating or updating a client is needed, use `ags describe <service> <resource> <method>` and `--skeleton` / `--dry-run` when available to discover the exact request body. Do not hardcode guessed IAM command names or JSON fields.

3. Show the planned client config before running a state-changing command:

- namespace
- environment / base URL
- client kind: confidential / server-side
- permissions to add: exact `AMS:UPLOAD` Create + Update
- where the generated client ID/secret will be stored

4. Ask for explicit confirmation before creating the IAM client or changing permissions.

5. Do not create or modify production IAM clients unless the user explicitly confirms the target is production.

6. Capture/store the client secret without printing it. Add any local secret file to `.gitignore` when writing one.

If the AGS CLI does not expose IAM client creation or permission updates in the current environment, fall back to the Admin Portal setup below and stop before upload until the user confirms the client is ready.

## Admin Portal Setup

Manual setup shape:

1. Open the target game namespace in the Admin Portal.
2. Go to IAM / OAuth Clients.
3. Create or select a server-side/confidential IAM client for AMS upload automation.
4. Add permission `AMS:UPLOAD` with `Create` and `Update`. Do not prefix the resource with `NAMESPACE:{namespace}:`.
5. Store the client ID and secret in a secure local place used by the uploader workflow.

## Validation Before Upload

Before running `ams upload`, confirm:

- Target host and namespace are the intended environment.
- Client ID belongs to that namespace/environment.
- Client secret is available but not printed.
- Permission includes exact `AMS:UPLOAD` Create + Update, not `NAMESPACE:{namespace}:AMS:UPLOAD`.
- The upload is not accidentally using a public game-client IAM client.
