---
name: teammate-resource-signals-extend-app
description: The signals `extend-app-check` looks for on one Extend app — what each
  fires on, which read settles it, what it is worth, and the public page behind every
  claim about AccelByte. Read before Stage 3.
last-verified: 2026-09-04
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-app-lifecycle/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-app-cpu-memory-replicas/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-autoscaling/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-usage-limits/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-pricing/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-app-vm-configurations/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/configuring-envars/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/performance-and-security/vulnerability-scanning/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/observability/manage-extend-app-notifs-and-subscribers/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/local-debugging/local-debugging-remote/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/observability/extend-dashboards/
see-also:
- '[extend-app-check.md](../../subskills/extend-app-check.md)'
- '[ams-fleet.md](ams-fleet.md)'
- '[grounding-rules.md](../grounding-rules.md)'
- '[grounding-sources.md](../grounding-sources.md)'
- '[sizing-sources.md](../sizing-sources.md)'
- '[report-schema.md](../report/report-schema.md)'
---

# Resource signals: Extend app

The rows `extend-app-check` fires, for `subject.kind: extend-app`. Each is a row
of the closed table `report_tool.ts` holds as `RESOURCE_SIGNALS["extend-app"]`
and [report-schema.md](../report/report-schema.md) § *Resource-check report*
prints; a signal this file names and that table does not is refused at
`validate`, and adding one means adding it in all three places in one change.

**Subject kind:** `extend-app`.

**Signal set bounded by:** the signals written into this file.

No AccelByte index enumerates an Extend app's configuration obligations. The
pages below state them inside prose about how an app is created, scaled, scanned
and paid for, so there is nothing to walk, and a clean result from this playbook
means *none of these thirteen* rather than *nothing wrong with the app*
([grounding-sources.md](../grounding-sources.md)).

## What the signals read

Everything here comes from the reads `extend-app-check` Stage 2 makes, and
nothing else. A row names one of them, and the finding's `evidence.read` is that
name, spelled the same way in `over.reads` — the validator refuses a finding
resting on a read that was not made or that came back unreadable.

| Read | Carries |
|---|---|
| `apps get` | `appStatus`, `replica.{minReplica,maxReplica,currentReplica,rolloutReadyReplicas}`, `cpu.{requestCPU,cpuLimit}`, `memory.{requestMemory,memoryLimit}`, `autoscaling.targetCPUUtilizationPercent`, `enableDebugMode`, `scenario`, `vmSharingConfiguration`, `basePath`, `servicePublicURL`, `isResourceApplied` and `redeploymentInfo`. It carries **no `message`** — absent from every state met on a live app (§ 9.2), so a run that wants failure text reads `deployments list` |
| `apps list` | every app in this namespace with the same fields — the population the packing estimate sums over, and nothing a per-app signal fires on |
| `apps get-release-info` | the latest release: deployment id, image tag, release date |
| `deployments list` | per deployment `status`, `message`, `imageTag`, `updatedAt` — the failure text a human otherwise reads in the Admin Portal |
| `images list` | per image `imageTag`, `imageDigest`, `size`, `updatedAt` and `IsActive` — capital I, as the wire spells it — plus **one** `vulnerabilityStatus` for the whole list. Measured 2026-09-05 (§ 9.2): `imageScanStatus` and `findingSeverityCounts` are not on this response, so a run reads scan state off `vulnerabilityStatus` and reports the per-severity counts as unavailable |
| `config list-variables`, `config list-secrets` | per entry `configName`, `deploymentStatus` — `deployed` or `undeployed` — `editable`, and `value`. On a secret the `value` is a **masked prefix of the real one** (the first five characters followed by asterisks, with `applyMask: true`), measured 2026-09-05 (§ 9.2). It is still secret material: § *Must NOT fire* forbids reading, logging or quoting a secret's value, and that covers the masked form, which leaks the first characters |
| `subscriptions` | who receives the Down Status and Image Vulnerability emails |
| `app debug-info` | `isDebugModeEnabled` and `isDebugSessionConnected`, and the debug pods |
| `resource-limits list` | this environment's own CPU, memory and replica ceilings — the numbers every comparison against a cap is made against |
| `app logs` | the dead container's last output, where a command-line tool for it is already in the session — quoted under a finding, never a finding of its own, and no row below rests on it |

