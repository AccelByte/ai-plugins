---
name: teammate-fleet-check
description: Use when the user asks whether one named AMS fleet is set up right —
  'check my prod-eu fleet', 'are our fleets ready for launch', 'is this fleet configured
  sanely', 'are servers on this fleet crashing a lot'. Reads one fleet's configuration,
  its deployed image, its artifacts and its recent server history, and reports what
  is misconfigured, what is failing, and what min, max and buffer should be. Answers
  about one named fleet, and does not scan a repository.
allowed-tools: Read Glob Grep Bash ToolSearch TaskCreate TaskUpdate AskUserQuestion
model: sonnet
last-verified: 2026-09-04
see-also:
- '[ams-fleet.md](../references/resource-signals/ams-fleet.md)'
- '[sizing-sources.md](../references/sizing-sources.md)'
- '[grounding-rules.md](../references/grounding-rules.md)'
- '[memory-contract.md](../references/memory-contract.md)'
- '[report-schema.md](../references/report/report-schema.md)'
- '[run-setup.md](../references/run-setup.md)'
- '[sizing-check.md](sizing-check.md)'
- '[why-did-it-die.md](why-did-it-die.md)'
---

# Fleet check

Answers one question about one named AMS fleet: is it configured sanely, is its
image and artifact hygiene right, what does its recent history say about crashes,
and what should its min, max and buffer be per region.

This subskill reads. It does not change a fleet setting, does not deactivate or
activate anything, and does not delete an image or an artifact. Every
recommendation is for a human to apply in the Admin Portal.

It is also not a scan. Nothing here walks a repository or looks at code; a
request to check an integration belongs in the health check instead.

Read [ams-fleet.md](../references/resource-signals/ams-fleet.md) before Stage 3.
It holds the thirteen signals, what each fires on, what each is worth, and the
public page behind every claim about AccelByte — all of which this file assumes
rather than repeats. Read [sizing-sources.md](../references/sizing-sources.md)
before Stage 4 for the buffer arithmetic and the window rules, which this file
also does not restate.

## What this check can and cannot see

The AMS API returns **configuration** and one **live sample** of the per-region
counts. It does not return a dedicated server's CPU or memory, a crash rate over
time, or a cost figure — those live in Grafana, and no tool this plugin binds
reads them. Say that early rather than at the end: a reader who learns on the
last line that nothing was measured has already read the numbers as though
something had been.

The one exception is the server history, which is the only timestamped series the
API exposes. It carries one **`status`** per event — the state entered, never
the one left; `oldState` → `newState` is the *per-server* history's shape, not
this one (measured 2026-09-06) — with a `reason`, an
`exitCode` and an instant, and it is what the crash picture rests on.

## Stage 1 — Name the subject

Establish which fleet, in whose namespace, before reading anything.

Seed the progress list as this stage's first act, titled exactly like this:

- Name the fleet
- Read the fleet, its image, its artifacts and its history
- Detect the configuration and hygiene signals
- Work out min, max and buffer
- Report, store it, and record the run

Where the user names no fleet, `fleets list` is how the question gets asked and
never how it gets answered: the list carries names and the live counts and no
sizing knob at all. Show what exists and ask which one. Do not pick the first.

Where the user names a namespace other than the one their credentials belong to,
stop and say so. Reading another namespace is not something to attempt and report
as a failure.

Then read the previous check on this fleet, when the memory tools answer:

```
wiki_memory_get({ kind: "resource-check", key: "<namespace>@ams-fleet:<fleet id>" })
```

A miss is the ordinary first-run case and not an error. A hit is what Stage 5's
diff is taken against, and its `updated_at` — from the envelope, not the
document — is how old the last check was.

## Stage 2 — Read the fleet

Every read below lands in the report's `over.reads` ledger with either what it
returned or why it did not, and each `read` name is used once. A finding may only
rest on a read that was made and came back.

