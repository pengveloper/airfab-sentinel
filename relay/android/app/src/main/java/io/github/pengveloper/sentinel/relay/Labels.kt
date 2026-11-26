package io.github.pengveloper.sentinel.relay

import android.content.Context

/** Words and colours for each state, shared by the screen and the ongoing notification. */
object Labels {
    enum class Tone { IDLE, BUSY, GOOD, BAD }

    fun hub(ctx: Context, s: Relay.Snapshot): String = ctx.getString(
        when (s.hub) {
            Relay.Hub.OFF -> R.string.hub_off
            Relay.Hub.CONNECTING -> R.string.hub_connecting
            Relay.Hub.ON -> R.string.hub_on
            Relay.Hub.WRONG_PASSWORD -> R.string.hub_wrong_password
            Relay.Hub.BLOCKED -> R.string.hub_blocked
            Relay.Hub.UNREACHABLE -> R.string.hub_unreachable
            Relay.Hub.NOT_LOCAL -> R.string.hub_not_local
        },
    )

    fun hubTone(h: Relay.Hub) = when (h) {
        Relay.Hub.OFF -> Tone.IDLE
        Relay.Hub.CONNECTING -> Tone.BUSY
        Relay.Hub.ON -> Tone.GOOD
        else -> Tone.BAD
    }

    fun glassShort(ctx: Context, g: Relay.Glass): String = ctx.getString(
        when (g) {
            Relay.Glass.NONE -> R.string.glass_none
            Relay.Glass.OFF -> R.string.glass_off
            Relay.Glass.CONNECTING -> R.string.glass_connecting
            Relay.Glass.ON -> R.string.glass_on
            Relay.Glass.NEED_LICENCE -> R.string.glass_need_licence
            Relay.Glass.NO_DISPLAY -> R.string.glass_no_display
            Relay.Glass.FAILED -> R.string.glass_failed
        },
    )

    fun glassTone(g: Relay.Glass) = when (g) {
        Relay.Glass.NONE, Relay.Glass.OFF -> Tone.IDLE
        Relay.Glass.CONNECTING -> Tone.BUSY
        Relay.Glass.ON -> Tone.GOOD
        else -> Tone.BAD
    }

    fun color(ctx: Context, t: Tone): Int = ctx.getColor(
        when (t) {
            Tone.IDLE -> R.color.line2
            Tone.BUSY -> R.color.wave
            Tone.GOOD -> R.color.ok
            Tone.BAD -> R.color.bad
        },
    )
}
