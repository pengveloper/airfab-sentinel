package com.wavrel.relay

import android.content.Context
import android.os.Handler
import android.os.Looper
import java.text.DateFormat
import java.util.Date

/**
 * The relay's state for the whole process: one hub connection, one glasses link and the
 * recent alerts. The service keeps the process alive while the relay runs; the screen only
 * listens. Everything here runs on the main thread.
 */
object Relay {
    const val HUB_USER = "lab"
    const val RECENT_MAX = 20

    enum class Hub { OFF, CONNECTING, ON, WRONG_PASSWORD, BLOCKED, UNREACHABLE, NOT_LOCAL }
    enum class Glass { NONE, OFF, CONNECTING, ON, NEED_LICENCE, NO_DISPLAY, FAILED }

    data class Received(val alert: Alert, val at: Long, val onGlasses: Boolean)

    data class Snapshot(
        val running: Boolean = false,
        val hub: Hub = Hub.OFF,
        val hubAddress: String? = null,
        val glass: Glass = Glass.NONE,
        val glassDetail: String? = null,
        val recent: List<Received> = emptyList(),
    ) {
        val latest: Received? get() = recent.firstOrNull()
    }

    private val main = Handler(Looper.getMainLooper())
    private lateinit var app: Context
    lateinit var vault: Vault
        private set
    lateinit var glasses: Glasses
        private set
    private var hub: HubClient? = null
    private val listeners = LinkedHashSet<(Snapshot) -> Unit>()

    var snapshot = Snapshot()
        private set

    fun init(context: Context) {
        if (::app.isInitialized) return
        app = context.applicationContext
        vault = Vault(app)
        glasses = Glasses(app, vault) { s, detail -> update(snapshot.copy(glass = s, glassDetail = detail)) }
        snapshot = snapshot.copy(glass = glasses.state)
    }

    fun listen(l: (Snapshot) -> Unit) {
        listeners += l
        l(snapshot)
    }

    fun unlisten(l: (Snapshot) -> Unit) {
        listeners -= l
    }

    private fun update(s: Snapshot) {
        snapshot = s
        listeners.toList().forEach { it(s) }
    }

    private fun onMain(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
    }

    /** Starts from saved settings. False when the hub address or password is missing. */
    fun start(): Boolean {
        val parsed = vault.string(Vault.HUB_ADDRESS)?.let { HubAddress.parse(it).address } ?: return false
        val password = vault.secretText(Vault.HUB_PASSWORD)?.takeIf { it.isNotEmpty() } ?: return false
        hub?.close()
        val client = HubClient(parsed, password,
            onState = { s -> onMain { if (hub != null) update(snapshot.copy(hub = s)) } },
            onAlert = { a -> onMain { deliver(a) } },
        )
        hub = client
        update(snapshot.copy(running = true, hub = Hub.CONNECTING, hubAddress = parsed.toString()))
        client.start()
        if (!glasses.connected) glasses.reconnect()
        return true
    }

    fun stop() {
        hub?.close()
        hub = null
        update(snapshot.copy(running = false, hub = Hub.OFF))
    }

    private fun deliver(a: Alert) {
        if (snapshot.recent.any { it.alert.id == a.id }) return // the same alert after a reconnect
        val now = System.currentTimeMillis()
        val shown = glasses.show(linesFor(a, now), a.ttl)
        val item = Received(a, now, shown)
        update(snapshot.copy(recent = (listOf(item) + snapshot.recent).take(RECENT_MAX)))
        if (vault.flag(Vault.PHONE_ALERTS, true)) Notifier.alert(app, a)
    }

    /** Sends a made-up alert straight to the glasses, without the hub. */
    fun showTest(): Boolean {
        val a = Alert(
            id = "test-" + System.currentTimeMillis(), ts = System.currentTimeMillis(), kind = "test",
            level = Alert.LEVEL_INFO, title = app.getString(R.string.test_title), body = app.getString(R.string.test_body),
            ttl = Alert.TTL_DEFAULT, source = Alert.SOURCE_BROKER,
        )
        val now = System.currentTimeMillis()
        val shown = glasses.show(linesFor(a, now), a.ttl)
        update(snapshot.copy(recent = (listOf(Received(a, now, shown)) + snapshot.recent).take(RECENT_MAX)))
        return shown
    }

    fun linesFor(a: Alert, receivedAt: Long): GlassLayout.Lines {
        val level = app.getString(if (a.urgent) R.string.tag_alert else R.string.tag_info)
        val tag = sourceLabel(a)?.let { "$level · $it" } ?: level
        val time = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(receivedAt))
        return GlassLayout.Lines(tag, a.title, a.body, time)
    }

    /** A short name for where the values came from, or null for live hub data. */
    fun sourceLabel(a: Alert): String? = when (a.source) {
        Alert.SOURCE_BROKER -> null
        "broker_with_simulator" -> app.getString(R.string.src_mixed)
        "replay" -> app.getString(R.string.src_replay)
        "built_in_simulator" -> app.getString(R.string.src_simulator)
        else -> app.getString(R.string.src_unknown)
    }
}
