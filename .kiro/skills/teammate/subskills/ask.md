---
name: teammate-ask
description: Explain what the teammate can do and route to the right subskill. Use
  for 'what can the teammate do', 'how does this work', 'what does this project already
  use', or when the intent isn't yet a concrete scan.
allowed-tools: Read
model: sonnet
last-verified: 2026-08-16
see-also:
- '[health-check.md](health-check.md)'
- '[upgrade-check.md](upgrade-check.md)'
- '[sizing-check.md](sizing-check.md)'
- '[remember.md](remember.md)'
- '[history-rollup.md](../references/history-rollup.md)'
- '[cross-repo-surface.md](../references/cross-repo-surface.md)'
- '[report-schema.md](../references/report/report-schema.md)'
- '[nudge-protocol.md](../references/nudge-protocol.md)'
- '[nudge-library.md](../references/nudge-library.md)'
- '[memory-contract.md](../references/memory-contract.md)'
- '[ags install-sdk.md](../../ags/subskills/install-sdk.md)'
---

# Ask

The explain-and-route subskill. Use it when the user wants to know what the
teammate is for, or when their intent is not yet a concrete action to run.

**Two outcomes, and they are not the same.** Some rows below hand off to another
subskill and stop there. The rest are answered here and route nowhere. Neither
is the majority case, and neither is the default — each row says which one it is,
so read the row rather than assuming. Do one of the two, never both, and never a
scan from this file.

## Answer, briefly

The teammate is an AI colleague for your AccelByte integration. It works by
persona:

- **dev**
  - `health-check` — scan an AccelByte-integrated repo for incomplete
    integrations, deprecated APIs, auth-token-safety issues and error-resilience
    gaps. You get a Report where every finding is cited or suppressed — nothing
    ungrounded ships — exported to Markdown and to a single HTML file, and it
    says how much of AccelByte's own practice index the run reached: a clean scan
    off a full read and a clean scan off a fallback are different answers. Where
    AGS credentials answer, it adds one live, read-only cross-reference of your
    namespace against your call sites: whether the backend a call site depends on
    is actually configured, which no repo scan can see. It reads your repo and
    changes nothing, with one exception — after the Report it can turn **one**
    finding into **one** pull request on a fresh branch, one file changed. That
    needs your approval, an eligible finding, push credentials you already have,
    and a clean tree; short of any of them it proposes and stops.
  - `upgrade-check` — for a version bump of the engine SDK, which of your own
    call sites break, each at `file:line`. Unity and Unreal both. Each row says
    which it is: a break, a warning your build already raises, a notice your
    build stays quiet about, or a signature that moved. It tells you what the
    upgrade costs and never performs it.
  - `sizing-check` — for one named AMS fleet or Extend app, what it is set to and
    what it should be, each number labelled by what it rests on. It recommends
    and never applies.
  - `remember` — hand it a document and it keeps it: a technical design, a milestone
    plan, meeting notes, a postmortem. Stored as you wrote it, in your studio's
    own memory, where the digest turns it into pages alongside your scans. It is
    what lets a later answer reach what the team *decided* rather than only what
    the code does. Needs the memory server; without one it stores nothing and
    says so.
- **liveops** — `observe`: watch a live game's stability and error rates.
  *(Not available yet.)*

Two things ride alongside whichever check runs:

- **Reminders.** At most one per session, added to the end of an answer you
  already asked for. There is no timer and no background loop — a session that
  never asks this teammate anything gets none. They come from a closed library:
  a mistake your integration is about to hit, and — where something useful is
  missing from this machine — the AGS connection, the MCP server for your engine,
  or the sibling `ags` skill. Every rule that says something about AccelByte
  carries the public page it rests on, and none ships without one; the rules that
  say something about *your machine* assert nothing about AccelByte and so cite
  nothing. Most need only what the work just done already produced. A few ride a
  live AGS read the session had already made, and the ones about colleagues need
  a memory server — without one they simply do not fire.
- **Memory, where it is installed.** Configure the memory server and the teammate
  can offer a stored report instead of rescanning, and count what your team keeps
  running into across past scans. Mentioning what a *colleague* ran needs that
  same server and nothing further: it stamps each entry from the caller's own
  verified token, and only an entry stamped that way is ever repeated to someone
  who did not write it. Most installs have no memory server at all. Without one
  every check still works, the history is simply empty, and that is the ordinary
  case rather than something to report.

## Route

- **Wants a repo scanned now** → hand off to
  [`health-check`](health-check.md).
- **Still deciding** — asks whether the teammate *could* find something for this
  project, without asking for it yet → answer the question, then **offer** the
  scan and wait for a yes. A hand-off starts the scan; that is not what was
  asked for.
- **New here, asks where to start** → `health-check` on the AccelByte-integrated
  repo they have open. That is the entry point. It starts from the repo, reaches
  the network only for the pages its citations rest on, and AGS credentials only
  widen what it can check.
