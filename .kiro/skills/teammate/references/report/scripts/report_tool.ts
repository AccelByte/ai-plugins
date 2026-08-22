/**
 * report_tool.ts — deterministic chokepoint for the `teammate` skill.
 *
 * Single-file TypeScript, no dependencies (only `node:` builtins). Run via:
 *   npx tsx <install-dir>/references/report/scripts/report_tool.ts <cmd> [args]
 *
 * Anything the model composes passes through this tool before it is exported,
 * written to memory, or pushed to a git host — findings via `validate` +
 * `fingerprint` + `redact`; activity entries via `validate --kind activity` +
 * `redact`; a PR's branch, title and body via `pr-plan`, and the worktree it is
 * cut from via `pr-guard`. Fingerprints, actors, timestamps and branch names are
 * never LLM-composed.
 *
 * Commands:
 *   validate [--kind report|activity|suppression|access-log] <f.json>  schema + grounded-or-suppressed
 *   memory-doc [--allow-dirty] <report.json>         exact wiki_memory_put payload
 *   memory-lookup --repo-name <n> --mode <m> [--actor <id>] [--tree-hash <h>]
 *                 --commits <rev-list.txt> <envelopes.json>   rank stored reports
 *   fingerprint --detector <id> --path <p> [--snippet-file <f>] [--json]  finding id
 *   redact [--in <file>]                             strip secrets from stdin/text
 *   export [--format md|html] [--out <file>] [--at-commit <sha>] <report.json>
 *   pr-plan --finding <id> [--at-commit <sha>] <report.json>   the one fix's branch/title/body
 *   pr-guard --expect <path> […] [--expect-branch <n>] [--in <f>]
 *                                            git status --porcelain -b vs the declared fix
 *   log --file <f> --kind read|endpoint|git --value <v> [--note <n>]   append-only log
 *   score --key <key.json> [--json] [--urls-out <file|->] <report.json>
 *                                                  a run against a scoring key
 *
 * Pure helpers (fingerprint, redact, renderMarkdown, renderHtml, validate*,
 * appendLogLine, buildPrPlan, prGuardProblems, formatDuration, scoreReport) are
 * exported for unit testing;
 * the CLI runs only when this file is the process entry point (see the tail).
 *
 * Schema of record: references/report/report-schema.md (kept in lockstep).
 * The activity schema mirrors `report-schema.md` — snake_case, nested actor,
 * `actor_source`; `scope` is server-derived from identity, not an entry field.
 *
 * Exit codes: 0 = ok, 1 = validation failure, 2 = usage error, 3 = I/O error,
 * 4 = `score` only — the scorecard is incomplete (something is unscoreable or
 * needs a human), which is neither a pass nor a refusal.
 */

import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// --- schema constants (mirror report-schema.md) ------------------------------

const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
const CONFIDENCES = ["low", "medium", "high"] as const;
const MODES = ["code-only", "config-aware"] as const;
const TREE_STATES = ["clean", "dirty"] as const;

/**
 * What a live read did to one candidate, and there are only three (ADR-0005,
 * `subskills/health-check.md` Stage 3 § *Three dispositions, and only three*).
 *
 * `not-readable` is the disposition for a read that did not settle the finding's
 * own proposition — there was no operation to run, or the read errored, or the
 * token lacked the permission, or the read landed and answered a different
 * question. `UNREADABLE_REASONS` below is that list, and the two have to move
 * together: this comment naming three of four is how the artifact and the prose
 * that governs it come apart. Silence from a namespace is not a statement about
 * it, so it is never a refutation, and the two are kept distinct here because
 * only one of them removes a finding.
 */
const DISPOSITIONS = ["confirmed", "refuted", "not-readable"] as const;

/**
 * Which of the four ways a `not-readable` candidate was not readable.
 *
 * Three of them are transcribed from the place a run already reads: *"no
 * operation exposes it, the read errored, or the token lacks the permission"*
 * (`subskills/health-check.md` Stage 3 § *Three dispositions, and only three*,
 * the **Not readable** bullet). The fourth is the case that prose left out and
 * the same file's worked example describes anyway — `confidential-secret-in-client`
 * is not readable *"even though the read succeeded"*, because a Public client
 * kind is a fact about a different proposition than the one the finding asserts.
 *
 * The distinction is the entire reason a `not-readable` row exists. Without it
 * the row cannot be told apart from a candidate nobody ever looked at, and a
 * live config-aware run wrote exactly that: `confidential-secret-in-client`
 * landed `not-readable` carrying nothing but its path, while the same run's
 * access log held the `GET /iam/v3/admin/namespaces/{namespace}/clients/
 * {clientId}` it had made and lost (ADR-0006).
 *
 * `errored`, `unauthorized` and `answers-another-question` all describe a read
 * that was *made*, so every one of them names it — which is why `read` is
 * required alongside all three. `no-operation` is the only one where there is
 * genuinely nothing to name, and demanding a `read` there would make a run
 * compose an endpoint it never called.
 */
const UNREADABLE_REASONS = [
  "no-operation",
  "errored",
  "unauthorized",
  "answers-another-question",
] as const;

/**
 * The length a `result` may be. It is a phrase — `setBy: CLIENT` — recording what
 * a read settled, not the response body it settled from. This report is written
 * into a shared studio scope, and a read of an IAM client returns more than the
 * run needs; a field with no bound becomes the place that arrives.
 */
const RESULT_MAX = 200;

/**
 * The characters a report key is built out of. A value carrying one of them
 * cannot go into a key without making the key ambiguous — `ags@rps@sha:mode`
 * has no single reading — so every field that reaches a key is checked against
 * this first. `+` joins the actor segment onto the commit, so it is a separator
 * too.
 */
const KEY_SEPARATORS = /[@:+\s/]/;
const DETECTOR_IDS = [
  "incomplete-integrations",
  "deprecated-apis",
  "auth-token-safety",
  "error-resilience",
] as const;
const PERSONAS = ["dev", "liveops"] as const;
// Three, because a service token is neither of the other two: it names a caller
// so the entry is honestly attributed, but the caller is not a person.
const ACTOR_SOURCES = ["iam", "iam-client", "git-config"] as const;

// The subset that is a *person*. A suppression is a human decision — "a record
// with no actor was not granted by a person" is the rule the required `actor`
// field exists for — so a machine may run a scan and file its report, and may
// not dismiss a finding. That is a different partition from the one the store
// uses to decide what a nudge may quote (`iam` alone): a `git-config` identity
// is a person, just an unverified one.
const HUMAN_ACTOR_SOURCES = ["iam", "git-config"] as const;

type ActorSource = (typeof ACTOR_SOURCES)[number];
type HumanActorSource = (typeof HUMAN_ACTOR_SOURCES)[number];
const ACTIVITY_SEVERITIES = ["info", "warn", "critical"] as const;
const LOG_KINDS = ["read", "endpoint", "git"] as const;

// The access-log envelope's fields, pinned. A trail nobody can read by a fixed
// path is not a trail, so the envelope is closed the way a report is.
const ACCESS_LOG_KEYS = ["repo", "commit_sha", "mode", "run", "entries", "ts"] as const;
const ACCESS_LOG_ENTRY_KEYS = ["kind", "value", "note"] as const;

/**
 * The shape every documented `action` has — and so every `run` value, since the
 * envelope's `run` is the same string as the activity entry's `action`.
 *
 * Deliberately a shape and not an enum: the action vocabulary is documented
 * non-exhaustive (memory-contract.md § Kinds) so personas can add to it without
 * editing this file. A shape still catches what an open enum cannot — the first
 * live run to flush an envelope put its run *directory* name in `run`, and
 * `teammate-run.3AIePY` fails this on both the dot and the capitals.
 */
const ACTION_SHAPE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// UTC only, and bounded: a provenance stamp is compared against other stamps,
// so a local-offset or free-text date is a marker that cannot be ordered.
const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;

/**
 * A full sha-256 digest, lowercase — what `snippet_hash` and `tree_hash` are.
 *
 * One pattern for both, because a second copy is a second place to change and
 * only one of them gets changed. This file has already paid that once: the
 * report and the activity entry each grew their own namespace rule and the two
 * drifted, which is why `checkNamespace` exists.
 */
const SHA256_HEX = /^[0-9a-f]{64}$/;

// Severity order for report rendering (most severe first).
const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

type Severity = (typeof SEVERITIES)[number];
type Confidence = (typeof CONFIDENCES)[number];
type TreeState = (typeof TREE_STATES)[number];
type Disposition = (typeof DISPOSITIONS)[number];
type UnreadableReason = (typeof UNREADABLE_REASONS)[number];

/**
 * The schema generation a report declares. `2` requires `repo.tree_state`; `3`
 * additionally requires `repo.name`, an `actor` and an `actor_source`, and
 * requires `repo.tree_hash` on a dirty scan; `4` requires `cross_reference` on
 * a config-aware report and `provenance.started_at` wherever provenance is
 * recorded; `5` requires `cross_reference.candidates[].unreadable_reason` on a
 * `not-readable` row, and a `read` beside it on every reason but
 * `no-operation`; `6` requires `surface`, the call-site index Stage 2 derives.
 * `1` predates all of it, and a stored report is allowed to
 * lack a field rather than a rescan being forced by a version bump alone.
 *
 * The grandfathering runs one way only: it excuses a report from a
 * *requirement* the generation it declares predates. It does not admit a
 * *field* that generation predates — `unreadable_reason` is refused below 5 for
 * that reason, since no report written under those rules can hold one.
 *
 * Generation 3 exists because reuse stopped being an exact-key lookup. Walking
 * back to an ancestor report means reading every report in the studio scope —
 * `wiki_memory_list` has no repo or prefix filter — and deciding which ones
 * belong to this repo, this mode, and, for a scan of uncommitted work, this
 * person. None of those three is answerable from a generation-2 report, so a
 * walk-back over them would either skip every candidate or offer a stranger's
 * working tree as your own history.
 *
 * Only the *shape* is versioned. The citation-class rule applies to every
 * generation, because it is a claim about whether the reader can check the
 * finding — a v1 citation that cannot be opened at the line was always unable to
 * prove what it was cited for, and grandfathering it would exempt exactly the
 * reports most likely to be reused.
 *
 * A value that names no generation answers `null` rather than a default.
 * `Number.parseInt("v3", 10)` is `NaN`, and answering generation 1 for it chose
 * the *most permissive* of the three rule sets off a typo — no repo name, no
 * actor and no tree state required — so a report meant to be held to the newest
 * rules was silently held to the oldest. The caller refuses it instead: a
 * version nobody can read grandfathers nothing.
 */
function schemaMajor(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.floor(v) : null;
  if (typeof v !== "string") return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

interface Citation {
  source: string; // internal:// or https?:// — a resolvable provenance target
  note?: string;
}

interface Finding {
  id: string;
  detector_id: string;
  severity: Severity;
  confidence: Confidence;
  title: string;
  location?: { path: string; line?: number };
  citations?: Citation[];
  suppressed?: boolean;
  snippet_hash?: string; // sha256 of the normalized snippet the id was built from
  // The playbook row this finding came from — the same vocabulary a
  // `cross_reference` candidate carries, on the other side of the join.
  //
  // This is *not* the `disposition` field ADR-0005 refuses. That one fails
  // because a refuted candidate ships no finding, so a finding-side field
  // records the confirmed set and half of nothing else. A `signal` claims
  // nothing about candidates: it names which row produced *this* finding, and
  // a refuted candidate keeps its own `signal` in `cross_reference.candidates`
  // untouched. Nothing is lost by carrying it here (ADR-0013).
  //
  // Optional at every generation, and deliberately so: a discovered obligation
  // has no stable slug to write (ADR-0004 § Consequences), so requiring it
  // would force a run to invent the identity that ADR names as future work.
  // The scorer takes the absence seriously instead — see `scorePrecision`.
  signal?: string;
}

interface Report {
  schema_version: string | number;
  mode: string;
  // The namespace a config-aware run read live. Required for that mode and
  // refused for the other, so the mode is a claim the report can be held to:
  // "config-aware" with no namespace names no source for its live half, and a
  // namespace on a code-only report was composed rather than read.
  namespace?: string;
  // `commit_sha` pins what the report *says* it looked at; `tree_state` says
  // whether that was true. A scan of a dirty worktree describes an input that
  // exists on one machine and is reachable by no sha, so the pin alone turns a
  // report keyed on that commit into an answer about code nobody else has.
  //
  // `name` is here for the same reason a suppression carries `repo`:
  // `wiki_memory_list` returns every report in the studio scope with no filter,
  // so a record that cannot say which repo produced it gets read as belonging
  // to whichever one is scanning. `tree_hash` identifies *which* uncommitted
  // state was scanned — it is what lets a later run say "this was your tree,
  // and it has moved since" instead of offering stale findings as current.
  repo: {
    name?: string;
    url?: string;
    commit_sha: string;
    tree_state?: TreeState;
    tree_hash?: string;
  };
  // Who ran the scan, same shape as an activity entry. Only consulted for a
  // dirty report, where it is load-bearing: uncommitted work is one person's,
  // and offering it to a colleague at the same commit would present edits they
  // do not have as findings about code they do.
  actor?: { id: string; display: string };
  actor_source?: ActorSource;
  findings: Finding[];
  // What the live half of a config-aware run settled, including the candidates
  // it removed. Paired with `mode` in both directions, like `namespace`.
  cross_reference?: CrossReference;
  // Which AGS capabilities this commit calls, and where. Deliberately *not*
  // paired with `mode`: Stage 2 is a static read that runs in both, so a
  // code-only report carries one too, and a run whose live half fails relabels
  // itself code-only without losing it. Only the per-capability `config` edge
  // is mode-paired, and it is checked inside `validateSurface`.
  surface?: Surface;
  provenance?: Provenance;
}

/**
 * The Stage 2 call-site index: which AGS capabilities the code calls, and at
 * what `file:line`. Derived every run since the skill existed, rendered by
 * neither exporter until generation 6 — while the MVP requirements baseline
 * asked for a *Services in use* section with a clickable location per service
 * the whole time, and two subskills derived the same map independently.
 *
 * It is an index into one commit, never a description of the project. That is
 * the whole of what makes it safe to store later (ADR-0024): a record naming
 * `abc123` stays true about `abc123`, so nothing reconciles and nothing rots.
 * Reading it is never a substitute for reading the repository — it saves a
 * consumer the work of *finding* a call site and stands in for none of them.
 *
 * `not_read` is the half a reader cannot infer. A text scan reaches C++ call
 * sites and not Blueprint graphs, which live in binary `.uasset`/`.umap`, so on
 * an Unreal project this section can omit most of the calls a designer made and
 * look complete doing it. Naming what was not read is the difference between a
 * short list and a short list that says so.
 */
interface Surface {
  // Empty is a real answer: the SDK is present and the scan matched no call.
  capabilities: SurfaceCapability[];
  // Call surfaces this scan did not read, each named in one line.
  not_read?: string[];
}

interface SurfaceCapability {
  capability: string; // the AGS capability called — `statistics`, `matchmaking`
  // At least one. A capability with no call site behind it is an assertion, and
  // this object exists to be the evidence rather than the claim.
  call_sites: CallSite[];
  // What the namespace answered about this capability, and when. The one part
  // of the index that can be wrong while the commit is unchanged — a studio
  // edits AGS configuration in the Admin Portal without touching the repo — so
  // it carries the instant it was read and is never rendered as current
  // (ADR-0024). Same shape as a cross-reference candidate's evidence pair,
  // deliberately: a second spelling of `read`/`result` would be a second thing
  // to keep true.
  config?: ConfigEdge;
}

interface CallSite {
  path: string; // repo-relative, the same rules as a finding's `location.path`
  line: number; // 1-based; `Grep` always has one, and a location without it is not clickable
}

interface ConfigEdge {
  read: string; // the operation run against the namespace
  result: string; // a redacted phrase — `setBy: CLIENT`, never a response body
  read_at: string; // ISO-8601 UTC, the instant the read was made
}

/**
 * The Stage 3 inventory: every candidate the run attempted a live read on, and
 * what came of each. Attempted, not settled — `not-readable` is the disposition
 * for a read that did not settle its candidate, and it takes a row like the
 * other two.
 *
 * A refuted candidate is dropped from `findings` — the only step in the run that
 * deletes a finding — so before this field the run's most consequential action
 * was also its least traced. The counts reached the spoken summary, the access
 * log recorded which endpoints were *called* and never what came back, and a
 * confirmed candidate's raised `confidence` moved only when its playbook had a
 * channel-B row to raise to. Two config-aware pilot runs were scored from their
 * stored reports and nothing about the live half could be scored at all
 * (ADR-0005).
 *
 * This is deliberately **not** a field on a finding — that shape can only
 * describe candidates that became findings, and a refuted one by definition did
 * not, so it would record the confirmed set and half of nothing else. The
 * finding object stays closed and `only()` still refuses `disposition` there.
 */
interface CrossReference {
  // Empty is a real answer: the read happened and raised nothing to settle.
  candidates: CrossRefCandidate[];
}

interface CrossRefCandidate {
  detector_id: string;
  signal: string; // the playbook row (or discovered signal) this candidate came from
  disposition: Disposition;
  // Repo-relative, the same *shape* rules as a finding's `location.path`, plus
  // a content one that field does not have: it must not be made only of
  // characters that render as nothing. It is the one candidate field that
  // reached an exported page through `validate`.
  path?: string;
  read?: string; // the operation run against the namespace
  result?: string; // a redacted phrase — `setBy: CLIENT`, never a response body
  // Which of the four ways a `not-readable` row was not readable. Required on
  // that disposition from `schema_version` 5 on, and refused at every generation
  // on the two that settle something — a read that landed on the finding's own
  // proposition has no unreadability to explain (ADR-0006).
  unreadable_reason?: UnreadableReason;
  finding_id?: string; // the surviving finding, when one shipped
}

/**
 * When these findings were derived, and by what. `scanned_at` is stamped once,
 * by the scan that produced the report, and never rewritten — a reuse run serves
 * the stored report with the stored timestamp, which is the whole point: the
 * exported file says on its face how old the answer is.
 *
 * `started_at` is the other end of the same run. Every other instant in the
 * artifact is written at Stage 6, so a stored report could not answer how long
 * the scan took — § Scoring's wall-clock criterion was unrecoverable from two
 * complete reports. Both are read from `date -u`, never composed, and the
 * duration is derived by whoever reads them rather than asserted by the run.
 */
interface Provenance {
  started_at?: string; // ISO-8601 UTC, stamped at Stage 1
  scanned_at: string; // ISO-8601 UTC, e.g. 2026-07-26T04:12:24Z
  tool_version?: string; // the skill version that derived them
}

/**
 * A human's standing decision to dismiss a finding. Durable and never
 * auto-pruned, so it outlives the report it was granted against and every
 * commit since — which is exactly why it carries the same identity fields the
 * finding does. `id` alone is not enough: an id a later run cannot re-derive
 * leaves the run choosing between re-litigating a dismissal and asserting a
 * match, and an asserted match re-points a suppression at a finding it was
 * never granted for. `snippet_hash` is what makes the match provable instead.
 *
 * `scope` is server-derived from the caller's identity — never a client argument
 * and never a field here. It is stamped onto the envelope wrapping this record,
 * so a record read back arrives under `.doc`, not at the top level.
 */
interface Suppression {
  schema_version: string | number;
  id: string; // the fingerprint this was granted against
  repo: string; // wiki_memory_list has no repo filter — the load path uses this
  detector_id: string;
  path: string; // repo-relative, no leading "./" — see report-schema.md
  snippet_hash: string; // required: a suppression with no proof is not one
  reason: string; // why a human dismissed it, in their words
  actor: { id: string; display: string };
  // The human subset: a suppression is a person's decision, never a service's.
  actor_source: HumanActorSource;
  // Server-stamped ISO-8601 where the memory service accepted the write; read
  // from `date -u` on a git-config run.
  ts: string;
}

// Cross-persona colleague feed entry (see `report-schema.md`). `actor`/`ts` are
// server-stamped on an append the memory service accepts; `scope` is
// server-derived from identity, never a client argument and never a field on
// the entry.
interface ActivityEntry {
  schema_version: string | number;
  actor: { id: string; display: string };
  actor_source: ActorSource;
  persona: string;
  subskill: string;
  action: string;
  namespace: string;
  target: string; // redacted before it reaches here
  summary: string; // redacted before it reaches here
  severity?: string; // optional
  // Server-stamped ISO-8601 where the memory service accepted the write; read
  // from `date -u` on a git-config run.
  ts: string;
}

// --- fingerprint -------------------------------------------------------------

/**
 * Normalize a code snippet so the fingerprint survives cosmetic churn:
 * per-line trim, collapse internal whitespace runs, drop blank lines. Line
 * numbers never enter the hash, so a finding keeps its identity when
 * surrounding code shifts up or down.
 */
export function normalizeSnippet(snippet: string): string {
  return snippet
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * Line-independent finding id: hash(detector_id ∥ repo-relative path ∥
 * normalized snippet). Keys suppressions, so it must be stable across
 * reformatting and code drift but change when the finding's substance changes.
 * Components are NUL-joined so a space in a path can't shift the boundary.
 * Line-independence means two identical occurrences in one file collapse to one
 * id — suppressing one suppresses both (documented in report-schema.md).
 */
export function fingerprint(
  detectorId: string,
  repoPath: string,
  snippet: string,
): string {
  const input = [detectorId, repoPath, normalizeSnippet(snippet)].join("\0");
  return createHash("sha256").update(input, "utf8").digest("hex").slice(0, 16);
}

/**
 * Hash of the normalized snippet alone — the one `fingerprint` input a report
 * does not otherwise persist.
 *
 * Without it a later run cannot tell "this id differs because the finding
 * changed" from "this id differs because I cut the snippet at a different
 * boundary", because the snippet that produced the stored id is gone. That
 * ambiguity is not theoretical: a rescan could not reproduce a stored id
 * and carried it forward by hand, which makes the diff key asserted rather than
 * derived. Storing this lets a rescan prove sameness — equal detector, equal
 * path and equal snippet hash imply an equal id — and, when it differs, say so
 * instead of guessing.
 *
 * Deliberately the full digest, not the 16-char prefix: this one is compared,
 * never displayed, so there is no reason to spend collision resistance on
 * brevity.
 */
export function snippetHash(snippet: string): string {
  return createHash("sha256")
    .update(normalizeSnippet(snippet), "utf8")
    .digest("hex");
}

// --- redaction ---------------------------------------------------------------

// High-precision secret patterns. Order matters: multi-line key blocks first,
// then structured tokens, then named-assignment fallbacks. Each replacement is
// tagged so a reader knows what was removed without seeing the value.
const REDACTIONS: { re: RegExp; sub: string }[] = [
  // Private key block. Every quantifier is bounded, including the body: an
  // unbounded `[\s\S]*?` rescans to end-of-input from each BEGIN marker, so text
  // carrying many BEGIN markers and no END costs O(n²) — measured at 592ms on
  // 232KB and 2,396ms on 464KB before the bound, 363ms and 730ms after it.
  //
  // The body bound is the one place this file trades recall for that: a key
  // block whose body exceeds 16,384 characters is not matched here. An RSA-4096
  // PEM is ~3.3KB and an RSA-16384 PEM ~12.5KB, so the bound sits above any key
  // a tool actually emits — but it is a bound, and a longer block would pass
  // through. Raise it rather than removing it; removing it restores the O(n²).
  {
    re: /-----BEGIN [A-Z0-9 ]{0,32}PRIVATE KEY-----[\s\S]{0,16384}?-----END [A-Z0-9 ]{0,32}PRIVATE KEY-----/g,
    sub: "[REDACTED:private-key]",
  },
  // JWT (three base64url segments).
  {
    re: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    sub: "[REDACTED:jwt]",
  },
  // AWS access key id.
  { re: /AKIA[0-9A-Z]{16}/g, sub: "[REDACTED:aws-key]" },
  // Bearer / token in an Authorization context — keep the scheme, drop the value.
  {
    re: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi,
    sub: "$1 [REDACTED:token]",
  },
  // Credential in a connection string / URL: scheme://user:PASS@host — keep the
  // scheme and user, drop the password. Every quantifier is bounded so the scan
  // stays linear (an unbounded scheme backtracks O(n²) on large input).
  {
    re: /([a-z][a-z0-9+.-]{0,31}:\/\/[^:@/\s]{1,256}:)([^@/\s]{1,256})(@)/gi,
    sub: "$1[REDACTED]$3",
  },
  // Named secret assignment. The secret word may carry surrounding tokens —
  // a prefix (`db_password`), a `_`/`-`-delimited suffix (`SECRET_KEY`,
  // `stripe_secret_key`, `API_KEY_ID`), or a camelCase tail (`refreshToken`) —
  // and the key may be quoted JSON (`{"client_secret": …}`). It must appear as a
  // whole token, so lookalikes like `tokenizer=` don't match.
  //
  // BOTH halves of the key are bounded, and for a while only the prefix was:
  // this comment used to claim the bounded prefix was enough to keep the scan
  // linear, and it was not. The suffix repeat is what backtracks — on input
  // built from `token_` plus a 30-character run it measured 331ms at 7KB,
  // 1,387ms at 14KB and 6,176ms at 28KB, quadratic, while the same sizes with
  // no secret keyword stayed flat. Bounded, those are 37ms, 91ms and 160ms,
  // linear. The repo's linearity test passed throughout, because none of its
  // three inputs carried a keyword followed by `_`-delimited segments.
  //
  // The value keeps its unbounded quantifiers deliberately. `[^\s,;)}]+` is a
  // single class, and `(?:[^"\\]|\\.)*` is the unrolled-loop idiom whose two
  // branches are disjoint — both linear. Bounding them would buy nothing and
  // would fail open on a long secret, which is the wrong direction for a
  // redactor. The value is a quoted string (kept whole, so a space inside a
  // quoted secret doesn't truncate it) or an unquoted run to the next
  // separator. `$1` is the optional key quote, reused to close the key.
  {
    re: /(["']?)([A-Za-z0-9_]{0,64}(?:passwd|password|secret|api[_-]?key|access[_-]?key|token)(?:[_-][A-Za-z0-9]{1,64}){0,8})\1(\s*[:=]\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s,;)}]+)/gi,
    sub: "$1$2$1$3[REDACTED]",
  },
];

/**
 * Strip secrets from arbitrary text before it is persisted or exported.
 * Fails safe: an unrecognized secret shape is a miss, so patterns favor recall
 * on the known shapes (keys, JWTs, AWS ids, bearer tokens, named assignments)
 * over cleverness. Non-secret text is left intact.
 */
export function redact(text: string): string {
  let out = text;
  for (const { re, sub } of REDACTIONS) {
    out = out.replace(re, sub);
  }
  return out;
}

// --- validation harness ------------------------------------------------------

class Validator {
  readonly errors: string[] = [];

  fail(path: string, msg: string): void {
    this.errors.push(`${path}: ${msg}`);
  }

  requireString(v: unknown, path: string): v is string {
    if (typeof v === "string" && v.length > 0) return true;
    this.fail(path, `must be a non-empty string (got ${describe(v)})`);
    return false;
  }

  requireVersion(v: unknown, path: string): void {
    if (typeof v === "number") return;
    if (typeof v === "string" && v.length > 0) return;
    this.fail(path, `must be a non-empty string or a number (got ${describe(v)})`);
  }

  requireEnum<T extends string>(
    v: unknown,
    allowed: readonly T[],
    path: string,
  ): void {
    if (typeof v === "string" && (allowed as readonly string[]).includes(v)) {
      return;
    }
    // A wrong string is the common case, and `got string` names the one thing
    // the author already knew. The value is the diagnosis — which of nineteen
    // entries carries `"GET"` where a `kind` belongs is not otherwise visible.
    const got = typeof v === "string" ? excerpt(v) : describe(v);
    this.fail(path, `must be one of [${allowed.join(", ")}] (got ${got})`);
  }

  object(v: unknown, path: string): Record<string, unknown> | null {
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      this.fail(path, `must be an object (got ${describe(v)})`);
      return null;
    }
    return v as Record<string, unknown>;
  }

  /**
   * Refuse a key the schema does not define.
   *
   * The skill's accounting contract rests on these objects being closed, and a
   * `disposition` field on a **finding** is the case it names outright. A
   * refuted candidate ships no finding, so that shape can only describe the
   * candidates that survived — it would record the confirmed set and half of
   * nothing else, and two runs of the same scan would disagree about where a
   * drop is written down. The instruction "do not add a disposition field" was
   * in the contract from the start with nothing enforcing it, so it held only as
   * long as a run happened to read that line. It still holds: the inventory that
   * does record a drop is `$.cross_reference`, one level up, where the refuted
   * set can be recorded whole (ADR-0005).
   *
   * A typo is the other half. `supressed: true` on a finding is silently a live
   * finding, and a live finding with no citation is a validation failure the
   * author never intended to trigger — but `suppresed_reason`, `note`, or a
   * stray `severity_`" spelling just vanishes, and the report ships missing the
   * thing its author wrote.
   */
  only(obj: Record<string, unknown>, allowed: readonly string[], path: string): void {
    const unknownKeys = Object.keys(obj).filter((k) => !allowed.includes(k));
    if (unknownKeys.length === 0) return;
    this.fail(
      path,
      `has no field ${unknownKeys.map((k) => `'${k}'`).join(", ")} ` +
        `(known: ${allowed.join(", ")})`,
    );
  }
}

// Characters that end a line for *some* consumer. `\n` and `\r` were the whole
// check, which left U+2028/U+2029 (the JS/JSON line separators) and U+0085 to
// pass validation and be flattened by the renderers — making the renderers the
// only defence, which is the arrangement this check exists to end.
const LINE_BREAK = /[\n\r\u0085\u2028\u2029\u000B\u000C]/;

/**
 * The set above, as a class a test can build its own pattern from.
 *
 * Exported the way `INVISIBLE_CLASS` is, and for the same reason: a test asking
 * "does this still carry a terminator?" has to ask it with the characters this
 * file actually refuses, not with a second hand-written list that drifts.
 */
export const LINE_BREAK_CLASS = LINE_BREAK.source;

/**
 * The same set as a global replace pattern, with `\r\n` matched **first**.
 *
 * Derived from `LINE_BREAK.source` rather than written out again — one source,
 * so the check and `flattenSingleLine` cannot disagree about what a line
 * terminator is. A flattener that missed a terminator the check catches would be
 * worse than neither: a value is rewritten first and checked after, so the miss
 * would surface as a refusal of something that had already been altered.
 *
 * The alternation exists only for that first branch. A CRLF pair is *one* line
 * ending, and the bare class would match its two characters separately and put
 * two spaces where the author typed one break.
 *
 * No quantifier anywhere — one fixed-length literal alternative and one
 * single-character class — so at any position the engine tries at most two
 * alternatives, each consuming a determined number of characters, and there is
 * no split to reconsider. Linear in the subject, which is what every pattern
 * here that a caller's own text can reach has to be.
 */
const LINE_BREAK_FLATTEN = new RegExp("\\r\\n|" + LINE_BREAK.source, "g");

// Whitespace, and the characters Unicode itself designates as not rendered. A
// namespace of a single zero-width space is non-blank to `trim()`, renders as an
// empty value under a heading that says the environment was read, and is
// indistinguishable from a read that returned nothing.
//
// The eye is not the test, and that is deliberate. "Visible" is a property of a
// font and a reader; this file needs a predicate two runs can agree on. So the
// class is `\s` plus the three Unicode designations — `Cc` (controls), `Cf`
// (format) and `Default_Ignorable_Code_Point` — and the word *invisible*
// everywhere in this file means exactly those and nothing else.
//
// It used to be `\s` plus five hand-listed zero-width codepoints, under prose
// calling it a visible-character test. That was a strictly stronger claim than
// the class, and the widening admits **4261** codepoints the old one missed and
// loses none (measured over the whole plane). Ten of them are the ones somebody
// happened to try: U+00AD, U+034F, U+061C, U+115F, U+17B4, U+180E, U+200E,
// U+2062, U+3164 and U+FFA0, each of which rendered a label with nothing
// legible after it and passed every check in this file. Ten is the size of the
// sample, never of the gap — which is the same mistake in the same paragraph as
// the class it replaces.
// `Default_Ignorable_Code_Point` covers all ten, including the two that are
// combining marks rather than format characters — which is the argument for a
// rule the engine maintains over a list this file keeps, since a hand-written
// class only ever holds the codepoints somebody happened to try.
//
// It is still not "what a reader sees", and the gap has a name: U+2800 BRAILLE
// PATTERN BLANK renders as blank and is in none of the three categories, so it
// passes. Described rather than closed on purpose — chasing it means going back
// to hand-listing, which is the thing that failed.
//
// Exported as the class rather than kept as a whole pattern so a test asking
// "did this render as nothing?" can build its own patterns from the same
// characters this file refuses. A test that writes the class out again is a
// second copy that drifts, and the last one did: it was spelled `\s`, which
// does not match U+200B, so it was blind to the exact spelling it existed for.
//
// **Every pattern built from this needs the `u` flag.** Without it `\p{Cc}` is
// the three literal letters `pCc`, and the failure is silent and inverted:
// `new RegExp(\`^${INVISIBLE_CLASS}*$\`).test("a")` is `true`, so a consumer that
// forgets the flag gets a predicate calling ordinary strings invisible.
const INVISIBLE_BODY = "\\s\\p{Cc}\\p{Cf}\\p{Default_Ignorable_Code_Point}";
export const INVISIBLE_CLASS = `[${INVISIBLE_BODY}]`;

/**
 * One character that is **not** invisible. The complement, and no quantifier.
 *
 * This was `^[class]*$`, and that form is **quadratic** — but only once the
 * subject carries a code point outside Latin-1, which is why every test written
 * against it passed. Measured on the identical constant, one leading U+200B and
 * the rest ordinary ASCII spaces:
 *
 *     16 001 chars    150 ms
 *     64 001 chars  2 367 ms
 *    128 001 chars  9 502 ms      (doubling the input quadruples the time)
 *    256 001 chars, all ASCII — 0.7 ms
 *
 * An unanchored single-character search has no quantifier, so there is no
 * backtracking to be quadratic about. Same predicate: a string is
 * invisible-only exactly when it contains no visible character, and the empty
 * string satisfies both spellings.
 *
 * Found in the service's vendored copy of this file, where the same pattern was
 * reachable by any authenticated caller against a shared single-threaded pod.
 * Here the exposure is a local CLI over its own operator's data, which is far
 * milder — but it is the same rule, and this file is the source the copy is
 * pinned against, so the two move together or the pin fails.
 */
const VISIBLE_CHAR = new RegExp(`[^${INVISIBLE_BODY}]`, "u");

/** True when `value` has nothing a reader could see. `""` counts. */
function isInvisibleOnly(value: string): boolean {
  return !VISIBLE_CHAR.test(value);
}

/**
 * How every message in this file names what `isInvisibleOnly` refuses, and what
 * it saw instead.
 *
 * Constants rather than the phrase typed out at each site, because that is
 * exactly what drifted: the class was `\s` and five zero-width codepoints, and
 * more than thirty messages around it called it a visible-character test — a
 * strictly stronger claim, and one no reader could tell was wrong without
 * opening the regex. A phrase repeated by hand can drift again; a phrase
 * defined once changes with the predicate it describes.
 */
const NOT_ONLY_INVISIBLE = "a character that is not whitespace or invisible";
const ONLY_INVISIBLE_GOT = "(got only whitespace and invisible characters)";

// The pinned sentinel an *activity entry* carries when the run read no
// namespace. It is not a namespace, so it cannot be a config-aware report's.
const NAMESPACE_UNKNOWN = "unknown";

/**
 * Whether a field actually records something.
 *
 * The difference between this and `!== undefined` is the whole of a bug:
 * `requireString` rejects `""` alone, so a candidate carrying `read: " "` —
 * or a tab, or a zero-width space — satisfied every "must be recorded" rule in
 * this file while naming no operation at all. That is precisely the row
 * ADR-0006 exists to refuse, and it passed wearing a value. A field that
 * renders as nothing is not a record of anything, whichever disposition
 * carries it.
 *
 * The same rule, and the same helper, for the *scoring key*: a key field is
 * what the harness compares against, so one that renders as nothing is a
 * constraint nobody wrote, sitting under a field that still reads as a question
 * the key asked. `trim()` is not that test, and every blank check on this side
 * of the file used to be spelled with one.
 */
function isRecorded(value: unknown): value is string {
  return typeof value === "string" && !isInvisibleOnly(value);
}

/**
 * A namespace is one visible line, in every artifact that persists one.
 *
 * Both validators grew their own copy of this rule and drifted: the report's
 * accepted a `unknown` sentinel that belongs only to an activity entry, and
 * both accepted line terminators the renderers then flattened. One function, so
 * a rule added here reaches every caller.
 */
function checkNamespace(
  v: Validator,
  value: unknown,
  at: string,
  requirement: string,
): void {
  if (typeof value !== "string" || value.trim() === "") {
    v.fail(at, `${requirement} (got ${JSON.stringify(value) ?? "undefined"})`);
    return;
  }
  if (isInvisibleOnly(value)) {
    v.fail(at, `must contain ${NOT_ONLY_INVISIBLE} ${ONLY_INVISIBLE_GOT}`);
    return;
  }
  // A namespace never contains one, so a multi-line value was not read.
  checkSingleLine(v, value, at);
}

/**
 * One visible line, for any value that lands in a document someone renders.
 *
 * A value carrying a line terminator forges structure in whatever renders it: a
 * logged `gh` argument containing `\n## ` writes a heading into a trail the
 * whole studio reads, under the authority of a record the validator passed.
 *
 * Whether a renderer flattens it too depends on the field, and the difference is
 * not a reason to skip this check on either kind. Measured 2026-08-10 by
 * **appending** `\n## Forged heading` to every string leaf of a report and
 * counting the `## ` lines in the export.
 *
 * Appending, not replacing, and the distinction is the whole method. Replacing a
 * value destroys whatever shape the field carries — a citation's `https://`, a
 * timestamp's ISO-8601, a hash's hex — so it is refused by *that* rule and this
 * one is never reached, while the survey records a refusal and moves on. Done by
 * replacement `citations[].source` reads as already guarded; done by appending it
 * forges, and it forges on two surfaces.
 *
 * Flattened by `oneLine` before they render: `namespace`, `tool_version`, a
 * candidate's `signal`, `read`, `result` and `path`, and every string the
 * surface renders — each `not_read` entry, a capability's `capability`, a call
 * site's `path`, and a config edge's `read` and `result`. Interpolated raw: a
 * finding's `title`, `id` and `location.path`, a citation's `source` and `note`,
 * and `repo.url`. So for the flattened ones this check is the first of two
 * defences, and for the raw ones it is the only one there is — which is why no
 * field is exempted for having a renderer that happens to be careful.
 *
 * This list is hand-written and nothing tests it, so it is only as current as
 * the last author who remembered it. Add a rendered string leaf, add it here.
 */
function checkSingleLine(v: Validator, value: string, at: string): void {
  if (LINE_BREAK.test(value)) {
    v.fail(at, "must be a single line (contains a line terminator)");
  }
}

/**
 * `value` on one line: every line terminator becomes exactly one space.
 *
 * The counterpart to `checkSingleLine`, for the values where refusing is the
 * wrong tool. Records written before this rule existed are still read back, and
 * a hard failure would reject history nobody can go and edit now; a `summary` or
 * a `reason` is also free text, where a break is a plausible thing for a person
 * to have typed. Rewriting the terminator closes the forged heading and keeps
 * what was written. Refusing does neither.
 *
 * It relaxes nothing. `checkSingleLine` still refuses everything it refused, and
 * a flattened break becomes a space — which `checkKeySafe` refuses too, so a
 * value that lands in a key is no freer than it was.
 *
 * A CRLF pair collapses to one space, not two; see `LINE_BREAK_FLATTEN`.
 */
export function flattenSingleLine(value: string): string {
  return value.replace(LINE_BREAK_FLATTEN, " ");
}

/**
 * How deep a record may nest before the shape itself is the bug.
 *
 * Generous on purpose: the deepest record here is a report, a handful of levels
 * down. Anything past this is not a record with a lot of structure, it is a
 * cycle or a hostile payload, and the answer is to raise where the invariant
 * breaks rather than truncate, default, or hand back a half-flattened record
 * that would then be written.
 */
const MAX_FLATTEN_DEPTH = 64;

/**
 * Every string leaf of `value`, flattened; everything else preserved.
 *
 * Structural, not a field list. A hand-written list of which fields to flatten
 * is its own oracle — it covers exactly the fields somebody remembered — and the
 * fields this exists for (`summary`, `reason`, `target`, `actor.display`) are
 * the ones such a list has already missed once.
 */
function flattenLeaves(value: unknown, depth: number, at: string): unknown {
  if (typeof value === "string") return flattenSingleLine(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_FLATTEN_DEPTH) {
    throw new Error(
      `record nests deeper than ${MAX_FLATTEN_DEPTH} levels at ${at} — no record ` +
        "shape goes that deep, so this is a cycle or a hostile payload",
    );
  }
  if (Array.isArray(value)) {
    return value.map((element, i) => flattenLeaves(element, depth + 1, `${at}[${i}]`));
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, member]) => [
      key,
      flattenLeaves(member, depth + 1, `${at}.${key}`),
    ]),
  );
}

