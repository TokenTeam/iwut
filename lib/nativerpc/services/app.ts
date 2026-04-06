import Constants from "expo-constants";
import { Platform } from "react-native";

import type {
  NativeRPCResponseData,
  NativeRPCService,
  NativeRPCServiceContext,
} from "../types";
import {
  NativeRPCErrorType,
  nativeRPCError,
} from "../error";

export class NativeRPCAppService implements NativeRPCService {
  readonly name = "app";

  canHandleMethod(method: string): boolean {
    return method === "info";
  }

  async perform(
    method: string,
    _params: Record<string, any> | null | undefined,
    _context: NativeRPCServiceContext,
  ): Promise<NativeRPCResponseData> {
    if (method !== "info") {
      throw nativeRPCError(NativeRPCErrorType.MethodNotFound);
    }

    const expoConfig = Constants.expoConfig;
    const version = expoConfig?.version ?? "0.0.0";
    const appName = expoConfig?.name ?? "掌上吾理";
    const bundleId =
      Platform.OS === "android"
        ? expoConfig?.android?.package
        : expoConfig?.ios?.bundleIdentifier;
    const nativeBuildVersion =
      Platform.OS === "android"
        ? String(Constants.platform?.android?.versionCode ?? "dev")
        : (Constants.platform?.ios?.buildNumber ?? "dev");
    const buildVersion = `${version}-${nativeBuildVersion}`;
    const osType =
      Platform.OS === "ios"
        ? "iOS"
        : Platform.OS === "android"
          ? "Android"
          : Platform.OS;
    const osVersion =
      Platform.OS === "ios"
        ? Constants.platform?.ios?.systemVersion
        : Platform.Version;

    return {
      version,
      osType,
      osVersion: String(osVersion ?? "unknown"),
      device: Constants.deviceName ?? "Unknown",
      name: appName,
      bundleId: bundleId ?? "Unknown",
      buildVersion,
    };
  }
}
