---
name: teammate-sizing-check
description: Use when the user asks what one AMS fleet or one Extend app should be
  set to — 'check my AMS or Extend app CPU and memory usage and advise the optimal
  settings', 'is this app over-provisioned', 'what buffer should this fleet run'.
  Reads the settings in force, recommends an Extend app's CPU and memory request per
  replica or an AMS fleet's buffer, and reports the inputs for the knobs that have
  no published arithmetic. Answers about one named thing, and does not scan a repository.
allowed-tools: Read Glob Grep Bash ToolSearch TaskCreate TaskUpdate AskUserQuestion
model: sonnet
last-verified: 2026-08-06
see-also:
- '[sizing-sources.md](../references/sizing-sources.md)'
- '[grounding-rules.md](../references/grounding-rules.md)'
- '[memory-contract.md](../references/memory-contract.md)'
- '[ags fleet.md](../../ags/capabilities/ams/fleet.md)'
---

# Sizing check

Answers one question about one named thing: your AMS fleet, or your Extend app —
what is it set to, what does it actually use, and what should it be set to?

This subskill reads. It does not change a setting, does not touch your project,
and does not open a pull request. The output is a recommendation you apply.

It is also not a scan. Nothing here walks a repository or looks at your code; a
request to check an integration belongs in the health check instead.

Read [sizing-sources.md](../references/sizing-sources.md) before Stage 3. It
holds which source answers which half of the question, the series names, and the
arithmetic — all of which this file assumes rather than repeats.

## What a sizing answer is made of

Two halves, from two places:

- **The setting** — what the service is configured with. The AGS API returns it.
- **The usage** — what the workload actually consumed. Only the metrics backend
  has it.

A recommendation needs both. A run that reaches one of them still has something
worth saying, and says which one it had. A run that presents a number from a
setting as though usage had been measured has done the one thing this subskill
must never do.

**As things stand, no tool here reads a metrics backend.** So the honest opening
position is the settings half only, and the reference file gives the reason to
record. Say that early in the answer rather than at the end of it — a reader who
learns on the last line that nothing was measured has already read the numbers as
though something had been.

The settings half is still worth running. What it cannot do is bound how big a
claim the report makes.

## Stage 1 — Name the subject

Establish two things before reading anything: **which subject**, and **which
one**.

The subjects are not interchangeable. An AMS fleet is a pool of VMs, each
running several dedicated servers. An Extend app is a container with a CPU and
memory request per replica. The knobs share no vocabulary, so guessing wrong
wastes the whole run.

Where the request names neither, ask. Where it names a subject but not an
instance — "check my Extend app" with several installed — list what exists and
ask which. Do not pick the first.

For a fleet, listing is how the question gets asked, never how it gets answered:
the list carries names and counts and no sizing knobs at all. Once the user picks
one, read that fleet on its own in Stage 2.

Where the user names a namespace other than the one their credentials belong to,
stop and say so. Reading another namespace is not something to attempt and
report as a failure.

Seed a task list as this stage's first act, titled exactly like this:

- Name the subject and the instance
- Read the settings in force
- Read the resources actually used
- Work out the recommendation
- Report, with the window and the sources on it

## Stage 2 — Read the settings in force

For an AMS fleet: the fleet's own configuration, the specification of the
instance type it names, and the account limits that bound it.

For an Extend app: the app's requests, limits, replica bounds and autoscaling
target, and the ceiling in force for that environment.

Record what each read returned and what it did not. A ceiling that could not be
read is not the documented default — it is unknown, and every later comparison
against it is unavailable rather than passing.

An `event-handler` app carries a different reserved overhead from a
`service-extension` or a `function-override`. Establish which one this app is
here — but only the packing comparison uses it. The per-replica recommendation
does not branch on scenario, so a run that goes looking for a scenario branch in
Stage 4 will not find one and must not invent it.

## Stage 3 — Read the resources actually used

This is the half no tool currently reaches, and the rules around it are the point
of this subskill. Read the reference file's half-two opening before this stage;
it names the reason to record and the series a bound tool would read.

Where no metrics tool is bound, this stage produces one honest line — `no
operation exposes this` — and the run continues to Stage 4 on settings alone. Do
not dress that up as an attempted read, and do not skip the stage silently: a
reader has to be able to tell that usage was never available from a report that
otherwise looks complete.

Where one is bound, ask for a window before reading. Where the user gives none,
use the last 24 hours and say so in the report — never silently.

Then attempt the reads. For each one that does not land, record the reason from
the closed set in the reference file, and carry it to the report. An attempted
read that failed is a recorded fact. A read nobody made is a gap, and the two
must not look alike in the output.

A filter that matches nothing is not a measurement of nothing. The reference
file's label table says which series carry which labels, and narrowing a series
by a label it has never carried returns exactly what an idle fleet returns.

Three results are distinct and a run must not merge them:

- the series returned samples
- the series exists and returned nothing for this window
- the series could not be read at all

The middle one is not zero usage. A workload with no traffic and a workload with
no metrics reaching the backend look identical from here, and they warrant
opposite advice.

Where the whole half is unavailable, do not stop. Go to Stage 4 with settings
only, and say plainly at the top of the report that no usage was observed.

## Stage 4 — Work out the recommendation

Use the arithmetic in the reference file. Do not derive your own.

The published formulas already encode judgements — how much headroom above the
autoscaling target, how long a server takes to start, what a buffer is for — and
a number this subskill invents will disagree with the number the same studio's
operators read off their own screens.

Two knobs have arithmetic: an app's CPU and memory request per replica, and a
fleet's buffer. Instance type, servers-per-VM and replica count do not. For those,
say a number is not derivable, show the operator the inputs the reference file
lists, and leave the choice with them. "I cannot derive that, here is what bears
on it" is a complete answer. A confident instance type is not.

Two things to carry through, both of which turn a right formula into a wrong
answer:

- Read the autoscaling target rather than assuming it, and remember the memory
  branch falls back to a different value from the CPU branch when no memory
  target is in force.
- Round a fleet's server counts to a multiple of servers-per-VM. An unrounded
  recommendation is one the service will not accept.

With settings only, the findings available are still real: a request above the
environment ceiling, a replica floor equal to its ceiling so nothing can scale, a
missing autoscaling target, an instance type whose capacity cannot hold the
servers-per-VM configured against it. Report those, and mark each as resting on
configuration alone.

Where a recommendation rests on general guidance rather than on this subject's
own traffic, say which. "10 to 20% of peak" is advice for a fleet nobody has
measured, and it must not be dressed up as a measurement of this one.

Throttling and OOMKills, where they can be read at all, say the **limit** is too
low. They are not evidence about the request, and answering them by raising a
request leaves the app throttling exactly as it was.

## Stage 5 — Report

One table per subject, current value beside recommended value, and one sentence
per row saying what the recommendation rests on.

Lead with the window and with what was readable. A reader who cannot tell
measured rows from configured-only rows has to trust the whole report equally,
which means trusting the weakest row.

Say what the change is worth, and be honest when it is worth nothing. Extend
billing is per VM, so trimming an app whose VM count does not move saves no
money — a real finding, and a report claiming a saving there is wrong.

Close with what could not be read and why, one line each. That list is part of
the answer, not an apology attached to it.

## What this subskill does not do

- It does not apply a setting. Every recommendation is for a human to act on.
- It does not size a dedicated server's own CPU or memory. AMS has no such knob;
  density is instance type and servers-per-VM, and nothing else.
- It does not compare two studios, two namespaces, or two environments.
- It does not read code, and a sizing question is not a health check.
