"use strict";

const { withAppDelegate, withMainApplication } = require("expo/config-plugins");

// Register before @sentry/react-native/expo
function withSentryFilter(config) {
  config = withAppDelegate(config, (innerConfig) => {
    const delegate = innerConfig.modResults;
    delegate.contents = gateIosInitialization(
      delegate.contents,
      delegate.language,
    );
    return innerConfig;
  });
  return withMainApplication(config, (innerConfig) => {
    const application = innerConfig.modResults;
    application.contents = gateAndroidInitialization(
      application.contents,
      application.language,
    );
    return innerConfig;
  });
}

function gateAndroidInitialization(contents, language) {
  if (contents.includes("TelemetryModule.startSentry(this)"))
    return contents.replace(
      /^[ \t]*RNSentrySDK\.init\(this\)[ \t]*\r?\n?/gm,
      "",
    );
  if (language !== "kt")
    throw new Error("withSentryFilter requires a Kotlin MainApplication.");
  const initialization = /^([ \t]*)RNSentrySDK\.init\(this\)[ \t]*$/m;
  if (!initialization.test(contents)) {
    throw new Error(
      "Sentry native initialization was not found in MainApplication.",
    );
  }
  return contents.replace(
    initialization,
    (_, indent) =>
      `${indent}dev.tokenteam.iwut.telemetry.TelemetryModule.startSentry(this)`,
  );
}

function gateIosInitialization(contents, language) {
  if (language === "swift") {
    contents = contents.replace(
      /^([ \t]*)import Telemetry([ \t]*\r?)$/gm,
      "$1internal import Telemetry$2",
    );
  }
  if (
    contents.includes("[TelemetrySentry start]") ||
    contents.includes("TelemetrySentry.start()")
  )
    return contents.replace(
      /^[ \t]*(?:RNSentrySDK\.start\(\)|\[RNSentrySDK start\];)[ \t]*\r?\n?/gm,
      "",
    );
  const swift = language === "swift";
  const initialization = swift ? "RNSentrySDK.start()" : "[RNSentrySDK start];";
  if (!contents.includes(initialization)) {
    throw new Error(
      "Sentry native initialization was not found in AppDelegate.",
    );
  }
  const delegated = swift
    ? "TelemetrySentry.start()"
    : "[TelemetrySentry start];";
  const result = contents.replace(initialization, delegated);
  return swift
    ? `internal import Telemetry\n${result}`
    : `#import <Telemetry/Telemetry-Swift.h>\n${result}`;
}

module.exports = withSentryFilter;
