---
name: teammate-why-did-it-die
description: Use when the user asks why one thing that was running stopped — 'server
  ds-01j2 died at 14:20, why', 'my party-eh app went down after the last deploy, what
  happened', 'why did this deployment fail', 'what killed this dedicated server'.
  Builds the timeline for one AMS dedicated server or one Extend app deployment, names
  the cause candidates it can ground, and hands over the log or artifact that settles
  the rest. Explains one thing that already stopped, and does not scan a repository.
allowed-tools: Read Glob Grep Bash ToolSearch TaskCreate TaskUpdate AskUserQuestion
model: sonnet
last-verified: 2026-09-04
see-also:
- '[ams-server.md](../references/resource-signals/ams-server.md)'
- '[extend-deployment.md](../references/resource-signals/extend-deployment.md)'
- '[grounding-rules.md](../references/grounding-rules.md)'
- '[memory-contract.md](../references/memory-contract.md)'
- '[report-schema.md](../references/report/report-schema.md)'
- '[run-setup.md](../references/run-setup.md)'
- '[fleet-check.md](fleet-check.md)'
- '[extend-app-check.md](extend-app-check.md)'
---

# Why did it die

Answers one question about one thing that has already stopped: what happened to
it, in what order, and which of the causes that can be grounded fits. The
subject is either one AMS dedicated server or one Extend app deployment, and
the answer opens with the timeline and closes with a cause — never the other way
round.

This subskill reads. It does not restart, redeploy or recreate anything, does
not change a timeout or a sampling rule, and does not delete an artifact. Every
recommendation is for a human to apply in the Admin Portal.

It is also not a scan, and not a health check. Nothing here walks a repository,
and nothing here judges whether the fleet or the app is well configured — those
are `fleet-check` and `extend-app-check`, and this subskill hands to them rather
than doing their work.

Read the playbook for the path this run is on before the detect stage:
[ams-server.md](../references/resource-signals/ams-server.md) for a dedicated
server, [extend-deployment.md](../references/resource-signals/extend-deployment.md)
for a deployment. Each holds six cause classes, what each fires on, what each is
worth, the public page behind every claim about AccelByte, and what each hands
to — all of which this file assumes rather than repeats.

## What this can and cannot see

**One subject per run.** A fleet-wide crash picture — how many servers died
yesterday, what share of them exited non-zero — is `fleet-check`. Whether an app
is healthy right now is `extend-app-check`. This answers *what happened to this
one*.

**The cause is a candidate, not a verdict.** The reads here return states,
instants, reasons and exit codes. They do not return what the process was doing
when it stopped. Where the honest answer is "the transitions say it was killed
and the log would say why", that is the answer, with the log handed over.

**Only one exit code has a name.** 137 is the one AccelByte's own troubleshooting
page maps to a cause. Every other **non-negative** code is reported exactly as
read, and a run that names 143 or 255 has invented a mapping. `-99` and `-1` are
not codes at all — they are the history read's sentinels, and presenting either
as an exit code is the same error with a different number.

**Nothing here measures a workload.** CPU, memory, restart counts and
out-of-memory kills for an Extend app live in Grafana, and no tool this plugin
binds reads them. Say that where it matters rather than at the end.

## Stage 1 — Name the subject

Establish which path, which thing, and in whose namespace, before reading
anything.

Seed the progress list as this stage's first act, titled exactly like this:

- Name the subject
- Read the timeline
- Gather the evidence
- Name the cause candidates
- Report, store it, and record the run

There are two paths and they do not mix. A dedicated server id takes the AMS
path; an app name plus a rough time takes the Extend path and resolves to one
**deployment**. A question that names neither — "why is everything falling
over" — is not this subskill's; show what the question could be about and ask.
Do not pick the first thing you find.

Where the question gives a fleet and a time rather than a server id,
`fleets get-dedicated-server` is how the question gets asked and never how it
gets answered: list what that fleet held around that time and ask which one.
Where it gives an app and a time, `apps get-release-info` names the deployment
the app is on now, and `deployments list` names the ones before it — pick with
the user, not for them.

