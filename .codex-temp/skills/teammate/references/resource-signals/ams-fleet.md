---
name: teammate-resource-signals-ams-fleet
description: The signals `fleet-check` looks for on one AMS fleet — what each fires
  on, which read settles it, what it is worth, and the public page behind every claim
  about AccelByte. Read before Stage 3.
last-verified: 2026-09-04
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/create-ams-fleet/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/fleet-sizing/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/capacity-limitations/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/upload-a-dedicated-server-build/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/view-server-logs-and-artifacts/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/using-build-configs/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/how-to/fallback-fleets/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-troubleshooting-guide/
- https://docs.accelbyte.io/gaming-services/knowledge-base/ams-release-note/ams-2025.7/
- https://docs.accelbyte.io/gaming-services/modules/foundations/tool-utilities/ags-observability/ams-dashboards/
see-also:
- '[fleet-check.md](../../subskills/fleet-check.md)'
- '[grounding-rules.md](../grounding-rules.md)'
- '[grounding-sources.md](../grounding-sources.md)'
- '[sizing-sources.md](../sizing-sources.md)'
- '[report-schema.md](../report/report-schema.md)'
---

# Resource signals: AMS fleet

The rows `fleet-check` fires, for `subject.kind: ams-fleet`. Each is a row of the
closed table `report_tool.ts` holds as `RESOURCE_SIGNALS["ams-fleet"]` and
[report-schema.md](../report/report-schema.md) § *Resource-check report* prints;
a signal this file names and that table does not is refused at `validate`, and
adding one means adding it in all three places in one change.

**Subject kind:** `ams-fleet`.

**Signal set bounded by:** the signals written into this file.

No AccelByte index enumerates a fleet's configuration obligations. The pages
below state them inside prose about how a fleet is created and sized, so there
is nothing to walk, and a clean result from this playbook means *none of these
thirteen* rather than *nothing wrong with the fleet*
([grounding-sources.md](../grounding-sources.md)).

## What the signals read

Everything here comes from the reads `fleet-check` Stage 2 makes, and nothing
else. A row names one of them, and the finding's `evidence.read` is that name,
spelled the same way in `over.reads` — the validator refuses a finding resting
on a read that was not made or that came back unreadable.

| Read | Carries |
|---|---|
| `fleets get` | `dsHostConfiguration` (instance type, servers-per-VM), per-region `minServerCount` / `maxServerCount` / `bufferSize` / `dynamicBuffer`, the five timeouts, `hibernateAfterPeriod`, whether the fleet is a fallback |
| `fleets list` | the live per-region counts — `readyServerCount`, `claimedServerCount`, `runningVMCount` — and `active` / `onDemand` |
| `images get`, `images get-storage` | the deployed image's `deleteAt` and `isProtected`; account image usage against quota |
| `artifacts get`, `fleets get` → `samplingRules` | this fleet's artifact records with `status`, `dsId`, `filename` and `sizeBytes` — and **no `reason`**, which the record carries on no status (measured 2026-09-06); the fleet's `logs.{success,crashed,unclaimed}` and `coredumps.crashed` rules. The rules come off `fleets get`: `artifacts get-fleet-sampling-rules` answers `No fleet sampling rules found` on a fleet that has them (measured 2026-09-06) |
| `get-history-by-fleet-id` | one **`status`** per event, with `reason`, `exitCode`, `serverId`, `region` and `createdAt`. **Not `oldState` → `newState`** — that pair is on the *per-server* history; this read gives the state entered and never the one left (measured 2026-09-06) |
| `get-usage` | the artifact quota this account is consuming — the compacting row's input, and nothing a signal fires on |
| `account get` | the account limits every capacity comparison is bounded by, `imageStorageQuotaBytes` among them |
| `info list-supported-instances` | vCPU / memory per instance type and the per-region capacity for it |
| `dev-server-config list` | a development fleet's build configurations, their images and their expiration dates |

`fleets list` names fleets and carries the live counts; it carries no sizing
knob at all. Every threshold below that compares a *setting* reads it from
`fleets get` on the one named fleet ([sizing-sources.md](../sizing-sources.md)).

## Signals