/**
 * `record`, with every string leaf on one line and nothing else touched.
 *
 * Applied where this tool composes a record that another run will render, so
 * what leaves here is already flat. It is deliberately *not* applied to a
 * report: a finding carries multi-line evidence, a report is not rendered into
 * the shared feed, and flattening it would reshape text this tool never
 * specified. Free-form feedback text is the same case, and this tool composes
 * neither of them anyway.
 */
export function flattenRecordLines<T>(record: T): T {
  return flattenLeaves(record, 0, "$") as T;
}

/**
 * An action name in the shape the colleague feed uses.
 *
 * Deliberately a shape and not an enum: `memory-contract.md` documents the
 * vocabulary as open, so a new persona adds a verb without editing this file.
 * What the shape does catch is a value from the wrong namespace entirely — a
 * run directory, a path, a sentence — which is how the feed ends up with a row
 * naming something no colleague can read as work.
 */
function checkActionShape(v: Validator, value: string, at: string, role: string): void {
  if (ACTION_SHAPE.test(value)) return;
  v.fail(
    at,
    `${role} (lowercase, digits and single dashes) — got ${excerpt(value)}`,
  );
}

/**
 * Refuse a value that would make the key it lands in unreadable.
 *
 * Reuse is an exact-string match, so an ambiguous key is not a parse error
 * anywhere — it is a miss. The run rescans, stores under a second ambiguous
 * key, and the store fills with rows nobody can look up.
 *
 * The line rule is here for a reason next to `requireRepoPath`'s, and the gap
 * it closes is **one character wide**. `KEY_SEPARATORS` is `[@:+\s/]`, and
 * JavaScript's `\s` reaches every line terminator this file names except U+0085
 * NEXT LINE — measured, not assumed. So a value carrying U+0085 passed here,
 * and the memory service's flattener then turned it into a space, which *is* a
 * separator.
 *
 * That does **not** rename anything by itself: the store writes a document at
 * the key its caller passed and never derives one from the document, so what
 * flattening reaches is the field, not the name. What it produces is a stored
 * record whose `id` or `repo` no longer satisfies the rule it was checked
 * against — and a suppression is validated again on load, before it is matched,
 * so the next run refuses it with a message about a separator nobody wrote.
 * Refusing here turns that into a refusal at the write that caused it, which is
 * the difference between a dismissal that disappears later for an unexplained
 * reason and one that never lands.
 *
 * Checked only when no separator matched, so every message this function
 * already produced is unchanged.
 */
function checkKeySafe(v: Validator, value: string, at: string, role: string): void {
  const hit = value.match(KEY_SEPARATORS);
  if (!hit) {
    checkSingleLine(v, value, at);
    return;
  }
  v.fail(
    at,
    `must not contain ${JSON.stringify(hit[0])} — this is ${role}, and those ` +
      "characters are the key's own separators",
  );
}

/**
 * One spelling per path, because paths are compared, not just displayed.
 *
 * A suppression is recovered by matching detector + path + snippet hash, so
 * `Assets/X.cs` recorded one run and `./Assets/X.cs` the next is a match that
 * silently fails and a dismissal that silently comes back. The same string is
 * also a `fingerprint --path` input, so a second spelling is a second id for
 * one finding.
 *
 * The line rule is **inside this function**, not at its callers, and that
 * placement is the fix rather than a tidying. Of its four callers, two wrote
 * `checkSingleLine` out by hand, a third reached it through `checkVisibleLine`,
 * and the fourth — a suppression's own `path` — had it nowhere, so the one
 * string the recovery match is built from was the one field left to the store's
 * write-path flattener. Flattening is the right tool for a
 * `summary` or a `reason`, where a break is something a person typed and a
 * rewrite keeps what they wrote. It is the wrong tool here: a space where a
 * terminator was is a *different path*, and the record no longer matches what
 * the next scan derives — the dismissal comes back, by the second route this
 * comment's first paragraph already describes. A caller cannot forget a rule
 * that lives in the function it has to call.
 *
 * What refusing costs is bounded rather than nothing, and the bound belongs
 * here because `flattenSingleLine` rejects refusal for a `summary` and a
 * `reason` on exactly this ground. Nothing composes a multi-line path — a POSIX
 * filename may legally hold one, but no producer here builds such a value — and
 * every record written since the memory service began flattening had the
 * terminator replaced by a space before it was stored, so it cannot be carrying
 * one. A record written **before** that is not covered, and one holding a
 * terminator is now refused rather than rewritten — on the write path and again
 * on the read path, where a stored suppression is validated before it is
 * matched. That is the trade taken deliberately: the path such a record names
 * is not the path a scan derives, so it had already stopped matching, and
 * refusing it drops a dismissal that had stopped working while saying so out
 * loud instead of silently.
 */
function requireRepoPath(v: Validator, path: string, at: string): void {
  checkSingleLine(v, path, at);
  if (path.startsWith("/")) {
    v.fail(at, "must be repo-relative, not absolute");
  }
  if (path.startsWith("./")) {
    v.fail(at, "must not start with './'");
  }
  if (path.includes("\\")) {
    v.fail(at, "must use forward slashes");
  }
  if (path.split("/").includes("..")) {
    v.fail(at, "must not contain '..'");
  }
}

