---
name: teammate-health-check
description: Scan an AccelByte-integrated repo — map SDK call sites, run the incomplete-integrations,
  deprecated-apis, auth-token-safety and error-resilience detectors, cross-reference
  the live namespace when AGS credentials are present, ground every finding, and emit
  a cited Report as Markdown and single-file HTML.
allowed-tools: Bash Edit Read Glob Grep ToolSearch TaskCreate TaskUpdate AskUserQuestion
model: sonnet
last-verified: 2026-08-18
see-also:
- '[grounding-rules.md](../references/grounding-rules.md)'
- '[grounding-sources.md](../references/grounding-sources.md)'
- '[incomplete-integrations.md](../references/detectors/incomplete-integrations.md)'
- '[deprecated-apis.md](../references/detectors/deprecated-apis.md)'
- '[auth-token-safety.md](../references/detectors/auth-token-safety.md)'
- '[error-resilience.md](../references/detectors/error-resilience.md)'
- '[report-schema.md](../references/report/report-schema.md)'
- '[pr-composer.md](../references/pr-composer.md)'
- '[memory-contract.md](../references/memory-contract.md)'
- '[suppression-matching.md](../references/suppression-matching.md)'
- '[call-site-map.md](../references/call-site-map.md)'
- '[run-setup.md](../references/run-setup.md)'
- '[ags install-sdk.md](../../ags/subskills/install-sdk.md)'
- '[ags sdks/_index.md](../../ags/references/sdks/_index.md)'
- '[ags observe.md](../../ags/subskills/observe.md)'
- '[ags debug.md](../../ags/subskills/debug.md)'
- '[ags-extend upgrade.md](../../ags-extend/subskills/upgrade.md)'
- '[accelbyte mcp-auth-recovery.md](../../accelbyte/references/mcp-auth-recovery.md)'
---

# Health check

The dev-persona scan. Read an AccelByte-integrated repo, run the detectors over
its SDK call sites, and emit a Report where **every finding is cited or
suppressed** — nothing ungrounded ships.

The scan runs in one of two modes, and the mode is a record of what the run did,
not a setting the user picks:

- **code-only** — the repo and nothing else. No backend credentials, no live
  reads, no network beyond the sources a citation needs.
- **config-aware** — code-only plus **one live, GET-only cross-reference** of the
  AGS namespace against the call-site map (Stage 3). It answers what a repo scan
  structurally cannot: whether the backend a call site depends on is actually
  configured.

Stage 1 decides which by probing for credentials, so the user does not have to.
Neither mode mutates AGS, and neither mode touches the repo through Stage 6 —
the scan is read-only right up to the point a human says otherwise.

**Stage 7 is the exception, and it is the only one.** After the Report is
delivered, the scan may turn a single finding into a single pull request on a
fresh branch: one file changed, one approval interaction, and the developer left
on the branch they started on. It runs only when the developer approves it, only
when credentials to push already exist, and never on a repo with uncommitted
work in it. Everything about how lives in
[`pr-composer.md`](../references/pr-composer.md).

The seven stages are: **1** connect the repo *(**1b** check for a prior report
and ask)* · **2** map SDK call sites · **3** connect AGS *(config-aware only)* ·
**4** detect · **5** ground · **6** report · **7** one fix *(approval-gated)*.
Code-only runs 1, 1b, 2, 4, 5, 6; config-aware adds 3; either may end at 7.

## Behavior Constraints

<grounding_rules>

- Read [`grounding-rules.md`](../references/grounding-rules.md) before writing any
  finding. The grounded-or-suppressed rule is the load-bearing contract — a claim
  with no citation is suppressed or dropped, never shipped.
- Read the relevant detector playbook before asserting one of its findings —
  [`incomplete-integrations.md`](../references/detectors/incomplete-integrations.md),
  [`deprecated-apis.md`](../references/detectors/deprecated-apis.md),
  [`auth-token-safety.md`](../references/detectors/auth-token-safety.md),
  [`error-resilience.md`](../references/detectors/error-resilience.md). Reading is
  not optional for the last one in a different way: it carries the index walk, the
  default disposition and the offline floor, so a run that skips it cannot detect
  at all rather than merely detecting from memory. The citation for a finding comes
  from the playbook, from the source the playbook sends you to, or from the Wiki
  corpus, never from memory — and it is an `https://` target the reader can open,
  never an `internal://` pin or a path to a reference that ships beside this skill.
- **A live read is evidence, never a citation.** What Stage 3 reads from a
  namespace can raise a finding's `confidence`, and it can refute a candidate
  outright — it cannot ground one. A namespace is not a page the reader of an
  exported Report can open, and most readers have no access to it at all. So a
  candidate the live read confirms still needs its public citation, and a
  candidate whose only backing is the read stays **suppressed in a config-aware
  run exactly as in a code-only one**: what it lacks is a source, and running the
  read does not supply one
  ([grounding-rules.md](../references/grounding-rules.md)).
- Do not invent detectors, severities, or deprecations. If a code shape doesn't
  map to a documented detector signal, it is not a finding. This holds for the
  live read too: Stage 3 feeds the detectors below, and adding a config-aware
  detector of your own is the same fabrication in a new place.
- Fingerprints, the redaction of snippets, and Report validation are mechanical —
  they come from `report_tool.ts`, never from your own composition.

</grounding_rules>

<tool_usage_rules>

- `Bash` — resolve the tool path, pin the commit SHA (`git rev-parse HEAD`),
  invoke `report_tool.ts`, and write this run's own files into `$RUNDIR`. Do not
  build, and do not run any command that writes to the repo. (`npx tsx` is how
  `report_tool.ts` runs; fetching `tsx` into the npm cache is not a build.)
- `Glob` / `Grep` — locate the SDK and map call sites by file:line. This is the
  whole of Stage 2 and Stage 4's static channel.
- `Read` — read the matched files and the detector playbooks.
- **AGS API MCP** — the Stage 1 mode probe and every Stage 3 read, and nothing
  else. `get_token_info` for the namespace, then `search-apis` → `describe-apis`
  → `run-apis` with a **GET** for each live read: discover the operation through
  the first two and never compose a method and path from memory, the same
  discipline `ags/subskills/observe.md` holds itself to. Never call a write method
  (`POST` / `PUT` / `PATCH` / `DELETE`) — this scan has no mutating operation to
  run, so a consent prompt from `run-apis` means the wrong operation was picked:
  stop and re-discover rather than confirming it. Log every call via
  `report_tool.ts log --kind endpoint`.
- The task tools (`TaskCreate` / `TaskUpdate` on this harness) — the run's
  visible progress list, and nothing else. They never carry a finding, a
  citation, or a Report field.
- The question tool (`AskUserQuestion` on this harness) — every question this run
  puts to the user, and nothing the run could answer by reading. Three of them
  have a fixed set of answers and belong in it: rescan-or-show at Stage 1b,
  store-a-dirty-scan at Stage 6, and *which environment did you mean?* at Stage 3
  (`<user_updates_spec>`). An open question with no enumerable answers — where
  the skill is installed, what stable identifier to use for a project that is not
  a git tree — is asked in chat, because a question tool has no option to offer.
- **`Edit` — Stage 7's one file, and nothing else, ever.** Through Stage 6 both
  modes are read-only over the project: everything the scan writes goes in
  `$RUNDIR` — the access log, `report.json`, the exported Report, the activity
  entry — via `Bash` heredoc, and `$RUNDIR` is never inside the repo. `Edit` is
  granted for the one fix at Stage 7, on the one path `pr-plan` named, on a
  branch created for it, after the developer approved it. It is not a licence to
  tidy something you noticed while reading. No `Write` is granted at all, so a
  new file in the user's project is not something this skill can create.

</tool_usage_rules>

<action_safety>

- Read-only over the user's project through Stage 6. No branch, no commit, no
  push before then — and none at all unless Stage 7 runs, which needs an
  eligible finding, a clean worktree, credentials that already exist, and the
  developer's yes. Without any one of those the run describes the fix and stops,
  leaving the project exactly as it found it
  ([pr-composer.md](../references/pr-composer.md)).
- **Read-only over the namespace as well.** Stage 3 reads AGS config; it never
  writes it. And it never sends repo contents to the MCP: what leaves the machine
  is the identifiers the Stage 2 map already found — a capability, a stat code, a
  match-pool name — never a snippet, a secret, or a file.
- Ask before reading outside the current project root — the `accelbyte` skill's
  git consent boundary carries over: a repo you were pointed at, not the wider
  filesystem.
- Every repo path read and every git/`gh` invocation is logged via
  `report_tool.ts log` (kinds `read` / `endpoint` / `git`) so the access trail is
  mechanical, not a matter of recall.

</action_safety>

<user_updates_spec>

A scan runs for minutes across several stages, so keep its ordered steps in the
host-native progress tracker. Bind the tracker the way `$TOOL` is bound: take
whichever progress tool this harness actually exposes — `TaskCreate` /
`TaskUpdate` on current Claude Code, and the `accelbyte` skill's Host-Native
Progress Tracking policy names the equivalents elsewhere — and fall back to a
visible checklist in the response only once none is present. Tracker names are
renamed by harnesses between versions, so a name that is absent means look for
the current one, not that the harness has no tracker.

Absent from the visible tool list is not absent. Where a harness defers tools
behind a lookup, a working tracker is invisible until it is fetched by name, so
settle this with an **exact-name** lookup and never a keyword search — a fuzzy
query ranks by wording and returns unrelated tools whether or not the tracker
exists. The `accelbyte` skill's Host-Native Progress Tracking policy carries the
call to make, the names to try, and what to tell the user when they genuinely
come back empty — some harnesses withhold the tracker until the session opts in,
which is a line the user can act on and not a harness that has none. Name them in the response when the checklist
fallback fires, so a reader can tell a harness that has no tracker from a run
that did not look properly.

Seed the list as Stage 1's first act, before `git rev-parse` and before the mode
probe, titled exactly like this — no stage numbers in the titles:

```text
Connect the repo, pin the commit
Check memory for a prior report
Map the SDK call sites
Run the detectors — incomplete-integrations, deprecated-apis, auth-token-safety, error-resilience
Ground every candidate, or suppress it
Validate, export, and write memory
```

Six rows, and six is what a run works when the Wiki MCP's **memory tools**
answer — the mode does not change that count. Two of the six are memory rows, so
without them it is five: *Check memory for a prior report* drops and the last row
is retitled, per **No Wiki MCP** below. That is decidable before the first row is
drawn, so seed it that way rather than seeding six and correcting one.

The memory tools are what decide this, and **not** either of the other two wiki
toolsets — the grounding tools (`wiki_search` / `wiki_read` / `wiki_read_source`
/ `wiki_list`) and your studio's own pages (`wiki_studio_*`). Each of the three
is a surface that fails separately: one server may hand you two of them, three
services may hand you one each, and no row above depends on anything but the
memory half (ADR-0026, ADR-0035). Ask whether the **memory** tools answer, by
name. A run that asks whether "the server is up" seeds two rows it cannot work
whenever some other toolset is what came back — and `wiki_studio_*` is the
easiest of the three to mistake for either of the others, because its name
carries neither prefix the two rules key on.

*Cross-reference the live namespace* is the one row the seeding cannot decide
yet, because the probe that decides it is itself part of Stage 1, so it is
absent above on purpose. Add it directly after *Map the SDK call sites* the
moment the probe resolves to config-aware, one row longer than whatever was
seeded — adding a row a read just earned is not the guesswork this section
forbids; seeding it and deleting it later is, because a code-only run then shows
a cross-reference row it was never going to work.

