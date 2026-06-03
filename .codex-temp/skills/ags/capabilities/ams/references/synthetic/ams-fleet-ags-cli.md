---
last-verified: 2026-05-26
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/create-ams-fleet/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-watchdog-protocol/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/fleet-sizing/
---

# AMS Fleet Setup via AGS CLI

Use this synthetic reference for terminal-driven AMS fleet configuration with the `ags` CLI.
This is separate from the AMS binary (`ams`) and is not a replacement for SDK build steps.

This reference includes observed AGS CLI command help and discovery output (`ags --help`, `ags describe`, and `ags ams ... --help`) from May 26, 2026. Re-run discovery in the user's environment before mutating fleet state.

## Scope and Constraints

- `ags` is the AGS CLI (`ags <service> <resource> <method>`). It can create and update fleets through `ams` service commands.
- Use this when a user wants CLI commands for fleet lifecycle operations and not only portal clicks.
- Do not rely on memory for flags or payload fields. Use `ags describe` and command help in the user environment before mutating anything.
- If a method is missing in discovery output, stop and switch to Admin Portal-guided steps.

## Discovery-First Workflow

Run discovery first in this order:

```bash
ags --help
ags auth status --format json
ags describe ams --format json
ags describe ams fleets --format json
ags describe ams info --format json
ags describe ams images --format json
```

## Permission Requirements (Discovered via `ags describe`)

| Method | Permission |
|---|---|
| `ams fleets create` | `ADMIN:NAMESPACE:{namespace}:ARMADA:FLEET [CREATE]` |
| `ams fleets list` | `ADMIN:NAMESPACE:{namespace}:ARMADA:FLEET [READ]` |
| `ams fleets get` | `ADMIN:NAMESPACE:{namespace}:ARMADA:FLEET [READ]` |
| `ams fleets update` | `ADMIN:NAMESPACE:{namespace}:ARMADA:FLEET [UPDATE]` |
| `ams fleets delete` | `ADMIN:NAMESPACE:{namespace}:ARMADA:FLEET [DELETE]` |

If `ags ams account get --namespace <namespace>` does not return an account, route back to `/ags ams account` steps before fleet creation.

## Preflight Checks

1. Confirm namespace linkage and AGS environment:

```bash
ags auth status --format json
ags ams account get --namespace <namespace>
```

2. Pick an image ID for the fleet:

```bash
ags ams images list --namespace <namespace> --target-architecture linux-x86_64 --status READY
```

3. Confirm regions and instance types:

```bash
ags ams info list-regions --namespace <namespace>
ags ams info list-supported-instances --namespace <namespace>
```

Ensure QoS is enabled for at least one region before creating or updating fleets. Without at least one QoS-enabled region, player routing can fail.

4. Verify the command surface you will use:

```bash
ags ams fleets create --help
ags ams fleets update --help
ags ams fleets get --help
```

## Fleet Create Payload Template

`ams fleets create` requires `--json` payload. Use stdin or file input to avoid shell quoting.

Minimal required structure (required fields shown):

```json
{
  "active": true,
  "name": "my-production-fleet",
  "onDemand": false,
  "dsHostConfiguration": {
    "instanceId": "ttx1.s",
    "serversPerVm": 1
  },
  "imageDeploymentProfile": {
    "commandLine": "-dsid=${dsid} -port=${default_port} -watchdog_url=${watchdog_url}",
    "imageId": "my-image-id",
    "portConfigurations": [
      { "name": "default", "protocol": "UDP" }
    ]
  },
  "regions": [
    {
      "region": "us-east-1",
      "minServerCount": 1,
      "maxServerCount": 2,
      "bufferSize": 1,
      "dynamicBuffer": true
    }
  ],
  "samplingRules": {
    "coredumps": { "crashed": { "collect": true, "percentage": 100 } },
    "logs": {
      "success": { "collect": true, "percentage": 100 },
      "crashed": { "collect": true, "percentage": 100 },
      "unclaimed": { "collect": false, "percentage": 0 }
    }
  }
}
```

Optional fields commonly needed during setup:

- `claimKeys` for session-template routing.
- `fallbackFleet` for claim fallback.
- `hibernateAfterPeriod` for on-demand/dev fleet behavior.
- `imageDeploymentProfile.timeout` values (`claim`, `creation`, `drain`, `session`, `unresponsive`) when tuning fleet behavior.

### Dry-run before submit

```bash
ags ams fleets create --namespace <namespace> --dry-run --json @./fleet-create.json
```

### Submit

```bash
ags ams fleets create --namespace <namespace> --json @./fleet-create.json
```

## Update and Validation

Update an existing fleet with the same payload shape:

```bash
ags ams fleets update --namespace <namespace> --fleet-id <fleet-id> --dry-run --json @./fleet-update.json
ags ams fleets update --namespace <namespace> --fleet-id <fleet-id> --json @./fleet-update.json
```

Verify lifecycle state:

```bash
ags ams fleets list --namespace <namespace>
ags ams fleets get --namespace <namespace> --fleet-id <fleet-id>
ags ams fleets get-dedicated-server --namespace <namespace> --fleet-id <fleet-id>
```

## Common Mappings

- `commandLine` should include DS placeholder arguments expected by the SDK/watchdog integration, typically `${dsid}` and `${default_port}`.
- `regions[].minServerCount`, `regions[].maxServerCount`, and `regions[].bufferSize` map to scaling parameters from the AMS fleet concepts.
- `onDemand=false` usually maps to a production-style fleet with warm servers.
- `onDemand=true` is typical for demand-driven fleets that can hibernate.
- `serversPerVm` and `instanceId` come from `ags ams info list-supported-instances --namespace <namespace>`.

## Failure Signals to Call Out

- `namespace is not linked` or no `AMS:ACCOUNT`: stop and link namespace in `/ags ams account` flow first.
- Missing `--namespace`: do not assume default namespace; always read the user/project namespace and use explicit value unless profile is verified.
- Wrong `instanceId`: expect region-level command failure or validation error; re-check `list-supported-instances`.
- Wrong `region`: command fails with region-not-found; re-check `list-regions`.
- `--json` shape mismatch: regenerate payload with `ags describe ams fleets create --skeleton --format json` and update field names/types exactly.
- No QoS-enabled region found: stop and enable QoS for at least one region in Admin Portal before fleet create/update commands.