/** The object form of a value, or null when it is not one. Arrays are not. */
function asRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function describe(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

/**
 * A string value, quoted and bounded, for a message where the type alone says
 * nothing. Bounded because the caller may be reporting on a field that carries
 * arbitrary length, and an error line is read in a terminal.
 */
function excerpt(value: string, max = 60): string {
  // Derived from LINE_BREAK rather than a second copy of the pattern — this file
  // has already paid for a rule that existed in two places and drifted.
  const oneLine = value.replace(new RegExp(LINE_BREAK.source, "g"), "\\n");
  return JSON.stringify(oneLine.length > max ? `${sliceUnits(oneLine, max)}…` : oneLine);
}

/**
 * `value.slice(0, end)`, never splitting a character in half.
 *
 * `slice` counts UTF-16 code units, so a cut can land between the two halves of
 * a surrogate pair — every emoji, and much of CJK Extension —
 * and leave a lone surrogate behind. It survives `JSON.stringify`, so it clears
 * every check downstream, and becomes U+FFFD only at the shell boundary. For a
 * PR title that means `git commit` and `gh pr create` both publish a mojibake
 * subject, permanently and in public. Dropping the orphaned half costs one
 * character of a string that was being truncated anyway.
 */
function sliceUnits(value: string, end: number): string {
  const head = value.slice(0, end);
  const last = head.charCodeAt(head.length - 1);
  const isLoneHighSurrogate = last >= 0xd800 && last <= 0xdbff;
  return isLoneHighSurrogate ? head.slice(0, -1) : head;
}

function isCitation(c: unknown): c is Citation {
  if (typeof c !== "object" || c === null) return false;
  const { source, note } = c as { source?: unknown; note?: unknown };
  if (typeof source !== "string" || !/^(internal:\/\/|https?:\/\/)/.test(source)) {
    return false;
  }
  // A non-string note is off-contract and would crash HTML rendering downstream.
  return note === undefined || typeof note === "string";
}

// --- citation class ----------------------------------------------------------

/**
 * A file URL on a code host:
 * `…/<owner>/<repo>/<view>/<ref>/<path>[?query][#fragment]`, where `<view>` is
 * the renderer the host will serve it with. GitLab prefixes the view with
 * `/-/`. Every quantifier is bounded so the scan stays linear.
 *
 * The view is **captured**, not discarded, because `blob` and `src` render the
 * file with addressable lines and `raw` does not — see `refuseRawFile`. Folding
 * all three into one alternation classified
 * `github.com/<o>/<r>/raw/17.16.1/User.cs#L869` as pinned source: it is on an
 * immutable ref and it carries an anchor, so the only two questions asked of it
 * both passed, and the plain-text body the anchor cannot address was never in
 * question. Worse, the same URL on `main` was refused for its *ref* — telling
 * the author to pin it, which is exactly the edit that made it pass.
 *
 * Two spellings GitHub itself emits have to be read here, because a citation
 * this pattern misses is not refused — it falls through to `docs`, and a `docs`
 * citation is never asked whether its ref moves:
 *
 * - `…/User.cs?plain=1#L869`, which is what *Copy permalink* produces for a
 *   Markdown file. Any `?` made the whole match fail, so the shape a reader is
 *   most likely to paste was the one shape the moving-ref check never saw.
 * - `…/blob/refs/heads/main/User.cs`, the fully-qualified branch form. It
 *   captured `refs` as the ref, and `refs` is in no list of moving refs, so a
 *   branch link passed as pinned source.
 */
const HOST_FILE_URL =
  /^https?:\/\/(?:www\.)?(?:github\.com|gitlab\.com|bitbucket\.org)\/[^/#?\s]{1,128}\/[^/#?\s]{1,128}\/(?:-\/)?(blob|raw|src)\/(?:refs\/(?:heads|tags)\/)?([^/#?\s]{1,256})\/[^#?\s]{1,1024}(?:\?[^#\s]{0,256})?(#\S{0,128})?$/i;

/**
 * `raw.githubusercontent.com` serves one thing: the file as `text/plain`. The
 * host names the renderer, so the host alone is the refusal — no path shape
 * required, and none trusted.
 *
 * Matching on the path shape instead left the malformed spellings unrefused,
 * and they are the ones a bad citation is most likely to be. Owner and repo
 * accepted `?`, so a query string could stand in for missing path segments:
 * `raw.githubusercontent.com/o/r?u=https://github.com/o/r/blob/main/f.cs`
 * parsed as a well-formed raw URL only because a slash run inside its query had
 * been collapsed first, and stopped parsing — silently becoming an unchecked
 * `docs` citation — as soon as that collapse was correctly scoped to the path.
 * Neither behaviour was reasoned about; both were a regex reaching past the
 * part of the URL it meant to read.
 */
const RAW_HOST = /^https?:\/\/raw\.githubusercontent\.com(?:[/?#]|$)/i;

/** The ref out of a well-formed raw URL, when there is one to name. */
const RAW_URL =
  /^https?:\/\/raw\.githubusercontent\.com\/[^/#?\s]{1,128}\/[^/#?\s]{1,128}\/(?:refs\/(?:heads|tags)\/)?([^/#?\s]{1,256})\/[^#?\s]{1,1024}(?:\?[^#\s]{0,256})?(?:#\S{0,128})?$/i;

/** `#L869`, `#L869-L881`, `#L869-881`. */
const LINE_ANCHOR = /^#L\d{1,9}(?:-L?\d{1,9})?$/;

/**
 * Refs that move under the citation. A blob URL on a branch cites whatever that
 * branch says when the reader opens it, so the line the anchor names and the
 * quote in `note` drift apart while the URL keeps resolving — the failure mode a
 * broken link at least announces.
 */
const MOVING_REFS = new Set(["main", "master", "head", "develop", "dev", "trunk", "latest"]);

/**
 * What a citation proves, which is what `confidence` is allowed to claim.
 *
 * - `pinned-source` — the code itself at an immutable ref, landing on the line.
 *   The claim is checkable by opening one link.
 * - `docs` — prose. It states a rule; it does not show this repo breaking it.
 *
 * A code-host file URL that is none of these (raw renderer, moving ref, or no
 * line anchor) is not demoted to `docs` — it is refused, because it reads as
 * source-level proof while being unable to deliver it.
 */
type SourceClass = "pinned-source" | "docs";

/**
 * The plain-text renderer is never salvageable, whichever spelling reached it.
 * The response is `text/plain`, so there is nothing for `#L869` to scroll to:
 * the reader is handed a whole file and told the finding is somewhere in it,
 * which is the case the line anchor exists to rule out. Pinned or not, it is
 * refused and told what to cite — and when the ref moves too, it is told that
 * as well, so pinning does not read as the one edit that would fix it.
 */
function refuseRawFile(ref: string): { cls: SourceClass; problem: string } {
  const moving = MOVING_REFS.has(ref.toLowerCase()) ? `, and '${ref}' moves under it` : "";
  return {
    cls: "docs",
    problem:
      "cites the raw file, which is served as plain text and cannot land on " +
      `a line${moving} — cite the blob view of the same file at an immutable ` +
      "ref, with a #L<line> anchor",
  };
}

/**
 * Cosmetic variants of one URL, folded together before it is classified.
 *
 * Both matchers are anchored, so anything they cannot parse falls through to
 * `docs` unexamined — which made two typos into bypasses rather than errors. A
 * trailing space or newline on `…/blob/main/User.cs#L4` failed the `$`, and a
 * doubled slash after the host failed the non-empty owner segment; either one
 * turned a citation that would have been refused into an unchecked `docs`.
 * Whitespace goes first, then runs of `/` in everything after the scheme.
 *
 * The collapse is bounded to the longest path either matcher accepts, so no run
 * of slashes that could have sat inside a match survives it. It stops at the
 * query or fragment, which can legitimately carry a whole URL of their own —
 * `?redirect=https://example.com` would otherwise come back as
 * `https:/example.com`. No verdict depends on it either way, since both
 * matchers treat the query as opaque; a function that quietly corrupts part of
 * its input is worth not having regardless.
 */
export function normalizeSource(source: string): string {
  const trimmed = source.trim();
  const scheme = trimmed.indexOf("://");
  if (scheme < 0) return trimmed;
  const head = trimmed.slice(0, scheme + 3);
  const rest = trimmed.slice(scheme + 3);
  const cut = rest.search(/[?#]/);
  const path = cut < 0 ? rest : rest.slice(0, cut);
  const tail = cut < 0 ? "" : rest.slice(cut);
  return head + path.replace(/\/{2,1024}/g, "/") + tail;
}

function classifyCitation(source: string): { cls: SourceClass; problem?: string } {
  const url = normalizeSource(source);
  if (RAW_HOST.test(url)) {
    // Name the ref when the path is well-formed enough to hold one; a malformed
    // raw URL is still refused, just without the moving-ref half of the message.
    const raw = RAW_URL.exec(url);
    return refuseRawFile(raw ? raw[1] : "");
  }

  const m = HOST_FILE_URL.exec(url);
  if (!m) return { cls: "docs" };
  const view = m[1].toLowerCase();
  const ref = m[2];
  const fragment = m[3] ?? "";
  if (view === "raw") return refuseRawFile(ref);
  if (MOVING_REFS.has(ref.toLowerCase())) {
    return {
      cls: "docs",
      problem:
        `cites the moving ref '${ref}' — pin a tag or a commit sha, or the line ` +
        `this finding names moves out from under the citation`,
    };
  }
  if (!LINE_ANCHOR.test(fragment)) {
    return {
      cls: "docs",
      problem:
        "names a source file with no #L<line> anchor — a file-level link says " +
        "the construct is in there somewhere, which is not what the finding claims",
    };
  }
  return { cls: "pinned-source" };
}

/**
 * The one thing `confidence` can be checked against here.
 *
 * Confidence is how sure the detector is that **the code exhibits the issue** —
 * a judgement about signal strength, owned by the detector playbook and copied by
 * the run: from the matching row, or from the playbook's stated default where a
 * discovering detector found a signal its table does not enumerate. It is
 * deliberately not a function of the citation:
 * `confidential-secret-in-client` is `critical/high` off a static read, because a
 * secret literal in a client build is visible and unambiguous, and it cites a
 * docs page because that is where the *rule* lives. Ranking that down for having
 * prose behind it is the exact conflation
 * [grounding-rules.md](../../grounding-rules.md) forbids — "a thin citation is a
 * grounding problem, not a confidence one". The reverse holds too: a
 * pinned-source citation can back a weak signal.
 *
 * So the tool checks the only case with no judgement in it: a **suppressed**
 * finding asserts nothing, so it has nothing to be confident about, and a
 * suppressed row at `medium` reads as a live finding someone forgot to ship.
 *
 * Drift between runs on identical evidence is a real defect and this cannot
 * catch it — the playbook is not in the artifact to compare against. That one is
 * held by the copy-from-the-playbook rule in each detector file.
 */
function confidenceProblem(
  suppressed: boolean,
  confidence: Confidence,
): string | null {
  if (!suppressed || confidence === "low") return null;
  return (
    `must be 'low' on a suppressed finding (got '${confidence}') — a suppressed ` +
    "row asserts nothing, so it has no confidence to report"
  );
}

// --- validators --------------------------------------------------------------

// The closed key sets. Kept beside the validators rather than derived from the
// interfaces, because those are erased at runtime — a field added above without
// a name added here is refused at once, which is the failure mode worth having.
const REPORT_KEYS = [
  "schema_version",
  "mode",
  "namespace",
  "repo",
  "actor",
  "actor_source",
  "findings",
  "cross_reference",
  "surface",
  "provenance",
] as const;

const CROSS_REFERENCE_KEYS = ["candidates"] as const;

const SURFACE_KEYS = ["capabilities", "not_read"] as const;

const SURFACE_CAPABILITY_KEYS = ["capability", "call_sites", "config"] as const;

const CALL_SITE_KEYS = ["path", "line"] as const;

const CONFIG_EDGE_KEYS = ["read", "result", "read_at"] as const;

const CROSS_REF_CANDIDATE_KEYS = [
  "detector_id",
  "signal",
  "disposition",
  "path",
  "read",
  "result",
  "unreadable_reason",
  "finding_id",
] as const;

const REPO_KEYS = [
  "name",
  "url",
  "commit_sha",
  "tree_state",
  "tree_hash",
] as const;

const FINDING_KEYS = [
  "id",
  "detector_id",
  "severity",
  "confidence",
  "title",
  "location",
  "citations",
  "suppressed",
  "snippet_hash",
  "signal",
] as const;

function validateFinding(v: Validator, f: unknown, path: string): void {
  const finding = v.object(f, path);
  if (!finding) return;
  v.only(finding, FINDING_KEYS, path);
  // Both required, so neither has an absent form and neither is gated in the
  // renderers — the check belongs here, the way a candidate's `signal` does.
  // Measured before it existed: a `title` of one space rendered `## CRITICAL —`
  // with nothing after the dash, and `pr-plan` derived the PR title and commit
  // subject `fix(auth-token-safety):` from it. That string is published to a
  // git host and outlives the branch. A blank `id` renders `- **Id:** ``` and is what a
  // candidate's `finding_id` joins to; `buildPrPlan` happens to refuse it a
  // step later for not being a fingerprint, which is a different check that
  // would stop applying the moment ids stopped being hashes.
  //
  // Both are also single-line, and these two are where the rule bites hardest.
  // `title` is interpolated into `## ${severity} — ${title}` and `id` into a
  // `- **Id:** \`…\`` row, neither through `oneLine`, so a value carrying `\n## `
  // does not merely wrap: it closes the row it was in and opens a heading of its
  // own, and the exported page reads as though the report asserted it. Measured
  // on the sample: four headings became five, from either field.
  for (const field of ["id", "title"] as const) {
    if (!v.requireString(finding[field], `${path}.${field}`)) continue;
    if (isInvisibleOnly(finding[field] as string)) {
      v.fail(
        `${path}.${field}`,
        `must contain ${NOT_ONLY_INVISIBLE} ${ONLY_INVISIBLE_GOT} — a ` +
          `${field} that renders as nothing leaves the finding stated by its ` +
          "severity alone",
      );
      continue;
    }
    checkSingleLine(v, finding[field] as string, `${path}.${field}`);
  }
  v.requireEnum(finding.detector_id, DETECTOR_IDS, `${path}.detector_id`);
  v.requireEnum(finding.severity, SEVERITIES, `${path}.severity`);
  v.requireEnum(finding.confidence, CONFIDENCES, `${path}.confidence`);

  const suppressed = finding.suppressed === true;
  const citations = finding.citations;
  const cited =
    Array.isArray(citations) && citations.length > 0 && citations.every(isCitation);

  // grounded-or-suppressed: a live finding with no resolvable citation is
  // rejected here so ungrounded claims can never reach a report or memory.
  if (!suppressed && !cited) {
    v.fail(
      `${path}.citations`,
      "a non-suppressed finding needs >=1 citation with an internal:// or https:// source",
    );
  }
  // Every citation element must be well-formed regardless of `suppressed`, so a
  // malformed citation is refused at validate time rather than crashing export.
  if (citations !== undefined && !Array.isArray(citations)) {
    v.fail(`${path}.citations`, "must be an array when present");
  } else if (Array.isArray(citations)) {
    citations.forEach((c, i) => {
      if (!isCitation(c)) {
        v.fail(
          `${path}.citations[${i}]`,
          "must be { source: internal://|https://…, note?: string }",
        );
      }
    });
  }

  // A blob URL that cannot deliver source-level proof is refused outright rather
  // than quietly counted as prose: from the report, the reader cannot tell a
  // citation that lands on the construct from one that merely names its file.
  if (Array.isArray(citations)) {
    citations.forEach((c, i) => {
      if (!isCitation(c)) return;
      const { problem } = classifyCitation(c.source);
      if (problem) v.fail(`${path}.citations[${i}].source`, problem);
      // And single-line, which nothing above catches. `isCitation` and
      // `classifyCitation` both look at the *start* of the value — a scheme
      // prefix and what follows it — so everything after a line terminator is
      // unexamined. A survey that replaces the whole value cannot see this:
      // the replacement loses the `https://`, the citation is refused for
      // being ungrounded, and the row reads as already guarded. Appending
      // `\n## ` to a real URL is what it actually looks like, and that passed:
      // the exported page went from four headings to five and the PR body from
      // two to three, so this string forges on both surfaces a citation
      // reaches. It is also one line per URL in the `citation_urls` manifest,
      // where a second line is a second URL for a resolver to fetch.
      checkSingleLine(v, c.source, `${path}.citations[${i}].source`);

      // `isCitation` type-checks `note` and stops there, so a value that
      // renders as nothing satisfied it. This one leaves the page as well:
      // `pr-plan` writes it into the PR body, where
      // it reaches a git host as `- https://…/x/ — ` and outlives the branch.
      // An absent note renders nothing at all, so a blank one is never the
      // clearer of the two — omit it rather than publishing the dash.
      //
      // Single-line for the same reason and one surface further on. Both
      // exporters append the note to a citation line raw — `- ${source} — ${note}`
      // — so a `\n## ` ends that line and starts a heading, in a page whose whole
      // claim is that every finding is grounded. `buildPrPlan` does call `oneLine`
      // here, which is the second defence working; the exported page has none.
      if (c.note === undefined) return;
      if (isInvisibleOnly(c.note)) {
        v.fail(
          `${path}.citations[${i}].note`,
          `must contain ${NOT_ONLY_INVISIBLE} ${ONLY_INVISIBLE_GOT} — a note ` +
            "that renders as nothing publishes a dash and no reason behind it, " +
            "and omitting the field says the same thing without the dash",
        );
        return;
      }
      checkSingleLine(v, c.note, `${path}.citations[${i}].note`);
    });
  }

  if ((CONFIDENCES as readonly string[]).includes(finding.confidence as string)) {
    const problem = confidenceProblem(suppressed, finding.confidence as Confidence);
    if (problem) v.fail(`${path}.confidence`, problem);
  }

  // Optional: reports written before the field existed are still valid. When it
  // is present it must be a real digest, so a placeholder cannot masquerade as
  // proof that an id was derived rather than asserted.
  if (finding.snippet_hash !== undefined) {
    if (
      typeof finding.snippet_hash !== "string" ||
      !SHA256_HEX.test(finding.snippet_hash)
    ) {
      v.fail(`${path}.snippet_hash`, "must be a 64-char lowercase sha256 hex digest");
    }
  }

  // Optional for the reason the interface gives, and held to the same shape as a
  // candidate's `signal` when it is there: this string is a join key, and a key
  // that renders as nothing joins everything or nothing without saying which.
  if (finding.signal !== undefined) {
    if (v.requireString(finding.signal, `${path}.signal`)) {
      const signal = finding.signal as string;
      if (isInvisibleOnly(signal)) {
        v.fail(
          `${path}.signal`,
          `must contain ${NOT_ONLY_INVISIBLE} ${ONLY_INVISIBLE_GOT} — a signal ` +
            "that renders as nothing cannot be joined to a key row",
        );
      } else {
        checkSingleLine(v, signal, `${path}.signal`);
      }
    }
  }

  if (finding.location !== undefined) {
    const loc = v.object(finding.location, `${path}.location`);
    if (loc) {
      // Same spelling rule as a suppression's `path`: this string is what a
      // recovery match compares against, and what `fingerprint --path` was fed.
      //
      // Plus the content rule a candidate's `path` already had, and it lands
      // harder here. `requireRepoPath` refuses *shapes* — absolute, `./`, `..`,
      // backslashes, and a line terminator — and never asks whether the value
      // renders as anything, so a finding could name a file with a value that
      // renders as nothing and pass.
      // That reached three places, not one: a `Location:` row whose code span
      // holds `  :42`, the PR body's `Changes \`  \`:42.`, and `PrPlan.path`,
      // which `pr-guard` compares the diff's touched files against. Refusing it
      // does not move any key — a value nobody can see was never a match target.
      if (v.requireString(loc.path, `${path}.location.path`)) {
        if (isInvisibleOnly(loc.path as string)) {
          v.fail(
            `${path}.location.path`,
            `must contain ${NOT_ONLY_INVISIBLE} ${ONLY_INVISIBLE_GOT} — this ` +
              "names the file the finding is about, and a value that renders " +
              "as nothing is both a page nobody can read and a diff nobody " +
              "can hold a fix to",
          );
        } else {
          // Shape *and* single line, both from `requireRepoPath` — the line
          // half used to be written out here, and moving it into the function
          // is what closed the caller that had forgotten it. `real\n## Forged
          // heading` is repo-relative, slash-free and `..`-free, and it lands
          // on three surfaces: `locationLabel` interpolates it raw into a code
          // span, and a code span cannot cross a line, so the page renders the
          // backticks literally and the remainder as a heading. `buildPrPlan`
          // interpolates it raw as well — measured 2026-08-10, the PR body
          // carried the forged heading to the git host — and hands the same
          // unflattened string out as `PrPlan.path`, which is what `pr-guard`
          // holds the diff's touched files against.
          requireRepoPath(v, loc.path as string, `${path}.location.path`);
        }
      }
      if (loc.line !== undefined && typeof loc.line !== "number") {
        v.fail(`${path}.location.line`, "must be a number when present");
      }
    }
  }
}

/**
 * Validate the Stage 3 inventory — every candidate the run attempted a live read
 * on, and what came of each (attempted, not settled: ADR-0006).
 *
 * The rules here exist because this is the only part of the artifact that
 * records a **removal**. A candidate the read refuted ships no finding, so
 * nothing else in the report describes it; if this object can hold a verdict
 * with no evidence behind it, the record is worth no more than the silence it
 * replaced. Hence: `confirmed` and `refuted` must name the read and what came
 * back, and `not-readable` — the disposition for a read that did not settle the
 * finding's own proposition — must not be forced to invent a *result*.
 *
 * It is forced, from generation 5, to say **why** (ADR-0006). "Not readable"
 * with nothing beside it reads identically to a candidate nobody looked at,
 * which is the one thing the row is there to rule out, and a live run wrote that
 * row while its own access log held the admin-client GET behind it.
 * `unreadable_reason` carries the distinction, and `read` comes with it wherever
 * a read was actually made.
 *
 * `findingIds` is the report's own set, so `finding_id` is checked against the
 * findings actually shipped rather than accepted as a well-formed string.
 * `generation` picks which of those rules apply: a stored report is readable at
 * the rules it was written under, rather than a rescan being forced by a version
 * bump alone.
 */
function validateCrossReference(
  v: Validator,
  data: unknown,
  findingIds: Set<string>,
  generation: number,
  path: string,
): void {
  const xref = v.object(data, path);
  if (!xref) return;
  v.only(xref, CROSS_REFERENCE_KEYS, path);

  if (!Array.isArray(xref.candidates)) {
    v.fail(
      `${path}.candidates`,
      "must be an array — empty is the answer when the read raised nothing to settle",
    );
    return;
  }

  xref.candidates.forEach((entry, i) => {
    const at = `${path}.candidates[${i}]`;
    const c = v.object(entry, at);
    if (!c) return;
    v.only(c, CROSS_REF_CANDIDATE_KEYS, at);
    v.requireEnum(c.detector_id, DETECTOR_IDS, `${at}.detector_id`);
    v.requireEnum(c.disposition, DISPOSITIONS, `${at}.disposition`);

    // The playbook row (or discovered signal) the candidate came from. It is
    // what makes a drop legible to someone who was not in the session: the
    // detector id alone names four rows or forty.
    //
    // `isInvisibleOnly`, not `requireString` alone: this is the one candidate
    // field both renderers print *unconditionally*, so it is the one with no
    // gate downstream to catch a value of one space. It reaches the page as an
    // empty backtick pair and the row names no row at all.
    if (v.requireString(c.signal, `${at}.signal`)) {
      if (isInvisibleOnly(c.signal as string)) {
        v.fail(
          `${at}.signal`,
          `must contain ${NOT_ONLY_INVISIBLE} ${ONLY_INVISIBLE_GOT} — this field ` +
            "is what identifies the row behind the candidate, and one that " +
            "renders as nothing leaves the drop naming nothing",
        );
      } else {
        checkSingleLine(v, c.signal as string, `${at}.signal`);
      }
    }

    // Same rule as `read` and `result` above, which this field did not have:
    // `requireString` stops at `""`, and `requireRepoPath` only refuses shapes
    // (absolute, `./`, `..`, backslashes, and a line terminator), so ` `
    // satisfied "a path was recorded" while pointing at no file. It is the one whitespace value that
    // reached the rendered page through the chokepoint rather than only through
    // a direct caller of the exported renderers.
    if (c.path !== undefined && v.requireString(c.path, `${at}.path`)) {
      if (isInvisibleOnly(c.path as string)) {
        v.fail(
          `${at}.path`,
          `must contain ${NOT_ONLY_INVISIBLE} ${ONLY_INVISIBLE_GOT} — a path that ` +
            "renders as nothing points at no file, and this is how a reader " +
            "finds what the candidate was about",
        );
      } else {
        // Held to the line rule its sibling fields already had, and that every
        // caller of `requireRepoPath` now gets from the function itself. Both
        // renderers put this one through `oneLine`, so it forges nothing today
        // — which is exactly the argument this file has refused twice: a value
        // the validator accepts and a renderer happens to flatten is one
        // careful call away from the raw interpolation `location.path` turned
        // out to be. Same field, same documented rule, one check.
        requireRepoPath(v, c.path as string, `${at}.path`);
      }
    }

    for (const field of ["read", "result"] as const) {
      const value = c[field];
      if (value === undefined) continue;
      if (!v.requireString(value, `${at}.${field}`)) continue;
      // `requireString` rejects `""` and stops there, so ` `, a tab and a
      // zero-width space each satisfied "the evidence was recorded" while
      // recording nothing — the row this section exists to refuse, wearing a
      // value. Same rule a namespace is held to, and the same reason.
      if (isInvisibleOnly(value as string)) {
        v.fail(
          `${at}.${field}`,
          `must contain ${NOT_ONLY_INVISIBLE} ${ONLY_INVISIBLE_GOT} — a ${field} ` +
            "that renders as nothing is not evidence, and this field is the " +
            "whole of what stands behind the row",
        );
        continue;
      }
      checkSingleLine(v, value as string, `${at}.${field}`);
    }

    if (typeof c.result === "string" && c.result.length > RESULT_MAX) {
      v.fail(
        `${at}.result`,
        `must be at most ${RESULT_MAX} characters (got ${c.result.length}) — it ` +
          "records what a read settled, not the body it settled from, and this " +
          "report is written into a scope the whole studio reads",
      );
    }

    // A verdict with nothing recorded behind it. `not-readable` is exempt from
    // `result` because it is precisely the disposition for a read that did not
    // complete, and a result demanded there is a result a run would invent.
    const settled = c.disposition === "confirmed" || c.disposition === "refuted";
    if (settled) {
      for (const field of ["read", "result"] as const) {
        if (isRecorded(c[field])) continue;
        v.fail(
          `${at}.${field}`,
          `must be recorded on a '${c.disposition}' candidate — a disposition ` +
            "that settles one names the read it settled on, or the record says " +
            "no more than the silence it replaced",
        );
      }
    }

    // Which of the four ways it was not readable (ADR-0006). The row exists to
    // separate *tried and failed* from *never looked*, and a bare
    // `not-readable` records neither: a live run wrote one for
    // `confidential-secret-in-client` while its access log held the
    // admin-client GET it had made and dropped.
    //
    // One rule decides all of this, and it is a rule about the field rather
    // than about the disposition: **the field did not exist before generation
    // 5**. Below 5 it is refused wherever it appears — nothing stored can carry
    // it, so nothing is invalidated, and grandfathering a field into
    // generations that predate it would let a shape today's closed-object check
    // refuses start validating at 4. At 5 and above it is required on
    // `not-readable` and refused on the two dispositions that settle something.
    if (generation < 5) {
      if (c.unreadable_reason !== undefined) {
        v.fail(
          `${at}.unreadable_reason`,
          `must be absent below schema_version 5 (this report declares ` +
            `${generation}) — the field did not exist before that generation, so ` +
            "a report claiming an older one is describing itself with a " +
            "vocabulary it also says it predates",
        );
      }
    } else if (c.disposition === "not-readable") {
      if (c.unreadable_reason !== undefined) {
        v.requireEnum(c.unreadable_reason, UNREADABLE_REASONS, `${at}.unreadable_reason`);
      } else {
        v.fail(
          `${at}.unreadable_reason`,
          `must be one of [${UNREADABLE_REASONS.join(", ")}] on a 'not-readable' ` +
            "candidate from schema_version 5 on — the row is the only thing that " +
            "tells a reader the run tried, and 'not-readable' by itself reads the " +
            "same as a candidate nobody looked at",
        );
      }
      // `errored`, `unauthorized` and `answers-another-question` are all reads
      // that were *made*, so each names the operation it made. `no-operation` is
      // the only exemption, because it is the only one where no operation was
      // run, and asking for a `read` there would have a run compose an endpoint
      // it never called. `result` is exempt throughout: it is worth recording on
      // a read that landed and settled something else, but requiring it on a
      // read that settled nothing would make a run invent one (ADR-0005).
      //
      // `isRecorded`, not `!== undefined`: a `read` of one space names an
      // operation exactly as well as no `read` at all.
      if (!isRecorded(c.read) && c.unreadable_reason !== "no-operation") {
        v.fail(
          `${at}.read`,
          "must name the operation attempted on a 'not-readable' candidate from " +
            "schema_version 5 on, unless unreadable_reason is 'no-operation' — " +
            "every other reason describes a read that was made, and the attempt " +
            "is the fact this row carries",
        );
      }
    } else if (c.unreadable_reason !== undefined) {
      // Say only what the row actually says. `disposition` is validated above
      // and may be missing or misspelled by the time this runs, and "must be
      // absent on a 'undefined' candidate — that disposition settled the
      // candidate on a read that landed" asserts two things about a value that
      // is not a disposition at all.
      const settlingDisposition =
        c.disposition === "confirmed" || c.disposition === "refuted";
      v.fail(
        `${at}.unreadable_reason`,
        settlingDisposition
          ? `must be absent on a '${c.disposition}' candidate — that disposition ` +
              "settled the candidate on a read that landed, so it has no " +
              "unreadability to explain"
          : "must be absent unless disposition is 'not-readable' — it explains " +
              "why a read did not settle a candidate, and that is the only " +
              "disposition saying one did not",
      );
    }

    if (c.finding_id === undefined) return;
    if (c.disposition === "refuted") {
      v.fail(
        `${at}.finding_id`,
        "must be absent on a refuted candidate — it was dropped, so a finding " +
          "id here points at a row this report did not ship",
      );
      return;
    }
    if (!v.requireString(c.finding_id, `${at}.finding_id`)) return;
    if (findingIds.has(c.finding_id as string)) return;
    v.fail(
      `${at}.finding_id`,
      `names no finding in this report (got ${excerpt(c.finding_id as string)}) — ` +
        "a candidate that survived points at the row it became, or at nothing",
    );
  });
}

/**
 * One visible line, in a field a renderer prints without a gate.
 *
 * Every required string on the surface is printed unconditionally — that is the
 * convention a required field follows here, and the reason its whitespace check
 * has to live in the validator: there is no "absent" rendering to fall back to,
 * so a value of one space reaches the page as a label with nothing after it.
 */
function checkVisibleLine(v: Validator, value: unknown, at: string, why: string): boolean {
  if (!v.requireString(value, at)) return false;
  if (isInvisibleOnly(value as string)) {
    v.fail(at, `must contain ${NOT_ONLY_INVISIBLE} ${ONLY_INVISIBLE_GOT} — ${why}`);
    return false;
  }
  checkSingleLine(v, value as string, at);
  return true;
}

/**
 * Validate the Stage 2 call-site index.
 *
 * `mode` is a parameter rather than a lookup because only one thing here is
 * mode-paired: a `config` edge is a live read of the namespace, so it travels
 * with the mode in both directions exactly as `namespace` and `cross_reference`
 * do. The index itself does not — Stage 2 is a static read that runs in both
 * modes, and a run whose live half fails relabels itself `code-only` and keeps
 * the map it already built.
 */
function validateSurface(
  v: Validator,
  data: unknown,
  mode: unknown,
  scannedAt: unknown,
  path: string,
): void {
  const surface = v.object(data, path);
  if (!surface) return;
  v.only(surface, SURFACE_KEYS, path);

  if (surface.not_read !== undefined) {
    if (!Array.isArray(surface.not_read)) {
      v.fail(
        `${path}.not_read`,
        "must be an array when present — each entry names one call surface this " +
          "scan did not read",
      );
    } else {
      surface.not_read.forEach((entry, i) => {
        checkVisibleLine(
          v,
          entry,
          `${path}.not_read[${i}]`,
          "this is the sentence that stops a short list from reading as a " +
            "complete one, and an entry that renders as nothing narrows the " +
            "section's claim without telling anyone what it left out",
        );
      });
    }
  }

  if (!Array.isArray(surface.capabilities)) {
    v.fail(
      `${path}.capabilities`,
      "must be an array — empty is the answer when the SDK is present and the " +
        "scan matched no call",
    );
    return;
  }

  const seen = new Set<string>();
  surface.capabilities.forEach((entry, i) => {
    const at = `${path}.capabilities[${i}]`;
    const c = v.object(entry, at);
    if (!c) return;
    v.only(c, SURFACE_CAPABILITY_KEYS, at);

    if (
      checkVisibleLine(
        v,
        c.capability,
        `${at}.capability`,
        "it is the heading the whole entry hangs off, and one that renders as " +
          "nothing leaves a list of call sites belonging to no service",
      )
    ) {
      // The *rendered* form, not the raw string. Both exporters put this
      // through `oneLine`, so "lobby" and "lobby " are one heading on the page
      // and were two keys here — the page named it twice with `validate`
      // reporting ok, which is the exact failure the message below predicts.
      // A fold over the index groups on the same normalised name.
      const name = oneLine(c.capability as string);
      // Two entries for one capability render as two sections with the same
      // heading, and a consumer folding the index by capability gets a count
      // that is right about nothing. One entry, however many call sites.
      if (seen.has(name)) {
        v.fail(
          `${at}.capability`,
          `must not repeat a capability already listed (got ${excerpt(name)}) — ` +
            "call sites for one capability belong to one entry, or the page " +
            "names it twice and a fold over the index counts it twice",
        );
      }
      seen.add(name);
    }

    if (!Array.isArray(c.call_sites)) {
      v.fail(
        `${at}.call_sites`,
        "must be an array — this is the evidence the entry consists of",
      );
    } else if (c.call_sites.length === 0) {
      // Unlike `capabilities`, empty here is not an answer. The entry exists to
      // say *where*, so one with nowhere in it is the assertion this object was
      // added to replace.
      v.fail(
        `${at}.call_sites`,
        "must name at least one call site — a capability with none behind it is " +
          "a claim that this commit calls it, and this field is what makes it " +
          "checkable instead",
      );
    } else {
      // The count is the one derived number this section prints, and the bar it
      // is built for is a precision bar on the entries. Three copies of one
      // location render as `(3 call sites)` over three identical bullets.
      const located = new Set<string>();
      c.call_sites.forEach((site, j) => {
        const where = `${at}.call_sites[${j}]`;
        const s = v.object(site, where);
        if (!s) return;
        v.only(s, CALL_SITE_KEYS, where);
        if (typeof s.path === "string" && typeof s.line === "number") {
          const at_ = `${oneLine(s.path)}:${s.line}`;
          if (located.has(at_)) {
            v.fail(
              where,
              `must not repeat a call site already listed (got ${excerpt(at_)}) — ` +
                "the count beside the capability is the one derived number this " +
                "section prints, and a repeat inflates it over a location a " +
                "reader opens once",
            );
          }
          located.add(at_);
        }
        // The same three-step shape as a finding's `location.path` and a
        // candidate's `path`, and written out rather than routed through
        // `checkVisibleLine` for one reason: that helper carries its own
        // `checkSingleLine`, and `requireRepoPath` now carries the line rule
        // too, so the pair would report one terminator twice on one field. The
        // helper stays as it is for the fields that are not paths.
        if (v.requireString(s.path, `${where}.path`)) {
          if (isInvisibleOnly(s.path as string)) {
            v.fail(
              `${where}.path`,
              `must contain ${NOT_ONLY_INVISIBLE} ${ONLY_INVISIBLE_GOT} — this is ` +
                "the file a reader opens, and it is interpolated raw into " +
                "a code span on the exported page",
            );
          } else {
            requireRepoPath(v, s.path as string, `${where}.path`);
          }
        }
        // Required, not optional as it is on a finding: the requirements
        // baseline asks for a clickable location per service, and `path` with
        // no line is not one. `Grep` produces the number, so a missing one
        // means the entry was composed rather than read.
        // `isSafeInteger`, not `isInteger`: `1e21` satisfies the looser one and
        // renders `a.cs:1e+21`, which is not the clickable location the
        // required-`line` rule exists to guarantee.
        if (typeof s.line !== "number" || !Number.isSafeInteger(s.line) || s.line < 1) {
          // The number, when there is one. `got number` names the one thing the
          // author already knew, and every way this field goes wrong while
          // still being a number — `0`, `-1`, `12.5` — is told apart by the
          // value alone. Same reasoning as `requireEnum`.
          const got = typeof s.line === "number" ? String(s.line) : describe(s.line);
          v.fail(
            `${where}.line`,
            `must be a 1-based line number (got ${got}) — the map is ` +
              "derived at file:line precision, and a location without the line " +
              "is not the clickable one this section is for",
          );
        }
      });
    }

    if (c.config === undefined) return;
    // The mode pairing, first direction. A code-only run read no namespace, so
    // an edge on one was composed — and this is the perishable half of the
    // index, the only part that can be wrong while the commit is unchanged, so
    // a composed one is worse than none.
    if (mode !== "config-aware") {
      v.fail(
        `${at}.config`,
        "must be absent unless mode is config-aware — a code-only run reads no " +
          "namespace, so what this edge says the namespace answered came from " +
          "somewhere other than a read",
      );
      return;
    }
    const cfg = v.object(c.config, `${at}.config`);
    if (!cfg) return;
    v.only(cfg, CONFIG_EDGE_KEYS, `${at}.config`);
    checkVisibleLine(
      v,
      cfg.read,
      `${at}.config.read`,
      "an edge names the operation behind it, or it is an assertion about the " +
        "namespace wearing the shape of a read",
    );
    if (
      checkVisibleLine(
        v,
        cfg.result,
        `${at}.config.result`,
        "this is the whole of what the namespace answered, and one that renders " +
          "as nothing records that a read happened and not what it said",
      ) &&
      (cfg.result as string).length > RESULT_MAX
    ) {
      v.fail(
        `${at}.config.result`,
        `must be at most ${RESULT_MAX} characters (got ${(cfg.result as string).length}) — ` +
          "it records what the read settled, not the body it settled from",
      );
    }
    // Dated, always. This is what keeps the edge from being served as current:
    // a studio edits AGS configuration in the Admin Portal without touching a
    // commit, so the SHA the record is pinned to says nothing about how old
    // this half is (ADR-0024). Both exporters print the instant beside it.
    if (
      typeof cfg.read_at !== "string" ||
      !ISO_8601_UTC.test(cfg.read_at) ||
      Number.isNaN(Date.parse(cfg.read_at))
    ) {
      v.fail(
        `${at}.config.read_at`,
        "must be an ISO-8601 UTC instant (YYYY-MM-DDTHH:MM:SSZ) — configuration " +
          "changes without the commit changing, so an edge with no instant on " +
          "it cannot be told from a current reading",
      );
    } else if (
      typeof scannedAt === "string" &&
      ISO_8601_UTC.test(scannedAt) &&
      Date.parse(cfg.read_at) > Date.parse(scannedAt)
    ) {
      // The same ordering rule `provenance.started_at` is held to, and it bites
      // harder here: this instant is the whole of what stops the edge being read
      // as current, so one stamped after the scan that made it makes the
      // perishable half look fresher than the report carrying it.
      v.fail(
        `${at}.config.read_at`,
        `must not be after $.provenance.scanned_at (${cfg.read_at} > ${scannedAt}) — ` +
          "the read happened during the scan, so an instant past its end was " +
          "composed, and this field is the only thing keeping the edge from " +
          "reading as current",
      );
    }
  });
}

/** Validate a Report, returning the list of problems (empty = valid). */
export function validateReport(data: unknown): string[] {
  const v = new Validator();
  const r = v.object(data, "$");
  if (!r) return v.errors;
  v.only(r, REPORT_KEYS, "$");
  v.requireVersion(r.schema_version, "$.schema_version");
  v.requireEnum(r.mode, MODES, "$.mode");

  // The mode and the namespace travel together in both directions. A
  // config-aware report is the only one that read a live namespace, and it is
  // read from `get_token_info` — so its absence means the live half of the run
  // cannot be attributed to an environment, and its presence on a code-only
  // report means the value came from somewhere other than a read.
  if (r.mode === "config-aware") {
    // Blank-rejecting, unlike `requireString`: a whitespace namespace renders as
    // an empty row under a heading that says the environment was read, which is
    // the one outcome this field exists to prevent.
    checkNamespace(
      v,
      r.namespace,
      "$.namespace",
      "must be the namespace the run read live",
    );
    if (r.namespace === NAMESPACE_UNKNOWN) {
      // The sentinel is an activity entry's way of saying *no namespace was
      // read*. A config-aware report is the artifact that claims one was, so the
      // two together are a contradiction — and the mode/namespace pairing above
      // exists precisely so the mode is a claim the report can be held to. A run
      // whose reads all failed relabels itself code-only and drops the field;
      // carrying the sentinel here is that relabel left half-done.
      v.fail(
        "$.namespace",
        `must not be the '${NAMESPACE_UNKNOWN}' sentinel — that is an activity ` +
          `entry's marker for a run that read none, and a config-aware report ` +
          `claims it read one`,
      );
    }
  } else if (r.namespace !== undefined) {
    v.fail(
      "$.namespace",
      "must be absent unless mode is config-aware — a code-only run reads no namespace",
    );
  }

  // The inventory travels with the mode for the same reason the namespace does,
  // and in the same two directions. A code-only run ran no cross-reference, so
  // an inventory on one was composed rather than read — and a run whose reads
  // all failed relabels itself code-only and drops both fields together, which
  // is the case this catches when the relabel is left half-done.
  if (r.mode !== "config-aware" && r.cross_reference !== undefined) {
    v.fail(
      "$.cross_reference",
      "must be absent unless mode is config-aware — a code-only run touches no " +
        "candidate against a live namespace",
    );
  }

  // Every rule below that says "from schema_version N on" is chosen by this
  // number, so a version that names no generation cannot be answered with one.
  // Checking stops here: the remaining problems would be reported against rules
  // picked by a guess, and the report is refused either way.
  const generation = schemaMajor(r.schema_version);
  if (generation === null) {
    v.fail(
      "$.schema_version",
      `must name a schema generation (got ${JSON.stringify(r.schema_version)}) — ` +
        "it selects which rules this report is held to, and one that parses to " +
        "no number would select the oldest and most permissive of them",
    );
    return v.errors;
  }

  const repo = v.object(r.repo, "$.repo");
  if (repo) {
    v.only(repo, REPO_KEYS, "$.repo");
    // The key's second segment, and not always a sha: `subskills/health-check.md`
    // invites a stable identifier of the user's choosing when the project is not
    // a git tree, and `release/2026-07` would mint a key with two readings.
    if (v.requireString(repo.commit_sha, "$.repo.commit_sha")) {
      checkKeySafe(
        v,
        repo.commit_sha as string,
        "$.repo.commit_sha",
        "the report key's second segment",
      );
    }
    // Optional, and until now the one key in `REPO_KEYS` with no check behind
    // it at all — `v.only` admitted the name and nothing looked at the value.
    // So it had no *type* check either: a number or an object passed validate
    // and reached `esc()` in the HTML exporter. Both exporters gate it on bare
    // truthiness, which a value that renders as nothing satisfies, leaving
    // `- **Repo:**` with the line ending after it and ` ·   · ` between the
    // commit and the mode.
    if (repo.url !== undefined && v.requireString(repo.url, "$.repo.url")) {
      if (isInvisibleOnly(repo.url as string)) {
        v.fail(
          "$.repo.url",
          `must contain ${NOT_ONLY_INVISIBLE} ${ONLY_INVISIBLE_GOT} — this is ` +
            "where a reader goes to open the repository, and a row pointing at " +
            "nothing is worse than no row, which is what omitting it gives",
        );
      } else {
        checkSingleLine(v, repo.url as string, "$.repo.url");
      }
    }

    // Required from generation 2 on. A run that does not say whether the tree
    // matched the pin has produced a report whose reusability cannot be judged
    // from the report — and the reuse path keys on the sha alone.
    if (repo.tree_state !== undefined) {
      v.requireEnum(repo.tree_state, TREE_STATES, "$.repo.tree_state");
    } else if (generation >= 2) {
      v.fail(
        "$.repo.tree_state",
        `must be one of [${TREE_STATES.join(", ")}] from schema_version 2 on — ` +
          `say whether the worktree matched ${"$.repo.commit_sha"} when it was scanned`,
      );
    }

    // Required from generation 3 on, and checked against the key's own
    // separators whenever present: the name is the key's first segment, so a
    // name carrying one splits the key somewhere the reader does not expect.
    if (repo.name !== undefined) {
      if (v.requireString(repo.name, "$.repo.name")) {
        // The content rule *before* the separator rule, and this is the one
        // field where "refusing a value that renders as nothing moves no key"
        // is false — this **is** the key's first segment. `checkKeySafe`
        // refuses whitespace, so a space was already out, but a zero-width
        // spelling passed and minted `<U+200B>@<sha>:code-only`: a stored row
        // nobody can type, that no `repo.name` filter can match, and that reads
        // on a listing as a report belonging to no repository.
        if (isInvisibleOnly(repo.name as string)) {
          v.fail(
            "$.repo.name",
            `must contain ${NOT_ONLY_INVISIBLE} ${ONLY_INVISIBLE_GOT} — it is ` +
              "the report key's first segment, so this one is not only a page " +
              "nobody can read but a row nobody can address",
          );
        } else {
          checkKeySafe(v, repo.name as string, "$.repo.name", "the report key's first segment");
        }
      }
    } else if (generation >= 3) {
      v.fail(
        "$.repo.name",
        "must be the repository's directory name from schema_version 3 on — " +
          "wiki_memory_list returns every report in the studio scope with no " +
          "repo filter, and a report that cannot name its repo is read as " +
          "belonging to whichever one is scanning",
      );
    }

    // Paired with `tree_state`, in both directions. A hash without a dirty tree
    // is a second identity for code the commit already identifies, and keying
    // on it would split one commit across rows that all describe it. A dirty
    // tree without a hash cannot be told apart from the next dirty tree at the
    // same commit, so a later run cannot say whether the edits it is being
    // offered are still the ones on disk.
    if (repo.tree_hash !== undefined) {
      if (repo.tree_state !== "dirty") {
        v.fail(
          "$.repo.tree_hash",
          "must be absent unless $.repo.tree_state is 'dirty' — a clean tree is " +
            "identified by its commit, and a second identity for it invites a " +
            "second row describing the same code",
        );
      } else if (typeof repo.tree_hash !== "string" || !SHA256_HEX.test(repo.tree_hash)) {
        v.fail("$.repo.tree_hash", "must be a full lowercase sha-256 digest (64 hex chars)");
      }
    } else if (repo.tree_state === "dirty" && generation >= 3) {
      v.fail(
        "$.repo.tree_hash",
        "must be present on a dirty scan from schema_version 3 on — it is what " +
          "tells a later run whether the uncommitted edits it is being offered " +
          "are still the ones on disk",
      );
    }
  }

  // Required from generation 3 on. A dirty report is keyed by its actor, so one
  // without an actor cannot be stored at all; a clean one carries it for the
  // same reason the activity feed does, and the rule is not worth splitting by
  // tree state when the value is already in hand.
  if (r.actor !== undefined) {
    const actor = v.object(r.actor, "$.actor");
    if (actor) {
      // A dirty report is keyed by its actor, so a value nobody can see is a
      // key nobody can type — `actorSlug` hashes `id`, but a blank one still
      // names nobody.
      //
      // Held to the blank rule and deliberately **not** to the line rule, which
      // everything else a reader sees does carry. Neither value is rendered by
      // any surface in this file: `id` only ever reaches `actorSlug`, and the
      // display name a colleague reads comes from the *activity* entry's own
      // actor, a different object with a different validator. A line rule here
      // would guard the one copy that never renders. The activity entry's copy,
      // which does, carries no content rule at all today — that hole is filed
      // rather than half-closed here, so the two move together.
      for (const field of ["id", "display"] as const) {
        if (!v.requireString(actor[field], `$.actor.${field}`)) continue;
        if (isInvisibleOnly(actor[field] as string)) {
          v.fail(
            `$.actor.${field}`,
            `must contain ${NOT_ONLY_INVISIBLE} ${ONLY_INVISIBLE_GOT} — this ` +
              "names who ran the scan, and a run attributed to nothing is not " +
              "attributed",
          );
        }
      }
    }
  } else if (generation >= 3) {
    v.fail("$.actor", "must name who ran the scan from schema_version 3 on");
  }

  if (r.actor_source !== undefined) {
    v.requireEnum(r.actor_source, ACTOR_SOURCES, "$.actor_source");
  } else if (generation >= 3) {
    v.fail(
      "$.actor_source",
      `must be one of [${ACTOR_SOURCES.join(", ")}] from schema_version 3 on — ` +
        "an actor with no stated provenance cannot be told apart from one a run " +
        "composed for itself",
    );
  }

  // Optional, so reports written before provenance existed still validate. When
  // present it must be a real instant: a free-text date renders as a marker the
  // reader trusts and cannot compare.
  if (r.provenance !== undefined) {
    const p = v.object(r.provenance, "$.provenance");
    if (p) {
      if (
        typeof p.scanned_at !== "string" ||
        !ISO_8601_UTC.test(p.scanned_at) ||
        Number.isNaN(Date.parse(p.scanned_at))
      ) {
        v.fail(
          "$.provenance.scanned_at",
          "must be an ISO-8601 UTC instant (YYYY-MM-DDTHH:MM:SSZ)",
        );
      }
      // The other end of the run. Required from generation 4 on whenever
      // provenance is recorded at all: every other instant in the artifact is
      // stamped at Stage 6, so without this one a complete report still cannot
      // say how long the scan took, which is how two fully-preserved pilot runs
      // came to be unscoreable on wall-clock.
      if (p.started_at !== undefined) {
        if (
          typeof p.started_at !== "string" ||
          !ISO_8601_UTC.test(p.started_at) ||
          Number.isNaN(Date.parse(p.started_at))
        ) {
          v.fail(
            "$.provenance.started_at",
            "must be an ISO-8601 UTC instant (YYYY-MM-DDTHH:MM:SSZ)",
          );
        } else if (
          typeof p.scanned_at === "string" &&
          ISO_8601_UTC.test(p.scanned_at) &&
          Date.parse(p.started_at) > Date.parse(p.scanned_at)
        ) {
          // Both are read from `date -u`, so an inversion is not clock skew —
          // it is a composed value, and a duration derived from it is negative.
          v.fail(
            "$.provenance.started_at",
            `must not be after $.provenance.scanned_at (${p.started_at} > ` +
              `${p.scanned_at}) — both are read from the clock, so an ordering ` +
              "this way round means one of them was composed",
          );
        }
      } else if (generation >= 4) {
        v.fail(
          "$.provenance.started_at",
          "must be stamped at Stage 1 from schema_version 4 on when provenance " +
            "is recorded — every other instant here is written at Stage 6, so " +
            "without it the report cannot say how long the scan took",
        );
      }
      // `requireString` stops at `""`. Anything past it rendered
      // `(teammate )` — an empty parenthesis on the one row a reader consults
      // to tell a fresh report from one served out of memory, on the page, in
      // the HTML and in the PR body alike.
      if (p.tool_version !== undefined && v.requireString(p.tool_version, "$.provenance.tool_version")) {
        if (isInvisibleOnly(p.tool_version as string)) {
          v.fail(
            "$.provenance.tool_version",
            `must contain ${NOT_ONLY_INVISIBLE} ${ONLY_INVISIBLE_GOT} — this ` +
              "says which version of the skill derived the findings, and an " +
              "empty parenthesis beside the timestamp answers that with a shape",
          );
        } else {
          // `provenanceRows` calls `oneLine` on this, so a line terminator
          // reaches the page flattened rather than as a heading. That is a
          // renderer being careful, not a rule being enforced: nothing in the
          // artifact says this value is one line, and the row it lands on is the
          // one a reader consults to decide whether to trust the page at all.
          checkSingleLine(v, p.tool_version as string, "$.provenance.tool_version");
        }
      }
    }
  }

  if (!Array.isArray(r.findings)) {
    v.fail("$.findings", "must be an array");
    return v.errors;
  }
  r.findings.forEach((f, i) => validateFinding(v, f, `$.findings[${i}]`));

  // Last, because `finding_id` is checked against the ids this report actually
  // shipped. Required from generation 4 on: a config-aware report that does not
  // say what its live half attempted cannot be told apart from a code-only one
  // wearing the label (ADR-0005).
  if (r.cross_reference !== undefined) {
    const findingIds = new Set<string>(
      r.findings
        .map((f) => asRecord(f)?.id)
        .filter((id): id is string => typeof id === "string"),
    );
    validateCrossReference(v, r.cross_reference, findingIds, generation, "$.cross_reference");
  } else if (r.mode === "config-aware" && generation >= 4) {
    v.fail(
      "$.cross_reference",
      "must record every candidate the run attempted a live read on, from " +
        "schema_version 4 on — a config-aware report without it is scoreable " +
        "only on the half it shares with a code-only run, and a refuted " +
        "candidate leaves no trace at all",
    );
  }

  // Required from generation 6 on, in both modes. Stage 2 derives this map on
  // every run and used to discard it, so a report that omits it is a run that
  // threw away the one part of its work the requirements baseline asked to see
  // — and the section it feeds, *Services in use*, went unbuilt for as long as
  // the field did not exist (ADR-0024).
  if (r.surface !== undefined) {
    validateSurface(v, r.surface, r.mode, asRecord(r.provenance)?.scanned_at, "$.surface");
  } else if (generation >= 6) {
    v.fail(
      "$.surface",
      "must record which AGS capabilities this commit calls and where, from " +
        "schema_version 6 on — Stage 2 derives it on every run, and a report " +
        "without it cannot answer what the project uses without a rescan",
    );
  }
  return v.errors;
}

/** Validate a Suppression, returning the list of problems (empty = valid). */
export function validateSuppression(data: unknown): string[] {
  const v = new Validator();
  const s = v.object(data, "$");
  if (!s) return v.errors;
  v.requireVersion(s.schema_version, "$.schema_version");
  // A suppression is keyed `<repo-name>@<detector-id>:<id>`, so two of its
  // fields are key segments and are held to the key's separators. The third
  // segment, `detector_id`, is an enum and cannot carry one.
  if (v.requireString(s.id, "$.id")) {
    checkKeySafe(v, s.id as string, "$.id", "the suppression key's last segment");
  }
  // Required because `wiki_memory_list` returns every suppression in the studio
  // scope with no repo filter. A record that cannot say which repo it came from
  // gets applied to whichever one is scanning.
  if (v.requireString(s.repo, "$.repo")) {
    checkKeySafe(v, s.repo as string, "$.repo", "the suppression key's first segment");
  }
  v.requireEnum(s.detector_id, DETECTOR_IDS, "$.detector_id");
  // The content check ahead of the shape check, which is the three-step shape
  // every other `path` in this file already had — `findings[].location.path`, a
  // `cross_reference` candidate's `path`, a surface call site's `path` — and the
  // one this field was left out of. `requireRepoPath` refuses *shapes* only, so
  // `" "` and a lone U+200B were repo-relative, slash-free, `..`-free and one
  // line, and passed.
  //
  // It lands harder here than on any of those, and for a different reason: they
  // are displayed, and this one is **compared**. It is the string
  // `fingerprint --path` was fed and what the load path narrows on, so a
  // dismissal keyed on a value nobody can see is one nobody can check.
  //
  // Not inert, though — that was the first version of this sentence and it was
  // wrong. A candidate's path comes from a real file, so it is never
  // invisible-only, which closes the match branch that compares `detector_id`
  // and `path`. The ordinary branch compares `snippet_hash` and `id` and never
  // looks at `path` at all (suppression-matching.md § Match), so a record like
  // this still suppresses whenever its `id` was written rather than derived
  // from its own `path` — the one field that file already declines to trust
  // alone in the neighbouring branch. Refusing it here means such a record is
  // reported to the user as invalid instead of silently dismissing a finding
  // on the strength of a path nobody can read.
  if (v.requireString(s.path, "$.path")) {
    if (isInvisibleOnly(s.path)) {
      v.fail(
        "$.path",
        `must contain ${NOT_ONLY_INVISIBLE} ${ONLY_INVISIBLE_GOT} — this is the ` +
          "string the recovery match compares and `fingerprint --path` was " +
          "given, so a value that renders as nothing dismisses no finding and " +
          "leaves nobody able to see which file was excused",
      );
    } else {
      requireRepoPath(v, s.path, "$.path");
    }
  }

  // Required, unlike on a finding. A finding without one is merely harder to
  // diff; a suppression without one cannot be matched at all once its id stops
  // re-deriving, and the run is left asserting or re-litigating.
  if (typeof s.snippet_hash !== "string" || !SHA256_HEX.test(s.snippet_hash)) {
    v.fail("$.snippet_hash", "must be a 64-char lowercase sha256 hex digest");
  }

  v.requireString(s.reason, "$.reason");
  const actor = v.object(s.actor, "$.actor");
  if (actor) {
    v.requireString(actor.id, "$.actor.id");
    v.requireString(actor.display, "$.actor.display");
  }
  // The human subset, not the full one. A suppression records that somebody
  // decided a finding did not matter, and a machine deciding that is how a
  // scanner gets quietly neutered by the pipeline it runs in.
  v.requireEnum(s.actor_source, HUMAN_ACTOR_SOURCES, "$.actor_source");
  v.requireString(s.ts, "$.ts");
  return v.errors;
}

/** Validate an activity entry, returning the list of problems (empty = valid). */
export function validateActivity(data: unknown): string[] {
  const v = new Validator();
  const a = v.object(data, "$");
  if (!a) return v.errors;
  v.requireVersion(a.schema_version, "$.schema_version");

  const actor = v.object(a.actor, "$.actor");
  if (actor) {
    v.requireString(actor.id, "$.actor.id");
    v.requireString(actor.display, "$.actor.display");
  }
  v.requireEnum(a.actor_source, ACTOR_SOURCES, "$.actor_source");
  v.requireEnum(a.persona, PERSONAS, "$.persona");
  v.requireString(a.subskill, "$.subskill");
  // Held to the same shape as the access log's `run`, because the two are
  // required to be the same string. Guarding one side only left the guard on
  // the envelope nobody reads and none on the feed row colleagues do.
  if (v.requireString(a.action, "$.action")) {
    checkActionShape(v, a.action as string, "$.action", "must be an action name");
  }
  // Blank-rejecting, unlike `requireString`, for the same reason the Report's
  // check is: a blank value renders as an entry claiming an environment nobody
  // read. `unknown` is the pinned sentinel a run that read no namespace fills,
  // so it stays valid here — it is the honest answer, not a violation, and it is
  // the one artifact allowed to carry it.
  //
  // This entry also goes into a feed shared across a studio, so the run
  // rendering it is not the run that wrote it. A value carrying a line
  // terminator can forge structure — a heading, a second entry — in whatever
  // does the rendering.
  checkNamespace(
    v,
    a.namespace,
    "$.namespace",
    "must be the namespace this entry concerns, or the sentinel 'unknown'",
  );
  v.requireString(a.target, "$.target");
  v.requireString(a.summary, "$.summary");
  // ts is server-stamped on an append the memory service accepts; its absence
  // means an entry was assembled off-contract. `scope` is intentionally NOT an
  // entry field.
  v.requireString(a.ts, "$.ts");
  if (a.severity !== undefined) {
    v.requireEnum(a.severity, ACTIVITY_SEVERITIES, "$.severity");
  }
  return v.errors;
}

/**
 * Validate an access-log envelope, returning the list of problems (empty = valid).
 *
 * The envelope was specified with pinned field names and nothing checking them,
 * which held only as long as a run happened to read that line. The first live
 * run to flush one wrote its temp directory name into `run`, putting a local
 * path fragment into a record the whole studio reads — and shipped, because no
 * `--kind` covered this document.
 *
 * `entries` is checked line by line rather than by length. A trail is read to
 * answer *what did this run touch*, and one malformed line in the middle is the
 * one that gets skipped by whatever parses it.
 */
export function validateAccessLog(data: unknown): string[] {
  const v = new Validator();
  const e = v.object(data, "$");
  if (!e) return v.errors;
  v.only(e, ACCESS_LOG_KEYS, "$");

  if (v.requireString(e.repo, "$.repo")) {
    checkKeySafe(v, e.repo as string, "$.repo", "the access log's repo name");
  }
  if (v.requireString(e.commit_sha, "$.commit_sha")) {
    checkKeySafe(v, e.commit_sha as string, "$.commit_sha", "the commit the run pinned");
  }
  // The run's own mode, the same value the Report carries. A trail that says
  // `config-aware` beside a code-only report describes a live read that never
  // happened.
  v.requireEnum(e.mode, MODES, "$.mode");

  // The offending *value* is the whole diagnosis here — `teammate-run.3AIePY`
  // tells an author they flushed the run directory in a way "got string" never
  // would. Bounded, because this field is not redacted and an envelope is
  // assembled by a run, not by a person.
  if (v.requireString(e.run, "$.run")) {
    checkActionShape(
      v,
      e.run as string,
      "$.run",
      "must be the same value as the activity entry's action, in its shape",
    );
  }

  if (!Array.isArray(e.entries)) {
    v.fail("$.entries", `must be an array (got ${describe(e.entries)})`);
  } else {
    e.entries.forEach((raw, i) => {
      const at = `$.entries[${i}]`;
      const entry = v.object(raw, at);
      if (!entry) return;
      v.only(entry, ACCESS_LOG_ENTRY_KEYS, at);
      v.requireEnum(entry.kind, LOG_KINDS, `${at}.kind`);
      // Single-line for the same reason a namespace is: a logged path or `gh`
      // argument carrying `\n## ` forges a heading in the trail, and the trail
      // is the artifact colleagues read to answer *what did this run touch*.
      if (v.requireString(entry.value, `${at}.value`)) {
        checkSingleLine(v, entry.value as string, `${at}.value`);
      }
      if (entry.note !== undefined && v.requireString(entry.note, `${at}.note`)) {
        checkSingleLine(v, entry.note as string, `${at}.note`);
      }
    });
  }

  if (v.requireString(e.ts, "$.ts") && !ISO_8601_UTC.test(e.ts as string)) {
    v.fail("$.ts", `must be an ISO-8601 UTC stamp (got ${excerpt(e.ts as string)})`);
  }
  return v.errors;
}

// --- report rendering --------------------------------------------------------

function sortedFindings(report: Report): Finding[] {
  return [...report.findings].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9),
  );
}

function locationLabel(f: Finding): string {
  const loc = f.location;
  // `isRecorded`, not `length === 0`: a path of one space is length 1, so the
  // row rendered as a code span holding `  :42` — naming no file and carrying a
  // line number, which reads as a location rather than as an absence. `validate`
  // refuses that now, and this is the half a direct caller of the exported
  // renderers still reaches.
  if (!loc || !isRecorded(loc.path)) return "";
  return loc.line !== undefined ? `${loc.path}:${loc.line}` : loc.path;
}

interface RenderOptions {
  /**
   * The commit the exporter is looking at right now. Supplying it turns the
   * freshness line into a comparison; omitting it says so rather than implying
   * a check that never ran.
   */
  atCommit?: string;
}

/**
 * The provenance rows every rendered report carries, as `{ label, value }` so
 * Markdown and HTML say the same thing.
 *
 * A rendered report outlives the session that produced it — it gets pasted into
 * a ticket and read weeks later as the current state of the repo. These rows are
 * the only thing on the page that distinguishes findings derived by this run
 * from a report the reuse path served out of memory, so they render on every
 * export, including the case where nothing was recorded. Silence is what made a
 * reused report indistinguishable from a fresh one in the first place; saying
 * "not recorded" is a worse-looking page and a more honest one.
 */
export function provenanceRows(
  report: Report,
  opts: RenderOptions = {},
): { label: string; value: string }[] {
  const p = report.provenance;
  const derived = p
    ? `${p.scanned_at}${isRecorded(p.tool_version) ? ` (teammate ${p.tool_version})` : ""}`
    : "not recorded — nothing in this report shows when its findings were " +
      "derived, or whether this run derived them at all";

  // The commit comparison stands on its own. `repo.commit_sha` is required, so
  // it is answerable even for the reports that predate provenance entirely —
  // which is the whole stored-in-memory population, and the one most likely to
  // be exported long after the tree moved. Gating it behind `provenance` would
  // drop the freshness verdict on precisely those.
  // `isRecorded`, not `!== undefined`: the two CLI guards refuse a blank
  // `--at-commit`, but this function is exported, and a direct caller passing
  // one reached the STALE branch rather than the unverified one — a freshness
  // *verdict* off a value the row renders as nothing.
  const checked =
    !isRecorded(opts.atCommit)
      ? "no current commit supplied at export — freshness unverified"
      : opts.atCommit === report.repo.commit_sha
        ? `${opts.atCommit} — the commit these findings were derived at`
        : `${opts.atCommit} — STALE: derived at ${report.repo.commit_sha}, ` +
          "and not re-derived for this one";

  // A dirty tree makes the sha above a label rather than a description: the
  // findings came from edits that exist on one machine and are reachable by no
  // commit, so a reader who checks out that sha will not find what this page
  // describes. `clean` renders nothing — the pin already says it, and a row
  // repeating it on every report would train the reader to skip the row.
  //
  // Silence is what `clean` means here, so an unstated `tree_state` cannot also
  // render nothing: a generation-1 record would then be published as a clean
  // tree it never claimed. Absent is a third answer and says so.
  const rows = [
    { label: "Derived", value: oneLine(derived) },
    { label: "Checked against", value: oneLine(checked) },
  ];

  // How long the scan took, which the artifact could not answer at all before
  // `started_at`: every other instant in it is written at Stage 6. Rendered only
  // when the report records provenance — where it does not, the `Derived` row
  // above already says nothing was recorded, and a second row saying so again
  // would be the noise that trains a reader to skip the block.
  if (p) {
    rows.push({
      label: "Wall-clock",
      // `isRecorded`, not truthiness, for the reason every other gate in these
      // two exporters carries it. `validate` holds `started_at` to an ISO-8601
      // instant so a blank cannot survive it — but `provenanceRows` is
      // exported, and a direct caller reached `→ 2026-07-26T00:00:00Z
      // (unknown)`: an arrow with nothing on its left, which reads as a stamp
      // that failed to render rather than one that was never taken.
      value: isRecorded(p.started_at)
        ? oneLine(
            `${p.started_at} → ${p.scanned_at} (${formatDuration(
              Date.parse(p.scanned_at) - Date.parse(p.started_at),
            )})`,
          )
        : "not recorded — this report predates the start stamp, and every other " +
          "instant on it was written at the end of the run",
    });
  }
  if (report.repo.tree_state === "dirty") {
    rows.push({
      label: "Worktree",
      value:
        "DIRTY when scanned — these findings come from uncommitted edits, not " +
        `from ${report.repo.commit_sha}. Checking out that commit will not ` +
        "reproduce them.",
    });
  } else if (report.repo.tree_state !== "clean") {
    rows.push({
      label: "Worktree",
      value:
        "not recorded — this report predates the field and does not say " +
        `whether it describes ${report.repo.commit_sha} or uncommitted edits ` +
        "on top of it. Treat the commit above as a label, not a description.",
    });
  }
  return rows;
}

/**
 * A millisecond span as a duration a person reads at a glance.
 *
 * `NaN` and a negative span both answer `unknown` rather than printing
 * `NaN` or `-3m`: `validate` refuses an inverted or unparseable pair, so a
 * report that reaches here with one was written by something else, and the
 * honest render is that the number cannot be trusted.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  const total = Math.round(ms / 1000);
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Flatten a provenance value to a single line.
 *
 * These values are interpolated into Markdown, which has no escaping the way
 * HTML does, and a report is read back out of a shared memory scope — so the
 * run rendering it is not necessarily the run that wrote it. A `tool_version`
 * carrying a newline could otherwise forge a heading into the export, directly
 * under the row asking the reader to trust the page's provenance.
 */
function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * The three dispositions in the order a reader cares about them.
 *
 * `refuted` first: it is the one the page would otherwise not mention at all,
 * and the one the developer benefits from most — candidates a code-only run
 * would have shipped at them.
 */
const DISPOSITION_ORDER: Disposition[] = ["refuted", "confirmed", "not-readable"];

const DISPOSITION_LABEL: Record<Disposition, string> = {
  refuted: "Refuted and dropped — the namespace contradicted the finding's own claim",
  confirmed: "Confirmed — the namespace states what the static signal inferred",
  "not-readable": "Not readable — no read settled it, so it shipped as code-only would",
};

/**
 * The sentence the *Services in use* section opens with, in both exporters.
 *
 * A rendered report gets pasted into a ticket and read as the state of the
 * project. This section is the one most likely to be read that way — a list of
 * services reads like an architecture document — so it says on its face what it
 * describes and nothing wider (ADR-0024).
 *
 * Three answers, the same three `provenanceRows` gives the Worktree row and for
 * the same reason. A flat "what this commit calls" was wrong on a dirty scan:
 * the page carried a Worktree row saying the findings *do not come from* the
 * sha, and three lines under it a section asserting the sha's call sites — the
 * inverse of what ADR-0024 refuses, a working-tree read served as a description
 * of a commit. On a dirty tree it is a scan of edits that exist on one machine,
 * and the sentence says so.
 */
function surfacePreamble(report: Report): string {
  const tail = ", at the call sites this scan read.";
  if (report.repo.tree_state === "dirty") {
    return (
      `What the scanned working tree calls${tail} That tree is uncommitted ` +
      `edits on top of ${report.repo.commit_sha}, not the commit itself.`
    );
  }
  if (report.repo.tree_state !== "clean") {
    return (
      `What was called${tail} This report predates the worktree field and does ` +
      `not say whether it describes ${report.repo.commit_sha} or uncommitted ` +
      "edits on top of it."
    );
  }
  return `What this commit calls${tail}`;
}

/** `path:line`, the clickable form the requirements baseline asks for. */
function callSiteLabel(site: CallSite): string {
  return `${oneLine(site.path)}:${site.line}`;
}

/**
 * The Stage 2 call-site index as Markdown lines, or nothing when there is none.
 *
 * Nothing here is gated on `isRecorded`, unlike the cross-reference rows: every
 * field this prints is required, so there is no absent rendering to fall back
 * to and a blank one would leave a bullet naming nothing rather than a bullet
 * left out. The whitespace checks live in `validateSurface`, which is where a
 * required field's belong.
 */
function surfaceMarkdown(report: Report): string[] {
  const surface = report.surface;
  if (!surface) return [];
  const lines = ["## Services in use", "", `_${oneLine(surfacePreamble(report))}_`, ""];
  // Ahead of the list, because it bounds what the list is a list *of*. Behind
  // it, a reader who stops at the last bullet has read a complete inventory.
  if (surface.not_read && surface.not_read.length > 0) {
    lines.push(
      `_Not read by this scan: ${surface.not_read.map(oneLine).join("; ")}._`,
      "",
    );
  }
  if (surface.capabilities.length === 0) {
    lines.push("_No AGS capability call sites were found._", "");
    return lines;
  }
  for (const c of surface.capabilities) {
    const count = c.call_sites.length;
    lines.push(`- **${oneLine(c.capability)}** (${count} call site${count === 1 ? "" : "s"})`);
    for (const site of c.call_sites) lines.push(`  - \`${callSiteLabel(site)}\``);
    // Past tense and an instant, never a present-tense statement of config.
    // This is the half that can be wrong while the commit is unchanged.
    if (c.config) {
      lines.push(
        `  - Namespace said \`${oneLine(c.config.result)}\` when read at ` +
          `${oneLine(c.config.read_at)} — \`${oneLine(c.config.read)}\``,
      );
    }
  }
  lines.push("");
  return lines;
}

/** The Stage 3 inventory as Markdown lines, or nothing when there is none. */
function crossReferenceMarkdown(report: Report): string[] {
  const xref = report.cross_reference;
  if (!xref) return [];
  const lines = ["## Cross-reference against the live namespace", ""];
  if (xref.candidates.length === 0) {
    lines.push(
      "_The live read ran and raised no candidate to settle._",
      "",
    );
    return lines;
  }
  for (const disposition of DISPOSITION_ORDER) {
    const group = xref.candidates.filter((c) => c.disposition === disposition);
    if (group.length === 0) continue;
    lines.push(`**${DISPOSITION_LABEL[disposition]}** (${group.length})`, "");
    for (const c of group) {
      // `isRecorded`, not truthiness, on every optional field here. A value of
      // one space is truthy, so it printed the label and then nothing after it
      // — `- Read:` with no read, `` `` `` where the path belongs. The
      // validator holds the stored population to this rule, so what these
      // gates cover is a direct caller of the exported renderers; `path` is the
      // one that reached here through the chokepoint too, until it gained the
      // test its neighbours had.
      //
      // The zero-width spellings need the gate for a second reason: `oneLine`
      // ends in `trim()`, which strips a space but not U+200B, so those emit a
      // label followed by a character that renders as nothing at all.
      const where = isRecorded(c.path) ? ` \`${oneLine(c.path)}\`` : "";
      // `signal` is deliberately not gated: it is required, so there is no
      // "absent" rendering of it, and dropping it would leave a row that names
      // no playbook row instead of one that names an empty one. Its whitespace
      // check lives in the validator, where a required field's belongs.
      lines.push(`- \`${c.detector_id}\` / \`${oneLine(c.signal)}\`${where}`);
      // Ahead of the read: this is the fact a `not-readable` row exists to
      // carry, and on `no-operation` — the one reason that names no read — it
      // is the only detail the row has at all (ADR-0006).
      if (isRecorded(c.unreadable_reason)) {
        lines.push(`  - Why not readable: \`${oneLine(c.unreadable_reason)}\``);
      }
      if (isRecorded(c.read)) lines.push(`  - Read: ${oneLine(c.read)}`);
      if (isRecorded(c.result)) lines.push(`  - Result: ${oneLine(c.result)}`);
    }
    lines.push("");
  }
  return lines;
}

/** Report JSON → canonical Markdown. */
export function renderMarkdown(report: Report, opts: RenderOptions = {}): string {
  const lines: string[] = [];
  lines.push(`# Health check report`);
  lines.push("");
  lines.push(`- **Commit:** \`${report.repo.commit_sha}\``);
  if (isRecorded(report.repo.url)) lines.push(`- **Repo:** ${report.repo.url}`);
  lines.push(`- **Mode:** ${report.mode}`);
  // Which environment the live half of a config-aware run read. Flattened like
  // the provenance rows: this value is transcribed from a live read into a
  // Markdown page that has no escaping, so a newline in it would forge a
  // heading directly under the header the reader trusts.
  if (isRecorded(report.namespace)) lines.push(`- **Namespace:** ${oneLine(report.namespace)}`);
  lines.push(`- **Findings:** ${report.findings.length}`);
  for (const { label, value } of provenanceRows(report, opts)) {
    lines.push(`- **${label}:** ${value}`);
  }
  lines.push("");

  // First of the two, because it is what the other one is *about*: the
  // cross-reference settles candidates raised against these call sites, so a
  // reader meets the map before the verdicts taken over it.
  lines.push(...surfaceMarkdown(report));

  // Before the findings, because it is the part of the page that explains what
  // is *not* on it. A reader who scrolls to the findings and stops has read a
  // code-only report; the drops are the half only this section carries.
  lines.push(...crossReferenceMarkdown(report));

  const findings = sortedFindings(report);
  if (findings.length === 0) {
    lines.push("_No findings._");
    lines.push("");
    return lines.join("\n");
  }

  for (const f of findings) {
    const flags = f.suppressed ? " _(suppressed)_" : "";
    lines.push(`## ${f.severity.toUpperCase()} — ${f.title}${flags}`);
    lines.push("");
    lines.push(`- **Detector:** ${f.detector_id}`);
    lines.push(`- **Confidence:** ${f.confidence}`);
    lines.push(`- **Id:** \`${f.id}\``);
    const loc = locationLabel(f);
    if (loc) lines.push(`- **Location:** \`${loc}\``);
    if (f.citations && f.citations.length > 0) {
      lines.push(`- **Citations:**`);
      for (const c of f.citations) {
        lines.push(`  - ${c.source}${isRecorded(c.note) ? ` — ${c.note}` : ""}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function esc(s: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(s).replace(/[&<>"']/g, (c) => map[c] ?? c);
}

/**
 * Report JSON → single-file, self-contained HTML (inline CSS, no external
 * assets — safe to open from disk or attach). Print-to-PDF from this file is
 * the documented PDF path; no PDF library ships.
 */
export function renderHtml(report: Report, opts: RenderOptions = {}): string {
  const findings = sortedFindings(report);
  const provenance = provenanceRows(report, opts)
    .map((r) => `<dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd>`)
    .join("");
  const rows = findings
    .map((f) => {
      const loc = locationLabel(f);
      const cites = (f.citations ?? [])
        .map((c) => `<li>${esc(c.source)}${isRecorded(c.note) ? ` — ${esc(c.note)}` : ""}</li>`)
        .join("");
      return [
        `<section class="finding sev-${esc(f.severity)}${f.suppressed ? " suppressed" : ""}">`,
        `<h2>${esc(f.severity.toUpperCase())} — ${esc(f.title)}${f.suppressed ? " <span class=\"tag\">suppressed</span>" : ""}</h2>`,
        `<dl>`,
        `<dt>Detector</dt><dd>${esc(f.detector_id)}</dd>`,
        `<dt>Confidence</dt><dd>${esc(f.confidence)}</dd>`,
        `<dt>Id</dt><dd><code>${esc(f.id)}</code></dd>`,
        loc ? `<dt>Location</dt><dd><code>${esc(loc)}</code></dd>` : "",
        cites ? `<dt>Citations</dt><dd><ul>${cites}</ul></dd>` : "",
        `</dl>`,
        `</section>`,
      ].join("");
    })
    .join("\n");

  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    "<title>Health check report</title>",
    "<style>",
    "body{font:15px/1.5 system-ui,sans-serif;max-width:52rem;margin:2rem auto;padding:0 1rem;color:#111}",
    "h1{margin-bottom:.25rem}",
    ".meta{color:#555;margin-bottom:2rem}",
    ".finding{border-left:4px solid #ccc;padding:.5rem 1rem;margin:1rem 0;background:#fafafa}",
    ".sev-critical{border-color:#a00}.sev-high{border-color:#d60}.sev-medium{border-color:#da0}.sev-low{border-color:#0a0}.sev-info{border-color:#08a}",
    ".suppressed{opacity:.6}",
    ".tag{font-size:.7em;background:#ddd;border-radius:.3em;padding:.1em .4em;vertical-align:middle}",
    "dt{font-weight:600;color:#444}dd{margin:0 0 .4rem 0}",
    ".provenance{border:1px solid #ddd;border-radius:.3em;padding:.75rem 1rem;margin:0 0 2rem 0;font-size:.9em}",
    ".xref{margin:1rem 0}.xref h3{font-size:.95em;color:#444;margin:.5rem 0}",
    ".xref-refuted h3{color:#0a0}.xref ul{margin:0;padding-left:1.2rem}.xref dl{margin:.2rem 0 .4rem 0;font-size:.9em}",
    ".surface{margin:1rem 0}.surface ul{margin:0;padding-left:1.2rem}.surface>ul>li{margin:.3rem 0}",
    ".surface dl{margin:.2rem 0 .4rem 0;font-size:.9em}.surface-note{color:#444;font-size:.9em;margin:.3rem 0}",
    "code{background:#eee;padding:.1em .3em;border-radius:.2em}",
    "</style></head><body>",
    "<h1>Health check report</h1>",
    `<p class="meta">Commit <code>${esc(report.repo.commit_sha)}</code>${isRecorded(report.repo.url) ? ` · ${esc(report.repo.url)}` : ""} · mode ${esc(report.mode)}${isRecorded(report.namespace) ? ` · namespace <code>${esc(oneLine(report.namespace))}</code>` : ""} · ${findings.length} finding(s)</p>`,
    `<dl class="provenance">${provenance}</dl>`,
    surfaceHtml(report),
    crossReferenceHtml(report),
    findings.length === 0 ? "<p><em>No findings.</em></p>" : rows,
    "</body></html>",
  ].join("\n");
}

/**
 * The Stage 2 call-site index as HTML, or an empty string when there is none.
 *
 * Same fields, same order, same wording as the Markdown twin — this is the half
 * a reader is *forwarded*, so it cannot be the one that leaves the dated tense
 * off the configuration line.
 */
function surfaceHtml(report: Report): string {
  const surface = report.surface;
  if (!surface) return "";
  const head =
    "<h2>Services in use</h2>\n" +
    `<p class="surface-note"><em>${esc(oneLine(surfacePreamble(report)))}</em></p>`;
  const bound =
    surface.not_read && surface.not_read.length > 0
      ? `\n<p class="surface-note"><em>Not read by this scan: ${esc(
          surface.not_read.map(oneLine).join("; "),
        )}.</em></p>`
      : "";
  if (surface.capabilities.length === 0) {
    return `${head}${bound}\n<p><em>No AGS capability call sites were found.</em></p>`;
  }
  const items = surface.capabilities
    .map((c) => {
      const count = c.call_sites.length;
      const sites = c.call_sites
        .map((site) => `<li><code>${esc(callSiteLabel(site))}</code></li>`)
        .join("");
      const config = c.config
        ? `<dl><dt>Namespace said</dt><dd><code>${esc(oneLine(c.config.result))}</code> ` +
          `when read at ${esc(oneLine(c.config.read_at))} — ` +
          `<code>${esc(oneLine(c.config.read))}</code></dd></dl>`
        : "";
      return (
        `<li><strong>${esc(oneLine(c.capability))}</strong> ` +
        `(${count} call site${count === 1 ? "" : "s"})<ul>${sites}</ul>${config}</li>`
      );
    })
    .join("");
  return `${head}${bound}\n<section class="surface"><ul>${items}</ul></section>`;
}

/** The Stage 3 inventory as HTML, or an empty string when there is none. */
function crossReferenceHtml(report: Report): string {
  const xref = report.cross_reference;
  if (!xref) return "";
  const head = "<h2>Cross-reference against the live namespace</h2>";
  if (xref.candidates.length === 0) {
    return `${head}\n<p><em>The live read ran and raised no candidate to settle.</em></p>`;
  }
  const groups = DISPOSITION_ORDER.map((disposition) => {
    const group = xref.candidates.filter((c) => c.disposition === disposition);
    if (group.length === 0) return "";
    const items = group
      .map((c) => {
        // `isRecorded` on every optional field, for the reason the Markdown
        // twin gives. It matters more here: an empty `<dd>` is not just a bare
        // label, it is a definition list whose term has no definition, and the
        // HTML half is the one a reader is *forwarded*.
        const where = isRecorded(c.path) ? ` <code>${esc(oneLine(c.path))}</code>` : "";
        const detail = [
          // Same field, same order, same reason as the Markdown twin — this is
          // the half a reader is *forwarded*, so it cannot be the one that
          // leaves the distinction out.
          isRecorded(c.unreadable_reason)
            ? `<dt>Why not readable</dt><dd><code>${esc(oneLine(c.unreadable_reason))}</code></dd>`
            : "",
          isRecorded(c.read) ? `<dt>Read</dt><dd>${esc(oneLine(c.read))}</dd>` : "",
          isRecorded(c.result) ? `<dt>Result</dt><dd>${esc(oneLine(c.result))}</dd>` : "",
        ].join("");
        return (
          `<li><code>${esc(c.detector_id)}</code> / <code>${esc(oneLine(c.signal))}</code>` +
          `${where}${detail ? `<dl>${detail}</dl>` : ""}</li>`
        );
      })
      .join("");
    return (
      `<section class="xref xref-${esc(disposition)}">` +
      `<h3>${esc(DISPOSITION_LABEL[disposition])} (${group.length})</h3>` +
      `<ul>${items}</ul></section>`
    );
  }).join("\n");
  return `${head}\n${groups}`;
}

// --- access log --------------------------------------------------------------

/**
 * Append one access-log record to `file` as a JSON line. Append-only: existing
 * lines are never rewritten, so the log is a faithful capture of what was read
 * and called. Written throughout the run and flushed once at the end, under
 * *Recording the run*, so the envelope can name the outcome Stage 7 settled on
 * — including the git and `gh` calls Stage 7 itself made. Stage 1b's show path
 * appends here too: reading a stored report is itself an access.
 *
 * The entry is flattened to one line per string before it is written, because
 * this is the one record this tool composes rather than checks. Its `value` is
 * whatever a command printed — a path, a URL, a `gh` argument — and it ends up
 * in a trail a colleague reads, rendered by a run other than the one that wrote
 * it. `validateAccessLog` still refuses a terminator in an entry assembled some
 * other way; what this removes is a run failing the whole envelope at flush time
 * over a stray break in one captured argument.
 */
export function appendLogLine(
  file: string,
  entry: { kind: string; value: string; note?: string },
): void {
  appendFileSync(file, JSON.stringify(flattenRecordLines(entry)) + "\n", "utf-8");
}

// --- report keys and reuse ---------------------------------------------------

/**
 * The actor segment of a dirty report's key: `u` + 12 hex of sha-256(actor id).
 *
 * Hashed rather than spelled out for two reasons. An actor id is an email, so
 * it carries `@` — the key's own separator — and it is a person's address,
 * which has no business being the visible name of a storage row when all the
 * key needs is to tell one person's scan apart from another's.
 */
export function actorSlug(actorId: string): string {
  return "u" + createHash("sha256").update(actorId, "utf8").digest("hex").slice(0, 12);
}

/**
 * The `wiki_memory_put` key for a report — the one place it is composed.
 *
 * A clean scan describes the commit, so it keys on the commit and every later
 * run at that commit finds it:
 *
 *     <repo-name>@<commit_sha>:<mode>
 *
 * A dirty scan describes one person's uncommitted edits at that commit, so it
 * keys on the commit *and* the person, and only that person's later runs find
 * it:
 *
 *     <repo-name>@<commit_sha>+u<actor12>:<mode>
 *
 * The tree hash is deliberately not in the key. Keying on it would mint a
 * permanent row per keystroke-batch — a dozen an afternoon on a working
 * machine, in a kind the contract declares durable and never auto-pruned. One
 * slot per person per commit per mode, overwritten by each rescan, holds the
 * newest answer and grows with commits rather than with edits; `tree_hash`
 * rides in the document, which is enough to tell a later run that the tree it
 * is being offered has moved on.
 *
 * Which of the two keys it is has to be *stated*. `tree_state` is required only
 * from generation 2 on, so an older report may omit it — and omitting it used to
 * take the clean key, the one every later run at that commit reads, on the
 * strength of a field nobody filled in. There is no safe default here, so there
 * is no default.
 */
export function reportKey(report: {
  mode: string;
  repo: { name?: string; commit_sha: string; tree_state?: TreeState };
  actor?: { id: string };
}): string {
  const name = report.repo.name;
  if (!name) throw new Error("reportKey: repo.name is required to compose a key");
  const treeState = report.repo.tree_state;
  if (treeState !== "clean" && treeState !== "dirty") {
    throw new Error(
      "reportKey: repo.tree_state is required to compose a key — the clean key " +
        "and the dirty key are different keys, and a report that does not say " +
        "which tree it scanned would take the clean one, publishing one " +
        "machine's uncommitted edits as the answer for that commit. Read it " +
        "from `git status --porcelain`.",
    );
  }
  const base = `${name}@${report.repo.commit_sha}`;
  if (treeState === "clean") return `${base}:${report.mode}`;
  const actorId = report.actor?.id;
  if (!actorId) {
    throw new Error("reportKey: a dirty report needs an actor — its key is per-person");
  }
  return `${base}+${actorSlug(actorId)}:${report.mode}`;
}

/** Why a stored report was offered, in the order a run should consider them. */
const LOOKUP_RANKS = [
  "exact",
  "own-dirty-here",
  "clean-ancestor",
  "own-dirty-ancestor",
] as const;

export type LookupRank = (typeof LOOKUP_RANKS)[number];

export interface LookupCandidate {
  key: string;
  rank: LookupRank;
  commit_sha: string;
  /** Commits back from HEAD: 0 is HEAD itself. */
  distance: number;
  tree_state: TreeState;
  /**
   * Dirty candidates at HEAD only: whether the stored edits are still the ones
   * on disk. Undefined further back, where the base commit differs and the
   * comparison would answer a question nobody asked.
   */
  tree_matches?: boolean;
  updated_at?: string;
  reason: string;
}

export interface LookupResult {
  candidates: LookupCandidate[];
  /**
   * Stored reports this run placed to its own repo and then could not offer:
   * one that fails validation, or one that never stated its `tree_state` and
   * so cannot be ranked. Reported, never matched.
   *
   * Placed first, always. These are read back to the user as faults in their
   * own store, and the key names a repo and a commit, so a record this run
   * cannot claim is skipped in silence however defective it is.
   */
  rejected: { key: string; problems: string[] }[];
  /**
   * Stored reports that name no repo, so they cannot be placed to one.
   *
   * Counted rather than dropped. These are pre-generation-3 records, and every
   * report written before the walk-back existed is one — so a store full of
   * them would otherwise answer every lookup with "nothing stored" and never
   * say why. A count is not much, but it is the difference between an empty
   * result that means *no prior scan* and one that means *your history is a
   * generation behind*.
   *
   * Counted only among the records the other filters keep: same mode, a commit
   * in this repo's history, and — when the record describes uncommitted work —
   * this person's. The number is read back to the user as *their* history, and
   * `wiki_memory_list` hands back the whole studio scope, so counting every
   * nameless record in it reported other repos' and other people's reports as
   * the user's own.
   *
   * The one narrowing that must *not* be applied to the read this is counted
   * from is a server-side `key_prefix`. A record with no `repo.name` is a record
   * from before the current key format, so a repo-prefixed list drops precisely
   * the records this counts — and the count silently becomes zero, which is the
   * spelling of *no prior scan*. The two answers this exists to tell apart would
   * then print identically.
   */
  unplaceable: number;
  /**
   * Whether the read these counts were taken over held everything that matched.
   *
   * `false` makes every count above a **floor**: the read was cut short, so a
   * record that would have been rejected or counted may simply not have arrived.
   * `null` means the read made no claim either way — a bare array carries no
   * completeness flag, and reading its silence as "complete" is the assumption
   * that turns a partial answer into a confident one.
   */
  read_complete: boolean | null;
}

const RANK_REASONS: Record<LookupRank, string> = {
  exact: "this commit, clean tree — the same code this run is about to scan",
  "own-dirty-here":
    "this commit, your own uncommitted edits — check tree_matches before trusting it",
  "clean-ancestor":
    "an earlier commit, clean tree — findings predate everything committed since",
  "own-dirty-ancestor":
    "an earlier commit, your own uncommitted edits at that commit — the oldest thing worth offering",
};

/**
 * Rank the stored reports that could stand in for this run's scan.
 *
 * `wiki_memory_list` hands back every report the caller's read width covers,
 * so choosing among them is the caller's job, and doing it in prose is how a run
 * ends up offering a colleague's working tree or another repo's findings. This
 * is that choice, made mechanically.
 *
 * The read may narrow by `key_prefix` and it must not, here: the nameless
 * records `unplaceable` counts are the ones a repo-prefixed list drops. It may
 * also be *bounded* — the server caps a page and says so — which is why
 * `readComplete` is a required argument rather than an assumption. Every count
 * below is over the records that arrived, and a caller that did not walk the
 * cursor is holding floors.
 *
 * Four things can match, and at most one of each is returned: the exact commit
 * clean, the exact commit under your own dirty key, the nearest clean ancestor,
 * and the nearest ancestor under your own dirty key. A dirty report belonging
 * to anyone else is never a candidate — uncommitted work exists on one machine,
 * and offering it at a shared commit presents edits the reader does not have as
 * findings about code they do.
 *
 * Throws on an entry that is not an envelope, or an envelope with no readable
 * `.doc`. Every other outcome here is a *finding about the store*, reported in
 * the result; those two are a finding about the read, and there is no honest
 * result to return for them.
 */
export function rankStoredReports(
  envelopes: unknown[],
  ctx: {
    repoName: string;
    mode: string;
    actorId?: string;
    treeHash?: string;
    /** `git rev-list HEAD`, newest first. Index is distance from HEAD. */
    commits: string[];
    /**
     * `over.complete` from the read these envelopes came out of, or `null` when
     * it made no claim. Required, and deliberately not defaulted: a missing
     * completeness flag read as `true` is how a truncated store reports itself
     * as a whole one.
     */
    readComplete: boolean | null;
  },
): LookupResult {
  const distanceOf = new Map(ctx.commits.map((sha, i) => [sha, i] as const));
  const best = new Map<LookupRank, LookupCandidate>();
  const rejected: { key: string; problems: string[] }[] = [];
  let unplaceable = 0;

  for (const [index, envelope] of envelopes.entries()) {
    // A `list` result is a list of envelopes and every envelope carries its
    // record under `.doc`. Neither is recoverable here: read a record off the
    // wrapper and every field below is undefined, so every filter passes and a
    // store that is full answers "nothing stored". Skipping made that answer
    // byte-identical to the empty-store one — a read that failed in the path
    // built to fail silently, which is the mistake worth not making twice. So
    // it is raised rather than counted: a count would still print a result.
    const env = asRecord(envelope);
    if (!env) {
      throw new Error(
        `rankStoredReports: list entry ${index} is not an envelope (got ` +
          `${describe(envelope)}) — expected { scope, kind, key, doc }`,
      );
    }
    const key = typeof env.key === "string" ? env.key : "<no key on envelope>";
    const doc = asRecord(env.doc);
    if (!doc) {
      throw new Error(
        `rankStoredReports: envelope '${key}' carries no readable .doc (got ` +
          `${describe(env.doc)}) — the stored record lives there, and a result ` +
          `that was unwrapped or flattened on the way in hands every filter ` +
          `here undefined`,
      );
    }
    const report = doc as unknown as Report;

    // The filters that do not need a repo name run first, because the nameless
    // records are the ones being counted below and they have to be counted as
    // this run's history rather than the studio's. A commit in this repo's
    // rev-list is what places a record the field cannot.
    if (report.mode !== ctx.mode) continue;
    const distance = distanceOf.get(report.repo?.commit_sha ?? "");
    if (distance === undefined) continue;

    // `dirty` is a three-way question read as a two-way one everywhere else:
    // absent is not clean. A generation-1 record may omit `tree_state` and
    // still validate, and calling that one `clean` puts it at rank `exact`
    // under the reason "the same code this run is about to scan" — an assertion
    // the record never made, about a tree nobody can now inspect. `memory-doc`
    // can no longer write one, so this is about what is already stored.
    const treeState = report.repo?.tree_state;
    const dirty = treeState === "dirty";
    // Someone else's uncommitted work, or a dirty report that cannot say whose
    // it is. Skipped before validation on purpose: it is not a defective
    // record, it is a record about a machine that is not this one.
    if (dirty && (!ctx.actorId || report.actor?.id !== ctx.actorId)) continue;

    // A record that names no repo cannot be claimed by this one — but it is
    // also not evidence of nothing, so it is counted rather than dropped.
    // Naming a repo it does not name is how one repo's history gets read as
    // another's, which is the mistake the field was added to prevent.
    if (typeof report.repo?.name !== "string" || report.repo.name.length === 0) {
      unplaceable += 1;
      continue;
    }
    if (report.repo.name !== ctx.repoName) continue;

    // Every `rejected` entry below describes a record this run has already
    // placed to its own repo. `wiki_memory_list` hands back the whole studio
    // scope and the key carries a repo name and a commit, so reporting a
    // problem with a record before that match tells the user another team's
    // repo, sha and mode as a fault in *their* store. A record this run cannot
    // claim is skipped in silence, however defective it is.
    if (treeState !== "clean" && treeState !== "dirty") {
      rejected.push({
        key,
        problems: [
          "$.repo.tree_state: unstated, so this report cannot say whether it " +
            "describes the commit it names or someone's uncommitted edits",
        ],
      });
      continue;
    }

    // Memory outlives the rules that were in force when it was written, so a
    // store holds records from before the current schema. Validating only on
    // write would honor those forever with nothing checking them.
    const problems = validateReport(doc);
    if (problems.length > 0) {
      rejected.push({ key, problems });
      continue;
    }

    const rank: LookupRank = dirty
      ? distance === 0
        ? "own-dirty-here"
        : "own-dirty-ancestor"
      : distance === 0
        ? "exact"
        : "clean-ancestor";

    const candidate: LookupCandidate = {
      key,
      rank,
      commit_sha: report.repo.commit_sha,
      distance,
      tree_state: dirty ? "dirty" : "clean",
      ...(dirty && distance === 0
        ? { tree_matches: Boolean(ctx.treeHash) && report.repo.tree_hash === ctx.treeHash }
        : {}),
      ...(typeof env.updated_at === "string" ? { updated_at: env.updated_at } : {}),
      reason: RANK_REASONS[rank],
    };

    const held = best.get(rank);
    if (!held || candidate.distance < held.distance) best.set(rank, candidate);
  }

  return {
    candidates: LOOKUP_RANKS.map((r) => best.get(r)).filter(
      (c): c is LookupCandidate => c !== undefined,
    ),
    rejected,
    unplaceable,
    read_complete: ctx.readComplete,
  };
}

// --- the one-fix PR (Stage 7) ------------------------------------------------

/**
 * A finding id is a `fingerprint` value: 16 lowercase hex characters. Checked
 * before it reaches a branch name, because a branch name is the one string in
 * this tool that becomes a shell argument, a git ref, and a URL path segment in
 * turn. `..`, `~`, `^`, `:`, a leading `-`, a trailing `.lock` — git refuses
 * some of those and silently reinterprets others, and none of it needs handling
 * if the only thing interpolated is known to be hex.
 */
const FINDING_ID = /^[0-9a-f]{16}$/;

/**
 * Branch for a one-fix PR — derived from the finding, never composed.
 *
 * Two runs fixing the same finding land on the same branch name, which is what
 * makes a second run's `push` collide loudly instead of opening a duplicate PR
 * against the same defect. The `teammate/` prefix keeps every branch this skill
 * creates under one namespace the developer can list, review and delete without
 * having to recognise them individually.
 */
export function prBranchName(detectorId: string, findingId: string): string {
  if (!(DETECTOR_IDS as readonly string[]).includes(detectorId)) {
    throw new Error(`unknown detector_id '${detectorId}'`);
  }
  if (!FINDING_ID.test(findingId)) {
    throw new Error(
      `finding id '${findingId}' is not a fingerprint (16 lowercase hex chars)`,
    );
  }
  return `teammate/fix-${detectorId}-${findingId}`;
}

/**
 * Why this finding cannot be the run's one fix, or an empty list.
 *
 * Eligibility is decided here rather than in the prose because every arm of it
 * is a fact about the validated report, and a stage that decides its own
 * eligibility decides it differently on the run where it matters. A suppressed
 * finding is the load-bearing one: suppression means the report is not
 * asserting the finding at all, so opening a PR against it would ship as a fix
 * the very claim the run declined to make.
 */
export function prEligibilityProblems(
  report: Report,
  findingId: string,
): string[] {
  const problems: string[] = [];
  const finding = report.findings.find((f) => f.id === findingId);
  if (!finding) {
    return [
      `no finding with id '${findingId}' in this report — the fix has to be ` +
        "one of the findings the run shipped, not a defect noticed alongside them",
    ];
  }
  if (finding.suppressed) {
    problems.push(
      `finding '${findingId}' is suppressed, so this report does not assert ` +
        "it. Opening a PR would ship as a fix a claim the run withheld — " +
        "ground it and rescan, or pick a finding the report stands behind",
    );
  }
  // `isRecorded`, not truthiness. A path of one space is truthy, so this
  // check passed and the plan went on to write ``Changes ` `:42.`` into a PR
  // body and to return that same value as `PrPlan.path` — which `pr-guard`
  // compares the diff's touched files against. There is no file to change here
  // either; the value only looks like one.
  if (!isRecorded(finding.location?.path)) {
    problems.push(
      `finding '${findingId}' carries no location.path, so there is no file ` +
        "to change and nothing to hold the diff to",
    );
  }
  if (!finding.citations || finding.citations.length === 0) {
    problems.push(
      `finding '${findingId}' carries no citation. A PR is read by people who ` +
        "did not run the scan, so the reason for the change has to be openable " +
        "by them",
    );
  }
  return problems;
}

export interface PrPlan {
  branch: string;
  title: string;
  body: string;
  path: string;
}

/**
 * The longest title `pr-plan` emits, and so the longest commit subject.
 *
 * One string is both the commit subject and the PR title, which is the whole
 * point of deriving it here. Unbounded it could not be: a finding title states a
 * problem in full, and the first live run turned one into a 136-character
 * subject. The run then wrote its own shorter commit message and passed the long
 * one to `gh` — the exact split this function exists to prevent, reached by way
 * of a title no commit could carry. The full text is not lost; it is the first
 * line of the body below.
 */
const PR_TITLE_MAX = 72;

/** Clamp to `max`, breaking on a word boundary rather than mid-token. */
function clampTitle(title: string, max: number): string {
  if (title.length <= max) return title;
  const head = sliceUnits(title, max - 1);
  const cut = head.lastIndexOf(" ");
  // A single token longer than the limit has no boundary to break on. Cutting
  // mid-token still beats emitting a subject that git tooling will wrap.
  return `${(cut > max / 2 ? head.slice(0, cut) : head).trimEnd()}…`;
}

/**
 * The branch, title and body for the one-fix PR.
 *
 * Every string here reaches a git host, which is further than an exported
 * report ever travels: a PR body is world-readable on a public repo and outlives
 * the branch. So the body is assembled from validated report fields and
 * redacted, rather than written by the run and checked afterwards — the same
 * reason fingerprints and activity summaries pass through this file.
 *
 * The body deliberately states the commit the findings were derived at and the
 * mode that derived them. A reviewer arriving at the PR days later has no other
 * way to tell a fix derived from their current tree from one derived from a
 * commit that has since moved.
 */
export function buildPrPlan(
  report: Report,
  findingId: string,
  opts: RenderOptions = {},
): PrPlan {
  const problems = prEligibilityProblems(report, findingId);
  if (problems.length > 0) throw new Error(problems.join("; "));

  // Non-null: prEligibilityProblems above returns early when the finding is
  // missing, and flags an absent location.path — reaching here means both hold.
  const finding = report.findings.find((f) => f.id === findingId)!;
  const path = finding.location!.path;

  const title = clampTitle(
    redact(oneLine(`fix(${finding.detector_id}): ${finding.title}`)),
    PR_TITLE_MAX,
  );

  const lines: string[] = [];
  lines.push(oneLine(redact(finding.title)));
  lines.push("");
  lines.push(
    `**${finding.severity}** severity, **${finding.confidence}** confidence — ` +
      `\`${finding.detector_id}\``,
  );
  lines.push("");
  // `!== undefined`, not truthiness: `line` is a number and `validate` accepts
  // `0`, so the truthy form dropped it here while `locationLabel` rendered
  // `path:0` on the page. One artifact said which line and the other did not,
  // from the same report.
  const line = finding.location?.line;
  lines.push(`Changes \`${path}\`${line !== undefined ? `:${line}` : ""}.`);
  lines.push("");
  lines.push("## Why");
  lines.push("");
  for (const c of finding.citations ?? []) {
    lines.push(`- ${c.source}${isRecorded(c.note) ? ` — ${oneLine(redact(c.note))}` : ""}`);
  }
  lines.push("");
  lines.push("## Provenance");
  lines.push("");
  for (const row of provenanceRows(report, opts)) {
    lines.push(`- **${row.label}:** ${row.value}`);
  }
  lines.push(`- **Mode:** ${report.mode}`);
  lines.push(`- **Finding id:** \`${finding.id}\``);
  lines.push("");
  lines.push(
    "Opened by the `teammate` health check against the commit above, and " +
      "approved by the developer who ran it before anything was pushed. One " +
      "finding, one file — review it as you would any other change.",
  );

  return { branch: prBranchName(finding.detector_id, finding.id), title, body: redact(lines.join("\n")), path };
}

/** What `git status --porcelain -b` opens its branch header line with. */
const PORCELAIN_BRANCH_PREFIX = "## ";

/** What that header says instead of a branch name when HEAD is detached. */
const PORCELAIN_DETACHED_HEAD = "HEAD (no branch)";

/**
 * The branch `git status --porcelain -b` reports HEAD is on.
 *
 * `-b` prepends one header line — `## <branch>`, `## <branch>...<upstream>`
 * (optionally trailed by `[ahead 1, behind 2]`), or `## HEAD (no branch)` when
 * HEAD is detached. That is the whole reason this guard reads the branch from
 * the porcelain rather than from a flag the caller fills in: the branch arrives
 * in the *same* read as the paths, written by git, so a run cannot assert its
 * own compliance with the one rule this stage exists to enforce. No subprocess,
 * no second source of truth.
 *
 * Returns null when there is no header at all, which is what plain
 * `--porcelain` (no `-b`) produces. Whether that absence is acceptable is the
 * caller's to decide — it is fine for a caller not checking the branch, and a
 * refusal for one that is.
 *
 * Throws on a detached HEAD: there is no branch there to hold the fix to, and a
 * commit made on one is reachable from no ref at all.
 */
export function parsePorcelainBranch(porcelain: string): string | null {
  for (const raw of porcelain.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line.startsWith(PORCELAIN_BRANCH_PREFIX)) continue;
    const header = line.slice(PORCELAIN_BRANCH_PREFIX.length).trim();
    if (header === PORCELAIN_DETACHED_HEAD) {
      throw new Error(
        "HEAD is detached, so this fix is on no branch at all — a commit made " +
          "here is reachable from no ref and the PR would have nothing to push",
      );
    }
    // `## name...upstream [ahead 1]` — everything before the tracking suffix is
    // the local branch. git forbids `..` in a refname, so the first `...` is
    // always the separator and never part of the name.
    const tracking = header.indexOf("...");
    return tracking === -1 ? header : header.slice(0, tracking);
  }
  return null;
}

/**
 * Paths named by `git status --porcelain` output.
 *
 * A quoted path is refused rather than unquoted. git quotes paths containing
 * non-ASCII or control characters using C escapes, and a guard that decodes them
 * approximately is a guard that can be walked past by naming a file so that its
 * decoded form matches an allowed path. Refusing is the fail-closed reading:
 * the run stops and the developer looks, which is the correct outcome for a tree
 * this stage was told would contain exactly one changed file.
 */
export function parsePorcelainPaths(porcelain: string): string[] {
  const paths: string[] = [];
  for (const raw of porcelain.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.trim().length === 0) continue;
    // `-b` prepends a branch header. It is not a change, so it is not a path:
    // read as one, `## master` would be an undeclared "path" that fails every
    // tree, and `## <the fix branch>` would be one that passes any. No status
    // code is `#`, so a line opening with the header prefix is only ever this.
    if (line.startsWith(PORCELAIN_BRANCH_PREFIX)) continue;
    if (line.length < 4) {
      throw new Error(`cannot parse git status line: ${JSON.stringify(line)}`);
    }
    const rest = line.slice(3);
    // A rename reports both sides; both are changes to account for.
    const sides = rest.includes(" -> ") ? rest.split(" -> ") : [rest];
    for (const side of sides) {
      const value = side.trim();
      if (value.startsWith('"')) {
        throw new Error(
          `git quoted the path ${value} — this guard will not decode it. ` +
            "Inspect the tree by hand rather than trusting a decoded match",
        );
      }
      paths.push(value);
    }
  }
  return paths;
}

/**
 * Anything about this worktree that the fix did not declare — path or branch.
 *
 * This is the mechanical form of "no writes outside the PR branch", and that
 * claim has two halves. The *path* half stops the failure that is not a
 * malicious one: `git add -A` on a tree that already had unrelated edits in it,
 * which sweeps a developer's unfinished work into a PR opened in their name and
 * pushes it. The *branch* half — `expectedBranch`, checked only when a caller
 * passes one — stops the other: a run that never cut the branch and edited
 * straight on the developer's own. That produces byte-identical paths, so the
 * path half passes it, and it is the half the claim is actually named after.
 *
 * The branch is read out of the porcelain's own `-b` header rather than taken
 * on the caller's word, so a run cannot vouch for itself. When a branch is
 * expected and the porcelain carries no header, this throws: the check was
 * asked for and could not be made, which is a refusal and not a pass.
 */
export function prGuardProblems(
  porcelain: string,
  expected: string[],
  expectedBranch?: string,
): string[] {
  const problems: string[] = [];
  if (expectedBranch !== undefined) {
    // Before the paths: a fix on the wrong branch is wrong however tidy its
    // tree is, and this throw must reach the caller ahead of any parse of it.
    const branch = parsePorcelainBranch(porcelain);
    if (branch === null) {
      throw new Error(
        "this status output carries no '## ' branch header, so the branch " +
          "cannot be read from it — pipe `git status --porcelain -b` when the " +
          "branch is being checked",
      );
    }
    if (branch !== expectedBranch) {
      problems.push(
        `the worktree is on branch '${branch}', not the '${expectedBranch}' ` +
          "this fix declared — the edit was made outside the PR branch",
      );
    }
  }
  const allowed = new Set(expected);
  const changed = parsePorcelainPaths(porcelain);
  for (const path of changed) {
    if (allowed.has(path)) continue;
    problems.push(
      `${path} changed but is not part of this fix — the PR declared ` +
        `${expected.map((e) => `'${e}'`).join(", ") || "no paths"}`,
    );
  }
  if (changed.length === 0) {
    problems.push(
      "nothing changed in the worktree — there is no fix here to open a PR for",
    );
  }
  return problems;
}

// --- scoring a run against a key (§ Scoring) ---------------------------------

/**
 * The key generation this tool reads. A key naming another one is refused
 * rather than read leniently: the fields are the whole contract, and scoring a
 * v2 key with v1 rules would silently drop whatever v2 added — which is a green
 * scorecard for checks that never ran.
 */
const KEY_VERSION = 1;

/**
 * Criterion 4's soft target, in seconds (§ Scoring: "10 minutes is a **soft
 * target**"). Recorded and compared, never gating — citations gate, speed does
 * not.
 */
const WALL_CLOCK_SOFT_TARGET_S = 600;

/**
 * Bumped when the scorecard's shape changes. Consumers pin on it.
 *
 * 2 added `citation_quotes` — the verbatim-quote half of criterion 3, emitted
 * for the resolver beside `citation_urls`.
 */
const SCORECARD_VERSION = 2;

/**
 * What this harness will and will not say.
 *
 * It scores what is mechanically checkable off the artifact and **refuses a
 * verdict on everything else**, naming each refusal with its reason. Whether a
 * cited page states the finding's claim is prose; whether a `needs_ruling` row
 * should have fired is prose; a criterion whose input the report does not carry
 * has no answer at all. None of those come back as a pass, and none come back
 * as a fail — they come back as `needs_human` or `unscoreable`, which is the
 * same distinction the run's own `not-readable` disposition draws: a check that
 * could not be made is reported as such.
 *
 * `must_fire` rows join to a shipped finding on the **site tuple**
 * `(detector_id, location.path, location.line)`, because a finding carries no
 * `signal` field — that is what criterion 1's "reported at the right site"
 * means, and it is the only join the artifact supports.
 * `cross_reference.candidates` *does* carry `signal`, so criteria 6 and 7 join
 * on that instead.
 */
/**
 * The checks one key row carries, named one at a time.
 *
 * `needs_ruling` used to suspend a whole row, which let a settled question ride
 * out on an unsettled one. Row 3 of the seeded fixture *was* unruled on its
 * severity, on the recall denominator and on its line range — and its
 * `must_be_suppressed`, which the source calls a gate fail twice over, went
 * uncompared with them: a run that shipped it live scored `incomplete` with zero
 * failures. Those questions have since been ruled and row 3 carries no
 * `needs_ruling` today, so the example is history; the rule it bought is not. A
 * question names the checks it suspends, and suspends no others.
 *
 * Which names apply depends on the row a question is cited from. A `must_fire`
 * row carries `recall`, `severity`, `confidence`, `suppressed` and `citations`;
 * a `must_not_fire` row carries `precision`; a `cross_reference.must_appear` row
 * carries `inventory` and `on_confirm`.
 */
const ROW_CHECKS = [
  "recall",
  "severity",
  "confidence",
  "suppressed",
  "citations",
  "precision",
  "inventory",
  "on_confirm",
] as const;
type RowCheck = (typeof ROW_CHECKS)[number];

/**
 * A value the source accepts only on a condition it states in prose.
 *
 * `severity` / `confidence` on a row are the values accepted outright. These are
 * the other half, and they exist because folding the two together forced a
 * choice between two wrong answers: listing the conditional value made an
 * unearned value a pass, and leaving it out made a value the source scores as
 * **0 drift** a gating failure. Row 7 of the seeded fixture is the live case —
 * `high` is "defensible on that mapping … but only if the run cites something
 * for it", and whether it did is prose. A value matched here comes back
 * `needs_human`: never a fail, and never a pass.
 */
interface KeyConditionalValue {
  value?: string;
  condition?: string;
}

/**
 * A sentence the key requires one of a row's cited pages to state, verbatim.
 *
 * Criterion 3's two halves are "does the URL resolve" and "does the page state
 * this claim". The first is mechanical for every citation; the second is prose
 * for almost all of them — a citation's `note` is a paraphrase, and matching
 * paraphrases against page text produces alarms nobody can act on. So the check
 * runs **only where a key declares the exact text**, which is the one place the
 * source asked for a quote rather than a topic. Row 7 of the seeded fixture is
 * that place: the announcing page is named "verbatim" and the sentence is given.
 *
 * `url` must be one of the row's own `citation_urls` — a quote over a page the
 * row never named asks about a document nothing else on the row mentions.
 * Absent or `null` means **no quote check for this row**, which is not the same
 * as a quote check that passed, and is never reported as one.
 */
interface KeyCitationQuote {
  url?: string;
  quote?: string;
}

interface KeyRow {
  n?: number;
  signal: string;
  detector_id: string;
  path: string;
  line?: number | null;
  line_end?: number | null;
  severity?: string[];
  severity_conditional?: KeyConditionalValue[] | null;
  confidence?: string[];
  confidence_conditional?: KeyConditionalValue[] | null;
  must_be_suppressed?: boolean;
  citation_urls?: string[];
  citation_quotes?: KeyCitationQuote[] | null;
  banned_citation_urls?: string[];
  adjudication?: string;
  // Non-null means a human has not settled something about this row. The checks
  // the named questions block are scored `unscoreable`; the rest still run.
  // Either the question in words, or the `open_questions` ids that hold it — a
  // key that states its questions once and points at them keeps them from
  // drifting, and only the id spelling can carry a `blocks_checks` scope.
  needs_ruling?: string | string[] | null;
}

interface KeyMustNotFire {
  kind: string; // "signal" | "path_glob"
  signal?: string;
  glob?: string;
  why?: string;
  needs_ruling?: string | string[] | null;
}

interface KeyCrossRefRow {
  signal: string;
  disposition?: string[];
  on_confirm?: { severity?: string; confidence?: string };
  adjudication?: string;
  needs_ruling?: string | string[] | null;
}

interface KeyOpenQuestion {
  id?: string;
  what?: string;
  sides?: string[];
  blocks?: string;
  // Which of `ROW_CHECKS` this question suspends, on every row that cites it.
  // `blocks` says what it means to a reader; this says what the harness stops
  // doing. Absent — or cited under an id this key does not carry — suspends the
  // whole row, which is the safe direction: a check suspended by mistake reads
  // `unscoreable`, and a check run by mistake reads as a verdict.
  blocks_checks?: string[];
}

interface KeyCrossReference {
  closed_world?: boolean;
  must_appear?: KeyCrossRefRow[];
  must_not_appear?: string[];
  banned_dispositions?: string[];
}

interface ScoringKey {
  key_version: number;
  name?: string;
  source?: string;
  applies_to_mode?: string;
  must_fire: KeyRow[];
  must_not_fire?: KeyMustNotFire[];
  cross_reference?: KeyCrossReference;
  open_questions?: KeyOpenQuestion[];
}

/**
 * What a row's `needs_ruling` suspends, resolved against the key's questions.
 *
 * `blocked` is the whole vocabulary whenever the row points at a question this
 * key does not carry, or at one that names no `blocks_checks` — including the
 * prose spelling, which has no id to look up. That is the reading the contract
 * started with, so a key written before scopes existed still suspends its whole
 * row.
 */
interface RowRuling {
  unruled: boolean;
  /** The questions as the scorecard names them, for the reason line. */
  asked: string;
  blocked: Set<RowCheck>;
}

function rowRuling(needsRuling: unknown, questions: KeyOpenQuestion[]): RowRuling {
  if (needsRuling === undefined || needsRuling === null) {
    return { unruled: false, asked: "", blocked: new Set() };
  }
  const ids = (Array.isArray(needsRuling) ? needsRuling : [needsRuling]).map((q) => String(q));
  const asked = ids.join(", ");
  const blocked = new Set<RowCheck>();
  for (const id of ids) {
    const scope = questions.find((q) => q.id === id)?.blocks_checks;
    if (!Array.isArray(scope)) return { unruled: true, asked, blocked: new Set(ROW_CHECKS) };
    for (const name of scope) {
      if ((ROW_CHECKS as readonly unknown[]).includes(name)) blocked.add(name as RowCheck);
    }
  }
  return { unruled: true, asked, blocked };
}

/**
 * `not-applicable` is not `unscoreable`. A key with no cross-reference half
 * asks nothing about the live read, so criteria 6 and 7 have nothing open — a
 * code-only key would otherwise report `incomplete` forever. `unscoreable` is
 * for a question the key *did* ask and the artifact cannot answer.
 */
type CriterionStatus = "pass" | "fail" | "unscoreable" | "not-applicable";

interface OpenItem {
  criterion: string;
  what: string;
  reason: string;
}

interface RecallHit {
  n: number | null;
  signal: string;
  detector_id: string;
  site: string;
  finding_id: string;
  finding_site: string;
  // More than one unclaimed finding sat at this site. The detection is settled;
  // which finding the row meant is not.
  ambiguous: boolean;
}

interface RecallMiss {
  n: number | null;
  signal: string;
  detector_id: string;
  site: string;
  adjudication?: string | null;
}

interface RecallOpen extends RecallMiss {
  fired: boolean;
  finding_id: string | null;
  reason: string;
}

interface DriftRow {
  n: number | null;
  signal: string;
  site: string;
  finding_id: string;
  field: string;
  actual: string | boolean;
  accepted: (string | boolean)[];
}

interface HumanItem {
  criterion: string;
  what: string;
  asks: string;
  urls?: string[];
}

/**
 * One verbatim quote a resolver must find on one page, and the finding it backs.
 *
 * Emitted only where a key row declared it *and* the live finding it claimed
 * actually cites that page. Both halves matter: a declaration with no shipped
 * citation is a key question, not a page to open, and a citation with no
 * declaration gets no quote check at all.
 */
interface CitationQuote {
  url: string;
  quote: string;
  finding_id: string;
}

interface Scorecard {
  scorecard_version: number;
  verdict: "pass" | "fail" | "incomplete";
  key: {
    name: string | null;
    key_version: number;
    source: string | null;
    applies_to_mode: string | null;
  };
  report: {
    schema_version: string | number;
    mode: string;
    repo: string | null;
    commit_sha: string;
    findings: number;
  };
  criteria: Record<string, Record<string, unknown>>;
  failures: string[];
  needs_human: HumanItem[];
  unscoreable: OpenItem[];
  citation_urls: string[];
  citation_quotes: CitationQuote[];
  citation_internal_refs: string[];
}

/**
 * `needs_ruling`, checked for shape wherever it may appear.
 *
 * It may sit on any row object — `must_fire`, `must_not_fire`, or
 * `cross_reference.must_appear` — so the check lives here rather than being
 * written out three times and kept in step by hand.
 */
function needsRulingProblem(value: unknown, where: string): string | null {
  if (value === undefined || value === null) return null;
  // Every spelling below prints the same reason line — `needs_ruling: ` with
  // nothing after it — under a row declared unsettled. A blank names no
  // question, so nobody can rule on it and nobody can tell it from a row that
  // was never written.
  const blank =
    `${where} names no question — a blank ruling reads as unsettled and leaves ` +
    "nothing for anyone to settle; write null (or omit the field) on a row " +
    "that is settled";
  if (typeof value === "string") return isRecorded(value) ? null : blank;
  if (!Array.isArray(value)) {
    return `${where} must be null, the question in words, or a list of open_questions ids`;
  }
  // `[].every(...)` is true, so an empty list used to pass this check and then
  // read as "unsettled, suspending nothing": the row was declared unruled,
  // every check on it ran anyway, and it could reach the strongest verdict this
  // harness has under that reason line. That inverts the safe direction the
  // scope rule is built on. `[]` is a real answer for `blocks_checks` — a
  // question that blocks nothing mechanical — which is exactly what makes the
  // same spelling reachable here, where it means the opposite.
  if (value.length === 0) {
    return (
      `${where} must not be an empty list — an empty list is not a ruling, it ` +
      "is zero questions written as though there were some, and it names no " +
      "question; write null (or omit the field) on a row that is settled"
    );
  }
  if (value.some((q) => typeof q === "string" && !isRecorded(q))) return blank;
  if (value.every((q) => typeof q === "string")) return null;
  return `${where} must be null, the question in words, or a list of open_questions ids`;
}

/**
 * Whether a cross-reference half names anything to compare.
 *
 * Presence is not a question. A half spelled `{}` — or with every list in it
 * spelled empty — resolves all four of criterion 6's comparisons against an
 * empty population: no candidate required, none forbidden, no banned
 * disposition, and an open world that excludes nothing. The input guard and
 * criterion 6 both read it from here, so the two cannot drift apart.
 *
 * A list holding only blanks is the same nothing wearing a length. The input
 * guard refuses those spellings outright, but `scoreReport` is exported and
 * reachable without it, and a blank naming no candidate must not be what tells
 * this function a question was asked.
 */
function crossReferenceAsksNothing(xref: Record<string, unknown>): boolean {
  const namesNothing = (entry: unknown): boolean => {
    if (typeof entry === "string") return !isRecorded(entry);
    const row = asRecord(entry);
    if (row && typeof row.signal === "string") return !isRecorded(row.signal);
    return false;
  };
  const emptyList = (value: unknown): boolean =>
    value === undefined || value === null || (Array.isArray(value) && value.every(namesNothing));
  if (!emptyList(xref.must_appear)) return false;
  if (!emptyList(xref.must_not_appear)) return false;
  if (!emptyList(xref.banned_dispositions)) return false;
  return xref.closed_world !== true;
}

// Every field criterion 6 reads out of a key's live half. Named apart from the
// report-side `CROSS_REFERENCE_KEYS` because they describe opposite artifacts:
// that one closes what a *report* may carry, this one what a *key* may ask.
const SCORING_KEY_CROSS_REFERENCE_KEYS = [
  "must_appear",
  "must_not_appear",
  "banned_dispositions",
  "closed_world",
] as const;

/**
 * Why this file is not a key this tool can score against, or an empty list.
 *
 * A shape check, not a closed one: a key is written by a human alongside a
 * fixture and may carry prose fields this tool has no use for. What it may not
 * do is arrive missing the fields a join is built out of — a `must_fire` row
 * with no `path` matches every finding or none depending on how it is read, and
 * either reading is a scorecard about nothing.
 *
 * `cross_reference` is the one object held closed against that rule, and the
 * comment at its check says why the rule does not reach it.
 */
export function scoringKeyProblems(data: unknown): string[] {
  const out: string[] = [];
  const key = asRecord(data);
  if (!key) return [`key must be a JSON object (got ${describe(data)})`];

  // A key with no rows, no false-positive rules and no live half asks nothing,
  // so every criterion answers off an empty population and the card comes back
  // green. `{"key_version":1,"name":"empty","must_fire":[]}` against `findings:
  // []` scored PASS and exited 0 — a verdict on no question at all.
  //
  // The live half is read for what it asks, not for whether it is there. Tested
  // for presence, `"cross_reference": {}` walked straight past this guard and
  // scored five of seven criteria green — both gating live ones among them — on
  // a key that asks nothing at all.
  const declaredXref = asRecord(key.cross_reference);
  const xrefAsks =
    key.cross_reference !== undefined &&
    (declaredXref === null || !crossReferenceAsksNothing(declaredXref));
  const asksNothing =
    Array.isArray(key.must_fire) &&
    key.must_fire.length === 0 &&
    (key.must_not_fire === undefined ||
      (Array.isArray(key.must_not_fire) && key.must_not_fire.length === 0)) &&
    !xrefAsks;
  if (asksNothing) {
    out.push(
      "this key asks nothing — no must_fire row, no must_not_fire rule and no " +
        "cross_reference question — so every criterion would answer off an " +
        "empty population and the scorecard would come back green for checks " +
        "that never ran",
    );
  }

  if (key.key_version !== KEY_VERSION) {
    out.push(
      `key_version must be ${KEY_VERSION} (got ${describe(key.key_version)}) — ` +
        "a key generation this tool does not read would be scored with the " +
        "wrong rules, and the checks it added would silently not run",
    );
  }

  if (!Array.isArray(key.must_fire)) {
    out.push(`must_fire must be an array (got ${describe(key.must_fire)})`);
  } else {
    key.must_fire.forEach((entry, i) => {
      const row = asRecord(entry);
      if (!row) {
        out.push(`must_fire[${i}] must be an object (got ${describe(entry)})`);
        return;
      }
      for (const field of ["signal", "detector_id", "path"] as const) {
        if (!isRecorded(row[field])) {
          out.push(`must_fire[${i}].${field} must be a string with ${NOT_ONLY_INVISIBLE}`);
        }
      }
      for (const field of ["line", "line_end"] as const) {
        const value = row[field];
        if (value === undefined || value === null) continue;
        if (typeof value !== "number" || !Number.isInteger(value)) {
          out.push(`must_fire[${i}].${field} must be an integer or null`);
        }
      }
      if (
        typeof row.line === "number" &&
        typeof row.line_end === "number" &&
        row.line_end < row.line
      ) {
        out.push(
          `must_fire[${i}].line_end (${row.line_end}) is before .line (${row.line}) — ` +
            "the span matches nothing, and the row would be scored as a detector " +
            "gap the run does not have",
        );
      }
      // The constraint fields are checked for *shape*, not content, and this is
      // the check that earns the function. `severity: "critical"` instead of
      // `["critical"]` used to be read as "no accepted set", so criterion 5
      // skipped that field and reported `pass` — a one-character key typo
      // silently switching off the check it was written to make.
      for (const field of [
        "severity",
        "confidence",
        "citation_urls",
        "banned_citation_urls",
      ] as const) {
        const value = row[field];
        if (value === undefined) continue;
        if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
          out.push(
            `must_fire[${i}].${field} must be an array of strings ` +
              `(got ${describe(value)}) — a scalar here reads as an absent ` +
              "constraint, and the check it names never runs",
          );
          continue;
        }
        // Blank for the reason `cross_reference.must_not_appear[""]` is refused:
        // it names no URL, so the row constrains nothing while the field still
        // reads as a constraint the key asked for. `banned_citation_urls: [""]`
        // was byte-for-byte indistinguishable from `[]`, and a row whose banned
        // URL the run actually cited came back `unscoreable` on criterion 3
        // instead of `fail` — and `fail` outranks `incomplete` on purpose.
        value.forEach((v, j) => {
          if (isRecorded(v)) return;
          out.push(`must_fire[${i}].${field}[${j}] must be a string with ${NOT_ONLY_INVISIBLE}`);
        });
      }
      if (row.must_be_suppressed !== undefined && typeof row.must_be_suppressed !== "boolean") {
        out.push(
          `must_fire[${i}].must_be_suppressed must be a boolean ` +
            `(got ${describe(row.must_be_suppressed)}) — the string "false" is ` +
            "not false, and would be compared against one forever",
        );
      }
      // A value the source accepts only on a prose condition. Both halves of an
      // entry are required: a value with no condition is just an accepted value
      // spelled the long way and belongs in the array beside it, and a condition
      // over no value names nothing to hold.
      for (const field of ["severity_conditional", "confidence_conditional"] as const) {
        const value = row[field];
        if (value === undefined || value === null) continue;
        if (!Array.isArray(value)) {
          out.push(
            `must_fire[${i}].${field} must be null or an array of ` +
              `{value, condition} objects (got ${describe(value)})`,
          );
          continue;
        }
        value.forEach((entry, j) => {
          const spec = asRecord(entry);
          if (!spec) {
            out.push(
              `must_fire[${i}].${field}[${j}] must be an object with 'value' and ` +
                `'condition' (got ${describe(entry)})`,
            );
            return;
          }
          if (!isRecorded(spec.value)) {
            out.push(
              `must_fire[${i}].${field}[${j}].value must be a string with ${NOT_ONLY_INVISIBLE}`,
            );
          }
          if (!isRecorded(spec.condition)) {
            out.push(
              `must_fire[${i}].${field}[${j}].condition must be the source's ` +
                "condition, verbatim — a value accepted on no stated condition is " +
                `an accepted value, and belongs in ${field.replace("_conditional", "")}`,
            );
          }
        });
      }
      // The verbatim quote a page must state, checked for shape here and
      // resolved by whatever runs the manifest. Every field is required and the
      // `url` has to be one the row already cites: a quote pinned to a page the
      // row never named would be emitted for a check against a document the key
      // asks nothing else about, and a run could satisfy it by citing that page
      // and nothing else.
      if (row.citation_quotes !== undefined && row.citation_quotes !== null) {
        const declaredUrls = Array.isArray(row.citation_urls)
          ? (row.citation_urls as unknown[]).filter((u) => typeof u === "string")
          : [];
        if (!Array.isArray(row.citation_quotes)) {
          out.push(
            `must_fire[${i}].citation_quotes must be null or an array of ` +
              `{url, quote} objects (got ${describe(row.citation_quotes)})`,
          );
        } else {
          row.citation_quotes.forEach((entry, j) => {
            const spec = asRecord(entry);
            const at = `must_fire[${i}].citation_quotes[${j}]`;
            if (!spec) {
              out.push(`${at} must be an object with 'url' and 'quote' (got ${describe(entry)})`);
              return;
            }
            if (!isRecorded(spec.url)) {
              out.push(`${at}.url must be a string with ${NOT_ONLY_INVISIBLE}`);
            } else if (!declaredUrls.some((u) => sameUrl(u as string, spec.url as string))) {
              out.push(
                `${at}.url is not among must_fire[${i}].citation_urls — a required ` +
                  "quote over a page the row does not cite asks about a document " +
                  "nothing else on the row names",
              );
            }
            if (!isRecorded(spec.quote)) {
              out.push(
                `${at}.quote must be the source's sentence, verbatim — a quote ` +
                  "that renders as nothing is not 'no quote required', and would " +
                  "be reported as a check that ran",
              );
              return;
            }
            if (LINE_BREAK.test(spec.quote) || spec.quote.includes("\t")) {
              out.push(
                `${at}.quote must be one line and hold no tab — the manifest is ` +
                  "newline-delimited and tab-separated, so either would split one " +
                  "requirement into two entries nothing states",
              );
            }
          });
        }
      }

      // Two spellings, both meaning "unsettled": the question in words, or the
      // `open_questions` ids that hold it. A key that writes its questions once
      // and points at them is the better of the two, and refusing it would send
      // its author to copy prose into every row instead.
      const rulingProblem = needsRulingProblem(row.needs_ruling, `must_fire[${i}].needs_ruling`);
      if (rulingProblem) out.push(rulingProblem);
    });
  }

  if (key.must_not_fire !== undefined) {
    if (!Array.isArray(key.must_not_fire)) {
      out.push(`must_not_fire must be an array (got ${describe(key.must_not_fire)})`);
    } else {
      key.must_not_fire.forEach((entry, i) => {
        const row = asRecord(entry);
        if (!row) {
          out.push(`must_not_fire[${i}] must be an object (got ${describe(entry)})`);
          return;
        }
        const rulingProblem = needsRulingProblem(
          row.needs_ruling,
          `must_not_fire[${i}].needs_ruling`,
        );
        if (rulingProblem) out.push(rulingProblem);
        // `isRecorded`, not `typeof`: these two were the only free strings in
        // this function checked for their *type* and never for whether they
        // named anything, so `""` passed here while it was refused on every
        // neighbouring field. A rule naming nothing matches no finding, which
        // reads as the rule holding — measured, a `path_glob` of one space took
        // criterion 2 from a gating `fail` to `unscoreable` and dropped the
        // failure with it.
        if (row.kind === "signal") {
          if (!isRecorded(row.signal)) {
            out.push(
              `must_not_fire[${i}].signal must be a string with ` +
                `${NOT_ONLY_INVISIBLE} on kind 'signal' (got ${describe(row.signal)})`,
            );
          }
          return;
        }
        if (row.kind === "path_glob") {
          if (!isRecorded(row.glob)) {
            out.push(
              `must_not_fire[${i}].glob must be a string with ` +
                `${NOT_ONLY_INVISIBLE} on kind 'path_glob' (got ${describe(row.glob)})`,
            );
          }
          return;
        }
        out.push(
          `must_not_fire[${i}].kind must be 'signal' or 'path_glob' ` +
            `(got ${describe(row.kind)})`,
        );
      });
    }
  }

  const xref = key.cross_reference === undefined ? null : asRecord(key.cross_reference);
  if (key.cross_reference !== undefined && !xref) {
    out.push(`cross_reference must be an object (got ${describe(key.cross_reference)})`);
  }
  // Closed, against the shape rule this function otherwise follows, because the
  // argument for an open shape does not reach this object. Prose in a key lives
  // on the *row* objects (`adjudication`, `needs_ruling`); `cross_reference`
  // itself holds these four and nothing else. Left open, a misspelt field name
  // reproduced one level up the exact defect the closed `banned_dispositions`
  // vocabulary below was written to stop: `banned_dispostions` and
  // `closed_wolrd` were each accepted, silently ignored, and turned criterion 6
  // from a gating `fail` into a `pass` with no failures.
  if (xref) {
    for (const field of Object.keys(xref)) {
      if ((SCORING_KEY_CROSS_REFERENCE_KEYS as readonly string[]).includes(field)) continue;
      out.push(
        `cross_reference.${field} is not a field this tool reads ` +
          `(${SCORING_KEY_CROSS_REFERENCE_KEYS.join(", ")}) — a misspelt name here ` +
          "is silently ignored, and the check it was meant to ask never runs",
      );
    }
  }
  if (xref && xref.must_appear !== undefined) {
    if (!Array.isArray(xref.must_appear)) {
      out.push(`cross_reference.must_appear must be an array`);
    } else {
      xref.must_appear.forEach((entry, i) => {
        const row = asRecord(entry);
        // Non-empty for the reason a `must_fire` row's signal is: a blank names
        // no candidate, so the row asks nothing any inventory can answer — while
        // the half it sits on still reads as a question the key asked, which is
        // what keeps criterion 6 out of `unscoreable` and lets it report a green.
        if (!row || !isRecorded(row.signal)) {
          out.push(
            `cross_reference.must_appear[${i}].signal must be a string with ${NOT_ONLY_INVISIBLE}`,
          );
          return;
        }
        if (
          row.disposition !== undefined &&
          (!Array.isArray(row.disposition) || row.disposition.some((d) => typeof d !== "string"))
        ) {
          out.push(`cross_reference.must_appear[${i}].disposition must be an array of strings`);
        } else if (Array.isArray(row.disposition)) {
          // Closed for the same "three and only three" reason as
          // `banned_dispositions`, and left open it fails the other way round:
          // no candidate can carry `confirmd`, so every one reads as off the
          // accepted set and a correct run takes a gating fail naming the
          // candidates instead of the typo.
          for (const d of row.disposition) {
            if (typeof d !== "string") continue;
            if ((DISPOSITIONS as readonly string[]).includes(d)) continue;
            out.push(
              `cross_reference.must_appear[${i}].disposition names '${d}', which is ` +
                `no disposition a candidate can carry (${DISPOSITIONS.join(", ")})`,
            );
          }
        }
        if (row.on_confirm !== undefined && !asRecord(row.on_confirm)) {
          out.push(`cross_reference.must_appear[${i}].on_confirm must be an object`);
        }
        const rulingProblem = needsRulingProblem(
          row.needs_ruling,
          `cross_reference.must_appear[${i}].needs_ruling`,
        );
        if (rulingProblem) out.push(rulingProblem);
      });
    }
  }
  // A string here is the worst of the lot: `includes` on a string does
  // *substring* matching and spreading a string yields its characters, so
  // `must_not_appear: "namespace-env-mismatch"` would both match unrelated
  // signals and shrink the closed-world set to single letters.
  for (const field of ["must_not_appear", "banned_dispositions"] as const) {
    const value = xref?.[field];
    if (!xref || value === undefined) continue;
    if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
      out.push(
        `cross_reference.${field} must be an array of strings (got ${describe(value)})`,
      );
      continue;
    }
    // Blank for the same reason a blank `must_appear` signal is refused: it
    // forbids no candidate while leaving the half reading as a question.
    value.forEach((v, i) => {
      if (isRecorded(v)) return;
      out.push(`cross_reference.${field}[${i}] must be a string with ${NOT_ONLY_INVISIBLE}`);
    });
  }
  // Closed, and for the reason `blocks_checks` is closed: there are three
  // dispositions and only three, so a fourth spelling bans nothing at all. The
  // key still reads as asking a question, criterion 6 still compares every
  // candidate against the list, and the disposition the row was written to catch
  // walks through under a `pass` with no failures — `refutted` banned a
  // `refuted` candidate exactly as well as an empty list would have.
  if (Array.isArray(xref?.banned_dispositions)) {
    for (const d of xref.banned_dispositions) {
      if (typeof d !== "string") continue;
      if ((DISPOSITIONS as readonly string[]).includes(d)) continue;
      out.push(
        `cross_reference.banned_dispositions names '${d}', which is no ` +
          `disposition a candidate can carry (${DISPOSITIONS.join(", ")})`,
      );
    }
  }
  if (xref && xref.closed_world !== undefined && typeof xref.closed_world !== "boolean") {
    out.push(`cross_reference.closed_world must be a boolean`);
  }
  if (key.open_questions !== undefined) {
    if (!Array.isArray(key.open_questions)) {
      out.push(`open_questions must be an array (got ${describe(key.open_questions)})`);
    } else {
      key.open_questions.forEach((entry, i) => {
        const q = asRecord(entry);
        if (!q) {
          out.push(`open_questions[${i}] must be an object (got ${describe(entry)})`);
          return;
        }
        // Every field the scorecard renders out of this object, checked before
        // the `blocks_checks` return below — the shipped fixture's questions
        // carry no `blocks_checks` at all, so anything guarded after it is
        // guarded for a minority of keys.
        //
        // `sides` is declared `string[]` and was checked nowhere, and the
        // declaration buys nothing against a file a human wrote: a key spelling
        // it as a string reached `scoreReport` and took the run down with
        // `q.sides.join is not a function`, a stack trace to stderr where this
        // function's name for the mistake belongs. `id`, `what` and `blocks`
        // do not throw — they are interpolated, so a non-string arrives in the
        // scorecard as `[object Object]` and nothing anywhere says so.
        // `null` is absent, on all four, because this key format writes an
        // absent optional as an explicit `null` — the shipped fixture's first
        // `must_fire` row spells five of them that way. Guarding only against
        // `undefined` refused `what: null` while accepting `sides: null`, which
        // is an arbitrary line through one object.
        for (const field of ["id", "what", "blocks"] as const) {
          if (q[field] === undefined || q[field] === null) continue;
          if (isRecorded(q[field])) continue;
          out.push(
            `open_questions[${i}].${field} must be a string with ` +
              `${NOT_ONLY_INVISIBLE} (got ${describe(q[field])})`,
          );
        }
        if (q.sides !== undefined && q.sides !== null) {
          if (!Array.isArray(q.sides)) {
            out.push(
              `open_questions[${i}].sides must be an array of strings ` +
                `(got ${describe(q.sides)}) — the scorecard joins them into the ` +
                "line that states the question",
            );
          } else {
            q.sides.forEach((side, j) => {
              if (isRecorded(side)) return;
              out.push(
                `open_questions[${i}].sides[${j}] must be a string with ` +
                  `${NOT_ONLY_INVISIBLE} (got ${describe(side)})`,
              );
            });
          }
        }
        if (q.blocks_checks === undefined) return;
        if (!Array.isArray(q.blocks_checks) || q.blocks_checks.some((n) => typeof n !== "string")) {
          out.push(
            `open_questions[${i}].blocks_checks must be an array of check names ` +
              `(got ${describe(q.blocks_checks)})`,
          );
          return;
        }
        // Closed, and loudly: a misspelt check name would silently suspend
        // nothing, and a row citing that question would be scored as settled.
        for (const name of q.blocks_checks) {
          if ((ROW_CHECKS as readonly unknown[]).includes(name)) continue;
          out.push(
            `open_questions[${i}].blocks_checks names '${String(name)}', which is ` +
              `no check this harness runs (${ROW_CHECKS.join(", ")})`,
          );
        }
      });
    }
  }
  return out;
}

/**
 * A list the key was required to spell as a list, or a raise.
 *
 * Not a default. A scalar here reads as *no constraint*, so the check the field
 * names never runs and nothing on the scorecard says so — a `banned_citation_urls`
 * typed as a bare string turned a citation gate fail into a clean `incomplete`
 * with zero failures. `scoringKeyProblems` refuses that shape, and `scoreReport`
 * is exported, so a scalar arriving here is a caller that skipped the check: an
 * impossible state, raised at the point of violation rather than corrected
 * silently (code/assert-invariants-and-fail-fast).
 */
function requireStringList(value: unknown, where: string): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) return value as string[];
  throw new Error(
    `${where} must be an array of strings (got ${describe(value)}) — reading it ` +
      "as an absent constraint would switch off the check it names; run " +
      "scoringKeyProblems on this key before scoring against it",
  );
}

/** The same rule for a list of row objects: a non-list is a key nobody checked. */
function requireRowList<T>(value: unknown, where: string): T[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value as T[];
  throw new Error(
    `${where} must be an array (got ${describe(value)}) — reading it as an empty ` +
      "one would score every row it holds as absent; run scoringKeyProblems on " +
      "this key before scoring against it",
  );
}

/** The same rule for a flag: `"false"` is not `false`, and never equals one. */
function requireOptionalBoolean(value: unknown, where: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  throw new Error(
    `${where} must be a boolean (got ${describe(value)}) — a string here is ` +
      "compared against a boolean forever, and the check never fires; run " +
      "scoringKeyProblems on this key before scoring against it",
  );
}

/** A key path spelled the way a report spells it, so the join is not cosmetic. */
function normalizeKeyPath(path: string): string {
  return path.trim().replace(/^\.\//, "").replace(/\/{2,1024}/g, "/");
}

/** `path:line`, or the path alone when the key names the file rather than a line. */
function siteLabel(path: string, line: number | null | undefined): string {
  return line === null || line === undefined ? path : `${path}:${line}`;
}

/**
 * A glob from `must_not_fire`, as a matcher.
 *
 * `*` stops at a path separator and `**` crosses it, which is the reading every
 * tool a person is likely to have used shares. A glob naming no directory —
 * `*.example` — is matched against the basename too, because that is plainly
 * what it was written to mean.
 */
const GLOB_STAR_ANY = Symbol("**");
const GLOB_STAR_SEGMENT = Symbol("*");
const GLOB_ONE = Symbol("?");

type GlobToken = string | typeof GLOB_STAR_ANY | typeof GLOB_STAR_SEGMENT | typeof GLOB_ONE;

/** One token per glob element: a literal character, or one of the three wildcards. */
function globTokens(glob: string): GlobToken[] {
  const out: GlobToken[] = [];
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        out.push(GLOB_STAR_ANY);
        i += 1;
        continue;
      }
      out.push(GLOB_STAR_SEGMENT);
      continue;
    }
    if (ch === "?") {
      out.push(GLOB_ONE);
      continue;
    }
    out.push(ch);
  }
  return out;
}

