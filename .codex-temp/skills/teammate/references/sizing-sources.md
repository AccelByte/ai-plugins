---
name: sizing-sources
description: Which source answers which half of a sizing question — the configured
  setting from the AGS API, the observed usage from the metrics backend — for an AMS
  fleet and for an Extend app, with the recommendation arithmetic each one already
  publishes.
last-verified: 2026-08-06
sources:
- https://docs.accelbyte.io/gaming-services/services/ams/
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[sizing-check.md](../subskills/sizing-check.md)'
- '[grounding-rules.md](grounding-rules.md)'
- '[grounding-sources.md](grounding-sources.md)'
---

# Sizing sources

A sizing question has two halves and they come from different places. **What it
is set to** is configuration, and the AGS API returns it. **What it actually
uses** is measurement, and only the metrics backend has it. A recommendation
needs both; a run that has one of them says which one it had.

Keep the halves separate all the way to the report. Collapsing them produces the
one failure this whole file exists to prevent: a confident number derived from a
setting, presented as though usage had been measured.

## The two subjects

`AMS fleet` and `Extend app` are not variants of one question. They are shaped
differently and the words do not carry over.

| | AMS fleet | Extend app |
|---|---|---|
| The unit sized | a VM, shared by N dedicated servers | one container replica |
| The knobs | instance type, servers-per-VM, per-region min/max/buffer | CPU request, memory request, min/max replicas, autoscaling target |
| A per-server CPU or memory claim | **does not exist** | is the whole setting |
| What "too big" costs | idle VMs | idle replicas, and worse packing per VM |

The AMS row matters most. There is no per-dedicated-server resource request to
tune — density is *only* instance type multiplied by servers-per-VM. A run that
reports "your AMS server is asking for too much memory" has invented a knob.

Every operation name, field name and permission string below is a fact about the
AGS API, so re-check it against the Extend SDK MCP at scan time rather than
trusting this table — it is a convenience index, not the authority
([grounding-sources.md](grounding-sources.md)). The permissions in particular do
not follow one pattern: one AMS read here sits outside the family the other three
share.

## Half one — the configured setting

Read through the AGS API. A caller reads its own namespace with its own token.

### AMS fleet

| Operation | Returns | Permission |
|---|---|---|
| `FleetGetShort` | `DsHostConfiguration` — `InstanceType`, `ServersPerVM`, `InstanceProvider`; and `Regions[]` — `BufferSize`, `DynamicBuffer`, `MinServerCount`, `MaxServerCount` | `ADMIN:NAMESPACE:{namespace}:ARMADA:FLEET [READ]` |
| `FleetListShort` | **only** `ID`, `Name`, `Active`, `InstanceProvider`, `Counts[]`, and `Regions` as bare region names — no host configuration, no buffer | `ADMIN:NAMESPACE:{namespace}:ARMADA:FLEET [READ]` |
| `InfoSupportedInstancesShort` | `VirtualCPU`, `MemoryGiB`, `IsBaremetal`, `ProcessorArchitecture` per instance type, and per-region `Capacity` | `ADMIN:NAMESPACE:{namespace}:ARMADA [READ]` |
| `AccountGetShort` | `Limits` — `FleetCount`, `FleetVMCount`, `AllowedNodeClasses`, `AllowedRegions` | `NAMESPACE:{namespace}:AMS:ACCOUNT [READ]` |

The list call names fleets; it does not size them. Every knob this subskill
reasons about — instance type, servers-per-VM, buffer, min and max server counts
— reaches the run only through `FleetGetShort` on one named fleet. So the list is
how the user is asked *which fleet*, never the source a recommendation is built
from. A run that reads a buffer off the list has read a field that is not there.

`AccountGetShort` is the one AMS read here whose permission is not in the
`ADMIN:…:ARMADA` family. A pre-flight that assumes the family asks a studio to
grant the wrong string, and the 403 that follows gets filed against it.

`InfoSupportedInstancesShort` is the only machine-spec source. The published
pricing page renders its table with client-side script and cannot be read as
text, so do not quote vCPU or memory counts from it.

### Extend app

| Operation | Returns | Permission |
|---|---|---|
| `GetAppV2Short` | `CPU.RequestCPU`, `CPULimit`, `Memory.RequestMemory`, `MemoryLimit`, `Replica.{Min,Max}Replica`, `CurrentReplica`, `Autoscaling.TargetCPUUtilizationPercent`, `VMSharingConfiguration` | `ADMIN:NAMESPACE:{namespace}:EXTEND:APP [READ]` |
| `GetResourcesLimitsShort` | `ExtendAppCPULimit`, `ExtendAppMemoryLimit`, `ExtendAppEventHandlerCPULimit`, `ExtendAppeEventHandlerMemoryLimit`, `ExtendAppReplicaLimit`, `Autoscaling` defaults | none stated by the operation |

