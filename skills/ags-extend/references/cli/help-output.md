---
last-verified: 2026-09-24
authoritative: true
note: --help output captured from an installed `ags` binary (ags 0.5.1 (workflow protocol
  1.0.0)). This is the ground-truth grounding artifact every other CLI claim in this
  skill defers to.
sources:
- https://github.com/AccelByte/accelbyte-ags-cli
see-also:
- '[cli-commands.md](../deploy/cli-commands.md)'
---

# `ags extend` — `--help` output (authoritative grounding artifact)

Captured: 2026-09-24. Source: installed binary, `ags 0.5.1 (workflow protocol 1.0.0)`.

This file is the output of `ags --help` (the global flags every command accepts) and of `ags extend --help` for every subcommand, and the ground truth for CLI syntax — `references/deploy/cli-commands.md` is its readable restatement.

## `ags` (global flags)

```
AccelByte Gaming Services CLI

Manage your AccelByte backend from the terminal. Authenticate,
call any admin API, and automate cross-service workflows.

Usage:
  ags [FLAGS] <COMMAND> [OPTIONS]
  ags [FLAGS] <SERVICE> <RESOURCE> <METHOD> [OPTIONS]

Commands (standalone):
  auth           Authentication management
  completions    Generate a shell completion script
  config         Configuration management
  profile        Profile management
  describe       Machine-readable command discovery and introspection (JSON)
  doctor         Check environment, configuration, and connectivity
  refresh-specs  Rebuild the parsed-schema cache from bundled specs
  update         Check for a newer release and show how to install it
  extend         Extend platform tooling
  workflow       Run a registered multi-step workflow

Services (API groups):
  achievement        Player achievements, badges, and progression tracking
  ams                Multiplayer server fleet management and orchestration
  basic              User profiles, namespaces, and file uploads
  challenge          Challenge definitions, goals, schedules, and player progression
  chat               Chat messaging, moderation, inbox, and profanity filtering
  cloud-save         Cloud save records for games and players (binary and JSON)
  csm                Custom service management, deployments, and container images
  ehs                Extend helper container image registry credentials and gRPC reflection
  game-telemetry     Game telemetry event ingestion and querying
  gdpr               GDPR data deletion, retrieval, and platform account closure
  group              Player groups, memberships, roles, and join requests
  iam                Identity, authentication, authorization, and user management
  inventory          Player inventories, items, item types, and tags
  leaderboard        Leaderboard configuration, data, and user rankings
  legal              Legal agreements, policies, eligibility, and consent tracking
  lobby              Lobby connections, friends, presence, party, and notifications
  login-queue        Login queue management and ticket processing
  matchmaking        Matchmaking pools, rulesets, tickets, and backfill
  platform           Store, items, entitlements, wallets, payments, and IAP
  reporting          Player reporting, moderation rules, reasons, and tickets
  season-pass        Season passes, tiers, rewards, and seasonal content
  session            Game sessions, parties, matchmaking templates, and DS config
  session-history    Session analytics and X-Ray diagnostics
  social             Stats, stat cycles, game profiles, and social slots
  ugc                User-generated content: uploads, moderation, and discovery

Flags:
      --dry-run                  Show HTTP request without executing
      --format <format>          Output format for automation [json]
      --ui <ui>                  Presentation backend for human output [auto|plain|inline|fullscreen]
  -n, --namespace <namespace>    Override namespace (default from config)
      --no-color                 Disable colored output
      --no-input                 Disable all interactive prompts
      --output <output>          Write response body to <path> (use '-' for stdout)
  -q, --quiet                    Suppress non-essential output
  -v, --verbose                  Show resolution trace and request/response details
  -y, --yes                      Skip confirmation prompts
      --skeleton                 Output a JSON request body template (for operations with --json)
      --timeout <timeout>        Request timeout in seconds (default 60)
      --page-all                 Fetch all pages of paginated results
      --page-limit <page-limit>  Max pages to fetch with --page-all (default 10, max 100)
  -h, --help                     Print help (see more with '--help')
  -V, --version                  Print version

Examples:
  ags auth login
  ags iam users search --namespace my-game
  ags platform items create --namespace my-game --store-id main --json @item.json

Exit codes:
  0 = success
  1 = usage error
  2 = auth error
  3 = API error
  4 = network error
  5 = internal error

Links:
  Docs:      https://docs.accelbyte.io/
  Feedback:  https://github.com/AccelByte/accelbyte-ags-cli/issues
```