/**
 * Whether `tokens` matches the whole of `path`.
 *
 * This was a regex — each token appended to a pattern string, `**` becoming
 * `.*`, then `new RegExp`. It produced the right answer and took exponential
 * time to produce it: several `.*` separated by literals is the textbook
 * catastrophic-backtracking shape, and a glob is caller data, arriving as
 * `must_not_fire[].glob` in a scoring key with only a non-blank check on it.
 * Measured against a 1,024-character path, a glob of `**a` repeated four times
 * took 70 seconds; the same glob here takes 0.21ms, and 40 repeats against a
 * 4,096-character path takes 8ms.
 *
 * The replacement is the standard dynamic program: `dp[j]` is "the first `j`
 * tokens match the path consumed so far", advanced one path character at a
 * time. It is O(path × tokens) with no backtracking, so no input is
 * pathological. A star is the only token that reads `dp[j + 1]` (it may absorb
 * this character) or `next[j]` (it may match nothing) — everything else
 * advances by exactly one.
 *
 * Equivalence with the regex it replaces was checked over 300,130 glob/path
 * pairs — every fixed case in the suite plus 300,000 random pairs drawn from an
 * alphabet of wildcards, separators and regex metacharacters — with zero
 * disagreements.
 */
function globTokensMatch(tokens: GlobToken[], path: string): boolean {
  const m = tokens.length;
  // Before any input: the first j tokens match the empty string exactly while
  // every one of them is a star.
  let dp = new Array<boolean>(m + 1).fill(false);
  dp[0] = true;
  for (let j = 0; j < m; j += 1) {
    dp[j + 1] = dp[j] && (tokens[j] === GLOB_STAR_ANY || tokens[j] === GLOB_STAR_SEGMENT);
  }

  // Indexed, not `for…of`: the regex this replaces carried no `u` flag, so its
  // `.` and `[^/]` each consumed one UTF-16 code unit. Iterating code points
  // would silently let `?` match a whole surrogate pair where the regex needed
  // two, which is a behaviour change hiding inside a performance fix.
  for (let i = 0; i < path.length; i += 1) {
    const ch = path[i];
    const next = new Array<boolean>(m + 1).fill(false);
    for (let j = 0; j < m; j += 1) {
      const token = tokens[j];
      if (token === GLOB_STAR_ANY) {
        next[j + 1] = next[j] || dp[j + 1];
        continue;
      }
      if (token === GLOB_STAR_SEGMENT) {
        next[j + 1] = next[j] || (dp[j + 1] && ch !== "/");
        continue;
      }
      if (token === GLOB_ONE) {
        next[j + 1] = dp[j] && ch !== "/";
        continue;
      }
      next[j + 1] = dp[j] && token === ch;
    }
    dp = next;
  }

  return dp[m];
}

