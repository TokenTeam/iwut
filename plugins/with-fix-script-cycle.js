/**
 * Workaround for https://github.com/expo/expo/issues/46204
 *
 * expo-dev-launcher 56.0.15 (PR #46125) added an `inputPaths` declaration to
 * the "[Expo Dev Launcher] Strip Local Network Keys for Release" build phase
 * without a matching `outputPaths`, putting it downstream of ProcessInfoPlist.
 * When the main target embeds an app extension (Live Activity / widget here),
 * a four-edge dependency cycle forms and the iOS build fails.
 *
 * This plugin removes the offending `inputPaths` declaration, reverting the
 * phase to its pre-#46125 behavior. The script still runs on every build
 * (Xcode emits a "no outputs" warning that's harmless), and the ordering
 * with `ProcessInfoPlistFile` is preserved through the natural position of
 * the phase in the target's `buildPhases` array (the plugin appends it after
 * the built-in phases).
 *
 * NOTE: setting `alwaysOutOfDate = 1` is NOT sufficient — that flag only
 * tells Xcode "always re-run this script", it does NOT remove the script
 * from the dependency graph. The `inputPaths` edge to Info.plist must be
 * dropped to break the cycle.
 *
 * Remove this plugin once expo-dev-launcher ships a fix.
 */
const { withXcodeProject } = require("@expo/config-plugins");

const TARGET_PHASE_NAME =
  "[Expo Dev Launcher] Strip Local Network Keys for Release";

module.exports = function withFixScriptCycle(config) {
  return withXcodeProject(config, (cfg) => {
    const phases =
      cfg.modResults.hash.project.objects.PBXShellScriptBuildPhase || {};
    for (const key of Object.keys(phases)) {
      const phase = phases[key];
      if (!phase || typeof phase !== "object") continue;
      const name = (phase.name || "").replace(/^"|"$/g, "");
      if (name === TARGET_PHASE_NAME) {
        phase.inputPaths = [];
        phase.inputFileListPaths = [];
      }
    }
    return cfg;
  });
};
