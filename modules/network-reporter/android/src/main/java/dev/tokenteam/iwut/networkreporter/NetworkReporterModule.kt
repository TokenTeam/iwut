package dev.tokenteam.iwut.networkreporter

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

object NetworkReporter {
    fun reportWifiConnectivity(context: Context, hasConnectivity: Boolean): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return false
        }
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE)
            as? ConnectivityManager ?: return false
        val wifiNetwork = connectivityManager.allNetworks.firstOrNull { network ->
            connectivityManager.getNetworkCapabilities(network)?.let { capabilities ->
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) &&
                    !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
            } == true
        } ?: return false

        return reportConnectivity(context, wifiNetwork, hasConnectivity)
    }

    fun reportConnectivity(context: Context, network: Network, hasConnectivity: Boolean): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return false
        }
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE)
            as? ConnectivityManager ?: return false

        @Suppress("DEPRECATION")
        return runCatching {
            connectivityManager.reportNetworkConnectivity(network, hasConnectivity)
        }.isSuccess
    }
}

class NetworkReporterModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("NetworkReporter")

        AsyncFunction("reportWifiConnectivity") { hasConnectivity: Boolean ->
            val context = appContext.reactContext ?: return@AsyncFunction false
            NetworkReporter.reportWifiConnectivity(context, hasConnectivity)
        }
    }
}