Two of these carry the same fact and are not interchangeable. `apps get` returns
`enableDebugMode`, the app's stored setting; `app debug-info` returns
`isDebugModeEnabled` **and** `isDebugSessionConnected`, and only the second says
whether anyone is attached right now. The debug row rests on `app debug-info`
where it answered, because the setting alone cannot tell the two states apart.

**`deployments list` is namespace-level, keyed by app id, and returns oldest
first.** The route is `POST /csm/v2/admin/namespaces/{namespace}/deployments`
with `{"appIds": ["<appId>"]}` — the app's **id**, not its name, which `apps
get` returns as `appId`. Rows come back in ascending `updatedAt`, so **`data[0]`
is the oldest row and the newest is last**; any rule about "the newest
deployment" sorts by `updatedAt` and never takes the first element. A superseded
deployment **keeps its old status** and nothing retires it: on a live app three
rows read `deployment-running` at once, beside a fourth reading
`deployment-timeout`, while only one deployment was actually serving. The newest
row is the only one that describes now, and the app's own `currentReplica` is
what says whether anything is serving at all (measured 2026-09-05, § 9.2).

**A deployment record's `message` is optional on every status**, not only on a
timeout — a shape of the read rather than anything a page states. Quote it
verbatim when it is there and say it was absent when it is not; never write "no
reason was given" as though the service had chosen silence, and never infer a
cause from the status alone.

**No signal rests on `app logs`, and that is deliberate.** A log line is what the
studio's own process printed about itself: it is not a claim about how Extend
behaves, so it grounds nothing and owes no page, and it is not a condition a
closed table can fire on. It is quoted under the finding it explains — the failed
deployment, the app that is down — and the read is recorded either way, because a
tool that never answered, a tool that answers `--help` without listing a `logs`
command, and a container that printed nothing are three different facts — the
middle one is `errored`, and `v0.0.14` is the first release that carries `logs
stream`.

`resource-limits list` is per environment and states no permission of its own. A
403 from it is recorded as `unauthorized` and the ceiling is reported as unknown;
never substitute the documented default for a ceiling that could not be read
([sizing-sources.md](../sizing-sources.md)).

## Signals

| Signal | Fires when | Evidence read | Severity | Confidence | Page | Locator |
|---|---|---|---|---|---|---|
| `app-not-running` | `appStatus` is a failure or timeout state, or `deployment-down` | `apps get` | high on `deployment-failed`, `deployment-timeout`, `deployment-down`; medium on the create, stop and remove failures | high | yes | — |
| `last-deployment-failed` | the newest deployment's `status` is a failure or a timeout | `deployments list` | high | high | yes | — |
| `active-image-has-critical-findings` | the list's `vulnerabilityStatus` reports critical findings for the active image. **Unfireable on the shape measured 2026-09-05** — see below | `images list` | high | high | yes | — |
| `image-scan-pending` | the active image has no completed scan result — `vulnerabilityStatus` empty | `images list` | low | medium | yes | — |
| `config-undeployed` | a variable or a secret carries `deploymentStatus: undeployed` **and the app has been deployed at least once** — see the paragraph below, which is a condition and not a caveat | `config list-variables` or `config list-secrets` | medium | high | yes | variable or secret name |
| `debug-mode-enabled` | debug mode is on — `isDebugModeEnabled`, or `enableDebugMode` where the debug read did not answer | `app debug-info` | medium | high | yes | — |
| `no-alert-subscribers` | the subscriber list is empty | `subscriptions` | low | high | yes | — |
| `image-count-near-cap` | the app holds 45 images or more | `images list` | low | medium | yes | — |
| `cannot-scale` | `minReplica == maxReplica` | `apps get` | medium | high | yes | — |
| `pinned-at-max-replica` | `currentReplica == maxReplica` **at the instant of the read** | `apps get` | medium | medium | yes | — |
| `request-above-ceiling` | a CPU or memory request is above this environment's ceiling | `apps get` | high | high | yes | — |
| `no-autoscaling-target` | no target CPU utilization is in force — absent, or outside the published 30-to-90 range | `apps get` | low | high | yes | — |
| `namespace-packing-estimate` | always, once every app in the namespace was read | `apps list` | info | medium | — | — |

**The Evidence read column is one read, and that is the one `evidence.read`
names.** Two rows compare fields across two reads — `request-above-ceiling` holds
the app's request against `resource-limits list`, and `namespace-packing-estimate`
sums over `apps list` while the ceilings come from elsewhere. `evidence.read` is a
single string, so each names the read carrying the number the *finding is about*,
and the finding's own text says what it was compared against. Both reads still
appear in `over.reads`. `image-count-near-cap` is not one of them: it holds one
read's count against a figure a page publishes, and a published figure is a
citation rather than a read.

**The Page column is what `validate` enforces**, and it is the same value
`report_tool.ts` holds as `RESOURCE_SIGNALS["extend-app"]` and
[report-schema.md](../report/report-schema.md) prints. `yes` means the claim is
about how Extend behaves, so the finding needs an `https://` citation; a dash
means the claim is the studio's own numbers and is cited through `evidence`
alone.

