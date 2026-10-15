import { BottomSheet as NativeBottomSheet, Host, RNHostView } from "@expo/ui";

import { useColorScheme } from "@/hooks/use-color-scheme";

import {
  BottomSheetContent,
  type BottomSheetProps,
} from "./bottom-sheet-content";

export function BottomSheet(props: Readonly<BottomSheetProps>) {
  const colorScheme = useColorScheme();

  return (
    <Host
      style={{ position: "absolute" }}
      pointerEvents="none"
      colorScheme={colorScheme}
    >
      <NativeBottomSheet
        isPresented={props.visible}
        onDismiss={() => {
          props.onClose();
          props.onDismiss?.();
        }}
        contentPadding={0}
        containerColor={colorScheme === "dark" ? "#262626" : "#ffffff"}
      >
        <RNHostView matchContents={{ vertical: true }}>
          <BottomSheetContent title={props.title}>
            {props.children}
          </BottomSheetContent>
        </RNHostView>
      </NativeBottomSheet>
    </Host>
  );
}
