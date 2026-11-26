package com.wavrel.relay

import org.eclipse.paho.client.mqttv3.IMqttActionListener
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken
import org.eclipse.paho.client.mqttv3.IMqttToken
import org.eclipse.paho.client.mqttv3.MqttAsyncClient
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended
import org.eclipse.paho.client.mqttv3.MqttConnectOptions
import org.eclipse.paho.client.mqttv3.MqttException
import org.eclipse.paho.client.mqttv3.MqttMessage
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence
import java.net.Inet4Address
import java.net.Inet6Address
import java.net.InetAddress
import java.security.SecureRandom
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Subscribes to the PC hub's alert topic. Callbacks arrive on a background thread.
 *
 * A wrong password is not retried: the hub blocks an address for a minute after five failed
 * logins, and retrying would lock the phone out while the user fixes the password.
 */
class HubClient(
    private val address: HubAddress,
    private val password: String,
    private val onState: (Relay.Hub) -> Unit,
    private val onAlert: (Alert) -> Unit,
) {
    private val worker = Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "hub").apply { isDaemon = true } }
    private var client: MqttAsyncClient? = null
    @Volatile private var closed = false
    private var attempt = 0

    fun start() = worker.execute { connect() }

    fun close() {
        closed = true
        worker.execute {
            client?.let { c ->
                try { c.disconnectForcibly(0, 1000) } catch (_: Exception) {}
                try { c.close() } catch (_: Exception) {}
            }
            client = null
        }
        worker.shutdown()
    }

    private val callback = object : MqttCallbackExtended {
        override fun connectComplete(reconnect: Boolean, serverURI: String?) {
            if (closed) return
            attempt = 0
            try {
                client?.subscribe(Alert.TOPIC, 0)
                onState(Relay.Hub.ON)
            } catch (e: MqttException) {
                onState(Relay.Hub.UNREACHABLE)
            }
        }

        override fun connectionLost(cause: Throwable?) {
            if (!closed) onState(Relay.Hub.CONNECTING) // automatic reconnect takes over from here
        }

        override fun messageArrived(topic: String?, message: MqttMessage?) {
            if (closed || topic != Alert.TOPIC || message == null) return
            Alert.parse(String(message.payload, Charsets.UTF_8))?.let(onAlert)
        }

        override fun deliveryComplete(token: IMqttDeliveryToken?) = Unit
    }

    private fun connect() {
        if (closed) return
        onState(Relay.Hub.CONNECTING)
        // Resolve here and connect to the address itself: a host name must lead to the local
        // network before the password is sent, and must not be re-resolved somewhere else later.
        val target = client?.serverURI ?: run {
            val found = try {
                InetAddress.getAllByName(address.host).toList()
            } catch (e: Exception) {
                onState(Relay.Hub.UNREACHABLE)
                schedule(minOf(30, 2 shl minOf(attempt++, 4)))
                return
            }
            val local = found.filter { HubAddress.isLocal(it.address) }.sortedBy { if (it is Inet4Address) 0 else 1 }
            val chosen = local.firstOrNull() ?: run {
                onState(Relay.Hub.NOT_LOCAL)
                return
            }
            val host = if (chosen is Inet6Address) chosen.hostAddress!!.substringBefore('%') else chosen.hostAddress!!
            HubAddress(host, address.port).uri
        }
        val c = client ?: try {
            MqttAsyncClient(target, clientId(), MemoryPersistence()).also {
                it.setCallback(callback)
                client = it
            }
        } catch (e: Exception) {
            onState(Relay.Hub.UNREACHABLE)
            return
        }
        val options = MqttConnectOptions().apply {
            userName = Relay.HUB_USER
            password = this@HubClient.password.toCharArray()
            isCleanSession = true
            isAutomaticReconnect = true
            maxReconnectDelay = 30_000
            connectionTimeout = 10
            keepAliveInterval = 30
            mqttVersion = MqttConnectOptions.MQTT_VERSION_3_1_1
        }
        try {
            c.connect(options, null, object : IMqttActionListener {
                override fun onSuccess(asyncActionToken: IMqttToken?) = Unit
                override fun onFailure(asyncActionToken: IMqttToken?, exception: Throwable?) = failed(exception)
            })
        } catch (e: MqttException) {
            failed(e)
        }
    }

    private fun failed(e: Throwable?) {
        if (closed) return
        when ((e as? MqttException)?.reasonCode) {
            MqttException.REASON_CODE_FAILED_AUTHENTICATION.toInt() -> {
                onState(Relay.Hub.WRONG_PASSWORD)
                return
            }
            MqttException.REASON_CODE_NOT_AUTHORIZED.toInt() -> {
                // The hub answers "not authorized" while it is blocking this address.
                onState(Relay.Hub.BLOCKED)
                schedule(65)
                return
            }
        }
        onState(Relay.Hub.UNREACHABLE)
        schedule(minOf(30, 2 shl minOf(attempt, 4)))
        attempt++
    }

    private fun schedule(seconds: Int) {
        if (closed) return
        try { worker.schedule({ connect() }, seconds.toLong(), TimeUnit.SECONDS) } catch (_: Exception) {}
    }

    private fun clientId(): String {
        val b = ByteArray(5).also { SecureRandom().nextBytes(it) }
        return "relay-" + b.joinToString("") { "%02x".format(it) }
    }
}
