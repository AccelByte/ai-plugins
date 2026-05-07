---
name: ags-debug
description: 'Run a game / app locally against AGS and trace integration failures:
  auth errors, lobby disconnects, matchmaking timeouts, store call failures, etc.
  Use when something is broken during local dev and the user needs to narrow down
  whether it''s their code, the SDK, or AGS-side.'
allowed-tools: Read Bash Glob Edit Write
model: sonnet
last-verified: 2026-05-05
sources:
- https://docs.accelbyte.io/
see-also:
- '[auth-failures.md](../references/debug/auth-failures.md)'
- '[lobby-disconnects.md](../references/debug/lobby-disconnects.md)'
- '[matchmaking-timeouts.md](../references/debug/matchmaking-timeouts.md)'
- '[cli-commands.md](../references/observe/cli-commands.md)'
- '[doctor.md](doctor.md)'
- '[observe.md](observe.md)'
---

# AGS Local Debug

Diagnose a failing AGS integration by running the game / app locally, watching what happens, and narrowing the failure to: client-side code, SDK config, IAM client setup, namespace state, or AGS-side incident.

This subskill **does** make changes (apply fixes, edit configs, run binaries). Compared to `subskills/doctor.md` which is read-only diagnosis, `debug` is the place where fixes get applied.

## Behavior Constraints

<grounding_rules>

Diagnosis trees trace to:

- `references/debug/auth-failures.md` for auth issues.
- `references/debug/lobby-disconnects.md` for lobby connection issues.
- `references/debug/matchmaking-timeouts.md` for match-formation issues.

Don't fabricate error signatures or make up causes. When something doesn't fit a known signature, say so and escalate (AccelByte support, or `subskills/observe.md` for a deeper look at namespace state).

</grounding_rules>

<tool_usage_rules>

- `Bash` to run / build the game-or-app, tail logs, hit AGS endpoints with `curl` for testing, run the AGS CLI for read-only namespace queries.
- `Read` the relevant `references/debug/<topic>.md`.
- `Edit` / `Write` for fixes — show diffs first.
- `Glob` for finding logs and config files.
- Follow `references/observe/cli-commands.md#rules-of-engagement-for-llms` for AGS CLI discovery and JSON output.

</tool_usage_rules>

<dependency_checks>

Before debugging:

1. The integration is at a state where the failure can be reproduced (build is current, env is configured).
2. The user can describe the symptom in concrete terms — error code, log line, what was attempted, what happened, what was expected.

If the user can't reproduce or can't describe the symptom concretely, route to `subskills/doctor.md` first to narrow down what they're trying to diagnose.

</dependency_checks>

<action_safety>

Edits user code and config. Specifically:

- For each candidate fix, show the diff and confirm with the user before applying.
- Don't restart / kill long-running processes (game servers, dev servers) without confirmation.
- If a fix changes IAM client config or `.env`, route to `/ags connect-portal` for the change rather than editing here.

</action_safety>

<output_contract>

Each diagnosis cycle produces:

```
Symptom:        <what the user reported>
Hypothesis:     <what we tested>
Evidence:       <log lines / responses / observed behavior>
Outcome:        <fixed / not the cause / partially the cause / inconclusive>
Next step:      <what to try next, or "fixed">
```

When the issue is fixed:

```
Resolved.

  Root cause:    <one-sentence summary>
  Fix applied:   <what changed>
  Verification:  <how we confirmed>

Run the smoke test once more if you want to be sure.
```

</output_contract>

<completeness_contract>

A debug session is complete when:

