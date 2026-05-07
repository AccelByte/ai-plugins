---
last-verified: 2026-04-21
note: Canonical GitLab CI pipeline for Extend build + deploy. In CI, the CLI authenticates
  via AB_CLIENT_ID, AB_CLIENT_SECRET, and AB_BASE_URL environment variables (non-interactive).
  The interactive `login` subcommand exists but is not used in CI. Commands verified
  against extend-helper-cli binary --help output (see references/cli/help-output.md).
sources:
- https://github.com/AccelByte/extend-helper-cli
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[github-actions.md](github-actions.md)'
- '[cli-commands.md](../deploy/cli-commands.md)'
- '[rollout.md](../production/rollout.md)'
---

# GitLab CI — Extend Deploy Pipeline

Consumed by `subskills/ci.md`. Parallel to `github-actions.md`; GitLab's pipeline shape is different but the stages are the same.

## Required CI/CD variables

Project Settings → CI/CD → Variables. Mark each as **Masked** and **Protected**:

- `AB_CLIENT_ID`
- `AB_CLIENT_SECRET`
- `AB_BASE_URL`
- `AB_NAMESPACE`

Protected variables are only exposed to jobs running on protected branches / tags. Combine with branch protection so only `main` (and tag releases) can run the deploy job.

## Minimal pipeline — Go Service Extension

`.gitlab-ci.yml` at the repo root:

```yaml
stages:
  - test
  - image-upload
  - deploy

variables:
  GO_VERSION: "1.24"
  APP_NAME: matchmaking-override
  APP_DIR: matchmaking-override

# ---------- test ----------

test:
  stage: test
  image: golang:${GO_VERSION}
  before_script:
    - cd $APP_DIR
  script:
    - go mod download
    - go build ./...
    - go test ./...
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_PIPELINE_SOURCE == "web"   # manual pipeline run

# ---------- image-upload ----------

image-upload:
  stage: image-upload
  image: golang:${GO_VERSION}
  needs: [test]
  before_script:
    - cd $APP_DIR
    - |
      # Install extend-helper-cli. Pin the version in prod; this uses latest for simplicity.
      apt-get update && apt-get install -y curl
      curl -L -o /usr/local/bin/extend-helper-cli \
        "https://github.com/AccelByte/extend-helper-cli/releases/latest/download/extend-helper-cli-linux_amd64"
      chmod +x /usr/local/bin/extend-helper-cli
      command -v extend-helper-cli && extend-helper-cli --help > /dev/null && echo "CLI ready"
  script:
    - |
      # The CLI authenticates via AB_CLIENT_ID, AB_CLIENT_SECRET, AB_BASE_URL env vars.
      # Use --login flag to automatically run dockerlogin before image upload.
      extend-helper-cli image-upload \
        --namespace "$AB_NAMESPACE" \
        --app "$APP_NAME" \
        --image-tag "$CI_COMMIT_SHORT_SHA" \
        --login
  services:
    - docker:dind   # image-upload uses docker internally; dind service provides the docker daemon
  variables:
    DOCKER_HOST: tcp://docker:2375
    DOCKER_TLS_CERTDIR: ""
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_PIPELINE_SOURCE == "web"

# ---------- deploy ----------

deploy:
  stage: deploy
  image: alpine:3.19
  needs: [image-upload]
  before_script:
    - apk add --no-cache curl
    - |
      curl -L -o /usr/local/bin/extend-helper-cli \
        "https://github.com/AccelByte/extend-helper-cli/releases/latest/download/extend-helper-cli-linux_amd64"
      chmod +x /usr/local/bin/extend-helper-cli
  script:
    - |
      extend-helper-cli deploy-app \
        --namespace "$AB_NAMESPACE" \
        --app "$APP_NAME" \
        --image-tag "$CI_COMMIT_SHORT_SHA"
  when: manual           # requires a human click in the GitLab UI
  environment:
    name: production
    url: https://admin.accelbyte.io   # link in the GitLab env page
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_PIPELINE_SOURCE == "web"
```

## What's in here and why

- **Three stages**, each depending on the last via `needs:`. Test runs on every MR and main push; image-upload runs on main only; deploy is `when: manual` so it only runs when someone explicitly clicks it.
- **`services: docker:dind`** in image-upload — `extend-helper-cli image-upload` invokes `docker build` / `docker push` under the hood, which needs a docker daemon in the GitLab runner.
- **Protected variables + protected branches.** The secrets are only exposed on `main`, so a MR pipeline can't exfiltrate them.
- **`environment: production`** attaches the deploy to GitLab's environment page, so you can see deployment history and link to the Admin Portal.
- **`when: manual`.** No auto-deploy on push. Prod deploys always require a human.

## Per-language setup adjustments

### Python

Replace the `test` and `image-upload` job `image:` with `python:3.10`, and the script steps:

```yaml
  script:
    - cd $APP_DIR
    - pip install -r requirements.txt
    - pytest
```

### Java

Image: `eclipse-temurin:17`. Script:

```yaml
  script:
    - cd $APP_DIR
    - ./gradlew build
    - ./gradlew test
```

### C#

Image: `mcr.microsoft.com/dotnet/sdk:8.0`. Script:

```yaml
  script:
    - cd $APP_DIR
    - dotnet restore
    - dotnet build --configuration Release --no-restore
    - dotnet test --configuration Release --no-build
```

## Multi-app projects

Duplicate the pipeline per app:

```yaml
test:matchmaking:
  stage: test
  # ... scoped to matchmaking-override

test:leaderboard:
  stage: test
  # ... scoped to leaderboard-service

image-upload:matchmaking:
  needs: [test:matchmaking]
  # ...

# etc.
```

Or split into separate `.gitlab-ci.yml` files per app via `include:` in a parent pipeline.

## Self-hosted runner considerations

The pipeline above assumes GitLab.com's shared runners. If you're on self-hosted runners:

- Docker-in-docker may be pre-configured on the runner (ask your infra team).
- You may need to set tags on each job to route to the right runner: `tags: [docker, extend]`.
- Network egress from the runner must reach AccelByte's image registry.

## Hardening

- Pin `extend-helper-cli` to a version tag instead of `latest`.
- Add an `allow_failure: false` check on `test` so a red test blocks everything downstream.
- Use GitLab's environment-scoped variables to separate dev / staging / prod credentials on the same pipeline. See: Settings → CI/CD → Variables → environment scope.
- Rotate `AB_CLIENT_SECRET` quarterly.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `docker: command not found` in image-upload | `docker:dind` service not configured, or runner doesn't allow privileged mode. |
| `401 unauthorized` | Variables not exposed to this pipeline — check "protected" setting on both the variables and the branch. |
| Deploy button grayed out | Branch isn't protected, or the user lacks the role GitLab requires for manual deploys (usually Maintainer+). |
| CLI fails with "invalid url" or auth error | `AB_BASE_URL` is missing or has trailing slash. Check the variable's value. Verify `AB_CLIENT_ID` / `AB_CLIENT_SECRET` are set. |
