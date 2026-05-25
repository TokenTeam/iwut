package dev.tokenteam.iwut.wlan

import android.content.Intent
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WlanModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("Wlan")

        AsyncFunction("saveCredentials") { username: String, password: String ->
            val context = appContext.reactContext ?: return@AsyncFunction null
            WlanCredentialStore(context).save(username, password)
            null
        }

        AsyncFunction("clearCredentials") {
            val context = appContext.reactContext ?: return@AsyncFunction null
            WlanCredentialStore(context).clear()
            null
        }

        AsyncFunction("hasCredentials") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            WlanCredentialStore(context).load() != null
        }

        AsyncFunction("getSavedUsername") {
            val context = appContext.reactContext ?: return@AsyncFunction null
            WlanCredentialStore(context).load()?.username
        }

        AsyncFunction("login") {
            val context = appContext.reactContext
                ?: return@AsyncFunction mapOf("status" to WlanAuthenticator.STATUS_NETWORK_UNAVAILABLE)
            val credentials = WlanCredentialStore(context).load()
                ?: return@AsyncFunction mapOf("status" to "no-credentials")
            WlanAuthenticator(context).login(credentials).toMap()
        }

        AsyncFunction("requestPinnedShortcut") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            if (!ShortcutManagerCompat.isRequestPinShortcutSupported(context)) {
                return@AsyncFunction false
            }

            val intent = Intent(context, WlanShortcutActivity::class.java)
                .setAction(Intent.ACTION_VIEW)
            val shortcut = ShortcutInfoCompat.Builder(context, "wlan_login")
                .setShortLabel(context.getString(R.string.wlan_shortcut_label))
                .setIcon(IconCompat.createWithResource(context, R.drawable.ic_wlan_shortcut))
                .setIntent(intent)
                .build()

            ShortcutManagerCompat.requestPinShortcut(context, shortcut, null)
        }
    }
}
