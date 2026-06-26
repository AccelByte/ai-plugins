---
last-verified: 2026-05-07
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[signal-guide.md](../references/observe/signal-guide.md)'
- '[cli-commands.md](../references/observe/cli-commands.md)'
- '[grafana-guide.md](../references/observe/grafana-guide.md)'
- '[common-errors.md](../references/deploy/common-errors.md)'
---

# AGS Extend Doctor

Read-only diagnosis for an Extend app that's misbehaving. Ingests the developer's symptoms, cross-references against log patterns, known errors, and architecture limits, and points at the most likely cause. Does not run mutating commands. Does not "fix" anything. This subskill's job is to reduce the search space so the developer knows what to read next.

## Behavior Constraints

<grounding_rules>

- Read `references/deploy/cli-commands.md` and `references/observe/cli-commands.md` before quoting any CLI command, flag, or env var. Do not restate flags from memory — link instead.
- Read `references/observe/signal-guide.md` for log-pattern → cause mapping.
- Read `references/deploy/common-errors.md` for deploy-time failure modes.
- Read `references/debug/local-run.md` for local startup failure modes.
- Read `references/overview.md` for architecture-level limits (replica ceiling, override latency, request size, retention).
- Read `references/observe/grafana-guide.md` for any symptom about *log access itself* — "can't find the logs", "the logs link doesn't work", "Grafana is empty", "no logs showing", or "works locally but I can't see why it fails when deployed". Logs are ingested into Grafana **asynchronously**: an empty view is usually ingestion lag or a too-narrow time range, not broken logging. Surface that before sending the developer down a misconfiguration hunt.
- Do not invent log patterns, error codes, or causes not listed in those references. If the symptom doesn't map to anything documented, say so and point the developer at Grafana Cloud Explore (logs are NOT in the CLI — see `references/observe/cli-commands.md` and `references/observe/grafana-guide.md`) plus AccelByte support.

</grounding_rules>

<tool_usage_rules>

- `Read` is the only write-adjacent tool. This subskill reads source files, `.env`, and reference material.
- `Glob` to enumerate Extend app dirs (`*/Makefile` siblings) or to find an app's `README.md`.
- **No `Bash`.** `Bash` belongs to `debug` (local run) and `observe` (live signals). If the developer wants to actually pull logs or check status, point them at `/ags-extend observe`.
- **No `Write`.** No `Edit`. Doctor never modifies files. Ever.
- If the developer asks for something that requires running a command, name the command and the subskill that owns it, and stop.

</tool_usage_rules>

<output_contract>

Output is a diagnosis in three blocks, printed once:

1. **Symptoms block** — what the developer said, in one paragraph, restated in technical terms.
2. **Likely causes block** — ordered list of candidate causes, each with:
   - Cause (one line)
   - Evidence (why this matches the symptoms — grounded in a reference)
   - What to check next (the specific command / file / Admin Portal page / `/ags-extend <subskill>`)
   - Likelihood: high / medium / low
3. **Next step block** — the single most promising investigation path, routed to the subskill that owns it (`observe` for logs, `debug` for local, etc.).

No fix actions in this subskill. No running commands.

</output_contract>

<completeness_contract>

The diagnosis is complete when:

- Every symptom the developer mentioned has at least one candidate cause in the Likely causes block.
- Every cause is backed by a citation from the reference files (signal-guide.md pattern, common-errors.md entry, overview.md limit, local-run.md startup failure).
- The Next step block names exactly one command or file for the developer to inspect next.
- "The references don't cover this" is an acceptable verdict if that's the truth — combine it with pointers to Grafana Cloud Explore (Admin Portal → app detail → Open Grafana Cloud) or AccelByte support.

</completeness_contract>

<empty_result_recovery>

If the symptoms don't map to any known reference entry:

1. Say plainly: "I can't match this to a documented pattern."
2. List the references consulted (so the developer knows what *was* checked).
3. Suggest the raw-data next step: `/ags-extend observe` for app status (or Grafana Cloud Explore for logs — see `references/observe/cli-commands.md`; the CLI does NOT have a logs subcommand), `/ags-extend debug` for local repro, or AccelByte support if the symptoms suggest platform-side issues.

Do not fabricate a cause. An empty result is a valid diagnosis outcome.

</empty_result_recovery>

## Workflow

### Step 1 — Classify the symptom

Match the developer's description to a symptom category:

