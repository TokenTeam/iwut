package dev.tokenteam.iwut.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.appwidget.AppWidgetProviderInfo
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.view.View
import android.widget.RemoteViews
import java.util.Calendar

class ScheduleSmallWidget : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        for (id in appWidgetIds) {
            val views = buildWidgetViews(context)
            ScheduleWidget.setOnClickAction(context, views)
            appWidgetManager.updateAppWidget(id, views)
        }
        if (appWidgetIds.isNotEmpty()) {
            ScheduleWidget.scheduleNextAlarm(context)
        }
    }

    companion object {
        fun publishGeneratedPreview(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return

            AppWidgetManager.getInstance(context).setWidgetPreview(
                ComponentName(context, ScheduleSmallWidget::class.java),
                AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN,
                buildWidgetViews(context),
            )
        }

        private fun buildWidgetViews(context: Context): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_schedule_small)
            val data = ScheduleData.load(context)
            val ctx = ScheduleData.localizedContext(context)
            val week = data?.termStart?.takeIf { it.isNotEmpty() }
                ?.let { ScheduleData.getCurrentWeek(it) }

            views.setTextViewText(
                R.id.tv_week,
                week?.let { ScheduleData.getWeekDisplayStr(ctx, it) } ?: "",
            )

            val now = Calendar.getInstance()
            val nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
            val today = ScheduleData.getDayOfWeek()
            val todayCourses = if (data != null && week != null) {
                data.courses.filter {
                    it.day == today && it.weekStart <= week && it.weekEnd >= week &&
                        ScheduleData.parseTimeToMinutes(it.endTime) > nowMin
                }.sortedBy { it.sectionStart }
            } else {
                emptyList()
            }

            val isToday = todayCourses.isNotEmpty()
            val courses = if (isToday || data == null || week == null) {
                todayCourses
            } else {
                val tomorrow = ScheduleData.getTomorrowDayOfWeek()
                val tomorrowWeek = ScheduleData.getTomorrowWeek(data.termStart)
                data.courses.filter {
                    it.day == tomorrow && it.weekStart <= tomorrowWeek && it.weekEnd >= tomorrowWeek
                }.sortedBy { it.sectionStart }
            }

            val course = courses.firstOrNull()
            if (course == null) {
                views.setViewVisibility(R.id.course_1_tag, View.GONE)
                views.setViewVisibility(R.id.course_group, View.GONE)
                views.setViewVisibility(R.id.tv_all_done, View.VISIBLE)
                views.setViewVisibility(R.id.tv_course_hint, View.GONE)
                views.setTextViewText(
                    R.id.tv_all_done,
                    ctx.getString(R.string.widget_no_more),
                )
                return views
            }

            views.setTextViewText(
                R.id.course_1_tag,
                ctx.getString(if (isToday) R.string.widget_today else R.string.widget_tomorrow),
            )
            views.setTextViewText(R.id.course_1_name, course.name)
            views.setTextViewText(R.id.course_1_time, "${course.startTime} - ${course.endTime}")
            views.setTextViewText(R.id.course_1_room, course.room)
            views.setTextViewText(
                R.id.tv_course_hint,
                ctx.resources.getQuantityString(
                    if (isToday) R.plurals.widget_small_today_remaining else R.plurals.widget_small_tomorrow_total,
                    courses.size,
                    courses.size,
                ),
            )
            return views
        }
    }
}