- **Names a version bump of the engine SDK**, or asks what an upgrade costs →
  hand off to [`upgrade-check`](upgrade-check.md).
- **Asks whether one AMS fleet or one Extend app is sized right**, what its CPU,
  memory or buffer should be, or whether it is over-provisioned → hand off to
  [`sizing-check`](sizing-check.md). A vague "is my AccelByte stuff sized right"
  belongs here too: ask which fleet or which app, then hand off.
- **Asks what the team keeps getting wrong**, which problem comes up most, or
  anything else about their own scan history → answer it here, from
  [history-rollup.md](../references/history-rollup.md). Read the counts, then
  write the answer for this asker. Show what the numbers were taken over, say
  "at least N" whenever the read came back incomplete, and cite a report rather
  than the rollup for any claim about the code.
- **Asks what this project already uses** — which AccelByte capabilities it
  calls, where they are called from, or whether it touches one in particular →
  answer it here, from the `surface` field of a stored report: list the report
  keys, walk to `over.complete`, and take a clean-tree key
  ([report-schema.md](../references/report/report-schema.md) § Integration
  surface). The keys have the shape
  [memory-contract.md](../references/memory-contract.md) § Report keys sets out,
  and that shape is the whole of what is shared with the subskills that scan:
  those select a key by reading the repository they are standing in, and this
  file reads none, so their steps are not steps for here.
  That listing is the studio's and not one project's, so which project a record
  is for is read off the record — the first segment of its key, and `repo.name`
  in the document behind it — and never off anything known here about the
  asker. Where the keys name more than one project, say which projects came
  back and ask which one was meant; the key stored most recently is the
  freshest of them and never a match on the project. Name that project in the
  answer whichever record was read, every time and not only when more than one
  came back: an answer naming no project is taken as being about the asker's
  own.
  Every such key names the commit its scan ran at, so where a commit
  arrived with the request, take the key naming that one; where none did, take
  the most recently stored key of the project settled on and answer about the
  commit it names. Take
  neither shape of dirty key. That stored report is the record this row
  reads — the addressable `surface` kind is the cross-repo fold's subject
  ([cross-repo-surface.md](../references/cross-repo-surface.md)), written only
  where the scan that made it had a memory server to file it in — and, on a
  dirty tree, where its owner agreed — and never a second time at a key that
  already holds one. Read it, then write the answer for this asker. Show
  what the answer was taken over: the commit the record names, and what its
  `not_read` says that scan could not reach. Say "at least N" whenever the read
  came back incomplete or `not_read` names anything. Cite what the record
  pointed at, opened and read on its own: a claim about the code cites the
  `{ path, line }` off the file itself, never the index that located it and
  never the report that carried the index — each of those only locates
  evidence and neither can ever be what a claim rests on. This file reads no
  repository state of its own, so which commit the asker is on arrives with
  the request or not at all. Where that commit is not the one the record
  names, the record describes another tree: say so, name the commit it sat at,
  and offer a fresh [`health-check`](health-check.md), because a re-derive
  always wins and this file never scans. No stored report for this project is
  the ordinary case and not a fault to report.
- **Hands over a document to keep** — "remember this technical design", "ingest our
  milestone plan", "put these notes in memory" → hand off to
  [`remember`](remember.md). A question *about* a stored document is not this: it
  is answered here, from what memory holds.
- **Asks about live-game stability or error rates** → tell them the `observe`
  liveops persona is not available yet, and what `health-check` covers today.

## Not this subskill

These arrive here and should not be answered as though the teammate owned them.
Say which one it is, in a sentence, and do not improvise a substitute.

- **A colleague's uncommitted work** — "show me what someone else is working on".
  Not something this offers: a scan of uncommitted edits is filed under the person
  who made them and offered back only to them, so nobody else's working tree is
  ever handed to you as findings about the code you have, and no count is composed
  from one ([memory-contract.md](../references/memory-contract.md),
  [history-rollup.md](../references/history-rollup.md)). Say that, and do not say
  more — it is a rule about what gets *shown*, not a promise about who can read
  what. A stored report is readable by anyone whose grant reaches it. What a
  colleague *ran* is a different thing again, and it surfaces as a reminder rather
  than an answer, and only where a memory server is configured.
- **How-to, install and setup inside AccelByte** — installing an SDK, pointing a
  project at a namespace, wiring a service. Real AccelByte questions, and not
  this teammate's: it inspects an integration that exists. Point at the `ags`
  skill, where it is installed — [`install-sdk`](../../ags/subskills/install-sdk.md)
  and its siblings.
- **A capability question with no AccelByte anchor** — "what can you help me
  with?" is a question about the assistant, not about this teammate. Answer it as
  yourself. Mention the teammate in one line if it fits, and do not recite its
  surface.
- **Anything outside the AccelByte integration surface** — red CI, a failing
  build, a bug in the game's own logic. Say so plainly and point back to the
  relevant skill.