Where the user names a namespace other than the one their credentials belong to,
stop and say so. Reading another namespace is not something to attempt and report
as a failure.

Then read the previous run on this subject, when the memory tools answer:

```
wiki_memory_get({ kind: "resource-check", key: "<namespace>@ams-server:<server id>" })
wiki_memory_get({ kind: "resource-check", key: "<namespace>@extend-deployment:<deployment id>" })
```

**The key is the server or the deployment, never the app.** Keyed by the app,
this report would land on the key `extend-app-check` writes and replace its
check with an incident report — so the next check would open its diff against
the wrong document.

**A hit here is for reuse, not for freshness.** What happened has not changed:
the transitions are the same transitions. Say who looked and when, and offer the
earlier answer before reading again. What *can* have changed is the evidence —
an artifact has an `expiresOn` and a download stops working after it — so a
re-read is worth making when the question is about the log rather than about the
timeline. A miss is the ordinary first-look case and not an error.

## Stage 2 — Read the timeline

Every read below lands in the report's `over.reads` ledger with either what it
returned or why it did not, and each `read` name is used once. A finding may
only rest on a read that was made and came back, and so may a timeline row.

**On the AMS path:**

| Read | For |
|---|---|
| `dedicated-servers get-info` | the server's own record — region, instance type, image, session id, created-at |
| `dedicated-servers get-history` | every `oldState → newState` with its `reason`, `exitCode` and instant: the timeline itself |
| `fleets get` | the fleet's five timeouts, which is what tells a removal at a limit from a server that ended on its own |

**On the Extend path:**

| Read | For |
|---|---|
| `deployments list` | each deployment's `status`, `message`, `imageTag` and `updatedAt`: the timeline itself |
| `apps get` | the app's state at the instant of the read, its debug setting and its own message |
| `apps get-release-info` | which deployment and image tag the app is on now |
| `images list` | whether the tag this deployment named is still one the app holds |
| `app debug-info` | whether remote debug is on, and whether a session is connected right now |

**Write the timeline from what came back, before naming anything.** Each row
carries the instant, the state, the state it came from where the read gives one,
the reason **quoted as read**, and the exit code as a number. The report carries
it as `timeline[]`, and `validate` holds four things about it: the rows in the
order they happened, each naming a read that came back, refused empty, and
required once the report names a cause. The field exists on this subskill's two
subject kinds and is refused outright on the two a check of a running fleet or
app writes.

**Quote a reason; never paraphrase one, and never dress up an exit code.**
`137` goes in the field as the integer `137`. The name OOM belongs in the
finding's own text beside its citation, not in the field that is supposed to
carry the code as read.

**The per-server history takes no page parameter**, so nothing here carries the
page-walk rule `fleet-check` applies to the per-fleet history. What it does
carry is an `exitCode` on every event, **and most of those values are sentinels
rather than codes a process returned**. Measured over 275 history events on two live
fleets, read 2026-09-06T09:31Z: **`-99` on every non-terminating transition** — `creating`,
`ready`, `claiming`, `claimed`, `crash backoff`, `draining` — and **`-1` on a
`removed` row whose `reason` is `SESSION_TIMEOUT` or `CLAIM_TIMEOUT`**, which is
AMS ending the server on its own timeout rather than a process exit it watched.
Only a **non-negative** code on a terminating row is a code the server returned.
So a `-99` row prints its transition and no code, a `-1` row names the timeout
that ended the server, and a `0` — which appears **only** on a termination — is
a real clean exit and not the field's filler. `ams-server.md` carries the table.

Record what each read returned and what it did not, using the reason vocabulary
the report schema holds — `no-operation`, `unauthorized`, `errored`,
`no-data-in-window`, `answers-another-question`. An attempted read that failed is
a recorded fact; a read nobody made is a gap, and the two must not look alike in
the output.

