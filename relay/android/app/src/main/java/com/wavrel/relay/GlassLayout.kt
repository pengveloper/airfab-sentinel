package com.wavrel.relay

import com.google.gson.GsonBuilder

/**
 * JSON for the Rokid custom view: one screen on a black background (black is transparent on
 * the lens) with four lines of green text. Rokid's displays are monochrome green, so the lines
 * differ by size and brightness only.
 */
object GlassLayout {
    const val BRIGHT = "#FF00FF00"
    const val DIM = "#FF00A000"
    const val IDS_TAG = "tv_tag"
    const val IDS_TITLE = "tv_title"
    const val IDS_BODY = "tv_body"
    const val IDS_META = "tv_meta"

    private val gson = GsonBuilder().disableHtmlEscaping().create()

    data class Lines(val tag: String, val title: String, val body: String, val meta: String)

    fun open(l: Lines): String = gson.toJson(
        mapOf(
            "type" to "LinearLayout",
            "props" to mapOf(
                "id" to "root",
                "layout_width" to "match_parent",
                "layout_height" to "match_parent",
                "orientation" to "vertical",
                "gravity" to "center_vertical",
                "paddingStart" to "24dp",
                "paddingEnd" to "24dp",
                "paddingTop" to "24dp",
                "paddingBottom" to "24dp",
                "backgroundColor" to "#FF000000",
            ),
            "children" to listOf(
                text(IDS_TAG, l.tag, "13sp", DIM, bold = false, marginBottom = "6dp"),
                text(IDS_TITLE, l.title, "22sp", BRIGHT, bold = true, marginBottom = "8dp"),
                text(IDS_BODY, l.body, "16sp", BRIGHT, bold = false, marginBottom = "12dp"),
                text(IDS_META, l.meta, "12sp", DIM, bold = false, marginBottom = "0dp"),
            ),
        ),
    )

    /** Update payload: a list of `{action, id, props}` entries, one per line that changes. */
    fun update(l: Lines): String = gson.toJson(
        listOf(IDS_TAG to l.tag, IDS_TITLE to l.title, IDS_BODY to l.body, IDS_META to l.meta).map { (id, value) ->
            mapOf("action" to "update", "id" to id, "props" to mapOf("text" to value))
        },
    )

    private fun text(id: String, value: String, size: String, color: String, bold: Boolean, marginBottom: String): Map<String, Any> {
        val props = linkedMapOf<String, Any>(
            "id" to id,
            "layout_width" to "match_parent",
            "layout_height" to "wrap_content",
            "text" to value,
            "textSize" to size,
            "textColor" to color,
            "gravity" to "start",
            "marginBottom" to marginBottom,
        )
        if (bold) props["textStyle"] = "bold"
        return mapOf("type" to "TextView", "props" to props)
    }
}
