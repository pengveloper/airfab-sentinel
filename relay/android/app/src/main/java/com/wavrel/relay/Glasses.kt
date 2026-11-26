package com.wavrel.relay

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.content.Context
import android.os.Handler
import android.os.Looper
import com.rokid.cxr.client.extend.CxrApi
import com.rokid.cxr.client.extend.callbacks.BluetoothStatusCallback
import com.rokid.cxr.client.extend.listeners.CustomViewListener
import com.rokid.cxr.client.utils.ValueUtil

/**
 * The link to Rokid glasses through Rokid's CXR-M SDK, and the one screen the relay shows on
 * them. Every call happens on the main thread.
 *
 * First pairing: `initBluetooth` with the chosen device reports a socket UUID and a MAC address,
 * which are kept (sealed) for reconnecting with `connectBluetooth`. Rokid's SDK checks a licence
 * file and client secret issued to the developer on that reconnect; without them the relay still
 * tries the first connection, which Rokid's SDK does not check.
 */
class Glasses(private val app: Context, private val vault: Vault, private val onState: (Relay.Glass, String?) -> Unit) {
    private val main = Handler(Looper.getMainLooper())
    private val api: CxrApi get() = CxrApi.getInstance()
    private var viewOpen = false
    private var closeTask: Runnable? = null
    private var waitTask: Runnable? = null
    var state = Relay.Glass.NONE
        private set

    init {
        if (vault.has(Vault.GLASSES_UUID)) state = Relay.Glass.OFF
        api.setCustomViewListener(object : CustomViewListener {
            override fun onIconsSent() {}
            override fun onUpdated() {}
            override fun onOpened() {
                main.post { viewOpen = true }
            }
            override fun onOpenFailed(p0: Int) {
                main.post {
                    viewOpen = false
                    set(state, app.getString(R.string.glass_open_failed, p0))
                }
            }
            override fun onClosed() {
                main.post { viewOpen = false }
            }
        })
    }

    val connected: Boolean get() = try { api.isBluetoothConnected } catch (e: Exception) { false }

    private fun set(s: Relay.Glass, detail: String? = null) {
        state = s
        onState(s, detail)
    }

    /**
     * [pairing] is true for the callback given to `initBluetooth`. Only that one goes on to
     * `connectBluetooth`; the reconnect callback may report connection info again and must not
     * start another reconnect.
     */
    private fun statusCallback(pairing: Boolean) = object : BluetoothStatusCallback {
        override fun onConnectionInfo(socketUuid: String?, macAddress: String?, rokidAccount: String?, glassesType: Int) {
            if (!pairing) return
            main.post {
                if (socketUuid.isNullOrEmpty() || macAddress.isNullOrEmpty()) {
                    set(Relay.Glass.FAILED, app.getString(R.string.glass_no_info))
                    return@post
                }
                vault.putSecretText(Vault.GLASSES_UUID, socketUuid)
                vault.putSecretText(Vault.GLASSES_MAC, macAddress)
                vault.putString(Vault.GLASSES_HINT, macAddress.takeLast(2))
                if (glassesType == 0) {
                    set(Relay.Glass.NO_DISPLAY)
                    return@post
                }
                if (state == Relay.Glass.ON) return@post
                if (!reconnect(reportMissing = false)) {
                    // No licence yet: give the first connection a moment to finish by itself.
                    waitTask?.let(main::removeCallbacks)
                    waitTask = Runnable { if (state != Relay.Glass.ON) set(Relay.Glass.NEED_LICENCE) }.also { main.postDelayed(it, 10_000) }
                }
            }
        }

        override fun onConnected() {
            main.post {
                waitTask?.let(main::removeCallbacks)
                set(Relay.Glass.ON)
            }
        }

        override fun onDisconnected() {
            main.post {
                viewOpen = false
                set(Relay.Glass.OFF)
            }
        }

        override fun onFailed(p0: ValueUtil.CxrBluetoothErrorCode?) {
            main.post { set(Relay.Glass.FAILED, p0?.name) }
        }
    }

