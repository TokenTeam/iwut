import Constants from "expo-constants";

const NATIVE_VERSION = Constants.expoConfig?.version;
const OTA_PATCH = 1;

/**
 * Major.Minor.Patch.OTA
 * @example 1.0.0-patch.0
 */
export const VERSION = `${NATIVE_VERSION}-patch.${OTA_PATCH}`;
