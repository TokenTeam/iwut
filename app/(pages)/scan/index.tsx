import { Ionicons } from "@expo/vector-icons";
import {
  type BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useHaptics } from "@/hooks/use-haptics";
import { useT } from "@/lib/i18n";
import { type ResolvedScanAction, resolveScanAction } from "@/lib/scan";

export default function ScanScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const haptic = useHaptics();
  const params = useLocalSearchParams<{ data?: string | string[] }>();
  const initialData = getFirstParam(params.data);
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<ResolvedScanAction | null>(() =>
    initialData ? resolveScanAction(initialData, { t }) : null,
  );
  const [executing, setExecuting] = useState(false);
  // Skip re-resolving the same code after "scan again" while it's still in frame.
  const lastDataRef = useRef<string | null>(initialData ?? null);

  useEffect(() => {
    if (!permission && !result) {
      void requestPermission();
    }
  }, [permission, requestPermission, result]);

  const reset = () => {
    if (executing) return;
    setResult(null);
  };

  const handleScanned = useCallback(
    (scan: BarcodeScanningResult) => {
      if (result || executing) return;
      if (scan.data === lastDataRef.current) return;
      lastDataRef.current = scan.data;
      haptic();
      setResult(resolveScanAction(scan.data, { t }));
    },
    [executing, haptic, result, t],
  );

  const execute = async () => {
    if (!result || result.status !== "matched") return;
    setExecuting(true);
    try {
      const next = await result.handler.execute(result.envelope, { t });
      Toast.show({
        type: "success",
        text1: next.title,
        text2: next.description,
        position: "bottom",
      });
      setResult(null);
      leaveScan();
    } catch {
      Toast.show({
        type: "error",
        text1: t("scan.executeFailed"),
        position: "bottom",
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "black" }}>
      <Stack.Screen options={{ headerShown: false }} />
      {permission?.granted ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={result || executing ? undefined : handleScanned}
        />
      ) : (
        <PermissionState
          loading={!permission}
          denied={!!permission && !permission.granted}
          canAskAgain={permission?.canAskAgain ?? true}
          onRequest={requestPermission}
        />
      )}

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 28,
          justifyContent: "space-between",
        }}
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            className="h-11 w-11 items-center justify-center rounded-full bg-black/45 active:bg-black/60"
            onPress={leaveScan}
          >
            <Ionicons name="chevron-back" size={24} color="white" />
          </Pressable>
          <Text className="text-lg font-semibold text-white">
            {t("scan.title")}
          </Text>
          <View className="h-11 w-11" />
        </View>

        {permission?.granted ? (
          <View className="items-center" pointerEvents="none">
            <View
              style={{
                width: 256,
                height: 256,
                borderWidth: 2,
                borderColor: "rgba(255,255,255,0.88)",
                borderRadius: 28,
                backgroundColor: "rgba(0,0,0,0.08)",
              }}
            />
            <Text className="mt-5 text-center text-sm text-white/85">
              {t("scan.hint")}
            </Text>
          </View>
        ) : (
          <View />
        )}

        <View />
      </View>

      <ScanResultSheet
        result={result}
        executing={executing}
        onClose={reset}
        onConfirm={execute}
      />
    </View>
  );
}

function leaveScan() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}

function getFirstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function PermissionState({
  loading,
  denied,
  canAskAgain,
  onRequest,
}: {
  loading: boolean;
  denied: boolean;
  canAskAgain: boolean;
  onRequest: () => void;
}) {
  const t = useT();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center px-8">
      <Ionicons name="camera-outline" size={44} color="white" />
      <Text className="mt-4 text-center text-lg font-semibold text-white">
        {t("scan.permissionTitle")}
      </Text>
      <Text className="mt-2 text-center text-sm leading-5 text-white/70">
        {denied && !canAskAgain
          ? t("scan.permissionDenied")
          : t("scan.permissionDesc")}
      </Text>
      <Pressable
        className="mt-6 rounded-full bg-white px-5 py-3 active:bg-neutral-200"
        onPress={() => {
          if (denied && !canAskAgain) {
            Linking.openSettings().catch(() => {});
            return;
          }
          onRequest();
        }}
      >
        <Text className="font-semibold text-neutral-900">
          {denied && !canAskAgain
            ? t("scan.openSettings")
            : t("scan.grantPermission")}
        </Text>
      </Pressable>
    </View>
  );
}

