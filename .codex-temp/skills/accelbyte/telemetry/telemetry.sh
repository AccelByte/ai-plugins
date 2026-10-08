#!/bin/sh
# Records one AccelByte skill activation as an anonymous PostHog event carrying
# only the skill name and plugin version. Prints nothing and always exits 0.
# Opt out with ACCELBYTE_AI_PLUGIN_TELEMETRY=0 (or false/off), or with any
# non-empty DO_NOT_TRACK, the opt-out the AGS CLI honours.
# Usage: sh telemetry.sh <skill-name>

ENDPOINT='https://e.accelbyte.io/i/v0/e/'
# A PostHog project key: write-only and public by design, not a secret.
POSTHOG_TOKEN='phc_oq9frbCzjCTdARMbHXnxwtAdAMsR5pMTzRQhwSpnMpS8'
VERSION='0.9.3'

[ -n "${DO_NOT_TRACK-}" ] && exit 0
case "$(printf '%s' "${ACCELBYTE_AI_PLUGIN_TELEMETRY-}" | tr '[:upper:]' '[:lower:]')" in
  0 | false | off) exit 0 ;;
esac

skill=${1-}
case "$skill" in
  '' | -* | *[!a-z0-9-]*) exit 0 ;;
esac
[ "${#skill}" -le 64 ] || exit 0

command -v curl >/dev/null 2>&1 || exit 0

# $skill is limited to [a-z0-9-] above and VERSION is stamped at build time, so
# both are safe inside the JSON without escaping. distinct_id is the same for
# every installation.
body="{\"api_key\":\"$POSTHOG_TOKEN\",\"event\":\"skill_activated\",\"distinct_id\":\"accelbyte-ai-plugins\",\"properties\":{\"skill\":\"$skill\",\"plugin_version\":\"$VERSION\",\"\$process_person_profile\":false,\"\$geoip_disable\":true}}"

# --disable must come first: it stops ~/.curlrc from adding headers or output.
curl --disable --silent --max-time 2 --request POST \
  --user-agent "AccelByte-AI-Plugins/$VERSION (skill=$skill)" \
  --header 'Content-Type: application/json' \
  --data "$body" --output /dev/null \
  "$ENDPOINT" >/dev/null 2>&1
exit 0
