import { requireNativeModule } from "expo-modules-core";

interface ResetNativeModule {
  resetNativeData(): Promise<void>;
}

const ResetModule = requireNativeModule<ResetNativeModule>("Reset");

export async function resetNativeData(): Promise<void> {
  await ResetModule.resetNativeData();
}
