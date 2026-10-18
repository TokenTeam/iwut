import * as Sentry from "@sentry/react-native";
import { create } from "zustand";

import { Telemetry } from "@/modules/telemetry";

interface TelemetryStore {
  enabled: boolean;
  updating: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
}

// 原生设置用于在应用启动时恢复遥测状态
export const useTelemetryStore = create<TelemetryStore>((set, get) => ({
  enabled: Telemetry.isEnabled(),
  updating: false,
  setEnabled: async (enabled) => {
    const previous = get().enabled;
    if (get().updating || previous === enabled) return;
    set({ enabled, updating: true });
    const client = Sentry.getClient();
    const options = client?.getOptions();
    if (options && !enabled) options.enabled = false;
    try {
      await Telemetry.setEnabled(enabled);
      if (options) options.enabled = !__DEV__ && enabled;
      // 关闭时初始化的客户端需要在重新开启后安装集成
      if (enabled && !__DEV__ && client && options) {
        for (const integration of options.integrations) {
          client.addIntegration(integration);
        }
      }
    } catch (error) {
      set({ enabled: previous });
      if (options) options.enabled = !__DEV__ && previous;
      throw error;
    } finally {
      set({ updating: false });
    }
  },
}));
