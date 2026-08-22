---
name: teammate-detector-incomplete-integrations
description: A capability is called but its required companion wiring is absent. Static
  (channel-A) signals, the finding each produces, and its grounding.
last-verified: 2026-07-26
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/unity-integrating-matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/integrating-matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/configure-matchmaking-for-a-specific-region/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/integrate-dedicated-servers-with-the-sdk/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-watchdog-protocol/
- https://docs.accelbyte.io/gaming-services/modules/online/statistics/
see-also:
- '[health-check.md](../../subskills/health-check.md)'
- '[grounding-rules.md](../grounding-rules.md)'
- '[grounding-sources.md](../grounding-sources.md)'
- '[report-schema.md](../report/report-schema.md)'
---

# Detector: incomplete integrations

**`detector_id: incomplete-integrations`.** An AGS capability is *called* but the
companion wiring it depends on is *missing* — the integration compiles and half
works, then fails at the moment the missing piece was supposed to run. Every
signal here is **channel A** (static: read the call-site map from Stage 2). Two of
them — `leaderboard-no-stats` and `achievements-no-rewards` — are settled by a live
namespace read (channel B, Stage 3), and in code-only mode ship at lower confidence
and say so, *provided they already carry a public citation*. Where the live read is
the only thing that could back the claim, the finding is suppressed instead
([grounding-rules.md](../grounding-rules.md)). The rest are code shapes a namespace
has no opinion about — see [Channel B](#channel-b--what-a-live-read-settles).

**Signal set bounded by:** the signals written into this file.

The module docs this detector cites state each obligation inside integration
prose, and no index enumerates that page set, so there is nothing to walk. What
this detector looks for is therefore bounded by the table below, and a clean
result means *nothing among these signals* rather than *nothing*
([grounding-sources.md](../grounding-sources.md)).

## Signals

Read the Stage 2 call-site map. Each row is "capability X is called, companion Y
is absent → finding".

| Called (grep for) | Required companion | Absent ⇒ finding |
|---|---|---|
| Matchmaking start — `StartMatchmaking`, `MatchmakingV2`, `SETTING_SESSION_MATCHPOOL` | A Lobby-WebSocket match-found notification handler (match result arrives over the Lobby WS, not by polling) | `matchmaking-no-notification-handler` |
| Matchmaking present | A real QoS latency submission before the ticket (region latencies measured, not an empty map) | `matchmaking-empty-qos` |
| AMS DS signals — `bServerUseAMS`, `SendServerReady`, watchdog `:5555` | An `OnDrainReceived` drain handler (a DS that ignores drain does not exit and leaks fleet capacity) | `ams-no-drain-handler` |
| Leaderboard reads/writes | Statistics stat-update wiring (leaderboards ingest stat events; they do not take direct score posts) | `leaderboard-no-stats` |
| Achievements defined/queried | Rewards module configured to listen (unlocks grant nothing unless Rewards is wired) | `achievements-no-rewards` |

Only flag a row when the *called* side is present in the map and the *companion*
side is genuinely absent — not merely in a different file you did not read.

## Findings

| Finding | Severity | Confidence (code-only) | The fix direction |
|---|---|---|---|
| `matchmaking-no-notification-handler` | high | medium | Wire a Lobby-WebSocket handler for the match-found notification; add reconnect/idle handling. A live read can show whether the match pool is real; it cannot see a client handler. |
| `matchmaking-empty-qos` | medium | medium | Measure and submit real region latencies before the matchmaking ticket. |
| `ams-no-drain-handler` | high | medium | Add the `OnDrainReceived` handler so the DS exits on drain. |
| `leaderboard-no-stats` | medium | low | Wire Statistics stat updates first; leaderboards read from them. |
| `achievements-no-rewards` | low | low | Configure the Rewards module to grant entitlements on unlock. |

Severity is the cost if the missing piece never runs (a drained-but-alive DS
burns paid fleet capacity → high; a missing reward is a UX gap → low). Confidence
is how sure a *static* read is that the companion is truly absent — the
notification handler and drain handler are named callbacks a grep confirms
(medium); "no stat wiring at all" and "Rewards not listening" often live in
backend config a repo scan cannot see (low, wants a channel-B read).

**The `Confidence (code-only)` column is the value the finding carries.** Copy it;
do not re-rate it against the evidence in front of you — the reasoning that set
each number is the paragraph above, and it does not change between runs.

This detector contributes **no suppression-only rows** to Stage 5's walk: all five
rows above can ship live once cited. A row here that cannot be cited is suppressed
by the ordinary grounded-or-suppressed rule, not because the row is one of the
fixed suppression-only kind.

## Grounding

- The Lobby-WebSocket match-notification requirement and the QoS-before-ticket
  step are grounded in the matchmaking integration docs — **cite the page for the
  engine the repo actually uses.** The
  [Unity page](https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/unity-integrating-matchmaking/)
  states both facts at the method level ("Connect to the Lobby service as soon as
  the user has successfully logged in", the `MatchmakingV2MatchFound` listener, and
  `QosManager.GetAllServerLatencies` for the ticket's `latencies`). The
  [Unreal page](https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/integrating-matchmaking/)
  covers the Lobby prerequisite and the notification list but says **nothing about
  latencies or QoS** — do not cite it for `matchmaking-empty-qos`; that claim's
  engine-neutral source is
  [configure matchmaking for a specific region](https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/configure-matchmaking-for-a-specific-region/).
  The `ags` skill maps the Lobby↔Session notification flow — Session notifies
  players of the allocated server endpoint over the notification channel — in
  `ags/references/integrate/lobby-session.md`; reuse it for
  `matchmaking-no-notification-handler`, and cite the engine's integration page.
- The AMS drain handler and the watchdog `:5555` / `SendServerReady` signals are
  grounded in the
  [dedicated-server SDK](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/integrate-dedicated-servers-with-the-sdk/)
  and
  [watchdog-protocol](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-watchdog-protocol/)
  docs. The `ags` AMS reference `ags/capabilities/ams/sdk.md` names
  the ready/drain signals, the Unity `OnDrainReceived` / Unreal `SendServerReady`
  handlers, and the exit-gracefully-on-drain requirement — reuse it for
  `ams-no-drain-handler`.
- The leaderboards-read-from-Statistics relationship is grounded in the
  [Statistics docs](https://docs.accelbyte.io/gaming-services/modules/online/statistics/).
  The `ags` skill states it directly in `ags/references/modules/statistics.md`
  ("Leaderboards commonly rank players from a stat code"; "The Rewards
  module listens to stat update events and grants rewards") — reuse it for
  `leaderboard-no-stats` and `achievements-no-rewards`.
- The **reconnect specifics** (60s window, error 4042, token re-bind) have no public
  page in the corpus — an internal pin is their only backing. A claim resting only on
  them is **suppressed**, not shipped at low confidence: name the public page that
  would have to state the window or the code, and leave the number out
  ([grounding-rules.md](../grounding-rules.md)). A live read settles none of it —
  what is missing is a page, and a namespace produces no page. Never fold a specific window or
  error code into a finding whose citation does not state it. The "achievements need
  Rewards listening" relationship is **not** in this bucket — the Statistics docs
  above carry it, so `achievements-no-rewards` ships on that citation.

A studio's installed Unity how-to knowledge base corroborates several of these at
the client-method level — match-found notifications over Lobby, leaderboards
reading from Statistics, and achievement wiring. Use it to raise confidence that
the companion wiring is genuinely absent, but **cite the module docs above**, not
the knowledge base's own `source_url` (those links may be stale). The AMS drain
signal has no client-side knowledge-base entry — it stays grounded on the
watchdog-protocol docs. See [grounding-sources.md](../grounding-sources.md).

Do not assert a specific error code, timeout, or config value from memory. If the
playbook does not ground it, it is not part of the finding.

## Channel B — what a live read settles

Stage 3 reads the namespace and hands this playbook the answer. It moves
`confidence` and it can drop a candidate outright; it never becomes a citation, so
a confirmed finding still ships on the public page named above
([grounding-rules.md](../grounding-rules.md)).

| Finding | What the live read looks at | Confirmed | Refuted |
|---|---|---|---|
| `leaderboard-no-stats` | whether a leaderboard is configured, and whether the stat code it reads from exists | the stat code is absent → **high** | **never by this read** — see below |
| `achievements-no-rewards` | whether a reward is attached to the achievement's unlock | no reward attached → **medium** | a reward is attached → **drop** |

A stat code that **exists** does not refute `leaderboard-no-stats`. The finding is
that nothing in the code writes it, and a configured stat code is a place to write,
not a write. What would refute it is the stat being *fed* — and that means per-user
stat values, which Stage 3 does not read: it sends identifiers from the call map and
nothing else. So an existing stat code is *not readable* on this finding. Say it
exists and keep the candidate.

The other three have **no channel-B row**: the missing piece is client code, and a
namespace cannot see it. `matchmaking-no-notification-handler`,
`matchmaking-empty-qos`, and `ams-no-drain-handler` ship in a config-aware run
exactly as they ship in a code-only one. A pool read that comes back empty is worth
a sentence to the user — the capability may not be configured at all, which is one
of the *What not to flag* cases below — but it is not a disposition on the handler
finding, because the two are unrelated facts.

A read that errors, or that no operation exposes, is **not readable**: the candidate
keeps its code-only confidence and the run says the read was unavailable. Silence
from a namespace is not a refutation.

## What not to flag

- A companion that exists in a file you did not open — widen the Stage 2 map
  before concluding it is absent.
- Editor-only, sample, or test code paths (`Assets/**/Tests/**`, sample scenes) —
  a demo scene calling matchmaking without production wiring is not a shipping gap.
- A capability behind a feature flag that is off — note it, do not flag it.
