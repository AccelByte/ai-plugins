---
name: teammate-extend-app-check
description: Use when the user asks whether one named Extend app is healthy — 'is
  my matchmaking-override app healthy', 'check my Extend app before we go live', 'why
  is my Extend app not running', 'is our Extend app image safe'. Reads one app's state,
  its last deployments, its images and scan results, its variables and secrets, its
  debug and alert settings, and reports what is broken, what is unsafe, and what its
  CPU, memory and replicas should be. Answers about one named app, and does not scan
  a repository.
allowed-tools: Read Glob Grep Bash ToolSearch TaskCreate TaskUpdate AskUserQuestion
model: sonnet
last-verified: 2026-09-04
see-also:
- '[extend-app.md](../references/resource-signals/extend-app.md)'
- '[sizing-sources.md](../references/sizing-sources.md)'
- '[grounding-rules.md](../references/grounding-rules.md)'
- '[memory-contract.md](../references/memory-contract.md)'
- '[report-schema.md](../references/report/report-schema.md)'
- '[run-setup.md](../references/run-setup.md)'
- '[sizing-check.md](sizing-check.md)'
- '[fleet-check.md](fleet-check.md)'
- '[why-did-it-die.md](why-did-it-die.md)'
---

# Extend app check

Answers one question about one named Extend app: is it healthy, is it deployed,
is what it is running safe, is its configuration actually in force, and what
should its CPU, memory and replicas be.

This subskill reads. It does not start, stop, restart or redeploy an app, does
not edit a variable or a secret, does not turn debug mode off, and does not
delete an image. Every recommendation is for a human to apply in the Admin
Portal.

It is also not a scan. Nothing here walks a repository or looks at code; a
request to check an integration belongs in the health check instead.

Read [extend-app.md](../references/resource-signals/extend-app.md) before
Stage 3. It holds the thirteen signals, what each fires on, what each is worth,
and the public page behind every claim about AccelByte — all of which this file
assumes rather than repeats. Read
[sizing-sources.md](../references/sizing-sources.md) before Stage 4 for the CPU
and memory arithmetic, the reserved-overhead table and the window rules, which
this file also does not restate.

## What this check can and cannot see

The Extend API returns **configuration** and one **live sample** of the replica
count. It does not return what the app's CPU or memory actually consumed, how
often it restarted, whether it was killed for running out of memory, or how far
behind an event handler's Kafka consumption is — those live in Grafana, and no
tool this plugin binds reads them. Say that early rather than at the end: a
reader who learns on the last line that nothing was measured has already read the
numbers as though something had been.

The one thing this check has that a sizing question does not is the deployment
history, which carries the failure text a human otherwise reads in the Portal. It
is what the state findings quote from. A container's own log tail is reachable
only through a separate command-line tool, which most sessions do not have —
Stage 5 says what happens either way.

## Stage 1 — Name the subject

Establish which app, in whose namespace, before reading anything.

Seed the progress list as this stage's first act, titled exactly like this:

- Name the app
- Read the app, its deployments, its images and its configuration
- Detect the state, safety and configuration signals
- Work out CPU, memory and replicas
- Read the logs, where a tool for them is already here
- Report, store it, and record the run

Where the user names no app, `apps list` is how the question gets asked and never
how it gets answered: it names the apps and their states and settles no finding
about any one of them. Show what exists and ask which one. Do not pick the first.

Where the user names a namespace other than the one their credentials belong to,
stop and say so. Reading another namespace is not something to attempt and report
as a failure.

Then read the previous check on this app, when the memory tools answer:

```
wiki_memory_get({ kind: "resource-check", key: "<namespace>@extend-app:<app name>" })
```

A miss is the ordinary first-run case and not an error. A hit is what Stage 6's
diff is taken against, and its `updated_at` — from the envelope, not the
document — is how old the last check was.

## Stage 2 — Read the app

Every read below lands in the report's `over.reads` ledger with either what it
returned or why it did not, and each `read` name is used once. A finding may only
rest on a read that was made and came back.

| Read | For |
|---|---|
| `apps get` | the state, the resource and replica settings, the autoscaling target and the scenario every settings signal is decided from |
| `apps get-release-info` | which image tag and deployment the app is actually on |
| `deployments list` | the last 20 deployments for this app, with the status and the message behind each |
| `images list` | every image, which one is active, and its scan status and severity counts |
| `config list-variables` | each variable's name and whether it is deployed |
| `config list-secrets` | the same for secrets — names and deployment status only |
| `subscriptions` | who receives the Down Status and Image Vulnerability emails |
| `app debug-info` | whether debug mode is on and whether a session is attached right now |
| `resource-limits list` | this environment's own CPU, memory and replica ceilings, which is what a request is compared against |
| `apps list` | every app in this namespace, for Stage 4's packing estimate — and for nothing a per-app signal fires on |

