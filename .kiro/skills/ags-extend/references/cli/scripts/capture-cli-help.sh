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

# After a parent that only lists subcommands, capture nested --help immediately.
nested_after() {
  case "$1" in
    logs) echo "stream" ;;
  esac
}

{
  echo "---"
  echo "last-verified: $(date -u +%Y-%m-%d)"
  echo "authoritative: true"
  echo "note: --help output captured from the extend-helper-cli binary, as captured except"
  echo "  for the one host-specific default noted in the body. This is the ground-truth"
  echo "  grounding artifact every other CLI claim in this skill defers to."
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
  echo "This file is the output of \`extend-helper-cli --help\` for every subcommand, and the ground truth for CLI syntax — \`references/deploy/cli-commands.md\` is its readable restatement."
  echo
  echo "One substitution: \`--ssh-path\` prints a default built from the home directory of whoever runs it, so the capture host's own path is replaced with \`~/.ssh/id_rsa\`. On your machine the CLI prints yours. Everything else is as captured."
  echo
  echo "## Top-level"
  echo
  echo '```'
  "$BIN" --help 2>&1
  echo '```'
  for cmd in dockerlogin image-upload create-app get-app-info list-images deploy-app start-app stop-app delete-app update-var update-secret clone-template tunnel remote-debug logs login logout status appui; do
    echo
    echo "## \`$cmd\`"
    echo
    echo '```'
    "$BIN" "$cmd" --help 2>&1
    echo '```'
    while IFS= read -r sub; do
      [[ -z "$sub" ]] && continue
      echo
      echo "## \`$cmd $sub\`"
      echo
      echo '```'
      "$BIN" "$cmd" "$sub" --help 2>&1
      echo '```'
    done < <(nested_after "$cmd")
  done
} > "$OUT"

# The CLI's --ssh-path default is $HOME/.ssh/id_rsa of the capture host.
# Replace it with a host-neutral example so usernames never ship.
sed -i -E 's|(--ssh-path value[[:space:]]+SSH private key path \(default: ")[^"]+("\))|\1~/.ssh/id_rsa\2|' "$OUT"

rm -f "$BIN"
echo "Wrote $OUT ($(wc -l < "$OUT") lines)"
