---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
- https://github.com/AccelByte/extend-helper-cli
see-also:
- '[cli-commands.md](../deploy/cli-commands.md)'
- '[slo.md](slo.md)'
- '[feature-flags.md](../cookbook/feature-flags.md)'
---

# Deploys and Rollouts

How to ship Extend app changes safely. The mechanics (`extend-helper-cli image-upload` + `deploy-app`) are covered in `references/deploy/cli-commands.md`; this reference covers the *operational* side: staging, gating, rollback, and what to do when a deploy goes wrong.

## The deploy primitive

`extend-helper-cli deploy-app` rolls new replicas into AGS for the target app. AGS manages the deploy lifecycle after deploy-app is called; the exact rollout mechanism is not publicly documented — treat as a black-box platform operation. The caller doesn't orchestrate it; the CLI call kicks it off.

Practically this means:

- **No built-in blue/green.** AGS controls the rollout; you don't get to point traffic at "the new version" while keeping "the old version" warm.
- **No built-in canary.** You can't say "5% of traffic to v2." See *Canary approximations* below.
- **No per-replica pinning.** You can't deploy to one replica and leave the others alone.

This is tighter than Kubernetes; the tradeoff is that AGS handles the infra, you handle the code.

## Staging vs. production — use separate namespaces

The fundamental safety mechanism: **do not deploy straight to the prod namespace.** Use a staging namespace that mirrors prod.

