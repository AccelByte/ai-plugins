---
name: teammate-resource-signals-ams-server
description: The cause classes `why-did-it-die` names for one dead AMS dedicated server
  — what each fires on, which read settles it, what it is worth, and the public page
  behind every claim about AccelByte. Read before the detect stage.
last-verified: 2026-09-04
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/create-ams-fleet/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-troubleshooting-guide/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/view-server-logs-and-artifacts/
- https://docs.accelbyte.io/gaming-services/knowledge-base/ams-release-note/ams-2025.7/
- https://docs.accelbyte.io/gaming-services/modules/foundations/tool-utilities/ags-observability/ams-dashboards/
see-also:
- '[why-did-it-die.md](../../subskills/why-did-it-die.md)'
- '[ams-fleet.md](ams-fleet.md)'
- '[extend-deployment.md](extend-deployment.md)'
- '[grounding-rules.md](../grounding-rules.md)'
- '[grounding-sources.md](../grounding-sources.md)'
- '[report-schema.md](../report/report-schema.md)'
---

# Resource signals: AMS dedicated server

The cause classes `why-did-it-die` names for one dead dedicated server, for
`subject.kind: ams-server`. Each is a row of the closed table `report_tool.ts`
holds as `RESOURCE_SIGNALS["ams-server"]` and
[report-schema.md](../report/report-schema.md) § *Resource-check report* prints;
a signal this file names and that table does not is refused at `validate`, and
adding one means adding it in all three places in one change.

**Subject kind:** `ams-server`.

**Signal set bounded by:** the signals written into this file.

No AccelByte index enumerates the ways a dedicated server can end. The pages
below state them inside prose about how a fleet is configured and how a server
is troubleshot, so there is nothing to walk, and a clean result from this
playbook means *none of these six* rather than *this server ended normally*
([grounding-sources.md](../grounding-sources.md)).

## What the signals read

Everything here comes from the reads `why-did-it-die` makes on the AMS path,
and nothing else. A row names one of them, and the finding's `evidence.read` is
that name, spelled the same way in `over.reads` — the validator refuses a
finding resting on a read that was not made or that came back unreadable.

| Read | Carries |
|---|---|
| `dedicated-servers get-info` | this server's own record — `status`, `region`, `instanceType`, `imageID`, `sessionID`, `createdAt`, `fleetID` and `fleetName` |
| `dedicated-servers get-history` | per event `oldState` → `newState`, `reason`, `exitCode` and `createdAt` — the timeline, and the read every row below rests on |
| `fleets get` | the fleet's five timeouts — creation, claim, session, drain and unresponsive — and its `dsHostConfiguration`, which is what an OOM finding hands to `fleet-check` |
| `artifacts get` | this server's artifact records, with `status`, **`dsId`**, `filename`, `sizeBytes` and `expiresOn` — the evidence to hand over, and no row fires on it. Measured 2026-09-06: the record carries **no `reason`** on any status, so a cause is never read off one; filter it with `--server-id`, and see § *What not to flag* for the id spelling |
| `fleets get` → `samplingRules` | the fleet's `logs.{success,crashed,unclaimed}` and `coredumps.crashed` rules — which one explains an artifact that was not kept. **Read them off `fleets get`, not off `artifacts get-fleet-sampling-rules`**: measured 2026-09-06, that dedicated verb answers `No fleet sampling rules found` on a fleet whose `fleets get` returns a fully populated `samplingRules` object, so it reports absence where the rules exist |
| `artifacts get-download-url` | a short-lived signed URL for one **`success`** artifact — never followed, and never pasted into the answer; it fails on any other status |
| `fleets get-dedicated-server` | the fleet's servers, where the question named a fleet and a time rather than a server id |

**The history is per server and takes no page parameter.** `ServerHistoryShort`
is `{ namespace, serverID }` and returns `events[]` whole, which is why nothing
here carries the page-walk rule `fleet-check` applies to
`get-history-by-fleet-id`. `exitCode` is a required integer on every event, and
**most of the values it carries are sentinels rather than process exit codes.**
Measured over 275 history events on two live fleets, read 2026-09-06T09:31Z:

