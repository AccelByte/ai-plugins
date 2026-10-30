---
last-verified: 2026-10-26
authoritative: true
note: --help output captured from an installed `ags` binary (ags 0.5.3 (workflow protocol
  1.0.0)). This is the ground-truth grounding artifact every other CLI claim in this
  skill defers to.
sources:
- https://github.com/AccelByte/accelbyte-ags-cli
see-also:
- '[cli-commands.md](../deploy/cli-commands.md)'
---

# `ags extend` — `--help` output (authoritative grounding artifact)

Captured: 2026-10-26. Source: installed binary, `ags 0.5.3 (workflow protocol 1.0.0)`.

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
  docker-login         Log in to the Extend app container registry
  image-upload         Build and push an Extend app container image
  database-tunnel      Connect to an Extend database from your machine
  update-secret        Create or update an Extend app environment secret
  update-var           Create or update an Extend app environment variable
  create-app           Create an Extend app (→ ags csm apps create)
  get-app-info         Show Extend app details (→ ags csm apps get)
  list-images          List container images for an Extend app (→ ags csm images list)
  deploy-app           Deploy an Extend app (→ ags csm deployments create)
  start-app            Start an Extend app (→ ags csm apps start)
  stop-app             Stop an Extend app (→ ags csm apps stop)
  delete-app           Delete an Extend app (→ ags csm apps delete)
  app-ui               Extend App UI commands
  security-assessment  Pen-testing engagement requests and reports for Extend apps
  remote-debug         Remote Debug commands
  logs                 Extend app logs

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
Log in to the Extend app container registry.

Gets short-lived credentials for one Extend app and runs
`docker login`.

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
Build and push an Extend app container image

Usage:
  image-upload [OPTIONS] --app <app> --image-tag <tag>

Options:
  -a, --app <app>                 Extend app name
  -t, --image-tag <tag>           Image tag to build and push
  -f, --dockerfile <path>         Path to the Dockerfile [default: Dockerfile]
  -p, --platform <platform>       Target platform(s) [default: linux/amd64]
  -w, --work-dir <path>           Build context directory
  -l, --login                     Log in to the registry before building
      --retry-limit <n>           Number of retries on failure (0 = no retries) [default: 0]
      --retry-interval <seconds>  Base interval between retries in seconds [default: 1.0]
      --retry-rate <rate>         Exponential backoff rate multiplier [default: 2.0]
  -h, --help                      Print help (see more with '--help')

Global flags:
  -n, --namespace <namespace>  Game namespace
      --dry-run                    Preview without executing

Use 'ags --help' for all global flags.
```

## `ags extend database-tunnel`

```
Connect to an Extend database from your machine.

Opens a port on localhost and forwards it to a NoSQL, SQL, or
Key Value Store database. Use the Resource Name shown on that
database's page in the Admin Portal. The command keeps running
until you press Ctrl-C.

Usage:
  extend database-tunnel --resource-name <name> --local-port <port>

Options:
  -r, --resource-name <name>
          Resource Name from the database page in the Admin Portal

  -p, --local-port <port>
          Port on localhost for your database client

  -h, --help
          Print help (see a summary with '-h')

Global flags:
  -n, --namespace <namespace>  Game namespace

Use 'ags --help' for all global flags.
```

## `ags extend update-secret`

```
Create or update an Extend app environment secret.

Sets the secret named --key to --value when it already exists.
Pass --force to create it when it does not. When --sensitive or
--description is omitted, the current setting is kept. A new
secret is masked unless you pass --sensitive false.

Prefer --value-stdin over --value so the secret is not saved in
shell history.

Usage:
  extend update-secret [OPTIONS] --app <app> --key <key>

Options:
  -a, --app <app>
          Extend app name

      --key <key>
          Environment secret name

      --value <value>
          Secret value (insecure — visible in shell history)

      --value-stdin
          Read secret value from stdin

      --description <text>
          Secret description (kept when omitted)

      --sensitive [<sensitive>]
          Mask the value. Defaults to true. On update, the current setting is kept when omitted. Pass false to stop masking.
          
          [possible values: true, false]

      --force
          Create the secret when --key does not exist yet

  -h, --help
          Print help (see a summary with '-h')

Global flags:
  -n, --namespace <namespace>  Game namespace
      --dry-run                    Preview without executing

Use 'ags --help' for all global flags.
```

## `ags extend update-var`

```
Create or update an Extend app environment variable.

Sets the variable named --key to --value when it already exists.
Pass --force to create it when it does not. When --sensitive or
--description is omitted, the current setting is kept. Pass
--sensitive false to stop masking the value.

Prefer --value-stdin over --value so the value is not saved in
shell history.

Usage:
  extend update-var [OPTIONS] --app <app> --key <key>

Options:
  -a, --app <app>
          Extend app name

      --key <key>
          Environment variable name

      --value <value>
          Variable value (visible in shell history)

      --value-stdin
          Read variable value from stdin

      --description <text>
          Variable description (kept when omitted)

      --sensitive [<sensitive>]
          Mask the value. Defaults to false when creating. On update, the current setting is kept when omitted. Pass false to stop masking.
          
          [possible values: true, false]

      --force
          Create the variable when --key does not exist yet

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
Extend App UI commands

