---
last-verified: 2026-05-07
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[SKILL.md](SKILL.md)'
- '[overview.md](references/overview.md)'
---

# ags-extend

One skill, one entry point. `/ags-extend <subskill>` covers everything from understanding what Extend is to shipping and monitoring a live app.

---

## Intended Workflow

```
 0. ask          — understand what Extend is and pick the right pattern
 1. design       — shape a multi-app project before scaffolding (optional; read-only)
 2. wizard       — interview → clone templates → apply patches
 3. install-dep  — install project dependencies (go mod tidy, pip install, etc.)
 4. install-cli  — install extend-helper-cli (required to deploy)
 5. install-mcp  — install Extend MCP servers for AI IDE integration (optional)
 6. proto        — regenerate proto-derived code after contract or SDK changes
 7. debug        — run and test locally before shipping
 8. test         — unit / integration / contract tests
 9. deploy       — build, push, and deploy to AGS
10. ci           — wire deploys into GitHub Actions / GitLab CI
11. observe      — check logs, health, and live metrics
12. doctor       — read-only diagnosis: symptoms → likely causes → next step
13. upgrade      — guided SDK or proto version bump
```

`init` runs steps 2–5 end-to-end for a clean-slate setup.

`ask` and `doctor` are available at any point and never modify files — `ask` answers concept questions; `doctor` narrows a symptom to a cause and hands off to whatever subskill owns the fix.

`design` is a read-only design session for multi-app projects (e.g. "a tournaments product needs a matchmaking override + a placement event handler + a leaderboard service"). Skip it for single-app work.

`install-mcp` is optional. It connects your AI IDE to Extend so you can vibe-code the implementation. Best set up before step 7 if you want it.

`install-cli` is a prerequisite for `deploy` and `ci`. If you skip it, `deploy` will detect the missing CLI and prompt you to run it.

`proto` is idempotent — run it any time the SDK bump includes contract changes or you pull a new template version.

`upgrade` handles SDK/proto version bumps and delegates proto regen to `proto`. On breaking changes it surfaces every affected site with file:line; it does not auto-modify handler code.

---

## Subskills

| Subskill | What it does |
|---|---|
| `ask` | Answers questions about Extend — patterns, when to use it, how it works |
| `design` | Read-only multi-app design session: shapes pattern combinations and data/contract boundaries before scaffolding |
| `wizard` | Guides you through what you want to build, clones the right templates, applies patches |
| `install-dep` | Checks language runtimes and installs project-level dependencies |
| `install-cli` | Installs `extend-helper-cli` |
| `install-mcp` | Installs the two Extend remote MCP servers for AI IDE integration |
| `init` | End-to-end setup: runs wizard → install-dep → install-cli → install-mcp |
| `proto` | Regenerates proto-derived code (Go/Python/Java/C#) after contract or SDK bumps |
| `debug` | Runs an Extend app locally and guides you through testing it |
| `test` | Writes and runs unit, integration, or contract tests |
| `deploy` | Builds, pushes, and deploys one or more apps to AGS |
| `ci` | Wires `extend-helper-cli image-upload` + `deploy` into GitHub Actions or GitLab CI |
| `observe` | Fetches logs, health status, and runtime signals for deployed apps |
| `doctor` | Read-only symptom → cause diagnosis; hands off to the subskill that owns the fix |
| `upgrade` | Guided SDK or proto contract version bump with breakage surfacing |

---

## Structure

```
ags-extend/
  SKILL.md              — router
  README.md             — this file
  subskills/
    ask.md
    design.md
    wizard.md
    install-dep.md
    install-cli.md
    install-mcp.md
    init.md
    proto.md
    debug.md
    test.md
    deploy.md
    ci.md
    observe.md
    doctor.md
    upgrade.md
  references/
    overview.md                  — shared: what Extend is
    faq.md                       — shared: common questions
    glossary.md                  — shared: terms in one place
    init/
      templates.md               — template repos by pattern + language
      resource-defaults.md       — CPU/memory defaults for manifest generation
      manifest-schema.md         — design proposal for a future project-level manifest (not implemented)
    catalogs/
      overridables.md            — known override surfaces (pointer + starter table)
      events.md                  — known event types (pointer + starter table)
    deploy/
      cli-commands.md            — extend-helper-cli deploy commands
      common-errors.md           — known deploy errors and fixes
    debug/
      local-run.md               — startup commands per app type + language
      test-guide.md              — how to invoke and verify a running app
    test/
      unit-<language>.md         — per-language unit test conventions
      integration.md             — integration test setup + runner
      contract.md                — proto contract check
    ci/
      github-actions.md          — canonical workflow template
      gitlab.md                  — canonical pipeline template
    observe/
      cli-commands.md            — extend-helper-cli observability commands
      signal-guide.md            — how to interpret log output and app statuses
    proto/
      workflow.md                — per-language regen commands + toolchain
      conventions.md             — naming / versioning conventions
    upgrade/
      sdk-bumps.md               — per-language install/bump commands
      proto-changes.md           — handling proto contract diffs
      breaking-changes.md        — classification of breakage patterns
    production/
      resources.md               — memory/CPU tuning guidance
      scaling.md                 — replica ceilings, throughput limits
      security.md                — secret hygiene, OAuth permissions
      rollout.md                 — rollout strategies + rollback
      slo.md                     — SLI/SLO hygiene for Extend apps
    cookbook/
      rate-limiting.md           — token bucket / leaky bucket patterns
      caching.md                 — cache placement + invalidation
      idempotency.md             — event handler idempotency
      retries.md                 — retry + backoff guidance
      feature-flags.md           — runtime toggles inside handlers
    tutorials/
      first-app.md               — narrated first-app walkthrough
    patches/                     — structured prompts used by `wizard` (NoSQL setup, etc.)
```

---

## Notes

- `references/patches/` — structured prompts used by `wizard` to modify templates (e.g. NoSQL setup). Not diff files — written as prompts so they survive template churn.
- `install-dep` detects runtimes but does not install them. If a runtime is missing it gives you the download link and skips that app.
- `install-mcp` configures two MCP servers: `ags-api` (AGS API via npx) and `ags-extend-sdk` (Extend SDK context via Docker). Supports Claude Code, Cursor, Windsurf, and Kiro.
- `install-cli` downloads `extend-helper-cli` as a direct binary from GitHub releases. Supports macOS (amd64/arm64), Linux (amd64/arm64), and Windows (amd64).
