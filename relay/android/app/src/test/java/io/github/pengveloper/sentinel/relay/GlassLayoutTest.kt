package io.github.pengveloper.sentinel.relay

import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** T-REL-007..008: what is sent to the glasses, and how connectBluetooth is called. */
class GlassLayoutTest {
    private val lines = GlassLayout.Lines("주의 · 시뮬레이션", "거실 CSI: \"움직임\" <1>", "점수 1.16 · 임계값 0.5", "14:02 · 8초")

    @Test fun `T-REL-007 builds an open layout and a matching update`() {
        val open = JsonParser.parseString(GlassLayout.open(lines)).asJsonObject
        assertEquals("LinearLayout", open["type"].asString)
        assertEquals("#FF000000", open["props"].asJsonObject["backgroundColor"].asString)
        val children = open["children"].asJsonArray.map { it.asJsonObject["props"].asJsonObject }
        assertEquals(listOf("tv_tag", "tv_title", "tv_body", "tv_meta"), children.map { it["id"].asString })
        assertEquals(lines.title, children[1]["text"].asString)
        assertEquals("bold", children[1]["textStyle"].asString)
        assertTrue(children.all { it["textColor"].asString in setOf(GlassLayout.BRIGHT, GlassLayout.DIM) })
        assertFalse(GlassLayout.open(lines).contains("\\u003c")) // readable JSON, no HTML escaping

        val update = JsonParser.parseString(GlassLayout.update(lines)).asJsonArray.map { it.asJsonObject }
        assertEquals(children.map { it["id"].asString }, update.map { it["id"].asString })
        assertTrue(update.all { it["action"].asString == "update" })
        assertEquals(lines.body, update[2]["props"].asJsonObject["text"].asString)
    }

    // Stand-ins for android.content.Context and the SDK callback interface.
    private open class Ctx
    private interface Cb
    private class CbImpl : Cb

    private val v = ConnectArgs.Values(Ctx(), "uuid", "mac", "Sentinel Relay", CbImpl(), byteArrayOf(1, 2), "secret")
    private fun build(vararg types: Class<*>) = ConnectArgs.build(types.toList(), Ctx::class.java, Cb::class.java, v)?.toList()

    @Test fun `T-REL-008 fills each known connectBluetooth shape`() {
        val s = String::class.java
        val b = ByteArray::class.java
        assertEquals(listOf(v.context, "uuid", "mac", v.callback), build(Ctx::class.java, s, s, Cb::class.java))
        assertEquals(listOf(v.context, "uuid", "mac", v.callback, v.licence, "secret"), build(Ctx::class.java, s, s, Cb::class.java, b, s))
        assertEquals(listOf(v.context, "uuid", "mac", "Sentinel Relay", v.callback, v.licence, "secret"), build(Ctx::class.java, s, s, s, Cb::class.java, b, s))
        // Shapes it does not understand are refused rather than guessed.
        assertEquals(null, build(Ctx::class.java, s, Cb::class.java))
        assertEquals(null, build(Ctx::class.java, s, s, Cb::class.java, Int::class.java))
        assertEquals(null, build(s, s, s, Cb::class.java))
        assertEquals(null, build(Ctx::class.java, s, s, s, s, Cb::class.java))
    }
}
