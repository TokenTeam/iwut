import { requireNativeModule } from "expo-modules-core";

interface WidgetNativeModule {
  setWidgetData(key: string, json: string): Promise<void>;
  reloadWidgets(): Promise<void>;
}

const WidgetModule = requireNativeModule<WidgetNativeModule>("Widget");

export async function setWidgetData(
  key: string,
  data: Record<string, unknown>,
): Promise<void> {
  await WidgetModule.setWidgetData(key, JSON.stringify(data));
}

/**
 * Writes a raw string value to the widget's shared storage (no JSON wrapping).
 * Use this for scalar settings like the current language tag, which the
 * native widget code reads as a plain string.
 */
export async function setWidgetString(
  key: string,
  value: string,
): Promise<void> {
  await WidgetModule.setWidgetData(key, value);
}

export async function reloadWidgets(): Promise<void> {
  await WidgetModule.reloadWidgets();
}
