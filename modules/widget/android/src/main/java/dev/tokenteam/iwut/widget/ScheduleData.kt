package dev.tokenteam.iwut.widget

import android.app.LocaleManager
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.concurrent.TimeUnit

data class WidgetCourse(
    @SerializedName("name") val name: String = "",
    @SerializedName("room") val room: String = "",
    @SerializedName("day") val day: Int = 1,
    @SerializedName("weekStart") val weekStart: Int = 1,
    @SerializedName("weekEnd") val weekEnd: Int = 20,
    @SerializedName("sectionStart") val sectionStart: Int = 0,
    @SerializedName("sectionEnd") val sectionEnd: Int = 0,
    @SerializedName("startTime") val startTime: String = "",
    @SerializedName("endTime") val endTime: String = "",
)

data class ScheduleWidgetData(
    @SerializedName("courses") val courses: List<WidgetCourse> = emptyList(),
    @SerializedName("termStart") val termStart: String = "",
    @SerializedName("updatedAt") val updatedAt: String = "",
)

object ScheduleData {
    private val gson = Gson()

    fun load(context: Context): ScheduleWidgetData? {
        val prefs = context.getSharedPreferences("widget_data", Context.MODE_PRIVATE)
        val json = prefs.getString("schedule", null) ?: return null
        return try {
            gson.fromJson(json, ScheduleWidgetData::class.java)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Returns a Context whose resources resolve strings using the in-app
     * language synced from React Native, falling back to the device-level
     * locale when nothing has been synced yet (e.g. widget added before
     * first launch).
     *
     * The fallback intentionally avoids returning `context` as-is: on Android
     * 13+, the app process's `context.resources.configuration.locales` can
     * carry a stale per-app override left over from a previous in-app choice,
     * which would make the widget render in the wrong language. We instead
     * derive the locale from `LocaleManager.systemLocales` (API 33+) or
     * `Resources.getSystem()` (older) so the widget always reflects either
     * the explicit in-app choice or the true device locale.
     */
    fun localizedContext(context: Context): Context {
        val prefs = context.getSharedPreferences("widget_data", Context.MODE_PRIVATE)
        val stored = prefs.getString("lang", null)
        val locale: Locale = if (!stored.isNullOrEmpty()) {
            Locale.forLanguageTag(stored)
        } else {
            systemLocale(context)
        }
        val config = Configuration(context.resources.configuration).apply {
            setLocale(locale)
        }
        return context.createConfigurationContext(config)
    }

    private fun systemLocale(context: Context): Locale {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val lm = context.getSystemService(LocaleManager::class.java)
            val systemLocales = lm?.systemLocales
            if (systemLocales != null && !systemLocales.isEmpty) {
                return systemLocales.get(0)
            }
        }
        val locales = android.content.res.Resources.getSystem().configuration.locales
        return if (locales.isEmpty) Locale.getDefault() else locales.get(0)
    }

    fun getCurrentWeek(termStart: String): Int {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val startDate = try {
            sdf.parse(termStart) ?: return 1
        } catch (e: Exception) {
            return 1
        }
        val now = Calendar.getInstance().time
        val diffMs = now.time - startDate.time
        if (diffMs < 0) return 0
        val diffDays = TimeUnit.MILLISECONDS.toDays(diffMs)
        return (diffDays / 7 + 1).toInt()
    }

    fun getDayOfWeek(): Int {
        val cal = Calendar.getInstance()
        val dow = cal.get(Calendar.DAY_OF_WEEK)
        return if (dow == Calendar.SUNDAY) 7 else dow - 1
    }

    fun getTomorrowDayOfWeek(): Int {
        val today = getDayOfWeek()
        return if (today == 7) 1 else today + 1
    }

    fun getTomorrowWeek(termStart: String): Int {
        val today = getDayOfWeek()
        val week = getCurrentWeek(termStart)
        return if (today == 7) week + 1 else week
    }

    fun getWeekStr(context: Context, week: Int): String =
        context.getString(R.string.widget_week_n, week)

    fun getDateStr(context: Context): String {
        val cal = Calendar.getInstance()
        return context.getString(
            R.string.widget_month_day,
            cal.get(Calendar.MONTH) + 1,
            cal.get(Calendar.DAY_OF_MONTH),
        )
    }

    fun getDayOfWeekStr(context: Context, day: Int): String {
        val arr = context.resources.getStringArray(R.array.widget_weekdays)
        return arr.getOrElse(day) { "" }
    }

    fun parseTimeToMinutes(time: String): Int {
        val parts = time.split(":")
        if (parts.size != 2) return 0
        return (parts[0].toIntOrNull() ?: 0) * 60 + (parts[1].toIntOrNull() ?: 0)
    }
}
