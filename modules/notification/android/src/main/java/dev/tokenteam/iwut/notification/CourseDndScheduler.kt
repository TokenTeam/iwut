package dev.tokenteam.iwut.notification

import android.app.AlarmManager
import android.app.AutomaticZenRule
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.notification.Condition
import android.util.Log
import org.json.JSONArray

/** Owns only our automatic rule; never changes the user's global interruption filter. */
object CourseDndScheduler {
    private const val PREFS = "course_dnd"
    private const val ACTION = "dev.tokenteam.iwut.notification.COURSE_DND"

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun manager(context: Context) = context.getSystemService(NotificationManager::class.java)
    private fun alarms(context: Context) = context.getSystemService(AlarmManager::class.java)
    private fun owner(context: Context) = ComponentName(context, CourseDndConditionProvider::class.java)
    fun conditionId(context: Context): Uri = Uri.parse("condition://${context.packageName}/course-dnd")

    fun hasExactAlarmAccess(context: Context): Boolean =
        Build.VERSION.SDK_INT < 31 || alarms(context).canScheduleExactAlarms()

    @Synchronized
    fun status(context: Context): Map<String, Boolean> {
        val access = manager(context).isNotificationPolicyAccessGranted
        val rule = if (access) {
            prefs(context).getString("rule_id", null)?.let { manager(context).getAutomaticZenRule(it) }
        } else null
        return mapOf(
            "policyAccess" to access,
            "exactAlarmAccess" to hasExactAlarmAccess(context),
            "ruleEnabled" to (rule?.isEnabled == true),
        )
    }

    @Synchronized
    fun update(context: Context, enabled: Boolean, intervalsJson: String, name: String) {
        if (Build.VERSION.SDK_INT < 24) return
        // Parse before replacing the persisted schedule.
        val intervals = JSONArray(intervalsJson)
        for (index in 0 until intervals.length()) {
            val interval = intervals.getJSONObject(index)
            require(interval.getLong("end") > interval.getLong("start"))
        }
        val preferences = prefs(context)
        preferences.edit()
            .putBoolean("enabled", enabled)
            .putString("intervals", intervalsJson)
            .putString("name", name)
            .commit()

        val notificationManager = manager(context)
        if (notificationManager.isNotificationPolicyAccessGranted) {
            val id = preferences.getString("rule_id", null)
            val existing = id?.let { notificationManager.getAutomaticZenRule(it) }
            if (!enabled) {
                if (existing != null) notificationManager.removeAutomaticZenRule(id!!)
                preferences.edit().remove("rule_id").commit()
            } else if (hasExactAlarmAccess(context)) {
                if (existing == null) {
                    @Suppress("DEPRECATION")
                    val rule = AutomaticZenRule(
                        name, owner(context), conditionId(context),
                        NotificationManager.INTERRUPTION_FILTER_PRIORITY, true,
                    )
                    val newId = notificationManager.addAutomaticZenRule(rule)
                    preferences.edit().putString("rule_id", newId).commit()
                } else if (existing.name != name) {
                    existing.name = name
                    notificationManager.updateAutomaticZenRule(id!!, existing)
                }
                // A rule disabled in system Settings stays disabled until explicitly enabled there.
            }
        }
        refresh(context)
    }

    private fun pendingIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context, 0, Intent(context, CourseDndReceiver::class.java).setAction(ACTION),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    /** Re-evaluate from the clock, so delayed alarms and clock changes cannot toggle stale state. */
    @Synchronized
    fun refresh(context: Context) {
        if (Build.VERSION.SDK_INT < 24) return
        val alarmManager = alarms(context)
        val pending = pendingIntent(context)
        alarmManager.cancel(pending)
        val preferences = prefs(context)
        val notificationManager = manager(context)
        val access = notificationManager.isNotificationPolicyAccessGranted
        val enabled = preferences.getBoolean("enabled", false) && access && hasExactAlarmAccess(context)
        val now = System.currentTimeMillis()
        var active = false
        var next: Long? = null
        if (enabled) {
            val intervals = JSONArray(preferences.getString("intervals", "[]"))
            for (index in 0 until intervals.length()) {
                val interval = intervals.getJSONObject(index)
                val start = interval.getLong("start")
                val end = interval.getLong("end")
                if (start <= now && now < end) active = true
                for (boundary in listOf(start, end)) {
                    if (boundary > now && (next == null || boundary < next!!)) next = boundary
                }
            }
        }
        val condition = Condition(
            conditionId(context), preferences.getString("name", "Course Do Not Disturb")!!,
            if (active) Condition.STATE_TRUE else Condition.STATE_FALSE,
        )
        val id = preferences.getString("rule_id", null)
        if (Build.VERSION.SDK_INT >= 29 && access && id != null) {
            notificationManager.setAutomaticZenRuleState(id, condition)
        } else if (id != null) {
            CourseDndConditionProvider.publish(context, condition)
        }
        if (next != null) {
            try {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next!!, pending)
            } catch (error: SecurityException) {
                // Access may have been revoked between the check and scheduling. Release our rule.
                if (Build.VERSION.SDK_INT >= 29 && access && id != null) {
                    notificationManager.setAutomaticZenRuleState(
                        id, Condition(conditionId(context), condition.summary, Condition.STATE_FALSE),
                    )
                } else {
                    CourseDndConditionProvider.publish(
                        context, Condition(conditionId(context), condition.summary, Condition.STATE_FALSE),
                    )
                }
                Log.w("CourseDnd", "Exact alarm access revoked", error)
            }
        }
    }
}
