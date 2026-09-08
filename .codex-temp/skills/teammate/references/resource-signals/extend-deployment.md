---
name: teammate-resource-signals-extend-deployment
description: The cause classes `why-did-it-die` names for one Extend app deployment
  that failed or went down — what each fires on, which read settles it, what it is
  worth, and the public page behind every claim about AccelByte. Read before the detect
  stage.
last-verified: 2026-09-04
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-app-lifecycle/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-usage-limits/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/observability/manage-extend-app-notifs-and-subscribers/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/local-debugging/local-debugging-remote/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/performance-and-security/vulnerability-scanning/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/observability/extend-dashboards/
see-also:
- '[why-did-it-die.md](../../subskills/why-did-it-die.md)'
- '[extend-app.md](extend-app.md)'
- '[ams-server.md](ams-server.md)'
- '[grounding-rules.md](../grounding-rules.md)'
- '[grounding-sources.md](../grounding-sources.md)'
- '[report-schema.md](../report/report-schema.md)'
---

# Resource signals: Extend deployment

The cause classes `why-did-it-die` names for one Extend app deployment, for
`subject.kind: extend-deployment`. Each is a row of the closed table
`report_tool.ts` holds as `RESOURCE_SIGNALS["extend-deployment"]` and
[report-schema.md](../report/report-schema.md) § *Resource-check report* prints;
a signal this file names and that table does not is refused at `validate`, and
adding one means adding it in all three places in one change.

**Subject kind:** `extend-deployment`.

**Signal set bounded by:** the signals written into this file.

No AccelByte index enumerates the ways a deployment can end. The pages below
state them inside prose about an app's lifecycle, its image limits, its alerts
and its debug mode, so there is nothing to walk, and a clean result from this
playbook means *none of these six* rather than *the deployment was fine*
([grounding-sources.md](../grounding-sources.md)).

**The subject is the deployment and never the app.** Keyed by the app, this
report would share `<namespace>@extend-app:<app>` with `extend-app-check` and,
latest-wins, overwrite it — the next check would open its diff against an
incident report. One deployment per record is also why no row here carries a
locator, which is what makes this the Extend twin of
[ams-server.md](ams-server.md).

## What the signals read

Everything here comes from the reads `why-did-it-die` makes on the Extend path,
and nothing else. A row names one of them, and the finding's `evidence.read` is
that name, spelled the same way in `over.reads` — the validator refuses a
finding resting on a read that was not made or that came back unreadable.

| Read | Carries |
|---|---|
| `deployments list` | per deployment `deploymentId`, `status`, `message`, `imageTag` and `updatedAt` — the timeline, and the failure text a human otherwise reads in the Admin Portal |
| `apps get` | the app's `appStatus` at the instant of the read, its `enableDebugMode`, its `scenario`, and `replica.currentReplica` — which is how an app that is down while its `appStatus` still reads in-flight is visible at all. It carries **no `message`** (§ 9.2); the failure text is on `deployments list` |
| `apps get-release-info` | which deployment and image tag the app is on now — how a question about "the last deploy" resolves to a deployment id |
| `images list` | every image tag this app still holds, with `IsActive` — capital I, as the wire spells it — and one list-level `vulnerabilityStatus`. `imageScanStatus` and `findingSeverityCounts` are not on this response (§ 9.2) |
| `app debug-info` | `isDebugModeEnabled` and `isDebugSessionConnected`, and the debug pods |
| `app logs` | the dead container's last output, where a command-line tool for it is already in the session — quoted under a finding, never a finding of its own, and no row below rests on it |

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

**A container that dies and restarts leaves no trace in this playbook's
reads.** Measured 2026-09-05 (§ 9.3): a process exit on a running app flipped
`apps get`'s `appStatus` to `deployment-down` for at most 13 seconds — caught
once in three tries, and not by polling at a steady rate — and changed
`deployments list` not at all — no new row, no status change, no `updatedAt`
bump. So of the six cause classes below, none fires on the commonest way an app
"goes down", and that is a property of the reads rather than an omission to fix.
A run that meets an app the caller says went down, with a clean deployment
ledger and a healthy `appStatus`, has met exactly this: it prints the timeline,
names no cause, and says the restart itself is not recorded anywhere it can
read — never that nothing happened. Where `extend-helper-cli` answers,
`logs stream --previous` is the one read that still holds the dead container's
output, and it is where such a run goes next.

