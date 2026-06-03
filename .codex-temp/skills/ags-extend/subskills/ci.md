---
last-verified: 2026-05-07
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
- https://github.com/AccelByte/extend-helper-cli
see-also:
- '[github-actions.md](../references/ci/github-actions.md)'
- '[gitlab.md](../references/ci/gitlab.md)'
- '[cli-commands.md](../references/deploy/cli-commands.md)'
---

# AGS Extend CI Wirer

Wire `extend-helper-cli image-upload` and `deploy-app` into the developer's CI system. Generates or updates a workflow file for GitHub Actions or GitLab CI, sets up the secrets the pipeline needs, and produces a runnable template the developer commits and iterates on.

## Behavior Constraints

<grounding_rules>

- Read `references/ci/github-actions.md` or `references/ci/gitlab.md` depending on the host.
- Read `references/deploy/cli-commands.md` before quoting any CLI command, flag, or env var. Do not restate flags from memory — link instead.
- CI auth is via env-var-as-secret only. Set `AB_BASE_URL`, `AB_CLIENT_ID`, `AB_CLIENT_SECRET` (and `AB_NAMESPACE`) as CI secrets exported into the runner's env; the CLI reads them automatically. There is no `--base-url`, `--client-id`, or `--client-secret` flag — those are not part of the CLI surface. The interactive `extend-helper-cli login` is browser-based and is not appropriate for CI.
- Do not invent CI features. If a CI host isn't GitHub Actions or GitLab, stop and point at the generic shape (bash in a container with the CLI on PATH + secrets set).

</grounding_rules>

<tool_usage_rules>

- `Bash` to inspect the repo (does `.github/workflows/` or `.gitlab-ci.yml` exist?).
- `Write` to create a new workflow file when missing.
- `Edit` to extend an existing workflow with Extend-specific steps — only with explicit developer confirmation.
- `Read` for references and existing CI files.
- Do not commit. Do not push. Do not set secrets in the CI host (that's the developer's job through the CI UI).

</tool_usage_rules>

<action_safety>

CI workflow files can trigger deploys on push. Be cautious:

- Default the workflow to a manual trigger (`workflow_dispatch` on GitHub; `when: manual` on GitLab) unless the developer explicitly asks for push-to-branch auto-deploy.
- Make the deploy step depend on test success, not parallel to it.
- Never put `AB_CLIENT_SECRET` in the workflow file as plaintext. Always reference secrets by name (`${{ secrets.AB_CLIENT_SECRET }}` on GitHub; `$AB_CLIENT_SECRET` on GitLab with protected variable).

</action_safety>

<output_contract>

Output proceeds in blocks:

1. **Host detection block** — GitHub / GitLab / other.
2. **Plan block** — the workflow file path, triggers, stages, secrets needed.
3. **File block** — the complete workflow content ready to commit.
4. **Secrets setup block** — exact instructions for where the developer adds each secret in the CI UI.
5. **Verification block** — how to test the pipeline runs (e.g. push a commit to a test branch).

</output_contract>

## Workflow

### Step 1 — Detect the host

```bash
ls .github/workflows/ 2>/dev/null || ls .gitlab-ci.yml 2>/dev/null || ls azure-pipelines.yml 2>/dev/null
```

- `.github/workflows/*` present → GitHub Actions
- `.gitlab-ci.yml` present → GitLab CI
- Neither → ask the developer which host, or if they want the generic shape.

If both present, ask which one this Extend project should deploy from.

### Step 2 — Find the Extend app dirs

```bash
# Single-app project: cwd is the app dir.
test -f Makefile && test -f Dockerfile && echo "app: $(basename $(pwd))"
# Multi-app project: each app is a sibling directory with Makefile + Dockerfile.
ls */Makefile 2>/dev/null
```

The workflow needs to know each app's directory path, its namespace, and its base URL. These come from each app's `.env` (read at CI runtime via secrets/variables). If multiple apps exist, the workflow runs the deploy step once per app dir (typically as a matrix over the app names).

### Step 3 — Read the right CI reference

- GitHub Actions → `references/ci/github-actions.md`
- GitLab → `references/ci/gitlab.md`

Both reference files show the canonical workflow shape: checkout → language setup → test → install CLI → image-upload → deploy. Use verbatim.

### Step 4 — Present the plan

```
Plan — matchmaking-override CI pipeline (GitHub Actions)

  File:       .github/workflows/extend-deploy.yml
  Triggers:   push to `main` (test + build only) / manual dispatch (full deploy)
  Stages:     test → image-upload → deploy (deploy depends on previous)
  Namespace:  vip-experience-dev (sourced from CI secret AB_NAMESPACE; editable in the UI per run)
  Secrets needed:
    - AB_CLIENT_ID
    - AB_CLIENT_SECRET
    - AB_BASE_URL
    - AB_NAMESPACE

Write the workflow now? (yes/no)
```

### Step 5 — Write / Edit

On confirm, write the file using the exact template from `references/ci/github-actions.md` or `gitlab.md`, substituting the Extend project's values (app path and language detected on disk; namespace and base URL come from CI secrets at runtime). Secrets stay as references.

