import { BlurTargetView, type BlurViewProps } from "expo-blur";
import { createContext, useContext, useRef, type ReactNode } from "react";
import { Platform, StyleSheet, type View } from "react-native";

type BlurTargetRef = React.RefObject<View | null>;

const AppBlurTargetContext = createContext<BlurTargetRef | undefined>(
  undefined,
);

export function AppBlurTargetProvider({ children }: { children: ReactNode }) {
  const targetRef = useRef<View | null>(null);

  return (
    <AppBlurTargetContext.Provider value={targetRef}>
      {Platform.OS === "android" ? (
        <BlurTargetView ref={targetRef} style={styles.container}>
          {children}
        </BlurTargetView>
      ) : (
        children
      )}
    </AppBlurTargetContext.Provider>
  );
}

export function useAndroidBlurTarget() {
  const targetRef = useContext(AppBlurTargetContext);
  return Platform.OS === "android" ? targetRef : undefined;
}

export function getAndroidBlurProps(
  blurTarget: BlurTargetRef | undefined,
): Pick<BlurViewProps, "blurMethod" | "blurTarget"> {
  return Platform.OS === "android" && blurTarget
    ? {
        blurMethod: "dimezisBlurViewSdk31Plus",
        blurTarget,
      }
    : {};
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