Usage:
  extend app-ui <COMMAND>

Commands:
  create     Create an Extend App UI (→ ags csm app-ui create) (was: appui create)
  setup-env  Write .env.local for an Extend App UI
  upload     Build and upload an Extend App UI

Options:
  -h, --help  Print help
```

## `ags extend app-ui create`

```
Create an Extend App UI

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
Write .env.local for an Extend App UI.

Reads the App UI's public client settings and writes the four
VITE_AB_* variables into .env.local in the project directory.

If .env.example exists, it is used as the template and only those
keys are replaced or appended. Comments, blank lines, and other
keys are kept.

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
Build and upload an Extend App UI.

Runs the frontend build, archives the output, and uploads it.
With --no-build, skips the build and archives the existing output.

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
  list            List security assessment sessions for a namespace (→ ags csm security-assessment list)
  list-endpoints  Discover an Extend app's testable endpoints and required permissions (→ ags csm security-assessment get-app-endpoints)
  result          Download a completed security assessment report
  request         Request a security assessment for an Extend app

Options:
  -h, --help  Print help
```

## `ags extend security-assessment list`

```
List security assessment sessions for a namespace

Lists the security assessment sessions for this game namespace, with each session's current status.

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

Lists the endpoints on an Extend Service Extension app, and each endpoint's permission when it can be read from the app's API spec.

Returns no endpoints to test when the app is stopped or its API spec cannot be reached. Fails when the app does not exist.

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
Download a completed security assessment report

Usage:
  extend security-assessment result [OPTIONS] --app <app>

Options:
  -a, --app <app>               Extend app name
      --report-format <pdf|md>  Report file format [default: pdf]
  -o, --report-output <path>    Local file path to write the report to (default: <app>-<engagementId>-report.<ext>)
      --engagement-id <id>      Engagement (session) id of the report to download, skipping the picker
  -h, --help                    Print help

Global flags:
  -n, --namespace <namespace>  Game namespace

Use 'ags --help' for all global flags.
```

## `ags extend security-assessment request`

```
Request a security assessment for an Extend app.

Lists the app's testable endpoints. Without --all-endpoints or
--operation-ids, prompts a checklist so you can choose which to
include and fill in permissions that were not discovered
automatically.

Warns before submitting if any selected endpoint can modify or
delete data.

With --wait, waits until the session reaches COMPLETED or FAILED,
polling every 10s up to --wait-limit seconds (default 1800) and
printing the current status each poll (hidden with --quiet).
Ctrl-C stops only the local wait. The session keeps running;
check it later with
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
          Wait until the session reaches COMPLETED or FAILED

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
Remote Debug commands

Usage:
  extend remote-debug <COMMAND>

Commands:
  connect  Connect Remote Debug to your machine
  enable   Enable Remote Debug for an Extend app
  disable  Disable Remote Debug for an Extend app

Options:
  -h, --help  Print help
```

## `ags extend remote-debug connect`

```
Connect Remote Debug to your machine.

Routes the Extend app's live traffic to your local app so you
can debug it without rebuilding or redeploying the image. The
app must be running and Remote Debug must be enabled
(see 'ags extend remote-debug enable'). The command keeps
running until you press Ctrl-C.

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
Enable Remote Debug for an Extend app.

Warns that Remote Debug can slow the app down. If the app is
running, asks you to confirm, because enabling Remote Debug
restarts the app. Pass --yes to skip the prompt.

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
Disable Remote Debug for an Extend app.

If the app is running, asks you to confirm, because disabling
Remote Debug restarts the app. Pass --yes to skip the prompt.

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

## `ags extend logs`

```
Extend app logs

Usage:
  extend logs <COMMAND>

Commands:
  stream  Stream an Extend app's container logs

Options:
  -h, --help  Print help
```

## `ags extend logs stream`

```
Stream an Extend app's container logs.

Prints each log line. Without --follow, prints recent lines and
exits. With --follow, keeps printing new lines until you press
Ctrl-C.

With --format json and --follow, each line is one JSON object
and the command does not exit on its own.

Usage:
  extend logs stream [OPTIONS] --app <app>

Options:
  -a, --app <app>
          Extend app name

  -f, --follow
          Keep the connection open and print new lines as they arrive

      --tail-lines <lines>
          Number of recent lines to fetch per pod
          
          [default: 100]
          [alias: --tail]

      --pods <count>
          Maximum number of pods to stream from
          
          [default: 1]

      --since-seconds <seconds>
          Only return logs newer than this many seconds

      --previous
          Logs of each pod's previous container instance. A pod whose container has not restarted prints no log lines; the server says why when that pod's stream finishes

  -h, --help
          Print help (see a summary with '-h')

Global flags:
  -n, --namespace <namespace>  Game namespace

Use 'ags --help' for all global flags.
```