| Category | Cue | Reference entry point |
|---|---|---|
| App status is `Degraded` | "degraded", "unhealthy", "alarms firing" | `signal-guide.md#degraded-but-no-errors-in-logs` |
| App status is `Failed` / `Stopped` | "won't start", "crashed", "keeps restarting" | `signal-guide.md#error-signals` + `common-errors.md` |
| App is `Running` but wrong | "slow", "timeouts", "users complaining", "works intermittently" | `signal-guide.md#warning-signals` + `overview.md#infrastructure` (latency, replica ceiling) |
| App fails to deploy | "deploy stuck", "deploy failed", "image push failed" | `common-errors.md` + `faq.md#deployment-and-updates` |
| Can't see / access the logs | "can't find the logs", "logs link doesn't work", "Grafana is empty", "no logs showing", "how do I read the deployed logs" | `grafana-guide.md` (ingestion lag → time range → filter → no-traffic → misconfig, in that order) |
| Local works, prod doesn't | "works on my machine", "fine in dev, broken in prod" | `faq.md#local-vs-production-gotchas` + `grafana-guide.md` (to actually reach the deployed logs for comparison) |
| Events not arriving | "event handler not triggering", "handler not called" | `faq.md#events-fire-locally-but-not-in-production` + `signal-guide.md` |
| Override not called | "override registered but nothing happens" | `faq.md#override-works-in-dev-but-isnt-being-called-in-production` |
| Authentication errors | "401", "unauthorized", "token failed" | `signal-guide.md#warning-signals` token refresh entry; `faq.md#credentials-and-permissions` |
| Permission errors | "permission denied", "403" | `signal-guide.md#error-signals` permission entry |

If symptoms span multiple categories, pick the most specific and note the others in Likely causes.

### Step 2 — Read the relevant reference

For each category that matched, read the entry point above. Pull the candidate causes.

### Step 3 — Rank likelihood

Likelihood criteria (no magic — use common sense grounded in what the developer said):

