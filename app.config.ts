import type { ExpoConfig } from "expo/config";

const IS_DEV = process.env.EXPO_PUBLIC_DEBUG === "1";

const config: ExpoConfig = {
  name: "掌上吾理",
  slug: "iwut",
  version: "1.0.0",
  runtimeVersion: {
    policy: "fingerprint",
  },
  updates: {
    url: "https://u.expo.dev/db91117d-c051-4555-a16b-7a996823672e",
    checkAutomatically: "ON_LOAD",
  },
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "iwut",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: IS_DEV ? "dev.tokenteam.iwut.dev" : "dev.tokenteam.iwut",
    supportsTablet: true,
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