| Value | What it means | Where it appears |
|---|---|---|
| **`-99`** | the event is **not** a termination | every `creating`, `ready`, `claiming`, `claimed`, `crash backoff` and `draining` row, without exception |
| **`-1`** | AMS ended the server on **its own timeout**; no process exit was observed | `removed` with `reason` `SESSION_TIMEOUT` or `CLAIM_TIMEOUT` |
| **`0` and above** | the code the **process** returned | `removed` with `reason` `DRAINED`, `CLEAN_EXIT` or `CRASHED` |

So a code is only a code on a terminating row, and a negative value there is
AMS's own outcome rather than the server's. Never present `-99` or `-1` to a
reader as an exit code: say the transition is not a termination, or name the
timeout that ended the server. A `0` **is** meaningful and appears only on a
termination, which is the opposite of what this file said before the
measurement.

**The wire spellings are lowercase, and they are not the page's names.**
create-ams-fleet writes `"Creating"`, `"Ready"` and `"In Session"`; the wire,
measured over 275 history events on two live fleets, read 2026-09-06T09:31Z,
carries **`creating`, `ready`,
`claiming`, `claimed`, `draining`, `removed` and `crash backoff`** — lowercase,
and **`In Session` is not among them**: what a claim produces either side of
itself is `claiming` and `claimed`. Five `reason` values were met on terminating
rows — `CRASHED`, `DRAINED`, `CLEAN_EXIT`, `SESSION_TIMEOUT` and
`CLAIM_TIMEOUT` — and `reason` is the empty string on every non-terminating one.
Cite the page for what a state *means* and this table for what a read *returns*.
Seven values is what two fleets produced and not a closed list, so the rule is
unchanged where it matters: a run matches the state the read returned, quotes it
as read, and — where it holds a state this file does not recognise — reports the
transition and fires nothing. The same rule `extend-app.md` applies to an
`appStatus` its list does not name.

## Signals

| Signal | Fires when | Evidence read | Severity | Confidence | Page | Locator |
|---|---|---|---|---|---|---|
| `oom-killed` | the terminating transition carries `exitCode` 137 | `dedicated-servers get-history` | high | high | yes | — |
| `drain-idle-timeout` | the history shows the server received the drain signal and then terminated | `dedicated-servers get-history` | low | high | yes | — |
| `session-timeout` | the server was in a session, and the time it held that session reaches the fleet's session timeout | `dedicated-servers get-history` | medium | medium | yes | — |
| `unresponsive-timeout` | the history shows the server go unresponsive and then terminate | `dedicated-servers get-history` | high | high | yes | — |
| `creation-timeout` | no ready transition in the history, and the time from creation to termination reaches the fleet's creation timeout | `dedicated-servers get-history` | high | medium | yes | — |
| `never-ready` | no ready transition in the history, and the server ended *before* the fleet's creation timeout elapsed | `dedicated-servers get-history` | high | medium | yes | — |

**No row carries a locator, and that is a property of the subject.** One record
is one server, so each of these fires at most once and `validate` refuses a
locator on any of them — a second firing would be the bug, and there is nothing
for a locator to tell apart.

**Every row's evidence read is the history**, because the history is what every
one of them is *about*: the transition, its instant, its reason and its exit
code. Three rows compare a duration taken from the history against a timeout
read from `fleets get`; `evidence.read` is a single string, so it names the
history, and the finding's own text says which timeout the duration was held
against and what that timeout was set to. `fleets get` still appears in
`over.reads`.

**The last two rows need `fleets get` to be told apart, and they say so when it
did not answer.** `creation-timeout` and `never-ready` share their first
condition — the server never reached ready — and differ only on who ended it:
AMS at the configured limit, or the server on its own before the limit was
reached. Without the fleet's `timeout.creation` there is no line between them,
so the run reports the transitions, records the creation timeout as unread, and
fires **neither** rather than guessing from the reason text — whose vocabulary
this file has not measured.

