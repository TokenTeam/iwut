package dev.tokenteam.iwut.wlan

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import dev.tokenteam.iwut.networkreporter.NetworkReporter
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.Dns
import okhttp3.FormBody
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.InetAddress
import java.util.concurrent.TimeUnit

internal data class WlanLoginResult(val status: String, val message: String? = null) {
    fun toMap(): Map<String, String> = buildMap {
        put("status", status)
        message?.let { put("message", it) }
    }
}

internal class WlanAuthenticator(context: Context) {
    private val context = context.applicationContext
    private val connectivityManager =
        this.context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val wifiNetwork: Network? = connectivityManager.allNetworks.firstOrNull { network ->
        connectivityManager.getNetworkCapabilities(network)?.let { capabilities ->
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) &&
                !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
        } == true
    }

    fun login(credentials: WlanCredentials): WlanLoginResult {
        val network = wifiNetwork ?: return WlanLoginResult(STATUS_NOT_ON_WIFI)
        val client = createClient(network)

        val result = try {
            val portal = locatePortal(client)
            if (portal == null) {
                WlanLoginResult(STATUS_ALREADY_ONLINE)
            } else {
                val csrf = getCsrfToken(client)
                performLogin(client, credentials, portal, csrf)
            }
        } catch (error: Exception) {
            WlanLoginResult(STATUS_NETWORK_UNAVAILABLE)
        }
        reportNetworkConnectivity(network, result)
        return result
    }

    private fun reportNetworkConnectivity(network: Network, result: WlanLoginResult) {
        val hasConnectivity = when (result.status) {
            STATUS_CONNECTED,
            STATUS_ALREADY_ONLINE -> true
            else -> false
        }
        NetworkReporter.reportConnectivity(context, network, hasConnectivity)
    }

    private fun createClient(network: Network): OkHttpClient {
        return OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .socketFactory(network.socketFactory)
            .dns(object : Dns {
                override fun lookup(hostname: String): List<InetAddress> =
                    network.getAllByName(hostname).toList()
            })
            .cookieJar(MemoryCookieJar())
            .followRedirects(false)
            .followSslRedirects(false)
            .build()
    }

    private fun locatePortal(client: OkHttpClient): PortalParameters? {
        val request = Request.Builder()
            .url(PROBE_URL)
            .header("Host", "connect.rom.miui.com")
            .header("Cache-Control", "no-cache")
            .build()

        client.newCall(request).execute().use { response ->
            val location = response.header("Location") ?: return null
            val uri = Uri.parse(location)
            val nasId = uri.getQueryParameter("nasId")
                ?: uri.lastPathSegment?.takeIf { it.isNotBlank() }
                ?: return null
            return PortalParameters(
                nasId = nasId,
                switchip = uri.getQueryParameter("switchip").orEmpty()
            )
        }
    }

    private fun getCsrfToken(client: OkHttpClient): String {
        val request = Request.Builder().url("$GATEWAY/api/csrf-token").build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IllegalStateException("Unable to obtain CSRF token")
            }
            val body = response.body?.string()
                ?: throw IllegalStateException("Empty CSRF response")
            return JSONObject(body).getString("csrf_token")
        }
    }

    private fun performLogin(
        client: OkHttpClient,
        credentials: WlanCredentials,
        portal: PortalParameters,
        csrf: String
    ): WlanLoginResult {
        val body = FormBody.Builder()
            .add("username", credentials.username)
            .add("password", credentials.password)
            .add("nasId", portal.nasId)
            .add("switchip", portal.switchip)
            .add("userIpv4", "")
            .add("userMac", "")
            .add("captcha", "")
            .add("captchaId", "")
            .build()
        val request = Request.Builder()
            .url("$GATEWAY/api/account/login")
            .header("x-csrf-token", csrf)
            .post(body)
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IllegalStateException("Login request failed")
            }
            val objectValue = JSONObject(response.body?.string().orEmpty())
            val message = objectValue.optString("msg").takeIf { it.isNotBlank() }
            return if (objectValue.optInt("code", -1) == 0) {
                WlanLoginResult(STATUS_CONNECTED, message)
            } else {
                WlanLoginResult(STATUS_AUTHENTICATION_FAILED, message)
            }
        }
    }

    private class MemoryCookieJar : CookieJar {
        private val cookies = mutableListOf<Cookie>()

        override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
            this.cookies.removeAll { old -> cookies.any { it.name == old.name } }
            this.cookies += cookies
        }

        override fun loadForRequest(url: HttpUrl): List<Cookie> =
            cookies.filter { it.matches(url) }
    }

    private data class PortalParameters(val nasId: String, val switchip: String)

    companion object {
        const val STATUS_CONNECTED = "connected"
        const val STATUS_ALREADY_ONLINE = "already-online"
        const val STATUS_NOT_ON_WIFI = "not-on-wifi"
        const val STATUS_NETWORK_UNAVAILABLE = "network-unavailable"
        const val STATUS_AUTHENTICATION_FAILED = "authentication-failed"

        private const val PROBE_URL = "http://223.5.5.5/generate_204"
        private const val GATEWAY = "http://172.30.21.100"
    }
}
