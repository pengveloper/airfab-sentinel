package com.wavrel.relay

import com.google.gson.Gson
import com.google.gson.JsonObject

/**
 * A spoken question for the PC, sent on `lab/in/ask` (docs/NOTIFY.md). The desktop app's
 * Models view answers it with the model the user picked; the answer comes back as an alert
 * with source `local_model`, so it reaches the glasses like any other alert.
 */
object Ask {
    const val TOPIC = "lab/in/ask"
    const val TEXT_MAX = 300

    /** The message to publish, or null when nothing was said. */
    fun build(id: String, text: String, lang: String): String? {
        val said = Alert.clean(text, TEXT_MAX).trim()
        if (said.isEmpty()) return null
        val j = JsonObject().apply {
            addProperty("v", 1)
            addProperty("id", Alert.clean(id, 40))
            addProperty("text", said)
            addProperty("lang", if (lang == "ko") "ko" else "en")
            addProperty("from", "relay")
        }
        return Gson().toJson(j)
    }
}