export function globMatches(glob: string, path: string): boolean {
  const trimmed = glob.trim();
  const tokens = globTokens(trimmed);
  if (globTokensMatch(tokens, path)) return true;
  if (trimmed.includes("/")) return false;
  return globTokensMatch(tokens, path.slice(path.lastIndexOf("/") + 1));
}

/**
 * The scheme a citation was written in. Criterion 3's gate turns on it: an
 * `internal://`-only citation on a live finding passes `validate` and still
 * reaches a reader with nothing to open.
 */
function citationScheme(source: string): "https" | "http" | "internal" | "other" {
  const s = source.trim().toLowerCase();
  if (s.startsWith("https://")) return "https";
  if (s.startsWith("http://")) return "http";
  if (s.startsWith("internal://")) return "internal";
  return "other";
}

/** Cosmetic variants folded together, so a trailing slash is not a miss. */
function sameUrl(a: string, b: string): boolean {
  const fold = (u: string) => normalizeSource(u).replace(/\/{1,8}$/, "");
  return fold(a) === fold(b);
}

function findingSite(f: Finding): string {
  return siteLabel(f.location?.path ?? "(no path)", f.location?.line ?? null);
}

/**
 * Does this shipped finding sit at the site this key row names?
 *
 * `line: null` keys the file rather than a line — the row matches wherever in
 * that file the detector fired. `line_end` keys a span, so a construct that
 * moved a line inside its own block is still the same site. An exact `line`
 * with no `line_end` is exact, because that is what the key asked for.
 */
