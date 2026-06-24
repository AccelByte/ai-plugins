---
name: ags-doctor
description: Read-only symptom → cause diagnosis. Use when something is off but the
  user can't pin it down concretely. Walks them from symptom to likely root cause
  via the diagnosis trees, then hands off to the subskill that owns the fix.
allowed-tools: Read Glob Bash
model: sonnet
last-verified: 2026-06-24
sources:
- https://docs.accelbyte.io/
see-also:
- '[auth-failures.md](../references/debug/auth-failures.md)'
- '[iam-authorization-preflight.md](../references/security/iam-authorization-preflight.md)'
- '[lobby-disconnects.md](../references/debug/lobby-disconnects.md)'
- '[matchmaking-timeouts.md](../references/debug/matchmaking-timeouts.md)'
- '[cli-commands.md](../references/observe/cli-commands.md)'
- '[debug.md](debug.md)'
- '[manage-permissions.md](manage-permissions.md)'
- '[observe.md](observe.md)'
---

# AGS Doctor

Read-only symptom-to-cause walk. Differs from `subskills/debug.md` by being explicitly non-mutating: doctor diagnoses, then hands off to the subskill that owns the fix. Use when the user says something like "I don't know what's wrong" or "something feels off, help me narrow it down".

## Behavior Constraints

<grounding_rules>

Diagnosis trees trace to:

- `references/debug/auth-failures.md`
- `references/security/iam-authorization-preflight.md`
- `references/debug/lobby-disconnects.md`
- `references/debug/matchmaking-timeouts.md`

Don't fabricate causes. If the symptom doesn't fit a known signature, say so and point at observability (`subskills/observe.md`) or AccelByte support.

</grounding_rules>

<tool_usage_rules>

- `Read` references and config files.
- `Glob` to find logs / config.
- `Bash` for **read-only** queries - `git log`, log tailing, `ags auth status`, `ags doctor`, `ags describe`, and generated AGS CLI list / get / show commands. Never for `ags ... create`, `ags ... delete`, `ags ... update`, `ags ... kick`, or any mutation.
- Follow `references/observe/cli-commands.md#rules-of-engagement-for-llms` for AGS CLI discovery and JSON output.
- Don't read other subskills until you're handing off.

</tool_usage_rules>

<action_safety>

Doctor is read-only by contract. **No edits, no installs, no API mutations.** If a fix is needed, hand off:

- Auth fix → `/ags debug` (which is allowed to mutate).
- IAM client *permission* fix (add/update/delete a permission on an existing, correctly-typed client) → `/ags manage-permissions`.
- IAM client *kind* / new client / login-method fix → `/ags connect-portal`.
- SDK config fix → `/ags install-sdk` or `/ags integrate`.
- Observability lookup → `/ags observe`.
- AMS / Matchmaking / Extend / ADT operations → the matching peer skill.

</action_safety>

<output_contract>

End with a "diagnosis" block:

```
Diagnosis

  Symptom:        <restated>
  Likely cause:   <one-sentence summary>
  Confidence:     <high / medium / low>
  Evidence:       <list of what supports the diagnosis>
  Counter-evidence: <if any — say what doesn't fit>

Next step (which skill owns the fix):
  • <subskill / peer skill>
```

</output_contract>

<completeness_contract>

A diagnosis is complete when:

1. The symptom has been restated cleanly.
2. A likely cause has been named (or "couldn't narrow it down" is the honest answer).
3. Evidence is named, not just asserted.
4. The handoff is explicit: which subskill / peer skill / external action owns the fix.

</completeness_contract>

## Workflow

### Step 1: Restate the symptom

Echo back what the user described in clean form. Confirm with them.

### Step 2: Classify

Pick a starting reference based on the symptom:

| Symptom shape | Reference |
|---|---|
| Auth / login / token issues | `references/debug/auth-failures.md` |
| Permission errors, forbidden calls, or missing enriched fields such as display name | `references/security/iam-authorization-preflight.md` |
| Lobby drops / WebSocket issues | `references/debug/lobby-disconnects.md` |
| Matchmaking timeouts / no matches | `references/debug/matchmaking-timeouts.md` |
| Generic "something's wrong" | Walk the user through the symptom triage from the top |

### Step 3: Walk the diagnosis tree (read-only)

Apply the reference's tree to the symptom. Use read-only tools to gather evidence:

