---
last-verified: 2026-05-07
sources:
- https://github.com/AccelByte/extend-helper-cli
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[cli-commands.md](cli-commands.md)'
- '[rollout.md](../production/rollout.md)'
---

# Common Deploy Errors

## Build Errors

### `Dockerfile not found`

**Cause:** Running `image-upload` from the wrong directory, or the app directory wasn't cloned from a template.

**Fix:** Ensure you're running from the app directory (e.g. `./matchmaking-override`), or pass `--work-dir {app-path}`. If the Dockerfile is genuinely missing, the app directory may not have been scaffolded correctly — run `/ags-extend init` again.

---

### `unauthorized: authentication required`

**Cause:** Not logged in to the AccelByte registry, or the session has expired.

**Fix:** Ensure `AB_BASE_URL` is set (export it, or place it in a `.env` file in the CLI's cwd — ask the user for the value if not known). Then run `extend-helper-cli login` (no flags — see `references/deploy/cli-commands.md#authentication`). The browser opens to the Admin Portal targeting `AB_BASE_URL`. Once signed in, retry the failing command.

---

### `failed to solve: ... no such file or directory` (during Docker build)

**Cause:** A file referenced in the Dockerfile is missing. Typically happens when the template was cloned but required generated files (e.g. proto outputs) are absent.

**Fix:** Check the app's README for any pre-build steps (e.g. `make proto`). Run those steps first, then retry `image-upload`.

---

### `.env: AB_CLIENT_ID is not set`

**Cause:** The app's `.env` file has a placeholder value for `AB_CLIENT_ID` or `AB_CLIENT_SECRET`.

**Fix:** Create an OAuth client in the AGS Admin Portal, then fill in the values in `.env`. Do not commit `.env` to version control.

## Deploy Errors

### `app not found`

**Cause:** The app hasn't been registered in AGS yet, or the `--app` name doesn't match what's registered.

**Fix:** Ensure `--app {app-name}` matches exactly the name registered in the Admin Portal. App names are case-sensitive and must be kebab-case.

---

### `namespace not found` / `403 Forbidden`

**Cause:** The namespace doesn't exist in the target environment, or the OAuth client doesn't have deploy permissions.

**Fix:** Verify the namespace passed via `--namespace` (or `AB_NAMESPACE` in the app's `.env`) and the `AB_BASE_URL` value used for the deploy. Check that the OAuth client has the required AGS permissions for deploying Extend apps.

---

### `timeout: context deadline exceeded` (during deploy)

**Cause:** AGS took too long to start the app after deploy. Can happen with large images or when the environment is under load.

**Fix:** Wait 1–2 minutes and check status with `extend-helper-cli get-app-info --namespace {ns} --app {app} --path /appStatus` (see `references/observe/cli-commands.md`). If the app doesn't reach `Running` state, check logs with `/ags-extend observe`.

---

### `resource limit exceeded`

**Cause:** The resource configuration for the app (set via `extend-helper-cli create-app --cpu`/`--memory` or updated in the Admin Portal) exceeds what the namespace allows. For the full breakdown of which resource flags exist on which subcommands, see `references/deploy/cli-commands.md`.

**Fix:** Lower the per-app values in the Admin Portal (app detail → resource configuration), or raise the namespace's overall allocation. If the namespace cap itself is the bottleneck, raise it in the Admin Portal or contact AccelByte. Check `references/init/resource-defaults.md` for hard per-app limits.