**The deployment status vocabulary is the read operation's own, it is a plain
string on the wire, and it is not closed.** The five the operation publishes are
`deployment-in-progress`, `deployment-failed`, `deployment-timeout`,
`deployment-running` and `deployment-down`. **A sixth was measured**: stopping an
app set its newest *deployment* record to **`app-stopping`** — a value from the
*app's* vocabulary, sitting on a deployment row (2026-09-05, § 9.2). So the two
sets are not disjoint and this list is not exhaustive: a rule reading "the newest
deployment's `status`" meets `app-stopping` on any stopped app. A run holding a
value this list does not name reports it as read and claims nothing about it,
which is what makes that survivable — never treat an unlisted value as a
failure, and never treat this list as the set of values that can appear. The app's own `appStatus` is a **wider**
sixteen-value set that `extend-app.md` lists in full; the two overlap and are
not the same field, and three rows below read the deployment's while two read
the app's.

**A deployment record's `message` is optional on every status**, not only on a
failure — a shape of the read rather than anything a page states. Quote it
verbatim where it is present, say it was absent where it is not, and never write
"no reason was given" as though the service had chosen silence.

**No signal rests on `app logs`, and that is deliberate.** A log line is what the
studio's own process printed about itself: it is not a claim about how Extend
behaves, so it grounds nothing and owes no page, and it is not a condition a
closed table can fire on. It is quoted under the cause it explains, and the read is recorded either way, because a
tool that never answered, a tool that answers `--help` without listing a `logs`
command, and a container that printed nothing are three different facts — the
middle one is `errored`, and `v0.0.14` is the first release that carries `logs
stream`.

## Signals

| Signal | Fires when | Evidence read | Severity | Confidence | Page | Locator |
|---|---|---|---|---|---|---|
| `deployment-failed` | the deployment's `status` is `deployment-failed` | `deployments list` | high | high | yes | — |
| `deployment-timeout` | the deployment's `status` is `deployment-timeout` | `deployments list` | high | high | yes | — |
| `image-blocked` | the deployment's `imageTag` is not among the tags `images list` still returns for this app | `images list` | high | medium | yes | — |
| `deployment-down` | the deployment's `status` is `deployment-down` — it ran, and then it stopped running | `deployments list` | high | high | yes | — |
| `debug-mode-restart` | remote debug is on for this app, so a restart in the window has an explanation that is not a fault | `app debug-info` | medium | medium | yes | — |
| `stopped-by-human` | `appStatus` is `app-stopping` or `app-stopped` — the runtime state was set, not lost | `apps get` | info | high | yes | — |

**No row carries a locator, and that is a property of the subject.** One record
is one deployment, so each of these fires at most once and `validate` refuses a
locator on any of them — a second firing would be the bug, and there is nothing
for a locator to tell apart.

**The Evidence read column is one read, and that is the one `evidence.read`
names.** `image-blocked` compares a tag from `deployments list` against the tags
`images list` returned; `evidence.read` is a single string, so it names
`images list`, which carries the set the finding is *about* — the tag is absent
from it — and the finding's own text says which tag was looked for. Both reads
still appear in `over.reads`.

**The Page column is what `validate` enforces**, and it is the same value
`report_tool.ts` holds as `RESOURCE_SIGNALS["extend-deployment"]` and
[report-schema.md](../report/report-schema.md) prints. Every row here says
`yes`: each names a mechanism of Extend's, so each finding needs an `https://`
citation. The studio's own numbers travel in `evidence` beside it.

**The severity and confidence columns are the values the finding carries.** Copy
them; do not re-rate a row against the app in front of you. Severity is what it
costs if the cause holds and nobody acts. Confidence is how sure the read is that
the cause holds — `high` where one field settles it, `medium` where the finding
rests on a comparison across two reads, or on a condition that explains the
outcome without dating it.

**`debug-mode-restart` is the one row that does not date itself, and it says
so.** `app debug-info` reports whether remote debug is on *now*; nothing this
check reads says when it was switched on. So the finding is that a restart in
this window has a documented explanation which is not a fault — never that the
toggle caused this particular one — and it names which of the two debug states
`isDebugSessionConnected` reported. `medium` on both columns for that reason.

