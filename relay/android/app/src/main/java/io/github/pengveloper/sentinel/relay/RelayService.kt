package io.github.pengveloper.sentinel.relay

import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/** Keeps the relay running with the screen off, shown as an ongoing notification. */
class RelayService : Service() {
    private var lastText: String? = null
    private val listener: (Relay.Snapshot) -> Unit = { s ->
        val text = "${s.hub}/${s.glass}"
        if (s.running && text != lastText) {
            lastText = text
            getSystemService(NotificationManager::class.java).notify(Notifier.SERVICE_ID, Notifier.service(this, s))
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Relay.init(this)
        Notifier.channels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            Relay.vault.putFlag(Vault.RELAY_ON, false)
            Relay.stop()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        try {
            val n = Notifier.service(this, Relay.snapshot)
            if (Build.VERSION.SDK_INT >= 29) startForeground(Notifier.SERVICE_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
            else startForeground(Notifier.SERVICE_ID, n)
        } catch (e: Exception) {
            // Android refused a foreground start (for example from the background); try again from the app.
            stopSelf()
            return START_NOT_STICKY
        }
        if (!Relay.snapshot.running && !Relay.start()) {
            Relay.vault.putFlag(Vault.RELAY_ON, false)
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        Relay.vault.putFlag(Vault.RELAY_ON, true)
        Relay.listen(listener)
        return START_STICKY
    }

    override fun onDestroy() {
        Relay.unlisten(listener)
        if (Relay.snapshot.running) Relay.stop()
        super.onDestroy()
    }

    companion object {
        const val ACTION_STOP = "io.github.pengveloper.sentinel.relay.STOP"

        fun start(ctx: Context) {
            ctx.startForegroundService(Intent(ctx, RelayService::class.java))
        }

        fun stop(ctx: Context) {
            ctx.startService(Intent(ctx, RelayService::class.java).setAction(ACTION_STOP))
        }
    }
}