**The Page column is what `validate` enforces**, and it is the same value
`report_tool.ts` holds as `RESOURCE_SIGNALS["ams-server"]` and
[report-schema.md](../report/report-schema.md) prints. Every row here says
`yes`: each names a mechanism of AMS's, so each finding needs an `https://`
citation. The studio's own numbers travel in `evidence` beside it.

**The severity and confidence columns are the values the finding carries.** Copy
them; do not re-rate a row against the server in front of you. Severity is what
it costs if the cause holds and nobody acts. Confidence is how sure the read is
that the cause holds — `high` where one field or one transition settles it,
`medium` where the finding rests on a duration compared against a setting the
service may have changed since, or on a distinction between two readings the
history cannot make on its own.

**`drain-idle-timeout` is `low` because it is the designed path.** A drained
server is a VM being removed, not a fault; the finding exists so that a
termination with a plain explanation is not read as a crash. Where `fleets get`
answered it also says whether the server exited inside the drain window or
reached its end — the second is a dedicated server that did not act on the drain
signal, which is `health-check`'s `ams-no-drain-handler` and a code change rather
than a setting.

## Grounding

Every row makes a claim about how AMS behaves, so every one carries the public
page that states it, and there is a bullet below for each of the six.

- **What a crash is, and the one exit code with a name.**
  [ams-troubleshooting-guide](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-troubleshooting-guide/):
  "A DS is considered 'CRASHED' if it exits with a non-zero code. For example,
  Exit code 137 indicates the process was killed due to running out of memory
  (OOM). Use Grafana to check for memory usage." That is `oom-killed`, and it is
  the **only** exit code this playbook maps to a cause; every other
  **non-negative** code is reported as read with no name attached, and `-99` and
  `-1` are sentinels rather than codes at all. The same page carries what to do about
  it: "Ensure your VM selection is appropriate for your DS's CPU and memory
  requirements. Consider using a larger VM if crashing persists" — which is why
  the recommendation is instance type and servers-per-VM and hands to
  `fleet-check`, since AMS has no per-server memory knob to raise.
  [ams-2025.7](https://docs.accelbyte.io/gaming-services/knowledge-base/ams-release-note/ams-2025.7/)
  is why a reason is there to quote at all: "Crash Reason Visibility: Crash
  reasons are now displayed in Server Information - DS History".
- **The creation timeout removes a server that never became ready.**
  [create-ams-fleet](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/create-ams-fleet/):
  "The creation timeout starts counting counting when the local watchdog launches
  your dedicated server, and marks its state as 'Creating.' This timeout gives a
  configurable time limit for your dedicated server to initialize, so that if
  your dedicated server fails to do so, AMS will remove the server, and replace
  it with a new one", bounded by the next sentence — "The creation timeout is
  applicable only when the dedicated server is in the 'Creating' state. Once the
  dedicated server notifies the watchdog that it is ready to host a game session,
  it will enter the 'Ready' state." Cite it for `creation-timeout`. The fix is on
  the same axis the fleet check already reads: a timeout below the longest
  creation this fleet actually takes is `ams-fleet.md`'s
  `creation-timeout-below-observed`, and this finding says whether that row is
  worth looking at.
- **A server that ended on its own before the limit is a build or a start
  problem, not a timeout.** ams-troubleshooting-guide states the obligation —
  "Ensure the DS notifies AMS that it is ready to serve players by sending the
  Ready Message within the creation timeout to avoid being removed" — and, under
  *I see a VM count greater than zero, but there are no dedicated servers (DS)
  running*, the three things to check: "Check the History tab to see if DS were
  being created. If they are crashing, check the DS logs", "Verify the DS startup
  command to ensure it is correctly configured", and "Confirm that your game
  build is not faulty (i.e., a 'bad build')." That is `never-ready`, and those
  three are what the finding hands over. The page also names the local
  reproduction: "To test it locally, use the AMS Simulator to verify that the DS
  becomes 'Ready'."
- **The session timeout removes a server that is still holding a session.**
  create-ams-fleet: "The session timeout starts counting when the dedicated
  server is claimed by a game session and enters the 'In Session' state. It gives
  a time limit for your dedicated server to serve a game session so that the
  watchdog can remove stale servers that fail to exit normally once the game
  session has finished." Read that sentence before writing the finding: the
  behaviour the timeout is *for* is a server that failed to exit after the match
  ended, which costs nobody anything. The bad case — a real session running
  longer than the limit — looks identical in the history. So the finding names
  both, says the history cannot separate them, and points at the session length
  the game actually expects. `medium` for that reason, on both columns.
- **The drain timeout applies to an idle server and never to one in a session.**
  create-ams-fleet: "The drain timeout starts counting when the dedicated server
  that is not serving an active game session receives the drain signal from the
  local watchdog. The drain signal tells the dedicated server that the VM it is
  running on is slated to be removed, and gives a configurable period of time for
  it to finish any essential work and then exit before the watchdog forcibly
  kills it. Note that DS which are serving a session will never be subject to the
  drain timeout." Both halves travel with `drain-idle-timeout`: no session was
  cut, and a server that ran to the end of the window was killed rather than
  exiting. ams-troubleshooting-guide carries the code-side obligation — "Ensure
  your DS correctly handles the drain signal, as recommended in the Listening to
  the drain signal section" — which is the hand-off.
- **The unresponsive timeout is about heartbeats.** create-ams-fleet: "The
  unresponsive timeout starts counting when a server goes into unresponsive state
  due to it not sending timely heartbeats to the AMS watchdog. During the
  configured timeout, it is expected for your dedicated server to try to recover
  and send heartbeats again to the watchdog. If the timeout is exceeded before
  receiving a heartbeat, AMS will remove the server and replace it with a new
  one." `high`, because a server that stops answering the watchdog mid-session
  takes the session with it, and the removal is the consequence rather than the
  cause — the finding says the server stopped heart-beating and does not claim to
  know why.
- **Whether there is a log to hand over is a sampling decision.**
  [view-server-logs-and-artifacts](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/view-server-logs-and-artifacts/):
  "Artifacts are only collected when a dedicated server exits and if the sampling
  rules are met", "Skipped: an artifact was not collected because of the sampling
  rule", and "The sampling rule value is a percentage of chance to collect an
  artifact when a dedicated server exits." The same page states the two ways an
  artifact stops being downloadable — "By default, artifacts are retained for 30
  days from the time they are collected", and "Artifacts that are automatically
  deleted will still appear in the Logs and Artifacts page for tracking purposes
  but won't be available for download." That last sentence is the one a run
  needs: a record with no download is not a record that was never collected. It
  also states what live logs cannot do here: "Note that live logs are only
  available for dedicated servers that are currently running. Once a server exits
  or crashes, you'll need to use the artifact collection system to access its
  logs." No row fires on any of this — it is the evidence the report hands over.
- **Usage lives in Grafana, and this check does not reach it.**
  [ams-dashboards](https://docs.accelbyte.io/gaming-services/modules/foundations/tool-utilities/ags-observability/ams-dashboards/)
  is where the numbers behind an OOM are read: "The AMS DS Metrics dashboard is
  the dashboard to use to monitor the resource usage of dedicated servers on the
  underlying hosts", with its "DS Max Memory Usage", "Free Memory per VM" —
  "Consistently dropping to 0 or near 0 indicates that you're running too many
  dedicated servers per VM, leading to memory overutilization" — and "DS Crash
  Rate" panels. Cite it on the `no-operation` rows, which is the only thing those
  rows say.

Do not assert a timeout default, an exit code's meaning, a state's wire spelling
or a memory figure from memory. If a page above does not state it and a read did
not return it, it is not part of the finding.

## The cause classes, and what each hands to

A cause is only useful if it says what to do next, and for four of the six the
next step is somewhere else. This table is the hand-off, and it does not change
any severity above.

| Cause | Hands to |
|---|---|
| `oom-killed` | `fleet-check` — instance type and servers-per-VM are the only density knobs AMS has, and the memory numbers themselves are in Grafana |
| `drain-idle-timeout` | nothing, when the server exited inside the window; `health-check`'s `ams-no-drain-handler` when it did not |
| `session-timeout` | the fleet's session timeout against the match length the game expects — a `fleets get` value a human changes in the Admin Portal |
| `unresponsive-timeout` | the artifact for this server, and the DS's own heartbeat integration |
| `creation-timeout` | `fleet-check` — `creation-timeout-below-observed` is the fleet-wide form of this one server |
| `never-ready` | the artifact for this server, the startup command on `fleets get`, and the build itself |

## What not to flag

- **Not every termination is a fault.** A server that was drained, or that
  finished its session and exited, ended the way AMS intends. Say what the
  transitions show and stop.
- **No name on an exit code other than 137**, and no *code* read off a
  sentinel: `-99` and `-1` are not codes at all (see the table above), so
  "reported exactly as read" below governs the non-negative codes only. 143, 1, 255 and the rest are
  reported exactly as read. The troubleshooting page names one code, and one is
  what this playbook maps.
- **The claim timeout has no row here.** create-ams-fleet documents it: "Claim
  timeout starts counting when the dedicated server enters the 'Ready' state. It
  gives a time limit for your dedicated server to remain idle before being
  claimed for a game session, so that watchdog can remove idle servers that might
  degrade over time and replace them with new ones." A server removed for going
  unclaimed is a fleet-sizing outcome rather than a death to explain, and it is
  not one of the six — a run that reads that transition prints it in the timeline
  and names no cause.
- **`Skipped` is not "no log", and it is not one thing.** The status is a plain
  string on the wire, and the sampling value is spelled **`skipped_sampling`** —
  measured on a real skipped artifact, 2026-09-06. **Not `skipped_sample`**: that
  spelling appeared in this file, and passing it as `?status=skipped_sample`
  returns an empty page — the *same* answer an outright nonsense value returns,
  and never an error. So a run filtering on the old spelling is told "nothing was
  skipped by sampling", which is indistinguishable from a true negative and is
  the failure this correction exists to stop. Match `skipped_sampling`, or match
  a `skipped_` prefix and report the value as read.
  view-server-logs-and-artifacts names three statuses for the Admin Portal's
  list — "Success", "Skipped" and "Failed" — and those do not line up one for
  one with the wire's, so report the value the read returned rather than the
  Portal's word for it. Only the sampling value is a sampling decision, and the
  report says which rule, from `fleets get`'s `samplingRules`; a `skipped_usage` is
  not a sampling decision and the run does not describe it as one. A value this
  file does not name is reported as read. None of them means the server printed
  nothing.
- **The artifact is handed over, never followed — and as an id plus the command,
  never as the signed URL.** The subskill does not read a log body or a core
  dump, and nothing here rests on one. The URL `get-download-url` returns carries
  a temporary AWS session token and expires in minutes, so pasting it into an
  answer both emits credential material and hands over a link that will be dead;
  give the artifact id and the command instead. The call also **fails on any
  record that is not `success`**, with a message calling the artifact "failed"
  regardless of its actual status — measured 2026-09-06 against a
  `skipped_sampling` record, where a `success` record on the same fleet minted a
  URL normally. Report the record's own status, never the error's word for it.
- **An artifact record with no download is not a missing record.** It may simply
  have passed its `expiresOn`, which the page states outright. Say which.
- **No crash *rate*.** A share over a window is a fleet-level number and belongs
  to `fleet-check`'s `crash-share-high`. This playbook explains one server.
- **No claim about what the server consumed.** Nothing this check reads measures
  CPU or memory. Those rows say `no-operation` and cite the dashboards page as
  where the studio reads them — including for the OOM this playbook can name from
  an exit code but cannot quantify.
- **No cost figure.** The Cost Usage dashboard is an estimate AccelByte labels as
  one, and this check cannot read it.
