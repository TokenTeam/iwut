import type { ReactNode } from "react";
import { Platform, Text, View } from "react-native";

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  title?: string;
  children: ReactNode;
}

export function BottomSheetContent({
  title,
  children,
}: Readonly<Pick<BottomSheetProps, "title" | "children">>) {
  return (
    <View
      collapsable={false}
      style={{ paddingTop: Platform.OS === "ios" ? 32 : 0 }}
    >
      {Platform.OS === "android" && (
        <View
          pointerEvents="none"
          accessible={false}
          className="bg-neutral-300 dark:bg-neutral-600"
          style={{
            alignSelf: "center",
            width: 36,
            height: 4,
            borderRadius: 2,
            marginTop: 8,
            marginBottom: 12,
          }}
        />
      )}
      {title && (
        <Text
          accessibilityRole="header"
          className="px-5 pb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100"
        >
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}