**The severity and confidence columns are the values the finding carries.** Copy
them; do not re-rate a row against the app in front of you. Severity is what it
costs if the condition holds and nobody acts. Confidence is how sure the read is
that the condition holds — `high` where one field settles it, `medium` where the
finding rests on a threshold this file chose, on a single sample, or on a sum
whose population the run may not fully see.

**`app-not-running` fires on a fault and never on a state somebody chose.**
`appStatus` is a plain string on the wire with no enumeration in the response
model, so the vocabulary below is the one the read operation's own description
publishes, and it is listed in full rather than counted — a run holding a value
this list does not name should report it as read and claim nothing about it.

| Group | Values | What the run does |
|---|---|---|
| Chosen or complete | `deployment-running`, `app-stopped`, `app-undeployed`, `app-removed` | no finding; say which one |
| In flight | `app-creating`, `deployment-in-progress`, `app-stopping`, `app-removing` | no finding; report it in the summary and say the answer is a moment old |
| Failed or timed out | `deployment-failed`, `deployment-timeout`, `deployment-down`, `app-creation-failed`, `app-creation-timeout`, `app-stop-failed`, `app-stop-timeout`, `app-remove-timeout` | fire, at the severity the table gives — but see the `deployment-down` paragraph below, which is the one value in this group that a healthy app passes through |

An app that is simply not deployed yet has not failed at anything, and an app
caught mid-operation has not either.

**`config-undeployed` needs the same exclusion, and for a reason only a live app
shows.** On an app created and never deployed, **every** configuration row reads
`deploymentStatus: undeployed` — nine platform-owned variables on a fresh
service extension (`AB_BASE_URL`, `AB_NAMESPACE`, `BASE_PATH`,
`ENABLE_REQUEST_SIZE_LIMIT` and five `OTEL_*`), all `editable: false`, none of
them anything a studio set (measured 2026-09-05, § 9.2). Firing on them would
report nine drifts against an app whose state § *Must NOT fire* already says is
not a fault, so the signal is gated on `appStatus` not being `app-undeployed`.
Drift means *saved and not applied*, and on an app that was never deployed there
is nothing to have applied it to.

