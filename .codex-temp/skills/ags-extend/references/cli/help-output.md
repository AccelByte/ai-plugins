---
last-verified: 2026-07-20
authoritative: true
note: --help output captured from the extend-helper-cli binary, as captured except
  for the one host-specific default noted in the body. This is the ground-truth grounding
  artifact every other CLI claim in this skill defers to.
sources:
- https://github.com/AccelByte/extend-helper-cli
see-also:
- '[cli-commands.md](../deploy/cli-commands.md)'
---

# extend-helper-cli — `--help` output (authoritative grounding artifact)

Captured: 2026-07-20. Source: `https://github.com/AccelByte/extend-helper-cli/releases/latest/download/extend-helper-cli-darwin_arm64`.

This file is the output of `extend-helper-cli --help` for every subcommand, and the ground truth for CLI syntax — `references/deploy/cli-commands.md` is its readable restatement.

One substitution: `--ssh-path` prints a default built from the home directory of whoever runs it, so the capture host's own path is replaced with `/Users/you/.ssh/id_rsa`. On your machine the CLI prints yours. Everything else is as captured.

## Top-level

```
NAME:
   extend-helper-cli - AccelByte Docker Image Upload Helper CLI Tool

USAGE:
   extend-helper-cli [global options] command [command options] [arguments...]

VERSION:
   v0.0.13

COMMANDS:
   dockerlogin     Log in to the Extend docker registry.
   image-upload    Build and upload a docker image.
   create-app      Create app.
   get-app-info    Get app information.
   list-images     List container images for an Extend App.
   deploy-app      Deploy app.
   start-app       Start app.
   stop-app        Stop app.
   delete-app      Delete app.
   update-var      Update variable.
   update-secret   Update secret.
   clone-template  Clone a Git repository template to a local destination
   tunnel          Start listening on user’s local port. Forwards traffic to the specified database resource through a tunnel.
   remote-debug    Manage remote debug sessions for an Extend app
   login           Log in to AccelByte using browser-based authentication (OAuth 2.0 with PKCE).
   logout          Log out and clear saved credentials.
   status          Show current authentication status.
   appui           Extend App UI feature commands
   help, h         Shows a list of commands or help for one command

GLOBAL OPTIONS:
   --output value  Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h      show help
   --version, -v   print the version
```

## `dockerlogin`

```
NAME:
   extend-helper-cli dockerlogin - Log in to the Extend docker registry.

USAGE:
   extend-helper-cli dockerlogin [command options] [arguments...]

DESCRIPTION:
   Fetches registry credentials for (namespace/app) and runs 'docker login' by default.
   Use --print to emit the credentials to stdout instead (controlled by --format) without logging in.

OPTIONS:
   --namespace value, -n value  Game Namespace.
   --app value, -a value        Extend App Name.
   --verbosity value, -v value  Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --login, -l                  Immediately run 'docker login' command with credentials returned from (namespace/app). (default: false)
   --print, -p                  Print registry credentials to stdout instead of running 'docker login'. Shape controlled by --format. (default: false)
   --format value, -f value     Output format for --print: "json" (default, full credentials) or "token" (raw password only). (default: "json")
   --output value               Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                   show help
```

## `image-upload`

```
NAME:
   extend-helper-cli image-upload - Build and upload a docker image.

USAGE:
   extend-helper-cli image-upload [command options] [arguments...]

OPTIONS:
   --namespace value, -n value                                Game Namespace.
   --app value, -a value                                      Extend App Name.
   --image-tag value, -t value                                Extend App Image Tag.
   --verbosity value, -v value                                Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --dry-run                                                  Whether or not this is a dry-run. (default: false)
   --login, -l                                                Immediately run 'docker login' command with credentials returned from (namespace/app). (default: false)
   --retry-interval value                                     Base delay between retries. Default: 1.0 (default: 1)
   --retry-limit value                                        Max number of retries. Default: 0 (default: 0)
   --retry-rate value                                         Exponential backoff rate for retries. Default: 2.0 (default: 2)
   --dockerfile value, -f value                               Dockerfile name. (default: "Dockerfile")
   --platform value, -p value [ --platform value, -p value ]  Image platform(s). (default: "linux/amd64")
   --work-dir value, -w value                                 Work directory, defaults to calling process's current directory.
   --output value                                             Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                                                 show help
```

## `create-app`