1. The original symptom no longer reproduces, OR
2. The cause has been identified and the user knows the next step (sometimes that's "open an AccelByte support ticket"), OR
3. The user is satisfied with the diagnosis even if a fix is deferred.

</completeness_contract>

## Workflow

### Step 1: Capture the symptom

Get from the user:

1. What were they doing?
2. What happened?
3. What did they expect?
4. Any error code or log line?

If the user can't articulate cleanly, route to `subskills/doctor.md` to narrow down.

### Step 2: Classify the symptom

Pick a starting reference:

| Symptom shape | Reference |
|---|---|
| Auth errors (401, 403, "invalid_token", login failures) | `references/debug/auth-failures.md` |
| Lobby disconnects, WebSocket resets, presence drops | `references/debug/lobby-disconnects.md` |
| Matchmaking timeouts, no matches forming | `references/debug/matchmaking-timeouts.md` |
| Store call failures | `references/debug/auth-failures.md` first (most common cause), then look at the call specifically |
| Anything else | Read `subskills/doctor.md` to narrow down |

### Step 3: Walk the diagnosis tree

Apply the reference's diagnosis tree to the user's specific symptom. Generate hypotheses, test each, capture evidence.

For auth/login failures after SDK install and code integration are complete, classify backend configuration before editing code again. In particular, if login code compiles and runtime login returns HTTP 400 `invalid_request`, check IAM client kind, namespace, and whether the attempted login method is enabled/implemented via AGS CLI read-only discovery. If the backend setting is missing or unclear, route to `/ags connect-portal`; do not keep adding client-side error guards as the main fix.

Common testing patterns:

- **Decode the JWT** — `echo "<token>" | cut -d. -f2 | base64 -d` to see the namespace, scope, exp claims.
- **Hit an AGS endpoint with curl** — bypass the SDK to confirm whether the failure is SDK-side or AGS-side.
- **Tail logs** during a reproducer run.
- **Use the CLI** to confirm namespace / IAM client state matches what the SDK is sending.
- **Use CLI command discovery** — `ags describe iam`, `ags describe iam clients list`, and generated read-only IAM/login-method queries with `--format json`.

### Step 4: Apply the fix

Once the cause is known and the fix is in scope here:

- Show the diff.
- Confirm.
- Apply.
- Re-run the smoke test.

If the fix is out of scope (IAM client misconfiguration, namespace-side change, AccelByte support ticket), point at the right skill / external action.

### Step 5: Verify and close

Confirm the symptom no longer reproduces. Print the "Resolved" block.

## Examples

### Auth failure: namespace mismatch

```
User: /ags debug — I keep getting 401 invalid_namespace on every call.

Skill: Reading references/debug/auth-failures.md.

       Symptom:    401 invalid_namespace on calls.
       Hypothesis: Token's namespace claim doesn't match the API's
                   target namespace.

       Decode your JWT (paste the access token):

User: <pastes>

Skill: Token's namespace claim: "myteam-prod"
       Your .env says: ACCELBYTE_NAMESPACE=myteam-dev

       Evidence:   Token issued for prod; calls are targeting dev.
       Outcome:    Cause confirmed.
       Next step:  Either re-issue the token against dev (re-login with
                   the dev IAM client config) or switch the .env to
                   point at prod.

       Which do you want?

User: Stick with dev — I think someone overrode the IAM client ID
      to prod's value.

Skill: Showing diff to .env:
       - ACCELBYTE_CLIENT_ID=<prod_id>
       + ACCELBYTE_CLIENT_ID=<dev_id>
       Confirm? (y/n)

User: y

Skill: ✓ Applied. Re-run the smoke test.

       [user re-runs]

Skill: ✓ Login OK. GetMyProfile returns user_id correctly.

       Resolved.

         Root cause:   .env had the prod IAM client ID instead of dev.
         Fix applied:  Switched .env back to dev client ID.
         Verification: smoke test login OK, namespace claim now matches.
```

### Lobby disconnects on mobile

```
User: /ags debug — players on iOS keep getting kicked from the lobby
      after about 30 seconds.

Skill: Reading references/debug/lobby-disconnects.md.

       Symptom:    iOS-specific Lobby disconnect after ~30s.
       Hypothesis: OS-level WebSocket suspension when app backgrounds.

       Are players backgrounding the app during the disconnect?

User: Some are. But others are foregrounded the whole time.

Skill: Two probable contributors: (1) background-suspension for the ones
       backgrounding, and (2) NAT / carrier idle-timeout for the others.

       Hypothesis 1 — background suspension:
         Foreground/background lifecycle hooks in your iOS code?

User: We don't handle backgrounding explicitly.

Skill: Evidence:    No background-foreground reconnect logic.
       Outcome:     This is a contributor for the backgrounded case.
       Next step:   Add foreground-reconnect logic. Showing the pattern...

       [continues with the second hypothesis for the always-foreground case]
```

## Error handling

- **Symptom is intermittent / can't reproduce** — route to `subskills/observe.md` to look at namespace-level events; without a reproducer, debugging is observation rather than fix-and-verify.
- **Fix exceeds local debug scope** (e.g. an IAM client kind or login method needs to change) — route to `/ags connect-portal`.
- **AccelByte-side incident suspected** — check `https://docs.accelbyte.io/` status / Admin Portal incident notifications; open a support ticket if confirmed.
- **User insists the cause is something the diagnosis doesn't support** — surface the inconsistency. Don't apply a fix you can't justify.