`GetResourcesLimitsShort` is the ceiling that binds, and it is per environment.
The published ranges are defaults; an environment can carry different ones. Read
it rather than quoting a number, and when it cannot be read, say the ceiling is
unknown instead of substituting the documented default.

That operation states no required permission of its own, so do not pre-announce
one. If it returns 403, record `unauthorized` and move on — that is a fact
learned from the attempt, not a contradiction of a grant anybody promised.

The field spelled `ExtendAppeEventHandlerMemoryLimit` carries that lowercase `e`
in the API itself. It is not a typo to correct.

## Half two — the observed usage

Read through the metrics backend — and read this first, because it changes what
a run should promise.

**No tool available to this skill reads a metrics backend.** Not "sometimes
unavailable": there is no configured metrics client, so as things stand every run
answers from the configured setting alone. Until one is bound, treat the whole of
this section as the shape the answer takes once usage can be read, and treat
`no-operation` as the standing reason for every row in it.

That is not a reason to stay quiet about the subject. The settings-only findings
in the subskill's Stage 4 are real, and a studio gets a useful answer from them.
It is a reason never to phrase one as though a workload had been measured, and
never to open a run by implying the measurement is usually there.

The series below are the AccelByte-internal ones these numbers come from today.
They are named so a run knows what it is missing and can say so precisely.

### AMS fleet

| Series | Carries |
|---|---|
| `ams_ds_cpu_usage_seconds_total` | per dedicated server, counter |
| `ams_ds_memory_rss_usage_bytes` | per dedicated server, gauge |
| `ams_vm_cpu_idle_total`, `node_memory_MemAvailable_bytes` | per VM, the headroom side |
| `justice_fleet_commander_ds_counts` | dedicated-server counts by `ds_status` — `ready`, `claimed`, `creating`, `claiming`, `draining`, `crash backoff`, `unresponsive` |
| `justice_fleet_commander_ds_buffer_setting` | the **configured** buffer, published as a series |
| `justice_fleet_commander_ds_targets` | the target count, non-zero only for live fleets |

The labels are not shared across those two groups of series, and a filter applied
to the wrong group returns an empty result that looks exactly like a fleet with
no traffic:

| Label | Carried by |
|---|---|
| `ams_fleet`, `ams_region`, `ags_namespace`, `environment_name` | both groups |
| `fleet_id` | `justice_fleet_commander_*` only |
| `ds_status` | `justice_fleet_commander_ds_counts` only |
| `ams_resource_type` (the instance type) | `ams_ds_*` and `ams_vm_*` only |
| `ds_state` | `ams_ds_*` only |

So `ams_ds_cpu_usage_seconds_total{fleet_id="…"}` matches nothing — not because
the fleet is idle, but because that series has never carried that label. Narrow
across the two groups with `ams_fleet`, which both of them do carry.

`ds_status` counts every state a server can sit in, so summing the label without
naming which states are wanted counts servers that are draining or crash-looping
alongside the ones actually serving. Sizing arithmetic wants `claimed`.

`justice_fleet_commander_ds_buffer_setting` is the one place a configured value
and a measured value share a backend. Prefer it for the comparison, because a
setting and a measurement read at different instants are the classic way to
report a gap that closed an hour ago.

### Extend app

| Series | Carries |
|---|---|
| `custom_node_gamenamespace_app_pod_container:container_cpu_usage_seconds_total:sum_irate` | CPU cores in use, per replica |
| `custom_gamenamespace_app_pod_container:container_memory_working_set_bytes` | working-set bytes, per replica |
| `kube_pod_container_resource_requests`, `…_limits` | the request and limit as the cluster sees them |
| `custom_extend_metrics:kube_pod_info` | which app, which scenario, which node |
| `kube_horizontalpodautoscaler_spec_target_metric` | the autoscaling target actually in force |
| `custom_extend_metrics:kube_horizontalpodautoscaler_{spec_min,spec_max,status_current,status_desired}_replicas` | replica floor, ceiling, current, wanted |
| `container_cpu_cfs_throttled_seconds_total` | throttling — fires against the CPU **limit** |
| `kube_pod_container_status_terminated_reason` | carries `OOMKilled` — fires against the memory **limit** |

`scenario` takes three values — `service-extension`, `function-override`,
`event-handler` — and they have different reserved overheads, so never pool them.

Filter `container="service"` on the usage series. Without it the sidecar's own
consumption lands in the app's number.

Those last two rows answer a different question from the rest of the table, and
merging them produces advice that cannot work. Throttling and OOMKill are the
kernel enforcing the **limit**; the recommendation arithmetic below sizes the
**request**. They are separate fields on the app (`CPULimit` beside
`CPU.RequestCPU`, `MemoryLimit` beside `Memory.RequestMemory`), so raising a
request in response to throttling changes nothing the kernel was reacting to —
the app throttles exactly as before and the recommendation ships as applied and
ineffective. Report a throttling or OOMKill signal as what it is: the limit is
too low, which is its own finding and not an input to the sizing formula.

## The arithmetic

