---
last-verified: 2026-06-24
sources:
- https://cli.github.com/
- https://github.com/cli/cli
- https://github.com/cli/cli/blob/trunk/docs/install_linux.md
- https://docs.github.com/en/authentication/connecting-to-github-with-ssh
---

# Acquiring a Git Repository

Shared procedure for any skill step that fetches a git repository — a plain `git clone`, a `git submodule add`, or a package manager that resolves a git URL itself (for example Unity Package Manager). When the naive command works, you are done. When it fails, walk this ladder **in order** before giving up or asking the user to do it by hand.

This is host-agnostic. The authenticated-access path differs for GitHub (where `gh` is the lowest-friction option) versus other hosts (GitLab, Bitbucket, self-hosted), so step 2 forks accordingly.

> Repository URLs, tags, and install paths are owned by the calling skill and its references. This file owns only *how to acquire a repo you already have the URL for*. Do not invent repository URLs here.

## When the repo is private

A private or invite-only repository is the common reason the naive command fails. The failure is usually **misleading** — an unauthenticated request to a private repo does not say "access denied," it says the repo does not exist. Treat these as authentication failures, not as a wrong URL or a missing repo:

- `Repository not found` / `ERROR: Repository not found`
- `fatal: could not read Username for 'https://github.com'` (or a hang waiting on username/password)
- `remote: Repository not found` / HTTP `403` / HTTP `404` on a URL you were given as valid
- `Permission denied (publickey)` (SSH, no usable key)

If the URL was provided by the calling skill or the user, do **not** rewrite it or conclude the repo is gone. Move to step 2.

## The ladder

### Step 1 — Naive fetch

Run the command the calling skill specifies, unchanged:

- `git clone <url> <dest>`
- `git submodule add <url> <path>` (only inside a git worktree)
- package-manager resolution of a git URL (for example, a Unity `Packages/manifest.json` entry)

If it succeeds, stop. If it fails with an authentication signature (see above), go to step 2. If it fails for an unrelated reason (network down, disk, bad path), surface that directly — do not climb the ladder.

### Step 2 — Authenticated access

**GitHub host → use `gh`.** This is preferred over SSH-key setup because authenticating `gh` also configures git itself, so the original step-1 command then works unchanged — including `git submodule add` and package-manager git resolution, which have no `gh` equivalent.

**2a — Is `gh` installed?**

```bash
command -v gh && gh --version    # macOS / Linux
```
```powershell
Get-Command gh -ErrorAction SilentlyContinue; gh --version   # Windows
```

If present, go to 2c.

**2b — Install `gh` (confirm before running; never `sudo` without confirmation).** Detect the available package manager and propose the matching documented command. Do not fabricate an install command — if none of these fit, point the user at `https://cli.github.com/`.

| Platform | Detect | Install |
|---|---|---|
| macOS | `command -v brew` | `brew install gh` |
| Windows | `winget` / `scoop` / `choco` present | `winget install --id GitHub.cli` (or `scoop install gh` / `choco install gh`) |
| Fedora / RHEL | `command -v dnf` | `sudo dnf install gh` |
| Arch | `command -v pacman` | `sudo pacman -S github-cli` |
| openSUSE | `command -v zypper` | `sudo zypper install gh` |
| Debian / Ubuntu | `command -v apt` | Follow the official apt-repo setup at `https://github.com/cli/cli/blob/trunk/docs/install_linux.md` — it adds GitHub's keyring and repo and changes over time; do not reproduce it from memory |
| No package manager / unsupported | — | Download the binary for the OS/arch from `https://github.com/cli/cli/releases` |

**2c — Authenticate (point at it; don't run the interactive browser flow for the user).**

```bash
gh auth status                   # already authenticated? then retry step 1
gh auth login                    # interactive — let the user complete it
```

When `gh auth login` asks **"Authenticate Git with your GitHub credentials?"**, the user must answer yes — that is the step that installs `gh` as git's credential helper. If they skipped it, run `gh auth setup-git` explicitly. This is load-bearing: without it, `gh` is authenticated but `git` (and any package manager that shells out to git) is not, so submodule and package-manager fetches still fail.

For headless / CI environments, set the `GH_TOKEN` environment variable instead of the interactive flow.

Once authenticated, **retry the exact step-1 command.** Do not switch the workflow to `gh repo clone`; the goal is to make the original clone / submodule / package-manager command succeed.

**Non-GitHub host (GitLab, Bitbucket, self-hosted) → SSH or a credential helper.** `gh` does not apply. Either:

- Add an SSH key to the account and use the SSH-form URL (see the host's own SSH-key docs; GitHub's equivalent is `https://docs.github.com/en/authentication/connecting-to-github-with-ssh`), or
- Configure a git credential helper / personal access token for HTTPS.

Then retry step 1.

### Step 3 — Manual hand-off

If authenticated access cannot be established (no org invite yet, restricted network, the user declines to install or authenticate), fall back to a copy the user supplies:

- Ask the user for the **local filesystem path** to a copy they already have, or one they download in a browser where they are already signed in (private repos offer a "Download ZIP" / release archive).
- Read or use the repo from that path. If the workflow only needs one file's contents, the user can paste that file inline — but do not ask anyone to paste a whole repository into the chat.

**Consent boundary.** This step is allowed **only** because the user explicitly provides the path. It is not license to go looking: do not search local drives, home directories, or other workspaces for a copy on your own. A user-provided path is consented; an agent-discovered one is not.

**Caller policy wins.** Some callers forbid even a user-provided local copy because the install must trace to a pinned, reproducible source — an SDK plugin install, for example. When the calling skill says so, the manual fallback is a **user-confirmed official release archive at a pinned version**, not an arbitrary local directory. Follow the stricter caller rule over this generic step.

## Quick reference

1. Try the command as given. Auth-shaped failure → step 2; unrelated failure → report it.
2. GitHub → install `gh` if absent, `gh auth login` + `setup-git`, **retry the original command**. Other hosts → SSH key or credential helper, then retry.
3. Only if 1–2 fail → ask the user for a local path. Never search for one yourself.
