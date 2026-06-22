import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import {
  getAndroidBlurProps,
  useAndroidBlurTarget,
} from "@/components/ui/app-blur-target";
import { getDayLabels } from "@/constants/weekdays";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useT } from "@/lib/i18n";
import { formatCourseSectionTimeRange } from "@/services/course-time";
import type { Course } from "@/store/course";

/**
 * 课程详情弹窗，课表页与首页共用。
 * 操作按钮按需显示：传入 onEdit / onShare / onAddAtSameSlot 才渲染对应按钮。
 */
export function CourseDetailModal({
  course,
  headerColor,
  showOtherWeekTag = false,
  onClose,
  onEdit,
  onShare,
  onAddAtSameSlot,
}: {
  course: Course | null;
  headerColor: string;
  showOtherWeekTag?: boolean;
  onClose: () => void;
  onEdit?: (course: Course) => void;
  onShare?: (course: Course) => void;
  onAddAtSameSlot?: (course: Course) => void;
}) {
  const t = useT();
  const isDark = useColorScheme() === "dark";
  const blurTarget = useAndroidBlurTarget();
  const dayLabels = getDayLabels();

  return (
    <Modal
      visible={!!course}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <BlurView
          {...getAndroidBlurProps(blurTarget)}
          intensity={30}
          tint="dark"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {course && (
          <View
            style={{
              width: 300,
              backgroundColor: isDark ? "#1c1c1e" : "#fff",
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                backgroundColor: headerColor,
                paddingHorizontal: 22,
                paddingTop: 22,
                paddingBottom: 18,
              }}
            >
              <Pressable
                onPress={onClose}
                style={{ position: "absolute", top: 12, right: 12 }}
                hitSlop={8}
              >
                <Ionicons
                  name="close-circle"
                  size={26}
                  color="rgba(255,255,255,0.7)"
                />
              </Pressable>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginRight: 28,
                }}
              >
                <Text
                  numberOfLines={2}
                  style={{
                    flexShrink: 1,
                    fontSize: 19,
                    fontWeight: "700",
                    color: "#fff",
                    lineHeight: 26,
                  }}
                >
                  {course.name}
                </Text>
                {showOtherWeekTag && (
                  <Text
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: "600",
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 4,
                      overflow: "hidden",
                      color: "#fff",
                      backgroundColor: "rgba(255,255,255,0.22)",
                    }}
                  >
                    {t("schedule.otherWeekTag")}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.8)",
                  marginTop: 6,
                }}
              >
                {t("schedule.weekdayWithSection", {
                  weekday: dayLabels[course.day - 1],
                  start: course.sectionStart,
                  end: course.sectionEnd,
                })}
              </Text>
            </View>

            <View style={{ padding: 20, gap: 14 }}>
              <DetailRow
                icon="location-outline"
                label={t("schedule.room")}
                value={course.room}
                isDark={isDark}
              />
              <DetailRow
                icon="person-outline"
                label={t("schedule.teacher")}
                value={course.teacher}
                isDark={isDark}
              />
              <DetailRow
                icon="calendar-outline"
                label={t("schedule.weeks")}
                value={t("schedule.weeksValue", {
                  start: course.weekStart,
                  end: course.weekEnd,
                })}
                isDark={isDark}
              />
              <DetailRow
                icon="time-outline"
                label={t("schedule.time")}
                value={
                  formatCourseSectionTimeRange(
                    course.sectionStart,
                    course.sectionEnd,
                  ) ||
                  t("schedule.sectionRange", {
                    start: course.sectionStart,
                    end: course.sectionEnd,
                  })
                }
                isDark={isDark}
              />
            </View>

            {(onEdit || onShare || onAddAtSameSlot) && (
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  paddingHorizontal: 16,
                  paddingBottom: 16,
                  paddingTop: 4,
                }}
              >
                {onEdit && (
                  <DetailActionButton
                    icon="create-outline"
                    label={t("common.edit")}
                    isDark={isDark}
                    onPress={() => onEdit(course)}
                  />
                )}
                {onShare && (
                  <DetailActionButton
                    icon="qr-code-outline"
                    label={t("common.share")}
                    isDark={isDark}
                    onPress={() => onShare(course)}
                  />
                )}
                {onAddAtSameSlot && (
                  <DetailActionButton
                    icon="add-circle-outline"
                    label={t("common.add")}
                    isDark={isDark}
                    onPress={() => onAddAtSameSlot(course)}
                  />
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

function DetailActionButton({
  icon,
  label,
  isDark,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 11,
        borderRadius: 12,
        backgroundColor: pressed
          ? isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.06)"
          : isDark
            ? "rgba(255,255,255,0.05)"
            : "rgba(0,0,0,0.04)",
      })}
    >
      <Ionicons name={icon} size={16} color={isDark ? "#d4d4d4" : "#525252"} />
      <Text
        style={{
          marginLeft: 6,
          fontSize: 13,
          fontWeight: "600",
          color: isDark ? "#d4d4d4" : "#525252",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DetailRow({
  icon,
  label,
  value,
  isDark,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  isDark: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.04)",
          justifyContent: "center",
          alignItems: "center",
          marginRight: 12,
        }}
      >
        <Ionicons
          name={icon}
          size={17}
          color={isDark ? "#a3a3a3" : "#737373"}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 11,
            color: isDark ? "#737373" : "#a3a3a3",
            marginBottom: 1,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 15,
            fontWeight: "500",
            color: isDark ? "#e5e5e5" : "#1c1c1e",
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}
