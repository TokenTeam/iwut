#!/bin/bash
set -e

while [ $# -gt 0 ]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    --token=*) TOKEN="${1#*=}"; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done
: "${TOKEN:?Usage: $0 --token <token>}"

cd "$(dirname "$0")/.."

VERSION=$(bun -p "require('./package.json').version")

rm -rf dist
bun expo export --platform ios --platform android --output-dir dist
bun expo config --type public --json > dist/expoConfig.json

cd dist
FILES=()
while IFS= read -r f; do FILES+=(-F "$f=@$f"); done < <(find _expo assets -type f)

curl --fail-with-body -X POST \
  "https://expo.tokenteam.net/api/updates/019da0ce-9cda-76dc-b440-0c6a45d38292/publish" \
  -H "Authorization: Bearer $TOKEN" \
  -F "runtimeVersion=$VERSION" \
  -F "metadata.json=@metadata.json" \
  -F "expoConfig.json=@expoConfig.json" \
  "${FILES[@]}"
