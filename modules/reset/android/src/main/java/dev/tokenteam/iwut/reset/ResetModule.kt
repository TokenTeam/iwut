package dev.tokenteam.iwut.reset

import android.content.Context
import android.webkit.CookieManager
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewDatabase
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.KeyStore
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

class ResetModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("Reset")

        AsyncFunction("resetNativeData") Coroutine { ->
            val context = appContext.reactContext?.applicationContext
                ?: return@Coroutine

            clearSharedPreferences(context)
            clearDatabases(context)
            clearKeyStore()

            withContext(Dispatchers.Main) {
                clearWebViewData(context)
            }

            clearDirectory(context.filesDir)
            clearDirectory(context.cacheDir)
            clearDirectory(context.noBackupFilesDir)
            context.externalCacheDirs.filterNotNull().forEach {
                clearDirectory(it)
            }
            context.externalMediaDirs.filterNotNull().forEach {
                clearDirectory(it)
            }
            context.getExternalFilesDirs(null).filterNotNull().forEach {
                clearDirectory(it)
            }
        }
    }

    private fun clearKeyStore() {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        keyStore.aliases().toList().forEach(keyStore::deleteEntry)
    }

    private fun clearSharedPreferences(context: Context) {
        val directory = File(context.applicationInfo.dataDir, "shared_prefs")
        directory.listFiles()
            ?.filter { it.isFile && it.extension == "xml" }
            ?.map { it.nameWithoutExtension }
            ?.forEach { name ->
                context.getSharedPreferences(name, Context.MODE_PRIVATE)
                    .edit()
                    .clear()
                    .commit()
            }
    }

    private fun clearDatabases(context: Context) {
        context.databaseList().forEach {
            context.deleteDatabase(it)
        }
    }

    private suspend fun clearWebViewData(context: Context) {
        val cookieManager = CookieManager.getInstance()
        suspendCancellableCoroutine { continuation ->
            cookieManager.removeAllCookies {
                if (continuation.isActive) {
                    continuation.resume(Unit)
                }
            }
        }
        cookieManager.flush()
        WebStorage.getInstance().deleteAllData()
        WebViewDatabase.getInstance(context).apply {
            clearFormData()
            clearHttpAuthUsernamePassword()
            clearUsernamePassword()
        }
        WebView(context).apply {
            clearCache(true)
            destroy()
        }
    }

    private fun clearDirectory(directory: File) {
        directory.listFiles()?.forEach { child ->
            runCatching { child.deleteRecursively() }
        }
    }
}