**The per-step progress of a deployment in flight is readable, and it is read
here.** `ags csm apps get-status-progress` binds `GetAppStatusProgressV4` and
answered 200 on a token holding `EXTEND:APP` and `EXTEND:DEPLOYMENT`, returning
an `operation_id` and an ordered `steps[]` of `step`, `step_order`, `status`,
`status_message`, `started_at` and `finished_at` — measured 2026-09-05, § 9.3.
Its grant is `ADMIN:NAMESPACE:{namespace}:EXTEND:APP` at READ — the same
resource `apps get` needs, so a session that can read the app can read its
progress. Where it answers, its steps join the timeline like any other read;
where it does not, the row carries the reason the failure gives.

It changes what can be *seen*, not what can be *named*: a deployment still in
progress is still not one to explain, because it has no last transition, and a
step that is in progress is a step, not a cause. This is the one read that
distinguishes a rollout that is progressing from one that is stuck — a
crashlooping image held `deployment-in-progress` for a full hour with
`replicas ready 0 of 1` on every step read, and nothing else in CSM said so.

## Stage 3 — Gather the evidence

The timeline says what happened. The log or the core dump says why, and this
stage finds out whether there is one.

**On the AMS path**, `artifacts get` filtered to this server returns its
collection records. The filter is `--server-id` on the CLI, and `serverId` as a
raw query parameter — **not `serverID`**, which is silently ignored and returns
every artifact in the namespace unfiltered (measured 2026-09-06). The
record's own field is `dsId`, and the record carries no `reason`.

