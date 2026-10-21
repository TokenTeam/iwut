"use strict";

const {
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const CONFIG_SOURCE = require.resolve("./network_security_config.xml");

function withNetworkSecurityConfig(config) {
  config = withDangerousMod(config, [
    "android",
    async (innerConfig) => {
      const resXmlDir = path.join(
        innerConfig.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "xml",
      );
      fs.mkdirSync(resXmlDir, { recursive: true });
      fs.copyFileSync(
        CONFIG_SOURCE,
        path.join(resXmlDir, "network_security_config.xml"),
      );
      return innerConfig;
    },
  ]);

  config = withAndroidManifest(config, (innerConfig) => {
    const application = innerConfig.modResults.manifest.application?.[0];
    if (application) {
      application.$["android:networkSecurityConfig"] =
        "@xml/network_security_config";
    }
    return innerConfig;
  });

  return config;
}

module.exports = withNetworkSecurityConfig;
