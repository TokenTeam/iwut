package dev.tokenteam.iwut.telemetry

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import io.sentry.Sentry
import io.sentry.react.RNSentrySDK

class TelemetryModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Telemetry")

    Function("isEnabled") {
      preferences().getBoolean("telemetry_enabled", true)
    }

    AsyncFunction("setEnabled") { enabled: Boolean ->
      val preferences = preferences()
      val previous = preferences.getBoolean("telemetry_enabled", true)
      check(preferences.edit().putBoolean("telemetry_enabled", enabled).commit()) {
        "Could not save telemetry preference"
      }
      try {
        if (enabled) {
          startSentry(requireContext())
        } else {
          Sentry.close()
        }
      } catch (error: Throwable) {
        preferences.edit().putBoolean("telemetry_enabled", previous).commit()
        throw error
      }
    }
  }

  private fun requireContext(): Context =
    requireNotNull(appContext.reactContext) { "React context is unavailable" }

  private fun preferences() =
    requireContext().getSharedPreferences("telemetry", Context.MODE_PRIVATE)

  companion object {
    @JvmStatic
    fun startSentry(context: Context) {
      val preferences = context.getSharedPreferences("telemetry", Context.MODE_PRIVATE)
      if (!preferences.getBoolean("telemetry_enabled", true)) return
      RNSentrySDK.init(context) { options ->
        val isHuawei = android.os.Build.MANUFACTURER.equals("HUAWEI", ignoreCase = true) ||
          android.os.Build.BRAND.equals("HUAWEI", ignoreCase = true)
        val previousBeforeSend = options.beforeSend
        options.setBeforeSend { event, hint ->
          val shouldDrop = isHuawei && event.exceptions?.any {
            it.type == "ApplicationNotResponding" &&
              it.module == "io.sentry.android.core" &&
              it.value?.startsWith("Background ANR") == true
          } == true
          when {
            !preferences.getBoolean("telemetry_enabled", true) || shouldDrop -> null
            previousBeforeSend != null -> previousBeforeSend.execute(event, hint)
            else -> event
          }
        }
      }
    }
  }
}
