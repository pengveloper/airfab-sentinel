package io.github.pengveloper.sentinel.relay

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Settings on the phone. Plain values (hub address, switches) live in private preferences;
 * secrets (hub password, Rokid client secret and licence, the glasses' link details) are
 * sealed with an AES-GCM key that never leaves the Android Keystore. Backups are off in the
 * manifest, so none of this is copied off the phone.
 */
class Vault(context: Context) {
    private val prefs = context.getSharedPreferences("relay", Context.MODE_PRIVATE)

    fun string(key: String): String? = prefs.getString(key, null)
    fun putString(key: String, value: String?) = prefs.edit().apply { if (value == null) remove(key) else putString(key, value) }.apply()
    fun flag(key: String, default: Boolean) = prefs.getBoolean(key, default)
    fun putFlag(key: String, value: Boolean) = prefs.edit().putBoolean(key, value).apply()

    fun has(key: String) = prefs.contains(SEALED + key)

    fun secret(key: String): ByteArray? {
        val stored = prefs.getString(SEALED + key, null) ?: return null
        return try {
            val raw = Base64.decode(stored, Base64.NO_WRAP)
            val cipher = Cipher.getInstance(TRANSFORM)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, raw, 0, IV_BYTES))
            cipher.doFinal(raw, IV_BYTES, raw.size - IV_BYTES)
        } catch (e: Exception) {
            null // key replaced (for example after a restore); the user enters the value again
        }
    }

    fun secretText(key: String): String? = secret(key)?.toString(Charsets.UTF_8)

    fun putSecret(key: String, value: ByteArray?) {
        if (value == null) {
            prefs.edit().remove(SEALED + key).apply()
            return
        }
        val cipher = Cipher.getInstance(TRANSFORM)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val sealed = cipher.iv + cipher.doFinal(value)
        prefs.edit().putString(SEALED + key, Base64.encodeToString(sealed, Base64.NO_WRAP)).apply()
    }

    fun putSecretText(key: String, value: String?) = putSecret(key, value?.toByteArray(Charsets.UTF_8))

    private fun key(): SecretKey {
        val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        gen.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return gen.generateKey()
    }

    companion object {
        const val HUB_ADDRESS = "hub_address"
        const val HUB_PASSWORD = "hub_password"
        const val RELAY_ON = "relay_on"
        const val PHONE_ALERTS = "phone_alerts"
        const val GLASSES_NAME = "glasses_name"
        const val GLASSES_HINT = "glasses_hint"
        const val GLASSES_UUID = "glasses_uuid"
        const val GLASSES_MAC = "glasses_mac"
        const val ROKID_LICENCE = "rokid_licence"
        const val ROKID_SECRET = "rokid_secret"

        private const val SEALED = "sealed."
        private const val KEYSTORE = "AndroidKeyStore"
        private const val ALIAS = "sentinel-relay"
        private const val TRANSFORM = "AES/GCM/NoPadding"
        private const val IV_BYTES = 12
    }
}