## Top-level

```
Extend platform tooling

  Extend specific commands and shortcuts to ease migration.

Usage:
  extend <COMMAND>

Commands:
  clone-template       Clone a starter template for Extend apps
  docker-login         Log in to the Extend container registry
  image-upload         Build and push a container image to the Extend registry
  tunnel               Open a TCP tunnel to an Extend app pod
  update-secret        Update or create a CSM app secret
  update-var           Update or create a CSM app configuration variable
  create-app           Create an Extend app (→ ags csm apps create)
  get-app-info         Show Extend app details (→ ags csm apps get)
  list-images          List container images for an Extend app (→ ags csm images list)
  deploy-app           Deploy an Extend app (→ ags csm deployments create)
  start-app            Start an Extend app (→ ags csm apps start)
  stop-app             Stop an Extend app (→ ags csm apps stop)
  delete-app           Delete an Extend app (→ ags csm apps delete)
  app-ui               App UI commands
  security-assessment  Pen-testing engagement requests and reports for Extend apps
  remote-debug         Remote debug commands

Options:
  -h, --help
          Print help (see a summary with '-h')
```

## `ags extend clone-template`

```
Clone a starter template for Extend apps.

Without --template, prompts interactively through scenario,
template, and language selection. Use --template for CI/scripted use.

Usage:
  extend clone-template [OPTIONS]

Options:
      --template <name>
          Select a template by name (non-interactive)

  -d, --destination <path>
          Destination directory

      --depth <n>
          Shallow clone depth (default: 1, 0 for full)

  -h, --help
          Print help (see a summary with '-h')
```

## `ags extend docker-login`

```
Log in to the Extend container registry.

Fetches short-lived registry credentials from the Extend Helper
Service and passes them to `docker login --password-stdin`.

With --print, writes the credentials to stdout instead of
running Docker.

Usage:
  ags extend docker-login [OPTIONS] --app <app>

Options:
  -a, --app <app>
          Extend app name

  -p, --print
          Print credentials to stdout instead of running docker login

      --print-format <json|token>
          Output format for --print
          
          [default: json]

  -l, --login
          Accepted for backward compatibility, ignored

      --verbosity <level>
          Accepted for backward compatibility, ignored
          
          [default: info]

  -h, --help
          Print help (see a summary with '-h')

Global flags:
  -n, --namespace <namespace>  Game namespace

Use 'ags --help' for all global flags.
```

## `ags extend image-upload`

```
Build and push a container image to the Extend registry

Usage:
  image-upload [OPTIONS] --app <app> --image-tag <tag>

Options:
  -a, --app <app>                 Extend app name
  -t, --image-tag <tag>           Image tag to build and push
  -f, --dockerfile <path>         Path to the Dockerfile [default: Dockerfile]
  -p, --platform <platform>       Target platform(s) [default: linux/amd64]
  -w, --work-dir <path>           Build context directory
  -l, --login                     Authenticate to the registry before building
      --retry-limit <n>           Number of retries on failure (0 = no retries) [default: 0]
      --retry-interval <seconds>  Base interval between retries in seconds [default: 1.0]
      --retry-rate <rate>         Exponential backoff rate multiplier [default: 2.0]
  -h, --help                      Print help (see more with '--help')

Global flags:
  -n, --namespace <namespace>  Game namespace
      --dry-run                    Preview without executing

Use 'ags --help' for all global flags.
```

## `ags extend tunnel`

```
Open a TCP tunnel to an Extend app pod.

Binds a local TCP port and bridges connections to the CSM v2
tunnel endpoint via WebSocket. Each accepted connection resolves
a fresh access token and opens its own WebSocket session.

The tunnel runs until Ctrl-C.

Usage:
  extend tunnel [OPTIONS] --resource-name <name> --local-port <port>

Options:
      --resource-name <name>
          Extend resource name to tunnel to

      --local-port <port>
          Local TCP port to bind (localhost only)

      --pod-name <pod>
          Target pod name (optional)

  -h, --help
          Print help (see a summary with '-h')

Global flags:
  -n, --namespace <namespace>  Game namespace

Use 'ags --help' for all global flags.
```

