---
last-verified: 2026-08-25
sources:
- https://docs.accelbyte.io/
see-also:
- '[iam-authorization-preflight.md](../security/iam-authorization-preflight.md)'
- '[legal.md](../modules/legal.md)'
- '[auth-failures.md](../debug/auth-failures.md)'
- '[matchmaking-timeouts.md](../debug/matchmaking-timeouts.md)'
- '[debug.md](../../subskills/debug.md)'
- '[doctor.md](../../subskills/doctor.md)'
- '[ask.md](../../subskills/ask.md)'
- '[cli-commands.md](../observe/cli-commands.md)'
---

# 5xx Diagnosis

Use this reference before diagnosing, explaining, or "fixing" any unexplained `5xx` response from an AGS API call — `500`, `501`, `502`, `503`, `504`, or a body/log that says "internal server error", "bad gateway", "service unavailable", or "gateway timeout". This is a cross-cutting rule, not a separate subskill.

## Core Rule

**A 5xx status code identifies a failure class — a server-side error occurred — not a root cause.** `501 Not Implemented` and `502 Bad Gateway` are both plausible for many unrelated reasons (an unprovisioned feature, a deployment-model restriction, a rate limit, an incident, a routing/gateway misconfiguration, a malformed request the server mishandled, an unrelated bug). Do not collapse "the server returned a 5xx" into "therefore X is unprovisioned / disabled / unhealthy / misconfigured" without evidence that specifically supports X. A plausible-sounding cause is not a confirmed one.

This applies with equal force to claims about the request itself: do not assert that an API path, SDK method, or endpoint "should be" a different one (e.g., that it was renamed, moved, or has a newer replacement) without confirming that against a live source. An unconfirmed endpoint-change claim is exactly as ungrounded as an unconfirmed root-cause claim, and presenting either as "done" or "correct" before verification is the same failure.

## Evidence Checklist

Gather this **before** forming or stating any hypothesis:

1. **Endpoint** — full path and HTTP method.
2. **Response body** — the exact error payload, not a paraphrase.
3. **Request/trace ID** — check the response headers and body for a request or trace identifier, if the API returns one. Don't invent a specific header name; ask the user to paste the response headers if it's not obvious which field carries it.
4. **Timestamp** — when the failing call happened (for correlating against status pages / incident windows / logs).
5. **Namespace** — the target namespace of the call.
6. **Deployment model** — Public Cloud, Private Cloud, or BYOC. Use the detection method in `../security/iam-authorization-preflight.md` (Environment Detection section) — base URL heuristic plus behavioral confirmation, not a guess.
7. **Relevant logs** — client-side logs around the call, and server-side logs if the caller has access to them.

If any of these are missing, ask for them before diagnosing rather than filling the gap with a guess.

## Procedure

1. **Collect the evidence checklist above.**
2. **Check for a documented deployment-model restriction.** Some AGS features are flatly unavailable on certain deployment models regardless of namespace state — for example, the GDPR/data-deletion module documented in `../modules/legal.md` is not supported on Public Cloud at all. If the endpoint belongs to a module with a documented restriction and the evidence confirms the deployment model it applies to, that's a grounded explanation — cite the source (docs page or in-repo reference) directly.
3. **Check whether the endpoint/method itself is real and current.** Before asserting an endpoint was renamed, deprecated, or needs to change, confirm it against a live source: AGS API MCP (`search-apis` / `describe-apis`), AGS CLI (`ags describe`), the AGS Extend SDK MCP (for Extend SDK code), or the official docs/OpenAPI spec. If none of these are available or none confirm the claim, say the endpoint change is unverified — do not present it as complete or correct.
4. **If step 2 or 3 produces a confirmed, source-backed explanation, state it and cite the source.**
5. **If nothing confirms a cause, say so explicitly** — "this doesn't match a documented cause; I can't confirm why this namespace/environment is returning a 5xx here" — **and recommend AccelByte Support before offering any hypothesis.** Package the evidence checklist above as what to hand Support.

### Ordering rule

**Support guidance must appear before any unconfirmed causal hypothesis in the response.** If an unconfirmed hypothesis is worth mentioning at all (e.g., "this class of error is sometimes rate-limiting or an incident"), it must be clearly labeled as unconfirmed, appear *after* the support recommendation, and never be phrased as the identified cause.

## Anti-patterns

| Don't | Do instead |
|---|---|
| "This 501 means the GDPR service isn't provisioned for your namespace." | "A 501 alone doesn't tell us why. Official docs do confirm the GDPR service isn't supported on Public Cloud at all — is this namespace on Public or Private Cloud? That's the first thing to rule in or out." |
| "I've updated the endpoint from `/gdpr/s2s/...` to `/gdpr/admin/...` — that resolves it." | "I can't confirm that path change is correct without checking it against the live API spec. Let me verify via AGS API MCP / AGS CLI before treating it as a fix." |
| Recommending AccelByte Support only after walking through an unconfirmed diagnosis | Recommending AccelByte Support (with the evidence bundle) as soon as no documented/confirmed cause is found — before speculating further |
| "5xx on this endpoint usually means an AGS-side incident" stated as the cause | Naming incident/rate-limit as *one untested hypothesis among several*, after the support recommendation, and only if evidence (status page, volume of calls) actually points that way |

## Where this applies

Any subskill or workflow that answers a live 5xx question — `subskills/debug.md`, `subskills/doctor.md`, `subskills/ask.md` when a user pastes an actual error, and the debug references (`../debug/auth-failures.md`, `../debug/matchmaking-timeouts.md`) — reads this file first. A reference's own "likely cause" language for a specific signature (e.g. auth-failures.md's "5xx on auth endpoint" entry) is a **hypothesis to test with evidence**, not a conclusion to state before gathering it.
