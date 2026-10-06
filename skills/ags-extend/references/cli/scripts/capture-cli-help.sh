#!/usr/bin/env bash
# Re-capture `ags --help` and `ags extend --help` output as the skill's
# grounding artifact.
#
# Run this whenever a new `ags` release ships with Extend-surface changes.
# The output replaces references/cli/help-output.md, which the rest of the
# skill defers to.
#
# Usage:
#   bash capture-cli-help.sh
#
# Requires `ags` on PATH (install via /ags install-cli first).

set -euo pipefail

if ! command -v ags >/dev/null 2>&1; then
  echo "ags not found on PATH. Install it first (see /ags install-cli)." >&2
  exit 1
fi

OUT="$(dirname "$0")/../help-output.md"
VERSION="$(ags --version 2>&1 | tr -d '\r')"

{
  echo "---"
  echo "last-verified: $(date -u +%Y-%m-%d)"
  echo "authoritative: true"
  echo "note: --help output captured from an installed \`ags\` binary ($VERSION)."
  echo "  This is the ground-truth grounding artifact every other CLI claim in"
  echo "  this skill defers to."
  echo "sources:"
  echo "- https://github.com/AccelByte/accelbyte-ags-cli"
  echo "see-also:"
  echo "- '[cli-commands.md](../deploy/cli-commands.md)'"
  echo "grounding: grounded"
  echo "---"
  echo
  echo "# \`ags extend\` — \`--help\` output (authoritative grounding artifact)"
  echo
  echo "Captured: $(date -u +%Y-%m-%d). Source: installed binary, \`$VERSION\`."
  echo
  echo "This file is the output of \`ags --help\` (the global flags every command accepts) and of \`ags extend --help\` for every subcommand, and the ground truth for CLI syntax — \`references/deploy/cli-commands.md\` is its readable restatement."
  echo
  echo "## \`ags\` (global flags)"
  echo
  echo '```'
  ags --help 2>&1
  echo '```'
  echo
  echo "## Top-level"
  echo
  echo '```'
  ags extend --help 2>&1
  echo '```'

  # Capture all top-level commands
  for cmd in $(ags extend --help 2>&1 | awk '/^Commands:/{f=1;next} /^Options:/{f=0} f{print $1}'); do
    echo
    echo "## \`ags extend $cmd\`"
    echo
    echo '```'
    help_output=$(ags extend "$cmd" --help 2>&1)
    echo "$help_output"
    echo '```'

    # Check if this command has subcommands and recurse
    if echo "$help_output" | grep -q "^Commands:"; then
      # Extract subcommand names from this command's help output
      for subcmd in $(echo "$help_output" | awk '/^Commands:/{f=1;next} /^Options:/{f=0} f{print $1}'); do
        echo
        echo "## \`ags extend $cmd $subcmd\`"
        echo
        echo '```'
        ags extend "$cmd" "$subcmd" --help 2>&1
        echo '```'
      done
    fi
  done
} > "$OUT"

echo "Wrote $OUT ($(wc -l < "$OUT") lines)"
