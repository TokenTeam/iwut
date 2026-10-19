import { FlashList } from "@shopify/flash-list";
import * as Clipboard from "expo-clipboard";
import { Redirect, Stack } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { StackScreenContent } from "@/components/layout/stack-screen-content";
import { Highlight } from "@/components/ui/highlight";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { IS_DEV } from "@/constants/is-dev";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import {
  clearLogs,
  getLogs,
  type LogEntry,
  type LogLevelName,
  subscribeLogs,
} from "@/lib/log-buffer";
import { useDeveloperOptionsStore } from "@/store/developer-options";

const LEVELS = ["all", "debug", "info", "warn", "error"] as const;
const LEVEL_COLORS: Record<"light" | "dark", Record<LogLevelName, string>> = {
  light: {
    debug: "#525252",
    info: "#0369A1",
    warn: "#A16207",
    error: "#DC2626",
  },
  dark: {
    debug: "#A3A3A3",
    info: "#38BDF8",
    warn: "#FACC15",
    error: "#F87171",
  },
};
const mono = Platform.OS === "ios" ? "Menlo" : "monospace";
const keyExtractor = (entry: LogEntry) => String(entry.id);

const LogRow = memo(function LogRow({
  entry,
  onOpen,
}: {
  entry: LogEntry;
  onOpen: (entry: LogEntry) => void;
}) {
  const colors = LEVEL_COLORS[useColorScheme() === "dark" ? "dark" : "light"];
  const color = colors[entry.level];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(entry)}
      className="border-b border-neutral-200 px-4 py-3 active:bg-neutral-100 dark:border-neutral-800 dark:active:bg-neutral-800"
      style={{ height: 98, borderLeftWidth: 3, borderLeftColor: color }}
    >
      <View className="mb-2 flex-row items-center gap-2">
        <Text className="text-xs text-neutral-500" style={{ fontFamily: mono }}>
          {entry.time}
        </Text>
        <Text
          className="text-xs font-semibold"
          style={{
            color,
            backgroundColor: `${color}18`,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
          }}
        >
          {entry.level.toUpperCase()}
        </Text>
        <Text
          numberOfLines={1}
          className="flex-1 text-xs text-neutral-600 dark:text-neutral-400"
        >
          {entry.module}
        </Text>
      </View>
      <Text
        numberOfLines={2}
        className="text-xs text-neutral-900 dark:text-neutral-100"
        style={{ fontFamily: mono, lineHeight: 20 }}
      >
        <Highlight text={entry.preview} language="json" />
      </Text>
    </Pressable>
  );
});