## `ags extend update-secret`

```
Update or create a CSM app secret.

Updates the secret named --key to --value if it exists. If it
does not exist, pass --force to create it. --sensitive and
--description are merged with the existing record when not
explicitly supplied: an unset --sensitive preserves the existing
mask (or defaults to true on create), an unset --description
preserves the existing description.

Prefer --value-stdin over --value to avoid exposing the secret
in shell history.

Usage:
  extend update-secret [OPTIONS] --app <app> --key <key>

Options:
  -a, --app <app>
          Extend app name

      --key <key>
          Secret name

      --value <value>
          Secret value (insecure — visible in shell history)

      --value-stdin
          Read secret value from stdin

      --description <text>
          Secret description (preserved from the existing record if not supplied)

      --sensitive [<sensitive>]
          Mask the secret's value (defaults to true; preserved from the existing record on update if not supplied; pass 'false' explicitly to remove masking)
          
          [possible values: true, false]

      --force
          Create the secret if --key does not name an existing one

  -h, --help
          Print help (see a summary with '-h')

Global flags:
  -n, --namespace <namespace>  Game namespace
      --dry-run                    Preview without executing

Use 'ags --help' for all global flags.
```

## `ags extend update-var`

```
Update or create a CSM app configuration variable.

Updates the variable named --key to --value if it exists. If it
does not exist, pass --force to create it. --sensitive and
--description are merged with the existing record when not
explicitly supplied: an unset --sensitive preserves the existing
mask, an unset --description preserves the existing description.
Pass --sensitive false explicitly to remove masking.

Prefer --value-stdin over --value to avoid exposing the value
in shell history.

Usage:
  extend update-var [OPTIONS] --app <app> --key <key>

Options:
  -a, --app <app>
          Extend app name

      --key <key>
          Variable name

      --value <value>
          Variable value (visible in shell history)

      --value-stdin
          Read variable value from stdin

      --description <text>
          Variable description (preserved from the existing record if not supplied)

      --sensitive [<sensitive>]
          Mask the variable's value (defaults to false when creating; preserved from the existing record on update if not supplied; pass 'false' explicitly to remove masking)
          
          [possible values: true, false]

      --force
          Create the variable if --key does not name an existing one

  -h, --help
          Print help (see a summary with '-h')

Global flags:
  -n, --namespace <namespace>  Game namespace
      --dry-run                    Preview without executing

Use 'ags --help' for all global flags.
```

## `ags extend create-app`

```
Create an Extend app

Required permission : `ADMIN:NAMESPACE:{namespace}:EXTEND:APP [CREATE]`

Creates a new extend app with the name given by the `{app}` path parameter and the specified scenario type.

Available scenarios:
- `function-override` (scenario 1)
- `service-extension` (scenario 2)
- `event-handler` (scenario 3)

Requires permission:
  CREATE on ADMIN:NAMESPACE:{namespace}:EXTEND:APP

Canonical command: ags csm apps create
This shortcut forwards to it. Both addresses are supported.

Default contract:
  scope:   admin
  version: v5

Usage:
  ags extend create-app [OPTIONS]

Options:
      --app <app>
          Required. App Name. Expected format: (^A-Za-z (?:[A-Za-z0-9\-]*[A-Za-z0-9])?$)

      --namespace <namespace>
          Required. Game Namespace

      --json <json>
          JSON request body (CreateAppV5Request)
          
          Input:
            --json @path/to.json   read JSON from a file
            --json @-              read JSON from stdin (avoids shell quoting issues)
            --json '{...}'         inline JSON
            In PowerShell, quote the @ form: --json '@path/to.json' (a bare @ is a splat operator)
          
          Schema:
            {
              *"scenario": <string>,
               "autoscaling": {  <AutoscalingRequest>
                *"targetCPUUtilizationPercent": <integer>
              },
               "cpu": {  <CPURequest>
                *"requestCPU": <integer>
              },
               "description": <string>,
               "memory": {  <MemoryRequest>
                 "requestMemory": <integer>
              },
               "preferred_k8s_namespace": <string>,
               "replica": {  <ReplicaRequest>
                 "maxReplica": <integer>,
                 "minReplica": <integer>
              },
               "vmSharingConfiguration": <string>
            }
          
          Example:
              {
                "autoscaling": {
                  "targetCPUUtilizationPercent": 1
                },
                "cpu": {
                  "requestCPU": 14
                },
                "description": "my-description",
                "memory": {
                  "requestMemory": 83
                },
                "preferred_k8s_namespace": "my-preferred-k8s-namespace",
                "replica": {
                  "maxReplica": 71,
                  "minReplica": 29
                },
                "scenario": "my-scenario",
                "vmSharingConfiguration": "my-vm-sharing-configuration"
              }

      --api-version <api-version>
          Select the CLI API version for this command
          
          [default: v5]
          [possible values: v2, v5]

      --wait
          Wait until the app reaches a terminal state before returning

      --wait-interval <SECONDS>
          Seconds between status polls while waiting (default 10)

      --wait-limit <SECONDS>
          Maximum seconds to wait before giving up (default 600)

  -h, --help
          Print help (see a summary with '-h')

Example:
  ags extend create-app --app 'my-app' --namespace 'my-namespace' --json '{...}'
```

