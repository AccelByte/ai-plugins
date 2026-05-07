---
last-verified: 2026-05-07
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[overview.md](overview.md)'
- '[glossary.md](glossary.md)'
- '[cli-commands.md](deploy/cli-commands.md)'
---

# AGS Extend FAQ

Questions developers actually ask before, during, and after building with Extend. For the three-pattern mental model and architecture details, see `overview.md`.

## Scope and fit

### Who is Extend for?

Teams already on AGS who need backend behavior the platform doesn't cover out of the box — custom matchmaking logic, event-driven automation, entirely new services — and who don't want to run their own cloud infrastructure alongside AGS.

Not for: teams replacing AGS entirely; teams who need something before they're on AGS; teams whose logic has nothing to do with AGS (run a normal backend — Extend's value is the tight AGS integration).

### When should I use Extend vs. a configuration option?

Configuration first. If an AGS feature flag or setting solves the problem, use that — it's free, doesn't need custom code, and AccelByte maintains it. Extend is for when you've hit the edge of what configuration can do.

### When should I use Extend vs. my own backend?

Use Extend when the logic is about customizing or extending what AGS does. Run your own backend when you need complete isolation from AGS, or the logic has nothing to do with AGS.

Practical differences:

| | Extend | Your own backend |
|---|---|---|
| Auth with AGS | Automatic — identity injected on every call | Manual — you validate JWTs yourself |
| AGS event subscriptions | Delivered automatically via Kafka Connect | Poll AGS APIs, or run a webhook listener |
| Infrastructure | AccelByte manages it | You manage it (k8s, networking, scaling, uptime) |
| Latency to AGS APIs | Low — same network | Higher — crosses the public internet |
| Deployment | Docker + `extend-helper-cli` | Your own CI/CD + cloud infra |
| Compute billing | Part of your AGS enterprise contract | Your cloud provider |
| Observability | Grafana provided by AccelByte | Whatever you wire up |
| Isolation from AGS | Shared namespace infrastructure | Fully isolated |

### Can I use Extend for something that doesn't touch AGS at all?

Technically yes — Extend runs arbitrary code. But you'd be getting AGS auth, event delivery, and infra management for a workload that doesn't use any of them. Run a plain backend instead; the tight AGS coupling is the whole point of Extend.

### Can I use multiple patterns in the same project?

Yes. Patterns compose. See `overview.md#combining-patterns` for common combinations. Each pattern is a separate Extend app — its own directory cloned from a template, with its own Dockerfile, `.env`, and deploy invocation. A "multi-pattern project" is just multiple of those directories side by side in one repo; there's no single manifest tying them together.

---

## Cost and timeline

### How much does Extend cost?

Extend is part of AGS enterprise plans. Compute for your apps is provisioned within the AGS contract — no separate per-function pricing. Cost depends on contract tier and total compute footprint; contact AccelByte for specifics.

This skill doesn't cover pricing numbers. For anything beyond "included in the enterprise contract," contact AccelByte directly.

### How long does it take to build one?

Rough estimates for a developer already fluent in the language (code-only; infra setup is handled by AccelByte):

| Pattern | Simple | Complex |
|---|---|---|
| Event Handler | 1–2 days | 3–5 days |
| Extend Override | 2–3 days | 1–2 weeks |
| Service Extension | 1 week | 4–8 weeks |

Simple = one handler/method, no external deps. Complex = multiple handlers, non-trivial business logic, third-party integrations.

The wizard + patches in this skill trim the first half-day of scaffold work from these estimates.

---

## Limits that bite

### Hard request size (4.5 MB)

HTTP request bodies over 4.5 MB are rejected at the ingress. For large uploads (screenshots, player-generated content, logs), use a two-step pattern: Service Extension issues a signed URL to your own object store, the client uploads directly, then notifies your service. Don't pipe multi-MB blobs through Extend.

### Log retention (30 days)

Grafana Cloud log retention is 30 days. (The `extend-helper-cli` does NOT have a logs subcommand — see `references/observe/cli-commands.md`.) For audit, compliance, or long-term post-mortem, forward logs to an external sink (whatever you already use — S3, Datadog, ELK). Architect that in from day one if you expect to need it.

### Metrics retention (13 months)

Good enough for SLO tracking and seasonal comparisons within a year. If you need 2+ year trending, export to your own metrics stack.

### Max replicas (60 per app, any type)

Plenty for most games, but if you're running something serving the whole player base synchronously (like an Override on matchmaking at scale), do the math on peak RPS before you ship. Design handlers to be fast (Override especially — AGS is blocked on you) so you don't need headroom you can't get.

### Override latency is AGS latency

An Override's execution time is added directly to the AGS call that triggered it. Slow handlers make AGS look slow. Keep Override code tight — database lookups, external API calls, and heavy compute inside an Override all show up as matchmaking/login/inventory latency to players. Event Handler or Service Extension is the right home for anything that doesn't need to be on the critical path.

### Resource limits differ by pattern

Override and Service Extension can go higher (up to 1415m CPU / 2382 MB memory). Event Handler caps lower (1215m / 1358 MB). Plan accordingly — see `references/init/resource-defaults.md` for the full table.

