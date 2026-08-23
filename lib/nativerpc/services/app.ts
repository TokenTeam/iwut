import * as Application from "expo-application";
import * as Device from "expo-device";
import { Platform } from "react-native";

import type {
  NativeRPCResponseData,
  NativeRPCService,
  NativeRPCServiceContext,
} from "../types";
import { NativeRPCErrorType, nativeRPCError } from "../error";

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

    const version = Application.nativeApplicationVersion ?? "0.0.0";
    const appName = Application.applicationName ?? "掌上吾理";
    const bundleId = Application.applicationId;
    const nativeBuildVersion = Application.nativeBuildVersion ?? "dev";
    const buildVersion = `${version}-${nativeBuildVersion}`;
    const osType =
      Platform.OS === "ios"
        ? "iOS"
        : Platform.OS === "android"
          ? "Android"
          : Platform.OS;
    const osVersion = Device.osVersion ?? Platform.Version;

    return {
      version,
      osType,
      osVersion: String(osVersion ?? "unknown"),
      device: Device.deviceName ?? "Unknown",
      name: appName,
      bundleId: bundleId ?? "Unknown",
      buildVersion,
    };
  }
}