## `ags extend get-app-info`

```
Show Extend app details

Retrieves details of the extend app by name, including its current deployment status and scenario type.

Canonical command: ags csm apps get
This shortcut forwards to it. Both addresses are supported.

Default contract:
  scope:   admin
  version: v5

Usage:
  ags extend get-app-info [OPTIONS]

Options:
      --app <app>
          Required. App Name

      --namespace <namespace>
          Required. Game Namespace

      --api-version <api-version>
          Select the CLI API version for this command
          
          [default: v5]
          [possible values: v2, v5]

  -h, --help
          Print help (see a summary with '-h')

Example:
  ags extend get-app-info --app 'my-app' --namespace 'my-namespace'
```

## `ags extend list-images`

```
List container images for an Extend app

Required permission : `ADMIN:NAMESPACE:{namespace}:EXTEND:IMAGE [READ]`

Get a list of container images

Default 'cached' parameter is 'true'

Canonical command: ags csm images list
This shortcut forwards to it. Both addresses are supported.

Default contract:
  scope:   admin
  version: v5

Usage:
  ags extend list-images [OPTIONS]

Options:
      --app <app>
          Required. App Name

      --namespace <namespace>
          Required. Game Namespace

      --cached <cached>
          Get Cached Images

      --api-version <api-version>
          Select the CLI API version for this command
          
          [default: v5]
          [possible values: v2, v5]

  -h, --help
          Print help (see a summary with '-h')

Example:
  ags extend list-images --app 'my-app' --namespace 'my-namespace' --cached 'my-cached'
```

## `ags extend deploy-app`

```
Deploy an Extend app

Creates a new deployment for the extend app and applies all configured secrets and variables as environment variables.

Canonical command: ags csm deployments create
This shortcut forwards to it. Both addresses are supported.

Default contract:
  scope:   admin
  version: v5

Usage:
  ags extend deploy-app [OPTIONS]

Options:
      --app <app>
          Required. App Name

      --namespace <namespace>
          Required. Game Namespace

      --json <json>
          JSON request body (CreateDeploymentV5Request)
          
          Input:
            --json @path/to.json   read JSON from a file
            --json @-              read JSON from stdin (avoids shell quoting issues)
            --json '{...}'         inline JSON
            In PowerShell, quote the @ form: --json '@path/to.json' (a bare @ is a splat operator)
          
          Schema:
            {
              *"imageTag": <string>
            }
          
          Example:
              {
                "imageTag": "my-image-tag"
              }

      --api-version <api-version>
          Select the CLI API version for this command
          
          [default: v5]
          [possible values: v2, v5]

      --wait
          Wait until the app reaches a terminal state before returning

      --wait-interval <SECONDS>
          Seconds between status polls while waiting (default 10)

      --wait-limit <SECONDS>
          Maximum seconds to wait before giving up (default 600)

  -h, --help
          Print help (see a summary with '-h')

Example:
  ags extend deploy-app --app 'my-app' --namespace 'my-namespace' --json '{...}'
```

## `ags extend start-app`