| Read | For |
|---|---|
| `fleets get` | the configuration every settings signal is decided from |
| `fleets list` | the live per-region counts, and whether the fleet is active and on-demand |
| `images get` | the deployed image, its `deleteAt` and whether it is protected |
| `images get-storage` | account image usage against the quota the account reports |
| `artifacts get` | this fleet's artifact records over the last 7 days, with `status`, `dsId`, `filename` and `sizeBytes`. The record carries **no `reason`** on any status (measured 2026-09-06), so nothing here quotes one |
| `get-usage` | the artifact quota this account is consuming — Stage 4's compacting row, and nothing a signal fires on |
| `fleets get` → `samplingRules` | whether a crashed server leaves a log or a core dump. **Not `artifacts get-fleet-sampling-rules`**, which answers `No fleet sampling rules found` on a fleet whose `fleets get` carries them (measured 2026-09-06) |
| `get-history-by-fleet-id` | the last 24 hours of state transitions |
| `account get` | the account limits every comparison here is bounded by — `imageStorageQuotaBytes` is the denominator `image-storage-near-quota` uses when `images get-storage` does not carry one, and `fleetVMCount` bounds what any recommendation may propose |
| `info list-supported-instances` | the configured instance type's per-region capacity |
| `dev-server-config list` | a development fleet's build configurations and their expiry |

The last one runs only on an on-demand fleet. Everything else runs on every fleet.

**The history read is paginated, and the pagination is part of the answer.** Page
until the window is covered or until a stated page cap is reached, and record
which happened. A run that stopped at the cap sets `over.complete` to false and
says so; a count taken over a partial history is a smaller number reported as a
whole one.

**A walk over a live fleet returns some rows twice, so deduplicate before
counting.** Pagination is offset-based over a table ordered newest first: a
transition recorded between two page fetches pushes every older row one offset
later, and the row that was about to be read is read again. Measured on a
churning fleet, the extra copies equalled the growth in `paging.total` between
the walk's first page and its last — at every page size tried — while the same
walk over a fleet that was not changing returned no duplicates at all. Key each
row by `serverId` + `status` + `createdAt` and count distinct rows, or the crash
share is a fraction whose denominator counts the same termination twice. The
growth in `paging.total` across your own pages is the tell that the table moved
under you, so a run can say so rather than guess.

**What a walk misses is the newest end, not the middle.** Nothing that existed
when the walk started was lost in any measured walk — but rows recorded *during*
one were absent from it entirely. Over a 24-hour window that is a handful of the
most recent terminations, so a crash share is a share of the fleet's history up
to roughly when the walk began, not up to now.

**Two reads cover different spans, and the report carries one window.** Artifacts
are read over 7 days and the history over 24 hours. `over.window` is a single
pair, so set it to the **wider** of the two — the span the run actually reached
back to — and make every share say its own span in the finding's own text: "≥ 20 %
of 34 terminations in the 24 hours to `<instant>`". A share printed under a
7-day envelope with no span of its own is a 24-hour number a reader will take for
a weekly one.

Record what each read returned and what it did not. Use the reason vocabulary in
[sizing-sources.md](../references/sizing-sources.md) — `no-operation`,
`unauthorized`, `errored`, `no-data-in-window`, `answers-another-question` — and
carry it to the report. An attempted read that failed is a recorded fact; a read
nobody made is a gap, and the two must not look alike in the output.

`no-data-in-window` is not zero crashes. A fleet whose servers never terminated
and a fleet whose history could not be paged produce the same empty result and
warrant opposite advice.

## Stage 3 — Detect

Run the thirteen signals in
[ams-fleet.md](../references/resource-signals/ams-fleet.md) against what Stage 2
returned. That file owns which rows exist, what each fires on, the severity and
confidence each carries, and the page each cites. Copy those values; do not
re-rate a row against the fleet in front of you.

Three rules bind every finding here and are enforced by
`report_tool.ts validate`, not left to discipline:

- **Grounded-or-suppressed.** A finding whose claim is about how AMS behaves
  carries the public page that states it. A finding about the studio's own
  numbers cites the read it came from through `evidence`, and owes no page
  ([grounding-rules.md](../references/grounding-rules.md)). The live AMS read is
  never a citation: it is what the finding is *about*, not what grounds it.
- **A signal that can fire twice carries a locator.** The region, the build
  configuration name — one string, so two firings of one signal are told apart
  and the next run's diff can match them.
- **A single sample says so.** `claimedServerCount` is one reading of a live
  count, so a finding on it rests on `configured-only`, carries the instant, and
  is worded "0 claimed at `<instant>`" and never "unused".

## Stage 4 — Min, max, buffer

