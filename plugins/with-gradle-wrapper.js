"use strict";

const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Gradle 9.3 彻底移除了 JvmVendorSpec.IBM_SEMERU，导致 foojay-resolver-convention 1.0.0 崩溃
// RN 0.85 支持 Gradle 8.6+，暂时固定到 8.13 来绕过此问题
// 待 foojay 发布 1.1.0 或 RN 官方跟进 Gradle 9.3 适配后可视情况移除此插件
const GRADLE_VERSION = "8.13";

module.exports = function withGradleWrapper(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const wrapper = path.join(
        config.modRequest.platformProjectRoot,
        "gradle",
        "wrapper",
        "gradle-wrapper.properties",
      );

      let contents = fs.readFileSync(wrapper, "utf8");
      contents = contents.replace(
        /distributionUrl=https\\:\/\/services\.gradle\.org\/distributions\/gradle-[\d.]+-bin\.zip/,
        `distributionUrl=https\\://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip`,
      );

      fs.writeFileSync(wrapper, contents);

      return config;
    },
  ]);
};
