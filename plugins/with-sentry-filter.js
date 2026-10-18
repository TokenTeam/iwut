"use strict";

const { withMainApplication } = require("expo/config-plugins");

// Register before @sentry/react-native/expo
function withSentryFilter(config) {
  return withMainApplication(config, (innerConfig) => {
    const application = innerConfig.modResults;
    if (
      application.contents.includes(
        "// Filter background ANRs on Huawei devices",
      )
    )
      return innerConfig;

    if (application.language !== "kt") {
      throw new Error("withSentryFilter requires a Kotlin MainApplication.");
    }

    const initialization = /^([ \t]*)RNSentrySDK\.init\(this\)[ \t]*$/m;
    if (!initialization.test(application.contents)) {
      throw new Error(
        "withSentryFilter must run after Sentry with useNativeInit enabled.",
      );
    }

    application.contents = application.contents.replace(
      initialization,
      (_, indent) =>
        `RNSentrySDK.init(this) { options ->
  // Filter background ANRs on Huawei devices
  val isHuawei = android.os.Build.MANUFACTURER.equals("HUAWEI", ignoreCase = true) ||
    android.os.Build.BRAND.equals("HUAWEI", ignoreCase = true)
  val previousBeforeSend = options.beforeSend
  options.setBeforeSend { event, hint ->
    val shouldDrop = isHuawei && event.exceptions?.any {
      it.type == "ApplicationNotResponding" &&
        it.module == "io.sentry.android.core" &&
        it.value?.startsWith("Background ANR") == true
    } == true
    when {
      shouldDrop -> null
      previousBeforeSend != null -> previousBeforeSend.execute(event, hint)
      else -> event
    }
  }
}`.replace(/^/gm, indent),
    );
    return innerConfig;
  });
}

module.exports = withSentryFilter;
