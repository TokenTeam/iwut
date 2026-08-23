package dev.tokenteam.iwut.diagnostics

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProviderInfo
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.DisplayMetrics
import android.util.SizeF
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DiagnosticsModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("Diagnostics")

        AsyncFunction("getNativeDiagnostics") {
            val context = appContext.reactContext?.applicationContext ?: return@AsyncFunction null
            collectDiagnostics(context)
        }
    }

    private fun collectDiagnostics(context: Context): Map<String, Any?> {
        val packageManager = context.packageManager
        val manager = AppWidgetManager.getInstance(context)
        val metrics = context.resources.displayMetrics
        val configuration = context.resources.configuration
        val providers = getOwnWidgetProviders(manager, context)
        val widgetIds = providers
            .map { it.provider }
            .flatMap { manager.getAppWidgetIds(it).asIterable() }
            .distinct()

        val homeIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val home = resolveActivity(packageManager, homeIntent)
        val homePackage = home?.activityInfo?.packageName
        val homePackageInfo = homePackage?.let { getPackageInfo(packageManager, it) }

        val launcher = mapOf(
            "packageName" to homePackage,
            "activityName" to home?.activityInfo?.name,
            "label" to home?.loadLabel(packageManager)?.toString(),
            "versionName" to homePackageInfo?.versionName,
            "versionCode" to homePackageInfo?.let(::getVersionCode),
        )

        val display = mapOf(
            "widthPixels" to metrics.widthPixels,
            "heightPixels" to metrics.heightPixels,
            "density" to metrics.density,
            "densityDpi" to metrics.densityDpi,
            "stableDensityDpi" to stableDensityDpi(metrics),
            "scaledDensity" to metrics.scaledDensity,
            "fontScale" to configuration.fontScale,
            "screenWidthDp" to configuration.screenWidthDp,
            "screenHeightDp" to configuration.screenHeightDp,
            "smallestScreenWidthDp" to configuration.smallestScreenWidthDp,
        )

        return mapOf(
            "platform" to "android",
            "launcher" to launcher,
            "installSource" to getInstallSource(packageManager, context.packageName),
            "display" to display,
            "widgets" to mapOf(
                "providerQueryAvailable" to (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O),
                "providers" to providers.map(::collectProviderDiagnostics),
                "instances" to widgetIds.map { collectWidgetDiagnostics(manager, it) },
            ),
        )
    }

    private fun collectProviderDiagnostics(info: AppWidgetProviderInfo): Map<String, Any?> = mapOf(
        "provider" to info.provider.flattenToShortString(),
        "declaredMinWidthPx" to info.minWidth,
        "declaredMinHeightPx" to info.minHeight,
        "declaredMinResizeWidthPx" to info.minResizeWidth,
        "declaredMinResizeHeightPx" to info.minResizeHeight,
        "targetCellWidth" to if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) info.targetCellWidth else null,
        "targetCellHeight" to if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) info.targetCellHeight else null,
        "resizeMode" to info.resizeMode,
    )

    private fun collectWidgetDiagnostics(
        manager: AppWidgetManager,
        appWidgetId: Int,
    ): Map<String, Any?> {
        val info = manager.getAppWidgetInfo(appWidgetId)
        val options = manager.getAppWidgetOptions(appWidgetId)

        return mapOf(
            "appWidgetId" to appWidgetId,
            "provider" to info?.provider?.flattenToShortString(),
            "declaredMinWidthPx" to info?.minWidth,
            "declaredMinHeightPx" to info?.minHeight,
            "targetCellWidth" to if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) info?.targetCellWidth else null,
            "targetCellHeight" to if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) info?.targetCellHeight else null,
            "resizeMode" to info?.resizeMode,
            "allocatedMinWidthDp" to getOptionInt(options, AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH),
            "allocatedMinHeightDp" to getOptionInt(options, AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT),
            "allocatedMaxWidthDp" to getOptionInt(options, AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH),
            "allocatedMaxHeightDp" to getOptionInt(options, AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT),
            "supportedSizes" to getSupportedSizes(options),
        )
    }

    private fun getOwnWidgetProviders(
        manager: AppWidgetManager,
        context: Context,
    ): List<AppWidgetProviderInfo> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.getInstalledProvidersForPackage(context.packageName, null)
        } else {
            emptyList()
        }

    private fun getOptionInt(options: Bundle, key: String): Int? =
        if (options.containsKey(key)) options.getInt(key) else null

    @Suppress("DEPRECATION")
    private fun getSupportedSizes(options: Bundle): List<Map<String, Float>>? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            !options.containsKey(AppWidgetManager.OPTION_APPWIDGET_SIZES)
        ) {
            return null
        }
        val sizes = options.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES)
            ?: return null
        return sizes.map { size ->
            mapOf("widthDp" to size.width, "heightDp" to size.height)
        }
    }

    private fun stableDensityDpi(metrics: DisplayMetrics): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            DisplayMetrics.DENSITY_DEVICE_STABLE
        } else {
            metrics.densityDpi
        }

    @Suppress("DEPRECATION")
    private fun resolveActivity(packageManager: PackageManager, intent: Intent) =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packageManager.resolveActivity(
                intent,
                PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong()),
            )
        } else {
            packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
        }

    @Suppress("DEPRECATION")
    private fun getPackageInfo(packageManager: PackageManager, packageName: String): PackageInfo? =
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0))
            } else {
                packageManager.getPackageInfo(packageName, 0)
            }
        }.getOrNull()

    @Suppress("DEPRECATION")
    private fun getVersionCode(info: PackageInfo): Long =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()

    @Suppress("DEPRECATION")
    private fun getInstallSource(packageManager: PackageManager, packageName: String): String? =
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                packageManager.getInstallSourceInfo(packageName).installingPackageName
            } else {
                packageManager.getInstallerPackageName(packageName)
            }
        }.getOrNull()
}
