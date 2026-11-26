package com.wavrel.relay

import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/** T-REL-010..011: spoken questions to the PC and the model's answers (docs/NOTIFY.md). */
class AskTest {
    @Test fun `T-REL-010 builds a v1 question and drops empty speech`() {
        val raw = Ask.build("q1", "  거실에\n누가 있어?\u0007 ", "ko")
        assertNotNull(raw)
        val j = JsonParser.parseString(raw).asJsonObject
        assertEquals(1, j.get("v").asInt)
        assertEquals("q1", j.get("id").asString)
        assertEquals("거실에 누가 있어?", j.get("text").asString)
        assertEquals("ko", j.get("lang").asString)
        assertEquals("relay", j.get("from").asString)
        assertEquals("en", JsonParser.parseString(Ask.build("q2", "hi", "fr")).asJsonObject.get("lang").asString)
        val long = JsonParser.parseString(Ask.build("q3", "가".repeat(500), "ko")).asJsonObject.get("text").asString
        assertEquals(Ask.TEXT_MAX, long.codePointCount(0, long.length))
        assertNull(Ask.build("q4", "   \n ", "ko"))
        assertEquals("lab/in/ask", Ask.TOPIC)
    }

    @Test fun `T-REL-011 a model's answer is not labelled as simulated data`() {
        val a = Alert.parse("""{"v":1,"id":"a1","kind":"answer","level":"info","title":"거실에 누가 있어?","body":"지금은 조용합니다.","ttl":15,"source":"local_model","re":"q1","model":"m:4b"}""")
        assertNotNull(a)
        a!!
        assertEquals(Alert.SOURCE_MODEL, a.source)
        assertFalse(a.simulated)
        assertFalse(a.urgent)
        assertEquals(15, a.ttl)
    }
}
