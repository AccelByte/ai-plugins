---
last-verified: 2026-05-26
---

# AGS Skill Migration Map

This map records the public skill consolidation.

| Old entry point | New canonical entry point | Notes |
| --- | --- | --- |
| `/ags` | `/ags` | Unchanged and now owns deep AGS workflows. |
| `/ags-matchmaking ask` | `/ags matchmaking ask` | Canonical router: `../capabilities/matchmaking/router.md`. |
| `/ags-matchmaking plan` | `/ags matchmaking plan` | Plan-first gate remains required for build, tune, and change requests. |
| `/ags-matchmaking ruleset` | `/ags matchmaking ruleset` | Native rules stay under `/ags`; Extend override deployment remains `/ags-extend`. |
| `/ags-matchmaking pool` | `/ags matchmaking pool` | Pool configuration remains a Matchmaking capability. |
| `/ags-matchmaking region` | `/ags matchmaking region` | Region routing remains a Matchmaking capability. |
| `/ags-matchmaking backfill` | `/ags matchmaking backfill` | Backfill remains a Matchmaking capability. |
| `/ags-matchmaking integrate` | `/ags matchmaking integrate` | Game-code wiring remains plan-driven. |
| `/ags-matchmaking debug` | `/ags matchmaking debug` | X-Ray and ticket diagnosis remain Matchmaking-owned. |
| `/ags-matchmaking doctor` | `/ags matchmaking doctor` | Diagnosis remains Matchmaking-owned. |
| `/ags-ams account` | `/ags ams account` | Account activation and namespace linking stay AMS-owned. |
| `/ags-ams ask` | `/ags ams ask` | AMS concept questions stay under the AMS capability. |
| `/ags-ams init` | `/ags ams init` | End-to-end AMS setup stays a capability flow. |
| `/ags-ams sdk` | `/ags ams sdk` | Watchdog integration remains AMS-owned. |
| `/ags-ams upload` | `/ags ams upload` | Uploads and IAM packaging remain AMS-owned. |
| `/ags-ams fleet` | `/ags ams fleet` | Fleet sizing, warmed pool, regions, and claim keys remain AMS-owned. |
| `/ags-ams session` | `/ags ams session` | Session-template DS claims remain AMS-owned. |
| `/ags-ams debug` | `/ags ams debug` | AMS Simulator and claimability diagnosis remain AMS-owned. |
| `/ags-ams observe` | `/ags ams observe` | Fleet logs and metrics remain AMS-owned. |
| `/ags-ams doctor` | `/ags ams doctor` | Diagnosis remains AMS-owned. |
| `/ags-ams rollout` | `/ags ams rollout` | DS version rollout remains AMS-owned. |
| `/ags-extend` | `/ags-extend` | Stays separate. |
| `/adt` | `/adt` | Stays separate. |