- Decode tokens.
- Tail logs.
- List IAM clients.
- Run read-only AGS CLI permission discovery for the generated service/resource/method when the current CLI exposes it.
- Check `.env` against expected values.
- Check engine version against SDK version compatibility.

For auth/login issues where the code compiles and the login call path exists, treat backend config as a first-class hypothesis before blaming client code. HTTP 400 `invalid_request` on login commonly means the attempted login method is not enabled/implemented, the IAM client is the wrong kind, or the namespace/client values point at the wrong backend.

For permission-shaped symptoms, run the authorization preflight in read-only mode. Classify caller type, token source, IAM client type, and the exact AGS call. For game server / backend / trusted tooling, a Public client is a wrong-client-kind diagnosis. For missing display name in leaderboard or other UI results, verify whether a separate profile/display-name lookup is needed and whether that lookup permission is present.

Use read-only AGS CLI discovery when available:

- `ags auth status --format json`
- `ags describe iam`
- `ags describe iam clients list`
- generated IAM client / login-method list or show commands with `--format json`

Don't apply fixes. Don't run mutating commands.

### Step 4: Print the diagnosis block

Per `output_contract`. Be honest about confidence.

### Step 5: Hand off

Name the subskill / peer skill that owns the fix:

| Cause | Hand off |
|---|---|
| Wrong IAM client kind | `/ags connect-portal` |
| Missing IAM client permission (client kind is correct) | `/ags manage-permissions` |
| Missing display-name/profile lookup permission | `/ags manage-permissions` |
| Login method disabled/missing/unimplemented (`400 invalid_request`) | `/ags connect-portal` |
| Namespace mismatch in `.env` | `/ags connect-portal` |
| SDK version drift | `/ags install-sdk` |
| Test-login broken from a code regression | `/ags debug` |
| Lobby timeouts likely OS-level | `/ags debug` |
| Match formation likely rule-set issue | `/ags matchmaking` |
| AMS fleet capacity issue | `/ags ams` |
| Suspected AGS incident | AccelByte support |
| Need more visibility before deciding | `/ags observe` |

## Examples

### Auth diagnosis

```
User: /ags doctor — auth keeps failing intermittently.

Skill: Restating: auth-related failures, intermittent.
       Walking the auth-failures diagnosis tree.

       Hypothesis 1 — token refresh races.
         Decoded a recent failing token:  exp claim 2 minutes in the past.
         Evidence:  Token expired before the call; SDK didn't refresh.

       Hypothesis 2 — namespace mismatch.
         Token's namespace claim:  myteam-dev
         .env's namespace:         myteam-dev
         No mismatch.

       Hypothesis 3 — wrong IAM client kind.
         IAM client kind in use:   public
         Build target:             game client
         Match.

       Diagnosis

         Symptom:           Intermittent auth failures.
         Likely cause:      SDK isn't refreshing tokens before expiry.
         Confidence:        high (tokens observed expiring)
         Evidence:           - Recent failing token has exp 2 min in the past
                             - SDK refresh callback not wired in this build
         Counter-evidence:  None.

       Next step (which skill owns the fix):
         • /ags debug — wire the refresh callback into the SDK init.
```

### Inconclusive

```
User: /ags doctor — players sometimes see weird in-game state, but I
      can't reproduce it.

Skill: Restating: intermittent in-game state inconsistency, no
       reproducer.

       Walked the auth and lobby diagnosis trees — nothing fit. The
       symptom isn't a clean AGS-error signature.

       Diagnosis

         Symptom:           Intermittent in-game state inconsistency,
                            no reproducer.
         Likely cause:      Couldn't narrow down with available evidence.
         Confidence:        low
         Evidence:           - No matching auth-error signature
                             - No matching lobby-disconnect signature
                             - No matching matchmaking-failure signature
         Counter-evidence:  N/A — this isn't an AGS-error-shaped symptom.

       Next step (which skill owns the fix):
         • /ags observe — look at namespace events for affected players.
         • If observation reveals AGS-side anomalies → AccelByte support.
         • If observation reveals nothing AGS-shaped → look at the
           game's own state-management code; probably not an AGS issue.
```

## Error handling

- **User wants a fix during doctor** — gently redirect. "Doctor diagnoses; the fix lives in [/ags debug | /ags connect-portal | etc.]."
- **Symptom fits two trees equally** — name both hypotheses; let the user pick which to investigate first.
- **No evidence supports any hypothesis** — say so. Recommend `/ags observe` for more visibility before guessing.
