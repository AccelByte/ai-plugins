---
last-verified: 2026-07-20
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
- https://github.com/AccelByte/extend-helper-cli
see-also:
- '[cli-commands.md](../references/deploy/cli-commands.md)'
- '[common-errors.md](../references/deploy/common-errors.md)'
- '[rollout.md](../references/production/rollout.md)'
---

# AGS Extend Deployer

Build and deploy one or more Extend apps from a local project to AGS. Walks four steps: discover app dirs on disk, verify prerequisites, confirm scope with the user, then `image-upload` + `deploy` per app.

## Behavior Constraints

<grounding_rules>

- Read `references/deploy/cli-commands.md` before quoting any CLI command, flag, or env var. Do not restate flags from memory — link instead.
- Read `references/deploy/common-errors.md` when a command fails. Look up the error signature and follow the documented fix. Do not improvise.
- App identity comes from per-app discovery on disk: an Extend app is a directory containing both `Makefile` and `Dockerfile`. The app's name is the directory's basename. Multi-app projects are simply multiple such directories side by side.
- `AB_NAMESPACE`, `AB_BASE_URL`, `AB_CLIENT_ID`, `AB_CLIENT_SECRET` come from the user's environment or a `.env` file in the CLI's cwd, OR from `extend-helper-cli login` (browser flow). The CLI does NOT accept `--base-url` as a flag. Do not invent a project-wide manifest — there is none.

</grounding_rules>

<tool_usage_rules>

- Use `Bash` only for `extend-helper-cli` commands, app discovery (`test -f`, `ls */Makefile`), tool version checks, and `docker` checks.
- Use `Read` for `.env` files and reference files.
- Use `Glob` to enumerate Extend app dirs (`*/Makefile` siblings) when invoked from a parent directory.
- **Never** modify source files, `.env`, or any file in the repo. Deploy is a read-and-run subskill.
- Never run `deploy` without the scope confirmation in Step 3.
- Never retry a failed deploy automatically — surface the error and let the user decide.

</tool_usage_rules>

<dependency_checks>

Before running any deploy commands:

1. The current directory has `Makefile` + `Dockerfile` (single-app run), or `*/Makefile` + `*/Dockerfile` siblings exist one level down (multi-app project).
2. `command -v extend-helper-cli` returns a path. Run the `/ags-extend install-cli` freshness check and report the installed path/version, latest version, and status. Missing or broken/unparseable -> stop. Outdated or legacy/pre-version -> offer an upgrade to the latest official release. If the user declines, continue only when the documented deploy commands are present in `--help`. See `references/deploy/cli-commands.md#presence-and-freshness-check`.
3. `docker --version` succeeds and `docker info` shows a running daemon. Missing → stop with install link.
4. For each app being deployed: `Dockerfile` exists at `{app-path}/Dockerfile`.
5. For each app being deployed: `.env` exists at `{app-path}/.env`, and `AB_CLIENT_ID` + `AB_CLIENT_SECRET` are not placeholder values.

Run checks 1–3 in parallel, then 4–5 per selected app.

</dependency_checks>

<action_safety>

Deploy is the most consequential Extend action. Safety rules:

- **Scope confirmation is mandatory.** Never deploy without showing the user the exact list of apps, target namespace, and target base URL, and getting an explicit yes.
- **Credentials warnings.** If an app's `.env` has placeholder credentials, warn before deploy and require a second explicit yes to proceed with that app.
- **Prod-looking targets.** If `AB_NAMESPACE` looks like prod (`prod`, `production`, `live`, `mainline`, or the `AB_BASE_URL` isn't a dev/demo subdomain), add an extra confirmation: "This looks like a production namespace. Proceed? (yes/no)"
- **Failure isolation.** If an app fails image-upload or deploy, stop before moving to the next app. Ask: "Continue with remaining apps, or stop here?"
- **No rollback.** `extend-helper-cli` doesn't ship an atomic rollback; a failed deploy may leave the app in a partial state. Surface that to the user rather than implying otherwise.

</action_safety>

<user_updates_spec>

During `image-upload` and `deploy` commands, stream output live. Between apps, print a transition line so the user sees progress across a multi-app deploy:

```
━━━ 1/3: matchmaking-override ━━━
━━━ 2/3: match-event-handler ━━━
━━━ 3/3: leaderboard-ext ━━━
```

</user_updates_spec>

<output_contract>

Final output:

```
Deploy complete.

  ✓ {app-name}  image-upload ok, deploy ok     {base_url} / {namespace}
  ✗ {app-name}  image-upload failed (see above)
  ⚠ {app-name}  skipped (credentials)

Next:
  • /ags-extend observe — pull logs and status
  • Admin Portal — registered apps list
```

If every app succeeded, include a single-line "All apps deployed." at the top. If any failed, the summary leads with a `✗` count.

</output_contract>

## Workflow

### Step 1 — Discover apps and read .env

```bash
# Are we already inside an app dir?
test -f Makefile && test -f Dockerfile && echo "in app: $(basename $(pwd))"
# Or are app dirs one level down?
ls */Makefile 2>/dev/null
```

If neither pattern matches:

> No `Makefile`+`Dockerfile` here or as a sibling one level down. `cd` into your Extend app directory (or its parent for a multi-app project), or run `/ags-extend wizard` to scaffold one. Stopping.

For each detected app dir, detect language from on-disk files (`go.mod` → Go, `requirements.txt` / `pyproject.toml` → Python, `*.csproj` → C#, `build.gradle` / `pom.xml` → Java) and read `.env` to extract:

- `AB_NAMESPACE`, `AB_BASE_URL`
- `AB_CLIENT_ID`, `AB_CLIENT_SECRET` (presence + placeholder check only — do not echo secrets)

Project name is the parent directory's basename if multi-app, or the app dir's basename for a single-app run.

Warn on:

- `AB_NAMESPACE` or `AB_BASE_URL` is missing, `"TBD"`, or empty → stop and tell the user to fill in `.env`.
- `AB_NAMESPACE` matches a prod-ish pattern (see `action_safety`) — note for the Step 3 confirmation.
- App dirs in a multi-app project have inconsistent `AB_NAMESPACE` / `AB_BASE_URL` — note this and confirm scope per app.

### Step 2 — Prerequisites

Run in parallel:

```bash
command -v extend-helper-cli || echo "extend-helper-cli not installed"
extend-helper-cli --version
docker --version 2>&1
docker info 2>/dev/null | grep "Server Version"
```

Report:

```
Prerequisites:
  ✓ extend-helper-cli 0.4.1
  ✓ docker 25.0.3 (daemon running)
```

If any is missing:

- `extend-helper-cli` missing → "Run `/ags-extend install-cli`, then retry `/ags-extend deploy`." Stop.
- `extend-helper-cli` outdated or legacy/pre-version → report the path, installed/latest versions, and status; offer `/ags-extend install-cli` to upgrade to the latest official release. If the user declines, check the documented deploy command in `--help` and continue when present.
- `extend-helper-cli` broken/unparseable → stop and run `/ags-extend install-cli`; do not replace it without confirmation.
- required deploy command absent → check freshness before declaring the capability unavailable. Offer an upgrade when outdated or legacy/pre-version. Retry discovery only after an approved, verified upgrade. Do not treat authentication or authorization failures as upgrade candidates.
- `docker` missing → "Install Docker from https://docs.docker.com, then retry." Stop.
- Docker daemon not running → "Start Docker Desktop (or `sudo systemctl start docker`), then retry." Stop.

Then per app:

```bash
ls {app-path}/Dockerfile 2>/dev/null
ls {app-path}/.env 2>/dev/null
```

For each app, read `.env` and check `AB_CLIENT_ID` / `AB_CLIENT_SECRET`. Placeholder values (`"<fill in>"`, `TBD`, empty) → flag.

### Step 3 — Confirm scope

Pattern (override / event-handler / service-extension) is not a fact you can read off disk; show it as `(go)` etc. when only language is known, or ask the user if it's load-bearing for the dialog. Below is illustrative.

```
Project: {project-or-parent-dir-name}
Target:  {base_url} / {namespace}

Apps available to deploy:
  1. matchmaking-override   (go)   ./matchmaking-override
  2. match-event-handler    (go)   ./match-event-handler  ⚠ credentials not set
  3. leaderboard-ext        (go)   ./leaderboard-ext      ✗ Dockerfile missing

Deploy which? (all / 1,3 / 1 / none)
```

If the user picks `all` or includes an app with issues:

- Missing Dockerfile → cannot deploy. Exclude from the selection and say so.
- Placeholder credentials → "Deploying `{app}` with placeholder credentials will fail when the app tries to talk to AGS. Proceed anyway? (yes/no)"
- Prod-looking namespace → "Target namespace `{namespace}` looks like production. Proceed? (yes/no)"

Do not proceed past Step 3 without a clear yes.

### Step 4 — Buildpush and deploy

Read `references/deploy/cli-commands.md` for exact syntax. Quote it from the reference, not from memory.

For each selected app, in order:

#### 4a. Buildpush

Run from the app dir. See `references/deploy/cli-commands.md` for the exact `image-upload` invocation (namespace, app, image-tag, work-dir, optional `--login`). Do not pass `--base-url`; it isn't a flag. Auth is via env vars / `.env` in cwd, or `extend-helper-cli login` first.

Stream output. On non-zero exit:

1. Check `references/deploy/common-errors.md` for the error signature.
2. Print the matched error's fix. If no match, surface the raw last 20 lines.
3. Ask: "Continue with remaining apps, or stop here?" Do not auto-skip to deploy.

If image-upload succeeds, proceed to 4b.

#### 4b. Deploy

See `references/deploy/cli-commands.md` for the exact `deploy-app` invocation (namespace, app, image-tag). The command is `deploy-app`, not `deploy`. Do not pass `--base-url`.

Stream output. On non-zero exit, same handling as image-upload.

After each app, print a one-line status and the transition header for the next app (if any).

### Step 5 — Summary

Print the final output block (see `output_contract`).

## Error Handling

| Situation | Response |
|---|---|
| No app dir found (no Makefile+Dockerfile here or as siblings) | Stop. Direct to `/ags-extend wizard` or `cd` into a project. |
| `.env` has `TBD` / empty `AB_NAMESPACE` or `AB_BASE_URL` | Stop. Tell the user to fill those in — they're not values this subskill can guess. |
| `extend-helper-cli` missing | Stop. Direct to `/ags-extend install-cli`. |
| Docker missing or daemon down | Stop. Install/start then retry. |
| Dockerfile missing for an app | Exclude from deploy. In Step 3 summary, mark it ✗ and exclude from default selection. |
| `.env` missing for an app | Treat like missing credentials — ask whether to copy from `.env.template` first (offer the command). If user proceeds without filling it in, warn a second time. |
| Placeholder credentials | Warn, require explicit yes. |
| Prod-looking namespace | Extra confirmation prompt before proceeding. |
| Image push fails with `unauthorized: authentication required` | Auth is missing or expired. Ask user for `AB_BASE_URL` if not already set, then have them run `extend-helper-cli login` (browser flow) OR re-export `AB_CLIENT_ID`/`AB_CLIENT_SECRET`. See `references/deploy/cli-commands.md#authentication`. Ask the user first before running anything. |
| Image push fails with `failed to solve: no such file or directory` | A referenced file is missing in the build context — usually a proto not regenerated. Suggest `make proto` in the app dir. |
| Image push fails with `no space left on device` | Docker disk is full. Suggest `docker system prune` (show but don't auto-run). |
| Image push fails with registry timeout | Network hiccup or AGS registry degraded. Suggest retrying the single app after a minute. |
| Deploy fails with `app not found` | App isn't registered in the Admin Portal yet. Direct user to the Portal to register it, then retry deploy (not image-upload — the image is already pushed). |
| Deploy fails with `namespace not found` / 403 | Wrong namespace or insufficient permissions. Double-check `.env`; verify the OAuth client's permissions. |
| Deploy times out | AGS may still be starting the app. Run `/ags-extend observe` after 1–2 minutes to see if it reached Running. |
| Deploy fails with `resource limit exceeded` | The app's resource configuration exceeds what the namespace allows. `extend-helper-cli create-app` accepts `--cpu`/`--memory` as initial values at creation time, but `deploy-app` does not — once the app exists, resource changes happen in the Admin Portal (app detail → resource configuration) or via the CSM API. See `references/deploy/cli-commands.md` for the per-subcommand flag breakdown and `references/init/resource-defaults.md` for hard limits. User must lower the per-app values in the Admin Portal, or raise the namespace allocation. |
| Mid-sequence failure (app 2 of 3 fails) | Ask: "Continue with app 3, or stop?" |
| User Ctrl-C during image-upload | The in-flight image may still push — warn that a dangling image could exist at the registry. Offer `/ags-extend observe` to check. |

## Examples

### Single-app deploy, happy path

```
User: /ags-extend deploy

Skill: In ./matchmaking-override (Makefile + Dockerfile + go.mod). Reading .env…

       Prerequisites:
         ✓ extend-helper-cli 0.4.1
         ✓ docker 25.0.3 (daemon running)

       Project: vip-matchmaking
       Target:  https://my-studio.accelbyte.io / my-studio-dev

       Apps available to deploy:
         1. matchmaking-override  (go)  ./matchmaking-override

       Only one app. Deploy it? (yes/no)

User: yes

Skill: ━━━ 1/1: matchmaking-override ━━━
       [image-upload output streams]
       ✓ Built image
       ✓ Pushed to registry

       [deploy output streams]
       ✓ Deploy registered

       Deploy complete. All apps deployed.

         ✓ matchmaking-override  image-upload ok, deploy ok  https://my-studio.accelbyte.io / my-studio-dev

       Next:
         • /ags-extend observe — pull logs and status
```

### Multi-app, one fails

```
Skill: ━━━ 1/3: matchmaking-override ━━━
       ✓ image-upload ok
       ✓ deploy ok

       ━━━ 2/3: match-event-handler ━━━
       [image-upload output]
       ✗ Error: failed to solve: /app/pkg/pb/events/events.pb.go: no such file or directory

       Known error: proto files not generated. Fix:
         cd match-event-handler && make proto

       Continue with app 3, or stop here? (continue/stop)

User: stop

Skill: Stopped after app 2.

       Deploy summary:
         ✓ matchmaking-override  image-upload ok, deploy ok
         ✗ match-event-handler   image-upload failed — run `make proto` and retry
         ⏸ leaderboard-ext        not attempted
```

### Prod-looking namespace

```
Skill: Project: vip-matchmaking
       Target:  https://my-studio.accelbyte.io / my-studio-prod

       ⚠ Target namespace "my-studio-prod" looks like production. Proceed? (yes/no)

User: yes, I know

Skill: Apps available to deploy:
         …
```

### Credentials not set

```
Skill: Apps available to deploy:
         1. match-event-handler   (go)  ./match-event-handler  ⚠ credentials not set

       Deploy which? (all / 1 / none)

User: 1

Skill: match-event-handler has placeholder credentials. Deploying will push
       the image successfully, but the app will fail to authenticate with
       AGS when it starts. Proceed anyway? (yes/no)

User: no

Skill: Stopped. Fill in AB_CLIENT_ID and AB_CLIENT_SECRET in
       ./match-event-handler/.env, then re-run /ags-extend deploy.
```

### Auth expired mid-image-upload

```
Skill: [image-upload output]
       ✗ unauthorized: authentication required

       Known error: registry session expired. Fix (see references/deploy/cli-commands.md):
         1. Confirm AB_BASE_URL is set (export it or put it in a .env in this dir).
            Current value: https://my-studio.accelbyte.io
         2. Run:  extend-helper-cli login   (no flags — opens the browser)

       Shall I run the login command now? (yes/no)

User: yes

Skill: [runs extend-helper-cli login; browser opens for user]
       [retries image-upload]
```

### .env has TBD

```
Skill: In ./matchmaking-override (Makefile + Dockerfile). Reading .env…

       ✗ AB_NAMESPACE = "TBD"
       ✗ AB_BASE_URL  = "TBD"

       Stopping — these need real values. Fill them in
       ./matchmaking-override/.env, then re-run /ags-extend deploy.
```