| Signal | Fires when | Evidence read | Severity | Confidence | Page | Locator |
|---|---|---|---|---|---|---|
| `active-region-cannot-warm` | on an active production fleet, a region with `minServerCount == 0` **and** `bufferSize == 0` **and** `dynamicBuffer` off | `fleets get` | high | high | yes | region |
| `counts-not-multiple-of-servers-per-vm` | a region's `minServerCount` or `maxServerCount` is not a multiple of `serversPerVM` | `fleets get` | medium | high | yes | region |
| `image-scheduled-for-deletion` | the image the fleet deploys carries a `deleteAt` | `images get` | high | high | yes | — |
| `image-storage-near-quota` | `currentUsageBytes` is at or above 90 % of `quotaBytes` | `images get-storage` | medium | medium | — | — |
| `crashed-logs-sampling-off` | `samplingRules.logs.crashed == 0` or `samplingRules.coredumps.crashed == 0` | `fleets get` | medium | high | yes | — |
| `artifacts-failing` | at least 5 artifact records for this fleet in 7 days and ≥ 10 % of them `failed`; the finding gives the share and names the affected `dsId`s — it quotes **no `reason`**, because the record carries none (measured 2026-09-06) | `artifacts get` | medium | medium | yes | — |
| `crash-share-high` | at least 10 terminations in 24 h and ≥ 20 % of them exit non-zero; exit 137 counted and named on its own | `get-history-by-fleet-id` | high | medium | yes | — |
| `creation-timeout-below-observed` | `timeout.creation` is below the longest creation→ready the window actually shows | `get-history-by-fleet-id` | medium | medium | yes | — |
| `fallback-has-own-buffer` | the fleet carries a `primaryFleet` — it *is* another fleet's fallback — and a region enabled on both carries `bufferSize > 0` | `fleets get` | low | high | yes | region |
| `dev-fleet-never-hibernates` | a development fleet with no `hibernateAfterPeriod` set | `fleets get` | low | high | yes | — |
| `build-config-expiring` | a build configuration on this fleet expires within 7 days | `dev-server-config list` | low | high | yes | build configuration name |
| `instance-type-capacity` | the region's capacity for the configured instance type is below `maxServerCount / serversPerVM` instances | `info list-supported-instances` | medium | medium | yes | region |
| `idle-min-servers` | a region holds `minServerCount > 0` with `claimedServerCount == 0` **at the instant of the read** | `fleets list` | low | medium | — | region |

**The Evidence read column is one read, and that is the one `evidence.read`
names.** Two rows compare fields from two reads — `creation-timeout-below-observed`
holds `timeout.creation` from `fleets get` against durations from the history, and
`instance-type-capacity` holds `maxServerCount` and `serversPerVM` from `fleets get`
against the capacity from `info list-supported-instances`. `evidence.read` is a
single string, so each names the read that carries the number the *finding is
about* — the observed durations, the region's capacity — and the finding's own
text says what it was compared against. Both reads still appear in `over.reads`.

**The Page column is what `validate` enforces**, and it is the same value
`report_tool.ts` holds as `RESOURCE_SIGNALS["ams-fleet"]` and
[report-schema.md](../report/report-schema.md) prints. `yes` means the claim is
about how AMS behaves, so the finding needs an `https://` citation; a dash means
the claim is the studio's own numbers and is cited through `evidence` alone.

**The severity and confidence columns are the values the finding carries.** Copy
them; do not re-rate a row against the fleet in front of you. Severity is what it
costs if the condition holds and nobody acts. Confidence is how sure the read is
that the condition holds — `high` where one field settles it, `medium` where the
finding rests on a share, on a threshold this file chose, or on a comparison
across two reads that can disagree for reasons neither read shows.

**Two thresholds here are this playbook's, not AccelByte's.** The 10 % failed-artifact
share and the 20 % crash share, and both floors under them, are chosen here so the
signals are runnable and so two runs on one fleet mean the same thing. A finding
says the bar it crossed and whose bar it is. What AccelByte's own page settles is
the *definition* underneath — what counts as a crash — and that is what the
citation is for. A run must not present either percentage as a published limit.

