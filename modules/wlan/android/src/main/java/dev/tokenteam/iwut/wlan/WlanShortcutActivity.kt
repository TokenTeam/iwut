package dev.tokenteam.iwut.wlan

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Toast

class WlanShortcutActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

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

    private fun showToast(message: Int) {
        Toast.makeText(applicationContext, message, Toast.LENGTH_LONG).show()
    }
}
