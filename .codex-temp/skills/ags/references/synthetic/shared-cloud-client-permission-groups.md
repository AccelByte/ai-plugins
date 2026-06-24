---
last-verified: 2026-06-09
see-also:
- '[iam-authorization-preflight.md](../security/iam-authorization-preflight.md)'
- '[cli-commands.md](../observe/cli-commands.md)'
---

# Shared Cloud Client Permission Groups

Use this synthetic reference when translating an AGS resource permission into the grouped IAM client permission model used in Shared Cloud.

This applies only to **Shared Cloud** environments — those whose AGS base URL is on `gamingservices.accelbyte.io`. In **Private Cloud / BYOC** (any host not on `gamingservices.accelbyte.io`, often a customer's own custom domain), permissions are free-form resource strings: the resource permission discovered with `ags describe` is the final answer, and there is no group to map to. Confirm the environment per `../security/iam-authorization-preflight.md` before applying this mapping.

**Stop condition:** Do not use this file as the first source for a permission answer. First complete Environment Detection in `../security/iam-authorization-preflight.md` from project config, AGS CLI profile/config, or permission-catalog behavior. If the environment is unknown, report the resource/action plus the missing evidence; do not choose a Shared Cloud group.

## Discovery Command

After discovering the required resource permission with `ags describe`, read the IAM client configuration catalog:

```sh
ags iam client-config list-permissions --exclude-permissions false --output -
```

The endpoint behind the command is `GET /iam/v3/admin/clientConfig/permissions`. It requires an authenticated CLI session for the target AGS environment.

## Catalog Shape

The response is JSON with `clientPermissions[]`. Each module contains `groups[]`, and each group has:

- `group` - display name shown for the permission group.
- `groupId` - stable group identifier.
- `permissions[]` - resource permissions included in the group.
- `allowedActions` - action bit values for that resource.

Use this action mapping when translating catalog entries:

```text
1 = CREATE
2 = READ
4 = UPDATE
8 = DELETE
```

## Lookup Workflow

1. Use `ags describe <service> <resource> <method>` to find the exact required resource permission and action.
2. Confirm Environment Detection resolved to Shared Cloud.
3. Run `ags iam client-config list-permissions --exclude-permissions false --output -`.
4. Search `clientPermissions[].groups[].permissions[]` for the resource.
5. Match the action bit to the required action.
6. Report the module, group, `groupId`, resource, and covered actions.

If multiple groups contain the same resource, report the ambiguity and choose the group whose module and action coverage best match the caller's operation. Do not guess a Shared Cloud group from the resource name alone.

## Example

If `ags describe session game-sessions get` reports:

```text
NAMESPACE:{namespace}:SESSION:GAME [READ]
```

search the catalog for `NAMESPACE:{namespace}:SESSION:GAME` with action `2`. Observed matching groups include:

| Module | Group | Group ID | Resource | Actions |
|---|---|---|---|---|
| AMS | Dedicated server | `g_dedicated_server` | `NAMESPACE:{namespace}:SESSION:GAME` | `1,4` |
| Session | Game Session | `g_game_session` | `ADMIN:NAMESPACE:{namespace}:SESSION:GAME` | `2,4,8` |
| Session | Game Session | `g_game_session` | `NAMESPACE:{namespace}:SESSION:GAME` | `1,2,4,8` |

For a public game-session read, choose `Session / Game Session / g_game_session` because it contains the exact `NAMESPACE:{namespace}:SESSION:GAME` resource and includes action `2`.