    /** First connection to a device the user picked. */
    @SuppressLint("MissingPermission")
    fun pair(device: BluetoothDevice) {
        val name = try { device.name } catch (e: SecurityException) { null }
        vault.putString(Vault.GLASSES_NAME, name ?: app.getString(R.string.glass_default_name))
        set(Relay.Glass.CONNECTING)
        try {
            api.initBluetooth(app, device, statusCallback(pairing = true))
        } catch (e: Exception) {
            set(Relay.Glass.FAILED, e.javaClass.simpleName)
        }
    }

    /**
     * Reconnects to the saved glasses. False when no glasses are saved or the Rokid licence or
     * client secret is missing; with [reportMissing] the latter is shown as the glasses' state.
     */
    fun reconnect(reportMissing: Boolean = true): Boolean {
        val uuid = vault.secretText(Vault.GLASSES_UUID) ?: return false
        val mac = vault.secretText(Vault.GLASSES_MAC) ?: return false
        val licence = vault.secret(Vault.ROKID_LICENCE)
        val secret = vault.secretText(Vault.ROKID_SECRET)?.takeIf { it.isNotBlank() }
        if (licence == null || secret == null) {
            if (reportMissing) set(Relay.Glass.NEED_LICENCE)
            return false
        }
        val method = CxrApi::class.java.methods.filter { it.name == "connectBluetooth" }.maxByOrNull { it.parameterTypes.size }
        val args = method?.let {
            ConnectArgs.build(
                it.parameterTypes.toList(), Context::class.java, BluetoothStatusCallback::class.java,
                ConnectArgs.Values(app, uuid, mac, CLIENT_NAME, statusCallback(pairing = false), licence, secret),
            )
        }
        if (method == null || args == null) {
            set(Relay.Glass.FAILED, app.getString(R.string.glass_sdk_unsupported))
            return true
        }
        set(Relay.Glass.CONNECTING)
        try {
            method.invoke(api, *args)
        } catch (e: Exception) {
            set(Relay.Glass.FAILED, (e.cause ?: e).javaClass.simpleName)
        }
        return true
    }

    fun disconnect() {
        closeTask?.let(main::removeCallbacks)
        waitTask?.let(main::removeCallbacks)
        try { if (viewOpen) api.closeCustomView() } catch (_: Exception) {}
        try { api.deinitBluetooth() } catch (_: Exception) {}
        viewOpen = false
        set(if (vault.has(Vault.GLASSES_UUID)) Relay.Glass.OFF else Relay.Glass.NONE)
    }

    fun forget() {
        disconnect()
        listOf(Vault.GLASSES_UUID, Vault.GLASSES_MAC).forEach { vault.putSecret(it, null) }
        listOf(Vault.GLASSES_NAME, Vault.GLASSES_HINT).forEach { vault.putString(it, null) }
        set(Relay.Glass.NONE)
    }

    /** Shows four lines for [seconds], replacing whatever the relay showed before. */
    fun show(lines: GlassLayout.Lines, seconds: Int): Boolean {
        if (!connected) return false
        val ok = try {
            if (viewOpen) {
                // If an update is refused, open the screen again rather than leave old text up.
                api.updateCustomView(GlassLayout.update(lines)) == SUCCEED || api.openCustomView(GlassLayout.open(lines)) == SUCCEED
            } else {
                api.openCustomView(GlassLayout.open(lines)) == SUCCEED
            }
        } catch (e: Exception) {
            false
        }
        if (!ok) return false
        viewOpen = true
        closeTask?.let(main::removeCallbacks)
        closeTask = Runnable {
            try { api.closeCustomView() } catch (_: Exception) {}
            viewOpen = false
        }.also { main.postDelayed(it, seconds * 1000L) }
        return true
    }

    companion object {
        const val CLIENT_NAME = "Wavrel Relay"
        private val SUCCEED = ValueUtil.CxrStatus.REQUEST_SUCCEED
        /** Rokid glasses advertise this BLE service (Rokid's CXR-M device connection guide). */
        const val SERVICE_UUID = "00009100-0000-1000-8000-00805f9b34fb"
    }
}
