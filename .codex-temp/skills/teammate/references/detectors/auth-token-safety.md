---
name: teammate-detector-auth-token-safety
description: Secrets and tokens handled unsafely for a shipped AGS client. Static
  signals, the finding each produces, severity, and grounding.
last-verified: 2026-07-26
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authorization/manage-access-control-for-applications/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/
- https://docs.accelbyte.io/gaming-services/modules/online/statistics/implementing-server-authoritative-player-statistics/
see-also:
- '[health-check.md](../../subskills/health-check.md)'
- '[grounding-rules.md](../grounding-rules.md)'
- '[grounding-sources.md](../grounding-sources.md)'
- '[report-schema.md](../report/report-schema.md)'
---

# Detector: auth-token safety

**`detector_id: auth-token-safety`.** Flags credential and token handling that is
unsafe for a **shipped client** — the highest-consequence detector, because a
leaked confidential secret or a client-authoritative write is exploitable the day
it ships. Channel A (static). The client *kind* (Confidential vs Public) is a
channel-B fact a live read settles; code-only mode infers it from where the secret
sits and flags accordingly.

**Signal set bounded by:** the signals written into this file.

The module docs this detector cites state each rule inside integration prose, and
no index enumerates that page set, so there is nothing to walk. What this detector
looks for is therefore bounded by the table below, and a clean result means
*nothing among these signals* rather than *nothing*
([grounding-sources.md](../grounding-sources.md)).

## Signals

| Found in code (grep for) | Finding | Why it is unsafe |
|---|---|---|
| A confidential client secret in a game/client target — `ACCELBYTE_CLIENT_SECRET`, a `clientSecret=` value in client config/`.ini`, a secret literal in a client build | `confidential-secret-in-client` | A secret shipped in the client is extractable from the build; anyone can impersonate the client. |
| Web SDK (`@accelbyte/sdk-iam`) writing tokens to `localStorage` / `sessionStorage` | `web-token-in-localstorage` | Web-storage tokens are exfiltratable by any XSS; the web flow should be PKCE. |
| Client-authoritative stat updates — `updateUserStatItems`, `IncrementUserStatItems` / `incrementUserStatItems` (the client-side Statistics write), or "Set By: client" on competitive, ranked, or economy stats | `client-authoritative-stats` | A client that writes its own ranked/economy stats is trivially cheatable; these need server authority. |
| A dev-looking namespace against a prod base URL (or the reverse) in `.env` / `DefaultEngine.ini` / client config | `namespace-env-mismatch` | A token minted for one environment against another's URL fails silently on the first real call. |

## Findings

| Finding | Severity | Confidence (code-only) | The fix direction |
|---|---|---|---|
| `confidential-secret-in-client` | critical | high | Rotate the secret now; switch the client to a Public IAM client; never store a confidential secret in the game client. |
| `client-authoritative-stats` | high | medium | Move ranked/economy stat writes to a confidential server client (server-authoritative statistics); batch per-stat loops. |
| `web-token-in-localstorage` | medium | `low` suppressed, `medium` live — **suppressed unless the authentication page states the web-storage guidance** (see Grounding) | Use the PKCE flow; keep tokens out of `localStorage`; watch CORS. |
| `namespace-env-mismatch` | medium | low — **suppressed in both modes**, because no public page states the discriminator (see Grounding) | Align the token's namespace with the environment base URL. Both halves of the mismatch are already in the repo, so a live read adds nothing to it — see Channel B. |

`confidential-secret-in-client` is the one finding that can be near-certain from a
static read — a secret literal in a client target is visible and unambiguous, so
it ships **critical/high**. The others infer intent a live read would confirm, so
they carry medium-to-low confidence and name the channel-B check.
`namespace-env-mismatch` goes further and suppresses outright: the confidence is
not the problem, the missing public page is.

**The `Confidence (code-only)` column is the value the finding carries.** Copy it;
do not re-rate it against the evidence in front of you. Two runs looking at one
commit are looking at the same signal, so a number that differs between them is
reporting on the run rather than the code.

### Suppression-only rows — walk both, every run

These two rows almost always ship suppressed, which makes them the two easiest
to skip and never notice, so this detector's contribution to Stage 5's walk is
fixed: evaluate **both** triggers against the repo, emit each row whose trigger
fired, and leave one out only because it did not fire. Never because the run did
not get to it.

Only one of them is suppressed unconditionally. `namespace-env-mismatch` has no
public page to find, so no scan can ever ground it. `web-token-in-localstorage`
has a page that may or may not say the thing — a grounding question, settled
against the page at scan time, exactly as Grounding below describes it.

| Row | Trigger | If it fires |
|---|---|---|
| `web-token-in-localstorage` | A web/WebGL target stores a token in `localStorage`/`sessionStorage` | Emit. `suppressed: true`, `confidence: low`, no citation — **unless** the authentication page states the web-storage guidance, and then it ships live at `medium / medium` citing that page |
| `namespace-env-mismatch` | The configured namespace and the base-URL host carry different environment tokens | Emit, `suppressed: true`, `confidence: low`, no citation |

## Grounding

- Confidential vs Public IAM clients — and with them "never ship a confidential
  secret in the client" — are grounded in the
  [access-control docs](https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authorization/manage-access-control-for-applications/).
  Cite that page for the client-kind claim. The internal AGS overview pin backs the
  narrower game-client / game-server / admin **role split**, not the client-kind
  distinction — do not cite it for the secret rule. The `ags` skill owns this rule in its security
  preflight reference (`ags/references/security/iam-authorization-preflight.md` —
  the caller/secret table: a game client uses a Public client and never stores a
  secret; a server uses a Confidential client) — reuse that reference instead of
  restating it; the finding's citation stays the access-control docs **only**, with
  neither the pin nor the `ags` reference in the citation set.
