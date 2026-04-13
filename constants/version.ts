import Constants from "expo-constants";

export const NATIVE_VERSION = Constants.expoConfig?.version;
export const OTA_PATCH = 2;

/**
 * Major.Minor.Patch.OTA
 * @example 1.0.0-patch.0
 */
export const VERSION = `${NATIVE_VERSION}-patch.${OTA_PATCH}`;