function ScanResultSheet({
  result,
  executing,
  onClose,
  onConfirm,
}: {
  result: ResolvedScanAction | null;
  executing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const haptic = useHaptics();
  const invalid = result?.status === "invalid" ? result : null;
  const matched = result?.status === "matched" ? result : null;
  const title = matched?.preview.title ?? t("scan.invalidTitle");

  return (
    <BottomSheet visible={!!result} onClose={onClose} title={title}>
      {matched ? (
        <>
          <Text className="px-5 pb-4 text-sm leading-5 text-neutral-500 dark:text-neutral-400">
            {matched.preview.description}
          </Text>
          {matched.preview.details && (
            <View className="mx-5 mb-4 overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-900">
              {matched.preview.details.map((item, index) => (
                <View key={`${item.label}-${index}`}>
                  {index > 0 && (
                    <View className="mx-4 border-b border-neutral-200 dark:border-neutral-700" />
                  )}
                  <View className="flex-row items-center px-4 py-3">
                    <Text className="w-24 text-sm text-neutral-500 dark:text-neutral-400">
                      {item.label}
                    </Text>
                    <Text
                      className="flex-1 text-right text-sm font-medium text-neutral-900 dark:text-neutral-100"
                      numberOfLines={2}
                    >
                      {item.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          <View className="mx-5 mb-2 flex-row gap-3">
            <Pressable
              className="flex-1 items-center rounded-xl bg-neutral-200 py-3 active:bg-neutral-300 dark:bg-neutral-700 dark:active:bg-neutral-600"
              disabled={executing}
              onPress={() => {
                haptic();
                onClose();
              }}
            >
              <Text className="text-base font-medium text-neutral-600 dark:text-neutral-300">
                {t("scan.scanAgain")}
              </Text>
            </Pressable>
            <Pressable
              className="flex-1 items-center rounded-xl bg-blue-500 py-3 active:bg-blue-600"
              disabled={executing}
              onPress={() => {
                haptic();
                onConfirm();
              }}
            >
              <Text className="text-base font-medium text-white">
                {executing ? t("common.loading") : matched.preview.confirmText}
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text className="px-5 pb-4 text-sm leading-5 text-neutral-500 dark:text-neutral-400">
            {invalid ? invalidReasonText(invalid.reason, t) : ""}
          </Text>
          {!!invalid?.raw && (
            <Text
              selectable
              numberOfLines={3}
              className="mx-5 mb-4 rounded-xl bg-neutral-100 p-3 text-xs text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400"
            >
              {invalid.raw}
            </Text>
          )}
          <View className="mx-5 mb-2">
            <Pressable
              className="items-center rounded-xl bg-blue-500 py-3 active:bg-blue-600"
              onPress={() => {
                haptic();
                onClose();
              }}
            >
              <Text className="text-base font-medium text-white">
                {t("scan.scanAgain")}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </BottomSheet>
  );
}

function invalidReasonText(
  reason: Extract<ResolvedScanAction, { status: "invalid" }>["reason"],
  t: ReturnType<typeof useT>,
): string {
  switch (reason) {
    case "empty":
      return t("scan.invalidEmpty");
    case "tooLarge":
      return t("scan.invalidTooLarge");
    case "unsupported":
      return t("scan.invalidUnsupported");
    case "noHandler":
      return t("scan.invalidNoHandler");
    default:
      return t("scan.invalidMalformed");
  }
}
