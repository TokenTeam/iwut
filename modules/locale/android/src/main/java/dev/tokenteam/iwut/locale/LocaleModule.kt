package dev.tokenteam.iwut.locale

import android.app.LocaleManager
import android.content.res.Resources
import android.os.Build
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LocaleModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("LocaleSwitcher")

        AsyncFunction("setApplicationLocales") { tag: String? ->
            val locales = if (tag.isNullOrEmpty()) {
                LocaleListCompat.getEmptyLocaleList()
            } else {
                LocaleListCompat.forLanguageTags(tag)
            }
            AppCompatDelegate.setApplicationLocales(locales)
            null
        }

        // Returns the device-level system language tag, independent of any
        // per-app locale override set via `setApplicationLocales`.
        //
        // IMPORTANT: We must NOT rely on `Resources.getSystem().configuration`
        // here. On Android 13+, `AppCompatDelegate.setApplicationLocales`
        // updates the process-wide default Locale, which leaks into the
        // `Configuration` returned by `Resources.getSystem()` until the next
        // Activity recreate. That made switching back to "follow system"
        // appear to do nothing until the user backgrounded and reopened the
        // app (which triggers an Activity refresh).
        //
        // `LocaleManager.systemLocales` (API 33+) is the authoritative source
        // for the device-level locale list and is explicitly documented to
        // ignore per-app overrides. We use it whenever available and only
        // fall back to `Resources.getSystem()` on Android 12 and below, where
        // per-app locales do not exist at the OS level, so the system
        // Resources cannot be polluted by them.
        Function("getSystemLanguageTag") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val ctx = appContext.reactContext
                val lm = ctx?.getSystemService(LocaleManager::class.java)
                val systemLocales = lm?.systemLocales
                if (systemLocales != null && !systemLocales.isEmpty) {
                    return@Function systemLocales.get(0).toLanguageTag()
                }
            }
            val locales = Resources.getSystem().configuration.locales
            if (locales.isEmpty) null else locales.get(0).toLanguageTag()
        }
    }
}
