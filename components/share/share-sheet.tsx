import * as Clipboard from "expo-clipboard";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Share, Text, View } from "react-native";
import QRCode from "qrcode";
import { SvgXml } from "react-native-svg";
import Toast from "react-native-toast-message";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useHaptics } from "@/hooks/use-haptics";
import { useT } from "@/lib/i18n";
import {
  QR_SAFE_BYTE_LIMIT,
  type ScanEnvelope,
  utf8ByteLength,
} from "@/lib/scan";
import { buildShareArtifacts, resolveShortLink } from "@/lib/share";

export function ShareSheet({
  visible,
  onClose,
  title,
  description,
  envelope,
}: Readonly<{
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  envelope: ScanEnvelope;
}>) {
  const t = useT();
  const haptic = useHaptics();

  const { qrValue, deepLink } = useMemo(
    () => buildShareArtifacts(envelope),
    [envelope],
  );
  const tooLarge = utf8ByteLength(qrValue) > QR_SAFE_BYTE_LIMIT;

  const [shortLinkResult, setShortLinkResult] = useState<{
    key: string;
    url: string | null;
  } | null>(null);
  const shortLink =
    shortLinkResult?.key === qrValue ? shortLinkResult.url : null;
  const link = shortLink ?? deepLink;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    resolveShortLink(envelope)
      .then((url) => {
        if (!cancelled) setShortLinkResult({ key: qrValue, url });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [envelope, qrValue, visible]);

  const [qrResult, setQrResult] = useState<{
    value: string;
    svg: string | null;
  } | null>(null);
  const ready = qrResult?.value === qrValue ? qrResult : null;
  const qrSvg = ready?.svg ?? null;
  const failed = !!ready && ready.svg === null;

  useEffect(() => {
    if (!visible || tooLarge) return;
    let cancelled = false;

    QRCode.toString(qrValue, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 640,
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    })
      .then((svg) => {
        if (!cancelled) setQrResult({ value: qrValue, svg });
      })
      .catch(() => {
        if (!cancelled) setQrResult({ value: qrValue, svg: null });
      });

    return () => {
      cancelled = true;
    };
  }, [qrValue, tooLarge, visible]);

  const copy = async () => {
    haptic();
    await Clipboard.setStringAsync(link);
    Toast.show({
      type: "success",
      text1: t("share.codeCopied"),
      position: "bottom",
    });
  };

  const share = async () => {
    haptic();
    await Share.share({ message: link });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <Text className="px-5 pb-4 text-sm text-neutral-500 dark:text-neutral-400">
        {description}
      </Text>

      <View className="items-center px-5 pb-5">
        <View className="h-64 w-64 items-center justify-center rounded-2xl bg-white p-3">
          {tooLarge ? (
            <Text className="px-2 text-center text-sm leading-5 text-neutral-500">
              {t("share.codeTooLarge")}
            </Text>
          ) : qrSvg ? (
            <SvgXml xml={qrSvg} width={232} height={232} />
          ) : failed ? (
            <Text className="text-center text-sm text-red-500">
              {t("share.codeRenderFailed")}
            </Text>
          ) : (
            <ActivityIndicator />
          )}
        </View>
      </View>

      <View className="mx-5 mb-2 flex-row gap-3">
        <Pressable
          className="flex-1 items-center rounded-xl bg-neutral-200 py-3 active:bg-neutral-300 dark:bg-neutral-700 dark:active:bg-neutral-600"
          onPress={copy}
        >
          <Text className="text-base font-medium text-neutral-600 dark:text-neutral-300">
            {t("share.copyCode")}
          </Text>
        </Pressable>
        <Pressable
          className="flex-1 items-center rounded-xl bg-blue-500 py-3 active:bg-blue-600"
          onPress={share}
        >
          <Text className="text-base font-medium text-white">
            {t("share.shareCode")}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
