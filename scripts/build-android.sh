#!/bin/bash
set -e

PROFILE="$1"

if [ -z "$PROFILE" ]; then
  echo "Usage: $0 <profile>"
  exit 1
fi

for cmd in unzip:unzip wget:wget; do
  command -v "${cmd%%:*}" &> /dev/null || PKGS+=" ${cmd##*:}"
done
if [ -n "$PKGS" ]; then
  apt-get update && apt-get install -y $PKGS
fi

export SDKMAN_DIR="${SDKMAN_DIR:-$HOME/.sdkman}"
[ -s "$SDKMAN_DIR/bin/sdkman-init.sh" ] && . "$SDKMAN_DIR/bin/sdkman-init.sh"

if ! command -v java &> /dev/null; then
  if [ ! -s "$SDKMAN_DIR/bin/sdkman-init.sh" ]; then
    curl -s "https://get.sdkman.io" | bash
    . "$SDKMAN_DIR/bin/sdkman-init.sh"
  fi
  sdk install java 21.0.7-tem
  export JAVA_HOME="$SDKMAN_DIR/candidates/java/current"
  export PATH="$JAVA_HOME/bin:$PATH"
else
  java -version
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/refs/heads/master/install.sh | bash
fi
. "$NVM_DIR/nvm.sh"

if ! command -v node &> /dev/null; then
  nvm install --lts
fi

export ANDROID_HOME=/opt/android-sdk
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH

if ! command -v sdkmanager &> /dev/null; then
  mkdir -p /opt/android-sdk/cmdline-tools
  wget https://dl.google.com/android/repository/commandlinetools-linux-14742923_latest.zip -O /tmp/tools.zip
  unzip /tmp/tools.zip -d /opt/android-sdk/cmdline-tools
  mv /opt/android-sdk/cmdline-tools/cmdline-tools /opt/android-sdk/cmdline-tools/latest
  rm /tmp/tools.zip
fi

if [ ! -d "$ANDROID_HOME/platforms/android-36" ]; then
  yes | sdkmanager --licenses
  sdkmanager --install \
    "platform-tools" \
    "platforms;android-36" \
    "build-tools;36.0.0" \
    "ndk;27.1.12297006"
fi

if ! command -v eas &> /dev/null; then
  npm install -g eas-cli
fi

yarn install --frozen-lockfile

rm -rf "${TMPDIR:-/tmp}/metro-cache" "${TMPDIR:-/tmp}"/haste-map-*

eas build --profile "$PROFILE" --platform android --local