```
Start an Extend app

Required permission : `ADMIN:NAMESPACE:{namespace}:EXTEND:APP [UPDATE]`

Starts the Application

Canonical command: ags csm apps start
This shortcut forwards to it. Both addresses are supported.

Default contract:
  scope:   admin
  version: v5

Usage:
  ags extend start-app [OPTIONS]

Options:
      --app <app>
          Required. App Name. Expected format: (^A-Za-z (?:[A-Za-z0-9\-]*[A-Za-z0-9])?$)

      --namespace <namespace>
          Required. Game Namespace

      --api-version <api-version>
          Select the CLI API version for this command
          
          [default: v5]
          [possible values: v2, v5]

      --wait
          Wait until the app reaches a terminal state before returning

      --wait-interval <SECONDS>
          Seconds between status polls while waiting (default 10)

      --wait-limit <SECONDS>
          Maximum seconds to wait before giving up (default 600)

  -h, --help
          Print help (see a summary with '-h')

Example:
  ags extend start-app --app 'my-app' --namespace 'my-namespace'
```

## `ags extend stop-app`

```
Stop an Extend app

Required permission : `ADMIN:NAMESPACE:{namespace}:EXTEND:APP [UPDATE]`

Stops the Application

Canonical command: ags csm apps stop
This shortcut forwards to it. Both addresses are supported.

Default contract:
  scope:   admin
  version: v5

Usage:
  ags extend stop-app [OPTIONS]

Options:
      --app <app>
          Required. App Name. Expected format: (^A-Za-z (?:[A-Za-z0-9\-]*[A-Za-z0-9])?$)

      --namespace <namespace>
          Required. Game Namespace

      --api-version <api-version>
          Select the CLI API version for this command
          
          [default: v5]
          [possible values: v2, v5]

      --wait
          Wait until the app reaches a terminal state before returning

      --wait-interval <SECONDS>
          Seconds between status polls while waiting (default 10)

      --wait-limit <SECONDS>
          Maximum seconds to wait before giving up (default 600)

  -h, --help
          Print help (see a summary with '-h')

Example:
  ags extend stop-app --app 'my-app' --namespace 'my-namespace'
```

## `ags extend delete-app`

```
Delete an Extend app

Deletes the extend app and all associated configuration, deployments, and cluster resources.
If `forced` is `true`, the deletion proceeds regardless of the app's current status.

Canonical command: ags csm apps delete
This shortcut forwards to it. Both addresses are supported.

Default contract:
  scope:   admin
  version: v5

Usage:
  ags extend delete-app [OPTIONS]

Options:
      --app <app>
          Required. App Name

      --namespace <namespace>
          Required. Game Namespace

      --forced <forced>
          Force app deletion, if 'true' will proceed delete regardless of current app status (default: false)

      --api-version <api-version>
          Select the CLI API version for this command
          
          [default: v5]
          [possible values: v2, v5]

      --wait
          Wait until the app reaches a terminal state before returning

      --wait-interval <SECONDS>
          Seconds between status polls while waiting (default 10)

      --wait-limit <SECONDS>
          Maximum seconds to wait before giving up (default 600)

  -h, --help
          Print help (see a summary with '-h')

Example:
  ags extend delete-app --app 'my-app' --namespace 'my-namespace' --forced 'my-forced'
```

## `ags extend app-ui`

```
App UI commands

Usage:
  extend app-ui <COMMAND>

Commands:
  create     Create an Extend app UI (→ ags csm app-ui create) (was: appui create)
  setup-env  Set up the .env.local file for an App UI project
  upload     Build and upload an App UI static-asset bundle

Options:
  -h, --help  Print help
```

## `ags extend app-ui create`

```
Create an Extend app UI

Creates a new App UI configuration. The App UI can be hosted by AccelByte (the default) or externally.

Canonical command: ags csm app-ui create
This shortcut forwards to it. Both addresses are supported.

Default contract:
  scope:   admin
  version: v1

Usage:
  ags extend app-ui create [OPTIONS]

Options:
      --namespace <namespace>
          Required. Game Namespace

      --json <json>
          JSON request body (CreateAppUIRequest)
          
          Input:
            --json @path/to.json   read JSON from a file
            --json @-              read JSON from stdin (avoids shell quoting issues)
            --json '{...}'         inline JSON
            In PowerShell, quote the @ form: --json '@path/to.json' (a bare @ is a splat operator)
          
          Schema:
            {
              *"name": <string>
            }
          
          Example:
              {
                "name": "my-name"
              }

  -h, --help
          Print help (see a summary with '-h')

Example:
  ags extend app-ui create --namespace 'my-namespace' --json '{...}'
```

