---
name: teammate
description: "Use when the user wants an AI colleague for their AccelByte integration — a health check of an AGS-integrated repo (incomplete integrations, deprecated APIs, auth-token safety, error resilience, cross-referenced against the live namespace when credentials are present), what an engine SDK upgrade would break, whether one AMS fleet or Extend app is sized right ('check my AMS or Extend app CPU and memory usage and advise the optimal settings'), whether one named AMS fleet is configured and running well ('check my prod-eu fleet', 'are our fleets ready for launch'), whether one named Extend app is healthy ('is my matchmaking-override app healthy', 'check my Extend app before we go live'), why one dedicated server or one Extend deployment stopped ('why did server ds-01j2 die', 'my app went down after the last deploy'), wants a document kept in the studio's memory ('remember this technical design'), or asks what the teammate can do. Umbrella router for the dev and liveops teammate personas; routes to exactly one subskill per invocation."
---

# Teammate

An AI colleague for a studio's AccelByte integration. This file is the single
entry point and router: it reads the invocation, picks **exactly one** subskill,
hands control to it, and otherwise stays out of the way. Personas are subskill
families — **dev** first, **liveops** later — under this one umbrella so a
dev-persona session can surface what a colleague did in a liveops-persona
session.

Before running this skill, apply `accelbyte` when it is available, and use its
tool-selection, fallback, and live-auth-preflight policy after routing; do not
redefine those here.

Never scan a repo, run detectors, compose a Report, or open a PR from this file.
All of that belongs inside a subskill.

A subskill that runs for minutes keeps its ordered steps in the host-native
progress tracker — `accelbyte`'s Host-Native Progress Tracking policy when that
skill is available, otherwise whatever tracker the harness offers, and a visible
checklist when it offers none. Which steps those are is the subskill's to
define, not this file's: route first, and let it seed its own list.

The tool grant above covers the subskill this file routes to, since that is
where the scanning happens — `Grep` maps call sites, the task tools show
progress, and the question tool carries the decisions the scan puts to the user
rather than asking for an answer typed back. Tracker and question-tool names
differ by harness and by version, so bind the ones this harness actually exposes
rather than assuming a name; a visible checklist is the fallback for the
tracker, and a typed prompt for the question. Bind them by an exact-name lookup:
a harness may defer tools, leaving a working tracker invisible until it is
fetched by name, so a scan of the visible list — or a fuzzy search, which ranks
by wording and returns unrelated tools either way — reports absence it has not
established, and the fallback fires on a harness that had the tracker. A lookup
that does come back empty may still be a tracker the harness withholds until the
session opts in rather than one it lacks, so say what turns it on instead of
degrading in silence; the `accelbyte` policy carries the line.
Granting them here is not license to use them here.

A grant names harness tools and nothing else. The memory and wiki tools are in
no grant and belong in none: they arrive from a server most installs do not
have, so a step that wants one asks whether it answers at the moment it needs
it and carries on when it does not — which is the whole point, and a grant
cannot degrade that way. A subskill's own grant narrows this one to what that
subskill drives itself; a step that hands its mechanics to another subskill's
procedure is not a use, and adds nothing.

## Routing

