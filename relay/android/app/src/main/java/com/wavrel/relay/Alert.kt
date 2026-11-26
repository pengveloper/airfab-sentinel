package com.wavrel.relay

import com.google.gson.JsonObject
import com.google.gson.JsonParser

/**
 * One alert from the hub's `lab/out/notify` topic, format version 1 (docs/NOTIFY.md).
 * Anything that does not look like a v1 alert is dropped rather than shown half-understood.
 */
data class Alert(
    val id: String,
    val ts: Long,
    val kind: String,
    val level: String,
    val title: String,
    val body: String,
    val ttl: Int,
    val source: String,
) {
    val urgent: Boolean get() = level == LEVEL_ALERT

    /** Anything but live hub data or a model's answer is labelled, so a simulated value is never read as a measurement. */
    val simulated: Boolean get() = source != SOURCE_BROKER && source != SOURCE_MODEL

    companion object {
        const val TOPIC = "lab/out/notify"
        const val MAX_PAYLOAD = 4096
        const val TITLE_MAX = 40
        const val BODY_MAX = 90
        const val TTL_DEFAULT = 8
        const val TTL_MIN = 2
        const val TTL_MAX = 60
        const val LEVEL_ALERT = "alert"
        const val LEVEL_INFO = "info"
        const val SOURCE_BROKER = "broker"
        const val SOURCE_UNKNOWN = "unknown"
        /** An answer from a model on the PC, not a sensor value. */
        const val SOURCE_MODEL = "local_model"
        val SOURCES = setOf(SOURCE_BROKER, "broker_with_simulator", "replay", "built_in_simulator", SOURCE_MODEL)

        fun parse(payload: String): Alert? {
            if (payload.isEmpty() || payload.length > MAX_PAYLOAD) return null
            val root = try {
                JsonParser.parseString(payload)
            } catch (e: Exception) {
                return null
            }
            if (!root.isJsonObject) return null
            val j = root.asJsonObject
            if (num(j, "v") != 1.0) return null

            val id = clean(str(j, "id"), 40)
            val title = clean(str(j, "title"), TITLE_MAX)
            if (id.isEmpty() || title.isEmpty()) return null

            val source = str(j, "source")
            return Alert(
                id = id,
                ts = num(j, "ts")?.takeIf { it > 0 }?.toLong() ?: 0L,
                kind = clean(str(j, "kind"), 16).ifEmpty { "other" },
                level = if (str(j, "level") == LEVEL_ALERT) LEVEL_ALERT else LEVEL_INFO,
                title = title,
                body = clean(str(j, "body"), BODY_MAX),
                ttl = num(j, "ttl")?.toInt()?.coerceIn(TTL_MIN, TTL_MAX) ?: TTL_DEFAULT,
                source = if (source != null && source in SOURCES) source else SOURCE_UNKNOWN,
            )
        }

        private fun str(j: JsonObject, key: String): String? {
            val e = j.get(key) ?: return null
            return if (e.isJsonPrimitive && e.asJsonPrimitive.isString) e.asString else null
        }

        private fun num(j: JsonObject, key: String): Double? {
            val e = j.get(key) ?: return null
            return if (e.isJsonPrimitive && e.asJsonPrimitive.isNumber) e.asDouble.takeIf { it.isFinite() } else null
        }

        /** Turns line breaks into spaces, drops other control characters and keeps at most [max] characters. */
        internal fun clean(s: String?, max: Int): String {
            if (s == null) return ""
            val out = StringBuilder()
            var count = 0
            var i = 0
            while (i < s.length && count < max) {
                val cp = s.codePointAt(i)
                i += Character.charCount(cp)
                when {
                    cp == '\n'.code || cp == '\r'.code || cp == '\t'.code -> { out.append(' '); count++ }
                    Character.isISOControl(cp) -> Unit
                    else -> { out.appendCodePoint(cp); count++ }
                }
            }
            return out.toString().replace(Regex(" {2,}"), " ").trim()
        }
    }
}
