---
last-verified: 2026-05-09
sources:
- https://accelbyte.io/development-toolkit
see-also:
- '[handoff.md](../../subskills/handoff.md)'
---

# Ecosystem — ADT (AccelByte Development Toolkit)

Pointer reference. ADT is a **standalone** AccelByte product — entirely separate from AGS — and has its own peer skill (`/adt`). This file describes what ADT is and when an AGS conversation should hand off to `/adt`.

**Routing rule.** Anything ADT-specific (build distribution, crash reporting, playtest, ADT SDKs, ADT CLI, BlackBox) belongs in `/adt`. `/ags` only covers conceptual "what is ADT?" / "should I add ADT?" questions. Once the answer is "yes, let's set it up," the user should be in `/adt`.

---

## What ADT is

ADT is a developer-tools suite for build distribution, crash reporting, and playtest coordination. It replaces the fragmented zip-and-share / unmanaged-access / hard-to-reproduce-crashes workflow with a single platform purpose-built for fast game development. Originally launched as **BlackBox** (a crash-reporting tool with video capture); rebranded under AccelByte in March 2023.

## Three core modules

### 1. Build Distribution

Desktop app for sharing builds with internal and external partners.

- **Smart Builds** — content-aware diffing. Only changed files are uploaded or downloaded, not the full build. An 80 GB build downloads once; subsequent updates take seconds.
- Builds organized into **Channels** (audience groups) and **Tracks** (per-platform Last Known Good versions).
- Auto-download, auto-deploy, auto-launch on target.
- Local Cache Server for studios with on-site infra.
- Studio SSO + role-based permissions for build access.
- Supports **Windows, Linux, macOS, PS5, PS4, Xbox Series X, Xbox One, Nintendo Switch, Android, iOS** (client and server builds).

### 2. Health (Crash & Issue Reporting)

Web portal for tracking crashes and errors.

- **10-second pre-crash video replay** on desktop and console — engineers see exactly what happened before the crash.
- Symbolicated stack traces with session logs.
- Automatic crash grouping and deduplication.
- One-click Jira ticket creation from a crash or issue.
- In-game issue reporter — fully-loaded ticket in under 10 seconds, auto-attaches logs/screenshots/build info.
- **AI Assistant (alpha)** — analyzes crash event + call stack + engine version + platform + build metadata + session logs + crash video to return root-cause hypotheses, similar historical crashes, and suggested fixes. With MCP source integration, can identify the specific file:line, propose a fix, stage it as a local commit for developer review.

### 3. Playtest

- Quick and scheduled playtests.
- Remote build removal from player machines.

---

## SDK / tooling support

| Tool | Platform |
|---|---|
| ADT Hub desktop app | Windows, macOS |
| ADT CLI | Cross-platform |
| ADT Unreal Engine SDK | UE 4.27 – 5.6 |
| ADT Unity SDK | Unity |
| Custom C / C++ engine support | Build distribution only |

## Measured impact (from AccelByte materials)

- **400 TB** of data saved using Smart Builds (across the customer base).
- **10x** reduction in end-to-end build delivery time.
- **>1,000 hours** of developer time saved using smart delivery.

---

## When to suggest ADT during an AGS conversation

Strong signals:

- **Build distribution headache** — studio talks about zip-and-share, slow build delivery, FTP servers, copies-on-Drives, cert-blocked QA cycles.
- **Crash triage backlog** — long time to triage / fix crashes; no pre-crash replay; crash logs scattered across email / Slack.
- **Playtest coordination overhead** — scheduling playtests is painful; build removal after playtest is manual.
- **Multi-platform launch** — studios shipping on 3+ platforms benefit disproportionately because ADT collapses platform-specific build tooling.
- **Console DevKits** in the picture — ADT's PS4/PS5/Xbox console support is a core differentiator vs. point solutions.

Soft signals:

- Studio mentions Perforce Helix or in-house build tooling pain.
- Studio mentions Sentry or Backtrace for crash reporting (ADT competes with these on integration depth, not just on crash reporting).
- Studio is using AGS analytics and considers wiring ADT crash data into the same pipeline.

## When ADT isn't the right answer

- The studio doesn't ship internal builds across teams or doesn't have a crash-triage problem yet.
- The studio uses a tightly integrated DCC pipeline (Houdini, custom asset systems) that already handles build distribution end-to-end.
- The studio is purely web-based / browser-game and doesn't have native build artifacts.

---

## Relationship to AGS and Extend

ADT is independent but plays nicely with AGS:

- AGS customers can route ADT crash and issue data into AGS analytics pipelines.
- Extend's **Event Handler** pattern can route ADT crash events to external systems (Slack, PagerDuty, custom dashboards). The skill for that work is `/ags-extend`, not `/ags`.
- ADT's AI Assistant uses the same MCP model as AGS's MCP servers (`install-mcp` in both `/ags` and `/ags-extend`).

---

## Where to send users for the actual ADT work

`/ags` does not own ADT. When the user has decided they want to evaluate or set up ADT, point them at the peer skill:

> Run `/adt` for ADT — build distribution, crash reporting, playtest, the ADT Hub, the ADT SDKs. ADT is a separate AccelByte product with its own skill; `/ags` doesn't own its workflows.

For broader context outside this repo:

- AccelByte ADT product page: `https://accelbyte.io/development-toolkit`.
- AccelByte ADT docs: `https://docs.accelbyte.io/`.
- AccelByte sales for licensing and console DevKit setup.