---

## Local vs. production gotchas

### Local test works, production fails immediately

Most common causes:

1. **Credentials.** `.env` locally has real values; the deployed app's env is empty or placeholder. Check `AB_CLIENT_ID` / `AB_CLIENT_SECRET` in the Admin Portal's app config (not just in your local `.env`).
2. **Permissions.** The OAuth client has dev-namespace permissions but not prod-namespace permissions. Recreate or extend the IAM client for the target namespace.
3. **Config drift.** Local `docker-compose` brings up a mongo/redis container; production uses managed DocumentDB/ElastiCache with different connection strings and TLS requirements. Patches in this skill account for this (see `references/patches/nosql-go.md` for the TLS branch).

### Events fire locally but not in production (Event Handler)

Event delivery isn't automatic for every environment. Confirm your event subscriptions are configured in the target namespace's Admin Portal, not just in dev. Event subscriptions don't propagate across namespaces.

### Override works in dev but isn't being called in production

The Admin Portal registers override endpoints per namespace. Deploying the app to production doesn't automatically route AGS's internal calls to it — you (or an ops person) must register the override against the specific service + override point in the production namespace.

### ngrok-based local testing stops working

ngrok's free tier rotates URLs. For sustained local Override testing, either re-register the ngrok URL in the Admin Portal when it rotates, or use a paid ngrok reserved subdomain.

---

## Credentials and permissions

### What IAM client do I need?

A confidential IAM client in the Admin Portal, with permissions appropriate to what your app calls. Minimum common set: read `namespace` info, read/write whatever AGS resources the handler touches. Lock it down — don't give an Extend app admin-level permissions just to avoid "permission denied" errors during development.

### Per-app or shared client?

Per-app, typically. If one app's credentials are compromised, you want to rotate only that one. Each app has its own `.env` with its own `AB_CLIENT_ID` / `AB_CLIENT_SECRET`, and you provision a separate OAuth client per app in the Admin Portal with just the permissions that app needs.

### `AB_CLIENT_ID` / `AB_CLIENT_SECRET` in `.env` — is that safe?

`.env` should not be committed. The template repos include `.env.template` (placeholder values) which *is* committed; your real `.env` stays local and also gets injected into the deployed app via the Admin Portal's environment settings, not via the image. Verify `.env` is in `.gitignore` before committing — it usually is in the templates.

---

## Deployment and updates

### How do I roll back a deployment?

`extend-helper-cli` doesn't ship a one-command rollback. To revert: redeploy a previous working image, which means either (a) keeping an older tag image-uploaded and deploying that tag again, or (b) checking out the previous commit and re-running `image-upload` + `deploy`. The observable "deploy" step in AGS is what matters — old images are retained up to the per-app image limit.

### Does a new deploy mean zero downtime?

AGS rolls new replicas before stopping old ones. For Service Extension with REST traffic, callers get continuous service. For Override, callers experience a brief window where some calls may go to either version; design your override contract to be tolerant of version skew. Event Handler is easiest — events queue; they'll drain once the new version is up.

### My deploy is stuck in `Deploying` for 10 minutes

Usually one of: image is large and registry pull is slow, resource request exceeds what's available on the namespace VM, or health check is failing so AGS won't promote replicas. Run `extend-helper-cli get-app-info --namespace <ns> --app <app-name>` and look at the app status. Check logs via Grafana Cloud (Admin Portal → app detail → Open Grafana Cloud). If the app is still stuck after 15 minutes, something is genuinely wrong — escalate to AccelByte support with the namespace and app name.

---

## Tooling and IDE

### Do I need the Extend MCP servers?

Not strictly. They're optional. Two servers:

- `ags-api` exposes AGS resources (players, namespaces, entitlements) to your IDE — useful when developing handlers that need to know AGS data shapes.
- `ags-extend-sdk` loads the Extend SDK for your language as context — useful for AI-assisted code generation.

Install with `/ags-extend install-mcp` if your IDE supports MCP.

### Can I develop in a devcontainer?

Yes. The template repos ship with `.devcontainer/` configs. Extend apps are "just Go/Python/Java/C#" until deploy, so anything your language's tooling supports works.

### Can I pair `extend-helper-cli` with CI/CD?

Yes. `image-upload` and `deploy-app` are scriptable. Set `AB_CLIENT_ID`, `AB_CLIENT_SECRET`, and `AB_BASE_URL` as CI environment variables (secrets); invoke the CLI in a pipeline step the same way you would locally. The CLI authenticates via these environment variables automatically — there is no separate login step. See `references/ci/github-actions.md` and `references/ci/gitlab.md` for ready-made pipeline templates.

---

## Not covered by this skill

For the following, check AccelByte's official docs or contact support:

- Exact SDK method signatures (check the template's proto files or the SDK README)
- Admin Portal click-paths (the docs have walkthroughs with screenshots)
- Pricing / contract tier specifics
- Roadmap and unreleased features
- Infrastructure-level incidents on AccelByte's side
- Per-customer permission policies
