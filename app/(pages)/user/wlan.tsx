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
import { reportError } from "@/lib/report";
import { login } from "@/services/wlan";
import { useWlanStore } from "@/store/wlan";

export default function WlanScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const { hasSaved, username, save, clear, getCredentials } = useWlanStore();

  const [sheetVisible, setSheetVisible] = useState(false);
  const [clearVisible, setClearVisible] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [inputUser, setInputUser] = useState("");
  const [inputPass, setInputPass] = useState("");
  const passwordRef = useRef<TextInput>(null);

  const openSheet = useCallback(() => {
    setInputUser(username);
    setInputPass("");
    setSheetVisible(true);
  }, [username]);

  const handleSave = () => {
    const trimmed = inputUser.trim();
    if (!trimmed || !inputPass) {
      Toast.show({
        type: "error",
        text1: "请输入账号和密码",
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
        text1: msg ?? "网络通畅，无需连接",
        position: "bottom",
      });
    } catch (e: any) {
      reportError(e, { module: "wlan" });
      Toast.show({
        type: "error",
        text1: "连接失败",
        text2: e.message,
        position: "bottom",
      });
    } finally {
      setConnecting(false);
    }
  }, [getCredentials, openSheet]);

  const handleClear = () => {
    clear();
    setClearVisible(false);
    Toast.show({
      type: "success",
      text1: "账号已清除",
      position: "bottom",
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: "校园网连接" }} />
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

        <MenuGroup title="账号">
          {hasSaved ? (
            <>
              <MenuItem
                icon="person"
                iconBg="#007AFF"
                label="当前账号"
                value={username}
                showArrow={false}
              />
              <MenuItem
                icon="edit"
                iconBg="#FF9500"
                label="修改账号"
                onPress={openSheet}
              />
              <MenuItem
                icon="delete-outline"
                iconBg="#FF3B30"
                label="清除账号"
                onPress={() => setClearVisible(true)}
              />
            </>
          ) : (
            <MenuItem
              icon="person-add"
              iconBg="#34C759"
              label="设置校园网账号"
              onPress={openSheet}
            />
          )}
        </MenuGroup>
      </ScrollView>

      <BottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title="校园网账号"
      >
        <Text className="px-5 pb-4 text-sm text-neutral-500 dark:text-neutral-400">
          输入校园网账号和密码，保存后可一键连接。
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
            placeholder="账号"
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
            placeholder="密码"
            placeholderTextColor={isDark ? "#525252" : "#d4d4d4"}
            value={inputPass}
            onChangeText={setInputPass}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
        </View>
        <View className="mx-5 mb-2 flex-row gap-3">
          <Pressable
            className="flex-1 items-center rounded-xl bg-neutral-200 py-3 active:bg-neutral-300 dark:bg-neutral-700 dark:active:bg-neutral-600"
            onPress={() => setSheetVisible(false)}
          >
            <Text className="text-base font-medium text-neutral-600 dark:text-neutral-300">
              取消
            </Text>
          </Pressable>
          <Pressable
            className="flex-1 items-center rounded-xl bg-blue-500 py-3 active:bg-blue-600"
            onPress={handleSave}
          >
            <Text className="text-base font-medium text-white">保存</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <ConfirmSheet
        visible={clearVisible}
        onClose={() => setClearVisible(false)}
        title="清除账号"
        description="确定要清除已保存的校园网账号吗？"
        confirmText="确认清除"
        destructive
        onConfirm={handleClear}
      />
    </>
  );
}