function rowMatchesFinding(row: KeyRow, f: Finding): boolean {
  if (f.detector_id !== row.detector_id) return false;
  const path = f.location?.path;
  if (typeof path !== "string") return false;
  if (normalizeKeyPath(path) !== normalizeKeyPath(row.path)) return false;
  if (row.line === null || row.line === undefined) return true;
  const line = f.location?.line;
  if (typeof line !== "number") return false;
  if (row.line_end === null || row.line_end === undefined) return line === row.line;
  return line >= row.line && line <= row.line_end;
}

/**
 * Where a criterion writes what it settled, what it could not, and what it is
 * handing to a person.
 *
 * Passed in rather than closed over, so each criterion is a function a test can
 * call on its own — `scoreReport` was one 746-line body whose seven independent
 * computations could only be reached through the whole of it.
 */
interface Sink {
  fail(criterion: string, what: string): void;
  open(criterion: string, what: string, reason: string): void;
  ask(item: HumanItem): void;
}

/** One key row, the finding it claimed, and what a ruling suspends on it. */
interface RowJoin {
  row: KeyRow;
  index: number;
  ruling: RowRuling;
  hit: Finding | null;
  ambiguous: boolean;
}

/** The label a row is reported under: its own `n`, or its position in the key. */
function rowLabel(row: KeyRow, index: number): string {
  return row.n === undefined ? `#${index + 1}` : `#${row.n}`;
}

/**
 * Which shipped finding answers which key row.
 *
 * A finding is claimed by at most one row, so the order rows take their pick in
 * decides what the run is reported to have missed — and it is not the order they
 * are written in. Rows whose *firing* is unruled go last, and narrower sites go
 * before wider ones. Both were live defects: a `line: null` row listed first ate
 * the finding an exact-line row below it named, reporting a detector gap on a
 * run that had detected it; and a row unruled on `recall` did the same, which is
 * the worst version — a row nobody adjudicated producing the strongest verdict
 * the harness has. Ties keep key order, so the result stays deterministic.
 *
 * A row unruled on something *other* than `recall` — its severity, say — picks
 * at full priority, because whether it fired is settled.
 */
function joinRowsToFindings(
  rows: KeyRow[],
  findings: Finding[],
  questions: KeyOpenQuestion[],
): { joins: RowJoin[]; claimed: Set<string> } {
  const rulings = rows.map((row) => rowRuling(row.needs_ruling, questions));
  const specificity = (row: KeyRow): number => {
    if (row.line === null || row.line === undefined) return 2;
    return row.line_end === null || row.line_end === undefined ? 0 : 1;
  };
  const claimOrder = rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const unruled =
        Number(rulings[a.i].blocked.has("recall")) - Number(rulings[b.i].blocked.has("recall"));
      if (unruled !== 0) return unruled;
      const narrower = specificity(a.row) - specificity(b.row);
      return narrower !== 0 ? narrower : a.i - b.i;
    });

  const claimed = new Set<string>();
  const hitByRow = new Map<number, Finding>();
  // Rows whose join is ambiguous — more than one unclaimed finding sat at the
  // site they name. Recall is still settled (something fired there); which of
  // them the row meant is not, so criterion 5 declines rather than picking.
  const ambiguousRows = new Set<number>();
  for (const { row, i } of claimOrder) {
    const candidates = findings.filter((f) => !claimed.has(f.id) && rowMatchesFinding(row, f));
    const hit = candidates[0];
    if (!hit) continue;
    claimed.add(hit.id);
    hitByRow.set(i, hit);
    if (candidates.length > 1) ambiguousRows.add(i);
  }

  const joins = rows.map((row, i) => ({
    row,
    index: i,
    ruling: rulings[i],
    hit: hitByRow.get(i) ?? null,
    ambiguous: ambiguousRows.has(i),
  }));
  return { joins, claimed };
}

/**
 * 1 — recall. Of the rows the key names, how many were reported at their site?
 *
 * A row unruled on `recall` is neither matched nor missed: counting it either
 * way states an adjudication nobody made. A key naming no row at all is not a
 * clean sweep either — `0 of 0` is a check that did not run.
 */
function scoreRecall(joins: RowJoin[], sink: Sink): Record<string, unknown> {
  const matched: RecallHit[] = [];
  const missed: RecallMiss[] = [];
  const rowsOpen: RecallOpen[] = [];

  // Reported in the key's own order, whatever order the picks were made in.
  for (const join of joins) {
    const { row, hit, ruling } = join;
    const label = rowLabel(row, join.index);
    const site = siteLabel(row.path, row.line);

    if (ruling.blocked.has("recall")) {
      const reason = `needs_ruling: ${ruling.asked}`;
      rowsOpen.push({
        n: row.n ?? null,
        signal: row.signal,
        detector_id: row.detector_id,
        site,
        adjudication: row.adjudication ?? null,
        fired: Boolean(hit),
        finding_id: hit ? hit.id : null,
        reason,
      });
      sink.open("recall", `${label} ${row.signal} at ${site}`, reason);
      continue;
    }

    if (hit) {
      matched.push({
        n: row.n ?? null,
        signal: row.signal,
        detector_id: row.detector_id,
        site,
        finding_id: hit.id,
        finding_site: findingSite(hit),
        ambiguous: join.ambiguous,
      });
      continue;
    }

    missed.push({
      n: row.n ?? null,
      signal: row.signal,
      detector_id: row.detector_id,
      site,
      adjudication: row.adjudication ?? null,
    });
    sink.fail("recall", `${label} ${row.signal} was not reported at ${site}`);
  }

  if (joins.length === 0) {
    sink.open(
      "recall",
      "the key's must_fire rows",
      "this key names no must_fire row, so no detection was held to anything — " +
        "`0 of 0 recalled` is a check that did not run, not one that passed",
    );
  }

  const status: CriterionStatus =
    missed.length > 0
      ? "fail"
      : rowsOpen.length > 0 || joins.length === 0
        ? "unscoreable"
        : "pass";

  return {
    id: 1,
    name: "recall",
    gating: true,
    status,
    counts: {
      rows: joins.length,
      matched: matched.length,
      missed: missed.length,
      unscoreable: rowsOpen.length,
      scoreable: joins.length - rowsOpen.length,
    },
    matched,
    missed,
    unscoreable: rowsOpen,
  };
}

/**
 * 2 — precision. What did the run ship that no key row accounts for?
 *
 * Two numbers, labelled, because the source document is ill-typed here:
 * criterion 2 asks for a count of extras and the gate table records a ratio.
 * Collapsing them to one would silently pick a reading.
 */
function scorePrecision(
  report: Report,
  key: ScoringKey,
  claimed: Set<string>,
  questions: KeyOpenQuestion[],
  sink: Sink,
): Record<string, unknown> {
  const mustNotFire = requireRowList<KeyMustNotFire>(key.must_not_fire, "must_not_fire");
  const globRules = mustNotFire.filter((r) => r.kind === "path_glob");
  const signalRules = mustNotFire.filter((r) => r.kind === "signal");

  const extraFindings = report.findings
    .filter((f) => !claimed.has(f.id))
    .map((f) => {
      const path = f.location?.path ?? "";
      const rule = globRules.find((r) => typeof r.glob === "string" && globMatches(r.glob, path));
      const ruling = rule ? rowRuling(rule.needs_ruling, questions) : null;
      const suspended = Boolean(ruling && ruling.blocked.has("precision"));
      return {
        id: f.id,
        detector_id: f.detector_id,
        site: findingSite(f),
        title: f.title,
        suppressed: Boolean(f.suppressed),
        must_not_fire: rule
          ? {
              kind: "path_glob",
              glob: rule.glob ?? null,
              why: rule.why ?? null,
              needs_ruling: suspended ? (ruling as RowRuling).asked : null,
            }
          : null,
      };
    });

  // § Must NOT fire is scored against what the run *shipped*, not against what
  // the report mentions. A suppressed entry is the correct outcome, not a false
  // positive — that was the `must-not-fire-present-vs-shipped` question, and it
  // is settled that way (ADR-0013) because the key already scored it so on both
  // sides: a § Must fire row whose passing outcome is `suppressed: true`, and
  // `sdk-behind-ga` scored a pass while present-and-suppressed. So the hunt runs
  // over live entries only, and the suppressed ones are counted, not scored.
  // A signal rule adjudicates a finding too — the key names it, so it is not an
  // extra nobody accounted for. Kept as an id set rather than a field on the
  // mapped extra, so `extra_findings` keeps its shape. This is independent of
  // whether the *absence* of a signal is readable: a name that is present can be
  // read off the finding either way.
  const signalNames = new Set(
    signalRules.map((r) => r.signal).filter((s): s is string => typeof s === "string"),
  );
  const signalAdjudicated = new Set(
    report.findings
      .filter((f) => f.signal !== undefined && signalNames.has(f.signal))
      .map((f) => f.id),
  );

  // The ruling scopes to rows the key *has* a must_not_fire rule for. An extra
  // the key says nothing about still goes to a human whether or not it was
  // suppressed — that shape (findings nobody accounted for, all suppressed, so
  // no citation question either) is exactly what used to exit 0.
  const suppressedRuleHits = extraFindings.filter(
    (e) => (e.must_not_fire || signalAdjudicated.has(e.id)) && e.suppressed,
  );

  let settledHits = 0;
  let unruledHits = 0;
  for (const extra of extraFindings) {
    const rule = extra.must_not_fire;
    // Scored by the signal loop below, not here — and never asked of a human,
    // because the key does name it.
    if (!rule && signalAdjudicated.has(extra.id)) continue;
    // A suppressed entry against a must_not_fire rule is the outcome the rule
    // predicts, not a violation of it. Counted, not scored.
    if (rule && extra.suppressed) continue;
    // A rule a human has not settled cannot fail a run.
    if (rule && rule.needs_ruling) {
      unruledHits += 1;
      sink.open(
        "precision",
        `${extra.id} at ${extra.site} matches must_not_fire glob '${rule.glob}'`,
        `needs_ruling: ${rule.needs_ruling}` + (rule.why ? ` — ${rule.why}` : ""),
      );
      continue;
    }
    if (rule) {
      settledHits += 1;
      sink.fail(
        "precision",
        `${extra.id} at ${extra.site} matches must_not_fire glob '${rule.glob}'` +
          (rule.why ? ` — ${rule.why}` : ""),
      );
      continue;
    }
    // An extra the key names no rule for is not a scored false positive. § Scoring
    // reserves that call — "the fixture does not compile, so a report that flags
    // *that* is right but out of scope — record it, do not score it" — and a
    // harness that counted it as a pass would be scoring the judgement it was
    // told not to make. It goes to the human, with everything needed to make it.
    sink.ask({
      criterion: "precision",
      what: `${extra.id} at ${extra.site} — ${extra.title}`,
      asks:
        "this finding matches no key row and no must_not_fire rule: rule it a " +
        "false positive, or right-but-out-of-scope, and put the answer in the key",
    });
  }

  // A `signal`-keyed must-not-fire joins to `findings` on the finding's own
  // `signal` (ADR-0013). The field is optional, which is the whole difficulty:
  // "no live finding carries `leaderboard-no-stats`" is true of a report whose
  // findings carry no signals at all, and reporting that as a pass would be
  // scoring zero out of zero. So the join is refused unless *every* live finding
  // carries one — then an absence is an absence, and a match is a real hit.
  const liveFindings = report.findings.filter((f) => !f.suppressed);
  const unsignalled = liveFindings.filter((f) => f.signal === undefined);
  const signalJoinable = signalRules.length > 0 && unsignalled.length === 0;

  const signalUnscoreable: Record<string, unknown>[] = [];
  let signalUnjoinable = 0;
  for (const rule of signalRules) {
    const ruling = rowRuling(rule.needs_ruling, questions);
    const named = rule.signal ?? "(unnamed)";
    if (ruling.unruled) {
      unruledHits += 1;
      signalUnscoreable.push({
        kind: "signal",
        signal: rule.signal ?? null,
        why: rule.why ?? null,
        needs_ruling: ruling.asked,
        unjoinable: null,
      });
      sink.open(
        "precision",
        `must_not_fire signal '${named}'`,
        `needs_ruling: ${ruling.asked}` + (rule.why ? ` — ${rule.why}` : ""),
      );
      continue;
    }
    // A name that is *present* is unambiguous, so it fails whether or not the
    // rest of the report is signed. Joinability gates only the conclusion drawn
    // from an absence — which is the half that could be vacuous.
    const hits = liveFindings.filter(
      (f) => f.signal !== undefined && f.signal === rule.signal,
    );
    for (const hit of hits) {
      settledHits += 1;
      sink.fail(
        "precision",
        `${hit.id} at ${findingSite(hit)} carries must_not_fire signal '${named}'` +
          (rule.why ? ` — ${rule.why}` : ""),
      );
    }
    if (hits.length > 0 || signalJoinable) continue;
    const unjoinable =
      `${unsignalled.length} of ${liveFindings.length} live findings carry no ` +
      "`signal`, so an absence here cannot be told from a field nobody wrote";
    signalUnjoinable += 1;
    signalUnscoreable.push({
      kind: "signal",
      signal: rule.signal ?? null,
      why: rule.why ?? null,
      needs_ruling: null,
      unjoinable,
    });
    sink.open(
      "precision",
      `must_not_fire signal '${named}'`,
      `${unjoinable} — a config-aware run checks the same name against ` +
        "`cross_reference.candidates` under criterion 6",
    );
  }

  const unadjudicatedExtras = extraFindings.filter(
    (e) => !e.must_not_fire && !signalAdjudicated.has(e.id),
  );
  const status: CriterionStatus =
    settledHits > 0
      ? "fail"
      : signalUnjoinable > 0 || unadjudicatedExtras.length > 0 || unruledHits > 0
        ? "unscoreable"
        : "pass";

  return {
    id: 2,
    name: "precision",
    gating: true,
    status,
    open: unadjudicatedExtras.length + unruledHits,
    extras: extraFindings.length,
    suppressed_rule_hits: suppressedRuleHits.length,
    matched_of_shipped: `${report.findings.length - extraFindings.length}/${report.findings.length}`,
    labels: {
      extras: "criterion 2's number: shipped findings matching no key row",
      suppressed_rule_hits:
        "matched a must_not_fire rule but were suppressed — the outcome the " +
        "rule predicts, counted here rather than scored as a false positive",
      matched_of_shipped:
        "the gate table's ratio: shipped findings that a key row accounts for, " +
        "over findings shipped",
    },
    extra_findings: extraFindings,
    must_not_fire_unscoreable: signalUnscoreable,
  };
}

/**
 * 3 — citations, the offline half.
 *
 * Never `pass` while a citation is still unopened. § Scoring calls this "the
 * actual gate criterion", and the summary line is what an operator transcribes
 * into the gate table — a green row against an unasked question is the one
 * reading this whole harness exists to prevent. Two questions stay open past
 * this function: whether a page states the finding's claim, which is prose and
 * goes to a person, and whether each URL resolves, which is network I/O this
 * tool does not do and goes to a resolver run over `citation_urls`.
 *
 * The second question has a mechanical corner, and only where a key row cut one
 * out: a `citation_quotes` entry names the exact sentence a page must state, so
 * a resolver can settle *that* much without reading anything. It travels on
 * `citation_quotes` — still unopened here. Every other citation stays whole in
 * `needs_human`, because a row that declared no quote is not a row whose quote
 * checked out.
 */
