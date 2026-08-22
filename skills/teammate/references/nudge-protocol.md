---
name: teammate-nudge-protocol
description: When the teammate may surface a proactive nudge, and the limits it fires
  under. Read once per session before the first nudge; the rules a nudge is drawn
  from live in nudge-library.md.
last-verified: 2026-08-10
see-also:
- '[nudge-library.md](nudge-library.md)'
- '[memory-contract.md](memory-contract.md)'
- '[history-rollup.md](history-rollup.md)'
- '[grounding-rules.md](grounding-rules.md)'
---

# Nudge protocol

A **nudge** is a short, specific reminder the teammate adds to the end of a
response it was already producing. It catches a mistake before the developer
hits it.

The subject of a nudge is unrelated to what was asked — that is what makes it a
tangent. What is never unrelated is the moment: a nudge only ever rides a
response this family was already invoked for. It has no timer, no background
loop, and no way to speak first.

So a session that never invokes this family gets no nudges at all. That is the
design, not a gap in it.

## The gate

Four conditions, all of them, before a nudge is composed:

1. **This family produced a response.** Not a nudge on someone else's turn.
2. **A rule in [nudge-library.md](nudge-library.md) matched**, on evidence
   already in hand from the work just done — never from a fresh scan run to go
   looking for something to say.
3. **The rule is not in cooldown** (below).
4. **No nudge has fired yet this session.** At most one per session, whatever
   matched. A response that carries two nudges is an interruption wearing a
   different hat.

Fail any one and the response ships exactly as it would have without this file.
A nudge is never the reason a user waits longer, and never displaces an answer.

## The read, and when it happens

Colleague-derived rules need the shared activity feed. Read it **once per
session**, at the first invocation of this family, and reuse that result for the
rest of the session:

    wiki_memory_list({
      kind: "activity",
      since: <14 days ago, ISO-8601>,
      exclude_self: true,
      nudge_read: true,
      limit: 20
    })

Four things about this call:

- **`exclude_self` and `nudge_read` are both asked for explicitly.** Neither is
  implied by the other and neither is a default. `exclude_self` drops your own
  entries; `nudge_read` keeps only entries whose identity the server itself
  verified.
- **`since` is the nudge window and it is not retention.** Fourteen days,
  independent of how long entries are kept. Old news is not a nudge.
- **Never pass `key_prefix` or `projection: "keys"` here.** The activity feed is
  an append kind; both are refused as errors, not quietly ignored.
- **The newest entries come back, and the page reads oldest-first.** With a
  `limit` you get the most recent that many, ordered earliest to latest within
  the page — so the *last* entry is the freshest. Expect `over.complete: false`
  whenever the window held more than the limit; that is the limit working, not a
  problem to page through. A nudge wants the newest few, never all of them.

If the memory server is not installed, or the call errors, bind "no
colleague nudges this session" once and move on. Do not retry, do not warn the
user, and do not mention memory. Most installs have no memory server, so absence
is the ordinary case — every other rule in the library still works.

### What stamped an entry decides whether a colleague rule can fire at all

Only entries whose identity the memory service verified may be repeated to a
colleague, and that is the whole of the rule.

**The memory service derives identity from the caller's verified token** and
stamps it onto the entry, discarding whatever the client sent for `actor`,
`actor_source` and `ts`. What it stamps depends on who called: a person's token
gives `iam`, which `nudge_read` keeps, so a colleague's run surfaces. A service
token gives `iam-client`, which it does not — a CI run is stored and honestly
attributed, readable in its own right, and never returned by a nudge read at all.
A stamp is what makes the rule *able* to fire; it is never a promise that every
stamped entry is quotable.

**With no memory server configured there is no feed at all**, so a colleague rule
never fires. That is the ordinary case and there is nothing to report in it. The
other case is not ordinary: where a memory server *is* configured and the read
keeps coming back empty, that is worth raising with whoever set the server up —
it may be that nobody else ran anything in the window, and it may equally be a
server that is denying or pointed somewhere unintended. Do not write it off as
this rule working as designed.

Nothing about the call above changes either way — same tool, same arguments, same
flags ([memory-contract.md](memory-contract.md)).

