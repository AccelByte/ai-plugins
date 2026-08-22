---
name: teammate-detector-error-resilience
description: An AGS call on a critical path with no failure path — no retry, no reconnect,
  no error branch, or a call rate that trips the studio's own limit. How the signal
  set is discovered from AccelByte's own practice index, the disposition each finding
  carries, and its grounding.
last-verified: 2026-07-30
sources:
- https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/
- https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/api-call-recovery/
- https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/lobby-websocket-recovery/
- https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/game-maintenance-testing/
- https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/game-state-recovery-handling/
- https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/game-state-recovery-handling/login-handling-recovery/
- https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/game-state-recovery-handling/accept-agreements-handling-recovery/
- https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/game-state-recovery-handling/matchmaking-with-ds-handling-recovery/
- https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/game-state-recovery-handling/mainmenu-handling-recovery/
- https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/game-state-recovery-handling/retrieving-friend-list-handling-recovery/
- https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/game-state-recovery-handling/gameserver-updating-player-stat-handling-recovery/
- https://docs.accelbyte.io/gaming-services/knowledge-base/best-practices/
- https://docs.accelbyte.io/policies/rate-limit/
- https://docs.accelbyte.io/gaming-services/modules/online/wallets-payments/sales/manage-order/
see-also:
- '[health-check.md](../../subskills/health-check.md)'
- '[grounding-rules.md](../grounding-rules.md)'
- '[grounding-sources.md](../grounding-sources.md)'
- '[report-schema.md](../report/report-schema.md)'
---

# Detector: error resilience

**`detector_id: error-resilience`.** Flags an AGS call on a **critical path** that
has no path for the call failing — no retry underneath it, no reconnect after the
socket drops, no branch for the error the SDK hands back, or a call rate that
trips AccelByte's own limit. Channel A (static). Every finding here is about code
that works on a good network and stops working on a bad one, so the thing to state
is the **player-facing consequence under load**, not the missing construct.

This detector reads the same call-site map as the others and asks a different
question of it. `incomplete-integrations` asks whether the companion wiring is
there at all; this one assumes the wiring is there and asks what happens when the
call behind it fails. A handler that does not exist belongs to that detector; a
handler that exists with no failure branch belongs to this one.

## Where the signals come from

**Signal set bounded by:** a source index, walked at scan time.

**The tables below are not the signal set.** The signal set is what AccelByte
states a game must do under
[graceful disruption handling](https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/),
read at scan time. That section is where AccelByte writes down, for every service
at once, what a game owes when a call fails — so it owns this detector's subject
the way the OpenAPI flags own a deprecation. A list copied out of it here would
be a parallel corpus that goes stale the next time they publish (ADR-0004).

Walk it:

1. **Read the section index and follow the links it gives.** Never build a page
   path from a pattern — the same rule
   [grounding-sources.md](../grounding-sources.md) applies to the release notes,
   for the same reason: a guessed path either 404s or, worse, resolves to a page
   that does not state what you assumed.
2. **Recurse into a child that is itself an index.** *Game state recovery* is one
   today. If another turns out to be, recurse into it too, and let the coverage
   count say so.
3. **Take each leaf page's obligations** — the sentences stating what the game or
   the game server must, should, or needs to do, and the callbacks, error codes
   and intervals they name. An obligation is a sentence you can quote; a sentence
   describing what the backend does is context, not an obligation.
4. **Match each obligation against the Stage 2 call-site map.** An obligation
   whose subject the repo calls, and whose required construct is absent from the
   files you read, is a candidate. One whose subject the repo never calls is not
   a finding — a game with no friends list owes nothing about friends lists.
5. **Cite the leaf page the obligation came from**, at the depth it is stated.
   That page is by construction the deepest one that states it.

On 2026-07-28 the walk reached **nine** leaf pages: API call recovery, Lobby
WebSocket recovery,
[game maintenance testing](https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/game-maintenance-testing/),
and the six under game state recovery — login, accept agreements, main menu,
matchmaking with DS, retrieving friend list, and game server updating player
statistic. That is a fact about the docs on that date, not a target. Report what
the walk found; a tenth page is the expected outcome, not an anomaly.