**One row is gated, and the measurement that would have opened it closed it
instead.** `creation-timeout-below-observed` rests on creation-to-ready durations
reconstructed from the history endpoint, which is a reconstruction rather than
the series an operator reads. Three things have to hold before it may fire. Two
are about the endpoint: that a page walk returns every transition for every
server over the window, and that it terminates without losing or duplicating a
row. The third is about the data: that the transitions bounding the duration are
recorded at all — a fleet whose servers never start emits history full of
failures and not one `ready`, so a walk over it can look complete while
establishing nothing this row needs.

All three were exercised against a churning fleet on 2026-09-04. The first
holds. The second holds for loss and **fails for duplication**: a walk over a
live fleet returns extra copies of rows it already returned, which the dedupe
rule in `fleet-check` handles. The third is what keeps this row closed. A `ready`
row is recorded for every server, but the `creating` row that would give the
duration its start instant is **missing for some servers** — measured as 10 of
34, and exactly the first two servers on each of the five machines the fleet
used. Where both rows are present the interval is sound: a server made to delay
its ready signal by 45 seconds produced 45.1 seconds of history. So this is a
gap in coverage, not in the clock — but the omitted servers have no duration at
all, which makes the maximum a maximum over an unrepresentative subset. Neither
the size nor the direction of that bias was measured, and the obvious guess is
not safe: on the fleet built to measure the interval, servers that were first on
their own machine carried no provisioning time inside it.

So the run records the creation timeout as read and says the comparison was not
available. If the missing rows are ever explained or filled, its `rests_on` is
`derived-from-history` and never `measured`.

**`idle-min-servers` is point-in-time by definition.** `claimedServerCount` is one
sample, so a finding on it rests on `configured-only`, carries the instant it was
read, and says "0 claimed at `<instant>`". `validate` refuses any other `rests_on`
on this row — a sample relabelled `measured` is a claim about the window that the
read behind it cannot support.

**And a claimed count of that shape was measured wrong.** Reading a live fleet 43
times through `fleets get-dedicated-server`, the `regions[].claimedServerCount`
in the response disagreed with the `servers[]` array in **the same response** 6
times out of the 26 reads where it could — in both directions, and once
reporting **0 claimed while two servers were in fact claimed**, which is exactly
the condition this row fires on. That was a different read from the one this row
uses, and whether `fleets list` carries the same defect is unmeasured, so this is
not a rule about which field to trust. It is a reason the row stays at `low` and
stays `configured-only`: a single claimed count is a number that has been
observed to be wrong, and a run with the per-server list already in hand should
prefer it.

## Grounding

Every row whose Page column says `yes` makes a claim about how AMS behaves, so it
carries the public page that states it, and there is a bullet below for each of
the eleven. The two dashes — `idle-min-servers` and `image-storage-near-quota` —
assert nothing about AccelByte: each reports two of the studio's own numbers and
is cited through `evidence` alone.

- **Scaling that cannot warm.** [fleet-sizing](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/fleet-sizing/)
  states what a buffer is for: "The buffer size tells the fleet how many servers
  it needs to keep 'Ready' so that game sessions can claim them immediately.
  Starting a new server may take 1 to 10 minutes, which is an unacceptable wait
  time for players." [create-ams-fleet](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/create-ams-fleet/)
  adds the consequence directly: "An incorrectly configured scaling strategy leads
  to players being unable to claim a DS for their match. Insufficient max or
  buffer size are a common cause of claim failures." Cite either for
  `active-region-cannot-warm`.
  The same page says a minimum of 0 is *usually sufficient* **assuming a buffer is
  set** — which is why this row needs all three conditions and not one of them.
- **Creation takes 1 to 10 minutes**, per the sentence above. Do not write "assume
  10 minutes": the page states a range, and the upper end of a range is not the
  figure it published.
- **What the creation timeout does when it expires** is what
  `creation-timeout-below-observed` cites, and it is on
  [create-ams-fleet](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/create-ams-fleet/):
  "This timeout gives a configurable time limit for your dedicated server to
  initialize, so that if your dedicated server fails to do so, AMS will remove the
  server, and replace it with a new one." That is the finding — a timeout below
  the longest creation this fleet actually took means AMS is killing servers that
  would have become ready, and starting the wait again. Pair it with the 1-to-10-minute
  range above for what a plausible value looks like.
