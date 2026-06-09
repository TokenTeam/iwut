package dev.tokenteam.iwut.notification

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationModule : Module() {
    private val notificationManager: NotificationManager?
        get() = appContext.reactContext?.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager

    private val alarmManager: AlarmManager?
        get() = appContext.reactContext?.getSystemService(Context.ALARM_SERVICE) as? AlarmManager

    override fun definition() = ModuleDefinition {
        Name("Notification")

        AsyncFunction("createChannel") { id: String, name: String, description: String ->
            val manager = notificationManager ?: return@AsyncFunction null
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH).apply {
                    this.description = description
                }
                manager.createNotificationChannel(channel)
            }
            null
        }

        AsyncFunction("showCountdown") { id: Int, channelId: String, title: String, body: String, targetTimeMs: Double, ongoing: Boolean, autoDismiss: Boolean ->
            val context = appContext.reactContext ?: return@AsyncFunction null
            val target = targetTimeMs.toLong()

            val notification = buildCountdownNotification(context, channelId, title, body, target, ongoing, autoDismiss)
            notificationManager?.notify(id, notification)
            null
        }

        AsyncFunction("scheduleCountdown") { id: Int, channelId: String, title: String, body: String, triggerAtMs: Double, targetTimeMs: Double, ongoing: Boolean, autoDismiss: Boolean ->
            val context = appContext.reactContext ?: return@AsyncFunction null
            val trigger = triggerAtMs.toLong()

            val intent = Intent(context, CountdownReceiver::class.java).apply {
                action = CountdownReceiver.ACTION_SHOW_COUNTDOWN
                putExtra("id", id)
                putExtra("channelId", channelId)
                putExtra("title", title)
                putExtra("body", body)
                putExtra("targetTimeMs", targetTimeMs.toLong())
                putExtra("ongoing", ongoing)
                putExtra("autoDismiss", autoDismiss)
            }

            val pendingIntent = PendingIntent.getBroadcast(
                context, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            alarmManager?.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP, trigger, pendingIntent
            )

            trackScheduledId(context, id)
            null
        }

        AsyncFunction("cancel") { id: Int ->
            val context = appContext.reactContext ?: return@AsyncFunction null
            notificationManager?.cancel(id)
            cancelScheduledAlarm(context, id)
            removeTrackedId(context, id)
            null
        }

        AsyncFunction("cancelAll") {
            val context = appContext.reactContext ?: return@AsyncFunction null
            notificationManager?.cancelAll()
            cancelAllScheduledAlarms(context)
            null
        }
    }

    private fun buildCountdownNotification(
        context: Context,
        channelId: String,
        title: String,
        body: String,
        targetTimeMs: Long,
        ongoing: Boolean,
        autoDismiss: Boolean,
    ): android.app.Notification {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val contentIntent = PendingIntent.getActivity(
            context, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val timeoutMs = targetTimeMs - System.currentTimeMillis()

        val builder = NotificationCompat.Builder(context, channelId)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.drawable.ic_notification)
            .setWhen(targetTimeMs)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setOngoing(ongoing)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(contentIntent)
            .setAutoCancel(!ongoing)
            .apply {
                if (autoDismiss && timeoutMs > 0) setTimeoutAfter(timeoutMs)
            }

        if (Build.VERSION.SDK_INT >= 36) {
            builder.setRequestPromotedOngoing(true)
            builder.setShortCriticalText(body)
        }

        return builder.build()
    }

    private fun cancelScheduledAlarm(context: Context, id: Int) {
        val intent = Intent(context, CountdownReceiver::class.java).apply {
            action = CountdownReceiver.ACTION_SHOW_COUNTDOWN
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, id, intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        pendingIntent?.let {
            alarmManager?.cancel(it)
            it.cancel()
        }
    }

    private fun cancelAllScheduledAlarms(context: Context) {
        val ids = getTrackedIds(context)
        for (id in ids) {
            cancelScheduledAlarm(context, id)
        }
        cancelLegacySequentialAlarms(context)
        clearTrackedIds(context)
    }

    private fun cancelLegacySequentialAlarms(context: Context) {
        for (id in 0 until LEGACY_SEQUENTIAL_ID_LIMIT) {
            cancelScheduledAlarm(context, id)
        }
    }

    companion object {
        private const val PREFS_NAME = "notification_ids"
        private const val KEY_IDS = "scheduled_ids"
        private const val LEGACY_SEQUENTIAL_ID_LIMIT = 1024

        fun trackScheduledId(context: Context, id: Int) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val ids = prefs.getStringSet(KEY_IDS, mutableSetOf()) ?: mutableSetOf()
            val updated = ids.toMutableSet()
            updated.add(id.toString())
            prefs.edit().putStringSet(KEY_IDS, updated).apply()
        }

        fun getTrackedIds(context: Context): Set<Int> {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val ids = prefs.getStringSet(KEY_IDS, emptySet()) ?: emptySet()
            return ids.mapNotNull { it.toIntOrNull() }.toSet()
        }

        fun removeTrackedId(context: Context, id: Int) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val ids = prefs.getStringSet(KEY_IDS, mutableSetOf()) ?: mutableSetOf()
            val updated = ids.toMutableSet()
            updated.remove(id.toString())
            prefs.edit().putStringSet(KEY_IDS, updated).apply()
        }

        fun clearTrackedIds(context: Context) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().remove(KEY_IDS).apply()
        }
    }
}
