// Retained for Android 7–9 and system-managed reconnection after process death.
@file:Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")

package dev.tokenteam.iwut.notification

import android.content.ComponentName
import android.content.Context
import android.content.IntentFilter
import android.app.NotificationManager
import android.net.Uri
import android.os.Build
import android.service.notification.Condition
import android.service.notification.ConditionProviderService
import android.util.Log

class CourseDndConditionProvider : ConditionProviderService() {
    private val permissionReceiver = CourseDndReceiver()

    override fun onCreate() {
        super.onCreate()
        // This broadcast is delivered only to dynamically registered receivers.
        val filter = IntentFilter(NotificationManager.ACTION_NOTIFICATION_POLICY_ACCESS_GRANTED_CHANGED)
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(permissionReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(permissionReceiver, filter)
        }
    }

    override fun onConnected() {
        connected = this
        refresh()
    }

    override fun onSubscribe(conditionId: Uri) {
        if (conditionId == CourseDndScheduler.conditionId(this)) refresh()
    }

    override fun onUnsubscribe(conditionId: Uri) {}

    override fun onDestroy() {
        if (connected === this) connected = null
        unregisterReceiver(permissionReceiver)
        super.onDestroy()
    }

    private fun refresh() {
        try {
            CourseDndScheduler.refresh(this)
        } catch (error: Exception) {
            Log.w("CourseDnd", "Unable to refresh rule", error)
        }
    }

    companion object {
        @Volatile private var connected: CourseDndConditionProvider? = null

        fun publish(context: Context, condition: Condition) {
            val service = connected
            if (service != null) {
                service.notifyCondition(condition)
            } else {
                requestRebind(ComponentName(context, CourseDndConditionProvider::class.java))
            }
        }
    }
}
