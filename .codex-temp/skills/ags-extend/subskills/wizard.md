---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
- https://github.com/AccelByte
- https://github.com/AccelByte/accelbyte-api-proto
see-also:
- '[templates.md](../references/init/templates.md)'
- '[am-go.md](../references/patches/am-go.md)'
- '[nosql-go.md](../references/patches/nosql-go.md)'
- '[ts-go.md](../references/patches/ts-go.md)'
- '[events.md](../references/catalogs/events.md)'
- '[overridables.md](../references/catalogs/overridables.md)'
---

# AGS Extend Wizard

Scaffold a new Extend app: interview the developer on what they're building, clone the correct template, apply integration patches so the starting project has the right plumbing (database, messaging, task scheduler), then draft an `IMPLEMENTATION_PLAN.md` the developer reviews before any business logic is written.

**Scope boundary.** The wizard interviews, clones, patches, and plans. It does **not** write business logic, generate proto files, fill out handler bodies, or edit existing source files beyond what a listed patch step explicitly requires. Producing `IMPLEMENTATION_PLAN.md` (Step 7) is the furthest it goes — the developer (or a follow-up subskill) implements from there.

**No `extend-project.yaml`.** No AccelByte tool consumes such a file today. The wizard does not create one. The deliverable is the cloned template directory plus `IMPLEMENTATION_PLAN.md` at its root.

## Behavior Constraints

<grounding_rules>

- Read `references/init/templates.md` before cloning. Use repo names exactly as listed. Do not invent or normalize template names — if a combination isn't in that file, it doesn't exist yet.
- Read `references/patches/{slug}-{language}.md` before applying any integration patch. Follow only the Steps listed in that file. Do not improvise extra steps, reorder them, or skip "Verify" blocks.
- **Never invent proto schemas.** Do not infer field names, field numbers, or types for any AGS event payload, override request/response, or AGS API message. The authoritative source is `github.com/AccelByte/accelbyte-api-proto`.
- **The Event Handler template ships with exactly one example proto** (currently `pkg/proto/accelbyte-asyncapi/iam/account/v1/account.proto`). Real handlers almost always target a *different* event. When the chosen event isn't already in the cloned template's `pkg/proto/` tree, the user must fetch the matching `.proto` from `github.com/AccelByte/accelbyte-api-proto` and place it under `pkg/proto/` before any handler code is written. Surface this as an explicit open prerequisite in `IMPLEMENTATION_PLAN.md` — list the exact event name, the expected proto path inside `accelbyte-api-proto`, and the destination path inside the template.
- Do not write or generate proto files from this subskill. `make proto` (run by `/ags-extend proto`) is the only sanctioned regen path, and it operates on `.proto` files that are already on disk.
- Read `references/init/resource-defaults.md` only if the user asks about CPU / memory / replica sizing during the plan-drafting step. Do not write resource numbers into a manifest — there is no manifest to write.

Patch-slug / pattern compatibility:

| Integration | Slug | Compatible patterns | Not available for |
|---|---|---|---|
| Async Messaging — consumer (receive) | `am` | Event Handler | Override, Service Extension |
| Async Messaging — publisher (send) | `am-pub` | Service Extension | Override, Event Handler |
| NoSQL Database | `nosql` | Service Extension | Override, Event Handler |
| SQL Database | `sql` | Service Extension | Override, Event Handler |
| Key-Value Store | `kvs` | Override, Event Handler, Service Extension | — _(coming soon — no patch files exist yet; offer will fail if selected)_ |
| Task Scheduler | `ts` | Service Extension | Override, Event Handler |

Never offer an integration whose slug isn't compatible with the chosen pattern. Never offer a `{slug}-{language}` patch that doesn't exist on disk — check `references/patches/` first.

**NoSQL + Override / Event Handler note:** The `nosql-go` patch targets the Service Extension template only — it replaces a CloudSave storage layer that does not exist in Override or Event Handler templates. Applying it to those patterns would fail or corrupt the project. If a developer on those patterns asks for NoSQL, tell them no patch exists for their pattern, describe what they'd need to wire manually (MongoDB driver + storage layer + connection in main.go + docker-compose service), and point them to `references/patches/nosql-go.md` as a reference for what the wiring looks like in Go.

