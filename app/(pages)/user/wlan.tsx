import { Feather } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useT } from "@/lib/i18n";
import { reportError } from "@/lib/report";
import { login } from "@/services/wlan";
import { useWlanStore } from "@/store/wlan";

export default function WlanScreen() {
  const t = useT();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const { hasSaved, username, save, clear, getCredentials } = useWlanStore();

  const [sheetVisible, setSheetVisible] = useState(false);
  const [clearVisible, setClearVisible] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [inputUser, setInputUser] = useState("");
  const [inputPass, setInputPass] = useState("");
  const passwordRef = useRef<TextInput>(null);
  const [showPassword, setShowPassword] = useState(false);

  const openSheet = useCallback(() => {
    setInputUser(username);
    setInputPass("");
    setShowPassword(false);
    setSheetVisible(true);
  }, [username]);

  const handleSave = () => {
    const trimmed = inputUser.trim();
    if (!trimmed || !inputPass) {
      Toast.show({
        type: "error",
        text1: t("wlan.needCreds"),
        position: "bottom",
      });
      return;
    }
    save(trimmed, inputPass);
    setSheetVisible(false);
  };

  const handleConnect = useCallback(async () => {
    const cred = await getCredentials();
    if (!cred) {
      openSheet();
      return;
    }

    setConnecting(true);

    try {
      const msg = await login(cred.username, cred.password);
      Toast.show({
        type: "success",
        text1: msg ?? t("wlan.connectOk"),
        position: "bottom",
      });
    } catch (e: any) {
      if (e.message) {
        Toast.show({
          type: "error",
          text1: t("wlan.connectFail"),
          text2: e.message,
          position: "bottom",
        });
      } else {
        reportError(e, { module: "wlan" });
        Toast.show({
          type: "error",
          text1: t("wlan.connectFail"),
          text2: e.toString(),
          position: "bottom",
        });
      }
    } finally {
      setConnecting(false);
    }
  }, [getCredentials, openSheet, t]);

  const handleClear = () => {
    clear();
    setClearVisible(false);
    Toast.show({
      type: "success",
      text1: t("wlan.accountCleared"),
      position: "bottom",
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: t("wlan.title") }} />
      <ScrollView
        className="flex-1 bg-neutral-100 dark:bg-neutral-900"
        contentContainerClassName="px-4 pt-4 pb-8"
      >
        <View className="mb-4 items-center rounded-2xl bg-white py-16 dark:bg-neutral-800">
          <Pressable
            className="h-36 w-36 items-center justify-center rounded-full active:opacity-80"
            style={{
              backgroundColor: isDark ? "#2563eb" : "#007AFF",
              shadowColor: isDark ? "#2563eb" : "#007AFF",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 16,
              elevation: 12,
            }}
            onPress={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <ActivityIndicator size={48} color="#fff" />
            ) : (
              <Feather name="wifi" size={56} color="#fff" />
            )}
          </Pressable>
        </View>

        <MenuGroup title={t("wlan.accountGroup")}>
          {hasSaved ? (
            <>
              <MenuItem
                icon="person"
                iconBg="#007AFF"
                label={t("wlan.currentAccount")}
                value={username}
                showArrow={false}
              />
              <MenuItem
                icon="edit"
                iconBg="#FF9500"
                label={t("wlan.editAccount")}
                onPress={openSheet}
              />
              <MenuItem
                icon="delete-outline"
                iconBg="#FF3B30"
                label={t("wlan.clearAccount")}
                onPress={() => setClearVisible(true)}
              />
            </>
          ) : (
            <MenuItem
              icon="person-add"
              iconBg="#34C759"
              label={t("wlan.setupAccount")}
              onPress={openSheet}
            />
          )}
        </MenuGroup>
      </ScrollView>

      <BottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title={t("wlan.sheetTitle")}
      >
        <Text className="px-5 pb-4 text-sm text-neutral-500 dark:text-neutral-400">
          {t("wlan.sheetHint")}
        </Text>
        <View
          className="mx-5 mb-3 h-11 flex-row items-center rounded-xl px-3"
          style={{ backgroundColor: isDark ? "#262626" : "#f5f5f5" }}
        >
          <MaterialIcons
            name="person"
            size={18}
            color={isDark ? "#737373" : "#a3a3a3"}
          />
          <TextInput
            className="ml-2.5 flex-1 text-sm text-neutral-900 dark:text-neutral-100"
            placeholder={t("wlan.username")}
            placeholderTextColor={isDark ? "#525252" : "#d4d4d4"}
            value={inputUser}
            onChangeText={setInputUser}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </View>
        <View
          className="mx-5 mb-4 h-11 flex-row items-center rounded-xl px-3"
          style={{ backgroundColor: isDark ? "#262626" : "#f5f5f5" }}
        >
          <MaterialIcons
            name="lock"
            size={18}
            color={isDark ? "#737373" : "#a3a3a3"}
          />
          <TextInput
            ref={passwordRef}
            className="ml-2.5 flex-1 text-sm text-neutral-900 dark:text-neutral-100"
            placeholder={t("wlan.password")}
            placeholderTextColor={isDark ? "#525252" : "#d4d4d4"}
            value={inputPass}
            onChangeText={setInputPass}
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <Pressable
            className="p-1"
            onPress={() => setShowPassword(!showPassword)}
          >
            <Feather
              name={showPassword ? "eye" : "eye-off"}
              size={18}
              color={isDark ? "#737373" : "#a3a3a3"}
            />
          </Pressable>
        </View>
        <View className="mx-5 mb-2 flex-row gap-3">
          <Pressable
            className="flex-1 items-center rounded-xl bg-neutral-200 py-3 active:bg-neutral-300 dark:bg-neutral-700 dark:active:bg-neutral-600"
            onPress={() => setSheetVisible(false)}
          >
            <Text className="text-base font-medium text-neutral-600 dark:text-neutral-300">
              {t("wlan.cancel")}
            </Text>
          </Pressable>
          <Pressable
            className="flex-1 items-center rounded-xl bg-blue-500 py-3 active:bg-blue-600"
            onPress={handleSave}
          >
            <Text className="text-base font-medium text-white">
              {t("wlan.save")}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>

      <ConfirmSheet
        visible={clearVisible}
        onClose={() => setClearVisible(false)}
        title={t("wlan.clearTitle")}
        description={t("wlan.clearDesc")}
        confirmText={t("wlan.clearConfirm")}
        destructive
        onConfirm={handleClear}
      />
    </>
  );
}
