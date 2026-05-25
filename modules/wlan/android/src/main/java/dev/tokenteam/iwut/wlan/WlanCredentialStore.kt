package dev.tokenteam.iwut.wlan

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal data class WlanCredentials(val username: String, val password: String)

internal class WlanCredentialStore(context: Context) {
    private val preferences =
        context.getSharedPreferences("wlan_credentials", Context.MODE_PRIVATE)

    fun save(username: String, password: String) {
        val plainText = JSONObject()
            .put("username", username)
            .put("password", password)
            .toString()
            .toByteArray(Charsets.UTF_8)

        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val encrypted = cipher.doFinal(plainText)
        val stored = JSONObject()
            .put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .put("data", Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .toString()

        preferences.edit().putString(KEY_CREDENTIALS, stored).apply()
    }

    fun load(): WlanCredentials? {
        val stored = preferences.getString(KEY_CREDENTIALS, null) ?: return null
        return runCatching {
            val objectValue = JSONObject(stored)
            val iv = Base64.decode(objectValue.getString("iv"), Base64.NO_WRAP)
            val encrypted = Base64.decode(objectValue.getString("data"), Base64.NO_WRAP)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(128, iv))
            val plainText = String(cipher.doFinal(encrypted), Charsets.UTF_8)
            val credentials = JSONObject(plainText)
            WlanCredentials(
                username = credentials.getString("username"),
                password = credentials.getString("password")
            )
        }.getOrNull()
    }

    fun clear() {
        preferences.edit().remove(KEY_CREDENTIALS).apply()
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val storedKey = keyStore.getKey(KEYSTORE_ALIAS, null)
        if (storedKey is SecretKey) {
            return storedKey
        }

        val generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        )
        val spec = KeyGenParameterSpec.Builder(
            KEYSTORE_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build()
        generator.init(spec)
        return generator.generateKey()
    }

    private companion object {
        const val KEY_CREDENTIALS = "credentials"
        const val KEYSTORE_ALIAS = "dev.tokenteam.iwut.wlan.credentials"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