</grounding_rules>

<tool_usage_rules>

- Use `Bash` for `git clone` and any shell steps inside patch files.
- Use `Read` to load the templates reference, patch files, and anything the patch instructs you to read first.
- Use `Edit` and `Write` for file modifications — always read a file before editing it. Never overwrite a file you haven't read.
- Use `Glob` to locate files inside the cloned template when a patch step references a path that isn't exact.
- Never run `git clone` without the user's explicit confirmation in Step 2.
- Never apply a patch without listing its scope and getting confirmation in Step 4.
- Never modify files outside the new app directory (e.g. don't touch the user's home directory, global git config, or unrelated repos).

</tool_usage_rules>

<action_safety>

Cloning writes a new directory; patches modify its contents. Confirm scope before each destructive step:

- Before cloning: show the repo URL and the target directory, ask yes/no.
- Before each patch: show what the patch adds (the "What This Patch Adds" section from the patch file), ask yes/no.
- If the target directory already exists: stop and ask whether to use a different name or overwrite (overwrite requires a second explicit confirmation).
- If a patch's Verify step fails: stop and surface the raw error. Do not continue to the next patch until the user decides.

</action_safety>

<output_contract>

Output is a sequence of checkpoints. Each checkpoint is one screen-worth of text: what was done, what's next, what the user must confirm.

After cloning: report the clone outcome and the resulting directory tree one level deep.

After each patch: report the patch name, the files touched, and the result of the Verify step.

After drafting the implementation plan (Step 5): print the plan inline so the user can review it before approving.

At the end (Step 7, after the user approves): report `Done.`, the path to `IMPLEMENTATION_PLAN.md`, and the next suggested invocations (`/ags-extend install-dep`, `/ags-extend install-cli`).

</output_contract>

## Workflow

### Step 1 — Interview

Ask the developer what they're building and extract three fields:

| Field | Acceptable values |
|---|---|
| **Pattern** | Override / Event Handler / Service Extension |
| **Language** | Go / Python / Java / C# |
| **App name** | kebab-case string (becomes the directory name) |

If the pattern is ambiguous — the user said "react to" but also mentioned "block the AGS call," or described a feature AGS might already cover — ask **one** clarifying question. See `subskills/ask.md#ambiguity-resolution` for the decisive questions to use. Do not ask more than one.

If the user didn't give an app name, pick a descriptive kebab-case default (e.g. `matchmaking-override`, `match-event-handler`, `leaderboard-extension`) and ask them to confirm or replace it.

### Step 2 — Confirm the clone

Read `references/init/templates.md`. Map the pattern + language to a template repo. Show the plan:

```
Will clone:
  https://github.com/AccelByte/{template-repo}
  → ./{app-name}/

Continue? (yes/no)
```

If the user confirms, proceed. If they edit the app name at this point, regenerate the plan and re-confirm.

If the pattern+language combination isn't in `references/init/templates.md`, say so and ask whether to pick a different language (show which languages exist for that pattern) — do not invent a repo URL.

### Step 3 — Clone

```bash
git clone https://github.com/AccelByte/{template-repo} {app-name}
```

On success, list the top-level of the cloned directory so the user sees what's there. On failure, see **Error Handling** below.

### Step 4 — Integrations

Ask what integrations this app needs. Show only the options compatible with the pattern (see table under `grounding_rules`). Use this phrasing:

```
Does {app-name} need any of these integrations?

{For Event Handler:}
  • Async Messaging (consumer) — receive pub/sub events via onMessage
  • SQL Database — PostgreSQL
  • Key-Value Store — Redis _(coming soon — no patch available yet)_

{For Service Extension:}
  • Async Messaging (publisher) — push events to a topic
  • NoSQL Database — MongoDB / DocumentDB
  • SQL Database — PostgreSQL
  • Key-Value Store — Redis _(coming soon — no patch available yet)_
  • Task Scheduler — scheduled background jobs

{For Override:}
  • NoSQL Database — MongoDB / DocumentDB
  • SQL Database — PostgreSQL
  • Key-Value Store — Redis _(coming soon — no patch available yet)_ _(coming soon — no patch available yet)_

Reply with the ones you want, or "none".
```

