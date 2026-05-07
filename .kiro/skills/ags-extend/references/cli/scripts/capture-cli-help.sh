#!/usr/bin/env bash
# Re-capture the extend-helper-cli --help output as the skill's grounding artifact.
#
# Run this whenever a new extend-helper-cli release ships. The output replaces
# references/cli/help-output.md, which the rest of the skill defers to.
#
# Usage:
#   bash capture-cli-help.sh [arch]
#
# arch defaults to your current uname -m (linux only). Pass darwin_arm64,
# darwin_amd64, linux_amd64, linux_arm64, or windows_amd64.exe to override.

set -euo pipefail

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$(uname -m)" in
  x86_64) ARCH_DEFAULT="${OS}_amd64" ;;
  aarch64|arm64) ARCH_DEFAULT="${OS}_arm64" ;;
  *) echo "Unknown arch $(uname -m); pass arch as first arg." >&2; exit 1 ;;
esac

ARCH="${1:-$ARCH_DEFAULT}"
URL="https://github.com/AccelByte/extend-helper-cli/releases/latest/download/extend-helper-cli-${ARCH}"
BIN="$(mktemp)"

echo "Downloading $URL"
curl -fsSL -o "$BIN" "$URL"
chmod +x "$BIN"

OUT="$(dirname "$0")/../help-output.md"

{
  echo "---"
  echo "last-verified: $(date -u +%Y-%m-%d)"
  echo "authoritative: true"
  echo "note: Verbatim --help output captured from the extend-helper-cli binary. This is the"
  echo "  ground-truth grounding artifact every other CLI claim in this skill defers to."
  echo "sources:"
  echo "- https://github.com/AccelByte/extend-helper-cli"
  echo "see-also:"
  echo "- '[cli-commands.md](../deploy/cli-commands.md)'"
  echo "grounding: grounded"
  echo "---"
  echo
  echo "# extend-helper-cli — \`--help\` output (authoritative grounding artifact)"
  echo
  echo "Captured: $(date -u +%Y-%m-%d). Source: \`$URL\`."
  echo
  echo "This file is the verbatim output of \`extend-helper-cli --help\` for every subcommand. It is the ground truth for the skill — \`references/deploy/cli-commands.md\` is its skill-friendly restatement; this file is the unedited source."
  echo
  echo "## Top-level"
  echo
  echo '```'
  "$BIN" --help 2>&1
  echo '```'
  for cmd in dockerlogin image-upload create-app get-app-info deploy-app start-app stop-app delete-app update-var update-secret clone-template tunnel login logout status; do
    echo
    echo "## \`$cmd\`"
    echo
    echo '```'
    "$BIN" "$cmd" --help 2>&1
    echo '```'
  done
} > "$OUT"

rm -f "$BIN"
echo "Wrote $OUT ($(wc -l < "$OUT") lines)"
