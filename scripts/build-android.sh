#!/bin/bash
set -eo pipefail

PROFILE="$1"

if [ -z "$PROFILE" ]; then
  echo "Usage: $0 <profile> [eas build options...]"
  exit 1
fi
shift

if ! command -v java &> /dev/null; then
  export SDKMAN_DIR="${SDKMAN_DIR:-$HOME/.sdkman}"
  if [ ! -s "$SDKMAN_DIR/bin/sdkman-init.sh" ]; then
    curl -fsSL "https://get.sdkman.io" | bash
  fi
  . "$SDKMAN_DIR/bin/sdkman-init.sh"
  sdk install java 26.0.2.1+1-tem
  export JAVA_HOME="$SDKMAN_DIR/candidates/java/current"
  export PATH="$JAVA_HOME/bin:$PATH"
else
  java -version
fi

if ! command -v node &> /dev/null; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/refs/heads/master/install.sh | bash
  fi
  . "$NVM_DIR/nvm.sh"
  nvm install --lts
fi

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"
if ! command -v bun &> /dev/null; then
  curl -fsSL https://bun.sh/install | bash
fi

export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$HOME/.local/bin:$PATH"

if ! command -v android &> /dev/null; then
  PKGS=()
  for cmd in unzip wget; do
    command -v "$cmd" &> /dev/null || PKGS+=("$cmd")
  done
  if [ "${#PKGS[@]}" -gt 0 ]; then
    APT=(apt-get)
    if [ "$EUID" -ne 0 ]; then
      APT=(sudo apt-get)
    fi
    "${APT[@]}" update
    "${APT[@]}" install -y "${PKGS[@]}"
  fi
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  wget https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip -O /tmp/tools.zip
  unzip -o /tmp/tools.zip -d "$ANDROID_HOME/cmdline-tools"
  mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
  cp -a "$ANDROID_HOME/cmdline-tools/cmdline-tools/." "$ANDROID_HOME/cmdline-tools/latest/"
  rm /tmp/tools.zip
fi

SDK_PACKAGES=()
for package in \
  "platform-tools" \
  "platforms/android-37.0" \
  "build-tools/37.0.0" \
  "ndk/27.1.12297006"; do
  if [ ! -f "$ANDROID_HOME/$package/package.xml" ]; then
    SDK_PACKAGES+=("$package")
  fi
done
if [ "${#SDK_PACKAGES[@]}" -gt 0 ]; then
  android --sdk="$ANDROID_HOME" sdk install "${SDK_PACKAGES[@]}"
fi

if ! command -v eas &> /dev/null; then
  bun install -g eas-cli
fi

bun install --frozen-lockfile

rm -rf "${TMPDIR:-/tmp}/metro-cache" "${TMPDIR:-/tmp}"/haste-map-*

eas build --profile "$PROFILE" --platform android --local "$@"