The container's own log tail is not in this table. Nothing in the API returns it,
so it is Stage 5's, it is conditional on a tool the session may not have, and it
lands in the same `over.reads` ledger when that stage runs.

Two of these have a narrower purpose than their name suggests. `apps list` is the
population the packing estimate sums over; it settles no finding about the named
app. And `config list-secrets` is read for names and deployment status only — see
the secret rule in Stage 3.

Record what each read returned and what it did not. Use the reason vocabulary in
[sizing-sources.md](../references/sizing-sources.md) — `no-operation`,
`unauthorized`, `errored`, `no-data-in-window`, `answers-another-question` — and
carry it to the report. An attempted read that failed is a recorded fact; a read
nobody made is a gap, and the two must not look alike in the output.

`no-operation` is where every usage question ends. CPU and memory consumed,
restart counts, out-of-memory kills and consumer lag have no operation behind
them at all, and the row says so and cites where the studio reads them instead.

**The deployment read covers a count, not a window.** It is the last 20
deployments however old they are, so `over.window` is the span those deployments
actually cover and a finding about them says its own span in its own text. A
report whose envelope claims a week because that is how far back twenty
deployments reached has not measured a week of anything.

## Stage 3 — Detect

Run the thirteen signals in
[extend-app.md](../references/resource-signals/extend-app.md) against what
Stage 2 returned. That file owns which rows exist, what each fires on, the
severity and confidence each carries, and the page each cites. Copy those values;
do not re-rate a row against the app in front of you.

Four rules bind every finding here. Three are enforced by `report_tool.ts
validate` rather than left to discipline; the fourth is this stage's own and is
the one with the worst failure.

- **Grounded-or-suppressed.** A finding whose claim is about how Extend behaves
  carries the public page that states it. A finding about the studio's own
  numbers cites the read it came from through `evidence`, and owes no page
  ([grounding-rules.md](../references/grounding-rules.md)). The live Extend read
  is never a citation: it is what the finding is *about*, not what grounds it.
- **A signal that can fire twice carries a locator.** The variable or secret
  name — one string, so two firings of one signal are told apart and the next
  run's diff can match them.
- **A single sample says so.** `currentReplica` is one reading of a live count,
  so a finding on it rests on `configured-only`, carries the instant, and is
  worded "at `<instant>`" and never "over the window".
- **A secret's value never leaves this stage.** The configuration read returns a
  `value` field on every entry, so the value is in hand whether or not anybody
  wanted it. Only the name and the deployment status reach a finding, a
  recommendation, the summary or the stored record. **Masking is a per-record
  flag, not a property of the read**: measured 2026-09-05 (§ 9.2), one app's
  `AB_CLIENT_SECRET` came back as five characters followed by asterisks with
  `applyMask: true`, while the `AB_CLIENT_ID` beside it came back as its full
  32-character value with **no `applyMask` field at all**. So a run may not
  reason "the API masks these, so what I have is safe to quote": some records
  arrive in plaintext, and the two are told apart only by a flag that is absent
  rather than false. Nothing from the `value` field reaches the output — not the
  value, not a prefix, not its length — because a mask is a real prefix of a live
  credential and the asterisks are what make quoting it feel safe. This one is
  not mechanical: nothing refuses a report that quotes a secret, which is why it
  is written here as a rule and why Stage 6's redaction runs over every free-text
  field on the way out.

## Stage 4 — CPU, memory and replicas

Run `sizing-check` Stages 2 to 4 on this app and take its recommendation table;
[sizing-sources.md](../references/sizing-sources.md) is the single owner of the
arithmetic, the reserved-overhead table, the reason codes and the window rules.
Do not derive your own numbers here, and do not restate its formulas.

What this check adds on top, as a grouping of the same table rather than a field
on a row:

- **Scaling** — can this app grow, and is it pinned at a wall? A minimum equal to
  its maximum; a current replica count sitting at the maximum at the instant of
  the read; no autoscaling target in force; a maximum at this environment's own
  replica ceiling.
- **Compacting** — what is provisioned that nothing appears to use? The
  namespace packing estimate below, which is the only compaction question Extend
  has: billing is per VM, so a trim that leaves the VM count unchanged saves
  nothing.

