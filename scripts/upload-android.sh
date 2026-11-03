#!/bin/bash
set -eo pipefail

PROFILE="$1"

if [ -z "$PROFILE" ]; then
  echo "Usage: $0 <profile> [apk]" >&2
  exit 1
fi

APK="${2:-iwut-${PROFILE}.apk}"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

VERSION="$(bun -p "require('./package.json').version")"
ENDPOINT="https://${ACCOUNT_ID}.r2.cloudflarestorage.com"
VERSIONED="s3://${BUCKET}/iwut/${VERSION}/${PROFILE}.apk"
LATEST="s3://${BUCKET}/iwut/latest/${PROFILE}.apk"

aws s3 cp "$APK" "$VERSIONED" \
  --endpoint-url "$ENDPOINT" \
  --content-type "application/vnd.android.package-archive" \
  --only-show-errors

aws s3 cp "$VERSIONED" "$LATEST" \
  --endpoint-url "$ENDPOINT" \
  --copy-props metadata-directive \
  --only-show-errors