export default function DeveloperLogsScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const focused = useIsFocused();
  const enabled = useDeveloperOptionsStore((s) => s.enabled);
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === "dark";
  const iconColor = dark ? "#F5F5F5" : "#262626";
  const levelColors = LEVEL_COLORS[dark ? "dark" : "light"];
  const [logs, setLogs] = useState(getLogs);
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("all");
  const [selected, setSelected] = useState<LogEntry | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const allowed = IS_DEV && enabled;

  useEffect(() => {
    if (!allowed || !focused || paused || selected) return;
    const refresh = () => setLogs(getLogs());
    const unsubscribe = subscribeLogs(refresh);
    refresh();
    return unsubscribe;
  }, [allowed, focused, paused, selected]);

  const filtered = useMemo(
    () =>
      logs.filter(
        (entry) =>
          (level === "all" || entry.level === level) &&
          (!deferredQuery ||
            entry.message.toLowerCase().includes(deferredQuery) ||
            entry.module.toLowerCase().includes(deferredQuery)),
      ),
    [logs, level, deferredQuery],
  );
  const renderItem = useCallback(
    ({ item }: { item: LogEntry }) => (
      <LogRow entry={item} onOpen={setSelected} />
    ),
    [],
  );
  const handleClear = () => {
    clearLogs();
    setLogs(getLogs());
  };
  const handleCopy = async () => {
    if (!selected) return;
    try {
      await Clipboard.setStringAsync(
        `${selected.time} [${selected.level.toUpperCase()}] ${selected.module}\n${selected.message}`,
      );
      Toast.show({ type: "success", text1: t("developer.logsCopied") });
    } catch {
      Toast.show({ type: "error", text1: t("developer.logsCopyFailed") });
    }
  };

  if (!allowed) return <Redirect href="/(tabs)/user" />;

  return (
    <StackScreenContent className="bg-white dark:bg-neutral-900">
      <Stack.Screen options={{ title: t("developer.logsTitle") }} />
      <View
        className="border-b border-neutral-200 px-4 py-2 dark:border-neutral-800"
        style={{ flexShrink: 0 }}
      >
        <View className="flex-row items-center gap-2">
          <IconSymbol name="search" size={20} color={iconColor} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("developer.logsSearch")}
            placeholderTextColor="#737373"
            accessibilityLabel={t("developer.logsSearch")}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={200}
            className="h-11 flex-1 text-sm text-neutral-900 dark:text-neutral-100"
          />
          <Text className="text-xs text-neutral-500">{filtered.length}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              paused ? "developer.logsResume" : "developer.logsPause",
            )}
            accessibilityState={{ selected: paused }}
            onPress={() => setPaused((value) => !value)}
            className="h-11 w-11 items-center justify-center"
          >
            <IconSymbol
              name={paused ? "play-arrow" : "pause"}
              color={paused ? "#007AFF" : iconColor}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("developer.logsClear")}
            onPress={handleClear}
            className="h-11 w-11 items-center justify-center"
          >
            <IconSymbol name="delete-outline" color={iconColor} />
          </Pressable>
        </View>
        <View
          accessibilityRole="tablist"
          className="mt-1 flex-row overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800"
        >
          {LEVELS.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="tab"
              accessibilityState={{ selected: level === option }}
              onPress={() => setLevel(option)}
              className={`h-9 flex-1 items-center justify-center ${
                level === option ? "bg-neutral-300 dark:bg-neutral-600" : ""
              }`}
            >
              <Text
                className="text-xs font-medium text-neutral-900 dark:text-neutral-100"
                style={
                  option === "all" ? undefined : { color: levelColors[option] }
                }
              >
                {option === "all"
                  ? t("developer.logsAll")
                  : option.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FlashList
        style={{ flex: 1, minHeight: 0 }}
        contentInsetAdjustmentBehavior="never"
        data={filtered}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        maintainVisibleContentPosition={{ disabled: true }}
        onScrollBeginDrag={() => setPaused(true)}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: Platform.OS === "ios" ? 0 : insets.bottom,
        }}
        ListEmptyComponent={
          <Text className="py-12 text-center text-sm text-neutral-500">
            {t("developer.logsEmpty")}
          </Text>
        }
      />
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View
          className="flex-1 justify-center bg-black/50 px-4"
          style={{
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <View className="max-h-full rounded-lg bg-white dark:bg-neutral-900">
            <View className="flex-row items-start gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <View className="min-w-0 flex-1 gap-1">
                <View className="flex-row items-center gap-2">
                  {selected && (
                    <Text
                      className="text-xs font-semibold"
                      style={{
                        color: levelColors[selected.level],
                        backgroundColor: `${levelColors[selected.level]}18`,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      {selected.level.toUpperCase()}
                    </Text>
                  )}
                  <Text
                    selectable
                    numberOfLines={1}
                    className="flex-1 text-base font-semibold text-neutral-900 dark:text-neutral-100"
                  >
                    {selected?.module}
                  </Text>
                </View>
                <Text
                  selectable
                  className="text-xs text-neutral-500 dark:text-neutral-400"
                  style={{ fontFamily: mono, lineHeight: 18 }}
                >
                  {selected?.time}
                </Text>
              </View>
              <View className="-mr-2 flex-row">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("developer.logsCopy")}
                  onPress={handleCopy}
                  className="h-11 w-11 items-center justify-center"
                >
                  <IconSymbol name="content-copy" color={iconColor} size={20} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("developer.logsClose")}
                  onPress={() => setSelected(null)}
                  className="h-11 w-11 items-center justify-center"
                >
                  <IconSymbol name="close" color={iconColor} />
                </Pressable>
              </View>
            </View>
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ padding: 20 }}
            >
              {selected && (
                <Highlight
                  selectable
                  text={selected.message}
                  language="json"
                  style={{ fontFamily: mono, fontSize: 13, lineHeight: 22 }}
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </StackScreenContent>
  );
}