Run `sizing-check` Stages 2 to 4 on this fleet and take its recommendation table;
[sizing-sources.md](../references/sizing-sources.md) is the single owner of the
arithmetic, the reserved-overhead table, the reason codes and the window rules.
Do not derive your own numbers here, and do not restate its formulas.

What this check adds on top, as a grouping of the same table rather than a field
on a row:

- **Scaling** — can this fleet grow, and is it pinned at a wall? A region whose
  max is at the instance capacity for its type; a region that can warm nothing;
  a fallback carrying a buffer AMS overrides.
- **Compacting** — what is provisioned that nothing appears to use? A region
  holding minimum servers with none claimed at the instant of the read; a
  development fleet that never hibernates; artifact quota consumed by `Skipped`
  and `Failed` records.

Two things turn a right formula into a wrong answer here:

- **Round to a multiple of servers-per-VM**, and say what rounding does. AMS
  accepts an unrounded count and rounds it to the nearest multiple itself, so the
  number in the Portal is not the number in force. A recommendation that ignores
  this proposes a value the fleet will silently change.
- **Say what a number rests on.** A buffer of 10 to 20 % of peak is standing
  guidance for a fleet nobody has measured, and it must not be dressed up as a
  measurement of this one. The buffer row rests on `guidance` or on
  `configured-only` and never on `measured`, because the only timestamped series
  this check can reach is a reconstruction from the server history rather than
  the series an operator reads.

## Stage 5 — Report

Compose one `resource-check` report with `subject.kind: ams-fleet`, validate it,
store it, and record the run. Locate the tool and open a run directory first —
[run-setup.md](../references/run-setup.md) § *Locate the install* binds `$TOOL`
and `$RUNDIR`, and everything below uses both literally.

**Redact before you validate.** `over.reads[].result`, every finding `title`,
`evidence.value` and `recommendations[].current` are free text taken from what a
read returned, and `memory-doc` emits the file byte for byte — a connection string
or a bearer token in a read's result would land in a record the whole studio
reads. Write those values one per line to a scratch file, pass it through
`redact`, and put what it prints back into the report before validating:

```bash
npx tsx "$TOOL" redact --in "$RUNDIR/freetext.txt"   # prints the redacted lines
npx tsx "$TOOL" validate --kind resource-check "$RUNDIR/resource-check.json"
```

`redact` reads and prints; it edits nothing and `validate` does not check that it
ran. This one is discipline, unlike the three rules above — the same discipline
an `activity` entry's `summary` and `target` already carry.

Open the summary with the diff when Stage 1 found a prior record — how old it is,
then what is `new`, what is `still-open` and what `cleared`, matching a finding on
its signal and locator and a knob row on its knob. Where there was no prior
record, say it is the first check on this fleet rather than saying nothing.

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
  previous check on this fleet, which Stage 1 has already read.

- Append **exactly one** `activity` entry — `persona: dev`,
  `subskill: fleet-check`, `action: ran-fleet-check`, and the namespace that was
  read. `dev` rather than `liveops` because the liveops family is `observe` and
  it has not shipped; this check runs under the same umbrella every other dev subskill does.
  Validate and redact it first:

  ```bash
  npx tsx "$TOOL" validate --kind activity "$RUNDIR/activity.json"
  ```

**There is no access log on this run.** That envelope is keyed on a repository
and a commit, and a fleet has neither; `validate --kind access-log` refuses an
entry without them. The reads this run made are already recorded, in the
report's own `over.reads` ledger.

Where the memory tools do not answer, the report still ships. The diff and the
store are dropped, the `activity` entry is not appended, and the summary says so
once.

Close with what could not be read and why, one line each. That list is part of
the answer, not an apology attached to it.

## What this subskill does not do

- It does not apply a fleet setting, activate or deactivate a fleet, or delete an
  image or an artifact. A recommendation that needs the fleet deactivated first —
  changing sampling rules does — says so and stops there.
- It does not size a dedicated server's CPU or memory. AMS has no such knob;
  density is instance type multiplied by servers-per-VM, and nothing else.
- It does not explain one server's death. A share over a window is a fleet-level
  number; naming the cause of a single termination is a different question, and
  it is [why-did-it-die.md](why-did-it-die.md)'s.
- It does not read a repository, and a fleet question is not a health check.
- It does not quote a cost. The Cost Usage dashboard is an estimate AccelByte
  labels as one, and this check cannot read it.
