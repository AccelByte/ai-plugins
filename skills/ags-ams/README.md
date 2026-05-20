---
last-verified: 2026-05-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-launch-preparation/
see-also:
- '[SKILL.md](SKILL.md)'
- '[overview.md](references/overview.md)'
---

# ags-ams

One skill, one entry point. `/ags-ams <subskill>` covers the full AMS lifecycle — from understanding what AMS is to shipping a fleet to production and monitoring it.

---

## Intended Workflow

```
 0. ask      — understand AMS, instance types, fleet sizing, how it fits AGS
 1. account  — activate AMS, create an account, link namespaces
 2. sdk      — integrate the DS binary with the AMS watchdog (ready, heartbeat, drain)
 3. debug    — test locally with the AMS Simulator (optional but recommended)
 4. upload   — upload the DS build to AMS using the AMS CLI
 5. fleet    — create and configure fleets (instance type, scaling, regions, claim keys)
 6. session  — configure session templates to claim DS from AMS
 7. observe  — fleet metrics, server logs, and artifacts
 8. doctor   — read-only diagnosis when something's off
 9. rollout  — DS version updates, blue/green, canary, fallback fleets, launch prep
```

`init` runs steps 1–6 end-to-end for a clean-slate AMS setup.

`ask` and `doctor` are available at any point and never modify anything — `ask` answers concept questions; `doctor` narrows a symptom to a cause and hands off to whatever subskill owns the fix.

---

## Subskills

| Subskill | What it does |
|---|---|
| `ask` | Answers questions about AMS — architecture, fleet sizing, instance types, when to use it |
| `account` | Activates AMS, creates an AMS account, links/unlinks namespaces |
| `sdk` | Integrates the DS binary with the AMS watchdog via the AGS SDK or raw WebSocket |
| `debug` | Tests DS integration locally using the AMS Simulator |
| `upload` | Uploads a DS build to AMS using the AMS CLI |
| `fleet` | Creates and configures fleets — type, instance type, scaling, regions, claim keys |
| `session` | Configures session templates to claim DS from AMS |
| `init` | End-to-end setup: account → sdk → upload → fleet → session |
| `observe` | Fleet metrics, live server logs, collected artifacts, Grafana dashboards |
| `doctor` | Read-only diagnosis: symptoms → likely causes → next step |
| `rollout` | DS version migration, blue/green, canary, fallback fleets, launch preparation |

---

## Structure

```
ags-ams/
  SKILL.md              — router
  README.md             — this file
  subskills/
    ask.md
    account.md
    sdk.md
    debug.md
    upload.md
    fleet.md
    session.md
    init.md
    observe.md
    doctor.md
    rollout.md
  references/
    overview.md         — AMS architecture, watchdog protocol, fleet concepts, limits
    glossary.md         — AMS terms in one place
    faq.md              — common questions (when to use AMS, version updates, monitoring)
    cli-commands.md     — AMS CLI and AMS Simulator command reference
```

---

## Notes

- Fleet configuration and session templates are Admin Portal-only — no CLI commands create fleets.
- The AMS CLI (`ams`) is used only for DS binary upload. Download from Admin Portal → AMS → Download Resource, or directly from the CDN — see `references/cli-commands.md#obtaining-the-cli-tools`.
- The AMS Simulator (`amssim`) emulates the watchdog locally. Same download options.
- DS binaries must target Linux. Both x86/x64 and ARM are supported.
- `observe` and `doctor` are read-only — they never modify fleet config or DS state.
- Bare metal capacity requires a minimum 4-week lead time for large orders. Start capacity planning 3+ months before a major launch.