| # | Subskill | Route when the user… |
|---|---|---|
| 1 | [`subskills/health-check.md`](subskills/health-check.md) | wants their AccelByte-integrated repo scanned — "check my integration", "is my AGS setup healthy", "any deprecated APIs / unsafe token handling". |
| 2 | [`subskills/upgrade-check.md`](subskills/upgrade-check.md) | names a version bump of the engine SDK — "what breaks if we move to X", "we're two versions behind, what's the cost", "is this upgrade safe". |
| 3 | [`subskills/sizing-check.md`](subskills/sizing-check.md) | asks what one named AMS fleet or Extend app should be set to — "check my AMS/Extend app CPU and memory usage and advise the optimal settings", "is this app over-provisioned", "what buffer should this fleet run". One named thing, not a repo. |
| 4 | [`subskills/remember.md`](subskills/remember.md) | hands over a document to keep — a technical design, a milestone plan, meeting notes, a postmortem, a spec. "remember this", "ingest our plan", "add these notes to memory". It writes one record and stops; it does not scan and does not summarise. |
| 5 | [`subskills/ask.md`](subskills/ask.md) | asks what the teammate is or can do, asks what the team keeps getting wrong across past scans, asks what this project already uses — "which AccelByte services do we call" — or the intent isn't yet a concrete scan. Explain, answer from a stored scan, and route; it reads what is stored and never scans, so a question that needs a fresh read goes to row 1. |
| 6 | [`subskills/fleet-check.md`](subskills/fleet-check.md) | asks whether one named AMS fleet is set up right or running well — "check my prod-eu fleet", "are our fleets ready for launch", "are servers on this fleet crashing". Configuration, image and artifact hygiene, the crash picture from history, and min/max/buffer for one fleet. Row 3 owns the bare sizing question about a fleet; this row owns the rest of it. |
| 7 | [`subskills/extend-app-check.md`](subskills/extend-app-check.md) | asks whether one named Extend app is healthy or safe to ship — "is my matchmaking-override app healthy", "check my Extend app before we go live", "why is my Extend app not running", "is our Extend app image safe". State, last deployments, image scan results, configuration drift, debug and alert hygiene, and CPU, memory and replicas for one app. Row 3 owns the bare sizing question about an app; this row owns the rest of it. |
| 8 | [`subskills/why-did-it-die.md`](subskills/why-did-it-die.md) | asks why one thing that was running stopped — "server ds-01j2 died at 14:20, why", "my party-eh app went down after the last deploy, what happened", "why did this deployment fail", "what killed this dedicated server". One AMS dedicated server or one Extend deployment: the timeline first, then the causes that can be grounded, then the log or artifact that settles the rest. Row 7's "why is my Extend app not running" is the state it is in **now**, and stays there; this row is for one named thing that already stopped and the timeline behind it. |

Pick one row and hand off. If two seem to fit, prefer `ask` and let it route.

## Nudges

Once the routed subskill's answer is composed — and never before it — this file
may add **one** short, unrelated reminder to the end of it. That is the whole of
the proactive surface: it rides a response this family was already invoked for,
has no timer, and cannot speak first.

Read [nudge-protocol.md](references/nudge-protocol.md) once per session before
the first one. It holds the gate, the two limits, and the three reads a nudge
may rest on;
[nudge-library.md](references/nudge-library.md) holds the closed set of rules a
nudge may be drawn from, and the public page behind each rule that says
something about AccelByte.

Three things this file decides, so they are stated here rather than left to the
subskill: a nudge never displaces or delays the answer, never lands on a
response that asks the user a question, and never appears more than once in a
session. Nothing here is a reason to scan — a rule matches on evidence the work
just done already produced, or it does not match.

## Grounding

- Read the selected subskill before acting; prefer its references over memory.
- Findings are **grounded-or-suppressed**: a claim with no citation does not
  ship ([grounding-rules.md](references/grounding-rules.md)). This is enforced
  mechanically by `report_tool.ts validate`
  ([report-schema.md](references/report/report-schema.md)), not left to
  discipline.
- A citation comes from the authoritative AccelByte source that owns the fact —
  deprecations from the Extend SDK MCP, best-practices from the module docs
  ([grounding-sources.md](references/grounding-sources.md)) — queried at scan time,
  never a hand-curated copy.
- Memory (prior reports, colleague activity) is read through the `wiki_memory_*`
  tools when present and **degrades silently when absent**
  ([memory-contract.md](references/memory-contract.md)). The grounding tools
  (`wiki_search` / `wiki_read` / `wiki_read_source` / `wiki_list`) are a
  **separate surface that fails separately**, and your studio's own pages
  (`wiki_studio_*`) are a third — so ask which toolsets answer, never whether a
  server is up. Only the four bare names reach AccelByte's global documentation,
  and only that corpus grounds a finding
  ([grounding-rules.md](references/grounding-rules.md)).

## Status

