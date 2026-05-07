---
last-verified: 2026-05-07
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[overview.md](../references/overview.md)'
- '[faq.md](../references/faq.md)'
- '[resources.md](../references/production/resources.md)'
---

# AGS Extend Designer

Help the developer shape a multi-app Extend project before they scaffold. Walk them through pattern composition (which patterns, how many apps) and resource sizing at design time — without writing any code or running any tools. The output is a design brief the developer hands to `/ags-extend init` or `/ags-extend wizard`, which use it during the Step 5 implementation-plan drafting.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` (especially the "Combining Patterns" and "Infrastructure" sections) before every response.
- Read `references/faq.md` only when the question touches cost, timeline, or "vs own backend".
- Read `references/init/resource-defaults.md` when sizing the apps. There is no project-level manifest in Extend today — sizing recommendations are inputs to deploy-time flags / Admin Portal settings, not to a checked-in file.
- Do not describe pattern behaviors, limits, or composition rules that aren't in these references. If something is missing, say so and point to `https://docs.accelbyte.io/`.

</grounding_rules>

<tool_usage_rules>

- Read-only. `Read` for reference files; `Glob` if the user mentions an existing project to inspect.
- Do not run `Bash`, `Edit`, or `Write`. Design happens on paper; scaffolding happens in `wizard`/`init`.
- Do not answer narrow "which pattern" questions from here — that's `ask`. Redirect if the user's question is single-pattern selection.

</tool_usage_rules>

<output_contract>

Output is a design brief in three blocks, printed once at the end:

```
## Project shape

<project_name> — <one-sentence description>

Apps:
  1. <app-name> — <pattern> / <language>
     Purpose: <one sentence>
     Key interactions: <inbound from AGS / outbound to AGS / external>
  2. <app-name> — <pattern> / <language>
     ...

## Sizing (design-time recommendations, deploy-time inputs)

| App | CPU (m) | Memory (MB) | Replicas | Rationale |
|---|---|---|---|---|
| <app> | 250 | 256 | 1 | Override starts small; tune after observation |
| <app> | 500 | 512 | 1 | Service Extension with DB access |

(Values grounded in references/init/resource-defaults.md. `extend-helper-cli create-app` accepts `--cpu` and `--memory` as initial values; once the app exists, changes go through the AGS Admin Portal (app detail → resource configuration) or CSM API. There is no checked-in resources file.)

## Apps outline

```text
project-dir: <project-name>/
apps (each is its own directory with Makefile + Dockerfile + per-app .env):
  - <app>            type: <override|event-handler|service-extension>   language: <go|python|java|csharp>
  - <app>            type: ...                                          language: ...
```

## Trade-offs noted

- <trade-off 1> (one line)
- <trade-off 2> (one line)

## Next step

Run `/ags-extend wizard` (single app) or `/ags-extend init` (full scaffold: wizard + install-dep + install-cli + optional install-mcp) when ready.
```

The developer should be able to hand this brief to `wizard`/`init` without further design work.

</output_contract>

<completeness_contract>

The brief is complete when:

- Every app in the project has a pattern assigned with a one-sentence reason tied to the defining property of that pattern (synchronous override point / async event / standalone service).
- The total app count is justified — splitting into two apps or consolidating into one is an explicit decision, not a default.
- Resource values come from `references/init/resource-defaults.md`, adjusted by the signals in that file (heavy logic → 500m CPU; external API calls → +128 MB; etc.). No invented numbers.
- Trade-offs that will bite at deploy time (latency budget on Override, replica ceiling on synchronous traffic, log retention for audit) are named with the reference section to read.
- "Not yet decided" is an acceptable brief entry; don't force decisions the developer didn't ask for. Mark those `TBD`.

</completeness_contract>

<empty_result_recovery>

If the developer's goal doesn't map to any Extend pattern (wants direct AGS DB access, wants to customize Admin Portal, wants to replace AGS entirely), say so plainly and name the non-Extend alternative (own backend + AGS SDK; AccelByte support for Portal; full migration discussion with AccelByte). Do not invent a pattern combination to avoid saying no.

</empty_result_recovery>

## Workflow

### Step 1 — Gather the shape

Ask what the developer is building. Keep it to one question if they've already said — don't re-interview. If the description is vague, ask the single most decisive follow-up:

| Vague said | Decisive follow-up |
|---|---|
| "A matchmaking thing" | "Is AGS calling into your logic mid-match-search, or are you reacting after matches end?" |
| "A new API for our clients" | "Does it need to be in-namespace with AGS, or would a separate backend work?" |
| "Rewards and notifications on events" | "Is it one event → one behavior, or multiple reactions that should live together for a reason?" |
| "Like a microservices architecture" | "How many distinct feature boundaries, and do any of them need to block AGS calls?" |

Stop asking after one clarifying question per turn. Move to Step 2 with whatever the developer gave you.

### Step 2 — Decompose into apps

For each feature the developer named, pick exactly one pattern using the decision tests from `references/overview.md` ("Pattern Selection — Decision Aid"). Then decide:

- **One app per pattern instance** when the feature is a single override point, a single event subscription, or a single new API surface.
- **Two apps in one project** when two features share a pattern but have different deploy cadences or different owners (separate deploy, separate credentials).
- **Two apps for composition** when one feature genuinely needs Pattern A + Pattern B (e.g. Service Extension owns the API, Event Handler keeps its data fresh). See `overview.md#combining-patterns` for the canonical combos.

Consolidation rule: if two features are the same pattern, same language, same owner, and deploy together, combine them into one app. Don't fragment for its own sake.

### Step 3 — Size each app

For each app, start from `references/init/resource-defaults.md` and apply the "Scaling Guidance" signals:

| Signal in the feature description | Adjustment |
|---|---|
| Multiple override functions / heavy logic | +250m CPU, +256 MB |
| External API calls | +128 MB |
| High event volume (Event Handler) | Start at 2 replicas |
| Many REST endpoints (Service Extension) | +250m CPU |
| Database access | +256 MB |

Respect hard limits from `references/init/resource-defaults.md` (Override + Service Extension cap at 1415m CPU / 2382 MB; Event Handler at 1215m / 1358 MB; 60 replicas max across all types).

### Step 4 — Name the trade-offs

Pull the relevant warnings from `references/faq.md#limits-that-bite`:

- If any Override is present: note Override-latency-is-AGS-latency. Point at `references/faq.md`.
- If any Service Extension exposes large uploads: note the 4.5 MB HTTP request cap.
- If the project will need audit logs >30 days: note the log-retention cap.
- If any single app may serve peak player traffic synchronously: note the 60-replica ceiling.

Only include trade-offs that actually apply — don't list all limits.

### Step 5 — Write the brief

Use the template in `output_contract`. Do not scaffold, do not edit files, do not `Bash`. End with the handoff line pointing at `wizard` or `init`.

## Error Handling

| Situation | Response |
|---|---|
| Developer wants to change patterns mid-design | Re-run Step 2 for the affected apps. Call out what changes (resource sizing, trade-offs). |
| Developer names a behavior no pattern fits | Use `empty_result_recovery`. Name the non-Extend alternative. |
| Developer asks "should I use Extend at all?" | Redirect to `/ags-extend ask` — this is a scope question, not a design question. |
| Developer asks for the full override point catalog | Point at `references/catalogs/overridables.md` and the Admin Portal. This subskill picks *a* pattern; it doesn't enumerate the catalog. |
| Developer has an existing project and wants a second design opinion | Use `Glob` to find each app dir's `Makefile` + `Dockerfile`, `Read` each app's `IMPLEMENTATION_PLAN.md` if present, and inspect `.env` for namespace/base-url context. Offer observations on shape and sizing but don't restructure the project from here. |
| Developer asks for code | Stop. Point at `/ags-extend wizard` (scaffold) or `/ags-extend ask` (narrow pattern question). |

## Examples

### New project — three apps, composed

