import { execSync } from "child_process";
import type { ExpoConfig } from "expo/config";

const PROFILE = process.env.EAS_BUILD_PROFILE;
const COMMIT = execSync("git rev-parse --short HEAD").toString().trim();
// 仅在构建时生效，与 JS 层的 IS_DEV 无关
const IS_DEV = !PROFILE || PROFILE === "development";

const config: ExpoConfig = {
  name: IS_DEV ? "掌上吾理 Dev" : "掌上吾理 Pro",
  slug: "iwut",
  version: "0.2.3",
  runtimeVersion: {
    policy: "appVersion",
  },
  updates: {
    url: "https://expo.tokenteam.net/api/updates/019da0ce-9cda-76dc-b440-0c6a45d38292/manifest",
    checkAutomatically: "ON_LOAD",
    ...(PROFILE && {
      requestHeaders: {
        "expo-channel-name": PROFILE,
      },
    }),
    ...(!IS_DEV && {
      codeSigningCertificate: "./assets/certificate.pem",
      codeSigningMetadata: {
        keyid: "main",
        alg: "rsa-v1_5-sha256",
      },
    }),
  },
  platforms: ["ios", "android"],
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "iwut",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: IS_DEV ? "dev.tokenteam.iwut.dev" : "dev.tokenteam.iwut",
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSSupportsLiveActivities: true,
      NSLocationWhenInUseUsageDescription:
        "用于在连接校园网时读取当前 Wi-Fi 相关信息并完成网络认证",
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
        NSAllowsArbitraryLoadsInWebContent: true,
      },
    },
    entitlements: {
      "com.apple.security.application-groups": ["group.dev.tokenteam.iwut"],
    },
  },
  android: {
    package: IS_DEV ? "dev.tokenteam.iwut.dev" : "dev.tokenteam.iwut",
    adaptiveIcon: {
      backgroundColor: "#FFFFFF",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    ...(IS_DEV ? ["expo-dev-client"] : []),
    "expo-router",
    "expo-font",
    "expo-web-browser",
    "expo-image",
    "expo-secure-store",
    "expo-sharing",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/icon.png",
        imageWidth: 200,
        backgroundColor: "#FFFFFF",
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["arm64-v8a"],
          useLegacyPackaging: true,
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          usesCleartextTraffic: true,
        },
      },
    ],
    "@sentry/react-native",
    "expo-background-task",
    "@bacons/apple-targets",
    "./plugins/with-gradle-props.js",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "db91117d-c051-4555-a16b-7a996823672e",
    },
    commit: COMMIT,
  },
  owner: "tokenteam",
};

export default config;
