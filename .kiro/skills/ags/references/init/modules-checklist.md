---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
see-also:
- '[wizard.md](../../subskills/wizard.md)'
- '[init.md](../../subskills/init.md)'
- '[iam.md](../modules/iam.md)'
---

# Init — Modules Checklist

Decision aid for picking which AGS modules to enable for a new project. Used by `subskills/wizard.md` to drive the interview, and by `subskills/integrate.md` to plan the wiring order.

---

## Tree

Start with the game shape:

1. **Single-player with cloud saves and entitlements?**
   - Yes → IAM + Store/Entitlements + Cloud Save. (Cloud Save is a separate module under Online — enable it alongside IAM, not as part of it.)

2. **Online with friends and chat?**
   - Yes → IAM + Lobby + Social.

3. **Online competitive or co-op multiplayer?**
   - Yes → IAM + Lobby + Matchmaking + Sessions.
   - If matchmaking has any non-trivial requirements, plan to invoke `/ags-matchmaking` after the basic setup.

4. **Live-service with seasons / progression / season-pass?**
   - Yes → above + Leaderboards + Achievements + Store.

5. **Crossplay across PC + console + mobile?**
   - Yes → all of the above + Social, with **careful IAM platform-binding setup** as the longest item on the timeline (per-platform certification interleaves).

6. **Dedicated game servers?**
   - Yes → Sessions + AMS. Hand off the AMS operational work to `/ags-ams`.

7. **Custom backend logic AGS doesn't provide natively?**
   - Yes → Extend. Hand off to `/ags-extend ask` to confirm pattern, then `/ags-extend init` to scaffold.

8. **Build distribution / crash reporting / playtest tooling?**
   - Yes → ADT. Hand off to `/adt`. Standalone product; not part of AGS.

## Required vs. optional

- **Required for any AGS integration:** IAM. Everything else is optional.
- **Required for multiplayer:** Lobby + Matchmaking + Sessions.
- **Required for any IAP-backed game:** Store + Entitlements.

## Time-to-integrate (rough orders of magnitude)

| Scope | Estimate |
|---|---|
| IAM only (login + accounts), single platform | days to a week |
| IAM, multi-platform, with crossplay | weeks (driven by per-platform cert) |
| IAM + Lobby + simple matchmaking | weeks |
| Full live-service stack | one to several months |

_(Community estimates — confirm with AccelByte PS team for project-specific timelines.)_

The biggest variable across all sizes is **platform certification** — that's mostly independent of AGS and interleaves with IAM platform binding work.

## Where this checklist hands off

- `subskills/wizard.md` reads this file to drive an interactive interview.
- `subskills/install-sdk.md` uses the module list to decide which SDK pieces to scaffold.
- `subskills/integrate.md` uses it to plan the wiring sequence (IAM first; then everything else).