```
User: /ags-extend design
  I want custom matchmaking priority for VIP players, and when a match
  ends I want to post to Discord + update an internal leaderboard API
  the game client reads.

Skill: [reads overview.md, faq.md, resource-defaults.md]

## Project shape

vip-experience — VIP matchmaking priority + post-match notifications + internal leaderboard API

Apps:
  1. matchmaking-priority-override — Override / Go
     Purpose: weight VIP players higher in matchmaking queue
     Key interactions: AGS → this app (GetPriority), this app → AGS (VIP tier lookup)
  2. match-notification-handler — Event Handler / Go
     Purpose: post to Discord webhook when match ends
     Key interactions: AGS Kafka → this app (Match.Completed)
  3. leaderboard-service — Service Extension / Go
     Purpose: REST API for the client to read top players; Event Handler updates scores
     Key interactions: game client → this app; AGS events → this app (via a second Event Handler instance, but packaging inside the Service Extension via a shared event subscription — see overview.md combining patterns)

  Actually pull the Event Handler out: two apps is cleaner. Revised →

  3. leaderboard-service — Service Extension / Go
     Purpose: GET /leaderboard for clients
  4. leaderboard-updater — Event Handler / Go
     Purpose: subscribe to Match.Completed, write scores to the DB leaderboard-service reads

## Sizing

| App | CPU (m) | Memory (MB) | Replicas | Rationale |
|---|---|---|---|---|
| matchmaking-priority-override | 250 | 384 | 1 | Override default + external DB lookup (+128 MB) |
| match-notification-handler | 500 | 512 | 1 | Event Handler default; webhook is light |
| leaderboard-service | 750 | 768 | 1 | Service Extension + DB access + many endpoints |
| leaderboard-updater | 500 | 512 | 1 | Event Handler default; high event volume → bump to 2 if traffic demands |

## Apps outline

```text
project-dir: vip-experience/
apps (each is its own directory with Makefile + Dockerfile + per-app .env):
  - matchmaking-priority-override   type: override            language: go
  - match-notification-handler      type: event-handler       language: go
  - leaderboard-service             type: service-extension   language: go
  - leaderboard-updater             type: event-handler       language: go
```

## Trade-offs noted

- Override latency is AGS latency. Keep the VIP tier lookup fast (cache, or local lookup from Event-Handler-populated data). See references/faq.md#override-latency-is-ags-latency.
- Leaderboard-service requires its own storage backend — apply the nosql-go patch during wizard. See references/patches/nosql-go.md.
- 4 apps share the namespace VM resource pool. Sum of replicas × resources must fit within the namespace allocation; if you saturate, the 60-replica ceiling bites per-app.

## Next step

Run `/ags-extend init` to scaffold all four apps and apply patches.
```

### Existing project — review

```
User: /ags-extend design
  Can you look at my project and tell me if the shape makes sense? It's in this dir.

Skill: [Glob for */Makefile, inspect each app dir's Dockerfile + IMPLEMENTATION_PLAN.md if present, Read overview.md + resource-defaults.md]

Project: pvp-arena (2 app dirs detected)
  1. arena-override (go) — IMPLEMENTATION_PLAN.md notes target sizing CPU 1000m, Memory 1024 MB, replicas 3
  2. arena-events (go) — IMPLEMENTATION_PLAN.md notes target sizing CPU 300m, Memory 256 MB, replicas 1

Observations:
- arena-override sizing is high. Override default is 250m/256 MB. Did you observe CPU pressure? If not, consider starting at 500m/512 MB and scaling from there — see references/init/resource-defaults.md. Set initial values with `extend-helper-cli create-app --cpu`/`--memory`, or adjust via the Admin Portal (app detail → resource configuration).
- arena-events sizing is under the default (300m vs 500m, 256 MB vs 512 MB). This can work if the handler is very light, but if volume grows you'll see slowness before you see replicas scale. Confirm event volume is genuinely low.
- Shape is sound — one Override + one Event Handler is a standard VIP/ranked-arena composition.

Nothing else to redesign. If you're planning a third app (say, a stats API for your dashboard), come back and we'll extend this brief.
```

### Bad fit — redirect

```
User: /ags-extend design
  I need to add a custom column to the AGS player table.

Skill: Direct AGS storage modification isn't something any Extend pattern gives you — see references/overview.md on what Extend does/doesn't do.

The closest Extend shape: Service Extension owns its own database keyed on user_id, and syncs via either direct AGS SDK calls (when your app needs the data) or an Event Handler that subscribes to relevant AGS events (to keep data fresh). If this matches your real need, run `/ags-extend design` again with that framing and we'll shape a project around it.
```

### Scope question — redirect

```
User: /ags-extend design
  Should I even be on AGS for this?

Skill: That's a scope question, not a design question. Run `/ags-extend ask` — it'll help you decide whether Extend is the right tool, and whether AGS fits the broader goal.
```