Target namespace is a deploy-time input — pass `--namespace` to `extend-helper-cli` (or set `AB_NAMESPACE` in the app's `.env`):

```bash
extend-helper-cli deploy-app --namespace staging --app matchmaking-override
extend-helper-cli deploy-app --namespace production --app matchmaking-override
```

Staging should:

- Use the same SDK version, image tag, and config as prod.
- Exercise the same data shapes (anonymized or fake, not production data).
- Get canary-quality traffic if possible (synthetic, or a friendly subset).

Stage first. Observe for at least a few minutes. Check logs and metrics. Then promote to prod.

## Environment promotion workflow

A reasonable flow for a small team:

1. Merge PR → CI builds and pushes image, tags commit.
2. CI deploys to staging namespace automatically.
3. Developer (or on-call) smoke-tests staging.
4. Manual approval (GitHub Actions `environment: production`, GitLab `when: manual`) → deploy to prod.
5. Monitor post-deploy for a set window (15 min typical). Rollback if metrics degrade.

For AAA with continuous deployment:

1. Merge PR → CI tests → staging deploy → automated canary tests.
2. If canary passes N minutes → auto-promote to prod with reduced batch size.
3. Monitor SLOs (see `references/production/slo.md`) — any breach triggers auto-rollback.

Pick the flow your testing rigor supports. Automated promotion without canary tests is how you ship a regression to every player.

## Canary approximations for AGS

Since AGS doesn't natively support canary:

**Option A: Parallel app.** Deploy the change as a second app (different `--app` name). Use AGS routing config (if available) to direct a fraction of calls to it. Clean up after validation.

- Works best for Service Extensions (route at ingress) and some Event Handlers (second consumer on the same topic, dedup on commit — note: Event Handler messaging internals, consumer group behavior, and dedup semantics are not publicly documented; treat this as an inferred pattern).
- Harder for Override — AGS picks one override per call; you can't easily fan out.

**Option B: Separate staging namespace.** Not quite canary — more "pre-prod." Good enough when the risk of staging ≠ prod is low.

**Option C: Feature flags in the handler.** Ship the new code path but gate it with a flag readable at runtime. Enable the flag for a subset (e.g., low-traffic realm, internal QA accounts) before rolling it out widely. See `references/cookbook/feature-flags.md` for how.

- Cheapest and most flexible. Doesn't need infra support.
- Code path complexity — the new path and old path coexist in the binary until cleanup.

## Deploy hygiene

Before running `deploy`:

- Tests green (unit + integration — see `references/test/integration.md`).
- SDK version pinned — no `@latest` surprises.
- Deploy flags reviewed (resources, replicas, env vars in `.env` and any `--env` overrides).
- Rollback plan known — which git ref is the current prod? Query the running image tag with `extend-helper-cli get-app-info --namespace {namespace} --app {app-name} --path /deploymentImageTag` (see `references/deploy/cli-commands.md`).

After running `deploy`:

- Watch logs for the first 60–120 seconds. Crashloops surface immediately.
- Check error-rate metric. A step-up at deploy time = regression.
- Sample a few real calls (or run a smoke-test script against staging/prod).
- Don't walk away for at least 10 minutes.

## Rollback

When something goes wrong, get back to the last-known-good state before debugging.

```bash
# Check history of prior builds/tags
git log --oneline -20

# Redeploy the prior image — typically:
# 1. Check out the last green commit
git checkout <last-good-sha>

# 2. Build and push (see references/deploy/cli-commands.md for exact flags)
extend-helper-cli image-upload --namespace <ns> --app <app-name> --image-tag <prior-tag>

# 3. Deploy the prior tag
extend-helper-cli deploy-app --namespace <ns> --app <app-name> --image-tag <prior-tag>
```

If you tag prod deploys with an image tag (recommended), you can skip `image-upload` for a rollback — just redeploy the previous tag. But the CLI's `deploy` flow may require the current image-upload image; verify by running `extend-helper-cli get-app-info --namespace {ns} --app {app} --path /deploymentImageTag` after deploy to confirm which version is live.

**How fast is a rollback?** Typical AGS rollout is minutes, not seconds. If your SLOs require second-scale recovery, pre-plan: stage two apps, or use feature flags so rollback is flipping a flag, not redeploying.

## Post-deploy verification

For each deploy, verify:

- **Crash rate.** Zero.
- **Error rate.** No step-up from pre-deploy baseline.
- **Latency.** P50/P99 within pre-deploy baseline.
- **Throughput.** Matches expected traffic (not dropping calls).

If any is off, rollback first — debug after the fire is out.

## Deploy-time risks you can design away

- **New env var not set in prod.** Handler crashes on first call. Mitigation: fail fast at startup if required env var missing; don't lazy-load.
- **Schema migration required before deploy.** New code expects a DB column that doesn't exist. Mitigation: migrations run *before* deploy, not in the handler.
- **SDK version mismatch with AGS.** Deploying a v2 handler against a v1-only AGS namespace. Mitigation: coordinate with AccelByte if upgrading across major versions.
- **Bigger image, slower cold start.** If image size balloons, cold-start warmup exceeds health-check tolerance. Mitigation: trim images; verify cold start in staging.

## Continuous deployment considerations

Auto-deploying every commit to prod works only if you have:

- **Fast, reliable tests.** A flaky test will eventually fail while a legit regression slips through.
- **Rollback automation.** Humans aren't watching every deploy; the system is.
- **SLO monitoring with alerting.** Something has to notice and halt the pipeline when things break.
- **Canary mechanism.** Flag-based, parallel-app, or similar. Without it, every deploy is a full-traffic experiment.

Most studios below AAA scale should *not* auto-deploy to prod. Auto-deploy to staging; require a human click for prod. The cost is a few minutes of latency; the benefit is preventing a full-player-base regression.

## Coordinating with AccelByte

Some changes — especially SDK major bumps or proto contract changes — require coordination with AccelByte support. See `references/upgrade/proto-changes.md#coordinating-with-upstream`. Don't deploy a v2 handler before confirming AGS has rolled v2.

## Deploy checklist (short form)

- [ ] Tests green, including integration.
- [ ] SDK / deps pinned, reviewed.
- [ ] Staging deploy + smoke test ran.
- [ ] Deploy flags / `.env` changes reviewed.
- [ ] Rollback plan known.
- [ ] On-call aware (or self is on-call).
- [ ] Monitoring open; baseline noted.
- [ ] `extend-helper-cli deploy-app` — watch first 2 min.
- [ ] Verify error/latency/throughput at T+5, T+15, T+60 min.
