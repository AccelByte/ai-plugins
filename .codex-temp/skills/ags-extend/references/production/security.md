---
last-verified: 2026-05-07
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
- https://github.com/AccelByte/extend-helper-cli
see-also:
- '[github-actions.md](../ci/github-actions.md)'
- '[gitlab.md](../ci/gitlab.md)'
- '[sdk-bumps.md](../upgrade/sdk-bumps.md)'
- '[rollout.md](rollout.md)'
---

# Security for Extend Apps

Security concerns specific to Extend. General application security (input validation, TLS, SQL injection) still applies; this reference focuses on what's different because AGS hosts the code.

## The secrets you have to care about

An Extend app typically holds:

- **IAM client credentials** (`AB_CLIENT_ID`, `AB_CLIENT_SECRET`) — the app's identity to AGS.
- **`extend-helper-cli` login creds** — deployer identity. Held in CI secrets, not in the repo.
- **Any external API keys** your handler calls (game services, analytics, etc.) — your problem, not AGS's, but live alongside AGS creds.

Each has a different blast radius. Treat them accordingly.

## Secret storage — local vs. CI vs. runtime

Three places secrets flow through, each with different rules:

**Local dev:**

- Use a `.env` file at the app root.
- `.gitignore` must include `.env` (the scaffolded templates do; verify after `extend-helper-cli create-app`).
- Never commit `.env.example` with real values — the placeholder values should be obvious placeholders (`your-client-id-here`, not a format that looks real).

**CI (GitHub Actions, GitLab, etc.):**

- Use the CI's secret store: GitHub Actions `secrets.*`, GitLab CI/CD Variables (protected + masked).
- Never echo secrets in CI logs. Do not `echo $AB_CLIENT_SECRET` even for debugging. Use `::add-mask::` in Actions if a variable must be passed through.
- Limit which branches can access the secret. GitHub: restrict to `main` via environment protection rules. GitLab: mark "Protected" so only protected branches read it.

**Runtime (AGS-hosted):**

- AGS injects client credentials into the app at runtime. Do not embed them in the image.
- Do not log them. Scrub them from error paths.

See `references/ci/github-actions.md#secrets-and-environment` and `references/ci/gitlab.md#variables-and-secrets` for the CI-side mechanics.

## IAM client scoping (permissions)

Each Extend app authenticates as an IAM client. Grant it the minimum permissions needed.

Signs of over-permissioning:

- The client has "ADMIN" role or a role marked "all namespace actions."
- The client can call AGS endpoints your app never touches.
- The client has write access to resources your app only reads.

Fix by creating a dedicated role for the app, listing only the specific permissions its handler needs. This limits blast radius if credentials leak.

When auditing: list the AGS calls your app actually makes (`grep -rn 'sdk.Client'` or equivalent) and confirm the role's permissions match.

## Network boundary

Extend apps live inside AGS's cluster. Implications:

- **Ingress.** Override and Event Handler are not directly internet-facing — AGS is the only caller. Service Extensions expose HTTP/gRPC and may be reachable by clients depending on AGS routing config.
- **Egress.** Your handler can reach external services (databases, third-party APIs). AGS doesn't sandbox outbound. Apply your own allowlists at the app layer — don't assume "inside AGS" is a trust boundary for outbound.
- **Inter-app.** Extend apps in the same namespace can in principle talk to each other. The safer pattern is for each app to call AGS, which calls whatever else is needed.

## Input validation — still your job

AGS validates the gRPC / event shape, but semantic validation is the app's responsibility:

- **Field contents.** A `user_id` string that passes proto validation can still be an empty string, a UUID for a different region, or a SQL injection payload.
- **Rate limits.** AGS may or may not rate-limit calls to your handler; your DB or external dep likely has its own limits. Validate the caller's burst behavior.
- **Size limits.** AGS caps request size at 4.5 MB (from `overview.md#infrastructure`). Validate you handle pathological inputs within that — a 4 MB JSON payload is pathological but possible.

## Logging — what to log, what not to

Safe to log:

- Request IDs, correlation IDs, timing.
- User IDs (typically not PII on their own; treat per your privacy policy).
- Decision outcomes ("approved," "rejected," "deferred") without sensitive inputs.

Never log:

- Secrets (client ID/secret, API keys, JWT contents).
- Full request bodies in production. Log a hash or a shape-summary if you need proof-of-receipt.
- PII beyond what your privacy policy permits.

Log retention is 30 days on AGS (from `overview.md#infrastructure`). Don't rely on logs as a long-term audit trail — export to your own S3/BigQuery/etc. if regulatory.

## Secret rotation

Credentials rotate because they leak, because they age, or because you're audited. Plan for rotation:

- **IAM client secret.** Rotate via AGS admin portal. Update CI secret store. Redeploy.
- **External API keys.** Rotate at the provider, update CI, redeploy.

Because AGS doesn't support zero-downtime secret updates at the manifest level, rotation usually means a redeploy with the new secret injected. Brief outage window; plan for low-traffic hours.

## Dependency / supply-chain hygiene

SDK bumps pull in transitive dependencies (see `references/upgrade/sdk-bumps.md#transitive-dependencies`). Each is a supply-chain risk.

- **Dependabot / Renovate** for automated bump PRs, gated on CI passing.
- **Vulnerability scans.** `go list -json -m all | nancy`, `pip-audit`, `./gradlew dependencyCheckAnalyze`, `dotnet list package --vulnerable`. Wire into CI.
- **Pin exact versions** in manifests; avoid wildcards that drift silently.

## What AGS handles vs. what you handle

| Concern | AGS | You |
|---|---|---|
| TLS on ingress / egress | ✓ | — |
| Image signing | varies — confirm | Ensure if required |
| IAM token issuance | ✓ | — |
| IAM role assignment | — | Define least-privilege role |
| Secret at rest | ✓ (injected at runtime) | Don't bake into image |
| Secret at build time | — | CI secret store |
| Input validation | shape only (proto) | semantic |
| Egress allowlist | — | App layer |
| Log redaction | — | App code |
| Audit of handler logic | — | Code review |

When in doubt, treat anything that touches your handler's code, config, or runtime state as "your responsibility" and anything that crosses the AGS boundary as "AGS's."

## Common mistakes

- **Secret committed to git history.** Even if removed, it's in the log. Rotate the secret; `git filter-repo` is secondary.
- **`.env` in Docker image.** Don't `COPY .env` at build time. Inject at runtime.
- **Secrets echoed in CI logs.** Public repos: public leak. Private repos: still visible to everyone with repo access.
- **IAM client with wildcard role.** Least privilege is not optional.
- **Logging the entire request.** Great for debug, terrible in prod.

## When a leak happens

1. **Rotate immediately** — don't wait for an investigation.
2. **Redeploy** with the new secret.
3. **Audit logs** for the leak window: anything done with the compromised credential.
4. **File an incident report** — `references/production/rollout.md` has incident-response pointers for deploy-related issues; for credential leaks, follow your internal security process.
5. **Post-mortem** on how the leak happened. Fix the class of bug, not the instance.