If the user says "none," skip to Step 5.

For each selected integration:

1. Map the name to a slug (table in `grounding_rules`).
2. Verify `references/patches/{slug}-{language}.md` exists. If it doesn't, tell the user that combination isn't supported yet and ask whether to skip it (continue with the others) or change language (re-run from Step 1). Do not fabricate patch content.
3. Read the patch file.
4. Show the "What This Patch Adds" section and the list of files it will create or modify. Ask for confirmation.
5. On confirmation, execute each **Step** in the patch file in order. Use `Read`/`Edit`/`Write` for file changes and `Bash` for shell commands exactly as written.
6. Run every **Verify** check listed in the patch file. Report results.
7. If a Verify check fails, stop and ask whether to continue anyway (user accepts the risk) or roll back (revert the file changes with `git checkout -- <files>` inside the app directory).

After all selected integrations are applied, summarize:

```
Integrations applied to {app-name}:
  ✓ nosql — MongoDB driver + storage layer + docker-compose service
  ✓ am — Kafka consumer wired into onMessage
  ✗ kvs — skipped (no patch file for python yet)
```

### Step 5 — Draft implementation plan

Before drafting, read the pattern-appropriate references:

- **Event Handler** → read `references/catalogs/events.md` (event name, proto provenance, idempotency requirements) and `references/cookbook/idempotency.md`
- **Override** → read `references/catalogs/overridables.md` (which override point, which AGS API surface it intercepts, where its proto lives)
- **Service Extension** → read `references/proto/conventions.md` and `references/proto/workflow.md` (you own the proto contract)

Then draft `IMPLEMENTATION_PLAN.md` as a markdown checklist covering:

1. **Target.** Which event / override point / API surface this app implements. Quote the exact identifier (event name, override interface name, RPC name).
2. **Proto provenance.** Exact source path inside `github.com/AccelByte/accelbyte-api-proto` for each proto the app depends on, and the destination path inside the cloned template. The Event Handler template ships with one example proto — for any other event, list it as a copy-from-api-proto prerequisite. Never infer the schema; if you can't name the file in `accelbyte-api-proto`, the plan blocks until the user can.
3. **Files to create.** New files the implementation will add (handler bodies, service impls, helper packages), with a one-line description of each.
4. **Files to modify.** Existing files the implementation will edit, with the specific edit (e.g. "register new handler in `main.go` line ~42").
5. **External AGS APIs called.** Each AGS service + endpoint + auth requirement (which OAuth permission strings the app's client will need).
6. **Open prerequisites.** A bullet list of everything that must be resolved *before* coding starts. Common entries: missing proto files to copy from `accelbyte-api-proto`, OAuth client to provision, namespace event subscription to register, env vars to obtain. Flag every prerequisite explicitly even if it feels obvious.
7. **Out of scope.** Anything the user mentioned that this app will *not* handle, so a follow-up isn't accidentally implied.

**Do not write any handler code, proto files, or implementation logic in this step.** This is a planning document. If a prerequisite cannot be answered from the available references, list it as a blocker rather than guessing.

### Step 6 — Revise until approved

Present the plan inline. Iterate on the user's feedback. Do not proceed to Step 7 until the user explicitly approves ("looks good", "approved", "yes, write it"). Treat silence or partial replies as not-yet-approved.

### Step 7 — Write plan and finish

Write the approved plan to `./{app-name}/IMPLEMENTATION_PLAN.md`.

Then emit:

```
Done. ./{app-name}/ is ready.

Next steps:
  • Open IMPLEMENTATION_PLAN.md — resolve any open prerequisites first
    (most commonly: copy the right .proto from github.com/AccelByte/accelbyte-api-proto
     into pkg/proto/, then run /ags-extend proto to regenerate)
  • /ags-extend install-dep — install project dependencies
  • /ags-extend install-cli — install extend-helper-cli (before deploying)
  • /ags-extend install-mcp — wire MCP servers into your AI IDE (optional)
  • /ags-extend debug — run and test it locally
```

If the wizard was invoked from inside `init`, skip the "Next steps" block — `init` will announce the next stage itself.

## Error Handling

| Situation | Response |
|---|---|
| Pattern is ambiguous after first clarifying question | Recommend the more common fit for the described scenario, note the assumption, and let the user reject. |
| `git clone` fails with "authentication required" | Say the template repos are public — likely a local git config forcing SSH. Suggest `git config --global --unset url.ssh://git@github.com.insteadOf https://github.com` or using the HTTPS URL directly. |
| `git clone` fails with "repository not found" | Show the URL you tried. Ask the user to verify at `https://github.com/AccelByte` — template naming may have changed; update `references/init/templates.md` if so. |
| `git clone` fails with "destination already exists" | Ask whether to pick a different name or delete the existing directory first. Require a second explicit yes for delete. |
| Clone succeeded but the directory is empty or missing `Dockerfile` | The template may have moved its canonical branch. Check for `main` vs `master`, and look for subdirectory templates. |
| Patch file not found for `{slug}-{language}` | Tell the user that combination isn't supported yet. Offer: (a) skip this integration, (b) apply equivalent patches in another language, or (c) stop and raise it with AccelByte. |
| Patch Step fails partway | Show the failing step, the raw error, and the files modified so far. Ask whether to roll back (git checkout) or continue manually. |
| Patch Verify step fails | Show the verify command and its output. Common causes: proto not regenerated, missing dependency (suggest `install-dep`), leftover CloudSave imports (show `grep` command to find them). |
| User requests an integration not listed for their pattern | Explain the compatibility constraint (e.g. "Task Scheduler is Service Extension only because it needs the sidecar model"). Suggest the pattern that supports it, or a workaround (e.g. for "scheduled work in an Event Handler," use an external scheduler that publishes a message). |
| User asks for an unsupported language | Show which languages exist for that pattern from `references/init/templates.md`. Do not clone a template with the "wrong" language extension. |

## Examples

### Straight path (Go service extension with NoSQL)

```
User: /ags-extend wizard

Skill: What do you want to build?

User: A custom guild system — new API endpoints. Go.

Skill: That's a Service Extension. Default name "guild-extension" okay,
       or pick your own?

User: guild-service

Skill: Will clone:
         https://github.com/AccelByte/extend-service-extension-go
         → ./guild-service/
       Continue? (yes/no)

User: yes

Skill: [clones]
       ✓ Cloned into guild-service/
         Dockerfile, main.go, go.mod, pkg/, proto/, README.md, .env.template

       Does guild-service need any of these integrations?
         • Async Messaging (publisher)
         • NoSQL Database
         • SQL Database
         • Key-Value Store
         • Task Scheduler
       Reply with the ones you want, or "none".

User: NoSQL

Skill: Reading references/patches/nosql-go.md.

       Will apply "nosql-go" patch. It adds:
         - go.mongodb.org/mongo-driver/v2
         - pkg/storage/storage.go (MongoDB-backed)
         - main.go connection + pool setup, defer Close
         - .env.template DOCDB_* vars
         - docker-compose.yaml mongodb service

       Continue? (yes/no)

User: yes

Skill: [applies steps]
       ✓ Added driver dep
       ✓ Rewrote pkg/storage/storage.go
       ✓ Updated main.go connection block
       ✓ Appended DOCDB_* to .env.template
       ✓ Added mongodb service to docker-compose.yaml
       ✓ Verify: go build ./... passes

       Now drafting the implementation plan.

Skill: [reads references/proto/conventions.md and workflow.md since this is
       a Service Extension — the developer owns the proto contract]

       --- Draft IMPLEMENTATION_PLAN.md ---

       # guild-service — Implementation Plan

       ## Target
       New Service Extension exposing a guild management API. RPCs:
       CreateGuild, GetGuild, ListGuildMembers, JoinGuild, LeaveGuild.

       ## Proto provenance
       - `pkg/proto/guild/v1/guild.proto` — owned by this project; will be
         authored as part of implementation. Must follow conventions in
         `references/proto/conventions.md`.
       - No AGS-emitted protos consumed (this Service Extension does not
         react to events; it serves its own API).

       ## Files to create
       - `pkg/proto/guild/v1/guild.proto` — RPC contract.
       - `pkg/service/guild/service.go` — RPC implementation.
       - `pkg/service/guild/service_test.go` — table tests.

       ## Files to modify
       - `main.go` — register GuildService with the gRPC server (line ~62).
       - `Makefile` — confirm `proto` target picks up the new proto path
         (it should — `proto.sh` walks `pkg/proto/` recursively).

       ## External AGS APIs called
       - IAM `/iam/v3/oauth/userinfo` — confirm caller identity for
         JoinGuild / LeaveGuild. Permission: NAMESPACE:USER:* [READ].

       ## Open prerequisites
       - [ ] OAuth client provisioned in target namespace with the
             permission listed above.
       - [ ] Decide guild schema (member roles, max members) before
             writing the proto — surface to product owner if unclear.

       ## Out of scope
       - Cross-guild federation. Single-namespace only for v1.
       - Guild chat — would be a separate Async Messaging integration.

       --- end draft ---

       Anything to revise before I write this to disk?

User: looks good

Skill: Wrote ./guild-service/IMPLEMENTATION_PLAN.md.

       Done. ./guild-service/ is ready.

       Next steps:
         • Open IMPLEMENTATION_PLAN.md — resolve the OAuth client and
           guild-schema prerequisites first
         • /ags-extend install-dep
         • /ags-extend install-cli
         • /ags-extend debug
```

### Event Handler — proto must be fetched from accelbyte-api-proto

```
User: /ags-extend wizard — I want to grant a one-time bonus when a player
      logs in for the first time. Go.

Skill: That's an Event Handler (you're reacting to login events; AGS doesn't
       need to wait). Default name "first-login-bonus" okay?

User: yes

Skill: Will clone:
         https://github.com/AccelByte/extend-event-handler-go
         → ./first-login-bonus/
       Continue? (yes/no)

User: yes

Skill: [clones]
       ✓ Cloned. Top-level: Dockerfile, Makefile, main.go, pkg/, proto.sh,
         docker-compose.yaml, .devcontainer/, .env.template, README.md.

       Does first-login-bonus need any of these integrations?
         • Async Messaging (consumer)
         • SQL Database / Key-Value Store / NoSQL Database
       Reply with the ones you want, or "none".

User: none — built-in onMessage is fine

Skill: OK, no patches. Now drafting the implementation plan.

       Reading references/catalogs/events.md and references/cookbook/idempotency.md.

       --- Draft IMPLEMENTATION_PLAN.md ---

       # first-login-bonus — Implementation Plan

       ## Target
       Event: IAM `userLoggedIn` (need to confirm exact event name in
       accelbyte-api-proto). Handler grants a one-time entitlement on
       the *first* login per user.

       ## Proto provenance
       - The template ships only `pkg/proto/accelbyte-asyncapi/iam/account/v1/account.proto`.
         That's the IAM account event proto, which may be the right one,
         but the exact event name and field shape MUST be confirmed in
         `github.com/AccelByte/accelbyte-api-proto` before coding.
       - If a separate userLoggedIn proto exists in accelbyte-api-proto,
         copy `asyncapi/accelbyte/{path}` from the repo into
         `pkg/proto/accelbyte-asyncapi/{path}` in this template
         (strip the repo's `asyncapi/accelbyte/` prefix; use
         `accelbyte-asyncapi/` as the target prefix so `make proto` finds it),
         then run `/ags-extend proto` to regenerate.

       ## Files to create
       - `pkg/handler/first_login.go` — handler logic with idempotency
         check (record granted-user IDs to avoid double-grant on retry).

       ## Files to modify
       - `main.go` — wire the new handler into the event dispatcher
         (location depends on the template's main.go shape — read it
         during implementation).

       ## External AGS APIs called
       - Entitlement service — `POST /platform/v1/admin/namespaces/.../users/.../entitlements`.
         Permission: NAMESPACE:{namespace}:USER:*:ENTITLEMENT [CREATE].

       ## Open prerequisites
       - [ ] **Confirm event name in accelbyte-api-proto.** Most likely
             under accelbyte-asyncapi/iam/account/v1/account.proto.
             Resolve before any handler code is written.
       - [ ] Register the event subscription in the target namespace
             via Admin Portal → Events.
       - [ ] OAuth client provisioned with ENTITLEMENT [CREATE] permission.
       - [ ] Pick storage for the dedup-set (KVS / SQL / NoSQL). NOT
             chosen at scaffold time → may need a follow-up wizard run
             to apply an integration patch.

       ## Out of scope
       - Bonus tier escalation (returning players). v1 grants exactly
         once per user, no progression.

       --- end draft ---

       Two important blockers in the plan — please confirm the event proto
       in accelbyte-api-proto before I write this to disk, or I can write
       it now and you resolve before coding. Which do you prefer?

User: write it now, I'll confirm the proto

Skill: Wrote ./first-login-bonus/IMPLEMENTATION_PLAN.md.

       Done. ./first-login-bonus/ is ready.

       Next steps:
         • Open IMPLEMENTATION_PLAN.md — resolve the two blocked
           prerequisites first (event proto + OAuth client)
         • Once the proto is copied into pkg/proto/, run /ags-extend proto
         • /ags-extend install-dep
         • /ags-extend install-cli
         • /ags-extend debug
```

### Ambiguous pattern, clarified

```
User: /ags-extend wizard — I want something that gives players bonus XP
      when they finish a match

Skill: Does AGS need to wait for the bonus XP logic to finish before the
       match result returns to players? (yes → Override, no → Event Handler)

User: no, it can happen after

Skill: Event Handler, then. Language?

User: Python

Skill: Default name "xp-bonus-handler" okay?

User: sure

Skill: Will clone:
         https://github.com/AccelByte/extend-event-handler-python
         → ./xp-bonus-handler/
       Continue? (yes/no)
```

### Requested integration not available for pattern

```
User: wizard, override in Go, and I want a task scheduler

Skill: Task Scheduler is Service Extension only — it needs the sidecar
       model that Overrides don't run with. Options:
         1. Build this as a Service Extension instead (exposes a new API).
         2. Keep the Override and trigger scheduled work from an external
            system that calls into AGS.
         3. Pair an Override with a separate Service Extension that owns
            the scheduled tasks (two apps in one project).

User: option 3

Skill: OK. We'll scaffold the Override first. I'll note to run the wizard
       again for the Service Extension once this is done.
```

### Patch not available for language

```
User: wizard, service extension, Java, with key-value store

Skill: Will clone:
         https://github.com/AccelByte/extend-service-extension-java
         → ./{app-name}/
       Continue? (yes/no)

User: yes

Skill: [clones]

       You asked for Key-Value Store. I don't have a kvs-java patch on disk
       yet — that combination isn't scaffolded by this skill today. Options:
         1. Skip kvs for now; add it by hand later using the AccelByte docs.
         2. Pick a language with a kvs patch (Go).
         3. Stop and surface the gap to AccelByte.

User: skip

Skill: OK, continuing without kvs.
```

### Clone fails — directory exists

```
Skill: [runs clone]
       error: destination path 'leaderboard-ext' already exists and is not
       an empty directory

       ./leaderboard-ext/ already exists. Options:
         1. Pick a different app name (I'll redo the clone plan).
         2. Delete ./leaderboard-ext/ and re-clone — destructive.

User: 2

Skill: Confirm: delete ./leaderboard-ext/ including any local changes?
       (yes/no — I'll stop if you're not sure)
```
