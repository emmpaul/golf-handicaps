#!/bin/sh
set -eu

case "${1:-history}" in
  index)
    found=$(git ls-files --cached -- docs/imarcom-core)
    ;;
  history)
    found=$(git log --format=%H HEAD --branches --tags -- docs/imarcom-core)
    ;;
  *)
    echo "Usage: $0 [index|history]" >&2
    exit 2
    ;;
esac

if [ -n "$found" ]; then
  echo "docs/imarcom-core is forbidden in this repository and its Git history." >&2
  exit 1
fi
