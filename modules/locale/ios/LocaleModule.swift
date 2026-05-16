import ExpoModulesCore
import Foundation

public class LocaleModule: Module {
    public func definition() -> ModuleDefinition {
        Name("LocaleSwitcher")

        AsyncFunction("setApplicationLocales") { (tag: String?) in
            let defaults = UserDefaults.standard
            if let tag = tag, !tag.isEmpty {
                defaults.set([tag], forKey: "AppleLanguages")
            } else {
                defaults.removeObject(forKey: "AppleLanguages")
            }
            // Force-sync so changes are persisted before the next launch read.
            defaults.synchronize()
        }

        // Returns the device-level preferred language tag, ignoring per-app
        // overrides written via `setApplicationLocales`. We use the global
        // CFPreferences API with `kCFPreferencesAnyApplication`, which reads
        // from the user's global domain rather than the current app's domain,
        // so it bypasses our own `AppleLanguages` override.
        //
        // Caveat: on iOS, per-app locale overrides only take effect on cold
        // launch anyway, so the value returned here is also the value that
        // will be effective on next launch when running in "system" mode.
        Function("getSystemLanguageTag") { () -> String? in
            let langs = CFPreferencesCopyValue(
                "AppleLanguages" as CFString,
                kCFPreferencesAnyApplication,
                kCFPreferencesCurrentUser,
                kCFPreferencesAnyHost
            ) as? [String]
            if let first = langs?.first, !first.isEmpty {
                return first
            }
            // Fallback: best-effort via NSLocale, may include our own override
            // but better than returning nil.
            return Locale.preferredLanguages.first
        }
    }
}