*Open the one fix as a PR* is the other row the seeding cannot decide, and for
the same reason: whether Stage 7 has an eligible finding is not known until
Stage 6 has one. Add it when the developer approves the fix, never at seeding —
a row for a PR that was never opened reads as a step the run failed to work,
when in fact there was nothing to work. Whatever the run leaves out stays in the
summary's *Not run here* line, Stage 7 included.

The list is a claim about what happened, so hold it to the bar this skill holds
a finding to:

- **Address a step by the handle the tracker gave it, not by its place in this
  list.** A stage number in this document is a heading, never a step identifier,
  and the two do not line up: the list is seeded conditionally, so *Map the SDK
  call sites* is second, not third, on a run with no Wiki MCP, and every step
  after *Cross-reference the live namespace* shifts up one in code-only mode.
  Read back whatever the tracker returns when it creates a step and
  use that handle for every later update. Off by one, an update marks a
  neighbouring step done and leaves the worked one running — a wrong claim about
  the run that no later step corrects.
- **One step in progress at a time.** A step is done when its work is done — not
  when it started, and not when it looks likely to succeed. Close the step you
  are leaving before opening the next one; two updates, in that order, at every
  boundary. The two stages that blur are *Run the detectors* and *Ground every
  candidate* — candidates get grounded as they surface, so grounding starts
  feeling underway before the detector walk is finished. Finish the walk, close
  it, then open grounding.
- **Rewrite the list the moment the run's shape changes.** The general rule: a
  step the run has decided not to take comes off the list, and a step whose scope
  shrank gets retitled — never left to complete as though it did the whole job.
  Four branches do this today:
  - **No Wiki MCP** — precisely, no **memory tools**: *Check memory for a prior
    report* drops out, and *Validate, export, and write memory* loses its memory
    half (every memory write is conditional on those tools), so retitle it
    *Validate and export*. Missing grounding tools change nothing here; that
    degrades inside *Ground every candidate*, which stays on the list either way.
  - **The user picks a stored report at Stage 1b** — everything from *Map the SDK call
    sites* through *Validate, export, and write memory* never runs as written.
    Replace every one of them with a single step for serving the stored report
    and closing out memory: flush the log, append one `reused-report` entry,
    write nothing else.
  - **No AGS SDK found at Stage 2** — the run stops there
    (*empty-result recovery*), so *Run the detectors*, *Ground every candidate*
    and *Validate, export, and write memory* come off — and so does
    *Cross-reference the live namespace* on a config-aware run, which was seeded
    for a stage the run will now never reach.
  - **Every Stage 3 read fails** — the cross-reference did not happen, so the run
    is code-only from here (Stage 3's *Error handling*). Take *Cross-reference the
    live namespace* off rather than completing it: a completed step says the
    namespace was read.

  Steps left pending forever read as a stalled scan, when the run in fact decided
  not to take them.

The run also puts questions to the user — *rescan or show a stored report* at
Stage 1b, *store a dirty scan* at Stage 6, *which environment did you mean* at
Stage 3 — and every one whose answers can be enumerated goes through the
harness's own question tool, bound exactly the way the tracker is: whichever one
this harness exposes (`AskUserQuestion` on current Claude Code), one option per
choice, the option's own wording carrying the choice. Ending a message with
`[yes / no]` and waiting is the fallback for a harness that offers no such tool,
never the default. A typed answer arrives as *y*, as *sure*, as a paragraph of
reasoning, or as nothing at all, and the run is left deciding which of those was
consent — on the questions that exist precisely so that nobody had to decide
that. Detail no option label can hold — the candidate table, the dirty file
count — is printed before the question rather than crammed into it.

Where the harness has no question tool, the fallback is not silence: print the
options as a typed choice and wait. Several harnesses this skill ships to have
none, so a question that names no way to answer it is the ordinary case there,
not the exotic one — and on the Stage 6 question that is the difference between
a consented store and a run that cannot proceed.

</user_updates_spec>

<output_contract>

The run ends with the Report and a short spoken summary. End with:

```text
Health check complete (code-only).

  Repo:         <url or local path> @ <short-sha>
  Worktree:     DIRTY (<N> files) — findings come from your uncommitted edits, not from <short-sha>
  Scanned:      <N files across the SDK call-site map>
  Coverage:     <for each detector that discovers its signals: how much of its source index this run read>
  Findings:     <critical C · high H · medium M · low L · info I>  (<S suppressed>)
  Suppressed:   <F of T suppression-only rows fired (<ids>)>
  Report:       <path to the exported .md>  (+ .html)
  Grounded:     every shipped finding cites an openable https:// source; <S> suppressed by design
  Not stored:   <why nothing was written to memory>
  Not run here: Stage 3 live cross-reference (needs AGS creds), Stage 7 fix PR (<declined | no eligible finding | no push credentials | dirty worktree>)
  Next step:    <the single highest-value fixable finding, by severity×confidence>
```

Report findings are severity-sorted by the exporter. Do not restate every finding
in the spoken summary — point at the Report and name only the top next step.

**Four conditional rows carry what a run declined to do, or how far it got**, and
every template below has the ones that can apply to it, in these positions.
`Worktree:` and
`Not stored:` are on all four, the reuse shape included — a reuse run is offered
precisely because the tree is dirty, and it is required not to store. Only the
three scanning shapes carry `Suppressed:` and `Coverage:`; a reuse run walked no
rows and read no source index, so either would claim work that did not happen.

Each drops the same way in every template — `Worktree:` when the tree was clean,
`Not stored:` when the report reached memory, `Suppressed:` never, since zero of
four rows firing is the case it exists to make visible, and `Coverage:` never,
since the run that read least is the run most in need of saying so. A row
asserting nothing is noise; a row missing where the stage mandates it is a
silence two runs resolve differently.

- `Worktree:` whenever Stage 1 recorded `dirty`, with the file count. This row is
  what remains in the summary of the question Stage 6 asked — the asking itself
  happens through the question tool and scrolls away with the rest of the
  transcript; the row is what a forwarded summary still says about which tree the
  findings came from.
- `Suppressed:` whenever a detector that ran owns suppression-only rows — the
  count of how many of them fired, with their ids (Stage 5). `Findings:` and
  `Grounded:` both count suppressed *findings*; this counts suppression-only
  *rows walked*, which is a different number and the one that shows a row was
  thought about rather than skipped.
- `Coverage:` whenever a detector that ran discovers its signals from a source
  index — how many of that index's pages this run actually read, or that it fell
  back to the detector's calibrated rows because the index was unreachable
  (Stage 4). Every other row describes what was found; this one describes how far
  the detector looked, which is the only thing that distinguishes a clean repo
  from a shallow scan. A run that read three pages of nine and prints no coverage
  has told the reader it read the section.
- `Not stored:` whenever no report was written — `dirty, and you declined`,
  `no Wiki MCP`, `reuse — no scan ran`, or a report already sat under a
  key this run had to read before writing: the key it relabeled onto, or the
  HEAD key when Stage 1b offered an ancestor (Stage 6 names both). Every one of
  those is correct behavior, and saying nothing turns it
  into silent behavior: the next run finds no report and no reason, and this run
  reads as though it stored something it did not. A dirty tree on its own is not
  a reason — since a dirty scan is storable under the user's key, only the
  declining is.

**A fifth row carries what a run *did*, not what it declined.** `PR:` appears on
any template, directly above `Not run here:`, and **only when Stage 7 actually
opened one** — rendered as
`PR:           <url>  (branch <the branch pr-plan derived>, 1 file)`. Every other
Stage 7 outcome is an absence, and absences belong in `Not run here:` with the
reason attached, the way Stage 3's does — `Stage 7 fix PR (<declined | no
eligible finding | no push credentials | dirty worktree>)`.

The two never both appear. A run that proposed a fix without opening one has not
opened a PR, and a summary is forwarded to people who were not there to watch —
so the row that says a PR exists has to mean a PR exists. It is deliberately not
in the templates below: those are the shapes a scan ends in, and this row exists
only when something happened after one of them.

**A config-aware run says what the live read did.** It names the namespace it
read, and it accounts for the cross-reference the same way it accounts for
findings — a run that reports only the surviving findings hides the reads that
went nowhere:

```text
Health check complete (config-aware).

  Repo:         <url or local path> @ <short-sha>
  Namespace:    <the namespace get_token_info returned>
  Worktree:     DIRTY (<N> files) — findings come from your uncommitted edits, not from <short-sha>
  Scanned:      <N files across the SDK call-site map>
  Coverage:     <for each detector that discovers its signals: how much of its source index this run read>
  Cross-ref:    <C confirmed · R refuted and dropped · U not readable>
  Findings:     <critical C · high H · medium M · low L · info I>  (<S suppressed>)
  Suppressed:   <F of T suppression-only rows fired (<ids>)>
  Report:       <path to the exported .md>  (+ .html)
  Grounded:     every shipped finding cites an openable https:// source; <S> suppressed by design
  Not stored:   <why nothing was written to memory>
  Not run here: Stage 7 fix PR (<declined | no eligible finding | no push credentials | dirty worktree>)
  Next step:    <the single highest-value fixable finding, by severity×confidence>
```

The `Cross-ref:` counts are the honest form of the mode claim. *Refuted* is the
number the developer benefits from most — candidates a code-only run would have
shipped at them — so it is reported, not quietly discarded.

**A relabeled run says the live half was attempted.** When Stage 1's probe answered
but every Stage 3 read failed, the run is code-only and the Report carries no
namespace — but the first template's `(needs AGS creds)` would tell a developer
their credentials are missing when they are not. Use this third shape, which is
the only place the attempt is recorded: the artifact carries what was read, and the
transcript carries what was tried.

```text
Health check complete (code-only) — the live cross-reference was attempted and did not land.

  Repo:         <url or local path> @ <short-sha>
  Worktree:     DIRTY (<N> files) — findings come from your uncommitted edits, not from <short-sha>
  Scanned:      <N files across the SDK call-site map>
  Coverage:     <for each detector that discovers its signals: how much of its source index this run read>
  Live read:    attempted against <the namespace the probe returned> — <what failed>;
                no candidate was cross-referenced, so every finding is the code-only one
  Findings:     <critical C · high H · medium M · low L · info I>  (<S suppressed>)
  Suppressed:   <F of T suppression-only rows fired (<ids>)>
  Report:       <path to the exported .md>  (+ .html)
  Grounded:     every shipped finding cites an openable https:// source; <S> suppressed by design
  Not stored:   <why nothing was written to memory>
  Not run here: Stage 7 fix PR (<declined | no eligible finding | no push credentials | dirty worktree>)
  Next step:    <the single highest-value fixable finding, by severity×confidence>
