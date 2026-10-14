package dev.tokenteam.iwut.wlan

import android.app.Activity
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Toast

class WlanShortcutActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            overrideActivityTransition(OVERRIDE_TRANSITION_OPEN, 0, 0)
            overrideActivityTransition(OVERRIDE_TRANSITION_CLOSE, 0, 0)
        } else {
            @Suppress("DEPRECATION")
            overridePendingTransition(0, 0)
        }

        val appContext = applicationContext
        val mainHandler = Handler(Looper.getMainLooper())

        val credentials = WlanCredentialStore(appContext).load()
        if (credentials == null) {
            showToast(R.string.wlan_no_credentials)
            finish()
            return
        }

        Thread {
            val message = try {
                val result = WlanAuthenticator(appContext).login(credentials)
                when (result.status) {
                    WlanAuthenticator.STATUS_CONNECTED -> R.string.wlan_connected
                    WlanAuthenticator.STATUS_ALREADY_ONLINE -> R.string.wlan_already_online
                    WlanAuthenticator.STATUS_NOT_ON_WIFI -> R.string.wlan_not_on_wifi
                    WlanAuthenticator.STATUS_AUTHENTICATION_FAILED ->
                        R.string.wlan_authentication_failed
                    else -> R.string.wlan_network_unavailable
                }
            } catch (error: Throwable) {
                R.string.wlan_network_unavailable
            }
            mainHandler.post { showToast(message) }
        }.start()

        finish()
    }

    override fun finish() {
        super.finish()
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            @Suppress("DEPRECATION")
            overridePendingTransition(0, 0)
        }
    }

    private fun showToast(message: Int) {
        Toast.makeText(applicationContext, message, Toast.LENGTH_LONG).show()
    }
}
