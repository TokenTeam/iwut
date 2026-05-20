import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IS_DEV } from "@/constants/is-dev";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { type TKey, useT } from "@/lib/i18n";

type WebApp = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  labelKey: TKey;
  color: string;
  uri: string;
};

type Section = {
  titleKey: TKey;
  items: WebApp[];
};

const SECTIONS: Section[] = [
  {
    titleKey: "fn.section.study",
    items: [
      {
        icon: "book-outline",
        labelKey: "fn.app.classroom",
        color: "#0d9488",
        uri: "https://classroom-iwut.tokenteam.net",
      },
      {
        icon: "easel-outline",
        labelKey: "fn.app.icSpace",
        color: "#06b6d4",
        uri: "https://zhlgd.whut.edu.cn/tpass/login?service=https%3A%2F%2Fzw.whut.edu.cn%2Frem%2Fstatic%2Fsso%2FwebOAuthRed",
      },
      {
        icon: "school-outline",
        labelKey: "fn.app.jwxt",
        color: "#8b5cf6",
        uri: "https://zhlgd.whut.edu.cn/tpass/login?service=https%3A%2F%2Fjwxt.whut.edu.cn%2Fjwapp%2Fsys%2Fhomeapp%2Findex.do%3FforceCas%3D1",
      },
      {
        icon: "library-outline",
        labelKey: "fn.app.library",
        color: "#3b82f6",
        uri: "https://library-info-iwut.tokenteam.net",
      },
    ],
  },
  {
    titleKey: "fn.section.life",
    items: [
      {
        icon: "card-outline",
        labelKey: "fn.app.card",
        color: "#10b981",
        uri: "https://cardcare-iwut.tokenteam.net",
      },
      {
        icon: "flash-outline",
        labelKey: "fn.app.elec",
        color: "#eab308",
        uri: "https://zhlgd.whut.edu.cn/tpass/login?service=http://nyyzf.whut.edu.cn/MobileWebOnlineHall/#/",
      },
    ],
  },
  {
    titleKey: "fn.section.info",
    items: [
      {
        icon: "newspaper-outline",
        labelKey: "fn.app.campusNews",
        color: "#f97316",
        uri: "http://i.whut.edu.cn",
      },
    ],
  },
];

function openWebApp(uri: string) {
  router.push({ pathname: "/browser", params: { uri } });
}

export default function FunctionScreen() {
  const t = useT();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { height } = useWindowDimensions();
  const [showBrowser, setShowBrowser] = useState(false);
  const [uri, setUri] = useState("");

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pb-2 pt-8">
          <View className="flex-row items-center justify-between">
            <Text
              className="text-[32px] font-bold tracking-tight text-neutral-900 dark:text-neutral-50"
              numberOfLines={1}
            >
              {t("fn.title")}
            </Text>
            {IS_DEV && (
              <Pressable
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.04)",
                }}
                onPress={() => setShowBrowser(true)}
              >
                <Ionicons
                  name="globe-outline"
                  size={20}
                  color={isDark ? "#a3a3a3" : "#737373"}
                />
              </Pressable>
            )}
          </View>
          <Text className="mt-1.5 text-base text-neutral-400 dark:text-neutral-500">
            {t("fn.subtitle")}
          </Text>
        </View>

        <View className="mx-6 my-4 h-px bg-neutral-100 dark:bg-neutral-800/60" />

        {SECTIONS.map((section) => (
          <View key={section.titleKey} className="mb-5">
            <Text className="mb-3 px-6 text-base font-semibold text-neutral-800 dark:text-neutral-100">
              {t(section.titleKey)}
            </Text>
            <View className="flex-row flex-wrap px-2">
              {section.items.map((app) => (
                <AppItem
                  key={app.labelKey}
                  app={app}
                  label={t(app.labelKey)}
                  isDark={isDark}
                  onPress={() => openWebApp(app.uri)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {IS_DEV && (
        <Modal
          visible={showBrowser}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBrowser(false)}
        >
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <Pressable
              className="flex-1 bg-black/40"
              style={{ paddingTop: height * 0.3 }}
              onPress={() => setShowBrowser(false)}
            >
              <Pressable
                className="mx-8 rounded-3xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-800"
                onPress={() => {}}
              >
                <View className="mb-4 flex-row items-center gap-2">
                  <Ionicons name="globe-outline" size={20} color="#3b82f6" />
                  <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
                    {t("browser.openWeb")}
                  </Text>
                </View>
                <View className="h-12 flex-row items-center rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-700/50">
                  <TextInput
                    className="flex-1 text-base text-neutral-900 dark:text-neutral-100"
                    style={{
                      height: 48,
                      paddingHorizontal: 8,
                      textAlignVertical: "center",
                    }}
                    value={uri}
                    onChangeText={setUri}
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="go"
                    onSubmitEditing={() => {
                      setShowBrowser(false);
                      router.push({ pathname: "/browser", params: { uri } });
                    }}
                  />
                  <Pressable
                    className="mr-1.5 h-9 w-9 items-center justify-center rounded-xl bg-blue-500 active:bg-blue-600"
                    onPress={() => {
                      setShowBrowser(false);
                      router.push({ pathname: "/browser", params: { uri } });
                    }}
                  >
                    <Ionicons name="arrow-forward" size={20} color="white" />
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function AppItem({
  app,
  label,
  isDark,
  onPress,
}: {
  app: WebApp;
  label: string;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="w-1/5 items-center py-3"
      onPress={onPress}
      style={({ pressed }) => ({
        width: "20%",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: isDark ? `${app.color}18` : `${app.color}12`,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons name={app.icon} size={20} color={app.color} />
      </View>
      <Text
        className="mt-2 text-xs text-neutral-700 dark:text-neutral-300"
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
