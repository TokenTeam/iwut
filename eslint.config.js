// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");
const globals = require("globals");

module.exports = defineConfig([
  globalIgnores(["dist/*"]),
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    files: ["babel.config.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    ignores: ["dist/*"],
  },
]);
