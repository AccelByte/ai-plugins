---
name: teammate-remember
description: Use when the user hands the teammate a document to keep — a technical
  design, a milestone plan, meeting notes, a postmortem, a spec — and wants it in
  the studio's own memory, where it becomes wiki pages alongside everything else.
  'remember this technical design', 'ingest our milestone plan', 'add these meeting
  notes to memory'. Writes one record and stops; it does not scan, and it does not
  summarise the document.
allowed-tools: Read AskUserQuestion
model: sonnet
last-verified: 2026-08-19
see-also:
- '[memory-contract.md](../references/memory-contract.md)'
- '[ask.md](ask.md)'
- '[health-check.md](health-check.md)'
---

# Remember

The ingest subskill. The user has a document; this puts it in the studio's
memory so later runs can read it.

Everything the teammate knows about a game today it derived from what the code
does. A document is the other half — what the team *decided*, and what they are
building next. That is what lets a later answer say "this call site predates the
plan that replaced it" instead of only "this call site is deprecated".

This subskill writes **one record**. It does not scan a repository, does not
compose a Report, and does not summarise or rewrite what it was given: the
document is stored as the user wrote it.

## Behavior Constraints

- **One document per run.** Several files is several runs; say so and do the
  first, rather than looping and reporting a total nobody watched.
- **Never edit the document.** Not to trim it to the cap, not to fix its
  formatting, not to strip anything. If it does not fit, say so and stop — the
  cap is a refusal, and the user splits the file.
- **Never summarise it into the record.** The digest does that later, and a
  summary written here would be a second, unciteable one.
- **Never promise a page.** The digest runs on its own schedule. A read spends no
  tokens on our side and nothing here triggers one, so the honest sentence is
  "it will be picked up on the next digest", never "your wiki page is ready".
- **Say who can read it before writing, not after.** See § Consent.
- No memory server, no ingest. This subskill has nothing else to offer;
  see § When there is no memory server.

## Stage 1 — Get the document

The user names a file, pastes text, or points at something vague.

- **A path** — read it. This is the ordinary case.
- **Pasted text** — take it as given, and ask for a title in Stage 2.
- **Vague** ("remember our plans", "ingest the technical designs") — ask which file.
  Do not glob a directory and ingest what you find; the user picks.

If the path does not exist, say so and stop. Do not search for something with a
similar name.

## Stage 2 — Settle the four fields

A document record carries exactly these. Anything else is refused by the store,
so do not invent fields.

| Field | Required | What it is |
|---|---|---|
| `title` | yes | One line, how a person would refer to it. Take the document's own H1 where it has one, otherwise the filename, otherwise ask. Must be a single visible line — the store refuses a line break here, because the title lands in a listing beside other people's. |
| `format` | yes | `markdown` or `text`. Nothing else. |
| `body` | yes | The document, verbatim. |
| `origin` | no | Where it came from, in the studio's own words — the path, a ticket, "design review 2026-08-19". One line. Nothing resolves it; it is a note to the next reader. |

**Format.** `.md` / `.markdown` is `markdown`; `.txt` and anything plainly plain
is `text`. **A PDF, a `.docx`, a Google Doc export, an image — refuse.** Say the
store takes markdown and plain text, and that converting first is the fix. Do not
attempt extraction: a bad extraction produces prose the digest cannot tell from
the real thing, and it fails silently.

**Size.** The body cap is **256 KiB of UTF-8**. Past it the store refuses and
names the cap. Do not pre-emptively trim to fit — offer the split instead, and
let the user decide where it falls.

## Stage 3 — Settle the key

The key is a **filing decision**, and nothing in the document determines it. The
store composes none and checks none, so whatever is chosen is what a later reader
has to guess or list.

Propose a path-like key and confirm it: `design/matchmaking-v2`,
`postmortem/2026-08-19-login-outage`, `plan/q4-milestones`. A stable prefix per
kind of document is what makes `key_prefix` narrowing useful later.

**A key that already holds a document is overwritten.** Before writing, read it:

```
wiki_memory_get({ kind: "document", key: <the key> })
```

- **Not found** — the ordinary case. Write.
- **Found** — say what is already there, by its `title` and `updated_at`, and ask
  whether to replace it. A revised plan replacing its own earlier version is
  exactly what overwrite is for; a different document colliding on a key is not.

## Stage 4 — Consent, then write

Say all three of these before the write, in one short sentence each. They are all
true and the first without the others is misleading:

- it is filed under **your name**, in the **studio** scope;
- **a colleague whose grant reaches it can read it** — this is shared memory, not
  a private drawer;
- it is **kept** — documents do not age out, unlike the activity feed.

Never write, or imply, that a colleague's grant cannot reach it.

Then:

```
wiki_memory_put({
  kind: "document",
  key:  <the key>,
  doc:  { title, format, body, origin }
})
```

`scope` is not an argument — the server derives it from the caller's token. A
call that passes one anyway is not refused: the argument is dropped and the write
lands in your own scope, so the success says nothing about what you sent.

If the store refuses, **read the refusal back**. Its messages name the field and,
for the cap, the number — that is the whole diagnosis, and paraphrasing it as
"the document was rejected" throws the useful half away.

## Stage 5 — Record the run

Append exactly one activity entry, as every subskill run does:

```
wiki_memory_append({ kind: "activity", entry: { subskill: "remember", ... } })
```

Identity and timestamp are stamped by the server; anything the client sends for
them is ignored.

## Stage 6 — Say what happens next, accurately

Confirm the title and the key, and say the document will be picked up by the next
digest — pages are written on a schedule, not on this call.

Two things worth saying once, where they apply:

- **A very long document is read in part by the digest.** A technical design, milestone plan or
  postmortem of ordinary length reaches the digest whole. Two things cut one: a
  document far longer than that, and a pass that carries many records at once,
  which leaves each of them a smaller share. Either way the whole document is
  stored and readable. Where a cut bit, the page says so and names the document,
  so a reader is told rather than left to infer it — and can read the full text
  back with `wiki_memory_get({ kind: "document", key })`.
- Reading pages needs the studio wiki configured, which is a **separate** server
  from memory. Ingesting works without it; the pages are what it serves.

## When there is no memory server

The memory tools are in no grant and arrive from a server most installs do not
have. Try the call and see; do not probe for a server.

Where they do not answer, this subskill can do nothing, and that is the whole
answer: say the document was not stored, that ingest needs the teammate memory
server, and that the URL comes from their AccelByte contact. Do not offer to keep
it in the conversation instead — that is not memory, and it disappears.

## Not this subskill

- **"What did we decide about X?"** — that is a question against memory, not an
  ingest. It belongs in [`ask`](ask.md).
- **"Scan this repo"** — [`health-check`](health-check.md).
- **Source code.** The integration surface is derived by a scan, at a commit,
  and it is not a document somebody files. Ingesting a `.cs` file as a document
  stores prose nobody will cite about code the scan already reads properly.
