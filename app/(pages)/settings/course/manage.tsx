import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { DAY_LABELS } from "@/components/layout/schedule";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useCourseStore } from "@/store/course";

export default function ManageCourseScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";

  const courses = useCourseStore((s) => s.courses);
  const setCourses = useCourseStore((s) => s.setCourses);
  const removeCoursesByName = useCourseStore((s) => s.removeCoursesByName);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [clearVisible, setClearVisible] = useState(false);

  const uniqueCourses = useMemo(() => {
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
        summary: `${DAY_LABELS[c.day - 1]} 第${c.sectionStart}-${c.sectionEnd}节`,
        count: 1,
        imported: c.source === "imported",
      });
    }
    return [...map.values()];
  }, [courses]);

  const handleDelete = (name: string) => setDeleteTarget(name);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    removeCoursesByName(deleteTarget);
    Toast.show({
      type: "success",
      text1: `已删除「${deleteTarget}」`,
      position: "bottom",
    });
    setDeleteTarget(null);
  };

  return (
    <>
      <Stack.Screen options={{ title: "课程管理" }} />
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
            添加课程
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
                            导入
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                      {item.teacher ? `${item.teacher} · ` : ""}
                      {item.summary}
                      {item.count > 1 ? ` 等 ${item.count} 个时段` : ""}
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
              暂无课程，点击上方按钮添加
            </Text>
          </View>
        )}

        {courses.length > 0 && (
          <Pressable
            className="mt-4 items-center rounded-xl bg-white py-3.5 active:bg-neutral-50 dark:bg-neutral-800 dark:active:bg-neutral-700"
            onPress={() => setClearVisible(true)}
          >
            <Text className="text-sm font-medium text-red-500">清空课表</Text>
          </Pressable>
        )}
      </ScrollView>

      <ConfirmSheet
        visible={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="删除课程"
        description={`确定要删除「${deleteTarget}」的所有时段吗？`}
        confirmText="删除"
        destructive
        onConfirm={confirmDelete}
      />

      <ConfirmSheet
        visible={clearVisible}
        onClose={() => setClearVisible(false)}
        title="清空课表"
        description="确定要删除所有课程吗？此操作不可恢复。"
        confirmText="清空"
        destructive
        onConfirm={() => {
          setCourses([]);
          setClearVisible(false);
          Toast.show({
            type: "success",
            text1: "课表已清空",
            position: "bottom",
          });
        }}
      />
    </>
  );
}
