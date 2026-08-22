---
name: teammate-nudge-library
description: 'The closed set of rules a proactive nudge may be drawn from — what each
  one fires on, what it says, and, for each rule that says something about AccelByte,
  the public page that backs it. A capability in the call-site index is a trigger
  and never a licence: it changes which rules are considered and never what one may
  assert, and the rule that offers to check the namespace offers and waits rather
  than reporting a config gap it has not read. Read with nudge-protocol.md, which
  decides whether a nudge fires at all.'
last-verified: 2026-08-15
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authorization/manage-access-control-for-applications/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/accounts/how-account-works/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/integrating-matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/configure-matchmaking-for-a-specific-region/
- https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/lobby-websocket-recovery/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-watchdog-protocol/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/integrate-dedicated-servers-with-the-sdk/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/peer-to-peer/
- https://docs.accelbyte.io/gaming-services/modules/online/statistics/
- https://docs.accelbyte.io/gaming-services/modules/online/statistics/implementing-server-authoritative-player-statistics/
- https://docs.accelbyte.io/gaming-services/modules/online/wallets-payments/sales/
- https://docs.accelbyte.io/gaming-services/modules/ais/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/local-debugging/
see-also:
- '[nudge-protocol.md](nudge-protocol.md)'
- '[grounding-rules.md](grounding-rules.md)'
- '[memory-contract.md](memory-contract.md)'
- '[report-schema.md](report/report-schema.md)'
---

# Nudge library

Every nudge comes from a rule below. There is no rule for composing one — if
nothing here matches, nothing is said ([nudge-protocol.md](nudge-protocol.md)).

**This list is closed and hand-written**, and nothing here is discovered at run
time. Not because no index exists — one cited page does sit under a published
index — but because a nudge is a judgement about when to interrupt, which no
index supplies. So a session that matches no rule found *nothing among these*,
which is a narrower claim than *nothing*, and saying so is this file's job rather
than the run's.

