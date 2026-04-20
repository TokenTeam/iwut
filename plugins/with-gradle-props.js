"use strict";

const { AndroidConfig } = require("expo/config-plugins");

const { createBuildGradlePropsConfigPlugin } = AndroidConfig.BuildProperties;

const withGradleProps = createBuildGradlePropsConfigPlugin(
  [
    {
      propName: "org.gradle.jvmargs",
      propValueGetter: () =>
        [
          "-Xmx8g",
          "-XX:MaxMetaspaceSize=2g",
          "-XX:+HeapDumpOnOutOfMemoryError",
        ].join(" "),
    },
  ],
  "withGradleProps",
);

module.exports = withGradleProps;