**The in-flight group is not a safe harbour either.** `deployment-in-progress`
means the service has not settled, and it does not bound how long that lasts: a
deployment whose image cannot start held it for **60 minutes** before turning
`deployment-timeout`, with the app at `currentReplica: 0` the whole time
(§ 9.3). So a run reporting an in-flight state says the replica count with it,
because zero ready replicas and an in-flight status together mean the app is
down now whatever it settles on later — and that is a fact reported, not a
signal fired, because nothing published says when in-flight becomes failure.

**`deployment-down` is a state an app that is fine passes through in seconds.**
Measured 2026-09-05 (§ 9.3): a single container exit on a running service
extension moved `appStatus` `deployment-running` → `deployment-down`
(`currentReplica` 0) → `deployment-running`, bracketed by two reads **13 seconds
apart** — so at most 13 s and probably far less, since the replacement container
was already answering 1.7 s in. Kubernetes restarted the container inside the
same pod, so the pod name did not change either. `deployments list` did not change
at all — same rows, same statuses, same `updatedAt`. So this value does not mean
"the app is down"; it means the app was down at the instant of the read, and a
finding on it says that instant and nothing about duration. Fire it — a read
that caught it caught something real — and word it so a reader who checks again
and finds the app up does not conclude the check was wrong.

**Its absence proves nothing, which is the half a run is more likely to get
wrong.** An app that died twenty seconds ago reads `deployment-running` with an
unchanged deployment ledger, because nothing in CSM records that a restart
happened: no new deployment row, no `updatedAt` bump, no restart counter
anywhere. A run may never write that an app did not restart, or that it has been
up since its last deployment — the reads here cannot support either. The only
durable evidence of a restart is the container's own `--previous` log and the
process's own uptime, and neither of those is a read in this table.

**An app can be unresponsive and read perfectly healthy, and no signal here
fires on it.** Measured 2026-09-05 (§ 9.3): a service extension whose gRPC
health server reported `NOT_SERVING` and whose every handler blocked served
nothing for ten minutes, while `apps get` returned `deployment-running` with
`currentReplica: 1` and `rolloutReadyReplicas: 1` on all 38 reads, and
`deployments list` did not change. This is a **gap stated, not a row added**:
there is no read in this table behind it, so a signal for it would be an
inference. What it constrains is the wording of a clean result — a run that
fires nothing says the app's configuration and lifecycle state are clean, never
that the app is serving traffic, because nothing here measured that.

**The two image-scan signals rest on a field this read did not return.**
Measured 2026-09-05 (§ 9.2): `images list` returns, per image, `imageTag`,
`imageDigest`, `size`, `updatedAt` and `IsActive`, plus **one**
`vulnerabilityStatus` for the whole list — no `imageScanStatus`, and no
`findingSeverityCounts` anywhere. So `active-image-has-critical-findings` has no
field to fire on and must not be reported as clear: a run says the per-severity
counts were **not readable** and that the image's security status is unknown,
which is an `over.reads` fact and not a cleared signal. `image-scan-pending`
survives, reading the list-level `vulnerabilityStatus` — which was empty on
every read across 2 h 22 min on an image active for over two hours, so an empty
value does not by itself mean a scan is in flight, and the finding says the
status is unknown rather than that a scan is pending.

Whether another environment returns the two absent fields is not settled by one
namespace; what is settled is that a run may not assume them. Read what came
back, fire on what is there, and record the rest as unreadable.

**Two numbers here are this playbook's, not AccelByte's.** The 45-image floor
under `image-count-near-cap` and the equality tests under `cannot-scale` and
`pinned-at-max-replica` are chosen here so the signals are runnable and so two
runs on one app mean the same thing. A finding says the bar it crossed and whose
bar it is. What AccelByte's own pages settle is what happens *at* the cap and
what horizontal scaling does, and that is what the citation is for.

**`pinned-at-max-replica` is point-in-time by definition.** `currentReplica` is
one sample, so a finding on it rests on `configured-only`, carries the instant it
was read, and says "at `<instant>`". `validate` refuses any other `rests_on` on
this row — a sample relabelled `measured` is a claim about the window that the
read behind it cannot support.