A page in the walk that states no game-side obligation is still a page read, and
still counts toward the coverage figure. Game maintenance testing is one today:
it describes how to arrange a maintenance window with AccelByte, which is not
something a repo can be missing. Reading a page and finding nothing owed is the
ordinary case, not a reason to leave it out of the count.

Two sources this detector also cites sit **outside** that index and are not
discovered — the [AGS best practices](https://docs.accelbyte.io/gaming-services/knowledge-base/best-practices/)
page and the [rate-limit policy](https://docs.accelbyte.io/policies/rate-limit/).
Read both every run.

### When the index cannot be read

Run the calibrated rows below and nothing else. They carry their own citations,
so the scan still reports — it reports less.

Either way, state what happened, as one line in the summary (Stage 4):

```text
Coverage:     error-resilience read 9 of 9 pages under graceful-disruption-handling
```

```text
Coverage:     error-resilience ran on its calibrated rows only — the practice index was unreachable
```

A partial read is not a failure, and neither is the floor. What would be a
failure is a run that read three pages and let the reader believe it read the
section. Never round the count up, and never omit the line because it is
unflattering — it is the only thing the run says about the detector's reach
rather than its findings.

**This row lives in the spoken summary.** The exported Report has no field for
it — that artifact carries findings, not reach — so a reader who opens the file
weeks later cannot tell a clean scan at full coverage from a clean scan off the
floor. Until the Report carries it, the spoken summary is the only place the
reach is stated, which is the reason not to drop the line.

## Calibrated signals

These rows are **calibration, not coverage.** Each is an obligation the walk also
finds; it is written out here because its disposition is *not* the default — the
gap costs more or less than an ordinary one, or a static read is unusually sure
or unusually weak about it. A repo gap that matches none of these rows is still a
finding. It ships at the default, stated under [Findings](#findings).

| Found in code (grep for) | Finding | Why it fails under load |
|---|---|---|
| An SDK pinned below the version that made HTTP retry automatic — Unity below **15.17.0**, Unreal below **9.0.0**, Unreal OSS below **0.1.0** — with no hand-rolled retry around AGS calls (read the pin from `Packages/manifest.json` or the `.uplugin`) | `sdk-below-auto-retry` | Every retryable status the backend returns (429, 449, 500, 502, 503, 504) reaches the player as a hard failure on the first try. |
| An AGS call inside `Update` / `FixedUpdate` / `LateUpdate`, a `while` loop, or `InvokeRepeating` with a sub-second interval — most often a stat update | `ags-call-per-frame` | Rate limits are per-minute and count at the **studio** level as well as the user level, so one hot loop in one title can throttle players who never ran this code. |
| `Lobby.Connect` / `Chat.Connect` present with no disconnect handling — no `Disconnected` / `OnConnectionClosed` subscriber, no reconnect entry point, no UI for the dropped state | `no-websocket-recovery` | The player looks online and is not: party, friends and matchmaking all fail silently until the game is restarted. |
| Matchmaking started with no error branch on the step callbacks and no ticket-expiry subscriber (Unity `MatchmakingV2TicketExpired`) | `matchmaking-no-failure-path` | A ticket that expires or a step that errors leaves the player on a matchmaking spinner with nothing to press. |
| A `Result` / `Result<T>` callback on a login, session, matchmaking or store path whose body reads `.Value` with no `IsError` branch | `unchecked-result-callback` | The SDK reports failure through that callback, so a body with no error branch treats an outage as a successful empty answer. |
| A critical AGS path with no telemetry or log line around it | `no-critical-path-telemetry` | Nothing distinguishes "nobody bought anything" from "checkout has been broken for six hours". |

Read the pin, not the lockfile prose: a repo that floats the SDK on a branch has
no version to compare, and that is a *not readable* signal, not a finding.

## Findings

| Finding | Severity | Confidence (code-only) | The fix direction |
|---|---|---|---|
| `sdk-below-auto-retry` | high | high | Upgrade to a version that retries automatically, or wrap AGS calls in exponential backoff with jitter and a total timeout. |
| `no-websocket-recovery` | high | medium | Subscribe to the disconnect delegate, show the dropped state, and offer a manual reconnect. On Unity there is no reconnecting delegate to subscribe to, so the in-flight state cannot be shown — the dropped state and the manual affordance still can. |
| `ags-call-per-frame` | high | medium | Batch. The rate-limit policy's own example is stat updates every 10 seconds rather than every second. |
| `matchmaking-no-failure-path` | medium | medium | Branch on each step's error, subscribe to ticket expiry, and disable matchmaking while the lobby connection is down. |
| `unchecked-result-callback` | medium | medium | Branch on `IsError` and surface a message the player can act on; return to the main menu rather than continuing on an empty value. |
| `no-critical-path-telemetry` | low | low — **suppressed in both modes**, because no public page states that critical paths must be instrumented (see Grounding) | Send a Game Telemetry event, or at minimum log, on both branches of each critical AGS call. |

**A discovered obligation with no row above ships at `medium` / `medium`.** That
is the default disposition, and it is a constant, not a judgment: do not raise it
because the page's language sounded urgent, and do not lower it because the match
against the code felt loose. A loose match is a *different* outcome — if you
cannot say the construct is absent, the signal is **not readable** and there is
no finding, at any confidence.

`high` and `low` belong to a calibrated row and to nothing else. `high` asserts a
blast radius wider than the one flow, which no page states — the run cannot read
it off the prose. `low` asserts that a static read is weak about this particular
shape, which only comparison across signals supports. Minting either from a page
is how the number starts describing the run instead of the code.

Severity is what the gap costs when the network is bad rather than when it is
good. `sdk-below-auto-retry` and `no-websocket-recovery` are **high** because they
fail for everyone at once and fail invisibly — a transient backend blip becomes a
player-visible error, and a dropped socket becomes a session that looks fine and
does nothing. `ags-call-per-frame` is **high** for a reason none of the others
share: the blast radius is not this player. Throttling is measured against the
studio's total request rate as well as the individual user's, so a loop shipped in
one title spends a budget other players are drawing on. The remaining two are
**medium**: real, player-visible, and scoped to the one flow that hit them —
which is also the default's reasoning, and why the default is `medium`.

Confidence is how sure a static read is. `sdk-below-auto-retry` is **high** and
alone in that: the pinned version is a literal in a manifest and the threshold
version is published, so both halves of the comparison are readable and neither is
inferred. The rest are **medium** for the reason every absence-based signal is —
a grep that finds no error branch has found none *in what it read*.

**The `Confidence (code-only)` column is the value the finding carries.** Copy it;
do not re-rate it against the evidence in front of you. Two runs looking at one
commit are looking at the same signal, so a number that differs between them is
reporting on the run rather than the code. The default is copied the same way,
and for the same reason.

### Suppression-only rows — walk it, every run

`no-critical-path-telemetry` ships suppressed every time, which makes it the row
this detector is most likely to skip and never notice. Evaluate its trigger
against the repo on every run, emit it when the trigger fired, and leave it out
only because it did not.

It is suppressed for the same reason `namespace-env-mismatch` is: no public page
states the claim. The confidence is not the problem. Neither mode changes that —
a live read produces no page.

The set is closed at one row, and discovery does not add to it. A discovered
obligation comes *with* the page that states it, so it is grounded by
construction; the suppression-only rows are the ones for which no page exists,
and only a human noticing that absence can add one.

| Row | Trigger | If it fires |
|---|---|---|
| `no-critical-path-telemetry` | A login, session, matchmaking or store path calls AGS with no telemetry event and no log line on either branch | Emit, `suppressed: true`, `confidence: low`, no citation |

**The observability gap is discharged here as a suppression, never as a finding
that ships.** Its absence from the shipped list is not the detector failing to
look.

## Grounding

- **The retry contract** — which statuses are retried, which SDK versions retry
  without being asked, and what the game still owes — is grounded in
  [API call recovery](https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/api-call-recovery/).
  That page names the retryable statuses (429, 449, 500, 502, 503, 504), states
  that automatic retry is on by default in the Unity SDK from **15.17.0**, the
  Unreal SDK from **9.0.0** and the Unreal OSS from **0.1.0**, and gives the
  default schedule — a 1-second initial delay that doubles with jitter, capped at
  30 seconds, over a 60-second total budget, `maxRetries` 3 on Unity. It also
  states what to do when the budget runs out: handle the failure gracefully, such
  as returning the player to the main menu or showing a connection error, rather
  than raising the timeout. Cite this page for `sdk-below-auto-retry`.

  **Exhaustion is named in both engine forms — but not for every integration.**
  Unity is `ErrorCode.NetworkError`, Unreal is `ErrorCodes::NetworkError`, and a
  page that names one names the other: API call recovery states each with the
  numeric — *"the system stops retrying and returns an error code
  `ErrorCode.NetworkError` (14005)"* and the same sentence over
  `ErrorCodes::NetworkError` (14005) — while the
  [main-menu recovery page](https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/game-state-recovery-handling/mainmenu-handling-recovery/)
  and the
  [login recovery page](https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/game-state-recovery-handling/login-handling-recovery/)
  branch on it — `if(result.Error.Code.Equals(ErrorCode.NetworkError))` and
  `if(ErrorCode == static_cast<int32>(ErrorCodes::NetworkError))` — without
  restating the number. Quote `14005` only from a page that states it; main menu
  states the symbol and never the number.

  **An Unreal repo on the AGS OSS cannot check it at all**, and that is stated on
  the same page: *"If the game uses the AGS OSS SDK instead, it won't have control
  over the HTTP retry behavior"*, because *"the HTTP retry timeout can only be
  detected when using the Unreal Engine SDK directly, without the AGS OSS SDK."*
  So read the page for the integration the repo actually has, not only for its
  engine — the `sdk-below-auto-retry` row covers Unreal OSS, and on an OSS repo
  the missing construct is a graceful failure path, never a branch on this symbol.
  Do not propose one, and do not cite these pages as if they asked for it.
- **The rate limit** is grounded in the
  [rate-limit policy](https://docs.accelbyte.io/policies/rate-limit/): limits are
  measured in requests per minute, a request is throttled when either the
  individual user or the studio's combined traffic exceeds its RPM ceiling, and
  the 429 body reads *"You have exceeded the allowed request limit. Please try
  again later."* The page's own mitigation is batching, with stat updates every 10
  seconds instead of every second as the worked example. Cite it for
  `ags-call-per-frame`, including the studio-level half — that is where the
  severity comes from, and it is stated on the page rather than inferred.
- **WebSocket recovery** is grounded in
  [Lobby WebSocket recovery](https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/lobby-websocket-recovery/),
  which states that *"the websocket reconnection strategy support was implemented
  by default"* and names the releases it shipped in — Unreal Engine AGS SDK
  **26.3.0** and Unreal Engine AGS OSS **0.12.26** — and that support for a
  **reconnecting delegate** is *"not yet available in the AGS Unity SDK"*. It also
  states what the game owes even where reconnection is automatic: a clear
  notification when the connection is lost, and handling for the case where the
  reconnection reaches its timeout — *"a notification popup, game level auto or
  manual connect, disable online feature"*. Cite this page for
  `no-websocket-recovery`.

  **Read the asymmetry precisely: what Unity lacks is the delegate.** The page
  says nothing about Unity having no reconnection — its Unity tab describes a
  retry running (*"the request delegate will not be triggered when the system
  starts to retry the request … only after the retry process ends"*), and its
  Unity example subscribes to a `Disconnected` callback carrying a `WsCloseCode`.
  That tab is also marked *"Work in progress – updates soon!"* and names no Unity
  version, so it settles neither direction on when Unity reconnects. What the page
  does settle is the missing hook: with no reconnecting delegate there is no way
  to show a *reconnecting* state, so the Unity finding is the dropped-state
  handling and the manual affordance. Do not write that Unity has no reconnection
  to inherit, and do not propose a reconnecting delegate that does not exist.

  **Read every engine tab before resting a finding on what one engine lacks.**
  These pages put each engine in a tab and render only one, so a fetch that
  summarizes the page returns the visible tab and silently drops the rest — and
  what comes back reads exactly like the page being silent. Where the claim is
  that a page says *nothing* about an engine, read the raw page, not a summary of
  it.

  **Do not fold a resumable-session window, a numeric close code, or a token
  re-bind into the finding.** `incomplete-integrations` suppresses those numbers
  for want of a page, and this page does not supply them: what it gives is a
  backoff strategy with a total timeout, not a window in which a dropped session
  can be resumed, and the close codes it names are SDK enum members
  (`WsCloseCode.DisconnectDueToMultipleSessions`,
  `EWebsocketErrorTypes::DisconnectFromExternalReconnect`) rather than the numeric
  codes an internal pin records. Cite the practice; leave out the numbers the page
  does not state ([grounding-rules.md](../grounding-rules.md)).
- **Matchmaking failure handling** is grounded in
  [matchmaking error handling](https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/game-state-recovery-handling/matchmaking-with-ds-handling-recovery/),
  which states the three things the game must do — show a clear message per step
  delegate, disable matchmaking while the lobby connection is lost, and offer a
  manual retry at each step — and names the Unity `MatchmakingV2TicketExpired`
  callback. Cite it for `matchmaking-no-failure-path`.
- **The general connection-disruption obligation** is stated in the
  [AGS best practices](https://docs.accelbyte.io/gaming-services/knowledge-base/best-practices/):
  *"Handle websocket connection disruption"*, and *"Handle WebSocket (Lobby and
  Chat) connection errors and reconnect conditions. Handle internet connection loss
  error."* That is a claim about the **transport**, so it backs a disruption
  finding on a flow no recovery page covers — and it does not reach further than
  that.
- **An unchecked callback** is grounded in the game-state recovery page for the
  flow the call site sits on, each of which states the shape directly:
  `if (!result.IsError) { … } else { // Implement a solution to handle failed
  request. }`, with the
  [friend-list page](https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/game-state-recovery-handling/retrieving-friend-list-handling-recovery/)
  reading `result.Value` inside the success branch and nowhere else. Cite the page
  for that flow — login, main menu, joining a session, matchmaking, friend list —
  for `unchecked-result-callback`.

  **The best-practices page does not ground this one.** What it states is
  connection-disruption handling; `unchecked-result-callback` is about an
  unchecked `Result`, a mechanism that page never mentions, and it fires on
  business errors a healthy connection returns. A callback on a critical flow no
  recovery page covers is **suppressed** — say what would settle it, rather than
  attaching a page that states something adjacent
  ([grounding-rules.md](../grounding-rules.md)).
- **A discovered obligation is grounded by the page it came from**, and by that
  page alone. Do not reach for a nearby page that says something similar, and do
  not attach a calibrated row's citation to a finding that is not that row — the
  walk hands you the exact page, which is the whole point of walking it.
- **Instrumenting critical paths has no public page.** Game Telemetry is
  documented as a service to send events *to*; nothing public states that a
  critical integration path must emit one. So `no-critical-path-telemetry` is a
  **suppression**, not a low-confidence finding: emit it, say what is missing, and
  name what would settle it — a public page stating that critical paths must be
  instrumented. A live read settles none of it, because what is missing is a page
  ([grounding-rules.md](../grounding-rules.md)).
- **Order and IAP failure handling has no public page either**, so there is no row
  for it. What such a row would assert — an unpaid order expiring after a fixed
  window, a platform IAP receipt needing reconciliation — is not stated on the
  public monetization pages. *Manage orders* covers querying and refunding an order
  in the Admin Portal and names no expiry. The `ags` store reference does state the
  10-minute expiry (`ags/references/modules/store-entitlements.md`), and that is
  the trap: a reference shipped beside this skill is not a citable target
  ([grounding-rules.md](../grounding-rules.md)), so finding that line does not
  close the gap. Neither does walking harder — the monetization pages sit outside
  the practice index, so no coverage figure there ever reaches them. It closes when
  a public page states the obligation, or when someone accepts it as an
  internally-backed suppression the way `no-critical-path-telemetry` is.

The `ags` skill holds the reactive counterparts of several of these — its
lobby-disconnect playbook works a socket that already dropped, and its `observe`
subskill's guidance on a rate-limited path is *back off, retry, do not
loop-hammer the service*. Reason from them to decide whether a finding is real,
then cite the public page above. Neither is a citable target
([grounding-sources.md](../grounding-sources.md)).

Do not assert a retry count, a backoff interval, or a rate-limit number from
memory. The defaults above are the ones the pages state; anything else is a
number this playbook does not ground, so it is not part of the finding. This
holds hardest on the discovered half: quote the interval the page gives, or say
the page gives none.

## Channel B — what a live read settles

**Nothing**, and that is a fact about this detector rather than a gap in it. Every
signal here is a shape in client code — a missing branch, a missing subscriber, a
call in a loop, a version literal in a manifest — and a namespace has no view of
any of them. **This playbook has no channel-B table**, so every finding it raises
ships in a config-aware run at exactly its code-only disposition.

Row by row: `sdk-below-auto-retry` compares two version numbers, both already in
hand — the repo supplies the pin and the docs page the threshold, so a live read
adds no term. `ags-call-per-frame`, `no-websocket-recovery` and
`unchecked-result-callback` are client code shapes.
`no-critical-path-telemetry` is missing a page, and a namespace produces no page,
so it ships suppressed in a config-aware run exactly as it does in a code-only
one.

`matchmaking-no-failure-path` **looks settleable and is not**, which is why it is
called out rather than left to the list. A configured ticket timeout does not gate
whether a ticket can expire: the
[matchmaking recovery page](https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/game-state-recovery-handling/matchmaking-with-ds-handling-recovery/)
states the expiry callback fires when *"the matchmaking service is down (HTTP error
code 404), or the matchmaking service couldn't find the specified matchmaking
ticket (HTTP error code 520303)"*, and names no pool setting at all. The expiry
path is reachable whatever a pool says, so a read of the pool moves nothing — and
a row that raised confidence on that premise was raising it on a claim no page
makes.

**A discovered finding has no channel-B row either**, and cannot acquire one
mid-run. A live read moves a candidate only where a playbook has written down what
the read looks at and what each answer means. Reading the namespace and deciding on
the spot what the answer implies is the re-rating the copy rule forbids, arriving
by another door.

A read that errors or that no operation exposes is **not readable** — the
candidate keeps its code-only disposition and the run says the read was
unavailable.

## What not to flag

- **A handler that is absent entirely.** That is
  [`incomplete-integrations`](incomplete-integrations.md) — a missing match-found
  subscriber or a missing `OnDrainReceived` is missing wiring, not a missing
  failure path. This detector's subject is the failure branch of a handler that
  is there. Flagging the same call site under both is one problem reported twice.
- **An old SDK pin on its own.** "Behind current GA" is
  [`deprecated-apis`](deprecated-apis.md)'s `sdk-behind-ga`, and it suppresses
  because no public page states the current GA number. `sdk-below-auto-retry` is a
  different claim with a different fate: the threshold version is published, so
  the comparison is complete and the finding ships live. Only flag it here when
  the pin is below the stated retry threshold.
- **Editor-only, sample, benchmark or test code** — a load-test harness that calls
  in a loop on purpose is not a shipping resilience gap.
- **A call in a loop that is already rate-limited by the game** — a cooldown, a
  dirty flag, or an accumulate-and-flush is the batching the policy asks for.
- **A retry the game wrote itself** on an SDK version that also retries. It is
  redundant, and worth a sentence, but it is not a resilience gap.
- **A missing error branch on a cosmetic or fire-and-forget call.** The finding is
  about critical paths: login, session, matchmaking, and store.
- **An obligation the repo has no occasion to owe.** The walk finds what AccelByte
  states for all games; this repo is one game. A page about the friend list is not
  a finding in a game with no friend list, and a page about a game server is not
  one in a client-only repo. Match against the call map, never against the page.
- **A page's example numbers read as a requirement.** Where a page illustrates a
  practice with a worked example — a retry delay, a poll interval, a maximum
  attempt count — the obligation is the practice. A repo that retries on a
  different schedule has met it; only a repo that does not retry at all has not.
- **Order and IAP failure handling is not on this list.** It has no row for want of
  a page, not because it is exempt — see [Grounding](#grounding).

This list is hand-written and does not grow when the walk does. Discovery widens
what gets proposed; it never widens what is exempt. A discovered obligation that
should have been exempt is a gap in this list — add the exemption here rather
than teaching the walk to skip a page.
