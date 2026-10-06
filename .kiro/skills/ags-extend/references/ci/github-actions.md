---
last-verified: 2026-09-23
note: Canonical GitHub Actions workflow for Extend build + deploy. In CI, the CLI
  authenticates via `ags auth login --grant client-credentials`, reading AGS_CLIENT_ID,
  AGS_CLIENT_SECRET, and AGS_BASE_URL environment variables (non-interactive). Commands
  verified against the `ags` binary --help output (see references/deploy/cli-commands.md,
  the authoritative syntax reference).
sources:
- https://github.com/AccelByte/accelbyte-ags-cli
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[gitlab.md](gitlab.md)'
- '[cli-commands.md](../deploy/cli-commands.md)'
- '[rollout.md](../production/rollout.md)'
---

# GitHub Actions — Extend Deploy Workflow

Consumed by `subskills/ci.md`. Two shapes: full pipeline (test → build → deploy) and minimal deploy-only (when tests already run elsewhere). Default to the full pipeline.

## Required repository secrets

The workflow expects these in Settings → Secrets and variables → Actions:

- `AGS_CLIENT_ID` — IAM client ID from the Admin Portal
- `AGS_CLIENT_SECRET` — IAM client secret
- `AGS_BASE_URL` — AGS base URL, e.g. `https://your-env.accelbyte.io`
- `AGS_NAMESPACE` — target namespace

Mask the secret values in the GitHub UI (automatic for anything added via the secrets page).

## Minimal viable workflow — Go Service Extension

```yaml
name: Extend deploy

on:
  workflow_dispatch:
    inputs:
      namespace:
        description: "Target namespace"
        required: true
        default: "my-studio-dev"
  push:
    branches: [main]
    paths:
      - "matchmaking-override/**"
      - ".github/workflows/extend-deploy.yml"

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: matchmaking-override
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.24"
      - run: go mod download
      - run: go build ./...
      - run: go test ./...

  image-upload:
    needs: test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: matchmaking-override
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.24"
      - name: Install ags
        run: |
          # 0.5.0+ publishes accelbyte-ags-cli-<target>.tar.xz, extracting into a
          # directory named after the archive (not the archive root). Resolve the
          # asset name from release metadata rather than hardcoding it — `jq` is
          # preinstalled on GitHub-hosted runners.
          asset=$(curl -fsSL https://api.github.com/repos/AccelByte/accelbyte-ags-cli/releases/latest \
            | jq -r '.assets[].name | select(test("^accelbyte-ags-cli-x86_64-unknown-linux-gnu\\.tar\\.xz$"))')
          curl -fsSL "https://github.com/AccelByte/accelbyte-ags-cli/releases/latest/download/${asset}" -o /tmp/ags.tar.xz
          tar -xJf /tmp/ags.tar.xz -C /tmp
          chmod +x "/tmp/${asset%.tar.xz}/ags"
          sudo mv "/tmp/${asset%.tar.xz}/ags" /usr/local/bin/ags
          command -v ags && ags --version
      - name: Build and push
        env:
          AGS_BASE_URL: ${{ secrets.AGS_BASE_URL }}
          AGS_NAMESPACE: ${{ inputs.namespace || secrets.AGS_NAMESPACE }}
          AGS_CLIENT_ID: ${{ secrets.AGS_CLIENT_ID }}
          AGS_CLIENT_SECRET: ${{ secrets.AGS_CLIENT_SECRET }}
        run: |
          ags auth login --grant client-credentials
          ags extend image-upload \
            --namespace "$AGS_NAMESPACE" \
            --app matchmaking-override \
            --image-tag "${{ github.sha }}" \
            --login

  deploy:
    needs: image-upload
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    environment: production   # uses GitHub's environment-protection rules
    steps:
      - uses: actions/checkout@v4
      - name: Install ags
        run: |
          asset=$(curl -fsSL https://api.github.com/repos/AccelByte/accelbyte-ags-cli/releases/latest \
            | jq -r '.assets[].name | select(test("^accelbyte-ags-cli-x86_64-unknown-linux-gnu\\.tar\\.xz$"))')
          curl -fsSL "https://github.com/AccelByte/accelbyte-ags-cli/releases/latest/download/${asset}" -o /tmp/ags.tar.xz
          tar -xJf /tmp/ags.tar.xz -C /tmp
          chmod +x "/tmp/${asset%.tar.xz}/ags"
          sudo mv "/tmp/${asset%.tar.xz}/ags" /usr/local/bin/ags
          command -v ags && ags --version
      - name: Deploy
        env:
          AGS_BASE_URL: ${{ secrets.AGS_BASE_URL }}
          AGS_NAMESPACE: ${{ inputs.namespace || secrets.AGS_NAMESPACE }}
          AGS_CLIENT_ID: ${{ secrets.AGS_CLIENT_ID }}
          AGS_CLIENT_SECRET: ${{ secrets.AGS_CLIENT_SECRET }}
        run: |
          ags auth login --grant client-credentials
          # Minimum version: ags 0.5.1. Exit codes under --wait: references/deploy/cli-commands.md#deploy.
          ags extend deploy-app \
            --namespace "$AGS_NAMESPACE" \
            --app matchmaking-override \
            --json '{"imageTag":"${{ github.sha }}"}' \
            --wait
```