A record's `status` is a plain string. **Match it as read, and never against a
fixed list**, because the CLI's own advertised list is wrong: `--status
skipped_sample` is refused by the service with `invalid status: skipped_sample`,
and the same value as a raw query parameter returns **an empty page rather than
an error** — indistinguishable from "nothing was skipped by sampling", which is
the opposite of what a run is trying to find out. The Admin Portal's list
names three — *Success*, *Skipped*, *Failed* — which does not line up one for one
with the wire's either. Report the value the read returned:

- `success` — there is an artifact, and `artifacts get-download-url` will mint a
  URL for it. Hand over the artifact id and that command, not the URL it returns
  — see below. On a record that is **not** `success` the same call fails, and its
  message calls the artifact "failed" whatever the real status was, so do not
  read that word back as the record's status.
- **`skipped_sampling`** — the fleet's sampling rule chose not to keep one. Say
  **which rule**, read off `fleets get`'s `samplingRules` — the dedicated
  `get-fleet-sampling-rules` verb answers `No fleet sampling rules found` on a
  fleet whose `fleets get` carries them, measured 2026-09-06, and that silence
  reads as "collection was never configured" — and what it is set to. This is
  not "there was no log"; it is a percentage that came up the other way. This is
  the spelling the wire uses and the one the service accepts.
- a `skipped_` value that is **not** the sampling one — not a sampling decision.
  Report it as read and do not describe it as one.
- `failed` — collection was attempted and errored. Say so and stop: the record
  carries **no `reason` field** on any status (measured 2026-09-06), so there is
  nothing to quote and a cause is never read off one.

A value this list does not name is reported as read, with no cause attached —
and because the published list has already been wrong once, that is the ordinary
case rather than the exception.

A record that exists but no longer downloads has probably passed its
`expiresOn`; say which, because "expired" and "never collected" call for
different next steps.

**The artifact is handed over, never followed — and what you hand over is the
way to fetch it, not the signed URL itself.** This subskill does not read a log
body or a core dump. Give the **artifact id** and the command that mints a URL
for it, say the URL is short-lived, and say what to look for in the file. Do
**not** paste the signed URL into the answer: it carries a temporary AWS session
token in its query string, which is credential material under the same rule that
governs a secret's `value`, and it expires minutes after it is issued — so a
pasted URL is a credential in the transcript and usually a dead link by the time
anyone reads it. Fetching a fresh one costs the reader a single command.

This resolves a conflict that three measured runs resolved the same way on their
own (2026-09-06): the instruction to hand over a URL and the instruction never to
emit credential material pointed opposite ways, and every run chose the
credential rule and printed the command instead. They were right, and this is
the rule saying so rather than leaving the next run to re-derive it.

**On the Extend path**, one command-line tool reads what the container itself
printed, and this half runs **only** when the session already holds that tool:
ask it for `--help`, and take a non-answer as the ordinary case rather than
going looking for it, installing it, or working around its absence.

```bash
extend-helper-cli logs stream --namespace <namespace> --app <app> --tail 200 --previous
```

`--previous` is the point of the command: it reads the container that died rather
than the one that replaced it. Where `--help` lists a flag that narrows to a
window, use it to reach the instant the question is about; do not assume a flag
it does not list. Quote the last few error lines under the cause they explain,
and never as a finding of their own — a log line is what the app said about
itself, not a claim about how Extend behaves, so it grounds nothing and owes no
page.

**This stage writes one line to `over.reads`**, and the three cases below are
the ones that get confused with each other — they are **not** the only reasons
this row can carry. Across twelve real runs on 2026-09-06 the same read recorded
`errored`, `unauthorized`, `answers-another-question` and a plain result;
`unauthorized`, the commonest, is none of the three. Record whichever reason the
attempt earned, and keep these three distinct from one another. A tool that never answered is `no-operation`: nothing
was attempted and nothing is known. A tool that answered and returned nothing is
a result, and it means the container printed nothing that was kept. A tool that
answers `--help` without listing a `logs` command is `errored` — `logs stream` fails on it rather than returning an empty log — and no log is
quoted. An `errored` row carries no `result`, so the binary is named in the
row's own `read`: `app logs (extend-helper-cli, --help lists no logs command)`,
with the version only where `--version` answered, which it does not before
v0.0.13. `v0.0.14` is the first release that carries `logs stream`. Reading the
third case as either of the first two is what this paragraph exists to stop:
`no-operation` claims nobody looked, an empty result claims the container was
silent, and on an old binary both are false.

Whatever comes back is free text from a process this check does not control, so
it goes through the redaction step in Stage 5 with everything else — a log line
and a deployment message are the two most likely places for a token or a
connection string to appear.

## Stage 4 — Name the cause candidates

Run the six cause classes in this run's playbook —
[ams-server.md](../references/resource-signals/ams-server.md) or
[extend-deployment.md](../references/resource-signals/extend-deployment.md) —
against what Stages 2 and 3 returned. That file owns which rows exist, what each
fires on, the severity and confidence each carries, the page each cites, and what
each hands to. Copy those values; do not re-rate a row against the subject in
front of you.

**Timeline first, verdict second.** Every candidate cites the transition it
explains. A candidate with no transition behind it is not written, and `validate`
enforces that half: a report on either of these subjects that names a cause with
no `timeline` is refused.

Three more rules bind every finding here, and the validator enforces all three:

- **Grounded-or-suppressed.** Every cause class on both paths makes a claim about
  how AMS or Extend behaves, so every finding carries the public page that states
  it ([grounding-rules.md](../references/grounding-rules.md)). The live read is
  never a citation: it is what the finding is *about*, not what grounds it.
- **A locator is refused.** One record is one server or one deployment, so no row
  here can fire twice and there is nothing for a locator to tell apart.
- **A single sample says so.** Nothing on these two paths is point-in-time today,
  but the rule is the same one the other checks carry: a reading taken at an
  instant rests on `configured-only` and carries that instant.

**Where two causes both fit, say so.** A server that never became ready either
ran out of the creation timeout or ended before it — and without the fleet's
timeout there is no line between them. Report the transitions, record the
timeout as unread, and name neither rather than guessing.

**Where the cause is a knob, the knob is a recommendation and not a finding.** A
creation timeout below what this fleet actually takes, a request the environment
could not place — those go in `recommendations[]`, and the deeper answer is
`fleet-check` or `extend-app-check` § sizing. Say which, in one line.

## Stage 5 — Report

Compose one `resource-check` report with `subject.kind: ams-server` or
`extend-deployment`, validate it, store it, and record the run. Locate the tool
and open a run directory first —
[run-setup.md](../references/run-setup.md) § *Locate the install* binds `$TOOL`
and `$RUNDIR`, and everything below uses both literally.

**Redact before you validate.** `over.reads[].result`, every `timeline[].reason`,
every finding `title`, `evidence.value` and `recommendations[].current` are free
text taken from what a read returned, and `memory-doc` emits the file byte for
byte — a deployment message quoting a connection string, or a log line carrying a
bearer token, would land in a record the whole studio reads. Write those values
one per line to a scratch file, pass it through `redact`, and put what it prints
back into the report before validating:

```bash
npx tsx "$TOOL" redact --in "$RUNDIR/freetext.txt"   # prints the redacted lines
npx tsx "$TOOL" validate --kind resource-check "$RUNDIR/resource-check.json"
```

`redact` reads and prints; it edits nothing and `validate` does not check that it
ran. This one is discipline, unlike the rules in Stage 4 — the same discipline an
`activity` entry's `summary` and `target` already carry.

Open the summary with the timeline, then the causes. Where Stage 1 found a prior
look at this same subject, say how old it is and who made it before the timeline,
and say what is different — which is usually nothing but the evidence, since the
transitions do not change.

Then close the run through memory
([memory-contract.md](../references/memory-contract.md)), conditional on the
memory tools answering and silent when they do not:

- Build the record with the tool and never by hand, so the object that was
  checked and the object that is stored are one object. The key is composed from
  the document's own `subject`; there is nothing to type:

  ```bash
  npx tsx "$TOOL" memory-doc --kind resource-check "$RUNDIR/resource-check.json"
  ```

  Pass what it prints to `wiki_memory_put`. Latest-wins: this replaces any
  earlier look at this same server or deployment, which Stage 1 has already read.

- Append **exactly one** `activity` entry — `persona: dev`,
  `subskill: why-did-it-die`, `action: ran-why-did-it-die`, and the namespace
  that was read. `dev` rather than `liveops` because the liveops family is
  `observe` and it has not shipped; this runs under the same umbrella every other
  dev subskill does. Validate and redact it first:

  ```bash
  npx tsx "$TOOL" validate --kind activity "$RUNDIR/activity.json"
  ```

**There is no access log on this run.** That envelope is keyed on a repository
and a commit, and neither a dedicated server nor a deployment has either;
`validate --kind access-log` refuses an entry without them. The reads this run
made are already recorded, in the report's own `over.reads` ledger.

Where the memory tools do not answer, the report still ships. The prior look and
the store are dropped, the `activity` entry is not appended, and the summary says
so once.

Close with what could not be read and why, one line each. On this subskill that
list is often the whole difference between a named cause and a shrug, so it is
part of the answer rather than an apology attached to it.

## What this subskill does not do

- It does not restart, redeploy, recreate or stop anything, does not change a
  timeout or a sampling rule, and does not delete an artifact. A recommendation
  that needs the fleet deactivated first — changing sampling rules does — says so
  and stops there.
- It does not read a log body or a core dump, and it does not paste the signed
  URL either — it hands over the artifact id and the command that mints one.
- It does not name a cause for an exit code other than 137, and it does not
  guess one from a reason string whose vocabulary is not published.
- It does not explain a fleet, an app, or a pattern. One server or one deployment
  per run; the wider question is `fleet-check` or `extend-app-check`.
- It does not explain something that has not finished. A deployment in progress
  or a server still running has no last transition to explain. Nothing mechanical
  stops that report being written — the schema keys its refusal on the subject
  *kind*, not on whether that subject is over — so this is a rule this file keeps
  rather than one `validate` catches: report the state, say the answer is a
  moment old, and name no cause.
- It does not quote a secret's value, and it does not read one.
- It does not go looking for the command-line tool that reads a container's logs,
  install it, or work around its absence. It uses one the session already has and
  records the gap when there is none.
- It does not claim anything about what the subject consumed. There is no CPU
  usage, no memory usage and no out-of-memory signal in anything it reads — only
  an exit code, on the AMS side, that one page maps to one cause.
