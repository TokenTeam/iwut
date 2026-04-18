import type { ExpoConfig } from "expo/config";

// 仅在构建时生效，与 JS 层的 IS_DEV 无关
const IS_DEV = process.env.EAS_BUILD_PROFILE === "development";

const config: ExpoConfig = {
  name: IS_DEV ? "掌上吾理 Pro (Dev)" : "掌上吾理 Pro",
  slug: "iwut",
  version: "0.1.4",
  runtimeVersion: {
    policy: "appVersion",
  },
  updates: {
    url: "https://expo.tokenteam.net/api/updates/019da0ce-9cda-76dc-b440-0c6a45d38292/manifest",
    checkAutomatically: "ON_LOAD",
    codeSigningCertificate: "./assets/certificate.pem",
    codeSigningMetadata: {
      keyid: "main",
      alg: "rsa-v1_5-sha256",
    },
  },
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "iwut",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: IS_DEV ? "dev.tokenteam.iwut.dev" : "dev.tokenteam.iwut",
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        "用于在连接校园网时读取当前 Wi-Fi 相关信息并完成网络认证",
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
        NSAllowsArbitraryLoadsInWebContent: true,
      },
    },
  },
  android: {
    package: IS_DEV ? "dev.tokenteam.iwut.dev" : "dev.tokenteam.iwut",
    adaptiveIcon: {
      backgroundColor: "#FFFFFF",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-dev-client",
    "expo-router",
    "expo-font",
    "expo-web-browser",
    "expo-image",
    "expo-secure-store",
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
  },
  owner: "tokenteam",
};

export default config;