```

Name the namespace here even though the Report drops it. It is the one thing that
lets the developer fix the read next time, and a spoken summary is not a citation.

**A reuse run gets a different summary.** When Stage 1b served a stored report,
no scan happened: there is no `Scanned:` count and no freshly exported file, and
printing either claims work the run did not do. End with this instead:

```text
Health check complete (<the run's mode>) — stored report reused, no scan run.

  Repo:         <url or local path> @ <short-sha>
  Worktree:     DIRTY (<N> files) — the stored report describes <short-sha>, not your uncommitted edits
  Source:       memory (report written <date>); detectors NOT re-run
  Findings:     <critical C · high H · medium M · low L · info I>  (<S suppressed>)
  Report:       <the stored Report, printed above>
  Not stored:   reuse — no scan ran, so no report was written (the access log and one reused-report entry still were)
  Not run here: Stages 2 through 5, and Stage 6's validate and export — you chose the stored report over a rescan; Stage 7 fix PR (<declined | no eligible finding | no push credentials | dirty worktree>)
  Next step:    <the top finding from the stored report, or "rescan to re-derive">
```

The mode still belongs in that first line even though nothing was scanned: it is
what the run looked the report up under, and a reader who expected the other mode's
report needs to see which one they got.

</output_contract>

<completeness_contract>

A **reuse run** — Stage 1b served a stored report — is complete when the stored
Report was printed, its date and memory provenance were stated, the access log
was flushed, and exactly one `reused-report` activity entry was appended. The
scan criteria below that describe work a reuse run does not do — the detector
walk, the citations, `validate`, the export — do not apply to it, by design. Do
not export or re-validate to satisfy a contract; that rewrites the artifact
Stage 1b exists to preserve. The rest of the list still binds: the activity
bullet is where `reused-report` is *defined*, and the progress-list bullet
covers a rewritten list as much as a completed one.

A **scan** is complete when:
- The commit SHA is pinned into the Report header.
- Every detector in scope ran over the call-site map, or its skip is stated.
- Every detector that discovers its signals reported its reach in `Coverage:` —
  the pages it read out of the pages its index listed, or the fallback to its
  calibrated rows. An unstated reach reads as a full one.
- Every non-suppressed finding carries ≥1 `https://` citation the reader can open,
  and the Report passes `report_tool.ts validate` (exit 0). `validate` alone is the
  weaker bar — it accepts `internal://` too; Stage 5 is the standard.
- The Report exported to Markdown **and** single-file HTML.
- Exactly one `activity` entry was appended for the whole run — `opened-pr` when
  Stage 7 opened one, `reused-report` when Stage 1b served a stored report
  instead, `ran-health-check` otherwise. One entry covers the run end to end; a
  scan entry followed by a PR entry is two, and the feed reads two rows as two
  pieces of work.
- The access log was flushed **once**, as an envelope that passes
  `validate --kind access-log`, with `run` equal to that same action.
- Both of those, or **neither**: the two writes are one record of one run, and
  they are skipped together when memory was absent or the run stopped before
  Stage 4 (*Recording the run*). In either case the summary says so — an
  unexplained silence reads as a run that failed to finish.
- A stored report for this commit and mode was either **found and offered** to
  the user, confirmed absent, or **not looked for because memory was absent** —
  and in that last case the summary says so. Rescanning past a report you found
  without asking is a defect, not a conservative default; never looking is only
  honest if the run admits it. A run that relabeled itself at Stage 3 satisfies
  this against the mode it *looked up*, which is the only mode it could have
  looked up, and says that the key it persisted under is not the key it read.
- The progress list matches the run that actually happened — nothing left
  pending that the run decided not to do.

A **config-aware scan** carries four more:
- The namespace `get_token_info` returned is in the Report's `namespace` field —
  `validate` requires it for this mode and refuses it for the other
  ([report-schema.md](../references/report/report-schema.md)).
- Every live call is in the access log as an `endpoint` entry. The trail is what
  makes the live half auditable by the studio, and it is written by the tool, not
  recalled at the end.
- Each candidate the cross-reference *attempted* has exactly one of
  **confirmed**, **refuted**, or **not readable**. A read that no operation
  exposes, that errored, that the token could not make, or that landed and
  answered a different question is *not readable*, never a refutation: silence
  from a namespace is not a statement about it, and neither is an answer to
  something else.
- Every one of them is in the Report's `cross_reference.candidates`, refuted
  candidates included, each with the read and the result behind it — the record of
  a drop, in the artifact, which is where a step that deletes a finding has to
  leave one ([report-schema.md](../references/report/report-schema.md) §
  Cross-reference inventory). Three other places still account for the same thing
  from their own angles, and none of them replaces it: the `Cross-ref:` counts sum
  to the candidates the inventory reached, the access log holds the `endpoint`
  entry behind each read, and a confirmed candidate's raised `confidence` is its
  trace among the findings. **Do not add a disposition field
  to a finding** — the finding object is closed, and `validate` refuses any key the
  schema does not name, so the attempt fails the run. That rule is not the
  inventory arriving by another door: a refuted candidate ships no finding, so a
  field there could only describe the ones that survived, which is why the record
  lives one level up and holds the refuted set whole.

A clean repo is a valid outcome: zero findings, a Report that says so, still
grounded. "No findings" is a result, not a failure — but zero findings at full
coverage and zero findings off the calibrated rows are two different claims, and
the `Coverage:` row is what tells them apart.

</completeness_contract>

<empty_result_recovery>

- **No AGS SDK found.** Say so plainly, name where you looked (the Stage 2 globs),
  and stop — there is nothing to health-check. Do not manufacture findings.
- **SDK present, no findings.** Emit a zero-finding Report. That is the good case.
- **A candidate has no citation.** It does not ship. Suppress it (record it,
  uncited, as `suppressed: true`) or drop it — never downgrade the grounding bar.

</empty_result_recovery>

## Locate the install (preamble)

Read [`run-setup.md`](../references/run-setup.md) and follow it before Stage 1.
It resolves the report tool's absolute path (`${CLAUDE_PLUGIN_ROOT}` does not
resolve inside instructions —
[claude-code#9354](https://github.com/anthropics/claude-code/issues/9354)),
proves the tool answers, opens a run directory outside the scanned repo, and
opens the access log. It binds `$TOOL`, `$RUNDIR` and `$LOG`, which every stage
below uses literally.

Two of its rules are this run's to honour and are stated here so they are not
conditional on opening a file: **never widen the search for the install** beyond
the places a plugin is installed — ask the user instead, and never fabricate a
path — and **never write a run artifact into the repo being scanned**.

## Workflow

### Stage 1 — Connect the repo + pin the commit

**Seed the progress list first — before the shell block below, before the mode
probe.** `<user_updates_spec>` settles which rows it carries and which of them
the memory tools decide — settled up front, never corrected once the list is on
screen. The user sees the shape of the scan before the scan starts, so a run
that reaches `git rev-parse` with no list has already skipped a step.

The cwd is the user's project unless they point elsewhere (honor the consent
boundary — ask before leaving the project root). Pin the exact commit into the
Report header so the scan is reproducible:

```bash
# → provenance.started_at. The first thing this stage runs once the progress
# list is seeded: it is the only instant in the Report not written at Stage 6,
# and it is what lets a stored report say how long the scan took. Read from the
# clock, never composed.
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

COMMIT="$(git rev-parse HEAD)"       # → repo.commit_sha, and Stage 6's --at-commit
REPO="$(basename "$(git rev-parse --show-toplevel)")"   # → repo.name
git config --get remote.origin.url   # → repo.url (optional)

# → actor / actor_source: git-config. Read, never composed.
ACTOR_ID="$(git config --get user.email)"
ACTOR_NAME="$(git config --get user.name)"

# → repo.tree_state. Any output at all means dirty.
[ -z "$(git status --porcelain)" ] && TREE=clean || TREE=dirty

# → repo.tree_hash, dirty runs only: which uncommitted state this was.
# Both halves by content. `git status --porcelain` names an untracked file
# without reading it, and collapses a whole untracked directory to one line, so
# rewriting an untracked file leaves the hash identical and a later run calls
# edits that have moved "still the ones on disk".
# The `cd` is what makes the two halves agree on scope: `git diff HEAD` reports
# the whole repository from anywhere inside it, `git ls-files --others` reports
# only the current directory down. Run from a subdirectory without it, the
# untracked half silently covers a subtree. It runs in the substitution's own
# subshell, so the caller's cwd is untouched, and the paths stay relative to the
# root so two clones of the same tree hash alike.
if [ "$TREE" = dirty ]; then
  TREE_HASH="$( cd "$(git rev-parse --show-toplevel)" && \
      { git diff HEAD; git ls-files --others --exclude-standard -z \
      | xargs -0 -r sha256sum; } | sha256sum | cut -d' ' -f1 )"
fi
```

**Pinning the commit is not the same as scanning it.** `git rev-parse HEAD`
answers whatever is checked out, uncommitted edits and all, so a scan of a
modified worktree pins a sha whose checkout does not contain the code the
findings describe. Record which it was. A `dirty` run still scans, still exports,
and says so on the page. What it does not do is land on the clean key, where the
next run at that sha would reuse the answer without ever seeing the tree it came
from — it is stored under the user's own key instead, and only if they say so
(Stage 6).

When the tree is dirty, say so in the summary with the count, so the user can
decide whether to commit and rerun:

```text
Worktree: DIRTY (5 files) — findings come from your uncommitted edits, not from e04e94e.
```

`$RUNDIR`, `$LOG` and `$RUNDIR/commits.txt` come from the preamble's
[`run-setup.md`](../references/run-setup.md), already open by the time this stage
runs. Tell the user the run directory in the summary.

If the repo has no commit (not a git working tree), use a stable identifier the
user provides and note the Report is not commit-pinned.

**Then decide the run's mode, before composing any memory key.** The mode is the
Report's own field *and* one segment of that key, so it has to be settled here
rather than discovered at Stage 3.

Probe the AGS API MCP with one authenticated read — the lightweight
availability-and-auth check the `accelbyte` live-auth-preflight policy already
prescribes, rather than a new one:

```
get_token_info({})
```

- **It answers** → the run is **config-aware**. Bind the mode and the namespace it
  returned; Stage 3 uses both, and Stage 6 puts the namespace in the Report.
- **The MCP is absent, unauthenticated, or errors** → the run is **code-only**.
  Bind that mode and move on. Do not re-probe per stage, and do not treat it as a
  blocked run: code-only is a complete scan, not a degraded one. For a stale-DCR
  or invalid-client failure, the family recovery playbook applies
  (*Error Handling* below); if recovery does not land, the answer is still
  code-only.

Say which mode the run is in before Stage 1b, and log the probe
(`--kind endpoint`). The mode decides which stored report the run is even looking
for, so a user who expected the other one needs to hear it now, not in the summary.

**Orient on what this studio keeps hitting.** One read, before any detector:

```
wiki_memory_rollup({ key_prefix: "<repo-name>@" })
```

It costs one call and no prose. The groups say which detector and which file
this team has been finding problems in, so a scan can look hardest where the
history says to look — that is the whole use of it at this stage.

Three limits, and they are the point of doing it here rather than later:

- **The user sees none of it.** This is the reader that wants counts and no
  paragraph. Do not narrate the history before the scan; the Report says what
  *this* run found.
- **It never adds, removes or ranks a finding.** A finding still has to be
  found in the code and cited on its own. History is where to look, never
  evidence that something is there — a detector that fired because the rollup
  said it usually does is reporting the rollup.
- **`key_prefix` scopes it to this repo**, and it is safe here in a way it is
  not at Stage 1b: no count on this read is about records that name no repo.

Skip it in code-only mode, with the rest of the memory I/O, and skip it silently
when the Wiki MCP's memory tools are absent — an empty history is the ordinary
case and not a fault to report. Mechanism and the rules for reading `over` are in
[history-rollup.md](../references/history-rollup.md).

### Stage 1b — Check for a prior report, then ask

Before scanning, look for a stored report worth offering
([memory-contract.md](../references/memory-contract.md)). Skip this stage
entirely when the Wiki MCP's memory tools are absent — grounding answering says
nothing about whether they will.

Not an exact-key `get` — list, then rank:

```
wiki_memory_list({ kind: "report" })      → $RUNDIR/listed.json
```

```bash
npx tsx "$TOOL" memory-lookup \
  --repo-name "$REPO" --mode "<this run's mode>" \
  --actor "$ACTOR_ID" ${TREE_HASH:+--tree-hash "$TREE_HASH"} \
  --commits "$RUNDIR/commits.txt" "$RUNDIR/listed.json"
```

Why it lists rather than gets, the four ranks it can return, the rule against
passing `key_prefix` on this read, the cursor walk to `over.complete`, and what
`rejected` and `unplaceable` each mean are one procedure with more than one
reader — so they are written once, in
[memory-contract.md](../references/memory-contract.md) § *Finding a report to
reuse*. Follow it there; nothing about it is optional and none of it is restated
here, because a second copy is how the read and the ranking drift into
disagreeing about what a miss means.

If the page comes back incomplete and the cursor cannot be walked, say so to the
user: the reuse answer is *"nothing usable in the part of your history I could
read"*, not *"nothing stored"*.

Both numbers describe **this** run's history and nothing else, by two filter sets
that are not the same one. A record is *counted* in `unplaceable` once this run's
mode, a commit in this repo's rev-list, and this person when the record describes
uncommitted work have kept it. A record is *reported* in `rejected` only after one
filter more: `repo.name` matching this repo. That last one is what a list needs
and a count does not — `rejected` prints a key, and a key names somebody's repo
and commit. The studio scope holds other repos and other people, so a fault
printed before that match reads another team's repo back to this user as a fault
in theirs. `unplaceable` never takes the match: its whole population is the
records that name no repo.

`--mode` is **this run's** mode, from the probe above. So a config-aware run does
not offer a code-only report stored at the same commit, and a code-only run does
not offer a config-aware one. That is deliberate — the two answered different
questions — but it means a miss is worth stating with its mode, or the user reads
it as nothing having been scanned here at all.

Report anything in `rejected` to the user and match none of it. A record that
fails today's schema was written under rules that no longer hold, and honoring
it is how a pre-rules report outlives the rule that replaced it. A record that
never said whether its tree was clean is rejected for a different reason: every
rank asserts one or the other, so offering it means asserting on its behalf. Say the
`unplaceable` count too, when it is not zero — "3 stored reports predate the
field that says which repo they came from" is a different message from "nothing
stored", and only one of them tells the user their history is still there.

**On no candidates** (or no MCP): say nothing and go to Stage 2. The normal path.

**On candidates**, do not silently reuse and do not silently rescan. Print what
each one is — including how far back it sits and, for your own dirty scan,
whether those edits are still on disk:

```
Stored reports for this repo (code-only):

  1  this commit, clean            e04e94e, 2026-07-25 14:25 — 2 shipped, 1 suppressed
  2  this commit, your edits       tree has changed since it was stored
  3  2 commits back, clean         c29c744, 2026-07-24 09:10 — 4 shipped

A stored report is only as current as the skill that produced it: same commit,
same code, but a detector playbook that has changed since would reach a
different answer. An older commit is not an answer to this scan — the code has
moved — so it is context, not a result.
```

Then ask through the question tool (`<user_updates_spec>`): **Rescan**, plus one
option per candidate, each labelled the way the printed line labels it. A
harness whose question tool takes fewer options than there are candidates gets
the highest-ranked ones; the block above lists every candidate either way, so
the shorter question hides none of them. Only where the harness offers no
question tool at all does the block end with a typed `[rescan / show N]`.

An `own-dirty-here` candidate whose `tree_matches` is false describes edits that
are no longer the ones on disk. Say so on its line rather than offering it
level with the others; nothing about it is wrong, but it answers a question about
a tree that no longer exists.

- **Rescan** → run Stages 2–6 in full. At Stage 6, **diff against the
  candidate the user was shown** — the `exact` one when there is one, otherwise
  whichever they picked — and lead the summary with what changed (see Stage 6).
  Diffing against an ancestor is still worth doing, but say which commit it came
  from: some of what changed is the commits in between, not this scan.
- **A candidate** → print that stored Report and stop. Say plainly that it came from
  memory and was not re-derived, name its date, and name its commit when it is
  not HEAD. Do **not** re-run detectors,
  and do **not** `wiki_memory_put` — nothing changed, and a needless write
  destroys the very timestamp that shows the report was reused. This path still
  records itself, the same way and in the same place as every other — *Recording
  the run*, with the outcome already settled as `reused-report` rather than
  `ran-health-check`, because no scan happened and the colleague feed must not
  imply one did. Stopping here is what settles it: this path never reaches
  Stage 7, so there is nothing left to wait for. Log the memory read itself
  (`--kind read --value "memory:report/<key>"`); serving a stored report is an
  access and belongs in the trail like any other.

  If the user wants it as a file, export the stored document rather than
  rewriting it, and do not restamp its instants — the procedure and the reason
  are in [memory-contract.md](../references/memory-contract.md) § *Serving a
  stored report as a file*.

If the run cannot ask (unattended), **default to rescan**: serving a stale answer
without anyone choosing it is the worse failure.

Load stored suppressions on **both** paths, so a finding a human already
dismissed is not re-litigated as new. The load, the `validate` gate and the four
matching branches are one procedure with two callers — this stage and the
suppression a developer grants at Stage 6 — so they are written once, in
[suppression-matching.md](../references/suppression-matching.md). Follow it
there; nothing about it is optional and none of it is restated here, because a
second copy is how the load and the write drift into disagreeing about what
counts as a match.

Three things decided here rather than there, because they belong to this stage:

- It runs on **both** branches above. A reuse run applies suppressions to the
  stored report it serves, exactly as a rescan applies them to fresh candidates.
- If the walk cannot be completed, suppressions are **unknown** for this run, not
  absent — say so, and do not let an unread list read as an empty one.
- Rejected records are reported to the user with the candidates they would have
  covered, alongside the `rejected` and `unplaceable` counts from the lookup
  above. One list of things memory could not honour, not two.

### Stage 2 — Map the SDK call sites

Detect the AGS SDK and build the call-site inventory — the map every detector
reads, and the Report's `surface` field. It is a pure static read: no live
service, no credential, the same work in either mode.

The whole procedure — reusing the `ags` skill's detection globs rather than
restating them, mapping at file:line, one entry per capability, and naming what
the scan could not reach in `surface.not_read` — is in
[call-site-map.md](../references/call-site-map.md). Follow it there; none of it
is optional and none of it is restated here.

One thing this stage decides, because it belongs to the run rather than to the
map: the output feeds **both** of the next two stages — Stage 3 cross-references
it against the live namespace, Stage 4 detects against it — so build it once.

### Stage 3 — Connect AGS *(config-aware only)*

Skip this stage in code-only mode. Stage 1's probe already decided, and there is
nothing here to attempt without credentials — note the skip in the run summary
rather than silently omitting it.

The Stage 2 map says what the code **calls**. The namespace says what is
**configured**. This stage reads the second and lines it up against the first —
the one question a repo scan structurally cannot answer, because the answer is not
in the repo.

**It produces an inventory, not verdicts.** Stage 3 records what the namespace
says, per capability; Stage 4 applies that to the candidates its detectors raise.
Keeping the read separate from the judgment is what stops a live read from turning
into a finding of its own.

**The inventory ships in the Report**, as `cross_reference.candidates` — one
closed object per candidate the run *attempted* a read on, carrying the detector,
the signal, the read, its result, the disposition, and — on a `not-readable` row
— which of the four ways it was not readable
([report-schema.md](../references/report/report-schema.md) § Cross-reference
inventory). It is required on a config-aware report from `schema_version` 4 and
refused on any other. Write it as the reads happen, not from memory at Stage 6:
the refuted candidates are dropped before Stage 6 assembles anything, so a run
that reconstructs the inventory at the end is reconstructing the part it already
deleted.

#### Reading the namespace

Discover each operation before running it, and never compose a method and path
from memory — the `search-apis` → `describe-apis` → `run-apis` discipline the AGS
family already owns, in `ags/subskills/observe.md` and
`ags/references/observe/cli-commands.md`, read directly from that skill where it is
installed. Every call is a **GET**.

1. **Identity.** `get_token_info` answered at Stage 1. Record the namespace: it
   goes in the Report's `namespace` field and in the activity entry.

   Be exact about what it means. This is the namespace **the MCP session is
   authenticated to** — not the one the repo's config points at. When the two
   differ, the developer may have pointed the MCP at another environment on
   purpose, so it is a question to ask them (*which environment did you mean?*)
   and not, by itself, a finding.

   Its answers enumerate — the namespace the MCP is on, or the one the config
   names — so it goes through the harness's question tool like the other two,
   one option per namespace, each option naming the namespace it selects. Print
   both namespaces and where each came from before asking; neither fits in an
   option label. Where the harness has **no question tool**, print those two
   options as a typed choice and wait. Whichever way it is asked, the scan
   continues on the answer: the namespace that comes back is the one Stage 3
   reads and the one the Report records.
2. **One read per called capability**, driven by the map. For each row, discover
   the read that reports that piece of namespace config, run it, and record the
   answer in the inventory:

   | Called (from the Stage 2 map) | What to read from the namespace | What it settles |
   |---|---|---|
   | Statistics writes on ranked / economy stat codes | each stat code's existence, and its server-authority setting (`Set By`) | `client-authoritative-stats` — a client-set stat is the config stating the finding itself |
   | Leaderboard reads | whether a leaderboard is configured, and whether the stat code it reads from exists | `leaderboard-no-stats` — an **absent** stat code confirms it; an existing one refutes nothing, because a place to write is not a write |
   | Achievements | whether achievements are defined, and whether a reward is attached to the unlock | `achievements-no-rewards` |
   | The IAM client id in client config | that client's kind — Public or Confidential | `confidential-secret-in-client` — Confidential states it outright. **Public refutes nothing**: the value is shipped either way, and two of the three signal shapes have no client id to read |
   | Matchmaking with a match-pool name | whether a pool of that name exists | existence settles that the call site is live rather than dead scaffolding — **not** whether a notification handler exists, and **not** `matchmaking-no-failure-path`: the expiry callback fires when the matchmaking service is down or the ticket is lost, which no pool setting gates ([error-resilience.md](../references/detectors/error-resilience.md)) |

3. **Log every call** as it happens:

   ```bash
   npx tsx "$TOOL" log --file "$LOG" --kind endpoint \
     --value "GET <the path describe-apis returned>" --note "stage3 <capability>"
   ```

#### Three dispositions, and only three

Every candidate the inventory touches gets exactly one, and it is recorded — as a
row in `cross_reference.candidates`, naming the read and what came back. A row
whose disposition is `confirmed` or `refuted` and that records neither fails
`validate`: those two settle something, and a verdict with nothing behind it says
no more than the silence it replaced. `not-readable` is exempt from **`result`**,
because it is the disposition for a read that did not settle the finding's own
proposition, and a result demanded there is a result the run has to invent.

It is not exempt from saying it looked. From `schema_version` 5 a `not-readable`
row carries **`unreadable_reason`** — one of the four named in the bullet below —
and, on all of them but `no-operation`, the **`read`** it attempted.
`no-operation` is the only one that takes no `read`, because it is the only one
where no operation was run. Write both as the read happens, from what actually
happened; a bare `not-readable` reads exactly like a candidate nobody looked at,
which is the one thing the row exists to rule out. `unreadable_reason` is refused
on `confirmed` and `refuted` — a read that settled the finding's own proposition
has no unreadability to explain.

- **Confirmed** — the namespace states the thing the static signal inferred. Raise
  `confidence` to what the detector playbook's channel-B row gives, and say the
  live read is why. The citation does not change: a namespace is not a source.

  **A candidate with no channel-B row has nothing to raise to**, and that covers
  every signal a detector discovered this run as well as every calibrated row
  whose playbook wrote none. It keeps its code-only disposition and the run
  records that the read confirmed it. Choosing a number here because the namespace
  agreed is the re-rating the copy rule forbids, arriving by another door.
- **Refuted** — the namespace contradicts the finding's *own* proposition: the
  exact thing the finding says is missing turns out to be present, or the thing it
  says is unsafe turns out to be inert. A reward *is* attached to the achievement's
  unlock; the ranked stat the client writes is server-set, so the write cannot
  land. **Drop the candidate** and count it. A false positive removed is worth more
  to the developer than a finding added, and this is the only stage that can remove
  one.

  Hold that to the finding's own words, because a read that answers an *adjacent*
  question refutes nothing and drops silently. The leaderboard's stat code exists —
  a place to write is not a write. The IAM client beside the secret is Public — a
  secret literal in a client build is extractable either way. Neither is a
  refutation; both are **not readable**, and each detector's channel-B table says
  which is which. Both take `unreadable_reason: answers-another-question` and
  name the `read` they made — the call landed, and what came back is a fact about
  a different proposition than the finding asserts. When the two readings look
  equally arguable, the candidate keeps its code-only disposition: this is the
  only stage that can delete a finding, so it carries the burden of proof.
- **Not readable** — no operation exposes it, the read errored, the token lacks
  the permission, or the read landed and answered a different question than the
  finding asks. Leave the candidate exactly as code-only would have shipped it,
  and say the read did not settle it. Silence from a namespace is neither a
  confirmation nor a refutation, and neither is an answer to something else.

  **Write which of the four it was**, in the row's `unreadable_reason`:

  | Reason | When | `read` |
  |---|---|---|
  | `no-operation` | no operation exposes the thing | omit — there is none to name |
  | `errored` | the read was made and errored | **required** |
  | `unauthorized` | the read was made and the token lacked the permission | **required** |
  | `answers-another-question` | the read was made and **landed**, and what came back settles a different proposition than the finding asserts | **required** |

  Three of the four are reads that were *made*, and the call is the fact the row
  carries, so each names it. `no-operation` is the only exemption: there is no
  operation to name, and composing one would put an endpoint in the artifact that
  was never called. Never reach for `no-operation` to describe a read that ran —
  that states something false, and `answers-another-question` is the one for it.
  `result` is optional on all four, and worth writing on the last one, where the
  read landed and there is something true to record.

  A run that skips this has recorded that it did not learn something without
  recording that it tried, and a live run did exactly that — it landed
  `confidential-secret-in-client` on a bare `not-readable` while its own access
  log held the admin-client GET behind it (ADR-0006).

Some signals **no live read can settle**, because the missing piece is in the
client: `matchmaking-no-notification-handler`, `matchmaking-empty-qos`,
`ams-no-drain-handler`, `web-token-in-localstorage`, `ags-call-per-frame`,
`no-websocket-recovery`, `unchecked-result-callback`,
`matchmaking-no-failure-path` and `no-critical-path-telemetry` are code shapes,
and a namespace has no opinion about them. Do not go hunting for a read that
settles one — they ship as code-only ships them.

`matchmaking-no-failure-path` is the one on that list a read looks able to settle.
It is not: the expiry callback fires when the matchmaking service is down or
cannot find the ticket, so the path is reachable whatever a match pool is
configured to do, and a pool read moves nothing
([error-resilience.md](../references/detectors/error-resilience.md)).

`sdk-below-auto-retry` is unsettleable for a third reason: both numbers it
compares are already in hand, the repo supplying the pin and the docs page the
threshold. A namespace holds neither.

`namespace-env-mismatch` is unsettleable for a different reason: both halves of its
comparison — a namespace and a base URL — are already in the repo, so a live read
adds no term to it. What `get_token_info` returned is the namespace *this session
authenticated to*, which is a third value and a different question (step 1 above:
ask the developer which environment they meant). The finding stays suppressed in
this mode too, for the reason it was suppressed in the other one — no public page
states the discriminator, and a read cannot supply a page
([auth-token-safety.md](../references/detectors/auth-token-safety.md)).

#### What this stage does not do

- **It adds no detector.** Enabled-vs-called feeds the four detectors at Stage 4;
  it is not a fifth one. "The namespace has a module the code never calls" is
  context worth a sentence to the user, not a finding — no detector row and no
  citation covers it, and shipping it as one is the fabrication the grounding rule
  exists to stop.
- **It writes nothing** — no write method, and a consent prompt means the wrong
  operation was picked (`<tool_usage_rules>`).
- **It sends no repo content over the wire** — identifiers from the map, nothing
  else (`<action_safety>`).

#### When the live half fails

- **One read fails** → that row is *not readable*, with `unreadable_reason`
  `errored` or `unauthorized` and the `read` it attempted. Log the attempt and
  keep going; the rest of the cross-reference still stands, and the run is still
  config-aware.
- **Every read fails** (auth lapsed mid-run, the MCP went away) → the
  cross-reference did not happen. An inventory of `not-readable` rows *could* be
  written — that disposition is exactly the record of an attempt that failed, and
  the bullet above writes one, `read` and reason included — but it would settle
  nothing, and `config-aware`
  is a claim about what informed the findings, not about what was tried. Every
  finding here came from the static read alone, so the label would name a source
  nobody consulted.
  Relabel the run **code-only**: drop the `namespace` **and** `cross_reference`
  fields (`validate` refuses both
  in that mode), re-compose the memory key for the mode the run actually is, take
  *Cross-reference the live namespace* off the progress list, and end on the
  relabeled summary shape
  (`<output_contract>`) rather than the plain code-only one, whose *needs AGS creds*
  line is false here. Two consequences carry into Stage 6, because the run is now
  writing under a key nothing looked up: the report key must be **read before it is
  written**, and the activity entry's `namespace` is `unknown`. What is lost by
  relabeling is the record that the reads were tried at all, so say so in the
  summary — the access log still holds every attempt, and it is the only place
  left that does.

### Stage 4 — Detect

Run each in-scope detector over the Stage 2 map. Both modes run the same four
static-channel detectors — the live read changes what happens to their candidates,
not which detectors run:

| Detector | Playbook | What it flags |
|---|---|---|
| `incomplete-integrations` | [incomplete-integrations.md](../references/detectors/incomplete-integrations.md) | A capability is called but its required companion wiring is absent. |
| `deprecated-apis` | [deprecated-apis.md](../references/detectors/deprecated-apis.md) | Usage of an SDK API or module that is deprecated or far behind GA. |
| `auth-token-safety` | [auth-token-safety.md](../references/detectors/auth-token-safety.md) | Secrets or tokens handled unsafely for a shipped client. |
| `error-resilience` | [error-resilience.md](../references/detectors/error-resilience.md) | An AGS call on a critical path with no path for that call failing. |

`deprecated-apis` looks each call site up rather than matching it against a list.
Which of its three channels answers depends on what was called and what is
installed — the **Extend SDK MCP** for a server/admin operation when that MCP is
present, and for a client (Unity/Unreal) call the AGS release notes or the SDK
source at the version the project has, neither of which needs an MCP. The
channels, and what a deprecation looks like in each engine's source, are laid out
in [deprecated-apis.md](../references/detectors/deprecated-apis.md) and mapped in
[grounding-sources.md](../references/grounding-sources.md). There is no
hand-maintained list behind any of them, and a call the release notes never
mention is still a finding when the SDK source deprecates it.

`error-resilience` **discovers its signal set** instead of reading it off a list.
It walks AccelByte's graceful-disruption-handling index first — public pages,
channel A, no MCP and no credentials — and takes each page's stated obligations as
the things to check the call map against
([error-resilience.md](../references/detectors/error-resilience.md) § *Where the
signals come from*). Its playbook table is **calibration, not coverage**: a gap
matching no row there is still a finding, and it ships at the default disposition
that playbook states. Never raise or lower that default from how the page was
worded (ADR-0004).

**Then say how far it looked.** The walk either reached the index or it did not,
and the run reports which, as the summary's `Coverage:` row:

```text
Coverage:     error-resilience read 9 of 9 pages under graceful-disruption-handling
```

A run that fell back to the calibrated rows says that instead. Findings counts
describe what a detector found; only this row describes what it read, which is
what separates a clean repo from a shallow scan.

`error-resilience` and `incomplete-integrations` read the same call sites and must
not both claim one. A handler that is **absent** is incomplete wiring; a handler
that is **present with no failure branch** is a resilience gap. Where a call site
looks like both, decide which of the two it is and emit once
([error-resilience.md](../references/detectors/error-resilience.md) § *What not to
flag*).

(There is no separate config-aware detector: the live read feeds these four rather
than adding a fifth, which is why Stage 3 produces an inventory and not findings.)

**In a config-aware run, apply the Stage 3 inventory before minting anything.**
Confirmed candidates take the confidence their playbook's channel-B row gives,
refuted ones are dropped and counted, and everything else keeps exactly what the
code-only path would have given it (Stage 3 § *Three dispositions*). Apply it
first: a dropped candidate needs no fingerprint, and a candidate the read moved
must not be recorded at its code-only confidence and corrected afterwards.

**`severity` and `confidence` are copied from the playbook, never re-derived** —
from the matching row, or from the default pair that playbook states when a
discovering detector turned the finding up with no row of its own. Why that is a
rule rather than a preference, and why passing `validate` is not evidence the
number was copied, are in
[report-schema.md](../references/report/report-schema.md) § *Confidence comes
from the playbook*. If a row's stated confidence looks wrong for the repo in
hand, the fix is to the playbook, not to this report.

For each candidate the playbook confirms, mint its identity and clean its
evidence — both mechanical:

```bash
# Line-independent id (keys suppressions; survives reindent/drift), plus the
# hash of the snippet it was built from — always take both:
echo "<the matched snippet>" | npx tsx "$TOOL" fingerprint \
  --detector <detector-id> --path <repo-relative-path> --json

# Redact the snippet before any of it enters the Report or memory:
echo "<the matched snippet>" | npx tsx "$TOOL" redact
```

Never compose a fingerprint yourself; never persist an unredacted snippet.

What the two values are for, why `snippet_hash` is carried onto the finding, what
`signal` is and when to leave it off, and the closed list of fields a finding may
carry are in [report-schema.md](../references/report/report-schema.md) §
*Finding object*; the one spelling `--path` and `location.path` must share is in
that file's § *Suppression record*, which is where a second spelling does its
damage. Follow them there; neither is restated here, because a finding described
in two places is how a field's rule and its writer drift apart.

Three things this stage decides, because they are about the order the run works
in rather than about the object:

- **Mint per candidate the playbook confirms**, not per candidate found. A
  dropped candidate needs no identity.
- **Redact before anything enters the Report or memory** — not on the way out.
  The redacted snippet is what may be quoted in a finding's one-line `title` and
  in an activity `summary`/`target`; the snippet itself is never a Report field.
- **A citation `note` explains why the source backs the claim.** The playbooks'
  "fix direction" column belongs in what you tell the user, not in the Report
  object.

### Stage 5 — Ground

Apply the grounded-or-suppressed rule from
[`grounding-rules.md`](../references/grounding-rules.md) to every candidate.

What counts as a citation, which source owns which fact, why Stage 3's live read
grounds nothing, why the grounding tools fail separately from memory, and when a
candidate is suppressed rather than dropped are all one set of rules with more
than one caller — so they are written once, in
[`grounding-rules.md`](../references/grounding-rules.md), with the per-detector
map in [grounding-sources.md](../references/grounding-sources.md). Follow them
there; nothing about them is optional and none of them is restated here.

Two things this stage settles, because they are about the run rather than about
grounding:

- A shipped finding needs its citation **before** the Report is assembled, not
  after. A candidate reaching Stage 6 uncited is one this stage failed to
  resolve, and Stage 6 has no way to tell that from a finding meant to ship
  suppressed.
- A suppressed row's `confidence` is **`low`**, always. It asserts nothing, so it
  has nothing to be confident about, and `validate` refuses any other value.

**Then walk the suppression-only rows.** Each detector playbook names a closed set
of rows that ship suppressed by default — `namespace-env-mismatch` and
`web-token-in-localstorage` in
[auth-token-safety](../references/detectors/auth-token-safety.md),
`sdk-behind-ga` in [deprecated-apis](../references/detectors/deprecated-apis.md),
`no-critical-path-telemetry` in
[error-resilience](../references/detectors/error-resilience.md).
For **every** such row belonging to a detector that ran, evaluate its trigger
against the repo and record the outcome: emit the row when the trigger fired, and
leave it out only because it did not. The set is a function of the tree, not of
the run.

Two of them are suppressed unconditionally, and for the same reason:
`namespace-env-mismatch` has no public page stating its discriminator, and
`no-critical-path-telemetry` has none stating that critical paths must be
instrumented. Nothing a run can do grounds either. The other two carry a
condition, and the playbook row states it: `web-token-in-localstorage` ships
live at `medium / medium` when the authentication page states the web-storage
guidance, and `sdk-behind-ga` ships live when the repo itself supplies both
version numbers. Read the row before deciding; *suppression-only* is where these
rows start, not a promise about where they end.

A row that meets its live condition leaves this walk: it ships as an ordinary
grounded finding, and it counts in neither half of the count below. The count
describes the rows that stayed suppression-only.

This is not optional tidiness. Three scans of one commit produced three different
suppression sets — `{namespace-env-mismatch}`, `{}`, and `{sdk-behind-ga}` — while
the live findings stayed identical. Nothing had changed but which rows each run
happened to think about. A suppressed row is the one output that says *this was
looked at and could not be grounded*, so a run that silently skips the row has
told the reader nothing was there.

State the walk in the summary as a count, so a skipped row is visible:

```text
Suppressed:   1 of 4 suppression-only rows fired (sdk-behind-ga)
```

### Stage 6 — Report

Assemble the Report JSON per [`report-schema.md`](../references/report/report-schema.md)
— `schema_version: 6`, the run's own `mode`, the `repo.name`, `commit_sha`,
`tree_state` and (when dirty) `tree_hash` from Stage 1, the `actor` and
`actor_source: git-config` from Stage 1, the `provenance.started_at` Stage 1
stamped, the `surface` Stage 2 built, one finding object per shipped or
suppressed finding — then gate and render it. Emit `6`, not an older number:
each generation makes its own fields optional again, so a run that copies a
lower one opts itself out of the checks and produces a report the walk-back
cannot place. A config-aware run also carries
`namespace`, the value `get_token_info` returned, and `cross_reference`, the
Stage 3 inventory; `validate` requires both in that
mode and refuses both in the other, so the mode label cannot outrun what was read.
At `5` each `not-readable` row in that inventory also carries
`unreadable_reason`, and the `read` it attempted unless that reason is
`no-operation` (Stage 3 § *Three dispositions, and only three*).

`surface` is the one field required in both modes, and it is not reassembled
here: it is the map Stage 2 already built, carried forward. Where a Stage 3 read
answered something about a called capability, that capability's `config` edge
carries the read, what it answered, and the instant — `validate` refuses an edge
on a code-only report, for the reason it refuses a namespace on one. The edge is
not a second copy of a candidate row: a candidate is keyed on a **detector
signal** and records a disposition, an edge is keyed on a **capability** and
records what the namespace said about it. One read can produce both, several
candidates, or an edge and no candidate at all:

```bash
# Stamp when these findings were derived — read the clock, never compose it.
# The other end of the pair, provenance.started_at, was read at Stage 1:
date -u +%Y-%m-%dT%H:%M:%SZ     # → report.provenance.scanned_at

npx tsx "$TOOL" validate "$RUNDIR/report.json"   # exit 0 or the scan is not done
npx tsx "$TOOL" export --format md   --at-commit "$COMMIT" --out "$RUNDIR/teammate-report.md"   "$RUNDIR/report.json"
npx tsx "$TOOL" export --format html --at-commit "$COMMIT" --out "$RUNDIR/teammate-report.html" "$RUNDIR/report.json"
```

`export` re-validates and refuses an invalid Report — the chokepoint holds at the
export boundary. PDF, if asked, is print-to-PDF from the exported HTML (no PDF
library ships).

An exported report outlives the session: it gets pasted into a ticket and read
weeks later as the current state of the repo. `provenance.scanned_at` and
`--at-commit` are what let that reader tell a fresh answer from an old one, so
pass them on every export — including the reuse path, where the stamp is the
stored one and saying so is the entire point.

When Stage 1b found a stored report and the user chose to rescan, **diff the new
findings against it** and open the summary with the delta — that comparison is
the reason they paid for the rescan:

- **New** — a finding this run ships that the stored report does not.
- **Gone** — a finding the stored report ships that this run does not. Say which:
  fixed in code, or no longer reached by the playbook. Which of those it can be
  depends on what was diffed against. Against an `exact` candidate the code did
  not move, so a disappearance is a *skill* change and is worth naming as one.
  Against an ancestor, or against a dirty scan whose `tree_matches` was false,
  the code did move — so do not attribute the disappearance to the playbook when
  intervening commits or a changed working tree explain it just as well.
- **Changed** — the same finding, with a different severity, confidence, or
  citation. "Same finding" means same identity, not merely same neighbourhood:
  a different snippet is a different finding, however similar it looks.

Pair a stored finding with a candidate by `id`, never by title — titles are
model-composed and drift between runs even when the finding is identical. Then
resolve the pair exactly the way Stage 1b resolves a suppression, because the
two are the same computation and must not drift apart:

- **Same `id`** → the same finding. Compare severity, confidence and citations
  to decide *unchanged* or *changed*.
- Same `id` but **differing `snippet_hash`** → the stored pair cannot both be
  true, since the id is a hash of the snippet the hash is taken from. One of the
  two was written by hand. Trust the hash, treat it as a different finding, and
  tell the user the stored report contains an id and a hash that disagree.
- **Different `id`**, same `detector_id`, same `location.path`, **matching
  `snippet_hash`** → the same finding, whose stored `id` an earlier run recorded
  wrong. Report it as unchanged, carry **the id you derived this run**, and say
  the match came from the snippet hash. Equal detector, path and snippet hash
  imply an equal id by construction, so reaching this branch at all means an
  earlier run wrote an id it had not derived, or spelled the path differently.
- **Differing `snippet_hash`** → not the same finding, whatever else matches.
  Report it as *gone* plus *new*, not as *changed*: pairing on detector and path
  alone is the guess this rule exists to forbid, and two findings can share both.
- **Stored finding carries no `snippet_hash`** → it predates the field and there
  is nothing to compare. Report the pair honestly as *gone* plus *new* and note
  that the stored report is too old to match against.

**Never write a stored id onto a candidate you could not derive it from.** It
makes the diff key asserted rather than computed, and the reader sees a clean
*changed* row with no sign that anything was guessed — a run that quietly
hand-matches is indistinguishable from one that matched for real, which is the
whole property the id exists to provide. Suppressions are keyed by id, so a
hand-assigned one silently re-points a suppression at a finding it was never
granted for — which is why a suppression carries its own `snippet_hash` and is
matched, not assumed (Stage 1b).

Then close the run through memory ([memory-contract.md](../references/memory-contract.md)),
all conditional on the Wiki MCP's memory tools being present and silent when
absent — the grounding tools are a separate surface and decide none of this:

- Persist the Report (`wiki_memory_put`, kind `report`). **Build the payload with
  the tool, never by hand** — it emits `{ kind, key, doc }` from the file
  `validate` just passed, so the object that was checked and the object that is
  stored are one object:

  ```bash
  npx tsx "$TOOL" memory-doc "$RUNDIR/report.json"
  ```

  Composing the doc a second time is a second chance to differ, and it has
  differed: a stored report carried `detectors_run` and `prior_report_diff`, two
  fields the schema does not define and `validate` refuses, because the run typed
  the doc out again from the same findings. Pass what the command prints. There
  is no `--repo-name`: the key is built from `repo.name` in the document that was
  just validated, so the name that was checked and the name that is stored cannot
  disagree.

  **A clean tree stores without asking.** The report describes the commit, the
  key is the commit, and anyone arriving at that commit should find it.

  **A dirty tree asks first.** The scan describes uncommitted edits that exist on
  this machine only, so it is filed under the user's own key
  (`<repo>@<sha>+u<actor12>:<mode>`), which is what keeps it from being offered
  to anyone else and what stops a rescan overwriting a colleague's row — scoping,
  not a wall (ADR-0003) — and
  filing someone's unpushed work is theirs to agree to. Ask once, through the
  question tool (`<user_updates_spec>`), carrying the file count in the question
  so the tree state and the question about it arrive together — two options,
  *Store it under my key* and *Don't store it*. Where the harness has no question
  tool, print those two options as a typed choice and wait; a question with no
  stated way to answer it blocks the one decision that gates `--allow-dirty`:

  ```text
  Store this scan under your name?  36 files are uncommitted. It files under
  your own key, so a later run of yours at this commit can offer it back — and
  it sits in the studio's shared memory, where a colleague's run can read it.
  What it holds: the paths, titles and severities of these findings, and the
  call sites of the AccelByte capabilities this project uses. Not the code.
  ```

  **One question covers both records.** The answer here decides the report and
  the call-site index below together — they describe the same uncommitted tree
  and are filed under the same person, so asking twice asks the same question
  twice. That is why the block above names the call sites: a question that
  under-describes what it stores is consent to something else.

  On **store**, re-run with `--allow-dirty` and put what it prints — and if the
  memory service refuses that key, it composes the dirty key from the identity it
  stamped rather than the one read here, so the refusal names the key to write
  under. Re-run the same command with `--key <the key the refusal named>` and put
  what that prints; do not edit the payload by hand
  ([memory-contract.md](../references/memory-contract.md) § Report keys). On
  **don't**, say "not stored: dirty, and you declined" — the run still exported, and the next
  run finding no report should know why rather than assume nothing was scanned.
  Never pass `--allow-dirty` without having asked this run; the tool cannot check
  that anyone was asked, which is the whole reason it refuses by default.

  The key belongs to **this** report — not to whatever Stage 1b happened to find.
  Two things move it:

  - **The run relabeled itself at Stage 3.** The mode in the key is now different
    from the mode Stage 1b looked under. Storing a `code-only` body under the
    `config-aware` key it was found by is the cross-mode confusion the key format
    exists to prevent ([memory-contract.md](../references/memory-contract.md)).
  - **Stage 1b offered an ancestor.** That report is keyed at an older commit and
    is not the one this scan overwrites. This scan keys at HEAD.

  In both cases the destination key is one the user was never shown, so writing
  it blind can overwrite a stored report they never saw. Look it up first
  (`wiki_memory_get`). If a report is already there, keep it, say the run's own
  result was not stored, and offer it — a report the user was never offered is
  not one to replace. If nothing is there, persist.
- Persist the integration surface (`wiki_memory_put`, kind `surface`), beside
  the report and never instead of it. It is the same index the Report carries as
  its `surface` field, stored under a key of its own so a later run — and a
  question about a **different** repository — can reach it without reading a
  whole report ([memory-contract.md](../references/memory-contract.md)
  § Surface records is the authoritative shape;
  [cross-repo-surface.md](../references/cross-repo-surface.md) is what reads it).
  A repository whose scans never stored one is a repository the studio-wide
  question answers *no* about, permanently and wrongly.

  The key is the report key **without** its `:<mode>` segment. One commit holds
  **one** surface record whichever mode scanned it, because the index is the
  static read both modes make:

  ```text
  <repo-name>@<commit_sha>              clean tree — describes the commit
  <repo-name>@<commit_sha>+u<actor12>   dirty tree — describes one person's edits
  ```

  `<repo-name>`, `<commit_sha>` and `u<actor12>` are the report key's, character
  for character — the same repository name, the same pinned SHA, the same 12 hex
  of sha-256 over the same actor id, which is the one the memory service stamped
  from the writer's token and not the `actor` the document carries
  ([memory-contract.md](../references/memory-contract.md) § Report keys). A key
  composed from anything else addresses another tree's record — and where the
  store composes a different one it refuses the write and names the key it
  composed, which is the key to write under.

  **Carry every field off the Report `validate` just passed. Derive none of them
  again here.** The record is a rearrangement of a document that has already been
  checked, and re-deriving a value is a second source for it — the failure that
  put `detectors_run` into a stored report:

  | Record field | Taken from |
  |---|---|
  | `repo.name`, `repo.commit_sha`, `repo.tree_state` | the Report's `repo` |
  | `actor.id` | the Report's `actor` — **required when `tree_state` is `dirty`**, because the key is per-person there, and absent on a clean record |
  | `scanned_at` | the Report's `provenance.scanned_at` |
  | `mode` | the Report's `mode`, after any Stage 3 relabel — the mode the run ended in, not the one it opened with |
  | `namespace` | the Report's `namespace`, on a `config-aware` run |
  | `capabilities`, `not_read` | the Report's `surface`, copied whole |

  Four rules the store enforces, so a record that breaks one is refused rather
  than stored wrong:

  - **`tree_state` is required and never defaulted.** A record that does not say
    which tree it read would take the clean key and publish one machine's
    uncommitted edits as the answer for that commit.
  - **The mode and the namespace pair in both directions.** A `config-aware`
    record carrying a `config` edge names the namespace that answered it; a
    `code-only` record carrying one is refused, because a code-only run read no
    namespace.
  - **A string carrying a line terminator is refused, not flattened** — the
    opposite call from an `activity` entry. Every string here is machine-derived
    evidence, and on a path a space where a terminator was is a *different* path.
  - **`capabilities` is required, and empty is a real answer** — the SDK is
    present and the scan matched no call. Never leave the array out to mean
    empty: absent has not answered, and the two are read differently by whoever
    folds them.

  **A dirty tree does not ask again.** The question above covers this record too.
  On *store*, write both; on *don't*, write neither, and say the index was not
  stored for the same reason the report was not.

  **It is write-once, and a refusal is not a failure.** A second
  `wiki_memory_put` to a key that already holds a surface record is refused by
  the store — not merged, not overwritten. That is what makes the record unable
  to go stale, and it is the ordinary outcome of rescanning the same clean
  commit. So:

  - **Attempt the write.** Do not read the key first and skip on a hit. A skip
    that reports nothing is indistinguishable from a write that happened, and it
    hides the one case worth seeing — a *different* tree composing a key that
    already exists.
  - **On a refusal the run continues** and delivers its Report as normal. Nothing
    about the scan depended on the write.
  - **Say so where the reader will see it**, in the same place a declined dirty
    store is reported, naming the key: *A surface record for
    `<repo-name>@<commit_sha>` was already stored; this run's index was not
    written.* The exported files were rendered before this step and the Report
    object is closed, so this line belongs to the run's own delivery — not to a
    field on the Report and not to a file already on disk.
  - **Never call a refused write a success**, and never call it a fault. Both
    readings lose the same thing: the reader cannot tell a rescan at a commit
    already indexed from two different trees colliding on one key.

  **Nothing cites this record.** It is a compiled artifact — it may point at
  evidence and can never be what a claim rests on. A consumer that needs the
  fact opens the `{ path, line }` the record named and cites that, and a
  re-derive always wins.
- Persist any suppression a human granted **during this run** (`wiki_memory_put`,
  kind `suppression`, keyed `<repo-name>@<detector-id>:<id>`), validated first:

  ```bash
  npx tsx "$TOOL" validate --kind suppression "$RUNDIR/suppression-<id>.json"
  ```

  Carry the `snippet_hash` you already minted at Stage 4 — it is required on a
  suppression, because it is the only thing that lets a later run prove the
  dismissal still points at the same code. A suppression the detector applied on
  its own is not one of these: this record means a person decided, and `reason`
  and `actor` say who and why. Do not rewrite a suppression that was already
  stored — its `ts` is the record of when the decision was made.
- **Do not write the access log or the activity entry here.** Both of them say
  what this run *did*, and at this point it is not done — Stage 7 may still open
  a PR. Written now, they describe a run that has not finished, and neither can
  be corrected afterwards: the envelope is one append and the activity entry is
  one append, so a Stage 7 outcome arriving later has nowhere to go but a second
  record that contradicts the first. Both are written once, under *Recording the
  run* below, when the outcome is known. Build them here if it helps —
  `$RUNDIR/access-log.json`, `$RUNDIR/activity.json` — but leave `run` and
  `action` unset until then.

### Stage 7 — One fix

The Report is delivered and the scan is done. Stage 7 is the offer that follows
it: **one** finding, **one** file, **one** branch, **one** approval — and if any
part of that is missing, the run says which part and ends without touching the
project. Read [`pr-composer.md`](../references/pr-composer.md) before running it;
this section says when it runs and what it hands over, that file says how.

**Pick the fix.** Among the findings this Report *ships* — never a suppressed
one — take the highest value by severity × confidence that you can actually
repair in one file. If the top-ranked one needs a change you cannot make
confidently, or spans several files, skip it and say which one you skipped and
why; a fix you are guessing at is worse than the finding, because it arrives
wearing a citation.

Everything after that choice is `pr-composer.md`'s: the `pr-plan` chokepoint that
decides eligibility and hands back the branch name, title and body; the
preconditions that are stops rather than warnings; the capability gate that
answers *may this machine push at all* by finding out; and the propose-only
degradation when it cannot. Follow it there — none of it is optional and none of
it is restated here.

Two things this stage owes the user whatever that file decides:

- **Say which of the two happened.** "No PR was opened" and "no PR could be
  opened" are different answers, and only the run knows which one it is.
- **Say which refusal it was** when the stage stops. An existing branch in
  particular is not an obstacle to route around: the name is derived from the
  finding id, so an existing branch means this finding already has a PR — point
  at it.

**Then the single approval interaction.** Show the diff, the branch, and the
title; ask once, through the question tool (`<user_updates_spec>`), with two
options — *Open the PR* and *Don't*. One question covers applying, committing,
pushing and opening; splitting it into "apply?" then "push?" is two interactions
under one name, and the whole stage is specified as one.

Before asking, prove the fix is on the branch `pr-plan` named and the tree holds
only what the fix declared:

```bash
git status --porcelain -b | npx tsx "$TOOL" pr-guard --expect "$FIXPATH" --expect-branch "$BRANCH"
```

A failure here ends the stage. `pr-guard` refuses undeclared changes, an empty
tree, and a tree it cannot parse — it will not decode a path git quoted rather
than match one approximately. `-b` and `--expect-branch` add the other half of
*no writes outside the PR branch*: the branch is read from the header git puts on
that same output, so a run that never cut the branch and edited on the
developer's own is refused rather than passed on identical-looking paths. Status
output with no header in it is refused for the same reason — the check was asked
for and could not be made. Go back to the starting branch and report what else
was in the tree; do not `git add` your way past it.

On a decline, return to the starting branch and delete the branch you created.
On a yes, add the one declared path — never `-A` — commit, push, open the PR, and
return to the starting branch. Either way the developer ends where they began,
and the run's closing line says where the PR is or that none was opened.

**Then record it — to `$RUNDIR`, not to memory.** Every git and `gh` call goes
to the local access log as `--kind git` at the moment it runs, so the trail is
mechanical rather than recalled. Memory is written once, under *Recording the
run* below. This stage never appends to it, for the plainest of reasons: the
outcome this stage produces is the thing that section needs in order to write
the record correctly.

### Recording the run

Not a stage — the scan is Stages 1 through 7. This is what every run does last,
after whatever Stage 7 turned out to be.

**Runs whenever the detectors ran, including when Stage 7 did not** — and
whenever Stage 1b served a stored report instead of scanning. Past that point
the run has something to say about this repo, and no eligible finding, no push
credentials, a dirty worktree or a declined offer are each an outcome rather
than a reason to stay quiet: a run that says nothing about itself is
indistinguishable from one that never happened. This is the run's only write to
the colleague feed and the only flush of its trail. Both happen here, together,
so both can name what actually occurred rather than what was expected to.

**Silent before the detectors.** A run that stops in Stages 1–3 — no AGS SDK
found at Stage 2 is the ordinary case — writes nothing here and flushes nothing.
It has no finding to report and no scan to claim, and a row in the feed would
tell colleagues a health check ran on a repo where none did. Say so in the
summary; the trail stays in `$RUNDIR`, where the developer can still read it.

**Conditional on the Wiki MCP's memory tools being present, and silent when
absent**, like every memory write in this skill (Stage 6). Without them there is
nowhere to append — that is an ordinary configuration, not a failure. Note it in
the summary and finish the run. The grounding tools answering is not the same
condition and never satisfies this one.

Settle the outcome as **one** value first, and use that same value in both
records:

| What happened | `action` / `run` |
|---|---|
| Stage 7 opened a PR | `opened-pr` |
| Stage 7 declined, stopped, or never had a candidate | `ran-health-check` |
| Stage 1b served a stored report and no scan ran | `reused-report` |
| The run stopped before Stage 4 | *nothing is written* |

`opened-pr` **only if a PR was actually opened**
([memory-contract.md](../references/memory-contract.md)) — a proposed fix is not
an opened one, and the colleagues reading that feed cannot tell the difference
unless the entry does.

- Flush the access log to `wiki_memory_append` (kind `access-log`) as **one**
  entry in the fixed envelope — `repo`, `commit_sha`, `mode` (the run's own, the
  same value the Report carries), `run`, `entries`, `ts`, with the log lines under
  `entries`
  ([report-schema.md](../references/report/report-schema.md)). The field names are
  pinned, not chosen per run; a trail nobody can parse by a fixed path is not a
  trail. `run` is the value from the table — the activity entry's `action`, never
  the run directory's name and never a sentence about the run. Validate before
  appending; the envelope is one write and there is no second one to correct it:

  ```bash
  npx tsx "$TOOL" validate --kind access-log "$RUNDIR/access-log.json"
  ```

- Append **exactly one** `activity` entry (`persona: dev`, `subskill:
  health-check`, `action` from the table) so the colleague feed does not debut
  empty. **Exactly one for the whole run**, whatever the run did — an entry
  appended at Stage 6 and a second one appended after Stage 7 is not a correction,
  it is two rows in a feed that will be read as two pieces of work. Its
  `namespace` is required and is not a place to guess: on a
  config-aware run it is the namespace that was read, and on a code-only run it is
  the pinned `unknown`, which a nudge read never matches against a real namespace
  ([report-schema.md](../references/report/report-schema.md)). **A relabeled run is
  code-only, so it writes `unknown`** — it holds a namespace from Stage 1's probe,
  but it never read anything from that environment, and this entry goes to
  colleagues who cannot see the transcript that says so. `validate` refuses a blank
  or multi-line value here for the same reason. Validate and redact it first:
  ```bash
  npx tsx "$TOOL" validate --kind activity "$RUNDIR/activity.json"
  npx tsx "$TOOL" redact --in "$RUNDIR/activity-summary.txt"   # target/summary
  ```
  **A refuted candidate is never named in the `summary`.** Say the
  cross-reference happened and how many it dropped — *checked 3 candidates
  against the namespace, 1 dropped* — never *dropped
  `client-authoritative-stats`*. A refutation has no place in this run's Report
  by design: it exists only as a count in the terminal line, because the run
  that raised the candidate is the only one that knows why it fell. The activity
  feed goes to colleagues who see neither the candidate nor the reasoning, and a
  detector id in that sentence tells them a detector fired on this repo when the
  finished answer says it did not. `redact` cannot catch it — a detector id is
  not a secret, it is the wrong fact.

The tracker's memory row closes here, not at Stage 6 — it claims memory was
written, and until this point it was not.

## Example (shape, not a real scan)

```
User: /teammate health-check

Skill: [locates $TOOL, validates sample] [seeds the 6-step progress list]
       [get_token_info → no credentials; code-only, no cross-reference row to add]
       [git rev-parse HEAD → a1b2c3d] [no stored report for example-game@<full-sha>:code-only]
       [Grep maps 41 AGS call sites across Assets/]
       [error-resilience walks the practice index → 9 of 9 pages] [runs 4 detectors]
       [fingerprints + redacts each candidate] [grounds each; 1 suppressed uncited]
       [validate $RUNDIR/report.json → ok] [export md + html] [6/6 steps done]

Health check complete (code-only).

  Repo:         github.com/example-studio/example-game @ a1b2c3d
  Scanned:      41 call sites across 12 files
  Coverage:     error-resilience read 9 of 9 pages under graceful-disruption-handling
  Findings:     critical 1 · high 1 · medium 1 · low 1  (1 suppressed)
  Suppressed:   1 of 4 suppression-only rows fired (sdk-behind-ga)
  Report:       $RUNDIR/teammate-report.md  (+ .html)
  Grounded:     every shipped finding cites an openable https:// source; 1 suppressed by design
  Not run here: Stage 3 live cross-reference (needs AGS creds), Stage 7 fix PR (<declined | no eligible finding | no push credentials | dirty worktree>)
  Next step:    Rotate the confidential client secret in Assets/Config/DefaultAccelByte.ini
                and switch the client to Public (auth-token-safety, critical/high).
```

The same repo with credentials present, where the live read confirms one candidate,
kills another, and settles nothing about a third:

```
User: /teammate health-check

Skill: [locates $TOOL, validates sample] [seeds the 6-step progress list]
       [get_token_info → example-studio-shooter; adds the cross-reference row, 7]
       [git rev-parse HEAD → a1b2c3d]
       [no stored report for example-game@<full-sha>:config-aware]
       [Grep maps 41 AGS call sites across Assets/]
       [search-apis "statistics stat config" → describe-apis → run-apis GET
        /v1/admin/namespaces/{ns}/stats/wins; `wins` is Set By: client]
       [search-apis "achievement" → describe-apis → run-apis GET …/achievements
        /first-win; a reward is attached to the unlock]
       [search-apis "iam client" → describe-apis → run-apis GET …/clients/{id};
        the client beside the secret is Public]
       [error-resilience walks the practice index → 9 of 9 pages]
       [runs 4 detectors, applies the inventory] [7/7 steps done]

Health check complete (config-aware).

  Repo:         github.com/example-studio/example-game @ a1b2c3d
  Namespace:    example-studio-shooter
  Scanned:      41 call sites across 12 files
  Coverage:     error-resilience read 9 of 9 pages under graceful-disruption-handling
  Cross-ref:    1 confirmed · 1 refuted and dropped · 1 not readable
  Findings:     critical 1 · high 1 · medium 1  (1 suppressed)
  Suppressed:   1 of 4 suppression-only rows fired (sdk-behind-ga)
  Report:       $RUNDIR/teammate-report.md  (+ .html)
  Grounded:     every shipped finding cites an openable https:// source; 1 suppressed by design
  Not run here: Stage 7 fix PR (<declined | no eligible finding | no push credentials | dirty worktree>)
  Next step:    Rotate the confidential client secret in Assets/Config/DefaultAccelByte.ini
                (auth-token-safety, critical/high) — then move the ranked `wins`
                stat write to a server client (client-authoritative-stats, high/high).
```

Read the three dispositions against the code-only run above, because each one is a
different lesson.

- **Confirmed** — `client-authoritative-stats`. `wins` is `Set By: client`, so the
  namespace states what the code shape only implied. Its **confidence** goes
  medium → high; its severity stays `high`. A live read never moves a severity
  bucket, which is why both runs count one `high`.
- **Refuted and dropped** — `achievements-no-rewards`. A reward *is* attached to the
  unlock, so the finding's premise is false and the candidate goes. That is the one
  `low` the code-only run shipped, and the only reason a finding may disappear
  between the two runs: a successful read that contradicts it. `4 shipped − 1
  dropped = 3`, and the `Cross-ref` line has to account for the difference.
- **Not readable** — `confidential-secret-in-client`, even though the read
  succeeded. The client beside the secret is **Public**, and that says nothing about
  whether the shipped value is a live secret: a Public client has none of its own,
  so the value is stale or another client's, and a secret literal in a client build
  is extractable regardless. The `critical` ships in both runs. A read that returns
  an answer to a *different* question is not a refutation
  ([auth-token-safety.md](../references/detectors/auth-token-safety.md), Channel B).

  At `schema_version` 5 this row carries the `read` it made —
  `GET /iam/v3/admin/namespaces/{namespace}/clients/{clientId}` — and its
  `unreadable_reason` is **`answers-another-question`**, which is the reason this
  case exists for: the operation exists, the run called it, and the call landed.
  What came back was the client's kind, and that is a fact about a different
  proposition than the one the finding asserts. Writing `no-operation` here would
  state something false. `result` is optional and worth carrying —
  `clientType: Public` is true and needs no inventing.

The surviving `medium` gets no disposition at all, and that is not a fourth one.
Its detector has no channel-B row, so the cross-reference never attempted it —
which is different from attempting it and learning nothing. Only candidates the
inventory reached are counted on the `Cross-ref` line.

## Error Handling

| Situation | Response |
|---|---|
| Install not located | Stop; state the skill install could not be found. Never fabricate `$TOOL`. |
| No AGS SDK in the repo | "No AccelByte SDK found under <globs> — nothing to health-check." Stop. |
| `validate` fails at Stage 6 | The Report is not done. Print the validator's messages, fix the offending finding (usually a missing citation → suppress or drop), re-validate. |
| User asks for a fix / PR | That is Stage 7, and it is one finding, one branch, one approval — never a second PR in a run and never a fix applied to the branch they are on. If the scan is done and a finding is eligible, offer it; if the scan has not run, run it first. Without push credentials the offer degrades to propose-only: show the diff, open nothing. |
| AGS API MCP absent or unauthenticated at the Stage 1 probe | Run **code-only** and say so once. Not a blocked run and not a degraded one: state which cross-reference the mode gives up, and point at `/ags install-mcp` if they want it next time. |
| A single Stage 3 read fails or is unauthorized | That row is *not readable*: the candidates it would have settled keep their code-only disposition and say the read was unavailable. Write `unreadable_reason` — `errored` or `unauthorized` — and the `read` attempted, or the row cannot be told apart from one nobody looked at. Log the attempt. Never read an error as a refutation. |
| Every Stage 3 read fails | The cross-reference did not happen, so the run is code-only — relabel `mode`, drop `namespace` and `cross_reference`, re-key memory (reading the new key before writing it), write `unknown` as the activity `namespace`, and end on the relabeled summary shape, which says the live half was attempted (Stage 3 § *When the live half fails*). Never export a `config-aware` report that read nothing. |
| The MCP's namespace differs from the repo's config | Ask which environment they meant. It is a question, not a finding — and `namespace-env-mismatch` stays suppressed either way, for want of a public page. |
| Wiki MCP **memory tools** absent (`wiki_memory_*`) | Proceed with no memory: scan and report as normal; say prior-report reuse and colleague activity are unavailable. The prior-report stage is skipped and every memory write is silently dropped. Seed the list per **No Wiki MCP** under `<user_updates_spec>`, which is where the seeding rule lives. Grounding is untouched — do not report a lost citation layer that was never lost. |
| Wiki MCP **grounding tools** absent (`wiki_search` / `wiki_read` / `wiki_read_source` / `wiki_list`) — AccelByte's global, public documentation corpus | Proceed with no live corpus: **degrade silently** to the detector playbooks' own citations, which is the always-available grounding path. Memory is untouched — reuse, suppressions and activity all still work, and the seeded list is unaffected. Say it once in the summary; never let it suppress a finding that the playbook already grounds. |
| Wiki MCP **studio pages** (`wiki_studio_*`) present, absent, or the only wiki toolset answering | Neither a grounding corpus nor memory, so on its own it settles nothing. Present, it does not make the row above stop applying: unless the four bare names are answering, the grounding corpus is absent and the scan degrades exactly as that row says. Absent, no stage stops — grounding and memory are both unaffected, and what is lost is orientation, not a citation. Never cite a studio page for a claim about AccelByte behaviour. |
| All three Wiki MCP toolsets absent | The rows above apply, and none of them is a blocked run. This is the common case and the one the skill is written to work in: it scans, it grounds from the playbooks, and it reports. Say it once, not three times. |
| Extend SDK / AGS API MCP fails on auth (stale DCR, invalid client) | Recover via the family playbook — `accelbyte/references/mcp-auth-recovery.md`, the same recovery `ags`/`ags-extend` route to; do not reinvent it. If recovery fails, degrade to the playbook's own citations and note the live source was unavailable. |
