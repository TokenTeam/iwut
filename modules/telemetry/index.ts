import { requireNativeModule } from "expo-modules-core";

interface TelemetryNativeModule {
  isEnabled(): boolean;
  setEnabled(enabled: boolean): Promise<void>;
}

export const Telemetry =
  requireNativeModule<TelemetryNativeModule>("Telemetry");
