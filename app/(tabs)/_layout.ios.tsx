import { NativeTabs } from "expo-router/native-tabs";
import { router } from "expo-router";
import { useEffect } from "react";

import { useHaptics } from "@/hooks/use-haptics";
import { useT } from "@/lib/i18n";
import { useSettingsStore } from "@/store/settings";

let hasLaunched = false;

const TAB_COLORS = {
  home: "#007AFF",
  course: "#34C759",
  function: "#AF52DE",
  user: "#FF9500",
} as const;

const sceneStyle = { backgroundColor: "transparent" };

export default function IosTabLayout() {
  const t = useT();
  const haptic = useHaptics();

  useEffect(() => {
    if (!hasLaunched) {
      hasLaunched = true;
      if (useSettingsStore.getState().openCourseOnLaunch) {
        router.navigate("/course");
      }
    }
  }, []);

  return (
    <NativeTabs
      activityEnabled
      minimizeBehavior="never"
      screenListeners={{
        tabPress: () => haptic(),
      }}
    >
      <NativeTabs.Trigger name="index" contentStyle={sceneStyle}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          selectedColor={TAB_COLORS.home}
        />
        <NativeTabs.Trigger.Label selectedStyle={{ color: TAB_COLORS.home }}>
          {t("nav.home")}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="course"
        activityEnabled={false}
        contentStyle={sceneStyle}
        disableAutomaticContentInsets
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: "calendar", selected: "calendar" }}
          selectedColor={TAB_COLORS.course}
        />
        <NativeTabs.Trigger.Label selectedStyle={{ color: TAB_COLORS.course }}>
          {t("nav.course")}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="function" contentStyle={sceneStyle}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
          selectedColor={TAB_COLORS.function}
        />
        <NativeTabs.Trigger.Label
          selectedStyle={{ color: TAB_COLORS.function }}
        >
          {t("nav.function")}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="user" contentStyle={sceneStyle}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person", selected: "person.fill" }}
          selectedColor={TAB_COLORS.user}
        />
        <NativeTabs.Trigger.Label selectedStyle={{ color: TAB_COLORS.user }}>
          {t("nav.user")}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
