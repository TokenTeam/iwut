import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { type Lang, useT } from "@/lib/i18n";
import { useSettingsStore } from "@/store/settings";
import { type ThemeMode, useThemeStore } from "@/store/theme";

export default function AppearanceScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const scheme = useColorScheme();
  const iconColor = Colors[scheme === "dark" ? "dark" : "light"].icon;
  const tintColor = Colors[scheme === "dark" ? "dark" : "light"].tint;
  const themeMode = useThemeStore((s) => s.themeMode);
  const setThemeMode = useThemeStore((s) => s.setThemeMode);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const themeOptions: { mode: ThemeMode; icon: string; label: string }[] = [
    {
      mode: "system",
      icon: "brightness-auto",
      label: t("appearance.themeSystem"),
    },
    { mode: "light", icon: "light-mode", label: t("appearance.themeLight") },
    { mode: "dark", icon: "dark-mode", label: t("appearance.themeDark") },
  ];

  const themeLabelMap: Record<ThemeMode, string> = {
    system: t("appearance.themeSystem"),
    light: t("appearance.themeLight"),
    dark: t("appearance.themeDark"),
  };

  const langOptions: { lang: Lang; icon: string; label: string }[] = [
    {
      lang: "system",
      icon: "brightness-auto",
      label: t("appearance.langSystem"),
    },
    { lang: "zh", icon: "translate", label: t("appearance.langZh") },
    { lang: "en", icon: "translate", label: t("appearance.langEn") },
  ];

  const langLabelMap: Record<Lang, string> = {
    system: t("appearance.langSystem"),
    zh: t("appearance.langZh"),
    en: t("appearance.langEn"),
  };

  return (
    <>
      <Stack.Screen options={{ title: t("appearance.title") }} />
      <ScrollView
        className="flex-1 bg-neutral-100 dark:bg-neutral-900"
        contentContainerClassName="px-4 pt-4"
      >
        <MenuGroup title={t("appearance.themeGroup")}>
          <MenuItem
            icon="palette"
            iconBg="#5856D6"
            label={t("appearance.theme")}
            value={themeLabelMap[themeMode]}
            onPress={() => setShowThemePicker(true)}
          />
        </MenuGroup>

        <MenuGroup title={t("appearance.languageGroup")}>
          <MenuItem
            icon="translate"
            iconBg="#0d9488"
            label={t("appearance.language")}
            value={langLabelMap[language]}
            onPress={() => setShowLangPicker(true)}
          />
        </MenuGroup>
      </ScrollView>

      <BottomSheet
        visible={showThemePicker}
        onClose={() => setShowThemePicker(false)}
      >
        {themeOptions.map((opt) => (
          <Pressable
            key={opt.mode}
            className="flex-row items-center px-5 py-3.5 active:bg-neutral-100 dark:active:bg-neutral-700"
            onPress={() => {
              setThemeMode(opt.mode);
              setShowThemePicker(false);
            }}
          >
            <IconSymbol
              name={opt.icon as any}
              size={22}
              color={themeMode === opt.mode ? tintColor : iconColor}
            />
            <Text
              className={`ml-3 flex-1 text-base ${
                themeMode === opt.mode
                  ? "font-medium text-sky-600 dark:text-white"
                  : "text-neutral-800 dark:text-neutral-200"
              }`}
            >
              {opt.label}
            </Text>
            {themeMode === opt.mode && (
              <IconSymbol name="check" size={20} color={tintColor} />
            )}
          </Pressable>
        ))}
      </BottomSheet>

      <BottomSheet
        visible={showLangPicker}
        onClose={() => setShowLangPicker(false)}
      >
        {langOptions.map((opt) => (
          <Pressable
            key={opt.lang}
            className="flex-row items-center px-5 py-3.5 active:bg-neutral-100 dark:active:bg-neutral-700"
            onPress={() => {
              setLanguage(opt.lang);
              setShowLangPicker(false);
            }}
          >
            <IconSymbol
              name={opt.icon as any}
              size={22}
              color={language === opt.lang ? tintColor : iconColor}
            />
            <Text
              className={`ml-3 flex-1 text-base ${
                language === opt.lang
                  ? "font-medium text-sky-600 dark:text-white"
                  : "text-neutral-800 dark:text-neutral-200"
              }`}
            >
              {opt.label}
            </Text>
            {language === opt.lang && (
              <IconSymbol name="check" size={20} color={tintColor} />
            )}
          </Pressable>
        ))}
      </BottomSheet>
    </>
  );
}
