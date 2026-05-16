import { Ionicons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import React, { type ComponentProps, useEffect } from "react";
import { type ColorValue } from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
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

function TabIcon({
  focused,
  color,
  icon,
  iconOutline,
  activeColor,
}: {
  focused: boolean;
  color: ColorValue;
  icon: ComponentProps<typeof Ionicons>["name"];
  iconOutline: ComponentProps<typeof Ionicons>["name"];
  activeColor: string;
}) {
  return (
    <Ionicons
      name={focused ? icon : iconOutline}
      size={24}
      color={focused ? activeColor : color}
    />
  );
}

export default function TabLayout() {
  const t = useT();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === "dark" ? "dark" : "light"];
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
    <Tabs
      backBehavior="none"
      detachInactiveScreens={false}
      screenListeners={{
        tabPress: () => haptic(),
      }}
      screenOptions={{
        tabBarActiveTintColor: theme.tint,
        headerShown: false,
        lazy: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.home"),
          tabBarActiveTintColor: TAB_COLORS.home,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              icon="home"
              iconOutline="home-outline"
              activeColor={TAB_COLORS.home}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="course"
        options={{
          title: t("nav.course"),
          tabBarActiveTintColor: TAB_COLORS.course,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              icon="calendar"
              iconOutline="calendar-outline"
              activeColor={TAB_COLORS.course}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="function"
        options={{
          title: t("nav.function"),
          tabBarActiveTintColor: TAB_COLORS.function,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              icon="grid"
              iconOutline="grid-outline"
              activeColor={TAB_COLORS.function}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="user"
        options={{
          title: t("nav.user"),
          tabBarActiveTintColor: TAB_COLORS.user,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              icon="person"
              iconOutline="person-outline"
              activeColor={TAB_COLORS.user}
            />
          ),
        }}
      />
    </Tabs>
  );
}