## What's in here and why

- **`workflow_dispatch` trigger with namespace input.** Lets ops-style runs pick a target (dev / staging / prod) without editing the workflow file.
- **`push` trigger for main.** Runs test + image-upload on every main merge, but the deploy job is gated on `workflow_dispatch` — preventing auto-deploy-on-push to production. The developer must click a button.
- **`needs:` dependency chain.** test → image-upload → deploy. Each depends on the previous succeeding.
- **`environment: production`.** Enables GitHub's environment protection rules (required reviewers, deployment branches). Configure the `production` environment under Settings → Environments.
- **Credentials via env vars.** The CLI reads `AGS_CLIENT_ID`, `AGS_CLIENT_SECRET`, and `AGS_BASE_URL` from the environment for non-interactive (CI) use. `AGS_NAMESPACE` can also be set as an env var (as in the official quickstart) but is passed as `--namespace` flag here for explicitness. The CLI needs an explicit `ags auth login --grant client-credentials` call in CI — unlike `extend-helper-cli`, which authenticated implicitly from the env vars alone.

## Per-language setup adjustments

### Python

Replace `actions/setup-go` with:

```yaml
      - uses: actions/setup-python@v5
        with:
          python-version: "3.10"
      - run: pip install -r requirements.txt
      - run: pytest
```

### Java

```yaml
      - uses: actions/setup-java@v4
        with:
          distribution: "temurin"
          java-version: "17"
      - run: ./gradlew build
      - run: ./gradlew test
```

### C#

```yaml
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: "8.0"
      - run: dotnet restore
      - run: dotnet build --configuration Release --no-restore
      - run: dotnet test --configuration Release --no-build
```

## Multi-app projects

Each app gets its own workflow file (or its own job in a shared file). Keep jobs independent so deploys don't couple:

```yaml
# .github/workflows/extend-matchmaking-override.yml  — for app 1
# .github/workflows/extend-leaderboard-service.yml   — for app 2
```

This lets you deploy `matchmaking-override` without re-running `leaderboard-service` tests or re-pushing its image.

## Extending an existing workflow

If the repo already has `.github/workflows/ci.yml` with `lint` + `test` jobs, add a `deploy-extend` job that reuses the existing test result:

```yaml
  deploy-extend:
    needs: test
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Install and deploy
        env:
          AGS_BASE_URL: ${{ secrets.AGS_BASE_URL }}
          AGS_NAMESPACE: ${{ inputs.namespace || secrets.AGS_NAMESPACE }}
          AGS_CLIENT_ID: ${{ secrets.AGS_CLIENT_ID }}
          AGS_CLIENT_SECRET: ${{ secrets.AGS_CLIENT_SECRET }}
        run: |
          # install ags + ags auth login + image-upload + deploy-app as above
```

## Hardening

Once the pipeline is green:

- Add branch protection so `main` requires the test job to pass before merge.
- Add required reviewers to the `production` environment so deploy requires a second click from another team member.
- Pin `ags` to a specific version in the install step (don't use `latest` in prod). Replace the URL with a versioned tag from `https://github.com/AccelByte/accelbyte-ags-cli/releases`.
- Rotate `AGS_CLIENT_SECRET` periodically. In the Admin Portal, generate a new client secret, update your CI secrets, then delete the old one to complete the rotation.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ags: command not found` | The install step failed or PATH isn't set. Confirm the binary exists at `/usr/local/bin/ags` in the job. |
| `401 unauthorized` at `image-upload` | `AGS_CLIENT_ID`/`AGS_CLIENT_SECRET` don't match, the client lacks permissions, or the `ags auth login --grant client-credentials` step didn't run first. Recreate the IAM client in the Portal. |
| `deploy-app` exits immediately (use `--wait` to block). App remains non-Running for 10+ minutes | Usually the image is too large or the health check is failing. Check app status with `ags extend get-app-info --app matchmaking-override --namespace ...`. Check logs via Grafana Cloud. |
| Deploy succeeds but app shows `Degraded` | Health check fails once the app starts. Check logs via Grafana Cloud (Admin Portal → app detail → Open Grafana Cloud). |
