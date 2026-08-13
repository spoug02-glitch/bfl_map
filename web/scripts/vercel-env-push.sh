#!/usr/bin/env bash
# Push .env.local into a linked Vercel project.
#
# Usage (from Bfl_map/web, after `vercel login` and `vercel link`):
#   bash scripts/vercel-env-push.sh production
#   bash scripts/vercel-env-push.sh preview
#
# Values are piped straight from .env.local so nothing is retyped or echoed.
# NEXT_PUBLIC_BASE_URL is deliberately skipped: locally it is localhost:3000,
# but the deployment needs its real domain, so set that one by hand afterwards.
set -euo pipefail

TARGET="${1:-production}"
ENV_FILE="$(dirname "$0")/../.env.local"

[ -f "$ENV_FILE" ] || { echo "no .env.local at $ENV_FILE" >&2; exit 1; }

# Keep this list in sync with .env.example. A variable missing here does not
# fail the build — the feature that needs it just breaks in production.
VARS=(
  NEXT_PUBLIC_KAKAO_JS_KEY   # map rendering + KakaoTalk share
  KAKAO_REST_API_KEY         # Kakao login (Kakao uses the REST key as client_id)
  KAKAO_CLIENT_SECRET        # only if the Kakao app has client secret enabled
  SESSION_SECRET
  DATABASE_URL
  ADMIN_USER_ID
)

for name in "${VARS[@]}"; do
  value="$(grep -E "^${name}=" "$ENV_FILE" | head -1 | cut -d= -f2-)"
  if [ -z "$value" ]; then
    echo "skip  $name (empty in .env.local)"
    continue
  fi
  # remove an existing value first so re-running this script is safe
  npx vercel env rm "$name" "$TARGET" --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | npx vercel env add "$name" "$TARGET" >/dev/null
  echo "set   $name -> $TARGET"
done

echo
echo "Remaining by hand:"
echo "  npx vercel env add NEXT_PUBLIC_BASE_URL $TARGET   # https://<배포도메인>"
