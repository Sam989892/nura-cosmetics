#!/usr/bin/env bash
# NURA — autosave rollback helper
# ────────────────────────────────
# Lists recent autosave tags and lets you restore the working tree to one.
# Always defaults to a SOFT reset (preserves uncommitted work in the index)
# so nothing is lost. Pass --hard if you really want to discard.
#
# Usage:
#   scripts/rollback.sh                # interactive picker, soft reset
#   scripts/rollback.sh --list         # just show available autosaves
#   scripts/rollback.sh autosave/2026-05-14-153045
#   scripts/rollback.sh --hard autosave/2026-05-14-153045
#   scripts/rollback.sh --diff autosave/2026-05-14-153045

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

MODE="soft"
TARGET=""
ACTION="restore"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hard)  MODE="hard"; shift ;;
    --soft)  MODE="soft"; shift ;;
    --list)  ACTION="list"; shift ;;
    --diff)  ACTION="diff"; shift ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    autosave/*)
      TARGET="$1"; shift ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

list_tags() {
  git for-each-ref --sort=-creatordate \
    --format='%(refname:short)  %(creatordate:short) %(creatordate:format:%H:%M:%S)  %(subject)' \
    refs/tags/autosave/ | head -30
}

if [[ "$ACTION" == "list" ]]; then
  echo "Recent autosaves (newest first):"
  list_tags
  exit 0
fi

if [[ -z "$TARGET" ]]; then
  echo "Recent autosaves:"
  echo
  list_tags
  echo
  echo -n "Restore which tag? (paste full tag name, or blank to cancel) > "
  read -r TARGET
  if [[ -z "$TARGET" ]]; then
    echo "Cancelled."
    exit 0
  fi
fi

if ! git rev-parse --verify --quiet "$TARGET" >/dev/null; then
  echo "Tag not found: $TARGET" >&2
  echo "Run: scripts/rollback.sh --list" >&2
  exit 1
fi

if [[ "$ACTION" == "diff" ]]; then
  git --no-pager diff "$TARGET"..HEAD
  exit 0
fi

CURRENT=$(git rev-parse --short HEAD)
echo
echo "Rollback target : $TARGET"
echo "Current HEAD    : $CURRENT"
echo "Reset mode      : $MODE"
echo
if [[ "$MODE" == "hard" ]]; then
  echo "⚠  --hard will DISCARD all uncommitted changes AND throw away"
  echo "   every commit between HEAD and the target. This is destructive."
else
  echo "ℹ  --soft keeps everything you've done since the target as staged"
  echo "   changes. Nothing is lost."
fi
echo
echo -n "Proceed? (type 'yes' to confirm) > "
read -r CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Cancelled."
  exit 0
fi

# Safety: create a savepoint tag of the current HEAD so even a --hard
# reset can be undone by hand later (git reset --hard <savepoint>).
SAVEPOINT="rollback-savepoint/$(date +%Y-%m-%d-%H%M%S)"
git tag "$SAVEPOINT" HEAD
echo "Savepoint created: $SAVEPOINT (push with: git push origin $SAVEPOINT)"

git reset "--$MODE" "$TARGET"

echo
echo "✓ Restored to $TARGET (mode: $MODE)"
echo
echo "If something looks wrong, restore the savepoint:"
echo "  git reset --hard $SAVEPOINT"