Each rule that says something about AccelByte carries the public page that backs
it and the sentence on that page it rests on. That sentence is the boundary of
what the nudge may assert: say what the page says, and stop. Several
plausible-sounding reminders are absent from this file for exactly that reason —
the page did not state them
([What is deliberately not here](#what-is-deliberately-not-here)). A rule that
asserts nothing about AccelByte — that a tool is not installed, that a repository
changed since it was last scanned — owes no citation and says so in its own text
([nudge-protocol.md](nudge-protocol.md)).

## How to read a rule

- **Fires when** — the evidence that must already be in hand. Never a reason to
  go looking. If the response did not already establish it, the rule does not
  match.
- **The nudge** — the shape of what is said, not a script to paste. One or two
  sentences, phrased as an offer.
- **Backed by** — the page, and the sentence on it. Cite the page; never cite
  this file.
- Cooldown is the protocol default (7 days per topic) unless the rule names a
  **shorter** one. None may name a longer one
  ([nudge-protocol.md](nudge-protocol.md)).

## What a capability in the index adds, and what it does not

Some responses arrive holding a call-site index — the `surface` a health check
derived in Stage 2, or the one a stored report carried
([report-schema.md](report/report-schema.md) § Integration surface). It names
which AGS capabilities this commit calls, and where. Where the work just done
already had it in hand, a capability named in it is a reason to **consider** a
rule below whose subject is that capability.

**That is the whole of it: a trigger, and never a licence** (ADR-0024). Four
consequences, and each is a way this has been got wrong elsewhere:

- **It licenses no new claim.** The set below stays closed. A capability with no
  rule about it matches nothing, and writing one from the capability's name is
  the invention [nudge-protocol.md](nudge-protocol.md) forbids.
- **It moves no rule's grounding.** Grounded-or-suppressed is untouched — no
  openable public page, no rule, and so no nudge
  ([grounding-rules.md](grounding-rules.md)). So every reminder in
  [What is deliberately not here](#what-is-deliberately-not-here) stays there
  when the index names its capability: what those rows lack is a page, and an
  index is not one. The matchmaking and economy rows invite this most, because
  they are keyed to capabilities an index prints by name.
- **It raises nothing.** An index locates call sites and settles nothing else,
  so it moves no finding's confidence or severity, and it shortens no cooldown.
- **A triggered rule still has to match.** Its **Fires when** is unchanged, so a
  rule whose evidence is not in hand does not fire because the index named its
  capability. The index decides what is considered; the rule decides what is
  said.

It is also not a reason to look. The index counts here only where the work just
done already had it in hand — deriving one, or reading a stored one, to find
something to say is the scan this surface never makes
([nudge-protocol.md](nudge-protocol.md)).

## Identity and access

### `client-secret-in-shipped-client`

**Fires when** a client secret sits in something that ships to players — a game
client's config, a committed `.env`, an engine `.ini`, a client-side constant.

**The nudge** Anyone with the build has that secret. AccelByte's guidance is that
clients used by game clients be Public in most cases. Worth rotating it and
moving whatever needs the confidential client behind a server you control.

**Backed by** [Manage access control for applications](https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authorization/manage-access-control-for-applications/)
— "configure IAM clients for game clients as Public in most cases".

### `headless-account-orphaned`

**Fires when** the integration can take a link away — an unlink call, or account
linking a player can undo — and no promote-to-full-account path appears anywhere
in it. Creating headless accounts is not on its own a trigger; it is the
documented ordinary path.

**The nudge** Unlink the last third-party identity on a headless account and
nobody can sign into it again. Promoting to a full account beforehand is what
prevents that, so it is worth having before linking ships.

**Backed by** [How account works](https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/accounts/how-account-works/)
— "there is no way for that player to authenticate and sign into the AGS account anymore, unless it links with another third-party platform account or the player promotes it to a full AGS account".

The trailing clause is why this rule is about the *last* link and about promotion
— an account with another identity still linked is not orphaned.

### `third-party-login-needs-idp-config`

**Fires when** a live read the session *already made* lists the namespace's
identity-provider configurations, and a provider the code signs players in with
is missing from that list. Never a reason to make that read.

**The nudge** Name the provider. Its sign-in path is in the code and it has no
configuration on the AGS side, so that login cannot succeed for anyone yet.

Third-party sign-in on its own is not a trigger. It is the documented ordinary
way to create an account here, so a rule that fires on the call sites alone fires
on every correct integration — nothing in the code can tell you whether the
backend half exists. Only the live comparison discriminates.

**Backed by** [How account works](https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/accounts/how-account-works/)
— "you need to create the necessary Identity Provider configurations".

## Multiplayer and realtime

### `match-found-over-lobby`

**Fires when** matchmaking call sites exist and nothing in the integration
subscribes to Lobby notifications.

**The nudge** Match results reach the client as Lobby notifications. Without
something subscribed to Lobby, tickets are created and nothing arrives to act
on.

**Backed by** [Integrating matchmaking](https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/integrating-matchmaking/)
— "the service will send the following notifications to the game client through AGS Lobby".

### `matchmaking-one-region-per-ticket`

**Fires when** the integration is trying to land players in one chosen region —
a hard-coded region, a region picker, a per-region queue — while still sending
every available latency on the ticket.

**The nudge** Sending all available latencies is the ordinary path and is fine.
It is only when you want a *specific* region out of matchmaking that the ticket
has to carry exactly that one latency. Worth checking which of the two you are
actually doing.

**Backed by** [Configure matchmaking for a specific region](https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/configure-matchmaking-for-a-specific-region/)
— "To get a specific region during matchmaking results, the game client can only send one region (latency) when creating a match ticket."

The condition at the front of that sentence is the whole rule. The same page
carries a section on filling a ticket with every available region, so a ticket
with several latencies is a documented default and never on its own a finding.

### `lobby-reconnect-handling`

**Fires when** there is a Lobby connect call and nothing anywhere near it handles
reconnection running out of time.

**The nudge** The SDK reconnects on its own, so the case left to you is the one
where it gives up. The page names both halves: what the player should see, and
the single error type a manual reconnect should be attempted on.

**Backed by** [Lobby websocket recovery](https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/lobby-websocket-recovery/)
— "When the lobby websocket reconnection reaches a timeout, the game must have some handling to ensure good experience for the player. The handling could be a notification popup, game level auto or manual connect, disable online feature, etc."
and "make sure to run the lobby connect only when the WebSocket error type is DisconnectFromExternalReconnect".

Both sentences are about the **timeout**, not about reconnection generally — the
same page describes the SDK's own reconnect strategy. A rule that tells a
developer to write their own reconnect loop is contradicting the page it cites.
The page is about Lobby and says nothing about Chat, so neither does this rule.

### `ams-drain-handler`

**Fires when** the repo carries AMS dedicated-server signals — a watchdog
connection, a server-ready call, AMS enabled in engine config — and no handler
for the drain signal.

**The nudge** Drain is how AMS asks for a node back, and a server that ignores it
is terminated on a timeout either way — so the choice is between finishing what
you are doing and exiting, or being killed part-way through it.

**Backed by** [AMS watchdog protocol](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-watchdog-protocol/)
— "would like to reclaim the node once existing game sessions hosted by the DSes on it have finished"
— and [Send drain signal to the server](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/integrate-dedicated-servers-with-the-sdk/#send-drain-signal-to-the-server)
— "Your dedicated server should respond to the drain signal by exiting cleanly as soon as it is not in session and has completed whatever work it needs to do."
— and [Listening to the drain signal](https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/integrate-dedicated-servers-with-the-sdk/#listening-to-the-drain-signal)
— "Unless the dedicated server is serving a game session, it will be set to the Draining state and be subject to the drain idle timeout; upon reaching the drain idle timeout, the watchdog will automatically terminate the dedicated server."
and "Dedicated servers in the In Session state will remain subject to the session timeout after being sent a drain signal"

Which timeout applies depends on state, and the rule must not name one: a server
not in a session runs down the **drain idle** timeout, while one in a session
stays under the **session** timeout. Both end in termination, which is why the
nudge asserts only that. Neither page talks about cost, so neither does this
rule.

### `p2p-needs-signaling`

**Fires when** the integration selects a peer-to-peer session type, or references
TURN/STUN, without any Lobby connection.

**The nudge** P2P here still handshakes through signaling that lives inside AGS
Lobby. Skipping Lobby means the peers never find each other.

**Backed by** [Peer-to-peer](https://docs.accelbyte.io/gaming-services/modules/multiplayer/peer-to-peer/)
— "a handshake will be performed via a Signaling Server implemented within AGS Lobby".

## Economy and progression

### `unpaid-order-expiry`

**Fires when** there is order or checkout code against the platform service and
no branch for an order that never becomes paid.

**The nudge** An unpaid order expires after ten minutes, so expiry is an outcome
the code has to have a branch for.

**Backed by** [Sales](https://docs.accelbyte.io/gaming-services/modules/online/wallets-payments/sales/)
— "Unpaid orders expire after 10 minutes".

### `client-authoritative-stats`

**Fires when** stat updates for competitive or ranked statistics are sent from
the game client.

**The nudge** Two separate things, and doing one is not doing the other. Writing
the stat from a server is the code path AccelByte offers for competitive play.
Setting the stat's **Set By** to `server` is the configuration that refuses a
client write — that is the one described as helping against cheating. Worth
checking you have both.

**Backed by** [Implementing server-authoritative player statistics](https://docs.accelbyte.io/gaming-services/modules/online/statistics/implementing-server-authoritative-player-statistics/)
— "Server authoritative statistics are suitable for multiplayer competitive gaming"
— and [Statistics](https://docs.accelbyte.io/gaming-services/modules/online/statistics/)
— "When it is set to server, additional server-side validation is enabled to prevent the statistic from getting updated directly from the game. This can help prevent cheating."

The anti-cheat sentence belongs to **Set By**, not to the SDK path — the
server-authoritative page never mentions cheating. Attaching it to the code path
alone tells a developer to move their writes and leave the setting at client,
which is the half that was actually holding the door open.

### `tied-stat-config`

**Fires when** a live read the session *already made* shows a stat configuration
in the TIED state, and the session is about to change or delete it. Never a
reason to make that read.

**The nudge** This configuration is tied to existing player data, so an edit here
reaches further than the config.

**Backed by** [Statistics](https://docs.accelbyte.io/gaming-services/modules/online/statistics/)
— "configuration carries significant risks, as it directly impacts user statistics".

## Backend hygiene

### `extend-env-committed`

**Fires when** the repo holds an Extend app — a `Makefile` beside a `Dockerfile`
and a dependency manifest — and its `.env` is tracked, or is missing from
`.gitignore`.

**The nudge** That file holds credentials, and it is in the repo. AccelByte's own
guidance is to keep it out and commit a template beside it instead, so the
variable names travel and the values do not.

**Backed by** [Local debugging](https://docs.accelbyte.io/gaming-services/modules/foundations/extend/local-debugging/)
— "Never commit your .env file. It contains credentials. Confirm it is listed in .gitignore. Do commit changes to .env.template so teammates know what variables are needed."

Scope this to source control, which is what the page speaks to. Whether a secret
also reaches a container image is a different claim on a different page, and this
rule does not make it.

## Modules and tooling

### `ais-existing-customers-only`

**Fires when** the repo calls AIS and the integration looks new — recent first
commit, or AIS added in the work just done.

**The nudge** AIS is closed to new customers. Worth confirming your studio is
already one before building further on it.

The page says *customers*, not namespaces, so this rule says nothing about which
namespaces an existing customer can use it in.

**Backed by** [AccelByte Intelligent Services](https://docs.accelbyte.io/gaming-services/modules/ais/)
— "AIS is only available to existing customers and is not offered to new customers".

### `ags-tooling-missing`

**Fires when** the work just done already established that this repo integrates
AGS, and this session has no AGS API tools.

Both halves arrive without looking for them, and on more than one route. The
repo half comes from work that could not have happened without it — a health
check's call-site map, or an `upgrade-check`, which resolves the project's own
SDK call sites at two versions and cannot do that without finding them first.
The tooling half is the set of tools this session was started with: a session
knows what it is holding, so there is nothing to probe.

**The nudge** Offer to connect it, and name what it unlocks — a live read of the
namespace, and with it the config-aware half of a health check.

**The `ags` CLI is not part of the trigger, and the rule must not assert it is
missing.** Nothing this family does establishes whether it is installed, and
running a probe to find out is exactly the scan the protocol forbids
([nudge-protocol.md](nudge-protocol.md)). Offering it alongside the connection is
fine — *this is also where the CLI gets set up* — because an offer claims
nothing about the machine.

**No citation, and none is owed**: the claim is about this machine's setup, not
about AccelByte.

### `engine-mcp-missing`

**Fires when** the work just done already named the project's engine — Unity or
Unreal — and this session holds none of that engine's MCP tools.

Same two free halves as the rule above. The engine comes from work that had to
know it: a health check's call-site map, or an `upgrade-check`, which reads a
Unity package manifest or an in-tree Unreal plugin copy and so cannot get as far
as a diff without settling the question.

**The nudge** Name the one server for that engine and what it gives you, and do
not run the two together — they are different kinds of thing. **Unreal:** an
index of SDK symbols, code snippets, and ready-made Slate panels for login,
achievements and matchmaking. **Unity:** a curated how-to knowledge base and a
ByteWars example index, plus project style, AGS kit and spec drift, and
generation of typed TMP/uGUI screens. A Unity *symbol* index is something that
server is structured for and does not have, so never offer one.

**What its absence cost differs by engine, and the two must not be run together
either.** On **Unreal**, nothing: this skill never calls that server, so the
answer just given was no weaker for it. On **Unity**, a little: the how-to
knowledge base is what `incomplete-integrations` uses to raise confidence that
companion wiring is genuinely missing, so without it those findings stand on the
module docs alone. Say the one that applies, and never the other.

**One engine, one server, never the pair.** A Unity project has no use for the
Unreal index. A repo the work could not place on one engine matches nothing here
rather than offering both and letting the developer sort it out.

**No citation, and none is owed**: the claim is about this machine's setup.

### `ags-skill-missing`

**Fires when** the work just done reached for a reference in the `ags` skill and
that skill is not installed beside this one.

Not a probe either, and not a guess: two things this family does read it where it
is there and carry on where it is not. Engine and SDK detection borrows its
`install-sdk` globs rather than restating them, and every detector defers to its
module references before deciding a borderline finding is real. A stage that fell
back to the public docs alone has already established this trigger, in the course
of doing its own job.

**The nudge** Say what the fallback cost, and say both halves of it, because it
is not one thing. On **citations** it cost nothing: the playbooks are the floor,
they carry their own public pages, and what a finding cites is that page whether
or not the other skill is there. On **detection** there is a real difference —
engine and SDK detection borrows that skill's globs, so this run looked with what
this skill knows alone. Then offer to install it.

**Neither half on its own is the honest answer.** Citations-only reads as no
difference at all; detection-only reads as a degraded scan. Say the pair.

**No citation, and none is owed**: the claim is about what is installed here.

### `repo-changed-since-last-scan`

**Fires when** memory holds a health-check report for this repo and the repo has
moved on since — a different commit, or uncommitted work the report did not see.

**The nudge** Say how old the report is and offer a rescan.

**No citation, and none is owed**: the claim is about this repo.

### `colleague-activity`

**Fires when** the once-per-session activity read came back with an entry
somebody else wrote, inside the window.

**There is no repo test to make here, and the rule must not reach for one.** The
eleven fields an activity entry carries are `schema_version`, `actor`,
`actor_source`, `persona`, `subskill`, `action`, `namespace`, a redacted `target`
and `summary`, an optional `severity`, and `ts`
([report-schema.md](report/report-schema.md)) — and no repository field among
them. Relevance is bounded twice before the entry arrives: the read returns only
what the caller's own grant covers, which is their studio and no further, and the
`namespace` says which environment the run was about. Weigh that, then the
`target` and `summary` in the words the run that wrote them used.

**A `namespace` of `unknown` still fires.** It is the ordinary value, not an edge
case — every code-only run writes it, because it read no environment. What it
must not do is *match*: pairing it with a real namespace asserts a connection
neither run made, and a session holding no namespace of its own has nothing to
pair it with either. So an `unknown` entry is weighed on its `target` and
`summary` alone, and the nudge says what the entry says without placing it in an
environment.

**The nudge** Say who did what and when, in one sentence, and offer to look. Only
what the entry itself says — never an inference about what they meant or found.

**Writes no cooldown record.** The cooldown is per namespace rather than per
person, so a record here would silence one colleague's news for the whole team
after a single teammate saw it. The fourteen-day window and the once-per-session
limit are what bound this rule ([nudge-protocol.md](nudge-protocol.md)).

**No citation, and none is owed**: the claim is a quotation of a record whose
identity the server verified.

### `namespace-check-offer`

**Fires when** four things are already true and none of them was gone looking
for: the work just done had this project's call-site index in hand; a capability
in it is the subject of a rule above that cannot fire without a live read of the
namespace — `third-party-login-needs-idp-config`, `tied-stat-config`, and no
other rule; this session holds AGS API tools; and that read was not made.

**The nudge** Name the capability and where the code called it at the commit the
index names, say that the namespace side of it has not been read, then offer the
read and wait for an answer. Where the index came from a stored report and `HEAD`
has moved off that commit, or there are uncommitted edits under you, say so in
the same breath — the location is a true statement about that commit and about
no other tree.

**Offer and wait, exactly as [`ask`](../subskills/ask.md)'s *Still deciding* row
does: a hand-off starts the read, and that is not what was asked for.** A yes
goes to a config-aware [`health-check`](../subskills/health-check.md), whose
Stage 3 makes the read and files what it found as a cited finding. A nudge is
not where that answer arrives.

**It never reports a config gap it has not read.** This is the channel A →
channel B escalation: a call site is what the code says, and only a read of the
namespace says what the namespace holds. So the nudge carries the capability and
the offer and nothing about how the namespace is set up — the two rules that do
assert a live gap fire on a read the session already made, and this rule is what
stands where they cannot.

**Where this session holds no AGS API tools it does not match**, and
`ags-tooling-missing` is that session's rule instead — one nudge per session, so
the two are never both composed.

**Bounded like every other rule.** The four-condition gate, the once-per-session
limit and the cooldown at the protocol default all apply to it unchanged
([nudge-protocol.md](nudge-protocol.md)); the cooldown record is scoped to the
repository, because the subject is this project's integration.

**No citation, and none is owed**: the claim is about this project's own code at
a named commit, not about AccelByte. Where the index came from a stored report,
what the nudge names is that record's statement about that commit — which is why
the commit rides with it, and why anything said about the tree in front of the
developer would need the call site opened and read (ADR-0010, ADR-0024).

## What is deliberately not here

These were written, checked against the page that was supposed to back them, and
dropped. They are listed so the same reminder is not re-added from memory as if
it were new — and so that anyone who finds the page that does state one can put
the rule back with it.

Not every row here is unbacked. Some are *right in substance and wrong as
worded*, and the reason column says which — those are the dangerous ones, because
the version a reader half-remembers is the one that fails.

And some are not about a page at all. A reminder can be perfectly true and still
belong here because **no evidence a nudge is allowed to have would establish it**,
or because its trigger tells no install from another — it would fire on nearly
every one, which is noise however true it is. Those rows say which, and none of
them is waiting on a citation.

| Reminder | Why it is not a rule |
|---|---|
| A *numeric* Lobby close code — 4042 — to reconnect on | The recovery page names no numeric close code at all. It does name a symbolic one and says to reconnect on exactly it, so the reminder is right and the number is invented; `lobby-reconnect-handling` carries the symbolic version. |
| Re-bind the token after a refresh, on Lobby | Not stated on the recovery page. |
| An empty QoS latency map breaks region routing | The region page treats latency as optional and describes it being filled in for you. |
| App Store policy requires Sign in with Apple alongside other social logins | This is Apple's policy, and AccelByte's pages do not state it. It is not ours to assert. |
| AIS is deprecated; move to Game Telemetry | The page says closed to new customers, which is not deprecation. It does point readers on for analytics needs, but the link goes back inside AIS's own pages, so it names no product to move to and certainly not that one. |
| Crossplay is linking, not merging — there is no account merge | The account page never makes that contrast; only the orphaning consequence is stated, and `headless-account-orphaned` carries it. |
| A dev token against a prod namespace fails silently | No page states the failure mode. |
| Leaderboards cannot take direct score posts | Not found stated. |
| Per-stat update loops are a top source of API volume | Not found stated. |
| A `400 invalid_request` on third-party login means the provider is not enabled server-side | No page ties that response to that cause. `third-party-login-needs-idp-config` keeps the configuration half and drops the diagnosis. |
| Never `COPY .env` into an Extend container image | The Extend pages state this for source control, not for images. `extend-env-committed` carries the part that is stated. |
| Scope an Extend IAM client least-privilege — no wildcard or ADMIN | Not found stated on any Extend page. |
| A match ticket always carries one region | The sentence that says so opens with "To get a specific region", and the same page has a section on sending every available region. `matchmaking-one-region-per-ticket` keeps the condition. |
| The game must write its own Lobby reconnect loop | The recovery page describes the SDK's own reconnect strategy. Only the reconnection *timeout* is handed to the game, and `lobby-reconnect-handling` is scoped to that. |
| A drained node you keep holding costs you money | Neither AMS page mentions cost or billing, and the watchdog terminates the server itself on a timeout. |
| AIS availability is decided per namespace | The AIS page speaks of customers and never uses the word namespace. |
| A drained server is terminated at the drain idle timeout | True only when it is not serving a session; one that is stays under the *session* timeout. `ams-drain-handler` names neither and asserts only that both end in termination. |
| The Lobby reconnect guidance covers Chat as well | The recovery page is about Lobby and never mentions Chat. |
| Third-party sign-in call sites alone mean the provider is unconfigured | The code cannot see the backend half, so that trigger fires on every correct integration. `third-party-login-needs-idp-config` fires on a live comparison instead. |
| The `ags` CLI is not installed | Nothing this family does establishes it, and a PATH probe run to find something to say is the scan the protocol forbids. `ags-tooling-missing` keeps the half that arrives free and offers the CLI without claiming anything about it. |
| The memory server is not installed | Absence is the ordinary case, and the protocol's own instruction on an absent memory server is to bind "no colleague nudges" and say nothing to the user ([nudge-protocol.md](nudge-protocol.md)). A rule advertising it would fire on nearly every install, which is the definition of noise. |

A reminder here is not wrong because it is here. What each row lacks is stated in
its own reason: for most, a page that says it; for a few, a wording that survives
the page saying something narrower; and for the rest, evidence this family is
allowed to have, or a trigger that discriminates at all.
