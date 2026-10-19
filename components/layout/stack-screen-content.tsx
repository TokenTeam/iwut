import type { ReactNode } from "react";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-screens/experimental";

export function StackScreenContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={className} style={{ flex: 1 }}>
      {/* 使用当前原生页面的安全区域避让导航栏 */}
      <SafeAreaView
        style={{ flex: 1, minHeight: 0 }}
        edges={{
          top: Platform.OS === "ios",
          bottom: Platform.OS === "ios",
          left: Platform.OS === "ios",
          right: Platform.OS === "ios",
        }}
      >
        {children}
      </SafeAreaView>
    </View>
  );
}
