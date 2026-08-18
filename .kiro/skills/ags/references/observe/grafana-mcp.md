---
last-verified: 2026-08-17
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/tool-utilities/grafana-cloud-observability/access-grafana-cloud/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/matchmaking-x-ray-guide/
- https://github.com/grafana/mcp-grafana
see-also:
- '[cli-commands.md](cli-commands.md)'
- '[event-catalog.md](event-catalog.md)'
- '[matchmaking-timeouts.md](../debug/matchmaking-timeouts.md)'
- '[private-cloud.md](../deployment/private-cloud.md)'
- '[grafana-guide.md](../../../ags-extend/references/observe/grafana-guide.md)'
---

# Querying AGS Through Grafana

This file owns Grafana MCP setup for every AGS skill. Both `/ags` and `/ags-extend` use it; `/ags` owns it. The Extend logging guide covers reading Extend logs in the browser and defers here for programmatic access.

On **Private Cloud**, AGS service metrics and logs live in the tenant's Grafana and can be queried directly instead of clicking through the Admin Portal. Most useful for matchmaking, where the alternative is reading three X-Ray charts by eye and correlating them manually.

## Eligibility

| | Public Cloud | Private Cloud |
|---|---|---|
| General AGS service metrics | Not available | Available |
| Programmatic token | Not available | Available |

**Private Cloud only.** Public Cloud is not eligible on either count: there are no AGS service metrics to read, and the token broker rejects those tenants by design, per the endpoint's own description. BYOC is a separate deployment model and is not covered — do not treat "not Public Cloud" as "eligible".

Don't offer this path to an ineligible tenant. Say it isn't available and use the Admin Portal instead, rather than letting the user discover it through a failed setup.

Eligibility is necessary but not sufficient: the broker has so far been confirmed only on the development environment. Treat any other environment as unproven — attempt the call, and fall back to the browser flow if the endpoint isn't exposed. Don't report an unexposed endpoint as a broken tenant.

## Step 1 — Broker a token

```
POST /observability-manager/v1/admin/namespace/{namespace}/grafana/token/broker
```

`{namespace}` is the AGS game namespace. The caller needs `NAMESPACE:{namespace}:USER:* [READ]`. The actor is read from the access token. If an AGS API MCP server is configured, call `BrokerGrafanaTokenV1` through it rather than hand-rolling the request.

> **Send `Content-Type: application/json` and a `{}` body.** The API description says there is no request body, but omitting the header and body returns `406 Not Acceptable` with an empty "Available representations" list. This reads as a broken endpoint and is not.

Success body:

```json
{
  "token": "glsa_...",
  "expires_at": "2026-08-17T05:08:11Z",
  "grafana_url": "<tenant-grafana-host>"
}
```

`grafana_url` is a bare host — prepend `https://`. The token is Viewer-only and lives roughly 4 hours. The host is per-tenant and per-environment; read it from the response rather than hardcoding one.

A `403` is ambiguous. It can mean the caller lacks `NAMESPACE:{namespace}:USER:* [READ]`, or that the tenant is ineligible. Establish which before reporting — don't assert one when the evidence fits both.

## Step 2 — Configure the MCP server

Add a `grafana` entry to the IDE's MCP config. **Always pass `--disable-write`**: the server advertises mutation tools (dashboards, annotations, datasources) by default, and every AGS skill that reads Grafana is read-only by contract. The Viewer token blocks most writes, but the contract shouldn't depend on the token.

```json
{
  "mcpServers": {
    "grafana": {
      "command": "uvx",
      "args": ["mcp-grafana", "--disable-write"],
      "env": {
        "GRAFANA_URL": "https://{grafana_url}",
        "GRAFANA_SERVICE_ACCOUNT_TOKEN": "{token}"
      }
    }
  }
}
```

For Codex, which uses TOML rather than the JSON above:

```toml
[mcp_servers.grafana]
command = "uvx"
args = ["mcp-grafana", "--disable-write"]
env = { GRAFANA_URL = "https://{grafana_url}", GRAFANA_SERVICE_ACCOUNT_TOKEN = "{token}" }
```

Requires `uvx` on PATH. The token is a live credential — keep it out of anything committed. `/ags install-mcp` owns writing this config and knows each IDE's file path and merge rules.

## Step 3 — Reload, then verify

Writing the config does not connect the server. A session already running won't see the entry until MCP servers are reloaded — use the IDE's reload command if it has one, otherwise restart it. Config tools report success as soon as the file is written, not when the server connects, so a correct setup looks broken until the reload. Reload before concluding anything failed.

Then list datasources to confirm the token works. Diagnose what comes back from the actual status and error rather than a fixed expectation: an empty list or a `401` can mean an expired token, a wrong URL, insufficient permissions, or environment-specific datasource configuration. On the development tenant the list included Prometheus/Mimir, Loki, Tempo, and Pyroscope sources; treat that as one observation, not a guarantee.

## Step 4 — Discover before querying

**Discovery is the first step of any query session, not an optional check.** Metric names and labels below were observed on one development tenant on 2026-08-17. They are an undocumented internal implementation detail with no stability guarantee, and may already have changed.

Before trusting any name in this file:

1. List metric names matching the family you want.
2. List label names for the metric you picked.
3. List label values for the labels you intend to filter on.

If a metric here returns nothing, that is evidence the name changed — not evidence the service is down. Never report an AGS problem on the basis of an undiscovered metric name.

## The label trap

Observed matchmaking metrics carry two namespace-ish labels, and the obvious one is wrong:

| Label | Value | Meaning |
|---|---|---|
| `game_namespace` | e.g. `my-studio-prod` | The AGS namespace. This is what the user means. |
| `namespace` | `justice` | The Kubernetes namespace. Constant across tenants. |

