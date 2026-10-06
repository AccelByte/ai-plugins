---
last-verified: 2026-09-23
sources:
- https://github.com/AccelByte/accelbyte-ags-cli/releases/latest
see-also:
- '[install-cli.md](../../ags/subskills/install-cli.md)'
- '[cli-commands.md](../references/deploy/cli-commands.md)'
- '[init.md](init.md)'
---

# Extend CLI Installer (pointer)

Extend no longer has its own CLI. Run `/ags install-cli` — it installs the single `ags` binary that also drives `ags extend` (Extend app lifecycle: `create-app`, `deploy-app`, `image-upload`, `docker-login`, `update-var`, `update-secret`, `tunnel`, `clone-template`, and more — see `references/deploy/cli-commands.md`).

Two things a reader migrating from the retired `extend-helper-cli` needs to know that `/ags install-cli` doesn't cover, because they only matter to a migrating reader:

1. **The CLI's own login env vars changed name — the app's own `.env` did not.** `extend-helper-cli login` read `AB_BASE_URL` / `AB_CLIENT_ID` / `AB_CLIENT_SECRET` from the same shell environment (often the app's own `.env`, since that CLI was typically invoked from inside the app directory). `ags auth login` is separate from any app: it reads `AGS_BASE_URL` / `AGS_CLIENT_ID` / `AGS_CLIENT_SECRET` from your shell environment or CI secrets — never from a `.env` file. Rename the deployer-facing copies of these values in your shell profile and CI secrets. Do **not** rename the app's own `AB_BASE_URL` / `AB_CLIENT_ID` / `AB_CLIENT_SECRET` inside its `.env` — the AccelByte SDK the app links against still reads those under the `AB_` prefix; that's the app's own identity, unrelated to how you log the CLI in.
2. **Authentication is no longer automatic.** `extend-helper-cli login` auto-registered its own IAM client on first use. `ags auth login` requires a public IAM client to already exist, with its redirect URI registered beforehand (`/ags install-cli` covers provisioning this). For CI, `ags auth login --grant client-credentials` needs a separate confidential IAM client instead.

Run `/ags install-cli` now.