**`stopped-by-human` is `info`, and it is not an accusation.** No read here says
*who* stopped the app or through which surface; what the lifecycle page states is
that the stopping states are produced by a stop action rather than by a failure.
The finding says the runtime state was set deliberately and that there is nothing
to explain, which is the whole of its value.

## Grounding

Every row makes a claim about how Extend behaves, so every one carries the public
page that states it. The bullets below are grouped by page rather than one per
row, because one page settles several rows and every one of the six is named in
the bullet that covers it.

- **What a failed or timed-out deployment means, and what to do about it.**
  [extend-app-lifecycle](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-app-lifecycle/)
  names both outcomes: "deployment failed: Signifies that an error occurred
  during the deployment process" and "timeout: Indicates that the deployment
  exceeded the configured timeout period". The remedy is the same for both and
  the finding carries it: "If a deployment fails or times out, trigger a
  redeployment to retry. If the issue persists, check your app logs in Grafana."
  Cite it for `deployment-failed` and `deployment-timeout`. The same page states
  what a deployment does on the way in — "When you trigger deployment, the app
  status changes to starting", and it is then that "all updated environment
  variables and secrets are applied" — which is why a configuration change that
  was never deployed is a candidate the finding can point at, and it is
  `extend-app-check`'s `config-undeployed` rather than a row here.
  This page is also `stopped-by-human`'s: "When you stop a running app, the app
  status changes to stopping. The system then attempts to shut down the app
  gracefully", with the outcomes "stopped: Indicates that the application has
  been successfully terminated" and "error: An error occurred that prevented a
  successful shutdown", and — the sentence the finding rests on — "You retain
  full control over your app's runtime state and can trigger start or stop
  actions at any time." A stop is a choice the page documents, so an app in a
  stopping state has not failed at anything.
  One state this page does not name is `deployment-down`, and it is the one row
  that must not cite it.
- **What *down* is, and who was told.**
  [manage-extend-app-notifs-and-subscribers](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/observability/manage-extend-app-notifs-and-subscribers/):
  "Downtime: If the app experiences any outages or downtime, you'll receive an
  email alert. This keeps you informed about the app's operational status and
  allows you to take any necessary actions or make adjustments in your workflow."
  That is the page `deployment-down` cites — a deployment that was running and
  stopped running, which the lifecycle page does not describe. The same page
  carries the three subscription options, "All", "Down Status" and "Image
  Vulnerability", which is what makes the empty-subscriber question worth raising
  beside a down deployment; the row for that is `extend-app-check`'s
  `no-alert-subscribers`, not one here.
- **At the image cap the oldest image is replaced, silently.**
  [extend-usage-limits](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/app-configuration/extend-usage-limits/):
  "Up to 100 images can be uploaded for each Extend App by AGS Private Cloud
  customers, and up to 50 images can be uploaded by AGS Public Cloud customers.
  When this limit is reached, the oldest image will be replaced with the new
  one." That sentence is what `image-blocked` cites, and it is the reason the row
  exists: a deployment names an `imageTag`, and the tag it names can stop
  existing without anybody deleting it. The finding says the tag this deployment
  ran on is no longer in the app's image list, names both published caps because
  which one applies is not readable from anything this check reads, and gives the
  two ways a tag goes — evicted at the cap, or deleted deliberately — without
  choosing between them. `medium` confidence for exactly that: the absence is
  certain, the reason for it is not.
- **Enabling or disabling remote debug restarts the app.**
  [local-debugging-remote](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/local-debugging/local-debugging-remote/)
  carries three sentences saying so: the standing note "Enabling or disabling
  Remote Debug restarts the app", and a warning on each path — "Enabling Remote
  Debug restarts the app" and "Disabling Remote Debug restarts the app". It also
  carries the prompt a developer actually sees: "app
  'my-extend-app' is currently running and will be restarted to apply the debug
  mode change. continue? \[y/N\]". It adds the constraint that goes with it,
  "Only one pod replica is supported while a debug session is active". Those are
  what `debug-mode-restart` reports, and this is the page it cites.
  The sentence that bounds it is on the same page and must travel with the
  finding: "When Remote Debug is enabled but no session is connected, in-cluster
  traffic continues to reach the app as normal. Traffic is only redirected to
  your local machine while an active session is open." So enabled-and-unconnected
  is **not** live traffic leaving the cluster, and a finding that says it is has
  quoted half a page.
