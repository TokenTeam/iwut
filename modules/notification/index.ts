import { requireNativeModule } from "expo-modules-core";

interface NotificationNativeModule {
  requestAuthorization?: () => Promise<boolean>;

  createChannel(id: string, name: string, description: string): Promise<void>;

  showCountdown(
    id: number,
    channelId: string,
    title: string,
    body: string,
    targetTimeMs: number,
    ongoing: boolean,
    autoDismiss: boolean,
  ): Promise<void>;

  scheduleCountdown(
    id: number,
    channelId: string,
    title: string,
    body: string,
    triggerAtMs: number,
    targetTimeMs: number,
    ongoing: boolean,
    autoDismiss: boolean,
  ): Promise<void>;

  scheduleNotification?: (
    id: number,
    channelId: string,
    title: string,
    body: string,
    triggerAtMs: number,
  ) => Promise<void>;

  cancel(id: number): Promise<void>;

  cancelAll(): Promise<void>;
}

const NativeModule =
  requireNativeModule<NotificationNativeModule>("Notification");

export const createChannel = NativeModule.createChannel;
export const requestAuthorization =
  NativeModule.requestAuthorization ?? (async () => true);
export const showCountdown = NativeModule.showCountdown;
export const scheduleCountdown = NativeModule.scheduleCountdown;
export const scheduleNotification =
  NativeModule.scheduleNotification ?? (async () => {});
export const cancel = NativeModule.cancel;
export const cancelAll = NativeModule.cancelAll;