### The packing estimate

Extend bills per VM-hour on a standardized 2-core, 4 GB VM, so the compaction
question is how many VMs this namespace's settings imply and what single change
would remove one. Take every app `apps list` returned, and for each one its
**`minReplica`** and its CPU and memory request; subtract the per-replica reserve
for its scenario and the per-VM reserve once per VM; and take the **lower** of
the count CPU allows and the count memory allows, which is the rule the published
arithmetic states.

**Then the VM count, and the two dimensions can disagree.** Sum the namespace's
CPU and its memory separately and divide each by what one VM has left after its
own reserve; each quotient, rounded up, is a VM count. Where they differ **the
larger binds** — that is the same "follow the lower limit" rule seen from the
other end, since fewer replicas per VM means more VMs — and the row says which
dimension bound it. Measured on `abtestdewa-rps` 2026-09-06: CPU implied 1 VM and
memory implied 2, memory bound, and an actual first-fit pack over the same caps
also gives 2.

**Say `minReplica` in the row, because the two answers differ.** The sum is over
the minimum each app is configured to keep running — what its settings imply,
which is not what is running: an `app-stopped` or `app-undeployed` app has no
replicas at all and still counts here, because the row is about configuration
and says so. Summing `maxReplica` instead
answers a different question, and on a namespace with unlike apps the two
diverge: measured on `abtestdewa-rps` on 2026-09-06 with three apps, `minReplica`
implies **2 VMs** and `maxReplica` implies **3**. A row that does not name which count
it summed cannot be checked against an operator's own arithmetic, which is the
one thing this row exists to survive. The recommendation row names the one change — usually a single
app's minimum replicas, or one over-sized request — that moves the implied count
by a VM, and says "none" when no single change does.

Three things bound it, and each of them is a reason to publish a smaller answer
rather than a confident one:

- **It is an estimate, and `rests_on` is `configured-only`.** The scheduler's
  real packing is not observable from any read here. Cite the VM shape and the
  reserved figures; do not present the implied count as the count in force.
- **A partial population produces no row.** If any app in the namespace could not
  be read, or the environment ceilings could not be read, the row is refused
  entirely rather than computed over what came back. A sum over part of a list is
  a wrong number that looks like a right one.
- **An app on a shared VM is outside the sum.** An app whose VM sharing puts it
  on a virtual machine shared across namespaces is packed with apps in namespaces
  this run cannot read, so it is excluded and the exclusion is stated. Read that
  setting per app rather than assuming the namespace is uniform.

## Stage 5 — The log tail, where a tool for it is already here

Nothing in Stage 2 returns what the container itself printed. One command-line
tool reads it, and this stage runs **only** when the session already holds that
tool: ask it for `--help`, and take a non-answer as the ordinary case rather than
going looking for it, installing it, or working around its absence.

Run it only when both hold — the tool answered, and the app is not running. On an
app that is up there is nothing here a finding needs, and reading a live app's
traffic is not what this check is for.

```bash
extend-helper-cli logs stream --namespace <namespace> --app <app> --tail 200 --previous
```

`--previous` is the point of the command: it reads the container that died rather
than the one that replaced it, which is where a crash says why. Quote the last few
error lines under the finding they explain — the failed deployment, the app that
is down — and never as a finding of their own. A log line is what the app said
about itself, not a claim about how Extend behaves, so it grounds nothing and owes
no page.

**This stage writes one line to `over.reads`**, and the three cases below are
the ones that get confused with each other — they are **not** the only reasons
this row can carry. Measured 2026-09-06 across twelve real runs, the same read
recorded `errored`, `unauthorized`, `answers-another-question` and a plain
result on much the same situation; `unauthorized` was the commonest of them and
is what a credential that cannot make the read produces. Record whichever reason
the attempt earned, from the report's own vocabulary, and keep the three below
distinct from one another. A tool that never answered is `no-operation`: nothing
was attempted and nothing is known. A tool that answered and returned nothing
for this app is a result, and it means the container printed nothing that was
kept. A tool that answers `--help` without listing a `logs` command is
`errored` — `logs stream` fails on it rather than returning an empty log — and no log is
quoted. An `errored` row carries no `result`, so the binary is named in the
row's own `read`: `app logs (extend-helper-cli, --help lists no logs command)`,
with the version only where `--version` answered, which it does not before
v0.0.13. `v0.0.14` is the first release that carries `logs stream`. Reading the
third case as either of the first two is what this paragraph exists to stop:
`no-operation` claims nobody looked, an empty result claims the container was
silent, and on an old binary both are false.