## Grounding

Every row whose Page column says `yes` makes a claim about how Extend behaves, so
it carries the public page that states it. The bullets below are grouped by page
rather than one per row, because one page settles several rows and every one of
the twelve is named in the bullet that covers it. The one dash —
`namespace-packing-estimate` — asserts nothing about AccelByte on its own: it is
a sum over the studio's own settings, cited through `evidence`. The arithmetic it
uses *is* published, and the finding cites those pages in its own text; what it
may not do is present the sum as a figure AccelByte states.

- **What a failed or timed-out app means, and what to do about it.**
  [extend-app-lifecycle](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-app-lifecycle/)
  names each outcome: "deployment failed: Signifies that an error occurred during
  the deployment process", "timeout: Indicates that the deployment exceeded the
  configured timeout period", and for creation "provisioning failed: Signifies an
  error occurred during the creation process". The remedies differ by stage and
  the finding carries the right one: "If a deployment fails or times out, trigger
  a redeployment to retry", against "If creation fails, delete the app and try
  again." Cite it for `app-not-running` and `last-deployment-failed`.
  The same page is why a stopped or undeployed app is not a fault: "undeployed:
  Indicates the application was successfully created and is now ready for
  deployment", and "You retain full control over your app's runtime state and can
  trigger start or stop actions at any time."
  One state this page does not name is `deployment-down`. The API returns it and
  what it means is stated on the notifications page below — "Downtime: If the app
  experiences any outages or downtime" — so a `deployment-down` finding cites
  that page for what *down* is, and the lifecycle page for nothing.
- **Critical findings are scanned for, and surfaced, by AGS itself.**
  [vulnerability-scanning](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/performance-and-security/vulnerability-scanning/):
  "AGS scans each image immediately after upload, then runs periodic scans every
  Sunday at 00:00 UTC", and "If AGS detects critical vulnerabilities in the
  current (latest deployed) image of an Extend app, a banner appears at the top of
  the app's details page." The severity table on that page is what `CRITICAL`
  means — "vulnerabilities could lead to a complete system compromise. Immediate
  remediation is strongly recommended" — and that sentence is the whole of why
  `active-image-has-critical-findings` is `high`. Cite it for both image-scan
  rows.
  For `image-scan-pending` the page settles only that a scan happens and when; it
  defines no vocabulary of scan states. So the finding says the active image has
  no scan result yet and that its security status is therefore unknown, and it
  does not translate a status string into a diagnosis.
- **A variable or secret change is not in force until the app is restarted.**
  [configuring-envars](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/configuring-envars/)
  ends every add, update and delete the same way: "Click on the Restart and Apply
  button to apply the changes to the Extend app." extend-app-lifecycle says what
  that restart does: "When you trigger deployment, the app status changes to
  starting", and it is then that "all updated environment variables and secrets
  are applied." Cite either for `config-undeployed`. The finding is that the value in
  the Portal is not the value the running app has — which is the same shape as an
  unrounded fleet count, and just as silent.
- **Debug mode has three consequences and one of them is not what it looks
  like.**
  [local-debugging-remote](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/local-debugging/local-debugging-remote/):
  "Only one pod replica is supported while a debug session is active", "When
  Remote Debug is enabled, a sidecar container is injected into your Extend App's
  pod", and "Enabling or disabling Remote Debug restarts the app." Those three are
  what `debug-mode-enabled` reports, and this is the page it cites.
  The sentence that bounds it is on the same page and must travel with the
  finding: "When Remote Debug is enabled but no session is connected, in-cluster
  traffic continues to reach the app as normal. Traffic is only redirected to your
  local machine while an active session is open." So enabled-and-unconnected is
  **not** live traffic leaving the cluster, and a finding that says it is has
  quoted half a page. What it does mean is that the app is one connect away from
  that, is capped at one replica while a session runs, and will restart when
  somebody turns it off. `medium`, and the wording says which of the two states
  `isDebugSessionConnected` reported.
