package dev.tokenteam.iwut.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import java.util.Calendar

class ScheduleWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
        if (appWidgetIds.isNotEmpty()) {
            scheduleNextAlarm(context)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_AUTO_REFRESH) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                android.content.ComponentName(context, ScheduleWidget::class.java)
            )
            onUpdate(context, manager, ids)
        }
    }

    companion object {
        const val ACTION_AUTO_REFRESH = "dev.tokenteam.iwut.widget.AUTO_REFRESH"

        // Do not use `0` for request code
        const val BROADCAST_REQUEST_CODE = 1234
        const val ACTIVITY_REQUEST_CODE = 1235

        fun updateWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_schedule)
            val data = ScheduleData.load(context)
            val ctx = ScheduleData.localizedContext(context)

            if (data == null || data.termStart.isEmpty()) {
                views.setViewVisibility(R.id.course_group, View.GONE)
                views.setViewVisibility(R.id.all_done_group, View.VISIBLE)
                views.setTextViewText(R.id.tv_all_done, ctx.getString(R.string.widget_all_done))
                setOnClickAction(context, views)
                appWidgetManager.updateAppWidget(appWidgetId, views)
                return
            }

            val week = ScheduleData.getCurrentWeek(data.termStart)
            val today = ScheduleData.getDayOfWeek()
            val tomorrowDay = ScheduleData.getTomorrowDayOfWeek()
            val tomorrowWeek = ScheduleData.getTomorrowWeek(data.termStart)

            views.setTextViewText(R.id.tv_week, ScheduleData.getWeekStr(ctx, week))
            views.setTextViewText(R.id.tv_date, ScheduleData.getDateStr(ctx))
            views.setTextViewText(R.id.tv_day_of_week, ScheduleData.getDayOfWeekStr(ctx, today))

            val now = Calendar.getInstance()
            val nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)

            val todayCourses = data.courses
                .filter { it.day == today && it.weekStart <= week && it.weekEnd >= week }
                .sortedBy { it.sectionStart }

            val tomorrowCourses = data.courses
                .filter { it.day == tomorrowDay && it.weekStart <= tomorrowWeek && it.weekEnd >= tomorrowWeek }
                .sortedBy { it.sectionStart }

            val upcomingToday = todayCourses.filter {
                ScheduleData.parseTimeToMinutes(it.endTime) > nowMin
            }

            val combined =
                (upcomingToday.map { it to true } + tomorrowCourses.map { it to false }).take(2)

            if (combined.isEmpty()) {
                views.setViewVisibility(R.id.course_group, View.GONE)
                views.setViewVisibility(R.id.all_done_group, View.VISIBLE)
                views.setTextViewText(R.id.tv_all_done, ctx.getString(R.string.widget_all_done))
                appWidgetManager.updateAppWidget(appWidgetId, views)
                return
            }

            views.setViewVisibility(R.id.course_group, View.VISIBLE)
            views.setViewVisibility(R.id.all_done_group, View.GONE)

            val todayLabel = ctx.getString(R.string.widget_today)
            val tomorrowLabel = ctx.getString(R.string.widget_tomorrow)

            val (c1, c1IsToday) = combined[0]
            views.setViewVisibility(R.id.course_row_1, View.VISIBLE)
            views.setTextViewText(R.id.course_1_name, c1.name)
            views.setTextViewText(R.id.course_1_tag, if (c1IsToday) todayLabel else tomorrowLabel)
            views.setTextViewText(R.id.course_1_room, c1.room)
            views.setTextViewText(R.id.course_1_time, "${c1.startTime}-${c1.endTime}")

            if (combined.size > 1) {
                val (c2, c2IsToday) = combined[1]
                views.setViewVisibility(R.id.course_row_2, View.VISIBLE)
                views.setViewVisibility(R.id.tv_no_more, View.GONE)
                views.setTextViewText(R.id.course_2_name, c2.name)
                views.setTextViewText(R.id.course_2_tag, if (c2IsToday) todayLabel else tomorrowLabel)
                views.setTextViewText(R.id.course_2_room, c2.room)
                views.setTextViewText(R.id.course_2_time, "${c2.startTime}-${c2.endTime}")
            } else {
                views.setViewVisibility(R.id.course_row_2, View.GONE)
                views.setViewVisibility(R.id.tv_no_more, View.VISIBLE)
                views.setTextViewText(R.id.tv_no_more, ctx.getString(R.string.widget_no_more))
            }

            val hintText: String =
                if (upcomingToday.isEmpty() && tomorrowCourses.isEmpty()) {
                    ctx.getString(R.string.widget_both_done)
                } else {
                    val todayHint = if (upcomingToday.isEmpty()) {
                        ctx.getString(R.string.widget_today_done)
                    } else {
                        ctx.resources.getQuantityString(
                            R.plurals.widget_today_remaining,
                            upcomingToday.size,
                            upcomingToday.size,
                        )
                    }
                    val tomorrowHint = if (tomorrowCourses.isEmpty()) {
                        ctx.getString(R.string.widget_tomorrow_done)
                    } else {
                        ctx.resources.getQuantityString(
                            R.plurals.widget_tomorrow_remaining,
                            tomorrowCourses.size,
                            tomorrowCourses.size,
                        )
                    }
                    todayHint + tomorrowHint
                }
            views.setViewVisibility(R.id.tv_course_hint, View.VISIBLE)
            views.setTextViewText(R.id.tv_course_hint, hintText)

            setOnClickAction(context, views)
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        fun setOnClickAction(context: Context, views: RemoteViews) {
            context.packageManager
                .getLaunchIntentForPackage(context.packageName)
                ?.let {
                    it.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    views.setOnClickPendingIntent(
                        R.id.widget_root,
                        PendingIntent.getActivity(
                            context, ACTIVITY_REQUEST_CODE, it,
                            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_CANCEL_CURRENT
                        )
                    )
                }
        }

        fun scheduleNextAlarm(context: Context) {
            val data = ScheduleData.load(context) ?: return
            if (data.termStart.isEmpty()) return

            val week = ScheduleData.getCurrentWeek(data.termStart)
            val today = ScheduleData.getDayOfWeek()
            val now = Calendar.getInstance()
            val nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)

            val nextEndMin = data.courses
                .filter { it.day == today && it.weekStart <= week && it.weekEnd >= week }
                .map { ScheduleData.parseTimeToMinutes(it.endTime) }
                .filter { it > nowMin }
                .minOrNull() ?: return

            val alarmTime = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, nextEndMin / 60)
                set(Calendar.MINUTE, nextEndMin % 60)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }

            val intent = Intent(context, ScheduleWidget::class.java).apply {
                action = ACTION_AUTO_REFRESH
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context, BROADCAST_REQUEST_CODE, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.set(
                AlarmManager.RTC_WAKEUP,
                alarmTime.timeInMillis,
                pendingIntent
            )
        }
    }
}