- **Rounding to servers-per-instance.** create-ams-fleet: "The fleet maximizes AMS
  instance usage by rounding the minimum and maximum servers to the nearest
  multiple of servers per instance… for example, if when having 5 servers per
  instance, a minimum of 3, and a maximum of 28, the fleet adjusts to 5 and 30,
  respectively." fleet-sizing states the same rule. Cite either for
  `counts-not-multiple-of-servers-per-vm`, and note what the page actually says
  the service does: it **accepts the value and rounds it**. The finding is that
  the number in force is not the number configured — 3 becomes 5, 28 becomes 30 —
  and never that the service will refuse the setting.
- **Images are account-level, and unprotected unreferenced ones age out.**
  [upload-a-dedicated-server-build](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/upload-a-dedicated-server-build/):
  "All dedicated server images are stored at the account level, meaning that all
  namespaces that link to the same AMS account will have access to all the
  dedicated server images that are uploaded to it", and "Protecting a server image
  prevents it from being automatically deleted by AMS after 30 days if no fleets
  referencing it." The same page: "only unprotected server images that are not
  referenced by fleets can be scheduled for deletion. Once an image is scheduled,
  it will be deleted after one to two hours." Cite it for both image rows.
  For `image-scheduled-for-deletion` that last sentence is the whole severity: a
  deployed image carrying `deleteAt` is either about to disappear from under a
  running fleet within hours, or it is in a state the Portal's own rule does not
  produce. Both are worth a high finding, and the report says which it saw rather
  than choosing between them.
  `image-storage-near-quota` is the row this page does **not** ground, which is why
  it carries no Page. The page says nothing about a storage quota — no figure, and
  nothing about what happens at one — so the finding is the ratio of two fields
  `images get-storage` returned and nothing more. The *advice* beside it does rest
  on this page, and citing it there is fine: protect the images you need, and the
  unprotected unreferenced ones age out on their own in 30 days.
- **Sampling decides whether a crash leaves a log.**
  [view-server-logs-and-artifacts](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/view-server-logs-and-artifacts/):
  "Artifacts are only collected when a dedicated server exits and if the sampling
  rules are met", "Skipped: an artifact was not collected because of the sampling
  rule", and "The sampling rule value is a percentage of chance to collect an
  artifact when a dedicated server exits." A rule at 0 is a 0 % chance, which is
  what `crashed-logs-sampling-off` reports. The same page carries the artifact
  statuses `Success` / `Skipped` / `Failed` and the 30-day retention that
  `artifacts-failing` rests on. Changing a rule needs the fleet down first: "If you
  have an existing fleet you want to configure, you need to deactivate it before
  you can modify the sampling rules, then re-activate it to start collecting
  artifacts" — a recommendation that does not say so is asking for an outage
  nobody scheduled.
