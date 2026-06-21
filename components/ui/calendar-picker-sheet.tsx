import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getAndroidBlurProps,
  useAndroidBlurTarget,
} from "@/components/ui/app-blur-target";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { useT } from "@/lib/i18n";
import {
  APP_LOCAL_CALENDAR_ID,
  getWritableCalendars,
  type WritableCalendars
} from "@/services/calendar-sync";

const ENTER_MS = 300;
const EXIT_MS = 240;

export function CalendarPickerSheet({
  visible,
  onClose,
  onConfirm,
  initialData,
}: Readonly<{
  visible: boolean;
  onClose: () => void;
  onConfirm: (calendarIds: string[]) => void;
  /**
   * Calendars already fetched by the caller. When provided, the sheet renders
   * immediately instead of showing a spinner and re-enumerating calendars.
   */
  initialData?: WritableCalendars;
}>) {
  const t = useT();
  const haptic = useHaptics();
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const blurTarget = useAndroidBlurTarget();

  // ── Animation ────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(visible);
  const [prevVisible, setPrevVisible] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);
  // Extra downward offset (px) driven by the drag-to-dismiss gesture.
  const dragY = useSharedValue(0);
  const firstRunRef = useRef(true);

  // ── Data ─────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(!initialData);
  const [data, setData] = useState<WritableCalendars | null>(
    initialData ?? null,
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set([APP_LOCAL_CALENDAR_ID]),
  );

  // Reset state during render the moment the sheet opens (React's "adjust state
  // when a prop changes" pattern). Doing it here rather than in an effect avoids
  // a synchronous setState-in-effect and the extra render it would cause.
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setMounted(true);
      setSelected(new Set([APP_LOCAL_CALENDAR_ID]));
      setData(initialData ?? null);
      setLoading(!initialData);
    }
  }

  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    if (visible) {
      dragY.set(0);
      progress.set(
        withTiming(1, {
          duration: ENTER_MS,
          easing: Easing.out(Easing.cubic),
        }),
      );
    } else {
      progress.set(
        withTiming(
          0,
          { duration: EXIT_MS, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(setMounted)(false);
          },
        ),
      );
    }
  }, [visible, progress, dragY]);

  // Blur fades a little as the sheet is dragged down, for a natural feel.
  const overlayStyle = useAnimatedStyle(() => {
    const dragFade = 1 - Math.min(Math.max(dragY.value / 320, 0), 1);
    return { opacity: progress.value * dragFade };
  });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 400 + dragY.value }],
    opacity: progress.value,
  }));

  // Drag-to-dismiss: attached to the handle/title area so it doesn't fight the
  // scroll list below. Runs on the UI thread via gesture-handler + reanimated.
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .failOffsetX([-24, 24])
        .onChange((e) => {
          dragY.set(Math.max(0, e.translationY));
        })
        .onEnd((e) => {
          if (e.translationY > 120 || e.velocityY > 800) {
            // Past the dismiss threshold: let the exit animation slide it out
            // from the current dragged position.
            runOnJS(onClose)();
          } else {
            dragY.set(withTiming(0, { duration: 160 }));
          }
        }),
    [dragY, onClose],
  );

  // When the caller didn't pre-fetch calendars, enumerate them ourselves. The
  // state updates run after the await (inside the promise callbacks), so this
  // doesn't trip the set-state-in-effect rule the way a synchronous call would.
  useEffect(() => {
    if (!visible || initialData) return;
    let cancelled = false;
    getWritableCalendars()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData({ others: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, initialData]);

  const toggle = (id: string) => {
    haptic();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    haptic();
    onConfirm([...selected]);
  };

  const bgColor = isDark ? "#1c1c1e" : "#ffffff";

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Blur overlay covering the full screen including navbar */}
      <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
        <BlurView
          {...getAndroidBlurProps(blurTarget)}
          intensity={25}
          tint={isDark ? "dark" : "default"}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark
                ? "rgba(0,0,0,0.25)"
                : "rgba(0,0,0,0.12)",
            },
          ]}
          onPress={onClose}
        />
      </Animated.View>

      {/* Sheet sliding up from bottom */}
      <View style={[StyleSheet.absoluteFill, { justifyContent: "flex-end" }]} pointerEvents="box-none">
        <Animated.View
          layout={LinearTransition.duration(220).easing(
            Easing.out(Easing.cubic),
          )}
          style={[
            {
              backgroundColor: bgColor,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: insets.bottom || 24,
              maxHeight: "75%",
            },
            sheetStyle,
          ]}
        >
          {/* Draggable header: handle bar + title (drag down to dismiss) */}
          <GestureDetector gesture={panGesture}>
            <View>
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: isDark ? "#525252" : "#d4d4d4",
                  }}
                />
              </View>

              {/* Title */}
              <Text
                style={{
                  paddingHorizontal: 20,
                  paddingBottom: 12,
                  fontSize: 18,
                  fontWeight: "600",
                  color: isDark ? "#f5f5f5" : "#171717",
                }}
              >
                {t("calendarSet.pickerTitle")}
              </Text>
            </View>
          </GestureDetector>

          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <ActivityIndicator size="small" />
            </View>
          ) : (
            <>
              <Text
                style={{
                  paddingHorizontal: 20,
                  paddingBottom: 12,
                  fontSize: 12,
                  color: isDark ? "#737373" : "#a3a3a3",
                }}
              >
                {t("calendarSet.pickerHint")}
              </Text>

              <ScrollView
                style={{ maxHeight: 320 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
              >
                {/* Default local calendar option — always first */}
                <SectionLabel
                  label={t("calendarSet.pickerLocalGroup")}
                  isDark={isDark}
                  first
                />
                <CalendarRow
                  id={APP_LOCAL_CALENDAR_ID}
                  title={t("calendarSet.pickerLocal")}
                  subtitle="iwut"
                  color="#007AFF"
                  isSelected={selected.has(APP_LOCAL_CALENDAR_ID)}
                  onToggle={toggle}
                  isDark={isDark}
                  isFirst
                  isLast
                />

                {/* Other calendars (filtered to primary calendars on Android) */}
                {data && data.others.length > 0 && (
                  <>
                    <SectionLabel
                      label={t("calendarSet.pickerOther")}
                      isDark={isDark}
                    />
                    {data.others.map((cal, i) => (
                      <CalendarRow
                        key={cal.id}
                        id={cal.id}
                        title={cal.title}
                        subtitle={cal.accountName}
                        color={cal.color}
                        isSelected={selected.has(cal.id)}
                        onToggle={toggle}
                        isDark={isDark}
                        isFirst={i === 0}
                        isLast={i === data.others.length - 1}
                      />
                    ))}
                  </>
                )}
              </ScrollView>

              {/* Slow-sync warning when a non-local calendar is selected */}
              {[...selected].some((id) => id !== APP_LOCAL_CALENDAR_ID) && (
                <Animated.View
                  entering={FadeIn.duration(180)}
                  exiting={FadeOut.duration(140)}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 6,
                    marginHorizontal: 20,
                    marginTop: 4,
                    marginBottom: 4,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: isDark
                      ? "rgba(255,159,10,0.12)"
                      : "rgba(255,149,0,0.10)",
                  }}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={isDark ? "#ff9f0a" : "#c2410c"}
                    style={{ marginTop: 1 }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 12,
                      lineHeight: 17,
                      color: isDark ? "#fdba74" : "#9a3412",
                    }}
                  >
                    {t("calendarSet.pickerOtherWarning")}
                  </Text>
                </Animated.View>
              )}

              {/* Sync button */}
              <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
                <Pressable
                  style={{
                    alignItems: "center",
                    paddingVertical: 13,
                    borderRadius: 14,
                    backgroundColor:
                      selected.size > 0 ? "#007AFF" : isDark ? "#404040" : "#d4d4d4",
                  }}
                  disabled={selected.size === 0}
                  onPress={handleConfirm}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#ffffff",
                    }}
                  >
                    {t("calendarSet.pickerSync")}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </Animated.View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function SectionLabel({
  label,
  isDark,
  first,
}: {
  label: string;
  isDark: boolean;
  first?: boolean;
}) {
  return (
    <Text
      style={{
        marginTop: first ? 0 : 16,
        marginBottom: 6,
        fontSize: 11,
        fontWeight: "600",
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: isDark ? "#737373" : "#a3a3a3",
      }}
    >
      {label}
    </Text>
  );
}

