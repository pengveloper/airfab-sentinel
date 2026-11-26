package io.github.pengveloper.sentinel.relay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/** Phone notifications: one quiet channel for the running relay, two for alerts. */
object Notifier {
    const val SERVICE_ID = 1
    private const val CH_SERVICE = "relay"
    private const val CH_ALERT = "alert"
    private const val CH_INFO = "info"
    private const val GROUP = "alerts"
    private var nextId = 100

    fun channels(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannels(
            listOf(
                NotificationChannel(CH_SERVICE, ctx.getString(R.string.ch_service), NotificationManager.IMPORTANCE_LOW).apply {
                    setShowBadge(false)
                },
                NotificationChannel(CH_ALERT, ctx.getString(R.string.ch_alert), NotificationManager.IMPORTANCE_HIGH),
                NotificationChannel(CH_INFO, ctx.getString(R.string.ch_info), NotificationManager.IMPORTANCE_DEFAULT),
            ),
        )
    }

    private fun openApp(ctx: Context) = PendingIntent.getActivity(
        ctx, 0, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    fun service(ctx: Context, s: Relay.Snapshot): Notification {
        val stop = PendingIntent.getService(
            ctx, 1, Intent(ctx, RelayService::class.java).setAction(RelayService.ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val text = ctx.getString(R.string.service_text, Labels.hub(ctx, s), Labels.glassShort(ctx, s.glass))
        val b = Notification.Builder(ctx, CH_SERVICE)
            .setSmallIcon(R.drawable.ic_stat_relay)
            .setColor(ctx.getColor(R.color.gold))
            .setContentTitle(ctx.getString(R.string.service_title))
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openApp(ctx))
            .addAction(Notification.Action.Builder(null, ctx.getString(R.string.action_stop), stop).build())
        if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
        return b.build()
    }

    fun alert(ctx: Context, a: Alert) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 24 && !nm.areNotificationsEnabled()) return
        val n = Notification.Builder(ctx, if (a.urgent) CH_ALERT else CH_INFO)
            .setSmallIcon(R.drawable.ic_stat_relay)
            .setColor(ctx.getColor(if (a.urgent) R.color.gold else R.color.wave))
            .setContentTitle(a.title)
            .setContentText(a.body)
            .setSubText(Relay.sourceLabel(a))
            .setCategory(if (a.urgent) Notification.CATEGORY_ALARM else Notification.CATEGORY_STATUS)
            .setGroup(GROUP)
            .setAutoCancel(true)
            .setWhen(System.currentTimeMillis())
            .setShowWhen(true)
            .setTimeoutAfter(10 * 60_000L) // an old alert shown late would be misleading
            .setContentIntent(openApp(ctx))
            .build()
        try {
            nm.notify(nextId++, n)
        } catch (e: SecurityException) {
            // notification permission withdrawn; the in-app list still has the alert
        }
        if (nextId > 140) nextId = 100
    }
}
