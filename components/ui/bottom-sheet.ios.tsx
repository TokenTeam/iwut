import { Host, RNHostView } from "@expo/ui";
import { BottomSheet as NativeBottomSheet, Group } from "@expo/ui/swift-ui";
import {
  fixedSize,
  frame,
  presentationBackground,
  presentationDragIndicator,
} from "@expo/ui/swift-ui/modifiers";

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
        fitToContents
        onIsPresentedChange={(presented) => {
          if (!presented) props.onClose();
        }}
        onDismiss={props.onDismiss}
      >
        <Group
          modifiers={[
            fixedSize({ horizontal: false, vertical: true }),
            frame({ maxWidth: Infinity, alignment: "topLeading" }),
            presentationDragIndicator("visible"),
            presentationBackground(
              colorScheme === "dark" ? "#262626" : "#ffffff",
            ),
          ]}
        >
          <RNHostView matchContents={{ vertical: true }}>
            <BottomSheetContent title={props.title}>
              {props.children}
            </BottomSheetContent>
          </RNHostView>
        </Group>
      </NativeBottomSheet>
    </Host>
  );
}
