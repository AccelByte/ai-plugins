---
last-verified: 2026-10-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/legal/manage-user-data-portability-and-erasure/
- https://docs.accelbyte.io/gaming-services/modules/foundations/legal/legal-agreements/
- https://docs.accelbyte.io/gaming-services/tutorials/legal-documents/manage-legal-documents/
- https://docs.accelbyte.io/gaming-services/tutorials/legal-documents/implement-legal-agreements-using-SDK/
- https://raw.githubusercontent.com/AccelByte/accelbyte-go-sdk/main/spec/legal.json
- https://raw.githubusercontent.com/AccelByte/accelbyte-go-sdk/main/spec/iam.json
see-also:
- '[iam.md](iam.md)'
- '[public-cloud.md](../deployment/public-cloud.md)'
- '[private-cloud.md](../deployment/private-cloud.md)'
- '[5xx-diagnosis.md](../reliability/5xx-diagnosis.md)'
- '[iam-authorization-preflight.md](../security/iam-authorization-preflight.md)'
- '[faq.md](../faq.md)'
- '[glossary.md](../glossary.md)'
---

# Module — Legal & Privacy

Two separate services under one Admin Portal section (**Foundations > Legal & Privacy**). Don't answer a question about one with the other:

- **Legal Agreements** — Terms of Service, Privacy Policy, EULA and marketing preferences that players must see and accept, versioned and localized. See [Legal Agreements](#legal-agreements) directly below.
- **GDPR / CCPA data portability and erasure** — data-access and account-deletion requests. See [GDPR / CCPA data requests](#gdpr--ccpa-data-requests). Its Public Cloud restriction applies to it alone, not to Legal Agreements.

---

## Legal Agreements

AGS handles "players must accept our ToS / Privacy Policy, and re-accept when we change it" natively. It is not an Extend or Cloud Save build.

### Model

| Object | What it is |
|---|---|
| **Legal document** (base policy) | One document type — Legal Document (ToS, Privacy Policy, EULA) or Marketing Preference — with `affectedCountries` (fixed after creation) and `affectedClientIds`, the IAM clients it applies to (your game client, Player Portal, Launcher) |
| **Policy** | Per country (`COUNTRY`) or country group (`COUNTRY_GROUP`) under a document. One policy is the **default**, used for countries with no policy of their own. **Mandatory** (`isMandatory`) means the player must accept it |
| **Policy version** | A `displayVersion` of a policy |
| **Localized policy version** | The text for one locale, uploaded as `.md` or `.html` (Admin Portal only; the AGS CLI cannot upload it) |
| **Publish** | Makes a version the live one; `shouldNotify` emails players. A version can be un-published only if nobody has accepted it |

Setup, in the Admin Portal (**Foundations > Legal & Privacy > Legal Documents**): create the document → add a policy per country or the default → create a version → upload the localized text → **publish**. A document marked inactive (`isHidden`) turns its mandatory policies optional.

Placement: documents in a game namespace apply to that game; documents in the publisher namespace apply across the publisher's games in Player Portal / Launcher. **AGS Public Cloud offers Legal Agreements in game namespaces only.**

### Player flow

1. **Check what the player still owes.** `GET /agreement/public/eligibilities/namespaces/{namespace}` returns the active policies with `isAccepted` and `isMandatory` per policy for this player. Acceptance in another namespace counts.
2. **Show** the unaccepted policies' localized text (`GET /agreement/public/policies/namespaces/{namespace}` lists policies for the player's country, read from the token; `40040` means the user has no country).
3. **Record acceptance.** `POST /agreement/public/agreements/policies` takes an array of `{isAccepted, policyId, policyVersionId, localizedPolicyVersionId}`. A single acceptance can go to `POST /agreement/public/agreements/localized-policy-versions/{localizedPolicyVersionId}`.
4. **At registration**, `acceptedPolicies` on the IAM create-user request records acceptance in the same call.

**Updates.** Publishing a new version is how a changed ToS reaches players: run the eligibility check on each login and gate play on any mandatory policy the player has not accepted at its current version. The docs don't state outright that publishing resets every player's `isAccepted`; verify against the eligibility response in the user's namespace rather than asserting it.

**At login.** When a player has not accepted required policies, IAM's token response carries `is_comply: false` and the token carries no permissions. There is no dedicated error code; check `is_comply`, not an error.

### SDKs

| SDK | Entry point |
|---|---|
| Unity | `AccelByteSDK.GetClientRegistry().GetApi().GetAgreement()` — `QueryLegalEligibilities`, `GetLegalPolicies` / `GetLegalPoliciesByCountry`, `GetLegalDocument`, `AcceptPolicyVersion`, `BulkAcceptPolicyVersions` |
| Unreal | `ApiClient->GetAgreementApi()` — `QueryLegalEligibilities`, `GetLegalPolicies`, `GetLegalDocument`, `AcceptPolicyVersion`, `BulkAcceptPolicyVersions` |
| TypeScript Web SDK | `@accelbyte/sdk-legal` — `EligibilitiesApi`, `AgreementApi`, plus admin variants |

Private Cloud admin permission for managing documents: `ADMIN:NAMESPACE:{namespace}:LEGAL`. AGS CLI: `ags legal base-policies|policies|versions …`.

Docs: `https://docs.accelbyte.io/gaming-services/modules/foundations/legal/legal-agreements/`

---

## GDPR / CCPA data requests

Player-initiated and admin-initiated data access and account-deletion requests, built to help studios comply with GDPR (EU) and CCPA (California). AccelByte's own docs are explicit that this covers the technical mechanics only: **"we cannot provide you with legal advice."** Point studios needing compliance sign-off at their own counsel.

---

### Deployment availability — read this first

> **The GDPR service feature is not yet supported in AGS Public Cloud.** (verbatim from official docs, as of the 2026-08-25 fetch)

The restriction covers these data requests only; Legal Agreements above is available on Public Cloud in game namespaces. This is a hard feature gap, not a configuration option or a residency nuance — it's distinct from the general data-residency reasons a studio might move off Public Cloud (see `../deployment/public-cloud.md`). A studio can have zero residency requirements and still be unable to use this module if it's on Public Cloud.

Before answering any account-deletion or data-request question, confirm the caller's deployment model (see `../security/iam-authorization-preflight.md` for the detection method — base URL heuristic plus behavioral confirmation). If the namespace is on Public Cloud, say plainly that this module isn't available there and stop before describing an implementation. Do not infer from an error response that the feature is "unprovisioned" or "disabled" for a specific namespace — the docs describe a platform-wide restriction, not a per-namespace toggle, and any other cause for an error still needs its own evidence (see `../reliability/5xx-diagnosis.md`).

If the deployment model can't be determined from project config or CLI/MCP evidence, ask rather than guessing which restriction applies.

### What it covers

Two rights, per GDPR/CCPA:

- **Right of access** — a user's request to receive a copy of their personal data. Typically processed within 28 days.
- **Right to erasure** — a user's request to delete their account and associated personal data. Most requests processed within 28 days.

### Operation types — do not treat these as interchangeable

The official docs describe three distinct ways a request gets initiated, and their namespace / user-ID / permission shape differs. Don't assume one operation's requirements apply to another.

| Operation | How it's initiated | Namespace requirement | User-ID requirement | Auth / permission shape |
|---|---|---|---|---|
| **User self-service** | Player Portal or Launcher — the user requests access to or deletion of their own data | Implicit — scoped to the user's own session/namespace | Implicit — the logged-in user, no explicit ID passed | The user's own authenticated session; no admin permission involved |
| **Admin Portal (manual)** | Admin Portal: Foundations > Users > search player > View > Details > "Send Request" next to Personal Data Request | Docs state this **"functionality is only available in the publisher namespace"** for the personal-data-retrieval flow specifically — the docs don't confirm whether that same publisher-namespace restriction extends to the erasure/deletion request flow in the Admin Portal. Don't assume it does; if it matters, verify or ask before advising. | Selected via portal search, not a caller-supplied ID | Admin/super-admin Admin Portal role. The admin retrieves data **only on behalf of the user who requested it** — this isn't an unrestricted admin lookup. |
| **Admin SDK / S2S (Extend)** | Extend SDK, e.g. `AdminSubmitUserAccountDeletionRequest(namespace, userId)` | **Explicit** — passed as a parameter | **Explicit** — passed as a parameter (path/param, not implicit) | Requires an IAM Client logged in as a client, with the permissions this service needs (see the caveat below — the docs' own example is unreliable here) |

**Headless accounts** are not addressed anywhere in this documentation page. Don't assume a headless account (see `../glossary.md`) follows the self-service Player Portal flow, the admin flow, or some third mechanism — headless accounts by definition have no credentials for a self-service login. If a studio asks how to delete a headless account's data, say the official docs don't cover this case explicitly and that Admin SDK / S2S deletion (which takes an explicit user ID and doesn't require the user to authenticate) is the closest documented mechanism, then recommend confirming with AccelByte Support before relying on that assumption for a compliance-sensitive flow.

### Known documentation caveat — don't repeat this verbatim

The official docs' SDK-initialization examples for the GDPR service (C# and Python tabs specifically) instruct: *"Create your IAM Client and assign the necessary permissions to access **the Matchmaking service**."* That's almost certainly a copy-paste error in AccelByte's own docs — it appears while describing GDPR/`DataDeletion` client setup, not Matchmaking. Do not repeat "Matchmaking permissions" as the requirement for GDPR access. The docs do not give an unambiguous permission/resource string for the GDPR service. To confirm the actual required permission, use live discovery — `../security/iam-authorization-preflight.md`'s Permission Discovery Step (AGS API MCP or AGS CLI) — rather than guessing a resource string from this page.

### Request status lifecycle

Right of access (personal data retrieval) statuses: **Pending** → **In-progress** → (**Retrying**, up to 3 attempts on failure) → **Failed** (both user and admin notified, resubmission needed) or completion. **Expired** occurs only if a related service has a problem. Unactioned requests are auto-**removed from queue** after 56 days.

Right to erasure (account deletion) statuses: **Request** (access token not yet revoked) → **Pending** (token revoked; still cancelable until expiration) → **In Progress** (scheduler begins deletion after expiration) → **Failed** (admin notified via email, can resubmit — returns to Pending).

Admins can check request status in Admin Portal: Foundations > Legal & Privacy > Personal Data Requests.

### Related AGS services

- **IAM** — every GDPR SDK call authenticates through an IAM Client login; there's no separate GDPR-specific auth mechanism.
- **Email notifications** — the GDPR service sends admin/user emails at status changes (failure notifications, completion notifications). An "Admin email configuration" (`SaveAdminEmailConfiguration` / `GetAdminEmailConfiguration` / etc.) controls where admin notifications go.

### SDK support

Available via the **Extend SDKs only** — Go, Java, Python, C# — through a `DataDeletion` / `DataRetrieval` wrapper (docs literally show `sdk.Gdpr.DataDeletion...` / `sdk.Gdpr.DataRetrieval...`). This is **not** exposed through the Game Engine SDKs (Unreal/Unity/Godot/Roblox) or the TypeScript Web SDK — a studio wiring this into a game client is asking the wrong question; it belongs server-side, in an Extend app, or in the Admin Portal / Player Portal flows above.

### Where to look in the docs

- Official page: `https://docs.accelbyte.io/gaming-services/modules/foundations/legal/manage-user-data-portability-and-erasure/`
- **Every account-deletion or data-request answer should link this page.** It's the only authoritative source this file is grounded in — don't present derived claims here as more certain than the page itself is.

### Where this module ends

- **Deployment-model questions** ("can we move off Public Cloud for this") → `../deployment/private-cloud.md`, `../deployment/byoc.md`, or `subskills/handoff.md`.
- **An unexplained error response while calling a GDPR endpoint** (5xx or otherwise) → `../reliability/5xx-diagnosis.md` first. Don't diagnose the error as a provisioning problem just because this module has a known Public Cloud restriction — confirm the deployment model is actually the cause before saying so.
- **General data-residency requirements** that aren't specifically about this module's deletion/access flows → `../deployment/public-cloud.md` / `private-cloud.md`.