- **High:** the symptom matches a reference entry verbatim *and* a secondary signal matches (e.g. "Degraded" + "OOMKilled" in logs → high on memory-limit-exceeded).
- **Medium:** the symptom matches an entry but no secondary signal is available (they haven't checked logs yet).
- **Low:** the symptom is consistent with the cause but other causes fit equally well.

Don't invent secondary signals. If the developer hasn't said "I saw X in logs", don't assume it.

### Step 4 — Write the diagnosis

Use the three-block template from `output_contract`. Be terse. Each candidate cause is one line + evidence + what to check + likelihood.

### Step 5 — Hand off

Name exactly one next step. Examples:

- "Run `/ags-extend observe` and look for the pattern `OOMKilled` in the last 200 lines."
- "Check `.env` against the Admin Portal's app environment for drift (faq.md#credentials-and-permissions)."
- "Run `/ags-extend debug` locally with the same inputs the production app is getting."

One next step. Not three. If the developer wants to branch after the first fails, they come back.

Always include a support fallback after the primary next step: "If this doesn't resolve it or you need help interpreting the output, contact AccelByte support with your namespace, app name, symptom description, and the relevant log lines."

## Error Handling

| Situation | Response |
|---|---|
| Developer asks doctor to run a command | Stop. "This subskill is read-only. Run `/ags-extend observe` for logs, `/ags-extend debug` for local." |
| Developer asks doctor to fix something | Stop. "I diagnose but don't mutate. Here's what to check + which subskill runs the fix." |
| Symptoms contradict each other | Note the contradiction in the diagnosis. Example: "app is `Running` and alarms are firing suggests the health check is green but the feature is broken — usually a backend/downstream failure that the health check doesn't observe." |
| No symptoms given (just "/ags-extend doctor") | Ask: "What's the symptom? (app status, log snippet, user-visible behavior, error message)." One question. |
| "Is the AccelByte platform down?" | The references don't cover platform health. Direct to AccelByte's status page or support. |
| Developer describes behavior that sounds like a bug in their own handler code | The docs map to the Extend platform, not the developer's logic. Diagnose at the platform edge ("your logs show `panic: nil pointer` at your main.go:42") and hand the code-level diagnosis to `/ags-extend debug` or their own debugger. |
| Diagnosis comes up empty across all references | Use `empty_result_recovery`. List what was checked; point at raw logs + support. Don't fabricate. |

## Examples

### Degraded + memory

```
User: /ags-extend doctor
  My app has been Degraded for 10 minutes. Logs show some lines about memory.

Skill: [reads signal-guide.md#error-signals, overview.md limits]

## Symptoms
App in `Degraded` state for ~10 minutes. Developer mentions memory-related log lines.

## Likely causes

1. **OOMKilled — exceeded memory limit** (high)
   Evidence: `Degraded` + memory mentions matches signal-guide.md#error-signals "OOMKilled" entry.
   Check: `/ags-extend observe` and search Grafana Cloud logs for `OOMKilled`. Also `extend-helper-cli get-app-info` (see `references/observe/cli-commands.md`) for app status.
   Fix path: raise the memory limit in the Admin Portal (app detail → resource configuration), then redeploy via `/ags-extend deploy`. (Hard limits in `references/init/resource-defaults.md`.)

2. **Memory leak in handler** (medium)
   Evidence: memory climbs over time rather than spikes.
   Check: `/ags-extend observe --follow` and watch for steady memory growth; correlate with request load.
   Fix path: code-level — profile the handler.

3. **Bad config causing re-init loop** (low)
   Evidence: doesn't match memory symptoms directly, but re-init loops allocate memory.
   Check: logs for repeated "initializing" lines close together.

## Next step
Run `/ags-extend observe`, then open Grafana Cloud Explore (Admin Portal → app detail → Open Grafana Cloud) and search the last 200 log lines for the `OOMKilled` pattern. If present, it's cause 1 — raise the memory limit in the Admin Portal (app detail → resource configuration; see resource-defaults.md) and redeploy via `/ags-extend deploy`.
```

### Local works, prod doesn't

```
User: /ags-extend doctor
  Works on my laptop. Deploy succeeded. Hit the endpoint in prod and get 500.

Skill: [reads faq.md#local-vs-production-gotchas]

## Symptoms
Local run succeeds and serves requests. Deploy succeeds. Production endpoint returns 500.

## Likely causes

1. **Credential drift between local .env and deployed environment** (high)
   Evidence: classic "works on my laptop" pattern — faq.md#local-test-works-production-fails-immediately.
   Check: Admin Portal → your app → Environment. Compare AB_CLIENT_ID / AB_CLIENT_SECRET / AB_BASE_URL to your local `.env`.

2. **OAuth client lacks prod namespace permissions** (medium)
   Evidence: same faq entry — dev-namespace permissions don't automatically apply to prod.
   Check: Admin Portal → IAM → your client → permissions list. Compare against what the handler calls.

3. **Config drift — local docker-compose vs. managed prod services** (medium)
   Evidence: nosql-go patch has a TLS branch for DocumentDB that local doesn't hit.
   Check: production .env's `DOCDB_CA_CERT_FILE_PATH` is set (if using nosql-go pattern).

## Next step
Pull logs from Grafana Cloud Explore (Admin Portal → app detail → Open Grafana Cloud — see `references/observe/cli-commands.md`). If you see `permission denied` or `token refresh failed`, it's causes 1–2. If you see DB connection errors, it's cause 3.
```

### Works locally, can't see deployed logs

```
User: /ags-extend doctor
  My Service Extension works fine locally but not on shared cloud, and I
  can't figure out why — getting at the logs is painful, the Grafana view
  is empty.

Skill: [reads grafana-guide.md and faq.md#local-vs-production-gotchas]

## Symptoms
App behaves correctly in local run but misbehaves once deployed to a Shared
Cloud namespace. Developer is blocked upstream of diagnosis: the deployed
logs appear empty in Grafana, so there's nothing to compare against local.

## Likely causes

1. **Logs haven't been ingested yet / time range too narrow** (high)
   Evidence: Grafana ingestion is asynchronous (grafana-guide.md) — an empty
   view right after a deploy or a request is far more often lag or a narrow
   Explore window than missing logs.
   Check: In Grafana Explore, select the Loki logs data source, set the
   time range to Last 30 minutes (wider if you just deployed), query
   `{app_name="<your-app-name>"}` and confirm ANY lines arrive before
   adding an error filter.

2. **Credential / config drift between local .env and the deployed app** (high)
   Evidence: classic local-vs-prod pattern (faq.md#local-test-works-production-fails-immediately).
   The deployed process does NOT read your local .env — it reads what
   update-var / Admin Portal set.
   Check: once logs are visible, look for `token refresh failed`,
   `permission denied`, or DB connection errors and map them via signal-guide.md.

## Next step
Get the logs visible first — that unblocks everything else. Open Grafana
Cloud (Admin Portal → app detail → Open Grafana Cloud), go to Explore → the
Loki logs data source, set the range to Last 30 minutes (wider if you
just deployed), and run
`{app_name="<your-app-name>"} |~ "(?i)error|panic|fatal|traceback|exception"`.
Read the newest matching line, then re-run /ags-extend doctor (or
/ags-extend observe) with it and I'll map it to a cause.

If this doesn't resolve it or you need help interpreting the output, contact
AccelByte support with your namespace, app name, symptom description, and the
relevant log lines.
```

### No match

```
User: /ags-extend doctor
  Every Tuesday at 2pm, players in Brazil get disconnected from our game.

Skill: ## Symptoms
Region-scoped intermittent disconnects on a time-of-day cadence.

## Likely causes
I can't match this to a documented pattern. The references cover platform-level symptoms (status, logs, deploy, local/prod drift) — a regional time-based disconnect could be upstream (ISP, AGS infrastructure region), downstream (game client behavior in that region), or something the Extend logs wouldn't show.

What the references did cover that I checked and ruled out:
  - Degraded app status (not mentioned)
  - Crash patterns (not mentioned)
  - Deploy-time failures (not related to runtime)
  - Override / Event Handler not triggering (not the symptom shape)

## Next step
Run `/ags-extend observe` and open Grafana Cloud Explore during a 2pm-Tuesday window; look for anything unusual (spike in error rate, auth failures, dropped connections). If logs are clean, this is almost certainly upstream of Extend — contact AccelByte support with the regional + time pattern.
```

### Developer wants a fix

```
User: /ags-extend doctor
  Just fix it please.

Skill: I diagnose, I don't mutate. That's deliberate — fixing blind is how production gets worse.

Tell me the symptom and I'll point at the likely cause + which subskill runs the fix. Or run `/ags-extend observe` if you want raw logs first.
```
