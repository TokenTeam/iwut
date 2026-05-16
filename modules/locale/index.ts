import { requireNativeModule } from "expo-modules-core";

interface LocaleNativeModule {
  /**
   * Apply a per-app language preference at the OS level. This is what makes the
   * App display name (launcher icon label), system permission dialogs, and
   * other OS-rendered surfaces follow the user's in-app language choice rather
   * than the device-wide language.
   *
   * - Android: uses `AppCompatDelegate.setApplicationLocales`, which delegates
   *   to the Android 13+ `LocaleManager` when available and falls back to
   *   in-storage tracking on older versions. Takes effect immediately for new
   *   Activities; the launcher refreshes the app name on the next foreground.
   * - iOS: writes `AppleLanguages` to standard user defaults. The launcher
   *   label refreshes on the next cold start; permission dialogs that have not
   *   been shown yet pick up the new language on next trigger.
   *
   * Pass an empty string / null to clear the override and follow the system
   * language again.
   */
  setApplicationLocales(tag: string | null): Promise<void>;

  /**
   * Synchronously read the *device-level* preferred language as a BCP-47 tag,
   * bypassing any per-app locale override we may have set ourselves. Returns
   * `null` if the platform cannot resolve a language.
   *
   * This is the only reliable way to implement "follow system" when the user
   * has previously applied a per-app override: `expo-localization.getLocales()`
   * returns the *effective* locale (override applied), which would make
   * switching back to "system" appear to do nothing.
   */
  getSystemLanguageTag(): string | null;
}

const LocaleModule = requireNativeModule<LocaleNativeModule>("LocaleSwitcher");

/**
 * Set the application-level locale override. Tag must be a BCP-47 language tag
 * (e.g. "en", "zh-Hans"). Pass null or empty string to clear the override.
 */
export async function setApplicationLocales(tag: string | null): Promise<void> {
  await LocaleModule.setApplicationLocales(tag ?? null);
}

/**
 * Read the device-level system language as a BCP-47 tag, ignoring per-app
 * overrides. Returns `null` if unavailable.
 */
export function getSystemLanguageTag(): string | null {
  try {
    return LocaleModule.getSystemLanguageTag();
  } catch {
    return null;
  }
}