## `ags extend app-ui setup-env`

```
Set up the .env.local file for an App UI project.

Reads the App UI record from CSM and writes the four VITE_AB_*
environment variables into .env.local in the project directory.

If .env.example exists, its contents are used as a template and
only the managed keys are replaced or appended. Comments, blank
lines, and unmanaged keys are preserved.

Usage:
  extend app-ui setup-env [OPTIONS] --name <name>

Options:
      --name <name>
          App UI name

      --project-path <path>
          Project directory (default: current directory)
          
          [default: .]

      --force
          Overwrite existing .env.local

  -h, --help
          Print help (see a summary with '-h')
```

## `ags extend app-ui upload`

```
Build and upload an App UI static-asset bundle.

Runs the frontend build, archives the output directory into a zip,
and uploads the archive to CSM. With --no-build, skips the build step
and archives the existing build output directly.

Usage:
  extend app-ui upload [OPTIONS] --name <name>

Options:
      --name <name>
          App UI name

      --project-path <path>
          Project directory (default: current directory)
          
          [default: .]

      --build-path <path>
          Build output directory, relative to project path (default: dist)
          
          [default: dist]

      --build-version <version>
          Build version identifier (default: random 8-char hex)

      --no-build
          Skip the frontend build step

      --verbosity <level>
          Accepted for backward compatibility, ignored
          
          [default: info]

  -h, --help
          Print help (see a summary with '-h')

Global flags:
  -n, --namespace <namespace>  Game namespace
      --dry-run                    Preview without executing

Use 'ags --help' for all global flags.
```

## `ags extend security-assessment`

```
Pen-testing engagement requests and reports for Extend apps

Usage:
  extend security-assessment <COMMAND>

Commands:
  list            List security-assessment engagements for a namespace (→ ags csm security-assessment list)
  list-endpoints  Discover an Extend app's testable endpoints and required permissions (→ ags csm security-assessment get-app-endpoints)
  result          Download a completed security-assessment engagement's report
  request         Request a security assessment (pen-testing engagement) for an Extend app

Options:
  -h, --help  Print help
```

## `ags extend security-assessment list`

```
List security-assessment engagements for a namespace

Lists pen-testing requests submitted for Extend apps in this game namespace.
This is a live proxy over ASA's engagement list, so status and findings always reflect ASA's current state.

Requires permission:
  READ on ADMIN:NAMESPACE:{namespace}:EXTEND:SECURITYASSESSMENT

Canonical command: ags csm security-assessment list
This shortcut forwards to it. Both addresses are supported.

Default contract:
  scope:   admin
  version: v1

Usage:
  ags extend security-assessment list [OPTIONS]

Options:
      --namespace <namespace>
          Required. Game Namespace

  -h, --help
          Print help (see a summary with '-h')

Example:
  ags extend security-assessment list --namespace 'my-namespace'
```

## `ags extend security-assessment list-endpoints`

```
Discover an Extend app's testable endpoints and required permissions

Returns the endpoint list of a Service Extension app's exposed API, with each endpoint's required permission auto-discovered from the app's OpenAPI spec (`x-required-permission`) or, as a fallback, gRPC server reflection.
Used to populate the pen-testing request form.
Rejected with `404 Not Found` when the app doesn't exist in this namespace.
When the app is not running, or has no reachable OpenAPI spec, discovery is skipped and this still returns `200 OK`, with isAppRunning/hasAPISpec reflecting that state rather than erroring.

Requires permission:
  READ on ADMIN:NAMESPACE:{namespace}:EXTEND:APP

Canonical command: ags csm security-assessment get-app-endpoints
This shortcut forwards to it. Both addresses are supported.

Default contract:
  scope:   admin
  version: v1

Usage:
  ags extend security-assessment list-endpoints [OPTIONS]

Options:
      --app-name <app-name>
          Required. App Name. Expected format: (^A-Za-z (?:[A-Za-z0-9\-]*[A-Za-z0-9])?$)

      --namespace <namespace>
          Required. Game Namespace

  -h, --help
          Print help (see a summary with '-h')

Example:
  ags extend security-assessment list-endpoints --app-name 'my-app-name' --namespace 'my-namespace'
```

## `ags extend security-assessment result`

