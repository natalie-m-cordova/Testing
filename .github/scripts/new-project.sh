#!/usr/bin/env bash
# Usage: .github/scripts/new-project.sh <slug>
set -euo pipefail

SLUG="${1:-}"
if [[ -z "$SLUG" ]]; then
  echo "Usage: $0 <slug>"
  exit 1
fi

# normalize: lower-case, only [a-z0-9-]
norm="$(echo "$SLUG" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/-+/-/g; s/^-|-$//g')"
if [[ "$norm" != "$SLUG" ]]; then
  echo "→ normalized slug: $norm"
  SLUG="$norm"
fi

SRC="Templates/Project"
DEST="docs/projects/$SLUG"

[[ -d "$SRC" ]] || { echo "Missing $SRC template"; exit 1; }
[[ -e "$DEST" ]] && { echo "Already exists: $DEST"; exit 1; }

mkdir -p "$DEST"
cp "$SRC/meta.json" "$DEST/meta.json"
cp "$SRC/README.md" "$DEST/README.md"

# Stamp dates + keep private by default
today=$(date +%F)
if command -v jq >/dev/null 2>&1; then
  tmp=$(mktemp)
  jq --arg d "$today" '.createdAt=$d | .updatedAt=$d | .visibility="private"' \
     "$DEST/meta.json" > "$tmp" && mv "$tmp" "$DEST/meta.json"
else
  # sed fallback assumes keys exist in template
  sed -i.bak -E \
    -e "s/(\"createdAt\":\s*\")[^\"]*(\")/\1$today\2/" \
    -e "s/(\"updatedAt\":\s*\")[^\"]*(\")/\1$today\2/" \
    "$DEST/meta.json" && rm -f "$DEST/meta.json.bak"
fi

echo "✅ Created $DEST
   - meta.json (visibility=private)
   - README.md (notes only)"