Filtering on `namespace="<the user's namespace>"` silently returns nothing, and that empty result reads exactly like "no matchmaking activity" — a wrong and expensive conclusion. Scope with `game_namespace`.

Two more of the same kind:

- The pool label is **`matchpool`** — one word. Not `match_pool`, not `pool`.
- Unset dimensions are the literal string `"_"`, not empty or absent.

## Observed matchmaking metrics

Published by `ags-multiplayer-go`. Confirm each against discovery before use.

**`ab_mmv2_general_error_total` carries `method`, `path`, and `response_code` but has no `matchpool` or `game_namespace` label.** It answers "is the match2 API erroring", never "is this pool erroring" — read this before scoping anything below.

The remaining observed metrics carried `game_namespace` and, where noted, `matchpool`:

| Metric | Type | Answers | Additional labels |
|---|---|---|---|
| `ab_mmv2_incoming_tickets_total` | counter | Ticket arrival volume | `matchpool`, `success` |
| `ab_mmv2_player_ticket_population_total` | counter | Cumulative players entering a pool | `matchpool`, `match_type`, `region`, `platform`, `cross_play_enabled` |
| `ab_mmv2_tick_ticket_total` | counter | Tickets seen per matchmaking tick | `matchpool` |
| `ab_mmv2_match_players_elapsed_time_ms_*` | histogram | Time-to-match distribution | `matchpool` |
| `ab_mmv2_match_ticket_best_latency_*` | histogram | Best region latency per ticket | `matchpool` |
| `ab_mmv2_worker_tick_processing_time_seconds_*` | histogram | Matchmaking worker tick cost | — |
| `ab_mmv2_extend_function_call_duration_seconds_*` | histogram | Custom match function calls | `action`, `status` |

Adjacent families seen alongside: `ab_matchmaking_history_*`, `ab_session_match_duration_time_seconds_*`, `ab_session_history_matchmaking_total`, `ab_session_player_left_match_total`.

### There is no live pool-depth metric

`ab_mmv2_player_ticket_population_total` is a **counter** — it only ever climbs and then plateaus. Its raw value is the cumulative number of players who have entered the pool since the counter last reset, not how many are queued right now. A pool that has been empty for days still reports a large number.

Reading that raw value as current depth produces a confident wrong answer. Use `increase()` over a window for arrival volume, and get **concurrent** ticket counts from X-Ray's Overview tab, which is the only observed source for live depth.

## Symptom recipes

Every query below is an **observed example**, valid on one development tenant on the date in the frontmatter. Run discovery first and adapt. Findings are hypotheses to corroborate, not conclusions to report.

**Are tickets arriving at all?**

```promql
sum by (matchpool) (rate(ab_mmv2_incoming_tickets_total{game_namespace="<ns>"}[5m]))
```

Zero is consistent with clients not submitting, submitting to a different pool or namespace, or a changed metric name. Rule out the last with discovery before telling anyone their client is broken.

**How many players entered the pool in a window?**

```promql
sum by (matchpool) (increase(ab_mmv2_player_ticket_population_total{game_namespace="<ns>"}[15m]))
```

Low arrival volume is consistent with a pool too thin for rules requiring N opponents. It does not establish current depth — check X-Ray Overview for that before recommending ruleset changes.

**When did wait times move?**

```promql
histogram_quantile(0.95, sum by (le, matchpool) (rate(ab_mmv2_match_players_elapsed_time_ms_bucket{game_namespace="<ns>"}[5m])))
```

Compare against arrival rate over the same window to distinguish "more players, same speed" from "same players, slower".

**Is the custom match function involved?**

```promql
sum by (action, status) (rate(ab_mmv2_extend_function_call_duration_seconds_count{game_namespace="<ns>"}[5m]))
```

Observed `action` values: `ValidateTicket`, `EnrichTicket`, `MakeMatch`, `BackfillMatch`, `StatCode`. A non-success `status`, or `MakeMatch` absent while `ValidateTicket` fires, points at a specific hook — then read that app's logs via `/ags-extend observe` to confirm.

**Is the matchmaking worker keeping up?**

```promql
histogram_quantile(0.95, sum by (le) (rate(ab_mmv2_worker_tick_processing_time_seconds_bucket{game_namespace="<ns>"}[5m])))
```

Rising tick cost against flat ticket volume is consistent with rule complexity rather than load.

## What this does not replace

X-Ray remains the only source for **per-ticket** detail: which lifecycle stage a ticket reached, which criterion blocked a specific pairing, what attributes the two tickets carried — and for concurrent ticket counts. Metrics answer "how many, how fast, since when". X-Ray answers "why did *this* ticket fail".

Metrics first to bound the window and narrow the cause, then X-Ray on a ticket from that window.

## Common confusions

| Symptom | Usually means |
|---|---|
| Query returns nothing, pool is definitely active | Filtered on `namespace` instead of `game_namespace` |
| Pool filter matches nothing | Label is `matchpool`, not `match_pool` or `pool` |
| `region` filter matches nothing | Unset dimensions are the literal string `"_"` |
| Pool depth looks high but nobody is queuing | Read a counter as a gauge — no live-depth metric was observed; use X-Ray |
| A metric in the table doesn't exist | Names are internal and change. Re-run discovery; don't conclude the service is down. |
| Everything returns nothing | Token expired (~4h, no refresh), or the tenant is ineligible |
| Error counts look pool-scoped | `ab_mmv2_general_error_total` has no pool label; it is API-wide |
| Write tools appear in the server's tool list | `--disable-write` was omitted from the config |