- The server-authoritative-statistics requirement for competitive/economy stats is
  grounded in the
  [server-authoritative statistics docs](https://docs.accelbyte.io/gaming-services/modules/online/statistics/implementing-server-authoritative-player-statistics/).
- The web-SDK PKCE guidance is grounded at the product level (Web SDK exists per
  the internal pin; PKCE is the documented web flow) but has no deep public URL in
  the corpus yet — only the general
  [authentication docs](https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/).
  That is a **grounding** question, not a confidence one
  ([grounding-rules.md](../grounding-rules.md)): settle it against the page at scan
  time. If the authentication page states the web-storage guidance, cite it and
  ship. If it does not, no public page backs the claim and
  `web-token-in-localstorage` is **suppressed**, naming the deep public page as what
  would settle it — the same
  disposition `namespace-env-mismatch` gets below, for the same reason. A live read
  is not on that list and never could be: this is a missing *page*, and a namespace
  read produces no page. Naming one as what would settle a grounding gap is the
  substitution [grounding-rules.md](../grounding-rules.md) exists to refuse.

  Confidence belongs to the static signal — a Web SDK write to `localStorage` is
  a direct string match — not to how good the citation turned out to be. That is
  why the row now carries a value for each disposition, `low` suppressed and
  `medium` live, rather than one value with a note attached. Re-deriving it is an
  edit to this row, made once and read by every run; a run that re-rates the
  number in front of it is the drift the column exists to stop.
- The namespace/environment discriminator has **no public page**, so
  `namespace-env-mismatch` is a **suppression**, not a low-confidence finding. Its
  only backing is an internal pin's "Environment URL discriminator" note plus the
  `ags` auth-failures playbook's account of the same failure mode
  (`ags/references/debug/auth-failures.md` — an `invalid_namespace` 401 from a dev
  build pointing at a prod namespace URL, and a wrong-client-kind token). Reason
  from both; neither is a citable target
  ([grounding-rules.md](../grounding-rules.md)). So report it `suppressed: true`,
  state what the mismatch looks like, and name what would settle it — a public page
  that states the namespace/environment discriminator. No live read can: both halves
  of the comparison are already in the repo, and what the session's token carries is
  a third value answering a different question (see Channel B). Ship it live only
  once a public page states the discriminator.

A studio's installed Unity how-to knowledge base corroborates the token-handling
practices at the client-method level — the session token is held by the SDK, never
stored by the game, and secrets do not belong in Cloud Save. Use it to raise
confidence, but **cite the module docs above**, not the knowledge base's own
`source_url` (those links may be stale). See
[grounding-sources.md](../grounding-sources.md).

## Channel B — what a live read settles

The client *kind* is the fact this detector most wants and cannot see statically, so
a config-aware run changes more here than anywhere else. It still changes only
`confidence` and membership, never grounding: a namespace is not a page the reader
of an exported Report can open ([grounding-rules.md](../grounding-rules.md)).

| Finding | What the live read looks at | Confirmed | Refuted |
|---|---|---|---|
| `confidential-secret-in-client` | the kind of an IAM client id sitting **beside** the secret in client config, where the signal has one | Confidential → stays **critical/high**, now stated by the namespace rather than inferred from where the value sits | **never by this read** — see below |
| `client-authoritative-stats` | each written stat code's server-authority setting (`Set By`) | `Set By: client` on a ranked or economy stat → **high** | the stat is server-set → the client write cannot land. **Drop** it, and mention that the write will fail at runtime |

A **Public** kind does not refute `confidential-secret-in-client`; it is *not
readable* on it, and the finding ships unchanged. Two reasons, and both hold on
their own. A Public client has no secret of its own, so a secret sitting next to
one is stale or belongs to another client — and a secret literal in a client build
is extractable either way, which is the premise the finding actually rests on
(*What not to flag*, below). Only one of the three signal shapes even exposes a
client id to read: a bare `ACCELBYTE_CLIENT_SECRET` or a secret literal in a build
has no adjacent client, so there is nothing for this read to look at. Say the kind
and keep the finding.

Two findings have **no channel-B row** at all. `web-token-in-localstorage`: a
namespace has no view of where a web client puts its tokens.
`namespace-env-mismatch`: its signal compares a namespace against a base URL, and
both values are already in the repo — a live read adds no term to that comparison.
What `get_token_info` returns is the namespace *the session authenticated to*,
which is a different question, and one the run puts to the developer rather than
scoring ([health-check.md](../../subskills/health-check.md), Stage 3). Both ship in
a config-aware run exactly as they ship in a code-only one — and for
`namespace-env-mismatch` that still means suppressed, for want of a public page.

A read that errors or that no operation exposes is **not readable** — the candidate
keeps its code-only disposition, and the run says the read was unavailable. In this
detector that direction matters more than elsewhere: `confidential-secret-in-client`
is the highest-severity finding the family ships, and downgrading it because a read
failed would silence a real leak on the strength of an outage.

## What not to flag

- A secret in a **server** target, a CI secret store, or a gitignored `.env` used
  only for local server tooling — that is where a confidential secret belongs.
  The finding is a confidential secret in a **client** build.
- A Public client id (not a secret) in client config — client ids are not secret.
- Client-authoritative writes on cosmetic or non-competitive stats — server
  authority matters where cheating pays; note it, do not raise it to high.
- Tokens held in memory or platform secure storage on web — the finding is
  `localStorage`/`sessionStorage`, not any token presence.