## Two limits, and they are not the same limit

**Once per session** is held in the session itself. Nothing is stored, because
nothing stored can express "this session" — memory has no notion of one.

**The cooldown** is stored, and it is what stops the same reminder arriving day
after day. Default **7 days** per topic; a rule may name a shorter one, and none
may name a longer.

### The `last-nudged` record

Keyed, one document per topic, overwritten in place:

    key:  <scope>:<topic>

`<scope>` is the repository the nudge is about, or the literal `machine` for a
rule about the developer's setup rather than any repo. `<topic>` is the rule's
slug from the library.

    {
      "schema_version": 1,
      "topic": "<the rule's slug>",
      "scope": "<repo or 'machine'>",
      "shown_count": <integer>
    }

Read it with a keyed get before composing, write it after the nudge ships.

**The document carries no timestamp of its own.** Compare the cooldown against
`updated_at` on the record the get returns — that is stamped by the server when
the record is written, so it cannot drift or be back-dated the way a field
written by the sender can. A record that is absent has never fired and is not in
cooldown.

### What the cooldown covers, and what it cannot

The cooldown is **per namespace, not per person** — a client is never told its
own identity, so the key cannot name one.

For a rule about a repository, that is the behaviour you want: the condition
belongs to the repo, and re-raising it with each teammate in turn is worse than
raising it once.

For a rule about a *person* it is a real limit: one developer seeing it can put
it in cooldown for the rest of the team. Rules that quote a colleague therefore
**do not write a cooldown record at all** — the fourteen-day window and the
once-per-session rule are what bound them. The library marks which rules those
are.

### The other read a nudge may rest on

A rule may draw on the studio's own counts instead of the feed
([history-rollup.md](history-rollup.md)). The same once-per-session read
applies: at most one `wiki_memory_rollup` per session, reused for the rest of
it, and a rule that needs neither read makes neither.

It is a different kind of evidence and carries different limits:

- **It quotes nobody, so `nudge_read` has nothing to do here.** A count names no
  person. That is also why a rollup-derived rule may fire on counts drawn from
  entries a colleague nudge correctly never quotes — a service token's, or one a
  run composed for itself with no memory service to stamp it (`git-config`).
- **It is still not a scan.** The counts are about scans already stored. A
  rollup nudge says *this has come up before*; it never says the problem is in
  the code in front of you, because nothing looked.
- **One sentence, and the narrowing stays inside it.** "Nine times across four
  repos" is a nudge; the `over` block is not, and a nudge with a completeness
  caveat bolted on has stopped being one sentence. If the count is a floor,
  say "at least".
- **It writes a cooldown record like any other rule.** The subject is the
  studio's history rather than a person, so nothing here suppresses a colleague
  rule.

## A nudge is grounded or it does not fire

Every rule that asserts something about AccelByte carries at least one
`https://` citation the reader can open, on the same terms as any other claim
this skill ships ([grounding-rules.md](grounding-rules.md)).

Two consequences worth stating plainly, because they are what keep this surface
honest:

- **A reference that ships beside this skill is not a citable target.** Reason
  from it; cite the public page it rests on.
- **No openable page, no nudge.** Not a quieter nudge, not a hedged one. The
  library carries the rule with its citation, or it does not carry it.

A rule that asserts nothing about AccelByte — that a tool is not installed, that
a repository changed since it was last scanned — needs no citation, because
there is no external claim in it to ground.

## What never nudges

- **Never during an approval.** A question that needs an answer gets nothing
  appended to it.
- **Never a second time in one session**, including a different topic.
- **Never invented.** No rule in the library, no nudge — do not compose one from
  general knowledge because the situation seems to call for it.
- **Never a scan.** A nudge is drawn from evidence the response already had. If
  answering needs new work, that is a health check the user can ask for, and the
  nudge that suggests it is itself a nudge.
- **Never blocking, never an error, never a warning banner.** One or two
  sentences at the end, phrased as an offer.
- **Never someone's unverified identity.** If the once-per-session **nudge read**
  above returned it — the one carrying `nudge_read: true` — it is quotable;
  nothing else is, including anything read back from the same kind without that
  flag.
