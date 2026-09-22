#!/usr/bin/env bash
# Deploys the dev walking skeleton end-to-end, repeatably:
#   1. Trigger a Render deploy of apps/api (training-plan-api-dev) via the
#      Render REST API and poll until it's live.
#   2. Build apps/web against apps/web/.env.production.
#   3. Deploy the build to Cloudflare Pages (training-plan-web-dev) via
#      `wrangler pages deploy` — not Cloudflare's git-integration
#      auto-deploy.
#   4. curl the live health-check chain (API directly, then the API as seen
#      from the deployed web origin via CORS) as this script's own proof of
#      success, not just "the commands exited 0."
#
# Neither Render nor Cloudflare deploys here are triggered by CI or a git
# push — both are explicit, scripted triggers, matching render.yaml's
# `autoDeploy: false` and the Pages project's direct-upload (not
# git-integration) setup. See docs/decisions/0002-web-app-stack.md and
# docs/architecture.md.
#
# Requires:
#   - RENDER_API_KEY   — Render account API key (Dashboard > Account
#                         Settings > API Keys). Not committed; export it in
#                         your shell or an untracked .env you source
#                         yourself before running this script.
#   - RENDER_SERVICE_ID — the training-plan-api-dev service's ID (srv-...),
#                         from the Render dashboard once the service exists,
#                         or `render services list` after `render login`.
#   - wrangler installed and authenticated (`wrangler whoami`) — already the
#     case on a machine that's deployed apps/web before.
#
# One-time prerequisite this script does NOT do for you: the
# training-plan-api-dev Render Web Service has to already exist (Render
# Blueprint sync from render.yaml is a one-time, GitHub-App-authorized
# dashboard action — see docs/architecture.md for exactly what's needed),
# and WEB_APP_ORIGIN has to already be set as a Render env var pointing at
# this Pages project's URL.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

API_URL="https://training-plan-api-dev.onrender.com"
PAGES_PROJECT="training-plan-web-dev"
PAGES_URL="https://${PAGES_PROJECT}.pages.dev"
RENDER_API="https://api.render.com/v1"

: "${RENDER_API_KEY:?Set RENDER_API_KEY (Render Dashboard > Account Settings > API Keys) before running this script.}"
: "${RENDER_SERVICE_ID:?Set RENDER_SERVICE_ID (the training-plan-api-dev service ID, srv-...) before running this script.}"

echo "==> Triggering a Render deploy of ${RENDER_SERVICE_ID}..."
DEPLOY_RESPONSE=$(curl -sf -X POST \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"clearCache":"do_not_clear"}' \
  "${RENDER_API}/services/${RENDER_SERVICE_ID}/deploys")
DEPLOY_ID=$(echo "$DEPLOY_RESPONSE" | node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0,"utf8")).id)')
echo "    Deploy ${DEPLOY_ID} started."

echo "==> Polling deploy status (Render free-tier cold builds can take a few minutes)..."
STATUS=""
for _ in $(seq 1 60); do
  STATUS=$(curl -sf \
    -H "Authorization: Bearer ${RENDER_API_KEY}" \
    "${RENDER_API}/services/${RENDER_SERVICE_ID}/deploys/${DEPLOY_ID}" \
    | node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0,"utf8")).status)')
  echo "    status: ${STATUS}"
  case "$STATUS" in
    live) break ;;
    build_failed|update_failed|canceled|deactivated)
      echo "!! Render deploy ${DEPLOY_ID} ended in status '${STATUS}'." >&2
      exit 1
      ;;
  esac
  sleep 10
done

if [ "$STATUS" != "live" ]; then
  echo "!! Timed out waiting for deploy ${DEPLOY_ID} to go live (last status: ${STATUS})." >&2
  exit 1
fi
echo "    Render deploy is live: ${API_URL}"

echo "==> Building apps/web against apps/web/.env.production..."
pnpm --filter @training-plan/web build

echo "==> Deploying apps/web/dist to Cloudflare Pages (${PAGES_PROJECT})..."
wrangler pages deploy apps/web/dist --project-name "$PAGES_PROJECT" --branch main --commit-dirty=true

echo "==> Verifying the live health-check chain..."
echo "    GET ${API_URL}/health"
curl -sf "${API_URL}/health"
echo

echo "    GET ${API_URL}/health with Origin: ${PAGES_URL} (the cross-origin call apps/web's JS makes)"
CORS_HEADERS=$(curl -sf -i -H "Origin: ${PAGES_URL}" "${API_URL}/health")
echo "$CORS_HEADERS" | grep -i "access-control-allow-origin" || {
  echo "!! No access-control-allow-origin header for Origin ${PAGES_URL} — check WEB_APP_ORIGIN on Render." >&2
  exit 1
}

echo "    GET ${PAGES_URL}/"
curl -sf -o /dev/null -w "    -> HTTP %{http_code}\n" "${PAGES_URL}/"

echo "==> Done. apps/web: ${PAGES_URL}  apps/api: ${API_URL}"
