package com.wavrel.relay

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** T-REL-001..004: the receiver side of docs/NOTIFY.md. */
class AlertTest {
    private val sample = """{"v":1,"id":"nmb1x2k3a0","ts":1795500000000,"kind":"motion","level":"alert",
        "title":"거실 CSI: 움직임","body":"점수 1.16 · 임계값 0.5","ttl":8,"source":"broker"}"""

    @Test fun `T-REL-001 reads the documented example`() {
        val a = Alert.parse(sample)
        assertNotNull(a)
        a!!
        assertEquals("nmb1x2k3a0", a.id)
        assertEquals(1795500000000L, a.ts)
        assertEquals("motion", a.kind)
        assertTrue(a.urgent)
        assertEquals("거실 CSI: 움직임", a.title)
        assertEquals("점수 1.16 · 임계값 0.5", a.body)
        assertEquals(8, a.ttl)
        assertFalse(a.simulated)
    }

    @Test fun `T-REL-002 drops anything that is not a v1 alert`() {
        assertNull(Alert.parse(""))
        assertNull(Alert.parse("not json"))
        assertNull(Alert.parse("[1,2]"))
        assertNull(Alert.parse(sample.replace("\"v\":1", "\"v\":2")))
        assertNull(Alert.parse(sample.replace("\"v\":1", "\"v\":\"1\"")))
        assertNull(Alert.parse(sample.replace("\"title\":\"거실 CSI: 움직임\"", "\"title\":\"  \"")))
        assertNull(Alert.parse(sample.replace("\"id\":\"nmb1x2k3a0\"", "\"id\":7")))
        assertNull(Alert.parse("{\"v\":1,\"id\":\"a\",\"title\":\"" + "x".repeat(Alert.MAX_PAYLOAD) + "\"}"))
    }

    @Test fun `T-REL-003 keeps text short and printable`() {
        val long = "가".repeat(60)
        val a = Alert.parse("""{"v":1,"id":"a","title":"$long","body":"line one\nline two\u0007","ttl":999}""")!!
        assertEquals(Alert.TITLE_MAX, a.title.codePointCount(0, a.title.length))
        assertEquals("line one line two", a.body)
        assertEquals(Alert.TTL_MAX, a.ttl)
        assertEquals(Alert.TTL_MIN, Alert.parse("""{"v":1,"id":"a","title":"t","ttl":0}""")!!.ttl)
        assertEquals(Alert.TTL_DEFAULT, Alert.parse("""{"v":1,"id":"a","title":"t"}""")!!.ttl)
        val emoji = "😀".repeat(50)
        val e = Alert.parse("""{"v":1,"id":"a","title":"$emoji"}""")!!
        assertEquals(Alert.TITLE_MAX, e.title.codePointCount(0, e.title.length))
    }

    @Test fun `T-REL-004 marks every source other than live hub data`() {
        for (s in listOf("broker_with_simulator", "replay", "built_in_simulator")) {
            val a = Alert.parse(sample.replace("\"source\":\"broker\"", "\"source\":\"$s\""))!!
            assertTrue(s, a.simulated)
            assertEquals(s, a.source)
        }
        val missing = Alert.parse(sample.replace(",\"source\":\"broker\"", ""))!!
        assertTrue(missing.simulated)
        assertEquals(Alert.SOURCE_UNKNOWN, missing.source)
        val odd = Alert.parse(sample.replace("\"source\":\"broker\"", "\"source\":\"lab-pc\""))!!
        assertTrue(odd.simulated)
        val info = Alert.parse(sample.replace("\"level\":\"alert\"", "\"level\":\"loud\""))!!
        assertFalse(info.urgent)
    }
}
