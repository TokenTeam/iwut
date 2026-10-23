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
    {
      propName: "org.gradle.caching",
      propValueGetter: () => "true",
    },
    {
      propName: "org.gradle.daemon",
      propValueGetter: () => "false",
    },
  ],
  "withGradleProps",
);

module.exports = withGradleProps;
