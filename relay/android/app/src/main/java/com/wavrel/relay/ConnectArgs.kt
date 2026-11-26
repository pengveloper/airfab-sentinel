package com.wavrel.relay

/**
 * Arguments for `CxrApi.connectBluetooth`, whose parameter list has changed between SDK
 * releases: `(context, uuid, mac, callback)` in early builds, then `(context, uuid, mac,
 * callback, licence, secret)`, and later with a client name before the callback. The relay
 * fills whichever shape the installed SDK has, so moving to a newer SDK is a version bump.
 *
 * Kept free of Android and SDK types so it can be unit tested.
 */
object ConnectArgs {

    class Values(
        val context: Any,
        val uuid: String,
        val mac: String,
        val clientName: String,
        val callback: Any,
        val licence: ByteArray,
        val secret: String,
    )

    /**
     * Returns the argument array for [types], or null when the shape is not one the relay
     * understands (then the caller reports the SDK as unsupported instead of guessing).
     */
    fun build(types: List<Class<*>>, contextType: Class<*>, callbackType: Class<*>, v: Values): Array<Any>? {
        val cbAt = types.indexOfFirst { callbackType.isAssignableFrom(it) }
        if (cbAt < 0 || types.isEmpty() || !contextType.isAssignableFrom(types[0])) return null
        val before = listOf(v.uuid, v.mac, v.clientName)
        var nextBefore = 0
        var stringsAfter = 0
        val out = ArrayList<Any>(types.size)
        for ((i, t) in types.withIndex()) {
            out += when {
                i == 0 -> v.context
                i == cbAt -> v.callback
                t == ByteArray::class.java -> v.licence
                t == String::class.java && i < cbAt -> {
                    if (nextBefore >= before.size) return null
                    before[nextBefore++]
                }
                t == String::class.java -> {
                    if (stringsAfter++ > 0) return null
                    v.secret
                }
                else -> return null
            }
        }
        return if (nextBefore >= 2) out.toTypedArray() else null
    }
}