function scoreCitations(
  report: Report,
  rowByFinding: Map<string, RowJoin>,
  sink: Sink,
): {
  criterion: Record<string, unknown>;
  urlManifest: string[];
  quoteManifest: CitationQuote[];
  internalManifest: string[];
} {
  const urlManifest: string[] = [];
  const quoteManifest: CitationQuote[] = [];
  const internalManifest: string[] = [];
  const gateFailures: string[] = [];
  let asks = 0;
  const failHere = (what: string): void => {
    gateFailures.push(`citations: ${what}`);
    sink.fail("citations", what);
  };
  const askHere = (item: HumanItem): void => {
    asks += 1;
    sink.ask(item);
  };

  const citationRows = report.findings.map((f) => {
    const citations = f.citations ?? [];
    const cites = citations.map((c) => {
      const scheme = citationScheme(c.source);
      const cls = classifyCitation(c.source);
      // Only the two schemes this criterion accepts reach a manifest. `other`
      // never did; `http` did, and `citation_urls` is the list a resolver is
      // told to fetch — so a cleartext citation was gate-passed here and then
      // fetched over cleartext downstream.
      const target = scheme === "internal" ? internalManifest : urlManifest;
      const shipped = scheme === "https" || scheme === "internal";
      if (shipped && !target.some((u) => sameUrl(u, c.source))) {
        target.push(normalizeSource(c.source));
      }
      return { source: c.source, scheme, class: cls.cls, refusal: cls.problem ?? null };
    });
    const live = !f.suppressed;
    const internalOnly = cites.length > 0 && cites.every((c) => c.scheme === "internal");
    const join = rowByFinding.get(f.id) ?? null;
    const row = join ? join.row : null;
    const suspended = Boolean(join && join.ruling.blocked.has("citations"));
    // Not defaulted: a scalar here reads as "no constraint", which is the
    // one-character key typo that silently switches off the check the field
    // exists to make and leaves no trace on the scorecard.
    const where = join ? `must_fire[${rowLabel(join.row, join.index)}]` : "must_fire[?]";
    const expected =
      suspended || !row ? [] : requireStringList(row.citation_urls, `${where}.citation_urls`);
    const banned =
      suspended || !row
        ? []
        : requireStringList(row.banned_citation_urls, `${where}.banned_citation_urls`);
    const expectedPresent = expected.filter((u) => cites.some((c) => sameUrl(c.source, u)));
    const expectedAbsent = expected.filter((u) => !cites.some((c) => sameUrl(c.source, u)));
    const bannedPresent = cites
      .filter((c) => banned.some((u) => sameUrl(c.source, u)))
      .map((c) => c.source);

    // The quotes this finding's row declared, for the pages it actually cited.
    // Scoped to live findings on purpose: § Scoring 3 opens the citations of
    // *shipped* findings, and a suppressed row asserts nothing for a page to
    // state. A row that declared no quote contributes nothing here and is not
    // recorded as having satisfied one.
    const requiredQuotes = suspended || !row ? [] : requireRowList<KeyCitationQuote>(
      row.citation_quotes,
      `${where}.citation_quotes`,
    );
    if (live) {
      for (const required of requiredQuotes) {
        const url = required.url;
        const quote = required.quote;
        if (typeof url !== "string" || typeof quote !== "string") continue;
        // **This** finding's citations, not the report's manifest. Another
        // finding citing the page does not put this row's quote on it, and
        // checking the manifest instead would emit one for a finding that cited
        // something else entirely.
        const match = cites.find((c) => sameUrl(c.source, url));
        if (match === undefined) continue;
        // The manifest's spelling of it, so the two lists join on a string.
        quoteManifest.push({ url: normalizeSource(match.source), quote, finding_id: f.id });
      }
    }

    if (suspended && row) {
      sink.open(
        "citations",
        `${f.id} at ${findingSite(f)}`,
        `needs_ruling: ${(join as RowJoin).ruling.asked} — the key's citation_urls ` +
          "and banned_citation_urls for this row were not compared",
      );
    }

    if (live && internalOnly) {
      failHere(
        `${f.id} at ${findingSite(f)} cites only internal:// targets — a live ` +
          "finding whose reader has nothing to open is a gate fail (§ Scoring 3)",
      );
    }
    // `validate` accepts `http://` — a citation source is `https?://` or
    // `internal://` — so this is the only place cleartext is caught, and the
    // sentence for it was already written here. It never printed: `http` is its
    // own scheme class and the gate asked only for `other`, so a cleartext
    // citation passed the check this criterion says it scores.
    for (const c of cites) {
      if (c.scheme === "other" || c.scheme === "http") {
        failHere(`${f.id} cites '${excerpt(c.source)}', which is neither https:// nor internal://`);
      }
      if (c.refusal) {
        failHere(`${f.id} cites '${excerpt(c.source)}' — ${c.refusal}`);
      }
    }
    for (const url of bannedPresent) {
      failHere(`${f.id} cites '${excerpt(url)}', which the key bans for this row`);
    }
    // A URL the key named and this finding does not cite. Membership itself is
    // mechanical — both lists are on the artifact — and so is the connective:
    // the keys README heads this "`citation_urls` is AND unless the row says
    // otherwise", calls `citation_urls_logic` the machine-readable half, and
    // spells it on all eight rows. What is unsettled is the only thing a gate
    // would need. That same section says whether a run citing one of an AND
    // row's two pages fails anything "is not settled by this field and is not
    // settled here", so failing an absent member would be this harness
    // inventing the rule its own key declines to state — the over-claim the
    // `scored:` string below once made, pointing the other way. Hence named,
    // rather than failed, and named rather than computed into JSON and scored
    // by nothing, which is how it went unread while that string advertised it.
    if (live && expectedAbsent.length > 0) {
      sink.open(
        "citations",
        `${f.id} at ${findingSite(f)}`,
        `the key names ${expectedAbsent.map((u) => `'${excerpt(u)}'`).join(", ")} for ` +
          "this row and the finding does not cite it — the row's " +
          "`citation_urls_logic` names the connective, but whether an absent " +
          "member of an AND row is a fault is a question the key's own contract " +
          "leaves unsettled, so the absence is recorded and not scored",
      );
    }

    if (live && cites.length > 0) {
      askHere({
        criterion: "citations",
        what: `${f.id} at ${findingSite(f)}`,
        asks:
          "open each citation and confirm the page states this finding's " +
          "specific claim, not merely its topic — and that it resolves. " +
          "Whether it does is prose, so this harness does not rule on it",
        urls: cites.map((c) => c.source),
      });
    } else if (expectedAbsent.length > 0) {
      // A suppressed row asserts nothing, so nobody is asked to open its
      // citations — but the key still named a URL this row was expected to
      // carry, and recording that in JSON while asking no one is how it goes
      // unread.
      askHere({
        criterion: "citations",
        what: `${f.id} at ${findingSite(f)} (suppressed)`,
        asks:
          "the key names a citation for this row and the row does not carry it. " +
          "A suppressed finding asserts nothing, so this is not a gate fail — " +
          "decide whether the key or the row is wrong",
        urls: expectedAbsent,
      });
    }
    return {
      finding_id: f.id,
      site: findingSite(f),
      suppressed: Boolean(f.suppressed),
      key_row: row ? (row.n ?? null) : null,
      citations: cites,
      internal_only_on_live_finding: live && internalOnly,
      expected_present: expectedPresent,
      expected_absent: expectedAbsent,
      banned_present: bannedPresent,
      // "needs-human" whether or not a quote was declared. A declared quote
      // settles one sentence on one page; it does not settle whether the page
      // states this finding's claim, and reporting it as though it did would be
      // the harness scoring its own paraphrase from the other direction.
      states_the_claim: live && cites.length > 0 ? "needs-human" : "not-asserted",
      required_quotes: requiredQuotes.length,
    };
  });

  // The resolver's half. Every URL the report cites lands in the manifest,
  // including a suppressed finding's, and this tool opens none of them — so a
  // non-empty manifest beside a green criterion 3 advertised a workload nobody
  // had done under a status that said it was finished.
  if (urlManifest.length > 0) {
    sink.open(
      "citations",
      `${urlManifest.length} cited URL${urlManifest.length === 1 ? "" : "s"}`,
      "this tool performs no network I/O, so whether each of them resolves is " +
        "unchecked here — run a resolver over the scorecard's `citation_urls`" +
        (quoteManifest.length > 0
          ? `, ${quoteManifest.length} of which the key holds to a verbatim ` +
            "quote it carries (`citation_quotes`)"
          : ""),
    );
  }

  const status: CriterionStatus =
    gateFailures.length > 0
      ? "fail"
      : asks > 0 || urlManifest.length > 0
        ? "unscoreable"
        : "pass";

  return {
    criterion: {
      id: 3,
      name: "citations",
      gating: true,
      status,
      open: asks,
      unresolved: urlManifest.length,
      scored:
        "the offline half only — scheme, internal-only-on-a-live-finding, and " +
        "banned URLs. This tool does no network I/O: whether a URL resolves is " +
        "for a resolver run over `citation_urls`, and whether the page states " +
        "the claim is for a human — except where a key row declared the " +
        "sentence verbatim, which travels on `citation_quotes` for the same " +
        "resolver. A row that declared none is not a row whose quote checked " +
        "out. A URL the key names and the finding does not cite is recorded on " +
        "`expected_absent` and opened as unscoreable, never failed: that row's " +
        "`citation_urls_logic` names the connective, and whether an absent " +
        "member of an AND row is a fault is a question the key's own contract " +
        "leaves unsettled.",
      findings: citationRows,
      gate_failures: gateFailures,
    },
    urlManifest,
    quoteManifest,
    internalManifest,
  };
}

/**
 * 4 — wall-clock. Explicitly non-gating: record the overage, do not fail on it.
 */
function scoreWallClock(report: Report, sink: Sink): Record<string, unknown> {
  const startedAt = report.provenance?.started_at;
  const scannedAt = report.provenance?.scanned_at;
  const startMs = startedAt ? Date.parse(startedAt) : NaN;
  const scanMs = scannedAt ? Date.parse(scannedAt) : NaN;
  const span = scanMs - startMs;
  const wallClockOpen = !startedAt
    ? "provenance.started_at is absent — this report predates schema_version 4, " +
      "where Stage 1 stamps it, and every other instant on it is written at " +
      "Stage 6, so the span is not recoverable from the artifact"
    : !Number.isFinite(span) || span < 0
      ? `provenance.started_at (${startedAt}) and scanned_at (${scannedAt ?? "absent"}) ` +
        "do not form an orderable span"
      : null;
  if (wallClockOpen) sink.open("wall_clock", "the run's duration", wallClockOpen);
  return {
    id: 4,
    name: "wall_clock",
    gating: false,
    status: (wallClockOpen ? "unscoreable" : "pass") as CriterionStatus,
    note: "explicitly non-gating (§ Scoring 4): record the overage, do not fail on it",
    // What a `pass` here does and does not mean. Both instants are the run's own
    // self-report, and nothing in the artifact distinguishes a `started_at`
    // stamped at Stage 1 from one composed at Stage 6 beside every other
    // timestamp — the exact failure § Config-aware scoring records. So `pass`
    // says the report carries two parseable instants in order, not that the span
    // between them was measured. Recorded here rather than raised as a
    // `needs_human` item: criterion 4 cannot fail a run, and an item on every
    // scorecard would make `incomplete` the verdict on all of them.
    measured:
      "no — both instants are the run's self-report, and the artifact cannot " +
      "distinguish a Stage 1 started_at from one composed at Stage 6",
    started_at: startedAt ?? null,
    scanned_at: scannedAt ?? null,
    seconds: wallClockOpen ? null : Math.round(span / 1000),
    human: wallClockOpen ? null : formatDuration(span),
    soft_target_seconds: WALL_CLOCK_SOFT_TARGET_S,
    over_soft_target: wallClockOpen ? null : span / 1000 > WALL_CLOCK_SOFT_TARGET_S,
    reason: wallClockOpen,
  };
}

/**
 * 5 — severity drift. Do the shipped values sit inside the sets the key accepts?
 *
 * Three things this criterion refuses to turn into a gating fail. A row whose
 * site holds more than one finding: recall is settled, but which finding the row
 * meant is not. A value the key accepts only on a prose condition: `needs_human`,
 * because evaluating the condition is exactly the judgement this harness
 * declines. And a comparison that never happened — `0 of 0 checked` was the one
 * status word on this card that could be reached by checking nothing.
 *
 * On a config-aware run, a **confirmed** candidate replaces the row's code-only
 * values with the key's `on_confirm` ones. The key states both, and holding a
 * confirmed finding to the code-only pair made criteria 5 and 7 mutually
 * unsatisfiable: `client-authoritative-stats` is code-only `high/medium` and
 * confirmed `high/high`, so a doc-perfect run failed one of them whichever it
 * shipped.
 */
function scoreSeverityDrift(
  report: Report,
  key: ScoringKey,
  joins: RowJoin[],
  sink: Sink,
): Record<string, unknown> {
  const drift: DriftRow[] = [];
  const driftOpen: RecallMiss[] = [];
  const conditional: Record<string, unknown>[] = [];
  const mustAppear = requireRowList<KeyCrossRefRow>(
    key.cross_reference?.must_appear,
    "cross_reference.must_appear",
  );
  const candidates = report.cross_reference?.candidates ?? [];
  const liveRead = report.mode === "config-aware";
  let checkedRows = 0;
  let suspendedRows = 0;

  for (const join of joins) {
    const { row, hit } = join;
    if (!hit) continue;
    const label = rowLabel(row, join.index);
    const where = `must_fire[${label}]`;

    // Several findings sat at this row's site and the key cannot say which one
    // it meant. Recall is settled either way; holding an arbitrary pick to the
    // row's severity is not — it reported four drift bugs against a run whose
    // findings were all correct, purely because they were listed in the other
    // order.
    if (join.ambiguous) {
      driftOpen.push({
        n: row.n ?? null,
        signal: row.signal,
        detector_id: row.detector_id,
        site: findingSite(hit),
      });
      sink.open(
        "severity_drift",
        `${label} ${row.signal} at ${siteLabel(row.path, row.line)}`,
        "more than one finding sits at the site this row names, and the key " +
          "cannot say which of them it means — the values shipped there are " +
          "not attributable to this row",
      );
      continue;
    }

    const confirmed =
      liveRead &&
      candidates.some(
        (c) =>
          c.disposition === "confirmed" && c.signal === row.signal && c.finding_id === hit.id,
      );
    const onConfirm = confirmed
      ? (asRecord(mustAppear.find((w) => w.signal === row.signal)?.on_confirm) as
          | KeyCrossRefRow["on_confirm"]
          | null)
      : null;
    // A confirmed candidate names the value outright, so the row's conditional
    // latitude does not travel with it: the copy rule is the whole answer there.
    const conditionalFor = (field: "severity" | "confidence"): KeyConditionalValue[] =>
      onConfirm
        ? []
        : (requireRowList<KeyConditionalValue>(row[`${field}_conditional`], `${where}.${field}_conditional`));

    const fields: { field: "severity" | "confidence"; actual: string; accepted: string[] }[] = [
      {
        field: "severity",
        actual: hit.severity,
        accepted:
          onConfirm?.severity !== undefined
            ? [onConfirm.severity]
            : requireStringList(row.severity, `${where}.severity`),
      },
      {
        field: "confidence",
        actual: hit.confidence,
        accepted:
          onConfirm?.confidence !== undefined
            ? [onConfirm.confidence]
            : requireStringList(row.confidence, `${where}.confidence`),
      },
    ];

    let checkedAny = false;
    let suspendedAny = false;
    for (const { field, actual, accepted } of fields) {
      if (accepted.length === 0) continue;
      if (join.ruling.blocked.has(field)) {
        suspendedAny = true;
        continue;
      }
      checkedAny = true;
      if (accepted.includes(actual)) continue;

      // The source records this value as acceptable under a condition it states
      // in prose. Converting that into a gating failure scored the best run in
      // the record — one the source itself scores as **0 drift** — as a hard
      // fail, and converting it into a pass would grant a value nobody earned.
      const granted = conditionalFor(field).find(
        (entry) => asRecord(entry)?.value === actual,
      );
      if (granted) {
        const condition = typeof granted.condition === "string" ? granted.condition : null;
        conditional.push({
          n: row.n ?? null,
          signal: row.signal,
          site: findingSite(hit),
          finding_id: hit.id,
          field,
          actual,
          accepted,
          condition,
        });
        sink.ask({
          criterion: "severity_drift",
          what: `${hit.id} at ${findingSite(hit)} reports ${field} '${actual}'`,
          asks:
            `the key accepts '${actual}' for this row only on a condition it ` +
            "states in prose, and this harness does not evaluate prose — read " +
            "the condition against what the run actually cited: " +
            (condition ?? "(condition absent)"),
        });
        continue;
      }

      drift.push({
        n: row.n ?? null,
        signal: row.signal,
        site: findingSite(hit),
        finding_id: hit.id,
        field,
        actual,
        accepted,
      });
      sink.fail(
        "severity_drift",
        `${hit.id} at ${findingSite(hit)} reports ${field} '${actual}', ` +
          `and the key accepts ${accepted.map((a) => `'${a}'`).join(", ")}` +
          (onConfirm
            ? " — the live read confirmed this candidate, so the accepted set is " +
              "the key's on_confirm value, not its code-only one"
            : ""),
      );
    }

    const mustBeSuppressed = requireOptionalBoolean(
      row.must_be_suppressed,
      `${where}.must_be_suppressed`,
    );
    if (mustBeSuppressed !== undefined) {
      if (join.ruling.blocked.has("suppressed")) {
        suspendedAny = true;
      } else {
        checkedAny = true;
        if (Boolean(hit.suppressed) !== mustBeSuppressed) {
          drift.push({
            n: row.n ?? null,
            signal: row.signal,
            site: findingSite(hit),
            finding_id: hit.id,
            field: "suppressed",
            actual: Boolean(hit.suppressed),
            accepted: [mustBeSuppressed],
          });
          sink.fail(
            "severity_drift",
            `${hit.id} at ${findingSite(hit)} reports suppressed=` +
              `${Boolean(hit.suppressed)}, and the key requires ${mustBeSuppressed}`,
          );
        }
      }
    }

    // A ruling suspended part of what this criterion was asked, so it cannot
    // report a clean answer for this row even when the rest of it compared. The
    // count feeds the status: a criterion with an open question is never `pass`,
    // and an `open()` that did not move the status word is the leak this whole
    // harness exists to close.
    if (suspendedAny) {
      suspendedRows += 1;
      sink.open(
        "severity_drift",
        `${label} ${row.signal} at ${findingSite(hit)}`,
        `needs_ruling: ${join.ruling.asked}`,
      );
    }
    if (checkedAny) {
      checkedRows += 1;
      continue;
    }
    if (suspendedAny) continue;
    driftOpen.push({
      n: row.n ?? null,
      signal: row.signal,
      detector_id: row.detector_id,
      site: findingSite(hit),
    });
    sink.open(
      "severity_drift",
      `${label} ${row.signal} at ${findingSite(hit)}`,
      "the key names no accepted severity or confidence for this row, so there " +
        "is nothing to hold the shipped values to",
    );
  }

  // `0 of 0 checked` reported `pass` — on a report of a different repo, and on
  // `findings: []`. Criteria 1, 6 and 7 carry the same branch, for the same
  // reason; criteria 2, 3 and 4 answer off the report rather than off a key
  // population, so there is no empty population for them to fall through.
  const suspendedOnly = checkedRows === 0 && driftOpen.length === 0 && drift.length === 0;
  if (suspendedOnly) {
    sink.open(
      "severity_drift",
      "the shipped severities and confidences",
      "no key row's values were compared against a shipped finding, so nothing " +
        "was checked — `0 of 0` is a check that did not run, not one that passed",
    );
  }

  const status: CriterionStatus =
    drift.length > 0
      ? "fail"
      : driftOpen.length > 0 || conditional.length > 0 || suspendedRows > 0 || checkedRows === 0
        ? "unscoreable"
        : "pass";

  return {
    id: 5,
    name: "severity_drift",
    gating: true,
    status,
    checked: checkedRows,
    drift,
    conditional,
    unscoreable: driftOpen,
  };
}

/**
 * Why criteria 6 and 7 cannot be scored off this report, or null.
 *
 * `not-applicable` is not `unscoreable`: a key with no cross-reference half asks
 * nothing about a live read, and that is the `null` key case the callers handle.
 */
function crossReferenceGap(report: Report, keyXref: KeyCrossReference | undefined): string | null {
  if (!keyXref) return null;
  if (report.mode !== "config-aware") {
    return (
      `this report's mode is '${report.mode}', and the key's cross-reference ` +
      "half describes what a live namespace read must have attempted — a " +
      "code-only run made no such read, so there is nothing to compare"
    );
  }
  if (!report.cross_reference?.candidates) {
    return (
      "the report carries no `cross_reference`, so the Stage 3 inventory " +
      "the key scores against is not in the artifact"
    );
  }
  return null;
}

/** 6 — inventory completeness. Did the run attempt what the key names? */
function scoreInventory(
  report: Report,
  keyXref: KeyCrossReference | undefined,
  questions: KeyOpenQuestion[],
  sink: Sink,
): Record<string, unknown> {
  if (!keyXref) {
    return {
      id: 6,
      name: "inventory_completeness",
      gating: true,
      status: "not-applicable" as CriterionStatus,
      reason: "the key declares no `cross_reference`, so it asks nothing about a live read",
    };
  }

  const gap = crossReferenceGap(report, keyXref);
  if (gap) {
    sink.open("inventory_completeness", "the Stage 3 inventory", gap);
    return {
      id: 6,
      name: "inventory_completeness",
      gating: true,
      status: "unscoreable" as CriterionStatus,
      reason: gap,
    };
  }

  const candidates = report.cross_reference?.candidates ?? [];
  // Not defaulted, for the reason the citation lists are not: a string here
  // would substring-match under `includes` and spread into its own characters
  // under the closed-world set.
  const mustAppear = requireRowList<KeyCrossRefRow>(
    keyXref.must_appear,
    "cross_reference.must_appear",
  );
  const mustNotAppear = requireStringList(keyXref.must_not_appear, "cross_reference.must_not_appear");
  const bannedDispositions = requireStringList(
    keyXref.banned_dispositions,
    "cross_reference.banned_dispositions",
  );
  const closedWorld =
    requireOptionalBoolean(keyXref.closed_world, "cross_reference.closed_world") === true;
  const signalsSeen = candidates.map((c) => c.signal);

  const failures: string[] = [];
  const failHere = (what: string): void => {
    failures.push(what);
    sink.fail("inventory_completeness", what);
  };

  const present: Record<string, unknown>[] = [];
  const absent: Record<string, unknown>[] = [];
  let suspended = 0;
  let noAccepted = 0;
  for (const want of mustAppear) {
    const ruling = rowRuling(want.needs_ruling, questions);
    const rowsFor = candidates.filter((c) => c.signal === want.signal);
    const accepted = requireStringList(
      want.disposition,
      `cross_reference.must_appear['${want.signal}'].disposition`,
    );

    // Whether this signal must appear at all is unsettled in the key's own
    // source. Requiring it anyway would turn an open question into a gating
    // fail, so the row is suspended and named instead of scored either way.
    // The seeded key reached this branch until `closed-world-vs-not-readable`
    // was ruled: an inventory row records the read a run *attempted*, so a
    // `not-readable` candidate is still required to carry one.
    if (ruling.blocked.has("inventory")) {
      suspended += 1;
      (rowsFor.length === 0 ? absent : present).push({
        signal: want.signal,
        dispositions: rowsFor.map((c) => c.disposition),
        accepted: accepted.length > 0 ? accepted : null,
        needs_ruling: ruling.asked,
      });
      sink.open(
        "inventory_completeness",
        `candidate '${want.signal}'`,
        `needs_ruling: ${ruling.asked}`,
      );
      continue;
    }

    if (rowsFor.length === 0) {
      absent.push({ signal: want.signal });
      failHere(
        `no candidate carries signal '${want.signal}', which the key requires ` +
          "the run to have attempted a live read on — a read that errored or " +
          "that the token could not make is a 'not-readable' row, not an absent one",
      );
      continue;
    }
    const offRow = accepted.length === 0 ? null : rowsFor.find((c) => !accepted.includes(c.disposition));
    present.push({
      signal: want.signal,
      dispositions: rowsFor.map((c) => c.disposition),
      accepted: accepted.length > 0 ? accepted : null,
    });
    if (offRow) {
      failHere(
        `candidate '${want.signal}' is '${offRow.disposition}', and the key ` +
          `accepts ${accepted.map((a) => `'${a}'`).join(", ")}`,
      );
    }
    if (accepted.length === 0) {
      noAccepted += 1;
      sink.open(
        "inventory_completeness",
        `candidate '${want.signal}'`,
        "the key names no accepted disposition for this signal",
      );
    }
  }

  const forbidden = signalsSeen.filter((s) => mustNotAppear.includes(s));
  for (const signal of forbidden) {
    failHere(
      `candidate '${signal}' is in the key's must_not_appear — a live read ` +
        "settles nothing about it, so a row for it is an invented read",
    );
  }

  const bannedHits = candidates
    .filter((c) => bannedDispositions.includes(c.disposition))
    .map((c) => ({ signal: c.signal, disposition: c.disposition }));
  for (const hit of bannedHits) {
    failHere(
      `candidate '${hit.signal}' is '${hit.disposition}', which this key bans ` +
        "outright — the run dropped a finding on a read that does not carry it",
    );
  }

  const named = new Set([...mustAppear.map((r) => r.signal), ...mustNotAppear]);
  const unexpected = signalsSeen.filter((s) => !named.has(s));
  if (closedWorld) {
    for (const signal of unexpected) {
      failHere(
        `candidate '${signal}' is named nowhere in the key, and the key is ` +
          "closed-world — the inventory holds a row for a candidate no read " +
          "was keyed to settle",
      );
    }
  }

  // Four comparisons, and a cross-reference half that names none of them makes
  // all four vacuous — no signal required, none forbidden, no banned
  // disposition, and an open world that excludes nothing. The key asked about
  // the live read, so this is not the `not-applicable` of a key with no live
  // half; it is the same `0 of 0` criteria 1 and 5 refuse, one criterion over.
  const asksNothing = crossReferenceAsksNothing(keyXref as unknown as Record<string, unknown>);
  if (asksNothing) {
    sink.open(
      "inventory_completeness",
      "the Stage 3 inventory",
      "the key's cross-reference half requires no candidate, forbids none, " +
        "bans no disposition and declares no closed world, so nothing in the " +
        "inventory was compared against anything — `0 of 0` is a check that " +
        "did not run, not one that passed",
    );
  }

  // The other side of the same question, and the side criterion 7 asks: what
  // the key names and what was compared are two things. `must_not_appear`,
  // `banned_dispositions` and the closed world all run over the inventory, so a
  // key naming all three still compares nothing against an empty one — and an
  // empty inventory is a valid artifact, the answer when the read raised
  // nothing to settle. Reading the key alone reported a gating `pass` there,
  // beside a criterion 7 that read `unscoreable` off the same report.
  const rowsCompared = present.length + absent.length;
  const asksOfCandidates =
    mustNotAppear.length > 0 || bannedDispositions.length > 0 || closedWorld;
  const candidatesCompared = asksOfCandidates ? candidates.length : 0;
  const comparedNothing = rowsCompared + candidatesCompared === 0;
  if (comparedNothing && !asksNothing) {
    sink.open(
      "inventory_completeness",
      "the Stage 3 inventory",
      "the key names what a live read must have been attempted on and the " +
        "inventory holds no candidate to hold to it, so every comparison ran over an " +
        "empty population — `0 of 0 compared` is a check that did not run, " +
        "not one that passed",
    );
  }

  const status: CriterionStatus =
    failures.length > 0
      ? "fail"
      : asksNothing || comparedNothing || suspended > 0 || noAccepted > 0
        ? "unscoreable"
        : "pass";

  return {
    id: 6,
    name: "inventory_completeness",
    gating: true,
    status,
    candidate_signals: signalsSeen,
    must_appear: { present, absent },
    must_not_appear: { violations: forbidden },
    banned_dispositions: { banned: bannedDispositions, violations: bannedHits },
    closed_world: { enforced: closedWorld, unnamed: unexpected },
  };
}

/** 7 — disposition correctness. A confirmed candidate copies, and never re-rates. */
function scoreDisposition(
  report: Report,
  keyXref: KeyCrossReference | undefined,
  questions: KeyOpenQuestion[],
  sink: Sink,
): Record<string, unknown> {
  if (!keyXref) {
    return {
      id: 7,
      name: "disposition_correctness",
      gating: true,
      status: "not-applicable" as CriterionStatus,
      reason: "the key declares no `cross_reference`, so no candidate has an on_confirm to copy",
    };
  }

  const gap = crossReferenceGap(report, keyXref);
  if (gap) {
    sink.open("disposition_correctness", "the copy rule on confirmed candidates", gap);
    return {
      id: 7,
      name: "disposition_correctness",
      gating: true,
      status: "unscoreable" as CriterionStatus,
      reason: gap,
    };
  }

  const candidates = report.cross_reference?.candidates ?? [];
  const mustAppear = requireRowList<KeyCrossRefRow>(
    keyXref.must_appear,
    "cross_reference.must_appear",
  );
  const checked: Record<string, unknown>[] = [];
  const dispositionOpen: Record<string, unknown>[] = [];

  for (const c of candidates.filter((x) => x.disposition === "confirmed")) {
    const want = mustAppear.find((w) => w.signal === c.signal);
    const ruling = rowRuling(want?.needs_ruling, questions);
    if (ruling.blocked.has("on_confirm")) {
      dispositionOpen.push({ signal: c.signal, reason: `needs_ruling: ${ruling.asked}` });
      sink.open(
        "disposition_correctness",
        `confirmed candidate '${c.signal}'`,
        `needs_ruling: ${ruling.asked}`,
      );
      continue;
    }
    const onConfirm = asRecord(want?.on_confirm) as KeyCrossRefRow["on_confirm"] | null;
    if (!onConfirm || (onConfirm.severity === undefined && onConfirm.confidence === undefined)) {
      dispositionOpen.push({
        signal: c.signal,
        reason: "the key names no on_confirm for this signal",
      });
      sink.open(
        "disposition_correctness",
        `confirmed candidate '${c.signal}'`,
        "the key names no `on_confirm` for this signal, so there is no copied " +
          "value to hold the shipped finding to",
      );
      continue;
    }
    const finding = c.finding_id
      ? (report.findings.find((f) => f.id === c.finding_id) ?? null)
      : null;
    if (!finding) {
      dispositionOpen.push({
        signal: c.signal,
        reason: "the confirmed candidate names no finding this report shipped",
      });
      sink.open(
        "disposition_correctness",
        `confirmed candidate '${c.signal}'`,
        "it names no `finding_id` in this report, so the copy rule has no " +
          "finding to check",
      );
      continue;
    }
    const wrong: string[] = [];
    if (onConfirm.severity !== undefined && finding.severity !== onConfirm.severity) {
      wrong.push(`severity '${finding.severity}' (key copies '${onConfirm.severity}')`);
    }
    if (onConfirm.confidence !== undefined && finding.confidence !== onConfirm.confidence) {
      wrong.push(`confidence '${finding.confidence}' (key copies '${onConfirm.confidence}')`);
    }
    checked.push({
      signal: c.signal,
      finding_id: finding.id,
      expected: { severity: onConfirm.severity ?? null, confidence: onConfirm.confidence ?? null },
      actual: { severity: finding.severity, confidence: finding.confidence },
      ok: wrong.length === 0,
    });
    if (wrong.length === 0) continue;
    sink.fail(
      "disposition_correctness",
      `confirmed '${c.signal}' ships ${wrong.join(" and ")} — a confirmed ` +
        "candidate copies its playbook's channel-B row, and re-rating it from " +
        "the citation is the drift the copy rule forbids",
    );
  }

  // This criterion's whole population is the confirmed candidates, so a live
  // read that confirmed none never entered the loop above: both lists stayed
  // empty and the status fell through to `pass`. It reported a gating green on
  // an inventory whose only candidate was `not-readable`, beside a criterion 6
  // that failed on the same data.
  const comparedNothing = checked.length === 0 && dispositionOpen.length === 0;
  if (comparedNothing) {
    sink.open(
      "disposition_correctness",
      "the copy rule on confirmed candidates",
      "no candidate in this inventory is `confirmed`, so no shipped finding " +
        "was held to an `on_confirm` value — `0 of 0 compared` is a check that " +
        "did not run, not one that passed",
    );
  }

  const status: CriterionStatus = checked.some((c) => c.ok === false)
    ? "fail"
    : comparedNothing || dispositionOpen.length > 0
      ? "unscoreable"
      : "pass";

  return {
    id: 7,
    name: "disposition_correctness",
    gating: true,
    status,
    checked,
    unscoreable: dispositionOpen,
  };
}

/**
 * Score an already-validated report against a key.
 *
 * The seven criteria are § Scoring's five plus the two a config-aware run adds
 * (§ Live-namespace key). Each one is its own function answering `pass`, `fail`,
 * `unscoreable` or `not-applicable` on its own terms, and the top-level
 * `verdict` is a rollup: `fail` when any criterion failed, `incomplete` when
 * nothing failed but something is open, `pass` only when every question the key
 * asked was answered mechanically and answered yes.
 *
 * `fail` outranks `incomplete` deliberately. Criterion 3 leaves a `needs_human`
 * row for every cited finding — that is the point of it — so an `incomplete`
 * that swallowed failures would be the verdict on almost every run, and a
 * missed detection would arrive dressed as an open question.
 */
export function scoreReport(report: Report, key: ScoringKey): Scorecard {
  const failures: string[] = [];
  const needsHuman: HumanItem[] = [];
  const unscoreable: OpenItem[] = [];
  const sink: Sink = {
    fail: (criterion, what) => void failures.push(`${criterion}: ${what}`),
    open: (criterion, what, reason) => void unscoreable.push({ criterion, what, reason }),
    ask: (item) => void needsHuman.push(item),
  };

  const questions = requireRowList<KeyOpenQuestion>(key.open_questions, "open_questions");
  const rows = requireRowList<KeyRow>(key.must_fire, "must_fire");
  const { joins, claimed } = joinRowsToFindings(rows, report.findings, questions);
  // The key row behind a shipped finding, recorded where the join is made.
  // Re-deriving it later from (n, signal) would guess on a key whose rows are
  // unnumbered, which is the shape a hand-written key arrives in first. The
  // key's citation rules still apply to an unruled row's finding: whether it
  // should have fired may be open, but a banned URL on the row that did fire is
  // a mechanical fact either way.
  const rowByFinding = new Map<string, RowJoin>();
  for (const join of joins) {
    if (join.hit) rowByFinding.set(join.hit.id, join);
  }

  const recall = scoreRecall(joins, sink);
  const precision = scorePrecision(report, key, claimed, questions, sink);
  const cited = scoreCitations(report, rowByFinding, sink);
  const wallClock = scoreWallClock(report, sink);
  const severityDrift = scoreSeverityDrift(report, key, joins, sink);
  const inventory = scoreInventory(report, key.cross_reference, questions, sink);
  const disposition = scoreDisposition(report, key.cross_reference, questions, sink);

  // The key's own unsettled adjudications. They gate the key, so a scorecard
  // that did not carry them would read as complete off a key that says it is not.
  questions.forEach((q, i) => {
    // The same rule the other key lists are held to, and for the same reason:
    // this function is exported, so a caller that skipped `scoringKeyProblems`
    // arrives with whatever the key held. A scalar `sides` used to be
    // interpolated straight into the line below and threw
    // `q.sides.join is not a function`, killing the whole scorecard over one
    // mis-typed prose field (code/assert-invariants-and-fail-fast).
    const sides = requireStringList(q.sides, `open_questions[${i}].sides`);
    sink.ask({
      criterion: "key",
      what: q.id ?? q.what ?? "(unnamed open question)",
      asks:
        (q.what ?? "an open question on this key") +
        (sides.length > 0 ? ` — sides: ${sides.join(" | ")}` : "") +
        (q.blocks ? ` — blocks: ${q.blocks}` : ""),
    });
  });

  const verdict =
    failures.length > 0
      ? "fail"
      : unscoreable.length > 0 || needsHuman.length > 0
        ? "incomplete"
        : "pass";

  return {
    scorecard_version: SCORECARD_VERSION,
    verdict,
    key: {
      name: key.name ?? null,
      key_version: key.key_version,
      source: key.source ?? null,
      applies_to_mode: key.applies_to_mode ?? null,
    },
    report: {
      schema_version: report.schema_version,
      mode: report.mode,
      repo: report.repo.name ?? null,
      commit_sha: report.repo.commit_sha,
      findings: report.findings.length,
    },
    criteria: {
      recall,
      precision,
      citations: cited.criterion,
      wall_clock: wallClock,
      severity_drift: severityDrift,
      inventory_completeness: inventory,
      disposition_correctness: disposition,
    },
    failures,
    needs_human: needsHuman,
    unscoreable,
    citation_urls: [...cited.urlManifest].sort(),
    citation_quotes: [...cited.quoteManifest].sort(
      (a, b) => a.url.localeCompare(b.url) || a.quote.localeCompare(b.quote),
    ),
    citation_internal_refs: [...cited.internalManifest].sort(),
  };
}

