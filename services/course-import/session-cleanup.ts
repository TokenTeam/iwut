import CookieManager from "@preeternal/react-native-cookie-manager";
import { Platform } from "react-native";

import { reportError } from "@/lib/report";

export async function clearCourseImportSession(): Promise<void> {
  const stores = Platform.OS === "ios" ? [true, false] : [true];
  await Promise.all(
    stores.map(async (useWebKit) => {
      try {
        await CookieManager.clearAll(useWebKit);
        if (Platform.OS === "android") await CookieManager.flush();
      } catch (error) {
        reportError(error, { module: "course-session-cleanup", useWebKit });
      }
    }),
  );
}
