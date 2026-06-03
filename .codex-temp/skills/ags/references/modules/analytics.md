---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
see-also:
- '[iam.md](iam.md)'
- '[achievements.md](achievements.md)'
- '[event-catalog.md](../observe/event-catalog.md)'
---

# Module — Analytics

Event ingestion and player-behavior data pipeline. Captures AGS-emitted events, custom in-game events, and orchestration events into a structured data flow that studios use for live-ops, retention, and monetization analysis.

---

## What it covers

- **Event ingestion** — AGS modules emit events for login, match, purchase, achievement, and other player interactions. For the authoritative event catalog, see `references/observe/event-catalog.md`. Custom in-game events are studio-defined.
- **Event delivery** — events flow into AGS's analytics pipeline; can be exported to external warehouses (Amazon S3, Redshift, Snowflake). BigQuery and other destinations require a custom pipeline via Extend.
- **Dashboards** — out-of-box player engagement dashboards (DAU, MAU, peak concurrent users) with CSV export.
- **Custom telemetry** — studios can ingest custom events alongside AGS events for unified analysis.

## Important: AIS is deprecated

The earlier **AccelByte Intelligence Service (AIS)** has been deprecated. Do not recommend AIS or include it in module lists. Studios with serious analytics needs export AGS Analytics events to their own BI stack. Confirmed export destinations: Amazon S3, Redshift, Snowflake. BigQuery, Looker, Mode, and other targets require a custom pipeline (Extend Event Handler).

## How Analytics relates to the other modules

| Module | Relationship |
|---|---|
| **IAM** | Login events are the basis for DAU / PCCU / retention metrics |
| **Matchmaking / Session** | Match-formation and session-state events feed multiplayer health metrics |
| **Achievements / Leaderboards** | Achievement and score events feed engagement metrics |
| **Store / Entitlements** | Order events feed monetization analysis |
| **Extend** | Event Handlers are a way to push AGS events into custom data pipelines |

For the catalog of which AGS events exist (pointer to authoritative source), see `references/observe/event-catalog.md`.

## When custom analytics logic is needed

If the studio needs more than AGS dashboards provide:

1. **Export to external warehouse** — set up the export pipeline (mechanism depends on tier; check docs.accelbyte.io).
2. **Extend Event Handler** — for cases where the export shape doesn't fit, write an Extend Event Handler that consumes AGS events and writes them wherever needed (custom warehouse schema, Segment, Snowflake, Kafka topic). Route to `/ags-extend ask`.

## Where to look in the docs

- AccelByte Analytics docs: `https://docs.accelbyte.io/`