- **Usage lives in Grafana, and this check does not reach it.**
  [extend-dashboards](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/observability/extend-dashboards/)
  is where the numbers behind a deployment that went down are read — its "CPU
  Usage (service)" and "Memory Usage (service)" panels, and, for an event
  handler, "EH Container OOMKilled per Replica": "Out of Memory Killed
  (OOMKilled). A list of replicas that have been killed or stopped due to running
  out of memory." That last panel is the one to name beside a `deployment-down`
  this check cannot explain: an Extend app killed for memory looks, from every
  read here, exactly like one that stopped for any other reason. Cite this page
  on the `no-operation` rows, which is the only thing those rows say.

Do not assert a cap, a timeout, a status value or a restart behaviour from
memory. If a page above does not state it and a read did not return it, it is not
part of the finding.

## The cause classes, and what each hands to

A cause is only useful if it says what to do next, and for most of these the next
step is somewhere else. This table is the hand-off, and it does not change any
severity above.

| Cause | Hands to |
|---|---|
| `deployment-failed` | the deployment's own `message`, the container's last output where a tool for it is here, and a redeployment |
| `deployment-timeout` | the same, plus `extend-app-check` § sizing — an app that cannot start inside the timeout is often one whose request the environment could not place |
| `image-blocked` | the image list, and a rebuild-and-push of the tag the deployment names |
| `deployment-down` | `extend-app-check` for the app's CPU, memory and replica settings, and the dashboards page for what it consumed |
| `debug-mode-restart` | turning remote debug off, which restarts the app again — so it is scheduled, not done in passing |
| `stopped-by-human` | nothing; the answer is that nobody needs to fix anything |

## What not to flag

- **A critical scan finding does not block a deployment.**
  [vulnerability-scanning](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/performance-and-security/vulnerability-scanning/)
  states what AGS does with one: "If AGS detects critical vulnerabilities in the
  current (latest deployed) image of an Extend app, a banner appears at the top
  of the app's details page", and an email where somebody subscribed. A banner
  and an email are not a gate, and no page here says a deployment is refused over
  a scan result. `image-blocked` is about a tag that is **gone**, and a finding
  that reads a critical count as the reason a deploy failed has invented a
  mechanism. The image's scan status is `extend-app-check`'s
  `active-image-has-critical-findings`, which is a safety finding and not a cause
  of death.
- **A stopped or undeployed app has not died.** `app-stopped`, `app-undeployed`
  and `app-removed` are outcomes the lifecycle page documents as chosen or
  complete. Say which one and stop; only `stopped-by-human` fires, and it fires
  as `info`.
- **An app caught mid-operation is not a failure either.**
  `deployment-in-progress`, `app-creating`, `app-stopping` and `app-removing` are
  a moment, not a verdict. Report the state, say the answer is a moment old, and
  do not name a cause for something still happening.
- **No cause inferred from a status alone where a message exists.** The status
  says what happened; the message is the service's own account of why, and it is
  quoted rather than paraphrased. Where there is no message the finding says so.
- **A creation failure is not a deployment failure.** `app-creation-failed` and
  `app-creation-timeout` are the provisioning stage, and the page's remedy is the
  opposite one — "If creation fails, delete the app and try again", against "If a
  deployment fails or times out, trigger a redeployment to retry". Neither is a
  row here: an app that never finished being created has no deployment to key a
  record on.
- **No secret's value, ever.** The configuration reads are not in this playbook's
  table at all, and a deployment `message` or a log line that carries one still
  goes through `redact` on its way into the report.
- **No claim about what the app consumed.** Nothing this check reads measures
  CPU, memory, restarts or out-of-memory kills. Those rows say `no-operation` and
  cite the dashboards page as where the studio reads them.
- **No fleet-wide or app-wide picture.** This explains one deployment. Whether
  the app is healthy now is `extend-app-check`, and this playbook does not answer
  it.
