#!/usr/bin/env bash
# Runs the floor guard on every commit of a push or pull request, each against its parent and with
# its own message (so a `Floor-Test-Change` trailer only covers the commit that carries it).
# Usage: scripts/ci-floor-guard.sh <base-sha> [tip-sha]
# Merge commits are skipped: their diff is the whole PR under a message without the trailers of
# the commits inside it (M8 review). Each of those commits is checked on its own instead.
# An all-zero or unknown base (a new branch, a force-push) falls back to the merge base with
# origin/main when there is one, else to the tip alone.
set -euo pipefail

base="${1:-}"
tip="$(git rev-parse "${2:-HEAD}")"
empty_tree="$(git hash-object -t tree /dev/null)"
if [[ -z "$base" || "$base" =~ ^0+$ ]] || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  base="$(git merge-base origin/main "$tip" 2>/dev/null || true)"
fi
if [[ -n "$base" ]]; then
  commits="$(git rev-list --reverse --no-merges "${base}..${tip}")"
else
  commits="$(git rev-list --no-merges -n 1 "$tip")"
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
