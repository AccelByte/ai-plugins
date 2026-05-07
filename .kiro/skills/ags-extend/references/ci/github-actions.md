---
last-verified: 2026-04-21
note: Canonical GitHub Actions workflow for Extend build + deploy. In CI, the CLI
  authenticates via AB_CLIENT_ID, AB_CLIENT_SECRET, and AB_BASE_URL environment variables
  (non-interactive). The interactive `login` subcommand exists but is not used in
  CI. Commands verified against extend-helper-cli binary --help output (see references/cli/help-output.md).
sources:
- https://github.com/AccelByte/extend-helper-cli
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

- `AB_CLIENT_ID` — IAM client ID from the Admin Portal
- `AB_CLIENT_SECRET` — IAM client secret
- `AB_BASE_URL` — AGS base URL, e.g. `https://your-env.accelbyte.io`
- `AB_NAMESPACE` — target namespace

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
      - name: Install extend-helper-cli
        run: |
          # Download the latest release binary.
          # Replace the URL with the pinned version from your install-cli reference.
          curl -L -o /tmp/extend-helper-cli \
            "https://github.com/AccelByte/extend-helper-cli/releases/latest/download/extend-helper-cli-linux_amd64"
          chmod +x /tmp/extend-helper-cli
          sudo mv /tmp/extend-helper-cli /usr/local/bin/extend-helper-cli
          command -v extend-helper-cli && extend-helper-cli --help > /dev/null && echo "CLI ready"
      - name: Build and push
        env:
          AB_BASE_URL: ${{ secrets.AB_BASE_URL }}
          AB_NAMESPACE: ${{ inputs.namespace || secrets.AB_NAMESPACE }}
          AB_CLIENT_ID: ${{ secrets.AB_CLIENT_ID }}
          AB_CLIENT_SECRET: ${{ secrets.AB_CLIENT_SECRET }}
        run: |
          # The CLI authenticates via AB_CLIENT_ID, AB_CLIENT_SECRET, AB_BASE_URL env vars.
          # Use --login flag to automatically run dockerlogin before image upload.
          extend-helper-cli image-upload \
            --namespace "$AB_NAMESPACE" \
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
      - name: Install extend-helper-cli
        run: |
          curl -L -o /tmp/extend-helper-cli \
            "https://github.com/AccelByte/extend-helper-cli/releases/latest/download/extend-helper-cli-linux_amd64"
          chmod +x /tmp/extend-helper-cli
          sudo mv /tmp/extend-helper-cli /usr/local/bin/extend-helper-cli
      - name: Deploy
        env:
          AB_BASE_URL: ${{ secrets.AB_BASE_URL }}
          AB_NAMESPACE: ${{ inputs.namespace || secrets.AB_NAMESPACE }}
          AB_CLIENT_ID: ${{ secrets.AB_CLIENT_ID }}
          AB_CLIENT_SECRET: ${{ secrets.AB_CLIENT_SECRET }}
        run: |
          extend-helper-cli deploy-app \
            --namespace "$AB_NAMESPACE" \
            --app matchmaking-override \
            --image-tag "${{ github.sha }}"
```

## What's in here and why

- **`workflow_dispatch` trigger with namespace input.** Lets ops-style runs pick a target (dev / staging / prod) without editing the workflow file.
- **`push` trigger for main.** Runs test + image-upload on every main merge, but the deploy job is gated on `workflow_dispatch` — preventing auto-deploy-on-push to production. The developer must click a button.
- **`needs:` dependency chain.** test → image-upload → deploy. Each depends on the previous succeeding.
- **`environment: production`.** Enables GitHub's environment protection rules (required reviewers, deployment branches). Configure the `production` environment under Settings → Environments.
- **Credentials via env vars.** The CLI reads `AB_CLIENT_ID`, `AB_CLIENT_SECRET`, and `AB_BASE_URL` from the environment for non-interactive (CI) use. No separate login step is needed. The interactive `login` subcommand exists for local/terminal use but is not used in CI pipelines.

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
          AB_BASE_URL: ${{ secrets.AB_BASE_URL }}
          AB_NAMESPACE: ${{ inputs.namespace || secrets.AB_NAMESPACE }}
          AB_CLIENT_ID: ${{ secrets.AB_CLIENT_ID }}
          AB_CLIENT_SECRET: ${{ secrets.AB_CLIENT_SECRET }}
        run: |
          # install CLI + image-upload + deploy-app as above
```

## Hardening

Once the pipeline is green:

- Add branch protection so `main` requires the test job to pass before merge.
- Add required reviewers to the `production` environment so deploy requires a second click from another team member.
- Pin `extend-helper-cli` to a specific version in the install step (don't use `latest` in prod). Replace the URL with a versioned tag.
- Rotate `AB_CLIENT_SECRET` quarterly. The Admin Portal supports rotation without downtime if you stagger old/new.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `extend-helper-cli: command not found` | The install step failed or PATH isn't set. Confirm the binary exists at `/usr/local/bin/extend-helper-cli` in the job. |
| `401 unauthorized` at `image-upload` | `AB_CLIENT_ID`/`AB_CLIENT_SECRET` don't match or the client lacks permissions. Recreate the IAM client in the Portal. |
| `deploy-app` hangs for 10+ minutes | Usually the image is too large or the health check is failing. Check app status with `extend-helper-cli get-app-info --app matchmaking-override --namespace ...`. Check logs via Grafana Cloud. |
| Deploy succeeds but app shows `Degraded` | Health check fails once the app starts. Check logs via Grafana Cloud (Admin Portal → app detail → Open Grafana Cloud). |
