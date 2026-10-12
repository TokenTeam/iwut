package dev.tokenteam.iwut.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/** Works without React Native running, including after reboot or an application update. */
class CourseDndReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        try {
            CourseDndScheduler.refresh(context)
        } catch (error: Exception) {
            Log.w("CourseDnd", "Unable to refresh schedule after ${intent.action}", error)
        }
    }
}
