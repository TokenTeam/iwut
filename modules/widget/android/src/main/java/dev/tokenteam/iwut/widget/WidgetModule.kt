package dev.tokenteam.iwut.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WidgetModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("Widget")

        AsyncFunction("setWidgetData") { key: String, json: String ->
            val context = appContext.reactContext ?: return@AsyncFunction null
            context
                .getSharedPreferences("widget_data", Context.MODE_PRIVATE)
                .edit()
                .putString(key, json)
                .apply()
            null
        }

        AsyncFunction("reloadWidgets") {
            val context = appContext.reactContext ?: return@AsyncFunction null
            val manager = AppWidgetManager.getInstance(context)
            val widget = ComponentName(context, ScheduleWidget::class.java)
            val ids = manager.getAppWidgetIds(widget)
            if (ids.isNotEmpty()) {
                val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                intent.component = widget
                intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                context.sendBroadcast(intent)
            }
            ScheduleWidget.publishGeneratedPreview(context)
            ScheduleWidget.scheduleNextAlarm(context)
            null
        }
    }
}