```
NAME:
   extend-helper-cli create-app - Create app.

USAGE:
   extend-helper-cli create-app [command options] [arguments...]

OPTIONS:
   --namespace value, -n value  Game Namespace.
   --app value, -a value        Extend App Name.
   --scenario value, -s value   App Scenario. (event-handler, function-override, service-extension)
   --verbosity value, -v value  Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --confirm                    Whether or not to automatically accept any confirmation prompt(s). (default: false)
   --description value          Description.
   --wait                       Whether or not to wait for a command's completion. (default: false)
   --wait-interval value        Wait poll interval. Default: 10 seconds. (default: 10)
   --wait-limit value           Max duration to wait for a command's completion. Once exceeded it will exit the command. Default: 600 seconds. (default: 600)
   --cpu value                  CPU Resources. Max 1550 millicores. 1 CPU unit equals one physical or virtual core. Use millicores for fractions, where 1 CPU = 1,000m. [60-1550] (default: 1000)
   --memory value               Memory Resources. In Megabytes. [100-3300] (default: 350)
   --output value               Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                   show help
```

## `get-app-info`

```
NAME:
   extend-helper-cli get-app-info - Get app information.

USAGE:
   extend-helper-cli get-app-info [command options] [arguments...]

OPTIONS:
   --namespace value, -n value  Game Namespace.
   --app value, -a value        Extend App Name.
   --verbosity value, -v value  Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --path value                 Json Path. (default: "/")
   --output value               Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                   show help
```

## `list-images`

```
NAME:
   extend-helper-cli list-images - List container images for an Extend App.

USAGE:
   extend-helper-cli list-images [command options] [arguments...]

OPTIONS:
   --namespace value, -n value  Game Namespace.
   --app value, -a value        Extend App Name.
   --verbosity value, -v value  Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --cached                     Return cached image list. Pass --cached=false to force a fresh listing. (default: true)
   --output value               Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                   show help
```

## `deploy-app`

```
NAME:
   extend-helper-cli deploy-app - Deploy app.

USAGE:
   extend-helper-cli deploy-app [command options] [arguments...]

OPTIONS:
   --namespace value, -n value  Game Namespace.
   --app value, -a value        Extend App Name.
   --image-tag value, -t value  Extend App Image Tag.
   --verbosity value, -v value  Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --wait                       Whether or not to wait for a command's completion. (default: false)
   --wait-interval value        Wait poll interval. Default: 10 seconds. (default: 10)
   --wait-limit value           Max duration to wait for a command's completion. Once exceeded it will exit the command. Default: 600 seconds. (default: 600)
   --output value               Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                   show help
```

## `start-app`

```
NAME:
   extend-helper-cli start-app - Start app.

USAGE:
   extend-helper-cli start-app [command options] [arguments...]

OPTIONS:
   --namespace value, -n value  Game Namespace.
   --app value, -a value        Extend App Name.
   --verbosity value, -v value  Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --wait                       Whether or not to wait for a command's completion. (default: false)
   --wait-interval value        Wait poll interval. Default: 10 seconds. (default: 10)
   --wait-limit value           Max duration to wait for a command's completion. Once exceeded it will exit the command. Default: 600 seconds. (default: 600)
   --output value               Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                   show help
```

## `stop-app`

```
NAME:
   extend-helper-cli stop-app - Stop app.

USAGE:
   extend-helper-cli stop-app [command options] [arguments...]

OPTIONS:
   --namespace value, -n value  Game Namespace.
   --app value, -a value        Extend App Name.
   --verbosity value, -v value  Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --wait                       Whether or not to wait for a command's completion. (default: false)
   --wait-interval value        Wait poll interval. Default: 10 seconds. (default: 10)
   --wait-limit value           Max duration to wait for a command's completion. Once exceeded it will exit the command. Default: 600 seconds. (default: 600)
   --output value               Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                   show help
```

## `delete-app`

```
NAME:
   extend-helper-cli delete-app - Delete app.

USAGE:
   extend-helper-cli delete-app [command options] [arguments...]

OPTIONS:
   --namespace value, -n value  Game Namespace.
   --app value, -a value        Extend App Name.
   --verbosity value, -v value  Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --confirm                    Whether or not to automatically accept any confirmation prompt(s). (default: false)
   --force                      Whether or not to force a command. (default: false)
   --wait                       Whether or not to wait for a command's completion. (default: false)
   --wait-interval value        Wait poll interval. Default: 10 seconds. (default: 10)
   --wait-limit value           Max duration to wait for a command's completion. Once exceeded it will exit the command. Default: 600 seconds. (default: 600)
   --output value               Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                   show help
```

## `update-var`

```
NAME:
   extend-helper-cli update-var - Update variable.

USAGE:
   extend-helper-cli update-var [command options] [arguments...]

OPTIONS:
   --namespace value, -n value  Game Namespace.
   --app value, -a value        Extend App Name.
   --key value                  Key.
   --value value                Value.
   --verbosity value, -v value  Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --description value          Description.
   --force                      Whether or not to force a command. (default: false)
   --sensitive value            Whether or not this is sensitive information. (default: false)
   --output value               Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                   show help
```

