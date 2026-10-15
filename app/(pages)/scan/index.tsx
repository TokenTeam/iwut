import { Ionicons } from "@expo/vector-icons";
import {
  type BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { Redirect, router, Stack, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHaptics } from "@/hooks/use-haptics";
import { useT } from "@/lib/i18n";
import { reportError } from "@/lib/report";

export default function ScanRoute() {
  const params = useLocalSearchParams<{ data?: string | string[] }>();
  const data = getFirstParam(params.data);

  if (data !== null) {
    return (
      <Redirect href={{ pathname: "/share" as never, params: { data } }} />
    );
  }

  return <ScanScreen />;
}

function ScanScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();

  useEffect(() => {
    if (!permission) {
      void requestPermission().catch((error) => {
        reportError(error, { module: "scan", stage: "permission" });
      });
    }
  }, [permission, requestPermission]);

  return (
    <View style={{ flex: 1, backgroundColor: "black" }}>
      <Stack.Screen options={{ headerShown: false }} />
      {permission?.granted ? (
        focused && <ScanCamera />
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
    </View>
  );
}

function ScanCamera() {
  const haptic = useHaptics();
  const scanLockedRef = useRef(false);
  const invalidEventReportedRef = useRef(false);

  useEffect(() => {
    scanLockedRef.current = false;
    console.info("[scan] Camera mounted");
    return () => {
      scanLockedRef.current = true;
      console.info("[scan] Camera unmounted");
    };
  }, []);

  const handleScanned = useCallback(
    (scan: BarcodeScanningResult) => {
      if (scanLockedRef.current) return;
      if (!scan.data) {
        if (!invalidEventReportedRef.current) {
          invalidEventReportedRef.current = true;
          reportError(new Error("Barcode event has no data"), {
            module: "scan",
            stage: "barcode-event",
            keys: Object.keys(scan),
          });
        }
        return;
      }
      scanLockedRef.current = true;
      console.info("[scan] Barcode received");
      router.push({
        pathname: "/share" as never,
        params: { data: scan.data },
      });
      haptic();
    },
    [haptic],
  );

  return (
    <CameraView
      style={{ flex: 1 }}
      facing="back"
      mode="picture"
      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      onBarcodeScanned={handleScanned}
      onCameraReady={() => console.info("[scan] Camera ready")}
      onMountError={({ message }) => {
        reportError(new Error(message), {
          module: "scan",
          stage: "camera-mount",
        });
      }}
    />
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
