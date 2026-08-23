import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { getCalendars, getLocales } from "expo-localization";
import { requireNativeModule } from "expo-modules-core";
import * as Updates from "expo-updates";
import { Dimensions, PixelRatio, Platform } from "react-native";

export interface AndroidWidgetSize {
  widthDp: number;
  heightDp: number;
}

export interface AndroidWidgetProviderDiagnostics {
  provider: string;
  declaredMinWidthPx: number;
  declaredMinHeightPx: number;
  declaredMinResizeWidthPx: number;
  declaredMinResizeHeightPx: number;
  targetCellWidth: number | null;
  targetCellHeight: number | null;
  resizeMode: number;
}

export interface AndroidWidgetInstanceDiagnostics {
  appWidgetId: number;
  provider: string | null;
  declaredMinWidthPx: number | null;
  declaredMinHeightPx: number | null;
  targetCellWidth: number | null;
  targetCellHeight: number | null;
  resizeMode: number | null;
  allocatedMinWidthDp: number | null;
  allocatedMinHeightDp: number | null;
  allocatedMaxWidthDp: number | null;
  allocatedMaxHeightDp: number | null;
  supportedSizes: AndroidWidgetSize[] | null;
}

export interface AndroidNativeDiagnostics {
  platform: "android";
  launcher: {
    packageName: string | null;
    activityName: string | null;
    label: string | null;
    versionName: string | null;
    versionCode: number | null;
  };
  installSource: string | null;
  display: {
    widthPixels: number;
    heightPixels: number;
    density: number;
    densityDpi: number;
    stableDensityDpi: number;
    scaledDensity: number;
    fontScale: number;
    screenWidthDp: number;
    screenHeightDp: number;
    smallestScreenWidthDp: number;
  };
  widgets: {
    providerQueryAvailable: boolean;
    providers: AndroidWidgetProviderDiagnostics[];
    instances: AndroidWidgetInstanceDiagnostics[];
  };
}

export interface IOSNativeDiagnostics {
  platform: "ios";
  display: {
    boundsPoints: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    nativeBoundsPixels: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    scale: number;
    nativeScale: number;
  };
  widgets: {
    instances: Array<{
      kind: string;
      family: string;
      familyRawValue: number;
    }>;
  };
}

export type NativeDiagnostics = AndroidNativeDiagnostics | IOSNativeDiagnostics;

interface DiagnosticsNativeModule {
  getNativeDiagnostics(): Promise<NativeDiagnostics>;
}

const NativeDiagnosticsModule =
  Platform.OS === "android" || Platform.OS === "ios"
    ? requireNativeModule<DiagnosticsNativeModule>("Diagnostics")
    : null;

async function settle<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

function separateNativeDisplay(native: NativeDiagnostics | null) {
  if (!native) {
    return { native: null, nativeDisplay: null };
  }

  const { display, ...nativeWithoutDisplay } = native;
  return { native: nativeWithoutDisplay, nativeDisplay: display };
}

export async function collectDiagnostics() {
  const screen = Dimensions.get("screen");
  const window = Dimensions.get("window");
  const locales = getLocales();
  const calendars = getCalendars();
  const [installationTime, collectedNative] = await Promise.all([
    settle(Application.getInstallationTimeAsync()),
    NativeDiagnosticsModule
      ? settle(NativeDiagnosticsModule.getNativeDiagnostics())
      : Promise.resolve(null),
  ]);
  const { native, nativeDisplay } = separateNativeDisplay(collectedNative);

  return {
    application: {
      name: Application.applicationName,
      id: Application.applicationId,
      nativeVersion: Application.nativeApplicationVersion,
      nativeBuildVersion: Application.nativeBuildVersion,
      expoConfigVersion: Constants.expoConfig?.version ?? null,
      commit: Constants.expoConfig?.extra?.commit ?? null,
      executionEnvironment: Constants.executionEnvironment,
      installationTime: installationTime?.toISOString() ?? null,
    },
    update: {
      enabled: Updates.isEnabled,
      channel: Updates.channel,
      updateId: Updates.updateId,
      runtimeVersion: Updates.runtimeVersion,
      createdAt: Updates.createdAt?.toISOString() ?? null,
      embeddedLaunch: Updates.isEmbeddedLaunch,
      emergencyLaunch: Updates.isEmergencyLaunch,
      emergencyLaunchReason: Updates.emergencyLaunchReason,
      launchDurationMs: Updates.launchDuration,
    },
    device: {
      isPhysicalDevice: Device.isDevice,
      type:
        Device.deviceType == null
          ? null
          : (Device.DeviceType[Device.deviceType] ?? Device.deviceType),
      brand: Device.brand,
      manufacturer: Device.manufacturer,
      modelName: Device.modelName,
      modelId: Device.modelId,
      designName: Device.designName,
      productName: Device.productName,
      yearClass: Device.deviceYearClass,
    },
    operatingSystem: {
      platform: Platform.OS,
      name: Device.osName,
      version: Device.osVersion,
      apiLevel: Device.platformApiLevel,
      buildId: Device.osBuildId,
      internalBuildId: Device.osInternalBuildId,
      buildFingerprint: Device.osBuildFingerprint,
    },
    hardware: {
      cpuArchitectures: Device.supportedCpuArchitectures,
      totalMemoryBytes: Device.totalMemory,
    },
    display: {
      reactNative: {
        screen,
        window,
        pixelRatio: PixelRatio.get(),
        fontScale: PixelRatio.getFontScale(),
      },
      native: nativeDisplay,
    },
    localization: {
      languageTags: locales.map((locale) => locale.languageTag),
      regionCode: locales[0].regionCode,
      timeZone: calendars[0].timeZone,
      calendar: calendars[0].calendar,
      uses24HourClock: calendars[0].uses24hourClock,
      firstWeekday: calendars[0].firstWeekday,
    },
    native,
    exportedAt: new Date().toISOString(),
  };
}

function formatValue(value: unknown): string {
  if (value == null || value === "") return "Unavailable";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

export function formatDiagnostics(
  diagnostics: Awaited<ReturnType<typeof collectDiagnostics>>,
): string {
  const sections: Array<[string, Record<string, unknown>]> = [
    ["Application", diagnostics.application],
    ["Update", diagnostics.update],
    ["Device", diagnostics.device],
    ["Operating System", diagnostics.operatingSystem],
    ["Hardware", diagnostics.hardware],
    ["Display", diagnostics.display],
    ["Localization", diagnostics.localization],
  ];

  const output = sections.map(([title, values]) => {
    const lines = Object.entries(values).map(
      ([key, value]) => `${key}: ${formatValue(value)}`,
    );
    return [`[${title}]`, ...lines].join("\n");
  });

  output.push(
    diagnostics.native
      ? `[Native Diagnostics]\n${JSON.stringify(diagnostics.native, null, 2)}`
      : `[Native Diagnostics]\nStatus: Unavailable on ${diagnostics.operatingSystem.platform}`,
  );
  output.push(`[Export]\nexportedAt: ${diagnostics.exportedAt}`);

  return output.join("\n\n");
}
