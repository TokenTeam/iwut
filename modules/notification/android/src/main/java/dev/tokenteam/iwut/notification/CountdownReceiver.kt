package dev.tokenteam.iwut.notification

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

class CountdownReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_SHOW_COUNTDOWN -> handleShowCountdown(context, intent)
            ACTION_DISMISS -> handleDismiss(context, intent)
        }
    }

    private fun handleShowCountdown(context: Context, intent: Intent) {
        val id = intent.getIntExtra("id", 0)
        val channelId = intent.getStringExtra("channelId") ?: return
        val title = intent.getStringExtra("title") ?: return
        val body = intent.getStringExtra("body") ?: ""
        val plain = intent.getBooleanExtra("plain", false)

        if (plain) {
            showPlainNotification(context, id, channelId, title, body)
        } else {
            val targetTimeMs = intent.getLongExtra("targetTimeMs", 0L)
            val ongoing = intent.getBooleanExtra("ongoing", true)
            val autoDismiss = intent.getBooleanExtra("autoDismiss", true)
            showNotification(context, id, channelId, title, body, targetTimeMs, ongoing, autoDismiss)
        }

        NotificationModule.removeTrackedId(context, id)
    }

    private fun showPlainNotification(
        context: Context, id: Int, channelId: String,
        title: String, body: String,
    ) {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val contentIntent = PendingIntent.getActivity(
            context, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(R.drawable.ic_notification)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(id, notification)
    }

    private fun showNotification(
        context: Context, id: Int, channelId: String,
        title: String, body: String, targetTimeMs: Long,
        ongoing: Boolean, autoDismiss: Boolean,
    ) {
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

        val notification = builder.build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(id, notification)
    }

    private fun handleDismiss(context: Context, intent: Intent) {
        val id = intent.getIntExtra("id", 0)
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(id)
    }

    companion object {
        const val ACTION_SHOW_COUNTDOWN = "dev.tokenteam.iwut.notification.SHOW_COUNTDOWN"
        const val ACTION_DISMISS = "dev.tokenteam.iwut.notification.DISMISS"
    }
}