function CalendarRow({
  id,
  title,
  subtitle,
  color,
  isSelected,
  onToggle,
  isDark,
  isFirst,
  isLast,
}: {
  id: string;
  title: string;
  subtitle: string;
  color: string | undefined;
  isSelected: boolean;
  onToggle: (id: string) => void;
  isDark: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <Pressable
      onPress={() => onToggle(id)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 13,
        backgroundColor: isDark ? "#2c2c2e" : "#f5f5f5",
        borderTopLeftRadius: isFirst ? 12 : 0,
        borderTopRightRadius: isFirst ? 12 : 0,
        borderBottomLeftRadius: isLast ? 12 : 0,
        borderBottomRightRadius: isLast ? 12 : 0,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: isDark ? "#3a3a3c" : "#e5e5e5",
      }}
    >
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: color || "#9ca3af",
          marginRight: 12,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 15,
            color: isDark ? "#f5f5f5" : "#1c1c1e",
          }}
        >
          {title}
        </Text>
        {subtitle.length > 0 && (
          <Text
            numberOfLines={1}
            style={{
              fontSize: 11,
              color: isDark ? "#737373" : "#a3a3a3",
              marginTop: 1,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <Ionicons
        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
        size={22}
        color={
          isSelected ? "#007AFF" : isDark ? "#525252" : "#d4d4d4"
        }
      />
    </Pressable>
  );
}