If a workflow file already exists, Edit to append the Extend-specific stages without clobbering unrelated steps. Show the diff before applying.

### Step 6 — Secrets setup block

```
Add these secrets in your CI host UI:

GitHub Actions:
  Settings → Secrets and variables → Actions → New repository secret
    AB_CLIENT_ID       ← from Admin Portal (IAM client)
    AB_CLIENT_SECRET   ← from Admin Portal (IAM client)
    AB_BASE_URL        ← e.g. https://your-env.accelbyte.io
    AB_NAMESPACE       ← e.g. vip-experience-dev

GitLab:
  Settings → CI/CD → Variables → Add variable (mark "Masked" and "Protected")
    [same four]
```

### Step 7 — Verification block

```
To verify the pipeline:
  1. Commit and push the workflow file to a test branch.
  2. In GitHub Actions, run the workflow manually (workflow_dispatch) against that branch.
  3. Watch for: language setup passes → tests pass → CLI installs → image-upload succeeds.
  4. Deploy stage requires manual approval by default (good — prevents unintended production deploys). Approve when ready.
  5. After a successful deploy: /ags-extend observe to confirm the app is Running.
```

## Error Handling

| Situation | Response |
|---|---|
| Host is Azure Pipelines / CircleCI / Bitbucket Pipelines | The references don't cover these. Describe the generic shape (container with extend-helper-cli installed + secrets) and direct the developer to translate from the GitHub Actions reference. |
| Workflow file exists already and has deploy steps for other apps | Extend the file — add a new job or step scoped to the Extend app. Don't touch existing jobs. Show the diff before applying. |
| Developer wants "push to main → deploy to prod" | Push to `main` auto-deploying to prod is risky — always. Offer the middle-ground: push to `main` deploys to *dev* namespace, tag-based releases deploy to prod with manual approval. If they insist on auto-prod-deploy, warn about the blast radius and let them decide. |
| Developer doesn't have a dev namespace | Stop and direct to `/ags-extend ask` — namespace setup is an AGS admin task, not an Extend task. |
| Multi-app project — which app's CI? | Ask. Often each app has its own workflow file so deploys are independent; one combined file is an option if the developer wants all-or-nothing releases. |
| Developer asks about CLI auth flags | There are none for OAuth client mode. The CLI reads `AB_BASE_URL`/`AB_CLIENT_ID`/`AB_CLIENT_SECRET` from env or `.env`. Direct them to `references/deploy/cli-commands.md#authentication`. |

## Examples

### GitHub Actions, single Go app

```
User: /ags-extend ci

Skill: Host detected: GitHub Actions (.github/workflows/ present).
       Extend app dirs detected: ./matchmaking-override (Makefile + Dockerfile + go.mod).

       [reads references/ci/github-actions.md]

       Plan:
         File:      .github/workflows/extend-matchmaking-deploy.yml
         Triggers:  workflow_dispatch (manual), push to main (test + image-upload only)
         Stages:    setup-go → test → install-cli → image-upload → deploy (manual gate)
         Secrets:   AB_CLIENT_ID, AB_CLIENT_SECRET, AB_BASE_URL, AB_NAMESPACE
       Write? (yes/no)

User: yes

Skill: [Writes file]
       Created .github/workflows/extend-matchmaking-deploy.yml

       Next:
         1. Add the 4 secrets in Settings → Secrets and variables → Actions.
         2. Push the workflow file to a branch.
         3. Run it manually from the Actions tab to verify.
```

### Existing pipeline — extend it

```
User: /ags-extend ci
  I already have a .github/workflows/ci.yml with lint + test. Add deploy.

Skill: Found .github/workflows/ci.yml (has `lint` and `test` jobs).
       I'll add a `deploy-extend` job that depends on test, with workflow_dispatch-only trigger.

       Diff:
         + deploy-extend:
         +   needs: test
         +   if: github.event_name == 'workflow_dispatch'
         +   runs-on: ubuntu-latest
         +   steps:
         +     [...]

       Apply? (yes/no)
```

### Generic host

```
User: /ags-extend ci
  We use Jenkins.

Skill: The reference files don't cover Jenkins. The shape is the same as any other Linux-based CI:

  1. Checkout the repo.
  2. Set up the language runtime (go 1.21+, python 3.10+, etc.).
  3. Run tests.
  4. Install extend-helper-cli (from GitHub releases — curl + chmod + move to PATH).
  5. Export AB_CLIENT_ID / AB_CLIENT_SECRET / AB_BASE_URL / AB_NAMESPACE from Jenkins credentials. The CLI picks them up automatically — no flags needed.
  6. Run `extend-helper-cli image-upload` (see references/deploy/cli-commands.md for the exact invocation: --namespace, --app, --image-tag, --work-dir, optional --login).
  7. Run `extend-helper-cli deploy-app` (see references/deploy/cli-commands.md: --namespace, --app, --image-tag). Note: the command is `deploy-app`, not `deploy`.

  Translate this into a Jenkinsfile. The references/ci/github-actions.md template is the closest starting point to crib from.
```