Whatever comes back is free text from a process this check does not control, so
it goes through the redaction step in Stage 6 with everything else — a log line is
the single most likely place for a token or a connection string to appear.

## Stage 6 — Report

Compose one `resource-check` report with `subject.kind: extend-app`, validate it,
store it, and record the run. Locate the tool and open a run directory first —
[run-setup.md](../references/run-setup.md) § *Locate the install* binds `$TOOL`
and `$RUNDIR`, and everything below uses both literally.

**Redact before you validate.** `over.reads[].result`, every finding `title`,
`evidence.value` and `recommendations[].current` are free text taken from what a
read returned, and `memory-doc` emits the file byte for byte — a deployment
message quoting a connection string, or a variable name carrying a token, would
land in a record the whole studio reads. Write those values one per line to a
scratch file, pass it through `redact`, and put what it prints back into the
report before validating:

```bash
npx tsx "$TOOL" redact --in "$RUNDIR/freetext.txt"   # prints the redacted lines
npx tsx "$TOOL" validate --kind resource-check "$RUNDIR/resource-check.json"
```

`redact` reads and prints; it edits nothing and `validate` does not check that it
ran. This one is discipline, unlike the three mechanical rules in Stage 3 — the
same discipline an `activity` entry's `summary` and `target` already carry.

Open **the answer you give the reader** with the diff when Stage 1 found a
prior record — the first thing they see, before the state, the findings or the
sizing, and not the report's own `summary` field, which is a different place and
optional. Measured 2026-09-06: three runs in a row carried a correct diff and put
it about four-fifths of the way down, which satisfies nobody reading top-down.
Say how old it is,
then what is `new`, what is `still-open` and what `cleared`, matching a finding on
its signal and locator and a knob row on its knob. Where there was no prior
record, say it is the first check on this app rather than saying nothing.

Then close the run through memory
([memory-contract.md](../references/memory-contract.md)), conditional on the
memory tools answering and silent when they do not:

- Build the record with the tool and never by hand, so the object that was
  checked and the object that is stored are one object. The key is composed from
  the document's own `subject`; there is nothing to type:

  ```bash
  npx tsx "$TOOL" memory-doc --kind resource-check "$RUNDIR/resource-check.json"
  ```

  Pass what it prints to `wiki_memory_put`. Latest-wins: this replaces the
  previous check on this app, which Stage 1 has already read.

- Append **exactly one** `activity` entry — `persona: dev`,
  `subskill: extend-app-check`, `action: ran-extend-app-check`, and the namespace
  that was read. `dev` rather than `liveops` because the liveops family is
  `observe` and it has not shipped; this check runs under the same umbrella
  every other dev subskill does. Validate and redact it first:

  ```bash
  npx tsx "$TOOL" validate --kind activity "$RUNDIR/activity.json"
  ```

**There is no access log on this run.** That envelope is keyed on a repository
and a commit, and an Extend app has neither; `validate --kind access-log` refuses
an entry without them. The reads this run made are already recorded, in the
report's own `over.reads` ledger.

Where the memory tools do not answer, the report still ships. The diff and the
store are dropped, the `activity` entry is not appended, and the summary says so
once.

Close with what could not be read and why, one line each. That list is part of
the answer, not an apology attached to it.

## What this subskill does not do

- It does not start, stop, restart or redeploy an app, does not edit a variable
  or a secret, does not turn debug mode off and does not delete an image. A
  recommendation that needs a restart — a configuration change does, and so does
  turning debug mode off — says so and stops there.
- It does not quote a secret's value, ever, even where the read returned one and
  even where the user asks for it directly.
- It does not claim anything about what the app consumed. There is no CPU usage,
  no memory usage, no restart count and no out-of-memory signal in anything this
  check reads.
- It does not explain one dead deployment. A state and a failure message are what
  this check reports; naming the cause of a particular deployment's death is a
  different question, and it is [why-did-it-die.md](why-did-it-die.md)'s.
- It does not go looking for the command-line tool that reads a container's logs,
  install it, or work around its absence. It uses one the session already has and
  records the gap when there is none.
- It does not read a repository, and an app question is not a health check.
- It does not price anything beyond the published VM rate. The packing estimate
  is an implied VM count; turning that into a monthly bill multiplies an estimate
  by a rate and presents the product as a saving.
