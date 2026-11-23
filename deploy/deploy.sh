#!/usr/bin/env bash
# Deploys origin/main on the server. CI runs it over SSH with a deploy key that is
# locked to this script (see deploy/README.md). Safe to run by hand too.
#
# Everything is inside main() so bash parses the whole file before git rewrites it.
set -euo pipefail

main() {
  local repo branch compose
  repo="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
  branch="${DEPLOY_BRANCH:-main}"
  cd "$repo"
  compose="docker compose -f docker-compose.prod.yml"

  # One deploy at a time.
  exec 9>/tmp/pitch-deploy.lock
  flock -w 600 9

  echo "==> syncing $repo to origin/$branch"
  git fetch --prune origin "$branch"
  git reset --hard "origin/$branch"
  git clean -fd   # untracked files go; ignored ones (.env) stay
  echo "    at $(git log --oneline -1)"

  echo "==> building and starting containers"
  $compose up -d --build --remove-orphans

  echo "==> health check"
  local ok=""
  for _ in $(seq 1 60); do
    if curl -fsS http://127.0.0.1:8000/health >/dev/null && curl -fsS -o /dev/null http://127.0.0.1:8080/; then
      ok=1; break
    fi
    sleep 2
  done
  if [ -z "$ok" ]; then
    echo "!! health check failed"
    $compose ps
    $compose logs --tail 50 api
    exit 1
  fi

  docker image prune -f >/dev/null
  echo "==> deployed $(git rev-parse --short HEAD)"
}

main "$@"
exit