Neither recommendation is invented here. Both are already published by the
tooling a studio's own operators use, and this file restates them so a run
produces the same number a human would read off the same screen.

That cuts both ways, and the boundary is narrower than the question a user will
ask. Exactly two things have published arithmetic: an Extend app's **CPU and
memory request per replica**, and an AMS fleet's **buffer**. Three things a user
will reasonably ask for do not:

| Asked for | Status |
|---|---|
| Extend CPU / memory request | formula below |
| AMS buffer | formula below |
| AMS instance type | no published method — report the configured type against `InfoSupportedInstancesShort` capacity and the servers-per-VM in force, and stop there |
| AMS servers-per-VM | no published method — the same |
| Extend replica count | no published method — report `MinReplica`, `MaxReplica`, `CurrentReplica` and the autoscaling target, and say what they imply |

For the bottom three, say a number is not derivable and show the operator the
inputs. That is a smaller answer than the user asked for and an honest one; a
made-up figure for an instance type is the failure this section exists to
prevent, and it is worse for being confident.

### Extend, per replica

```
recommendation = usage × (100 / autoscaling_target_pct) × (100 / 75)

floor, CPU:    0.01 cores
floor, memory: 52,480,000 bytes
```

Read plainly: size the replica so that ordinary usage sits exactly at the
autoscaling target, then leave a further quarter of headroom above that.

Two details decide whether the number is right, and both are easy to lose:

- `autoscaling_target_pct` is **read live**, not assumed. The commonly quoted
  50% is one deployment's value.
- Memory has a fallback the CPU branch does not: where no memory autoscaling
  target exists, the arithmetic uses **80**, not 50. An app scaling on CPU alone
  still gets a memory recommendation, and it is computed against 80.

The formula itself does not branch on scenario — the same arithmetic applies to
all three. Scenario decides one separate thing: the reserved overhead per
replica, subtracted before comparing against a VM's capacity. That is a packing
question, not a recommendation question, and reading the scenario is worth doing
only when packing is what is being answered.

| Scenario | Reserved CPU | Reserved memory |
|---|---|---|
| `event-handler` | 0.3 cores | 1,178,599,424 bytes |
| `service-extension`, `function-override` | 0.1 cores | 104,960,000 bytes |

Billing is per VM, not per allocation. So the target is packing density across
replicas, not shaving a single app — trimming one app that leaves its VM count
unchanged saves nothing, and a report should say so rather than claim a saving.

### AMS, per fleet and region

Buffer sizing answers one question: how many ready servers cover the demand that
arrives while a new server is still starting.

```
short-term jitter = max over W of
                      max over offsets 1m…10m of
                        ( claimed(now) − claimed(now − offset) )

long-term trend   = ( claimed(now) − claimed(now − N hours) ) / N / 6
                      for N in 6, 8, 10, 12   → change per 10 minutes
```

Both read `justice_fleet_commander_ds_counts{ds_status="claimed"}`. Take the
larger, and compare it against `justice_fleet_commander_ds_buffer_setting`.

`W` is not one number, and which one is used decides the answer:

| Reading | Outer window |
|---|---|
| short-term jitter, on its own | `[12h:1m]` |
| the headline figure, folding the jitter offsets and the trend terms into one max | `[24h:1m]` |
| the headline's separate short-term series | `[1h:1m]` |

The headline figure is the one an operator is most likely looking at. So when a
run reports a required buffer, it states the window it used — otherwise the
number disagrees with the screen the studio is reading and neither side can tell
which is which.

Where no measurement is available, the standing guidance is a buffer of 10–20% of
peak claimed servers, rising to 50% in rare surge cases, starting at 10–15% and
calibrated once traffic has been observed. A recommendation resting on that must
say it rests on guidance rather than on this fleet's own traffic.

Server counts round to a multiple of servers-per-VM. A recommendation that does
not round has recommended something the service will not accept.

## When a half cannot be read

Say so, name the reason, and ship the other half. A sizing answer built on one
half is useful; one that hides which half it had is not.

| Reason | Means |
|---|---|
| `no-operation` | nothing exposes this value — the AMS per-server resource claim is the standing example |
| `unauthorized` | the token lacks the permission this read needs |
| `errored` | the read was attempted and failed |
| `no-data-in-window` | the series exists and the window holds no samples |
| `answers-another-question` | the read landed and describes something adjacent — a sibling app, another region |

`no-data-in-window` is not zero usage. A fleet with no traffic and a fleet with
no metrics pipeline produce the same empty result and warrant opposite advice,
so a run that cannot tell them apart reports that it cannot.

These names sit alongside a run's own reporting and are not the health check's
report object, which is a different artifact with a closed schema of its own.

## The measurement window

State it, and state it next to every number taken over it. A recommendation from
an hour of a quiet weekday and one from a launch weekend are not the same claim,
and the number alone does not carry which it was.

Prefer a window that contains at least one peak. Where the window contains none,
say the peak was not observed rather than reporting the maximum seen as a peak.