- **Nobody is told when the app goes down.**
  [manage-extend-app-notifs-and-subscribers](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/observability/manage-extend-app-notifs-and-subscribers/):
  "Downtime: If the app experiences any outages or downtime, you'll receive an
  email alert", and the three options are "All", "Down Status" and "Image
  Vulnerability". That is `no-alert-subscribers` — an empty list means the two
  alerts AGS already produces reach no one. `low`, because nothing is broken; it
  is worth saying because the app's own monitoring is switched off by omission
  rather than by choice.
- **At the image cap the oldest image is replaced, silently.**
  [extend-usage-limits](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-usage-limits/):
  "Up to 100 images can be uploaded for each Extend App by AGS Private Cloud
  customers, and up to 50 images can be uploaded by AGS Public Cloud customers.
  When this limit is reached, the oldest image will be replaced with the new one."
  That sentence is what `image-count-near-cap` cites, and it is worth reading
  carefully before writing the finding: nothing fails at the cap, and an upload is
  never refused. What happens is that an old image stops existing, which
  is the rollback target somebody may be counting on. `low`, and the finding says
  eviction and never rejection.
  Which of the two caps applies is **not readable** — no read this check makes
  says whether the environment is Private Cloud or Public Cloud — so the row fires
  at 45, ninety per cent of the lower published cap, and the finding names the
  count and both caps rather than picking one. That is why its confidence is
  `medium`.
- **Horizontal scaling is the only scaling there is, and it needs room to
  move.**
  [extend-autoscaling](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-autoscaling/):
  "Hosted Extend services use horizontal scaling as the strategy to match demand.
  Horizontal scaling works by adjusting the number of the running Extend app
  replicas", against the published algorithm "desiredAppReplicas =
  ceil[currentAppReplica * ( currentAvgCPUUtilizationPercentage /
  targetCPUUtilizationPercentage )]". With `minReplica == maxReplica` that
  computation has nowhere to land, which is `cannot-scale`. Cite the same page for
  `pinned-at-max-replica`, whose consequence it also states: "Scaling up adds
  delay before new replicas running and ready to receive traffic."
  For `no-autoscaling-target` the page gives both the default and the bounds:
  "targetCPUUtilizationPercentage for Extend App in Admin Portal by default is 50%
  and can be set within valid range number minimum: 30% and maximum: 90%". A value
  outside that range is not a target in force. `low`, because a default exists —
  the finding is that the app is running on somebody else's number.
- **The replica and resource ranges, and the ceiling that actually binds.**
  [extend-app-cpu-memory-replicas](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-app-cpu-memory-replicas/)
  publishes the ranges per app type — 1 to 1,415 millicores and 1 to 2,382 MB for
  Override and Service Extension, 1 to 1,215 millicores and 1 to 1,358 MB for
  Event Handler — and "Each Extend app can have between one and 60 replicas."
  Those are the published defaults, and `request-above-ceiling` is decided against
  what `resource-limits list` returned for *this* environment, with the page cited
  for what the knob is. The same page carries the advice that goes beside a
  single-replica app: "Running a single replica is not resilient… For production
  Extend apps, run at least two replicas to ensure availability."