- **What a crash is.** [ams-troubleshooting-guide](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-troubleshooting-guide/):
  "A DS is considered 'CRASHED' if it exits with a non-zero code. For example,
  Exit code 137 indicates the process was killed due to running out of memory
  (OOM)." That is the definition `crash-share-high` counts against, and the only
  exit code this playbook maps to a cause. Every other **non-negative** code is
  reported as read — `-99` and `-1` are sentinels this endpoint returns rather
  than codes a process gave (`ams-server.md` § the history read), and are never
  reported as codes at all, with no name attached to any of them.
  [ams-2025.7](https://docs.accelbyte.io/gaming-services/knowledge-base/ams-release-note/ams-2025.7/)
  is why a reason is there to quote at all: "Crash Reason Visibility: Crash reasons
  are now displayed in Server Information - DS History."
- **A fallback fleet's buffer is adjusted, in both directions.** [fallback-fleets](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/how-to/fallback-fleets/):
  "A fallback fleet also works like a regular fleet, except that its Buffer Value
  for regions which are enabled on both are dynamically adjusted based on the
  primary fleet's target DS count and Max Servers setting: When the target DS count
  for the primary fleet is below its Max Servers setting, the Buffer Value of the
  fallback fleet is set to zero." The next sentence is the other half and the
  finding must carry it: "When the primary fleet exceeds its Max Servers capacity,
  the fallback fleet's Buffer Value increases to provide the extra desired buffer
  of ready servers." So this is **not** "AMS overrides your setting". Below the
  primary's max the configured buffer does nothing; above it, the fallback scales.
  Two conditions from the same sentence bound the row, and dropping either widens
  it past the page: the adjustment applies **only to regions enabled on both
  fleets**, and only while the primary is below its max. `low`, because nothing
  breaks — it is worth saying because a Portal number that is zero most of the time
  reads as a setting in force.
  Which fleet the row fires on is the easy thing to get backwards. `fleets get`
  returns **both** `fallbackFleet` and `primaryFleet` (`APIFleetGetResponse`), and
  they point opposite ways: `fallbackFleet` is set on the *primary* and names the
  fleet it falls back to, `primaryFleet` is set on the *fallback* and names the
  fleet it backs. The buffer this row is about belongs to the fallback, so the row
  fires on a fleet carrying `primaryFleet`.
- **Hibernation is a development-fleet setting**, and it is documented on
  create-ams-fleet, not on the build-configs page: "For additional cost efficiency,
  development fleets can be set to 'hibernate' after a configured period has passed
  without matching claim requests or running DS. When a development fleet is
  hibernated, its effective buffer is set to zero, draining any watchdogs and
  releasing VMs." Cite create-ams-fleet for `dev-fleet-never-hibernates`.
- **Build configurations expire.** [using-build-configs](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/using-build-configs/):
  "Enter an expiration date for your Build Configuration, after which the Build
  Configuration will be automatically deleted… If you don't provide an expiration
  date, your Build Configuration will be automatically deleted after 30 days."
- **Instance capacity is per type, per region, and shared across the account.**
  [capacity-limitations](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/capacity-limitations/):
  "The available capacity of your instances depends on the instance type and
  region", and "The capacity of your instances is tracked on the account level,
  meaning that different fleets within your AMS account consume the same capacity."
  The page's own worked example is the arithmetic: "the limit for us-west-2 is 100
  instances, allowing you to run 500 dedicated servers (DS) if you chose to run
  five DS per instance." That account-level sharing is why
  `instance-type-capacity` is `medium` and not `high`: this check reads one fleet,
  so a region that clears the bar on its own can still be short once the account's
  other fleets are counted. Say the comparison was made against one fleet.
- **Usage lives in Grafana, and this check does not reach it.**
  [ams-dashboards](https://docs.accelbyte.io/gaming-services/modules/foundations/tool-utilities/ags-observability/ams-dashboards/)
  is where DS CPU and memory, crash rate over time and cost estimates are read.
  Cite it on the `no-operation` rows, which is the only thing those rows say.

Do not assert a timeout default, a quota figure, a price or a capacity number from
memory. If a page above does not state it and a read did not return it, it is not
part of the finding.

## What not to flag

- **No per-dedicated-server CPU or memory advice.** AMS has no such knob: density
  is instance type multiplied by servers-per-VM and nothing else
  ([sizing-sources.md](../sizing-sources.md)). A finding that recommends a DS
  resource request has invented a setting.
- **An inactive fleet holds no VMs.** No compaction, no idle-capacity and no
  cannot-warm finding on one. Say it is inactive and stop.
- **A development fleet is not a production fleet that forgot its buffer.**
  Development fleets start servers on demand and do not maintain a ready buffer;
  `active-region-cannot-warm` does not fire on one.
- **`idle-min-servers` never says "unused".** It says 0 claimed at the instant of
  the read. One sample of a count taken at 03:00 is not a statement about the
  evening.
- **No claim that an upload will fail at the image quota.** No public page states
  the image storage quota is enforced, and the artifact usage limit is documented
  as *not* enforced — "The usage limit is currently not enforced and is presented
  for informative purposes only" — so enforcement here is not something to infer
  from a sibling quota. `image-storage-near-quota` reports the ratio and points at
  the 30-day auto-delete as the lever.
- **Neither threshold is presented as AccelByte's.** The 10 % failed-artifact share
  and the 20 % crash share are this file's, and a finding that quotes one without
  saying whose bar it is has attributed a number to a page that does not carry it.
- **No cost figure.** The Cost Usage dashboard is an estimate AccelByte labels as
  one, and this check cannot read it.
- **No crash cause per server.** A share over a window is a fleet-level number.
  One server's death is `why-did-it-die`, and this playbook does not name a cause
  for a single termination.
