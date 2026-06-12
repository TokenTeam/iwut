import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { getDayLabels } from "@/constants/weekdays";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import { useCourseStore } from "@/store/course";

export default function ManageCourseScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";

  const courses = useCourseStore((s) => s.courses);
  const setCourses = useCourseStore((s) => s.setCourses);
  const removeCoursesByName = useCourseStore((s) => s.removeCoursesByName);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [clearVisible, setClearVisible] = useState(false);

  const uniqueCourses = useMemo(() => {
    const dayLabels = getDayLabels();
    const map = new Map<
      string,
      {
        name: string;
        teacher: string;
        summary: string;
        count: number;
        imported: boolean;
      }
    >();
    for (const c of courses) {
      if (map.has(c.name)) {
        map.get(c.name)!.count++;
        continue;
      }
      map.set(c.name, {
        name: c.name,
        teacher: c.teacher,
        summary: t("courseManage.summaryWithDay", {
          weekday: dayLabels[c.day - 1],
          start: c.sectionStart,
          end: c.sectionEnd,
        }),
        count: 1,
        imported: c.source === "imported",
      });
    }
    return [...map.values()];
  }, [courses, t]);

  const handleDelete = (name: string) => setDeleteTarget(name);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    removeCoursesByName(deleteTarget);
    Toast.show({
      type: "success",
      text1: t("courseManage.deleted", { name: deleteTarget }),
      position: "bottom",
    });
    setDeleteTarget(null);
  };

  return (
    <>
      <Stack.Screen options={{ title: t("courseManage.title") }} />
      <ScrollView
        className="flex-1 bg-neutral-100 dark:bg-neutral-900"
        contentContainerClassName="px-4 pt-4 pb-8"
      >
        <Pressable
          className="mb-4 flex-row items-center justify-center rounded-xl bg-blue-500 py-3.5 active:bg-blue-600"
          onPress={() => router.push("/settings/course/add")}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text className="ml-1 text-base font-semibold text-white">
            {t("courseManage.addCourse")}
          </Text>
        </Pressable>

        {uniqueCourses.length > 0 ? (
          <View className="overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
            {uniqueCourses.map((item, index) => (
              <View key={item.name}>
                {index > 0 && (
                  <View className="mx-4 border-b border-neutral-200 dark:border-neutral-700" />
                )}
                <Pressable
                  className="flex-row items-center px-4 py-3.5 active:bg-neutral-50 dark:active:bg-neutral-700"
                  onPress={() =>
                    router.push(
                      `/settings/course/add?name=${encodeURIComponent(item.name)}`,
                    )
                  }
                >
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-base text-neutral-900 dark:text-neutral-100">
                        {item.name}
                      </Text>
                      {item.imported && (
                        <View className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 dark:bg-blue-900/40">
                          <Text className="text-[10px] font-medium text-blue-500 dark:text-blue-400">
                            {t("courseManage.importedTag")}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                      {item.teacher ? `${item.teacher} · ` : ""}
                      {item.summary}
                      {item.count > 1
                        ? t("courseManage.moreSlots", { n: item.count })
                        : ""}
                    </Text>
                  </View>
                  <Pressable
                    hitSlop={12}
                    onPress={() => handleDelete(item.name)}
                    className="mr-2"
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </Pressable>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={isDark ? "#525252" : "#a3a3a3"}
                  />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View className="items-center py-16">
            <Ionicons
              name="book-outline"
              size={48}
              color={isDark ? "#404040" : "#d4d4d4"}
            />
            <Text className="mt-3 text-sm text-neutral-400 dark:text-neutral-500">
              {t("courseManage.noCoursesHint")}
            </Text>
          </View>
        )}

        {courses.length > 0 && (
          <Pressable
            className="mt-4 items-center rounded-xl bg-white py-3.5 active:bg-neutral-50 dark:bg-neutral-800 dark:active:bg-neutral-700"
            onPress={() => setClearVisible(true)}
          >
            <Text className="text-sm font-medium text-red-500">
              {t("courseManage.clearAll")}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <ConfirmSheet
        visible={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("courseManage.deleteCourseTitle")}
        description={t("courseManage.deleteCourseDesc", {
          name: deleteTarget ?? "",
        })}
        confirmText={t("common.delete")}
        destructive
        onConfirm={confirmDelete}
      />

      <ConfirmSheet
        visible={clearVisible}
        onClose={() => setClearVisible(false)}
        title={t("courseManage.clearAllTitle")}
        description={t("courseManage.clearAllDesc")}
        confirmText={t("courseManage.clearAllConfirm")}
        destructive
        onConfirm={() => {
          setCourses([]);
          setClearVisible(false);
          Toast.show({
            type: "success",
            text1: t("courseManage.cleared"),
            position: "bottom",
          });
        }}
      />
    </>
  );
}