/**
 * The citation manifest as a resolver reads it: newline-delimited, tab-extended.
 *
 * One line per URL. A URL the key holds to a verbatim quote carries it after a
 * tab, one line per distinct quote, and no bare line beside it — resolving the
 * page proves it reachable, so the bare check is already inside the quote check.
 *
 * This exists so the whole gate is two commands and no `jq`: making the check
 * depend on a JSON processor adds a tool nothing else in this repo declares,
 * on a path whose whole point is that it runs.
 */
export function citationUrlManifest(card: Scorecard): string {
  const quotes = new Map<string, string[]>();
  for (const required of card.citation_quotes) {
    const held = quotes.get(required.url) ?? [];
    if (!held.includes(required.quote)) held.push(required.quote);
    quotes.set(required.url, held);
  }
  const lines: string[] = [];
  for (const url of card.citation_urls) {
    const required = quotes.get(url) ?? [];
    if (required.length === 0) {
      lines.push(url);
      continue;
    }
    for (const quote of required) lines.push(`${url}\t${quote}`);
  }
  return lines.length === 0 ? "" : lines.join("\n") + "\n";
}

/** The scorecard as a person reads it. `--json` is the machine's copy. */
export function formatScorecard(card: Scorecard): string {
  const out: string[] = [];
  const keyName = card.key.name ?? "(unnamed key)";
  out.push(
    `scorecard: ${keyName} (key_version ${card.key.key_version}) vs ` +
      `${card.report.repo ?? "(unnamed repo)"} @ ${card.report.commit_sha.slice(0, 12)} ` +
      `[${card.report.mode}, ${card.report.findings} findings]`,
  );
  out.push(`verdict: ${card.verdict.toUpperCase()}`);
  out.push("");
  // Each row carries its own numbers. The text form is the default, and a
  // status word alone sends the reader to the JSON for every figure the
  // criterion was run to produce.
  const recall = card.criteria.recall.counts as Record<string, number>;
  const wall = card.criteria.wall_clock;
  const detail: Record<string, string> = {
    recall: `matched ${recall.matched}, missed ${recall.missed}, unscoreable ${recall.unscoreable} of ${recall.rows} rows`,
    precision: `extras ${String(card.criteria.precision.extras)} · matched_of_shipped ${String(card.criteria.precision.matched_of_shipped)}`,
    citations: `${String(card.criteria.citations.open ?? 0)} unopened · ${card.citation_urls.length} URLs to resolve`,
    wall_clock:
      wall.seconds === null || wall.seconds === undefined
        ? "not in the artifact"
        : `${String(wall.human)} (soft target ${String(wall.soft_target_seconds)}s), non-gating`,
    severity_drift: `${(card.criteria.severity_drift.drift as unknown[])?.length ?? 0} drifted of ${String(card.criteria.severity_drift.checked)} checked`,
  };
  for (const name of Object.keys(card.criteria)) {
    const c = card.criteria[name];
    const note = detail[name] ?? String(c.reason ?? "");
    out.push(
      `  ${String(c.id)} ${name.padEnd(24)} ${String(c.status).padEnd(15)} ${note}`.trimEnd(),
    );
  }
  const section = (title: string, lines: string[]): void => {
    if (lines.length === 0) return;
    out.push("");
    out.push(`${title} (${lines.length}):`);
    for (const line of lines) out.push(`  - ${line}`);
  };
  section("failures", card.failures);
  section(
    "unscoreable — named, not guessed",
    card.unscoreable.map((u) => `[${u.criterion}] ${u.what}: ${u.reason}`),
  );
  section(
    "needs human",
    card.needs_human.map(
      (h) =>
        `[${h.criterion}] ${h.what}: ${h.asks}` +
        (h.urls && h.urls.length > 0 ? `\n      ${h.urls.join("\n      ")}` : ""),
    ),
  );
  if (card.citation_urls.length > 0) {
    out.push("");
    out.push(`citation URLs to resolve (${card.citation_urls.length}):`);
    for (const url of card.citation_urls) out.push(`  ${url}`);
  }
  // Printed separately from the URL list, and only where a key declared one.
  // Silence here means no row asked for a quote — never that a quote was found.
  if (card.citation_quotes.length > 0) {
    out.push("");
    out.push(
      `verbatim quotes the key requires (${card.citation_quotes.length}) — ` +
        "the page must state each one:",
    );
    for (const required of card.citation_quotes) {
      out.push(`  ${required.url}`);
      out.push(`    "${required.quote}"  [${required.finding_id}]`);
    }
  }
  out.push("");
  return out.join("\n");
}

// --- commands ----------------------------------------------------------------

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf-8"));
  } catch (err) {
    process.stderr.write(`error: cannot read/parse ${file}: ${String(err)}\n`);
    process.exit(3);
  }
}

function readTextInput(file: string | null): string {
  try {
    // fd 0 = stdin when no file is given.
    return readFileSync(file ?? 0, "utf-8");
  } catch (err) {
    process.stderr.write(`error: cannot read input: ${String(err)}\n`);
    process.exit(3);
  }
}

function cmdValidate(argv: string[]): never {
  const kind = takeFlag(argv, "--kind") ?? "report";
  const file = argv[0];
  if (!file) {
    process.stderr.write(
      "usage: report_tool.ts validate [--kind report|activity|suppression|access-log] <file.json>\n",
    );
    process.exit(2);
  }
  const data = readJson(file);
  let errors: string[];
  if (kind === "activity") {
    errors = validateActivity(data);
  } else if (kind === "suppression") {
    errors = validateSuppression(data);
  } else if (kind === "access-log") {
    errors = validateAccessLog(data);
  } else if (kind === "report") {
    errors = validateReport(data);
  } else {
    process.stderr.write(
      `error: unknown --kind '${kind}' (expected report|activity|suppression|access-log)\n`,
    );
    process.exit(2);
  }

  if (errors.length === 0) {
    process.stdout.write(`ok: ${kind} valid (${file})\n`);
    process.exit(0);
  }
  process.stderr.write(`invalid ${kind} (${file}):\n`);
  for (const e of errors) process.stderr.write(`  - ${e}\n`);
  process.exit(1);
}

/**
 * A dirty report key's per-person fragment: `+u` and exactly 12 lowercase hex.
 *
 * Anchored at both ends and case-sensitive on purpose. `actorSlug` emits the
 * first 12 characters of a lowercase sha-256 digest, so anything else — an
 * uppercase spelling, a thirteenth character, a prefix that is not `+u` — is
 * not a fragment the store composed, and admitting it would let `--key` file a
 * report somewhere nobody named.
 */
const ACTOR_FRAGMENT = /^\+u[0-9a-f]{12}$/;

/**
 * Why `--key` may not stand in for the key this report composes, or `null`.
 *
 * The hosted store composes a dirty report's key from the principal it stamped
 * at write time from the *verified* token, and refuses any `put` whose key is
 * not the one it computed:
 *
 *     $.key: key does not match the record — a report key is composed from the
 *     record it files, and this body composes
 *     `<repo>@<sha>+uca0df5647e71:code-only`
 *
 * `reportKey` composes that fragment from `actor.id`, the git email the run
 * read off the local machine, so the two disagree whenever those differ — which
 * is why the first hosted write of a dirty report is refused, and why only the
 * store can say what the key is. The store refuses rather than correcting,
 * deliberately: writing under a key the caller did not ask for would silently
 * move their document. So the retry has to carry the key the refusal named, and
 * `--key` is how it does that without a model hand-editing a document this
 * command exists to emit byte for byte.
 *
 * A bare passthrough would re-open the hole from the other side — a run could
 * file a report under any key at all — so the override is admitted only where
 * the store could have disagreed. The `<repo-name>@<commit_sha>` base and the
 * trailing `:<mode>` must be this document's own, and the only thing that may
 * differ is a well-formed per-person fragment. A clean key carries no fragment,
 * so there is nothing the store could have composed differently and an override
 * there is always a mistake.
 */
export function reportKeyOverrideProblem(
  report: {
    mode: string;
    repo: { name?: string; commit_sha: string; tree_state?: TreeState };
    actor?: { id: string };
  },
  override: string,
): string | null {
  if (override === "") {
    return (
      "--key was given an empty value (unset shell variable?) — pass the key " +
      "the store quoted in its refusal, or drop the flag and file under the " +
      "key this report composes"
    );
  }
  if (report.repo.tree_state !== "dirty") {
    return (
      "--key is refused on a clean report — the key is " +
      `'${reportKey(report)}', which carries no per-person fragment, so there ` +
      "is nothing the store could have composed differently. Drop the flag."
    );
  }
  const composed = reportKey(report);
  const base = `${report.repo.name}@${report.repo.commit_sha}`;
  const tail = `:${report.mode}`;
  if (
    !override.startsWith(base) ||
    !override.endsWith(tail) ||
    override.length < base.length + tail.length
  ) {
    return (
      `--key may differ from '${composed}' in its per-person fragment and ` +
      `nowhere else, and '${override}' names a different ` +
      "<repo-name>@<commit_sha> or :<mode>. Copy the key out of the store's " +
      "refusal verbatim; if the key it named is for another repo, commit or " +
      "mode, that refusal is about a different report and this one is unfixed."
    );
  }
  const fragment = override.slice(base.length, override.length - tail.length);
  if (!ACTOR_FRAGMENT.test(fragment)) {
    return (
      "--key's per-person fragment must be '+u' followed by exactly 12 " +
      `lowercase hex characters, and '${fragment}' is not. Copy the key out of ` +
      "the store's refusal verbatim rather than composing one by hand."
    );
  }
  return null;
}

/**
 * Emit the exact `wiki_memory_put` payload for a validated report.
 *
 * The run composed the memory doc by hand, from the same findings it had just
 * written to `report.json` — and a second composition is a second chance to
 * differ. It did: a stored report carried `detectors_run` and
 * `prior_report_diff`, two fields the schema does not define and `validate`
 * refuses, because the object that was validated and the object that was
 * persisted were never the same object. Building the payload from the validated
 * file removes the step where they could diverge.
 *
 * A dirty tree is refused *by default* rather than warned about: it stores only
 * when `--allow-dirty` says a human agreed to it this run, and then under its
 * own key, `<repo>@<sha>+u<actor12>:<mode>`. The clean key `<repo>@<sha>:<mode>`
 * is the one every later run at that commit reads, so a dirty scan filed there
 * publishes one machine's uncommitted edits as the answer for that commit, to a
 * reader who never sees the tree it came from.
 *
 * `--key` replaces the composed key and changes nothing else: the document is
 * still emitted byte for byte. It exists because the hosted store composes a
 * dirty key from the principal it stamped from the verified token, refuses any
 * `put` whose key is not that one, and names the key it computed in the
 * refusal — so the retry is a re-run of this same chokepoint rather than a hand
 * edit of the emitted JSON. What it may replace is bounded by
 * `reportKeyOverrideProblem`.
 */
function cmdMemoryDoc(argv: string[]): never {
  const allowDirty = takeSwitch(argv, "--allow-dirty");
  // `takeFlag` already refuses `--key` with no value at all (exit 2); an empty
  // value reaches here and is refused below, where the reason can be said.
  const keyOverride = takeFlag(argv, "--key");
  const file = argv[0];
  if (!file) {
    process.stderr.write(
      "usage: report_tool.ts memory-doc [--allow-dirty] [--key <key>] <report.json>\n",
    );
    process.exit(2);
  }

  const data = readJson(file);
  const errors = validateReport(data);
  if (errors.length > 0) {
    process.stderr.write(`invalid report (${file}):\n`);
    for (const e of errors) process.stderr.write(`  - ${e}\n`);
    process.exit(1);
  }

  const report = data as unknown as Report;
  if (!report.repo.name) {
    process.stderr.write(
      "refusing: repo.name is absent, so this report cannot be keyed or found " +
        "again — set it, or raise schema_version to 3 where it is required\n",
    );
    process.exit(1);
  }

  // A dirty scan is storable, but only deliberately. The key admits whose edits
  // these are and the document carries the hash of them, so a later run can
  // offer them back honestly — none of which makes it right to file someone's
  // uncommitted work without them saying so. `--allow-dirty` is the run
  // asserting a human answered yes this scan; the tool cannot check that, which
  // is exactly why the default is to refuse.
  if (report.repo.tree_state === "dirty" && !allowDirty) {
    process.stderr.write(
      "refusing: repo.tree_state is 'dirty' — this scan describes uncommitted " +
        "edits, so it is stored under your own key or not at all. Ask whether to " +
        "store it; on yes, re-run with --allow-dirty. On no, export it for the " +
        "user and say the write was declined.\n",
    );
    process.exit(1);
  }

  let key: string;
  try {
    key = reportKey(report);
  } catch (err) {
    process.stderr.write(`refusing: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  if (keyOverride !== null) {
    const problem = reportKeyOverrideProblem(report, keyOverride);
    if (problem !== null) {
      process.stderr.write(`refusing: ${problem}\n`);
      process.exit(1);
    }
    key = keyOverride;
  }

  // The validated file, byte for byte — no flattening pass (see
  // `flattenRecordLines`), because a finding's evidence is multi-line on
  // purpose and re-composing the document is the step this command exists to
  // remove.
  process.stdout.write(
    JSON.stringify({ kind: "report", key, doc: report }, null, 2) + "\n",
  );
  process.exit(0);
}

function cmdMemoryLookup(argv: string[]): never {
  const repoName = takeFlag(argv, "--repo-name");
  const mode = takeFlag(argv, "--mode");
  const actorId = takeFlag(argv, "--actor");
  const treeHash = takeFlag(argv, "--tree-hash");
  const commitsFile = takeFlag(argv, "--commits");
  const file = argv[0];
  if (!file || !repoName || !mode || !commitsFile) {
    process.stderr.write(
      "usage: report_tool.ts memory-lookup --repo-name <n> --mode <m> " +
        "[--actor <id>] [--tree-hash <h>] --commits <rev-list.txt> <envelopes.json>\n",
    );
    process.exit(2);
  }

  const commits = readTextInput(commitsFile)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (commits.length === 0) {
    process.stderr.write(
      `error: ${commitsFile} holds no commits — pass 'git rev-list -n 200 HEAD'\n`,
    );
    process.exit(2);
  }

  const listed = readJson(file);
  // `wiki_memory_list` returns a page; accept a bare array too, so an older
  // capture still reads. What differs is not the entries but the claim beside
  // them: a page says whether it held everything, and an array says nothing.
  const page = asRecord(listed);
  const envelopes = Array.isArray(listed)
    ? listed
    : Array.isArray(page?.entries)
      ? (page.entries as unknown[])
      : null;
  if (!envelopes) {
    process.stderr.write(
      `error: ${file} is neither an array of envelopes nor an object with 'entries'\n`,
    );
    process.exit(2);
  }
  // Read only from a page that actually made the claim. An absent `over` is
  // `null` — unknown — and never `true`, because the completeness of a read is
  // not something this command is in a position to infer.
  const over = asRecord(page?.over);
  const readComplete = typeof over?.complete === "boolean" ? over.complete : null;
  if (readComplete === false) {
    // On stderr, not in the JSON alone: a run that pipes stdout onward would
    // otherwise carry floors labelled as counts with nothing in view saying so.
    process.stderr.write(
      `warning: ${file} is a partial read (over.complete is false) — ` +
        "'unplaceable' and 'rejected' are floors, not counts. Walk 'next_cursor' " +
        "to exhaustion before reading either as this store's history.\n",
    );
  }

  let result: LookupResult;
  try {
    result = rankStoredReports(envelopes, {
      repoName,
      mode,
      ...(actorId ? { actorId } : {}),
      ...(treeHash ? { treeHash } : {}),
      commits,
      readComplete,
    });
  } catch (err) {
    // A list result whose entries are not envelopes is a read that went wrong,
    // not a store with nothing in it, and the two must not print the same.
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  }
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(0);
}

function cmdFingerprint(argv: string[]): never {
  const detector = takeFlag(argv, "--detector");
  const path = takeFlag(argv, "--path");
  const snippetFile = takeFlag(argv, "--snippet-file");
  const asJson = takeSwitch(argv, "--json");
  // A leftover argument means a flag was misspelled. Ignoring it silently ships
  // the default (`--jsonn` → a bare id, and no snippet hash for the caller to
  // store) with a zero exit, which is exactly how a feature goes missing
  // without anything failing.
  if (!detector || !path || argv.length > 0) {
    if (argv.length > 0) {
      process.stderr.write(`error: unrecognized argument '${argv[0]}'\n`);
    }
    process.stderr.write(
      "usage: report_tool.ts fingerprint --detector <id> --path <repo-path> " +
        "[--snippet-file <f>] [--json]   (snippet on stdin if --snippet-file omitted)\n",
    );
    process.exit(2);
  }
  const snippet = readTextInput(snippetFile);
  const id = fingerprint(detector, path, snippet);
  // Bare id stays the default output so existing callers keep working; --json
  // adds the snippet hash for callers that persist it alongside the id.
  const out = asJson
    ? JSON.stringify({ id, snippet_hash: snippetHash(snippet) })
    : id;
  process.stdout.write(out + "\n");
  process.exit(0);
}

function cmdRedact(argv: string[]): never {
  const inFile = takeFlag(argv, "--in");
  const text = readTextInput(inFile);
  process.stdout.write(redact(text));
  process.exit(0);
}

function cmdExport(argv: string[]): never {
  const format = takeFlag(argv, "--format") ?? "md";
  const out = takeFlag(argv, "--out");
  const atCommit = takeFlag(argv, "--at-commit");
  const file = argv[0];
  if (!file || (format !== "md" && format !== "html")) {
    process.stderr.write(
      "usage: report_tool.ts export [--format md|html] [--out <file>] " +
        "[--at-commit <sha>] <report.json>\n",
    );
    process.exit(2);
  }
  // `--at-commit "$COMMIT"` with an unset COMMIT arrives as "". Treating it as
  // a commit renders a report finished seconds ago as STALE against a blank
  // sha; treating it as absent hides a broken caller. Refuse it.
  //
  // `isRecorded`, not `trim()`. `trim()` caught `""` and a space and stopped
  // there, so `--at-commit $'\u200b'` exited 0 and the page read
  // `Checked against: <nothing> — STALE: derived at 0000…`. That is worse than
  // the empty labels this rule was written for: the honest branch says
  // "freshness unverified", and a value that renders as nothing skips it to
  // **assert** staleness against a commit the row cannot show.
  if (atCommit !== null && !isRecorded(atCommit)) {
    process.stderr.write(
      "error: --at-commit was given an empty value (unset shell variable?)\n",
    );
    process.exit(2);
  }
  const data = readJson(file);
  // Chokepoint: never render an ungrounded or off-contract report.
  const errors = validateReport(data);
  if (errors.length > 0) {
    process.stderr.write(`refusing to export invalid report (${file}):\n`);
    for (const e of errors) process.stderr.write(`  - ${e}\n`);
    process.exit(1);
  }
  const report = data as Report;
  const opts: RenderOptions = atCommit === null ? {} : { atCommit };
  const rendered =
    format === "html" ? renderHtml(report, opts) : renderMarkdown(report, opts);
  if (out) {
    try {
      writeFileSync(out, rendered, "utf-8");
    } catch (err) {
      process.stderr.write(`error: cannot write ${out}: ${String(err)}\n`);
      process.exit(3);
    }
    process.stdout.write(`ok: wrote ${format} report to ${out}\n`);
    process.exit(0);
  }
  process.stdout.write(rendered);
  process.exit(0);
}

function cmdPrPlan(argv: string[]): never {
  const findingId = takeFlag(argv, "--finding");
  const atCommit = takeFlag(argv, "--at-commit");
  const file = argv[0];
  if (!file || !findingId) {
    process.stderr.write(
      "usage: report_tool.ts pr-plan --finding <id> [--at-commit <sha>] " +
        "<report.json>\n",
    );
    process.exit(2);
  }
  // `isRecorded`, for the reason spelled out at the `export` guard above.
  if (atCommit !== null && !isRecorded(atCommit)) {
    process.stderr.write(
      "error: --at-commit was given an empty value (unset shell variable?)\n",
    );
    process.exit(2);
  }
  const data = readJson(file);
  // Same chokepoint as export, and for a stronger reason: this text leaves the
  // machine. A report that cannot pass validate cannot open a PR.
  const errors = validateReport(data);
  if (errors.length > 0) {
    process.stderr.write(`refusing to plan a PR from an invalid report (${file}):\n`);
    for (const e of errors) process.stderr.write(`  - ${e}\n`);
    process.exit(1);
  }
  const report = data as Report;
  const problems = prEligibilityProblems(report, findingId);
  if (problems.length > 0) {
    process.stderr.write("refusing to open a PR for this finding:\n");
    for (const p of problems) process.stderr.write(`  - ${p}\n`);
    process.exit(1);
  }
  const opts: RenderOptions = atCommit === null ? {} : { atCommit };
  process.stdout.write(
    JSON.stringify(buildPrPlan(report, findingId, opts), null, 2) + "\n",
  );
  process.exit(0);
}

function cmdPrGuard(argv: string[]): never {
  // Repeatable: one --expect per path the fix declares. A fix that legitimately
  // spans two files says so twice rather than being waved through by a wildcard.
  const expected: string[] = [];
  for (;;) {
    const path = takeFlag(argv, "--expect");
    if (path === null) break;
    expected.push(path);
  }
  // The other half of "no writes outside the PR branch". Deliberately *not* a
  // value this tool trusts on its own: it is compared against the `-b` header
  // git wrote into the same stdin the paths came from. A flag naming the branch
  // the run believes it is on would let the run assert its own compliance.
  const expectedBranch = takeFlag(argv, "--expect-branch");
  const inFile = takeFlag(argv, "--in");
  // A leftover argument means a flag was misspelled, and `fingerprint` and
  // `score` both refuse one for the reason that bites hardest here: this is the
  // command whose whole purpose is stopping a run from vouching for itself.
  // `--expect-branchh teammate/fix-x` dropped the branch half entirely and
  // printed `ok: only the declared paths changed` — exit 0 — on a worktree
  // sitting on `master`, which is precisely the "skipping `git checkout -b`"
  // failure named at the bottom of this function.
  if (argv.length > 0) {
    process.stderr.write(`error: unrecognized argument '${argv[0]}'\n`);
    process.exit(2);
  }
  if (expected.length === 0) {
    process.stderr.write(
      "usage: report_tool.ts pr-guard --expect <path> [--expect <path>…] " +
        "[--expect-branch <name>] [--in <status.txt>]\n" +
        "  git status --porcelain on stdin; --expect-branch also needs `-b`, " +
        "which is what puts the branch in that output\n",
    );
    process.exit(2);
  }
  if (expectedBranch !== null && !isRecorded(expectedBranch)) {
    // Same reason `--at-commit ""` is refused: an unset `$BRANCH` would
    // otherwise ask this guard to hold the tree to a branch named nothing.
    // This is the quoted spelling, `--expect-branch ""`; the unquoted one,
    // where the value never reaches argv at all, is refused by `takeFlag` for
    // every flag that takes a value. Reading either as "no branch was expected"
    // skipped the check the caller asked for and printed the path-only green
    // over it, on a worktree that was on `master`.
    process.stderr.write(
      "error: --expect-branch was given an empty value (unset shell variable?)\n",
    );
    process.exit(2);
  }
  let problems: string[];
  try {
    problems = prGuardProblems(
      readTextInput(inFile),
      expected,
      expectedBranch ?? undefined,
    );
  } catch (err) {
    // A tree this guard cannot read is not a tree it may pass. Parsing gave up,
    // so the answer is "look yourself", never "nothing else changed".
    process.stderr.write(`refusing to vouch for this worktree: ${String(err)}\n`);
    process.exit(1);
  }
  if (problems.length > 0) {
    process.stderr.write("worktree does not match what this fix declared:\n");
    for (const p of problems) process.stderr.write(`  - ${p}\n`);
    process.exit(1);
  }
  // Says only what was checked. Without `--expect-branch` the branch was never
  // read, so a line claiming one would be the run vouching for itself again.
  process.stdout.write(
    expectedBranch === null
      ? "ok: only the declared paths changed\n"
      : `ok: only the declared paths changed, on branch '${expectedBranch}'\n`,
  );
  process.exit(0);
}

function cmdLog(argv: string[]): never {
  const file = takeFlag(argv, "--file");
  const kind = takeFlag(argv, "--kind");
  const value = takeFlag(argv, "--value");
  const note = takeFlag(argv, "--note");
  if (!file || !kind || !value) {
    process.stderr.write(
      "usage: report_tool.ts log --file <f> --kind read|endpoint|git --value <v> [--note <n>]\n",
    );
    process.exit(2);
  }
  if (!(LOG_KINDS as readonly string[]).includes(kind)) {
    process.stderr.write(
      `error: unknown --kind '${kind}' (expected ${LOG_KINDS.join("|")})\n`,
    );
    process.exit(2);
  }
  try {
    appendLogLine(file, note ? { kind, value, note } : { kind, value });
  } catch (err) {
    process.stderr.write(`error: cannot append to ${file}: ${String(err)}\n`);
    process.exit(3);
  }
  process.exit(0);
}

/**
 * The exit code for a scorecard that could not be completed.
 *
 * Its own code, not a reused one: `0` would report a run as scored when part of
 * it was never checked, and `1` would report a refusal the harness did not
 * make. A caller gating on `score` gates on `0`; a caller collecting what still
 * needs a human reads `4` and the `needs_human` array.
 */
const EXIT_INCOMPLETE = 4;

/**
 * Score an exported report against a scoring key.
 *
 * Validates first, like `export` and `pr-plan`, and for the same reason: a
 * report that cannot pass `validate` has no shape to score, and a scorecard
 * built off one would put numbers on a document the chokepoint refuses.
 *
 * The key is checked too, and refused rather than read leniently — a `must_fire`
 * row missing the fields the site join is built from produces a scorecard about
 * nothing, and the honest failure is the one at the input.
 *
 * `--urls-out` writes the citation manifest as plain lines, which is what makes
 * the resolver half a pipe rather than a script:
 *
 *     report_tool.ts score --key K --urls-out - R.json | uv run linkcheck --urls -
 *
 * `-` sends the manifest to stdout, and the scorecard to **stderr** so the pipe
 * carries URLs and nothing else. The scorecard is moved, never dropped: a run
 * whose gate output vanished into a pipe would be a check nobody read.
 */
function cmdScore(argv: string[]): never {
  const keyFile = takeFlag(argv, "--key");
  const urlsOut = takeFlag(argv, "--urls-out");
  const asJson = takeSwitch(argv, "--json");
  const file = argv[0];
  // A leftover positional means a flag was misspelled — `--jsonn` would
  // otherwise print the text summary and exit as if the caller had asked for it.
  if (!keyFile || !file || argv.length > 1) {
    if (argv.length > 1) {
      process.stderr.write(`error: unrecognized argument '${argv[1]}'\n`);
    }
    process.stderr.write(
      "usage: report_tool.ts score --key <key.json> [--json] [--urls-out <file|->] " +
        "<report.json>\n",
    );
    process.exit(2);
  }

  const keyData = readJson(keyFile);
  const keyErrors = scoringKeyProblems(keyData);
  if (keyErrors.length > 0) {
    process.stderr.write(`refusing to score against this key (${keyFile}):\n`);
    for (const e of keyErrors) process.stderr.write(`  - ${e}\n`);
    process.exit(1);
  }

  const data = readJson(file);
  const errors = validateReport(data);
  if (errors.length > 0) {
    process.stderr.write(`refusing to score an invalid report (${file}):\n`);
    for (const e of errors) process.stderr.write(`  - ${e}\n`);
    process.exit(1);
  }

  const card = scoreReport(data as Report, keyData as ScoringKey);
  const scorecard = asJson ? JSON.stringify(card, null, 2) + "\n" : formatScorecard(card);
  if (urlsOut === null) {
    process.stdout.write(scorecard);
  } else if (urlsOut === "-") {
    process.stderr.write(scorecard);
    process.stdout.write(citationUrlManifest(card));
  } else {
    process.stdout.write(scorecard);
    try {
      writeFileSync(urlsOut, citationUrlManifest(card), "utf-8");
    } catch (err) {
      process.stderr.write(`error: cannot write ${urlsOut}: ${String(err)}\n`);
      process.exit(3);
    }
  }
  if (card.verdict === "pass") process.exit(0);
  if (card.verdict === "fail") process.exit(1);
  process.exit(EXIT_INCOMPLETE);
}

function usage(): never {
  process.stderr.write(
    [
      "report_tool.ts — teammate deterministic chokepoint",
      "",
      "commands:",
      "  validate [--kind report|activity|suppression|access-log] <f.json>  schema-check",
      "  memory-doc [--allow-dirty] <report.json>            exact wiki_memory_put payload",
      "  memory-lookup --repo-name <n> --mode <m> [--actor <id>] [--tree-hash <h>]",
      "                --commits <rev-list.txt> <envelopes.json>  rank stored reports",
      "  fingerprint --detector <id> --path <p> [--snippet-file <f>] [--json]  finding id",
      "  redact [--in <file>]                                strip secrets (stdin/text)",
      "  export [--format md|html] [--out <f>] [--at-commit <sha>] <report.json>",
      "                                                      render a valid report",
      "  pr-plan --finding <id> [--at-commit <sha>] <report.json>",
      "                                                      branch/title/body for the one fix",
      "  pr-guard --expect <path> [--expect <path>…] [--expect-branch <n>] [--in <f>]",
      "                                                      git status --porcelain -b vs the fix",
      "  log --file <f> --kind read|endpoint|git --value <v> [--note <n>]  append log",
      "  score --key <key.json> [--json] [--urls-out <file|->] <report.json>",
      "                                                      score a run against a key",
      "                                                      (0 pass · 1 fail · 4 incomplete);",
      "                                                      --urls-out writes the plain",
      "                                                      citation manifest a resolver",
      "                                                      reads; `-` is stdout, and the",
      "                                                      scorecard moves to stderr",
      "",
    ].join("\n") + "\n",
  );
  process.exit(2);
}

// --- arg helpers + dispatch --------------------------------------------------

/**
 * A valueless flag: removed from `argv` so it never reads as a positional.
 *
 * The only one. `takeBool` was a byte-identical second copy of this body under
 * a name from a different axis — `takeFlag`/`takeBool` reads as a distinction
 * of return type, where the distinction that matters is whether the flag takes
 * a value — and one caller used one while two used the other.
 */
function takeSwitch(argv: string[], flag: string): boolean {
  const i = argv.indexOf(flag);
  if (i === -1) return false;
  argv.splice(i, 1);
  return true;
}

/**
 * Remove `--flag value` from argv in place and return value, or null.
 *
 * `null` says one thing and only one: nobody wrote the flag. A flag that
 * reached argv without its value is not that — it is a caller who asked for
 * something and lost the answer in the shell — and every optional flag here
 * reads `null` as *not asked for*. Answering `null` to both made each of them
 * run a different command than the one the caller wrote, at exit 0:
 * `--at-commit "$COMMIT"` on an unset variable rendered a report
 * `freshness unverified` and shipped a PR body with no STALE line;
 * `--snippet-file "$F"` read empty stdin and derived a well-formed id from
 * nothing, which then keys a suppression; `redact --in "$F"` wrote zero bytes
 * over the chokepoint that exists to strip secrets. So the refusal lives here,
 * once, rather than at the call sites: `takeSwitch` is the helper for a flag
 * that takes no value, and every caller of this one needs the value it asked
 * for.
 *
 * A value that itself looks like a flag lands in the same place, and did
 * before: `--path --json` used to swallow the next flag and fingerprint the
 * literal path `--json`, turning a typo into a plausible-looking id — the same
 * asserted-instead-of-derived failure the id exists to rule out.
 */
function takeFlag(argv: string[], flag: string): string | null {
  const i = argv.indexOf(flag);
  if (i === -1) return null;
  const value = argv[i + 1];
  if (value === undefined || value.startsWith("--")) {
    process.stderr.write(
      `error: ${flag} is on the command line and its value is not ` +
        "(unset shell variable?)\n" +
        `usage: ${flag} <value>\n`,
    );
    process.exit(2);
  }
  argv.splice(i, 2);
  return value;
}

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) usage();
  switch (cmd) {
    case "validate":
      cmdValidate(rest);
      break;
    case "memory-doc":
      cmdMemoryDoc(rest);
      break;
    case "memory-lookup":
      cmdMemoryLookup(rest);
      break;
    case "fingerprint":
      cmdFingerprint(rest);
      break;
    case "redact":
      cmdRedact(rest);
      break;
    case "export":
      cmdExport(rest);
      break;
    case "pr-plan":
      cmdPrPlan(rest);
      break;
    case "pr-guard":
      cmdPrGuard(rest);
      break;
    case "log":
      cmdLog(rest);
      break;
    case "score":
      cmdScore(rest);
      break;
    default:
      process.stderr.write(`error: unknown command '${cmd}'\n`);
      usage();
  }
}

// Run the CLI only when executed directly (`npx tsx report_tool.ts …`). Node
// realpaths import.meta.url, so argv[1] is realpath-resolved too before the
// compare — otherwise a symlinked invocation path (e.g. a target that symlinks
// `skills/`) would fail the check and silently skip the chokepoint. Failing
// that way is fail-OPEN: a redact/validate call that no-ops and exits 0. When
// imported by the vitest lane, argv[1] is the test runner, so main() stays put.
function isDirectEntry(): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(invoked)).href;
  } catch {
    return false;
  }
}

if (isDirectEntry()) {
  main();
}

export type {
  Report,
  Finding,
  Citation,
  Surface,
  SurfaceCapability,
  CallSite,
  ConfigEdge,
  ActivityEntry,
  Suppression,
  Provenance,
  RenderOptions,
  ScoringKey,
  KeyRow,
  Scorecard,
};
