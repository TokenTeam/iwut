import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions } from "react-native";
import Toast from "react-native-toast-message";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { type Lang, useT } from "@/lib/i18n";
import { useScheduleStore } from "@/store/schedule";
import { useSettingsStore } from "@/store/settings";
import { type ThemeMode, useThemeStore } from "@/store/theme";

function isCropCancelled(error: unknown) {
  const re = /cancell?ed/i;
  if (error && typeof error === "object" && "code" in error) {
    if (re.test(String((error as { code: unknown }).code))) return true;
  }
  if (error instanceof Error) return re.test(error.message);
  if (typeof error === "string") return re.test(error);
  return false;
}

export default function AppearanceScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const scheme = useColorScheme();
  const iconColor = Colors[scheme === "dark" ? "dark" : "light"].icon;
  const tintColor = Colors[scheme === "dark" ? "dark" : "light"].tint;
  const themeMode = useThemeStore((s) => s.themeMode);
  const setThemeMode = useThemeStore((s) => s.setThemeMode);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const backgroundImageUri = useScheduleStore((s) => s.backgroundImageUri);
  const setBackgroundImageUri = useScheduleStore(
    (s) => s.setBackgroundImageUri,
  );
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);

  const deleteBgFile = async (uri: string | null) => {
    if (!uri) return;
    try {
      const { File } = await import("expo-file-system");
      // 存储的 URI 可能带 ?v= 版本参数，去掉后才是真实文件路径
      const old = new File(uri.split("?")[0]);
      if (old.exists) old.delete();
    } catch {}
  };

  const handlePickImage = async () => {
    // 先关闭 BottomSheet，避免 expo-image-picker 在 RN Modal上下文
    // 调用 .launch() 触发 unregistered ActivityResultLauncher
    setShowBgPicker(false);
    let tempCroppedUri: string | null = null;
    try {
      const ImagePicker = await import("expo-image-picker");
      const { File, Paths } = await import("expo-file-system");
      const ExpoImageCropTool = (await import("@bsky.app/expo-image-crop-tool"))
        .default;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const cropped = await ExpoImageCropTool.openCropperAsync({
        imageUri: asset.uri,
        shape: "rectangle",
        aspectRatio:
          windowWidth > 0 && windowHeight > 0
            ? windowWidth / windowHeight
            : undefined,
        format: "jpeg",
        compressImageQuality: 0.85,
        cancelButtonText: t("appearance.bgPickerCancel"),
        doneButtonText: t("appearance.bgPickerDone"),
      });

      tempCroppedUri = cropped.path;
      const source = new File(cropped.path);

      // 固定文件名，换图直接覆盖，无需清理旧文件
      const dest = new File(Paths.document, "bg.jpg");
      if (dest.exists) dest.delete();
      await source.copy(dest);

      // 文件名固定后 URI 不变，expo-image 会命中旧缓存且组件不会重渲染，
      // 加 ?v= 版本参数作为新的缓存键；原生端解析 file URI 时会忽略 query
      setBackgroundImageUri(`${dest.uri}?v=${Date.now()}`);
      Toast.show({
        type: "success",
        text1: t("appearance.bgSetSuccess"),
        position: "bottom",
      });
    } catch (error) {
      if (isCropCancelled(error)) return;
      Toast.show({
        type: "error",
        text1: t("appearance.bgSetFailed"),
        text2: t("appearance.bgSetFailedSub"),
        position: "bottom",
      });
    } finally {
      if (tempCroppedUri) {
        try {
          const { File } = await import("expo-file-system");
          const temp = new File(tempCroppedUri);
          if (temp.exists) temp.delete();
        } catch {}
      }
    }
  };

  const handleRemoveBg = async () => {
    await deleteBgFile(backgroundImageUri);
    setBackgroundImageUri(null);
    setShowBgPicker(false);
    Toast.show({
      type: "success",
      text1: t("appearance.bgRemoved"),
      position: "bottom",
    });
  };

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
          <MenuItem
            icon="image"
            iconBg="#FF2D55"
            label={t("appearance.bg")}
            value={
              backgroundImageUri
                ? t("appearance.bgSet")
                : t("appearance.bgNone")
            }
            onPress={() => setShowBgPicker(true)}
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
        visible={showBgPicker}
        onClose={() => setShowBgPicker(false)}
        title={t("appearance.bgSheetTitle")}
      >
        <Pressable
          className="flex-row items-center px-5 py-3.5 active:bg-neutral-100 dark:active:bg-neutral-700"
          onPress={handlePickImage}
        >
          <IconSymbol name="photo-library" size={22} color={iconColor} />
          <Text className="ml-3 flex-1 text-base text-neutral-800 dark:text-neutral-200">
            {t("appearance.bgPickFromAlbum")}
          </Text>
        </Pressable>
        {backgroundImageUri && (
          <Pressable
            className="flex-row items-center px-5 py-3.5 active:bg-neutral-100 dark:active:bg-neutral-700"
            onPress={handleRemoveBg}
          >
            <IconSymbol name="delete-outline" size={22} color="#ef4444" />
            <Text className="ml-3 flex-1 text-base text-red-500">
              {t("appearance.bgRemove")}
            </Text>
          </Pressable>
        )}
      </BottomSheet>

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
