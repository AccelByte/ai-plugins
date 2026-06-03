---
last-verified: 2026-04-21
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
- https://github.com/AccelByte/extend-service-extension-go
see-also:
- '[templates.md](../init/templates.md)'
- '[manifest-schema.md](../init/manifest-schema.md)'
- '[cli-commands.md](../deploy/cli-commands.md)'
- '[local-run.md](../debug/local-run.md)'
---

# Your First Extend App

A narrated end-to-end walkthrough. Builds a Service Extension in Go (the lowest-friction pattern for a first-timer — it stands up locally without registering against AGS). Ends when you've got a local REST endpoint you can `curl`.

**Prerequisites:**

- An AGS environment you have access to (for credentials; you can finish the local portion without hitting production).
- Go 1.24 or newer (`go version`).
- Docker (for later — not needed for the local-run portion).
- Git.

**Not required yet:** `extend-helper-cli`, Admin Portal access, deployment. Those come after local success.

---

## Step 0 — Why Service Extension for your first app

The three patterns differ in how they're invoked:

- **Override** — AGS calls you synchronously. To see it working, AGS has to reach your local machine (ngrok or deployed).
- **Event Handler** — AGS delivers events via Kafka Connect. To see it working, AGS must fire an event and your subscription must be registered.
- **Service Extension** — a standalone REST+gRPC service. You call it yourself. No AGS round-trip needed to verify it runs.

First app should be the one where "did my code run?" is answered by `curl`. That's Service Extension.

Go because the template is the most mature and the toolchain is single-binary.

---

## Step 1 — Clone the template

```bash
git clone https://github.com/AccelByte/extend-service-extension-go.git my-first-extend
cd my-first-extend
```

Read the repo's own `README.md` first. Templates update; if its instructions disagree with this tutorial, trust the repo.

---

## Step 2 — Look at what you got

Typical template layout (names may shift slightly — poke around):

```
my-first-extend/
  main.go                    — entry point
  pkg/
    pb/                      — generated proto code (don't edit)
    service/                 — your gRPC handlers (this is where you'll write code)
  proto/                     — .proto contract files
  Dockerfile
  Makefile
  .env.template
  docker-compose.yml         — optional local sidecars (mongo, redis)
```

Two facts to absorb:

1. **`pkg/pb/` is generated.** You never hand-edit it. When the proto changes, run `/ags-extend proto` to regenerate.
2. **`pkg/service/` is yours.** That's where handler logic goes.

---

## Step 3 — Set up your local environment

Copy the env template:

```bash
cp .env.template .env
```

Open `.env`. You'll see something like:

```
AB_BASE_URL=
AB_NAMESPACE=
AB_CLIENT_ID=
AB_CLIENT_SECRET=
```

For this tutorial, leave them blank or put placeholders — you're not calling AGS from the handler yet. The app will start; anything that tries to call AGS will fail with a credential error, and that's fine for now.

If you *do* have credentials from your AGS environment, fill them in — later steps of the tutorial will use them.

---

## Step 4 — Install project deps

Go-specific:

```bash
go mod download
```

If that fails, the go.mod / go.sum were either broken when shipped (rare) or you're behind a corporate proxy. Set `GOPROXY` and retry.

---

## Step 5 — Build it

```bash
go build ./...
```

Expect silence — a successful build prints nothing. If you get errors, read them literally; most "first build" errors are missing deps (`go mod download` again) or a Go version mismatch (`go version` must say 1.24+).

---

## Step 6 — Run it

```bash
go run main.go
```

You should see log lines ending with something like:

```
gRPC server listening on :8080
HTTP gateway listening on :8081
```

Leave this terminal running. Open a second terminal.

If startup fails immediately with a credential error, your `.env` has garbage that can't even be parsed. Check for stray quotes or missing `=`.

---

## Step 7 — Hit it with curl

The template ships with at least one example REST endpoint. Check `proto/*.proto` for the HTTP annotations, or the README for example curls. A typical starter endpoint looks like:

```bash
curl -s -X GET http://localhost:8081/v1/example | jq
```

Expected: a JSON response (possibly `{"message":"hello"}` or similar — depends on the template's example handler).

**If that curl works, your first app is alive.** That's the finish line for this tutorial.

If you get connection refused: the server isn't running — check the other terminal for crashes.

If you get 404: the endpoint name doesn't match the template's example. Read the proto or the template's README for the actual path.

If you get a 500: an internal error inside the handler. Look at the server's logs in the other terminal. If it's a credential error, skip to Step 9 to add credentials, or change the example handler to not call AGS.

---

## Step 8 — Write your first handler change

Open `pkg/service/` and find the example service struct. It'll have a method like `Example(ctx, req) (*Response, error)`.

Change the response. Example:

```go
func (s *Server) Example(ctx context.Context, req *pb.ExampleRequest) (*pb.ExampleResponse, error) {
    return &pb.ExampleResponse{
        Message: "hello from my first extend app",
    }, nil
}
```

Restart the server (Ctrl-C the first terminal, then `go run main.go` again). Curl again. You should see your message.

Congratulations — you've shipped a handler change. (Shipped in the "it runs locally" sense. Actual deploy is next, not covered in this tutorial.)

---

## Step 9 — (Optional) Call AGS from the handler

If your `.env` has real credentials, you can use the AGS SDK inside the handler to call AGS APIs. The template will have an example import of the SDK — look for `accelbyte-go-sdk`. Skip this step if you don't have credentials yet.

The minimum to make a call:

```go
import "github.com/AccelByte/accelbyte-go-sdk/services-api/pkg/factory"

// inside your handler...
config := factory.NewConfigRepository()
// ... create an SDK client with config ...
// ... call the AGS API you want ...
```

Exact signatures live in the SDK README. If the SDK call fails with `401 unauthorized`, your credentials or the IAM client's permissions are wrong. See `references/faq.md#credentials-and-permissions`.

---

## Step 10 — Where to go next

You've got a locally-running Service Extension. In order of what most developers need next:

1. **Add your real endpoint.** Edit `proto/*.proto` to declare the methods you actually need, run `/ags-extend proto` to regenerate, then implement in `pkg/service/`.
2. **Add persistence.** If you need a database, the wizard's `nosql-go` patch sets up MongoDB for local (via docker-compose) + DocumentDB for production. Re-run `/ags-extend wizard` on this repo or apply the patch manually.
3. **Write tests.** Use `/ags-extend test` for unit tests, `/ags-extend test integration` for end-to-end against a real dev namespace.
4. **Install the CLI.** `/ags-extend install-cli` so you can `image-upload` and `deploy`.
5. **Deploy.** `/ags-extend deploy` — this requires credentials and a target namespace. It's the first step that actually touches AGS infrastructure.
6. **Wire CI.** `/ags-extend ci` — generate a GitHub Actions or GitLab pipeline so you don't deploy from your laptop.

For anything confusing along the way, `/ags-extend ask` for concept questions and `/ags-extend doctor` when something's off but you can't name what.

---

## Common first-timer snags

- **`go run` errors "no Go files"** — you're not in the app directory. Check `pwd`; you should see `main.go` in the current directory.
- **Ports 8080/8081 already in use** — some other server is running locally. Kill it (`lsof -iTCP:8080 -sTCP:LISTEN`) or set alternate ports if the template supports it.
- **"Reading env: file not found"** — you didn't create `.env` from `.env.template`. See Step 3.
- **Everything seems fine but no endpoints respond** — you're curling the gRPC port (8080) instead of the HTTP gateway port (8081). Service Extension REST lives on 8081.
- **Template is a different pattern than you wanted** — the template you cloned is the pattern you get. For Override, `extend-override-go`; for Event Handler, `extend-event-handler-go`. Service Extension is the recommended starter because it doesn't need AGS round-tripping to verify.