- **What a VM holds, and what it costs.** The packing estimate's arithmetic is on
  extend-app-cpu-memory-replicas — a per-VM reserve of 475 millicores and 1,498 MB,
  a per-replica reserve of 110 millicores and 120 MB (310 and 1,144 for an Event
  Handler), and the tie-break "If the CPU and memory have different calculations
  on how many replicas a VM can host, the system will always follow the lower
  limit." The VM it divides by is on
  [extend-pricing](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-pricing/):
  "Hosted Extend services run in standardized VM with 2 cores and 4 GB, each
  priced at $0.198 per hour", with "a one-hour minimum charge per VM". That is
  why the row is about VM count and not about millicores: the same page's own
  advice is to "Allocate just enough resources for your Extend apps so that you
  can maximize the number of apps running on a single VM."
  **Two pages disagree about whether a VM is ever shared between namespaces, and
  the packing row turns on which is right.** extend-pricing carries a callout
  saying "each namespace with Extend apps will have its own VM, as VMs cannot be
  shared between namespaces", while
  [extend-app-vm-configurations](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-app-vm-configurations/)
  documents an "All-Namespaces VMs" host that "Hosts your app on a VM shared
  across all namespaces", against a "Current-Namespace VMs" host that "Hosts your
  app on a VM dedicated to the current namespace" — and works an example where
  moving every app in two namespaces to the shared host leaves "1 shared VM"
  rather than two. Take the specific page over the general callout, read the
  setting per app rather than assuming the namespace is uniform, and never cite
  extend-pricing for anything but the machine's shape and its rate.
- **Usage lives in Grafana, and this check does not reach it.**
  [extend-dashboards](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/observability/extend-dashboards/)
  is where CPU usage, memory usage, replica count over time and the failed and
  timed-out deployment counts are read — its "CPU Usage (service)", "Memory Usage
  (service)" and "Replica Count & Limit" panels. Cite it on the `no-operation`
  rows, which is the only thing those rows say.

Do not assert a ceiling, a cap, a price or a reserved figure from memory. If a
page above does not state it and a read did not return it, it is not part of the
finding.

## What not to flag

- **A stopped or undeployed app is a choice, not a fault.** No
  `app-not-running` on `app-stopped`, `app-undeployed` or `app-removed`, and none
  on an app caught mid-operation. Say what state it is in and stop.
- **A secret's value is never read, never quoted, never stored.** The
  configuration read returns a `value` field on every entry, so this is a rule
  about what to do with what came back rather than about what is reachable. Only
  the name and the `deploymentStatus` reach the report, and the free text still
  goes through `redact` on its way there. **Masking is a per-record flag, not a
  property of the read** (measured 2026-09-05, § 9.2): a platform-provisioned
  `AB_CLIENT_ID` came back as its full 32-character value with **no `applyMask`
  field**, beside an `AB_CLIENT_SECRET` masked to its first five characters. A
  run that
  concludes "these come back masked, so quoting them is safe" is wrong about
  some records and, on the masked ones, is quoting a real prefix of a live
  credential — which is the mistake the asterisks invite. Nothing from the
  `value` field reaches the output: not the value, not a prefix, not its length.
- **Debug mode enabled is not traffic leaving the cluster.** Not while no session
  is connected, which the page states outright. A finding that says otherwise has
  quoted the first half of a two-sentence rule.
- **The image cap does not reject an upload.** It evicts the oldest image. A
  finding warning that the next push will fail has inverted the page.
- **`pinned-at-max-replica` is not "under-provisioned".** It is one sample of
  `currentReplica`, taken at one instant, and the finding says so. A replica count
  read at 03:00 is not a statement about the evening.
- **No claim about CPU or memory *usage*, and no claim about what an app
  consumed.** Nothing this check reads measures a workload. Those rows say
  `no-operation` and cite the dashboards page as where the studio reads them.
- **No cost figure beyond the published VM rate.** The packing estimate says how
  many VMs the settings imply; multiplying that by the hourly rate to produce a
  monthly bill is arithmetic over an estimate, and the estimate is the part that
  is not measured.
- **The packing estimate is refused rather than approximated.** It is a sum over
  every app in the namespace, so a namespace where one app could not be read, or
  where the environment ceilings could not be read, produces no row at all. A sum
  over a partial list is a wrong number that looks like a right one.
- **No claim that one namespace's apps share a VM with nobody else's.** An app
  whose `vmSharingConfiguration` puts it on a VM shared across namespaces is
  packed with apps this run cannot see, and the estimate excludes it and says so.
- **No cause for one dead deployment.** A state and a failure message are what
  this check reports. Explaining one deployment's death is `why-did-it-die`, and
  this playbook names no cause class.
