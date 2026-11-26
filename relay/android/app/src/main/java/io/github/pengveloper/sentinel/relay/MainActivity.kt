package io.github.pengveloper.sentinel.relay

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.text.format.DateFormat
import android.view.LayoutInflater
import android.view.View
import android.view.WindowInsets
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {
    private val main = Handler(Looper.getMainLooper())
    private lateinit var lens: LensView
    private lateinit var runState: TextView
    private lateinit var toggle: Button
    private lateinit var toggleHint: TextView
    private lateinit var address: EditText
    private lateinit var password: EditText
    private lateinit var secret: EditText
    private lateinit var glassLine: TextView
    private lateinit var glassAction: Button
    private lateinit var licenceState: TextView
    private lateinit var phoneAlerts: Switch
    private lateinit var recent: LinearLayout
    private lateinit var recentEmpty: TextView
    private var shownRecent: List<Relay.Received>? = null
    private var pending: (() -> Unit)? = null
    private var findDialog: AlertDialog? = null

    private val render: (Relay.Snapshot) -> Unit = { s -> draw(s) }
    private val redraw = Runnable { draw(Relay.snapshot) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Relay.init(this)
        Notifier.channels(this)
        // Draw behind the system bars on every Android version, as Android 15 does by default.
        if (Build.VERSION.SDK_INT in 30..34) {
            @Suppress("DEPRECATION")
            window.setDecorFitsSystemWindows(false)
        } else if (Build.VERSION.SDK_INT < 30) {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        }
        setContentView(R.layout.activity_main)
        applyInsets(findViewById(R.id.content))

        lens = findViewById(R.id.lens)
        runState = findViewById(R.id.run_state)
        toggle = findViewById(R.id.toggle)
        toggleHint = findViewById(R.id.toggle_hint)
        address = findViewById(R.id.address)
        password = findViewById(R.id.password)
        secret = findViewById(R.id.secret)
        glassLine = findViewById(R.id.glass_line)
        glassAction = findViewById(R.id.glass_action)
        licenceState = findViewById(R.id.licence_state)
        phoneAlerts = findViewById(R.id.phone_alerts)
        recent = findViewById(R.id.recent)
        recentEmpty = findViewById(R.id.recent_empty)

        val v = Relay.vault
        address.setText(v.string(Vault.HUB_ADDRESS) ?: "")
        refreshSecretHints()
        phoneAlerts.isChecked = v.flag(Vault.PHONE_ALERTS, true)
        phoneAlerts.setOnCheckedChangeListener { _, on -> v.putFlag(Vault.PHONE_ALERTS, on) }

        toggle.setOnClickListener {
            val s = Relay.snapshot
            val retry = s.hub == Relay.Hub.WRONG_PASSWORD || s.hub == Relay.Hub.NOT_LOCAL
            if (s.running && !retry) RelayService.stop(this) else startRelay()
        }
        findViewById<Button>(R.id.find).setOnClickListener { saveSecret(); withBluetooth { findGlasses() } }
        glassAction.setOnClickListener {
            saveSecret()
            if (Relay.glasses.connected) Relay.glasses.disconnect() else withBluetooth { Relay.glasses.reconnect() }
        }
        findViewById<Button>(R.id.licence).setOnClickListener {
            startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*"), REQ_LICENCE)
        }
        findViewById<Button>(R.id.test).setOnClickListener {
            saveSecret()
            if (!Relay.glasses.connected) toast(R.string.test_not_connected)
            else if (!Relay.showTest()) toast(R.string.test_failed)
        }
    }

    override fun onStart() {
        super.onStart()
        Relay.listen(render)
    }

    override fun onStop() {
        // Closing the dialog stops its Bluetooth scan; a scan left running would drain the battery.
        findDialog?.dismiss()
        findDialog = null
        Relay.unlisten(render)
        main.removeCallbacksAndMessages(null)
        super.onStop()
    }

    private fun applyInsets(content: View) {
        val base = content.paddingTop
        content.setOnApplyWindowInsetsListener { v, insets ->
            val (l, t, r, b) = if (Build.VERSION.SDK_INT >= 30) {
                val i = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout() or WindowInsets.Type.ime())
                listOf(i.left, i.top, i.right, i.bottom)
            } else {
                @Suppress("DEPRECATION")
                listOf(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            }
            v.setPadding(base + l, base + t, base + r, base + b)
            insets
        }
    }

    private fun refreshSecretHints() {
        val v = Relay.vault
        password.text = null
        password.hint = getString(if (v.has(Vault.HUB_PASSWORD)) R.string.hint_saved else R.string.hint_password)
        secret.text = null
        secret.hint = getString(if (v.has(Vault.ROKID_SECRET)) R.string.hint_saved else R.string.hint_secret)
    }

    private fun saveSecret() {
        val s = secret.text.toString().trim()
        if (s.isNotEmpty()) {
            Relay.vault.putSecretText(Vault.ROKID_SECRET, s)
            refreshSecretHints()
        }
    }

    // ---- relay on / off ----

    private fun startRelay() {
        val parsed = HubAddress.parse(address.text.toString())
        val problem = parsed.problem
        if (problem != null) {
            toggleHint.text = getString(
                when (problem) {
                    HubAddress.Problem.EMPTY -> R.string.addr_empty
                    HubAddress.Problem.BAD_HOST -> R.string.addr_bad_host
                    HubAddress.Problem.BAD_PORT -> R.string.addr_bad_port
                    HubAddress.Problem.LOOPBACK -> R.string.addr_loopback
                    HubAddress.Problem.NOT_PRIVATE -> R.string.addr_not_private
                },
            )
            toggleHint.setTextColor(getColor(R.color.bad))
            address.requestFocus()
            return
        }
        val pw = password.text.toString()
        if (pw.isEmpty() && !Relay.vault.has(Vault.HUB_PASSWORD)) {
            toggleHint.text = getString(R.string.pw_empty)
            toggleHint.setTextColor(getColor(R.color.bad))
            password.requestFocus()
            return
        }
        Relay.vault.putString(Vault.HUB_ADDRESS, parsed.address.toString())
        address.setText(parsed.address.toString())
        if (pw.isNotEmpty()) Relay.vault.putSecretText(Vault.HUB_PASSWORD, pw)
        saveSecret()
        refreshSecretHints()
        toggleHint.text = null
        val go = { RelayService.start(this) }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            pending = go
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIFY)
        } else {
            go()
        }
    }

    // ---- bluetooth ----

    private fun bluetoothPermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= 31) arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
        else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)

    private fun withBluetooth(action: () -> Unit) {
        val missing = bluetoothPermissions().filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isEmpty()) {
            action()
        } else {
            pending = action
            requestPermissions(missing.toTypedArray(), REQ_BLUETOOTH)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val action = pending
        pending = null
        when (requestCode) {
            REQ_NOTIFY -> action?.invoke() // the relay runs either way; only phone alerts need this
            REQ_BLUETOOTH ->
                if (grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) action?.invoke()
                else toast(R.string.bt_permission_needed)
        }
    }

    @SuppressLint("MissingPermission")
    private fun findGlasses() {
        val adapter = getSystemService(BluetoothManager::class.java)?.adapter
        if (adapter == null || !adapter.isEnabled) {
            toast(R.string.bt_off)
            return
        }
        val devices = LinkedHashMap<String, BluetoothDevice>()
        val names = ArrayAdapter<String>(this, R.layout.item_device)
        fun add(d: BluetoothDevice) {
            if (devices.containsKey(d.address)) return
            devices[d.address] = d
            val name = try { d.name } catch (e: SecurityException) { null } ?: getString(R.string.glass_default_name)
            names.add(getString(R.string.device_label, name, d.address.takeLast(2)))
        }
        try {
            adapter.bondedDevices?.filter {
                val n = (try { it.name } catch (e: SecurityException) { null } ?: "").lowercase()
                "glass" in n || "rokid" in n
            }?.forEach(::add)
        } catch (_: SecurityException) {}

        val scanner = adapter.bluetoothLeScanner
        val cb = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) = add(result.device)
            override fun onBatchScanResults(results: MutableList<ScanResult>) = results.forEach { add(it.device) }
        }
        val filter = ScanFilter.Builder().setServiceUuid(ParcelUuid.fromString(Glasses.SERVICE_UUID)).build()
        val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
        try { scanner?.startScan(listOf(filter), settings, cb) } catch (_: Exception) {}
        val stop = Runnable { try { scanner?.stopScan(cb) } catch (_: Exception) {} }
        main.postDelayed(stop, 15_000)

        findDialog?.dismiss()
        findDialog = AlertDialog.Builder(this, R.style.Dialog)
            .setTitle(R.string.find_title)
            .setAdapter(names) { _, which ->
                devices.values.elementAtOrNull(which)?.let { Relay.glasses.pair(it) }
            }
            .setNegativeButton(R.string.cancel, null)
            .setOnDismissListener {
                main.removeCallbacks(stop)
                stop.run()
                findDialog = null
            }
            .show()
        if (names.isEmpty) toast(R.string.find_searching)
    }

    // ---- licence file ----

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_LICENCE || resultCode != RESULT_OK) return
        val uri = data?.data ?: return
        val bytes = try {
            contentResolver.openInputStream(uri)?.use { input ->
                val buf = input.readBytes()
                if (buf.size in 1..65_536) buf else null
            }
        } catch (e: Exception) {
            null
        }
        if (bytes == null) {
            toast(R.string.licence_unreadable)
            return
        }
        Relay.vault.putSecret(Vault.ROKID_LICENCE, bytes)
        draw(Relay.snapshot)
        toast(R.string.licence_saved)
    }

    // ---- drawing ----

    private fun draw(s: Relay.Snapshot) {
        runState.text = getString(if (s.running) R.string.state_running else R.string.state_stopped)
        runState.setTextColor(getColor(if (s.running) R.color.ok else R.color.muted))
        runState.backgroundTintList = ColorStateList.valueOf(getColor(if (s.running) R.color.ok_soft else R.color.raise))
        // After a wrong password the button retries with what is in the field instead of stopping.
        val retry = s.running && (s.hub == Relay.Hub.WRONG_PASSWORD || s.hub == Relay.Hub.NOT_LOCAL)
        val stops = s.running && !retry
        toggle.text = getString(if (retry) R.string.retry_relay else if (stops) R.string.stop_relay else R.string.start_relay)
        toggle.setBackgroundResource(if (stops) R.drawable.bg_secondary else R.drawable.bg_primary)
        toggle.setTextColor(getColor(if (stops) R.color.text else R.color.ink))

        node(R.id.hub_dot, R.id.hub_state, Labels.hubTone(s.hub), s.hubAddress?.takeIf { s.hub == Relay.Hub.ON } ?: Labels.hub(this, s))
        node(R.id.phone_dot, R.id.phone_state, if (s.running) Labels.Tone.GOOD else Labels.Tone.IDLE,
            getString(if (s.running) R.string.phone_relaying else R.string.phone_idle))
        node(R.id.glass_dot, R.id.glass_state, Labels.glassTone(s.glass), Labels.glassShort(this, s.glass))
        link(R.id.link1a, R.id.link1b, s.hub == Relay.Hub.ON)
        link(R.id.link2a, R.id.link2b, s.glass == Relay.Glass.ON && s.running)

        val help = when (s.hub) {
            Relay.Hub.WRONG_PASSWORD -> R.string.hub_wrong_password_help
            Relay.Hub.BLOCKED -> R.string.hub_blocked_help
            Relay.Hub.NOT_LOCAL -> R.string.hub_not_local_help
            else -> 0
        }
        if (help != 0) {
            toggleHint.text = getString(help)
            toggleHint.setTextColor(getColor(R.color.bad))
        }

        val latest = s.latest
        val elapsed = latest?.let { System.currentTimeMillis() - it.at } ?: Long.MAX_VALUE
        if (latest != null && elapsed in 0 until latest.alert.ttl * 1000L) {
            lens.showAlert(Relay.linesFor(latest.alert, latest.at), elapsed, latest.alert.ttl * 1000L)
            main.removeCallbacks(redraw)
            main.postDelayed(redraw, latest.alert.ttl * 1000L - elapsed + 50)
        } else {
            lens.showIdle(
                getString(if (s.running) R.string.lens_waiting else R.string.lens_off),
                getString(if (s.running) R.string.lens_waiting_body else R.string.lens_off_body),
            )
        }

        val v = Relay.vault
        val name = v.string(Vault.GLASSES_NAME)
        glassLine.text = if (name == null) getString(R.string.glass_none_line)
        else getString(R.string.glass_line, name, v.string(Vault.GLASSES_HINT) ?: "··", Labels.glassShort(this, s.glass)) +
            (s.glassDetail?.let { " — $it" } ?: "")
        glassAction.visibility = if (name == null) View.GONE else View.VISIBLE
        glassAction.text = getString(if (s.glass == Relay.Glass.ON) R.string.glass_disconnect else R.string.glass_reconnect)
        licenceState.text = getString(if (v.has(Vault.ROKID_LICENCE)) R.string.licence_present else R.string.licence_absent)

        if (s.recent !== shownRecent) {
            shownRecent = s.recent
            drawRecent(s.recent)
        }
    }

    private fun node(dotId: Int, stateId: Int, tone: Labels.Tone, text: String) {
        findViewById<View>(dotId).backgroundTintList = ColorStateList.valueOf(Labels.color(this, tone))
        findViewById<TextView>(stateId).text = text
    }

    private fun link(a: Int, b: Int, on: Boolean) {
        val c = ColorStateList.valueOf(getColor(if (on) R.color.ok else R.color.line2))
        findViewById<View>(a).backgroundTintList = c
        findViewById<View>(b).backgroundTintList = c
    }

    private fun drawRecent(items: List<Relay.Received>) {
        recent.removeAllViews()
        recentEmpty.visibility = if (items.isEmpty()) View.VISIBLE else View.GONE
        val inflater = LayoutInflater.from(this)
        for (r in items) {
            val row = inflater.inflate(R.layout.item_alert, recent, false)
            row.findViewById<View>(R.id.mark).backgroundTintList =
                ColorStateList.valueOf(getColor(if (r.alert.urgent) R.color.gold else R.color.wave))
            row.findViewById<TextView>(R.id.title).text = r.alert.title
            row.findViewById<TextView>(R.id.body).apply {
                text = r.alert.body
                visibility = if (r.alert.body.isEmpty()) View.GONE else View.VISIBLE
            }
            val parts = mutableListOf(DateFormat.getTimeFormat(this).format(r.at))
            Relay.sourceLabel(r.alert)?.let { parts += it }
            parts += getString(if (r.onGlasses) R.string.shown_on_glasses else R.string.not_on_glasses)
            row.findViewById<TextView>(R.id.meta).apply {
                text = parts.joinToString("  ·  ")
                setTextColor(getColor(if (r.alert.simulated) R.color.sim else R.color.muted))
            }
            recent.addView(row)
        }
    }

    private fun toast(res: Int) = Toast.makeText(this, res, Toast.LENGTH_SHORT).show()

    companion object {
        private const val REQ_NOTIFY = 1
        private const val REQ_BLUETOOTH = 2
        private const val REQ_LICENCE = 3
    }
}
