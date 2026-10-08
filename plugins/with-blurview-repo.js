"use strict";

const { withProjectBuildGradle } = require("expo/config-plugins");

const REPO_URL = "https://maven.cnb.cool/TokenTeam/android-deps/-/packages/";

const REPO_BLOCK = `
    maven {
      url "${REPO_URL}"
      content { includeGroup "com.github.Dimezis" }
    }`;

function withBlurViewRepo(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      return config;
    }

    const contents = config.modResults.contents;
    if (contents.includes(REPO_URL)) {
      return config;
    }

    config.modResults.contents = contents.replace(
      /allprojects\s*\{\s*repositories\s*\{/,
      (match) => `${match}${REPO_BLOCK}`,
    );

    return config;
  });
}

module.exports = withBlurViewRepo;