```
Download a completed security-assessment engagement's report

Usage:
  extend security-assessment result [OPTIONS] --app <app>

Options:
  -a, --app <app>               Extend app name
      --report-format <pdf|md>  Report file format [default: pdf]
  -o, --report-output <path>    Local file path to write the report to (default: <app>-<engagementId>-report.<ext>)
      --engagement-id <id>      Engagement id to fetch the report for, skipping the interactive picker
  -h, --help                    Print help

Global flags:
  -n, --namespace <namespace>  Game namespace

Use 'ags --help' for all global flags.
```

## `ags extend security-assessment request`

```
Request a security assessment (pen-testing engagement) for an Extend app.

Discovers the app's testable endpoints and, without --all-endpoints or
--operation-ids, prompts interactively through a checklist to choose which
to include and to supply permissions where none was auto-discovered.

Warns before submitting if any selected endpoint can modify or delete data.

With --wait, blocks after submitting until the engagement reaches a terminal
state (COMPLETED or FAILED), polling every 10s up to --wait-limit seconds
(default 1800) and printing the current status each poll (suppressed by
--quiet). A Ctrl-C during the wait only stops the local wait — the engagement
keeps running; check its status later with
'ags extend security-assessment list --namespace <namespace>'.

Usage:
  extend security-assessment request [OPTIONS] --app <app>

Options:
  -a, --app <app>
          Extend app name

      --all-endpoints
          Select every discovered endpoint (non-interactive)

      --operation-ids <id1,id2,...>
          Select exactly these endpoints by operation id (non-interactive)

      --permission <operationId=RESOURCE [ACTION]>
          Permission override for one endpoint, repeatable

      --wait
          Block until the engagement reaches a terminal state (COMPLETED or FAILED)

      --wait-limit <SECONDS>
          Maximum seconds to wait before giving up (default 1800)

  -h, --help
          Print help (see a summary with '-h')

Global flags:
  -n, --namespace <namespace>  Game namespace
      --yes                        Skip the mutating-endpoint confirmation
      --dry-run                    Preview without requesting an assessment

Use 'ags --help' for all global flags.
```

## `ags extend remote-debug`

```
Remote debug commands

Usage:
  extend remote-debug <COMMAND>

Commands:
  connect  Connect to an Extend remote debug session
  enable   Enable remote debugging for an Extend app
  disable  Disable remote debugging for an Extend app

Options:
  -h, --help  Print help
```

## `ags extend remote-debug connect`

```
Connect to an Extend remote debug session.

Resolves debug info from the CSM API, evaluates preconditions,
and reconnects established sessions with exponential backoff.

Requires the app to be running and debug mode to be enabled
(see 'ags extend remote-debug enable').

Usage:
  extend remote-debug connect [OPTIONS] --app <app>

Options:
  -a, --app <app>
          Extend app name

      --local-grpc-port <addr>
          Local gRPC address or bare port
          
          [default: localhost:6565]

      --local-http-port <addr>
          Local HTTP address or bare port
          
          [default: localhost:8000]

  -h, --help
          Print help (see a summary with '-h')

Global flags:
  -n, --namespace <namespace>  Game namespace

Use 'ags --help' for all global flags.
```

## `ags extend remote-debug enable`

```
Enable remote debugging for an Extend app.

Emits a performance warning, checks whether the app is currently
running, and prompts for confirmation when it is (because enabling
debug mode restarts the app). Use --yes to skip the prompt.

Usage:
  extend remote-debug enable --app <app>

Options:
  -a, --app <app>
          Extend app name

  -h, --help
          Print help (see a summary with '-h')

Global flags:
  -n, --namespace <namespace>  Game namespace
  -y, --yes                    Skip confirmation prompt

Use 'ags --help' for all global flags.
```

## `ags extend remote-debug disable`

```
Disable remote debugging for an Extend app.

Checks whether the app is currently running and prompts for
confirmation when it is (because disabling debug mode restarts
the app). Use --yes to skip the prompt.

Usage:
  extend remote-debug disable --app <app>

Options:
  -a, --app <app>
          Extend app name

  -h, --help
          Print help (see a summary with '-h')

Global flags:
  -n, --namespace <namespace>  Game namespace
  -y, --yes                    Skip confirmation prompt

Use 'ags --help' for all global flags.
```