## `update-secret`

```
NAME:
   extend-helper-cli update-secret - Update secret.

USAGE:
   extend-helper-cli update-secret [command options] [arguments...]

OPTIONS:
   --namespace value, -n value  Game Namespace.
   --app value, -a value        Extend App Name.
   --key value                  Key.
   --value value                Value.
   --sensitive value            Whether or not this is sensitive information. (default: true)
   --verbosity value, -v value  Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --description value          Description.
   --force                      Whether or not to force a command. (default: false)
   --output value               Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                   show help
```

## `clone-template`

```
NAME:
   extend-helper-cli clone-template - Clone a Git repository template to a local destination

USAGE:
   extend-helper-cli clone-template [command options] [arguments...]

OPTIONS:
   --repo-url value, -r value     Repository URL (HTTPS or SSH)
   --source-path value            Path inside cloned repository to extract into destination root
   --scenario value               Scenario (ex: Extend Override, Extend Service Extension, Extend Event Handler)
   --template value               Template name (filtered by scenario)
   --language value               Language (ex: C#, Go, Java, Python)
   --starters value               Path to starters YAML file (supports optional sourcePath)
   --destination value, -d value  Destination directory
   --branch value, -b value       Branch or tag to clone
   --depth value                  Shallow clone depth (0 for full) (default: 1)
   --verbosity value, -v value    Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --confirm                      Whether or not to automatically accept any confirmation prompt(s). (default: false)
   --dry-run                      Whether or not this is a dry-run. (default: false)
   --auth-method value            Auth method (none, token, basic, ssh) (default: none)
   --token value                  Personal Access Token (for token auth)
   --username value               Username (for basic auth)
   --password value               Password (for basic auth)
   --ssh-path value               SSH private key path (default: "/Users/you/.ssh/id_rsa")
   --ssh-pass value               SSH key passphrase (if needed)
   --output value                 Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                     show help
```

## `tunnel`

```
NAME:
   extend-helper-cli tunnel - Start listening on user’s local port. Forwards traffic to the specified database resource through a tunnel.

USAGE:
   extend-helper-cli tunnel [command options] [arguments...]

OPTIONS:
   --namespace value, -n value      Game Namespace.
   --verbosity value, -v value      Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --resource-name value, -r value  The database resource name to be tunnelled.
   --local-port value, -p value     The local port to bind the tunnel to.
   --output value                   Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                       show help
```

## `remote-debug`

```
NAME:
   extend-helper-cli remote-debug - Manage remote debug sessions for an Extend app

USAGE:
   extend-helper-cli remote-debug command [command options] [arguments...]

COMMANDS:
   enable   Enable remote debug mode for an Extend app
   disable  Disable remote debug mode for an Extend app
   connect  Connect to a remote debug session for an Extend app
   help, h  Shows a list of commands or help for one command

OPTIONS:
   --help, -h  show help
```

## `login`

```
NAME:
   extend-helper-cli login - Log in to AccelByte using browser-based authentication (OAuth 2.0 with PKCE).

USAGE:
   extend-helper-cli login [command options] [arguments...]

OPTIONS:
   --base-url value             AccelByte API base URL (overrides AB_BASE_URL).
   --verbosity value, -v value  Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --output value               Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                   show help
```

## `logout`

```
NAME:
   extend-helper-cli logout - Log out and clear saved credentials.

USAGE:
   extend-helper-cli logout [command options] [arguments...]

OPTIONS:
   --verbosity value, -v value  Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --output value               Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                   show help
```

## `status`

```
NAME:
   extend-helper-cli status - Show current authentication status.

USAGE:
   extend-helper-cli status [command options] [arguments...]

OPTIONS:
   --verbosity value, -v value  Verbosity level. (0 or panic, 1 or fatal, 2 or error, 3 or warn, 4 or info, 5 or debug, 6 or trace) (default: info)
   --output value               Output format. Supported value: "json". Emits a single machine-readable JSON object to stdout; all log output is redirected to stderr.
   --help, -h                   show help
```

## `appui`

```
NAME:
   extend-helper-cli appui - Extend App UI feature commands

USAGE:
   extend-helper-cli appui command [command options] [arguments...]

COMMANDS:
   create     Create new Extend App UI
   upload     Build, package, and upload Extend App UI project
   setup-env  Create or update .env.local for Extend App UI project
   help, h    Shows a list of commands or help for one command

OPTIONS:
   --help, -h  show help
```