`health-check` runs the 7-stage scan today: map SDK call sites, run the
incomplete-integrations / deprecated-apis / auth-token-safety / error-resilience
detectors, ground every finding, and emit a cited Report. `error-resilience` reads
what to look for from AccelByte's own practice index at scan time rather than from
a list, so the summary says how much of that index the run reached — a scan that
found nothing off a full read and one that found nothing off a fallback are
different answers. It picks its own mode — **config-aware**
when AGS credentials answer, adding one live GET-only cross-reference of the
namespace against the call sites (Stage 3), and **code-only** when they do not.
When memory holds a report worth offering — this commit, your own scan of your
uncommitted edits, or a clean one a commit or two back — it ranks what it found
and lets the user choose it over a rescan. When the Report is delivered it can
offer **one fix as one pull request** on a fresh branch (Stage 7) — one file, one
approval, and nothing opened without credentials you already have.
`upgrade-check` answers a different dev question — moving the engine SDK to a newer
version, which of your own call sites break. It diffs the symbols your code
actually calls between the version you are on and the one you name, on Unity and
on Unreal, and cites the SDK source at both. Each row is a break, a warning your
build will also raise, a notice your build will stay quiet about, or a signature
that moved. It reads only: it will tell you what an upgrade costs, and it will not
perform one.
`remember` is the one subskill that writes something the user gave it rather than
something it derived. Hand it a technical design, a milestone plan, meeting notes or a
postmortem and it files the text, unedited, in your studio's own memory, where the
digest turns it into pages alongside your scans. Until now everything the teammate
knew about a game came from what the code does; this is what lets an answer reach
what the team decided. It needs the memory server — without one it stores nothing
and says so. It stores and never summarises, and the pages are written on the
digest's own schedule rather than on the call.
`sizing-check` answers a question about one running thing rather than about code:
for one named AMS fleet or Extend app, what it is set to and what it should be.
It recommends an app's CPU and memory request per replica and a fleet's buffer
from the same arithmetic your own operators' dashboards use, and for the knobs
with no published method — instance type, servers-per-VM, replica count — it
shows you the inputs instead of inventing a number. It reads the configured
settings today; reading what a workload actually consumed needs a metrics tool
this plugin does not yet bind, so it says which of its numbers were measured and
which were not. Like the upgrade check, it recommends and never applies.
`fleet-check` asks a wider question about one of those running things: for one
named AMS fleet, is it configured sanely, is its image and artifact hygiene
right, and what does the last day of server history say about crashes. It reads
the fleet, the image it deploys, the artifacts it collected and the transitions
its servers went through, and reports what is misconfigured or failing beside
the min, max and buffer each region should carry — the sizing arithmetic is
`sizing-check`'s, run inside the check rather than copied. Every finding either
carries the AccelByte page it rests on or is about your own numbers and says so,
and each run is stored under the fleet it is about so the next one can open with
what changed. It reads, and it changes no setting.
`extend-app-check` is the same shape on the other side: for one named Extend
app, is it running, did its last deployment work, is the image it is serving
free of critical findings, is the configuration in the Portal actually in force,
and is anyone alerted when it goes down. It reads the app, its deployments, its
images and scan results, its variables and secrets, and its debug and alert
settings, and reports what is broken or unsafe beside what its CPU, memory and
replicas should be — including how many virtual machines the namespace's current
settings imply, since Extend bills by the machine and not by the allocation. It
never reads a secret's value back to you, and like the fleet check it stores its
result under the app so the next run opens with what changed.
`why-did-it-die` is the narrow one beside those two: one dedicated server or one
Extend app deployment that has already stopped, and what happened to it. It reads
the transitions in the order they happened — the states, the reasons and the exit
codes as the service returned them — names the causes it can put a published page
behind, and hands over the log or the core dump for the rest rather than guessing
at it. Where the answer is a setting it points at the fleet or app check that
owns it, and where the honest answer is that the evidence was not kept it says
which sampling rule decided that. Proactive
nudges ride any response this family produces — at most one per session, drawn
only from [nudge-library.md](references/nudge-library.md). Every rule that says
something about AccelByte carries the public page it rests on, and none ships
without one; the rules that say something about your own machine, this project
or what your studio has already stored assert nothing about AccelByte and so
cite nothing. The liveops `observe` persona is not available yet.
