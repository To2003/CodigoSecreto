#!/usr/bin/env bash
# Runs the floor guard on every commit of a push or pull request, each against its parent and with
# its own message (so a `Floor-Test-Change` trailer only covers the commit that carries it).
# Usage: scripts/ci-floor-guard.sh <base-sha>   (an all-zero or unknown base checks only HEAD)
set -euo pipefail

base="${1:-}"
empty_tree="$(git hash-object -t tree /dev/null)"
if [[ -z "$base" || "$base" =~ ^0+$ ]] || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  commits="$(git rev-parse HEAD)"
else
  commits="$(git rev-list --reverse "${base}..HEAD")"
fi

head="$(git rev-parse HEAD)"
msg="$(mktemp)"
status=0
for c in $commits; do
  git checkout -q "$c"
  parent="$(git rev-parse -q --verify "${c}^" || echo "$empty_tree")"
  git log -1 --format=%B "$c" > "$msg"
  echo "── floor guard: $(git log -1 --format='%h %s' "$c")"
  node scripts/floor-guard.mjs --base "$parent" --commit-msg "$msg" || status=1
done
git checkout -q "$head"
rm -f "$msg"
exit "$status"
