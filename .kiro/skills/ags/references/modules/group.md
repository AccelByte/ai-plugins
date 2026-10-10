---
last-verified: 2026-10-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/guilds-clans/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/guilds-clans/integrating-group-to-game/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/guilds-clans/create-group-configuration/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/guilds-clans/group-configuring-single-clan-and-multiple-system/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/guilds-clans/configure-group/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/guilds-clans/manage-group-roles/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/guilds-clans/enable-group-notifications/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/chat/configuring-chat-with-the-admin-portal/
- https://raw.githubusercontent.com/AccelByte/accelbyte-go-sdk/main/spec/group.json
- https://www.npmjs.com/package/@accelbyte/sdk-groups
see-also:
- '[social.md](social.md)'
- '[chat.md](chat.md)'
- '[lobby.md](lobby.md)'
- '[marketing-to-service.md](../catalogs/marketing-to-service.md)'
---

# Module — Group (Guilds & Clans)

Persistent player groups: clans, guilds, crews. The AGS **Group** service (`group`, `justice-group-service`) is what the public docs call **Guilds & Clans**, under Multiplayer. It is native — a clan or guild system does not need Extend or a custom backend.

---

## What it covers

- **Group lifecycle** — create, update, join, leave, invite, kick, and accept or reject invitations and join requests.
- **Group types** — set per group:

  | Type | Searchable | How a player gets in |
  |---|---|---|
  | `OPEN` | Yes | Joins immediately, no approval |
  | `PUBLIC` | Yes | Sends a join request; a group admin approves or rejects it |
  | `PRIVATE` | No | Only by an admin's invitation |

  The public group list returns `OPEN` and `PUBLIC` groups only.
- **Member roles** — every member gets the configuration's member role; the creator gets its admin role. Roles carry permissions such as inviting, accepting or rejecting join requests, and kicking, so "the leader can kick" is a role permission, not custom code. Custom roles can be added.
- **Custom attributes** — free-form per-group metadata (emblem, motto, and so on).
- **Rules** — a configuration's global rules gate group creation; a group's predefined rules gate joining. A rule compares a player attribute against a value with `EQUAL`, `MINIMUM` or `MAXIMUM`.
- **Notifications** — invitations, accepted or rejected requests and new members arrive over the Lobby WebSocket under the `group` topic.

## Set up first: the group configuration

Players cannot create a group until the namespace has a **group configuration**; the creator then becomes that group's admin. The configuration sets:

- the configuration code,
- the **maximum members** per group,
- the **admin role** and **member role** — both roles must exist before the configuration is created,
- **Allow Join Multiple Groups** — off gives a single-clan system (a player belongs to one group at a time); on lets a player join several.

Admin Portal: **Multiplayer > Guilds & Clans > Configuration**. Over the API, `POST /group/v1/admin/namespaces/{namespace}/configuration/initiate` creates a default configuration with default admin and member roles (the admin role can invite, accept or reject join requests, and kick; maximum members defaults to 50). Use the explicit `POST .../configuration` when the roles are already defined.

## SDKs

| SDK | Entry point |
|---|---|
| Unity | `AccelByteSDK.GetClientRegistry().GetApi().GetGroup()` — e.g. `CreateGroupV2`, `AssignRoleToMemberV2` |
| Unreal | `ApiClient->Group` — e.g. `CreateV2Group`, `AssignV2MemberRole` |
| TypeScript Web SDK | `@accelbyte/sdk-groups` (plural) — `GroupApi`, `GroupMemberApi`, `GroupRolesApi`, `MemberRequestApi`, plus admin variants |
| Extend SDKs | `group` service — route Extend work to `/ags-extend` |

The REST API has `/group/v1/...` and `/group/v2/...` paths; v2 scopes membership operations by `groupId`, while group search and single-group reads remain on v1 public endpoints.

## How Group relates to the other modules

| Module | Relationship |
|---|---|
| **IAM** | Members are AGS player identities |
| **Lobby** | Delivers group notifications over its WebSocket |
| **Chat** | The Chat configuration has a **Clan Chat** feature for members of a clan, disabled by default — see `chat.md` |
| **Social** | Friends and blocking are Social; durable multi-player membership is Group |
| **Extend** | Only for behavior the Group service cannot express (custom ranking of clans, cross-namespace federation, and so on) — confirm the native feature falls short first |

## Where to look in the docs

- Guilds & Clans: `https://docs.accelbyte.io/gaming-services/modules/multiplayer/guilds-clans/`
