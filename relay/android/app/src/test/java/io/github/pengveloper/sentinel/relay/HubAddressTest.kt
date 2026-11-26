package io.github.pengveloper.sentinel.relay

import io.github.pengveloper.sentinel.relay.HubAddress.Problem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** T-REL-005..006: hub address entry. */
class HubAddressTest {
    private fun ok(input: String) = HubAddress.parse(input).also { assertNull(input, it.problem) }.address!!
    private fun problem(input: String) = HubAddress.parse(input).problem

    @Test fun `T-REL-005 accepts the forms the hub panel shows`() {
        assertEquals(HubAddress("192.168.0.12", 1883), ok("192.168.0.12"))
        assertEquals(HubAddress("192.168.0.12", 1884), ok(" 192.168.0.12:1884 "))
        assertEquals(HubAddress("10.0.0.5", 1883), ok("tcp://10.0.0.5:1883"))
        assertEquals(HubAddress("172.20.1.2", 1883), ok("mqtt://172.20.1.2/"))
        assertEquals(HubAddress("fd00::5", 1883), ok("[fd00::5]:1883"))
        assertEquals(HubAddress("fe80::1%wlan0", 1883), ok("fe80::1%wlan0"))
        assertEquals(HubAddress("lab-pc.local", 1883), ok("lab-pc.local"))
        assertEquals("tcp://192.168.0.12:1883", ok("192.168.0.12").uri)
        assertEquals("tcp://[fd00::5]:1900", ok("[fd00::5]:1900").uri)
        assertEquals("192.168.0.12", ok("192.168.0.12:1883").toString())
        assertEquals("192.168.0.12:1900", ok("192.168.0.12:1900").toString())
    }

    @Test fun `T-REL-006 explains what is wrong with an address`() {
        assertEquals(Problem.EMPTY, problem("  "))
        assertEquals(Problem.BAD_PORT, problem("192.168.0.12:"))
        assertEquals(Problem.BAD_PORT, problem("192.168.0.12:70000"))
        assertEquals(Problem.BAD_PORT, problem("192.168.0.12:18a3"))
        assertEquals(Problem.BAD_HOST, problem("192.168.0.300"))
        assertEquals(Problem.BAD_HOST, problem("pc name"))
        assertEquals(Problem.BAD_HOST, problem("[fd00::5"))
        assertEquals(Problem.LOOPBACK, problem("127.0.0.1"))
        assertEquals(Problem.LOOPBACK, problem("localhost:1883"))
        assertEquals(Problem.LOOPBACK, problem("[::1]:1883"))
        assertEquals(Problem.NOT_PRIVATE, problem("8.8.8.8"))
        assertEquals(Problem.NOT_PRIVATE, problem("172.32.0.1"))
        assertEquals(Problem.NOT_PRIVATE, problem("2001:db8::1"))
    }

    private fun ip(s: String) = java.net.InetAddress.getByName(s).address

    @Test fun `T-REL-009 a host name must resolve to the local network`() {
        for (a in listOf("192.168.0.12", "10.0.2.2", "172.16.0.1", "172.31.255.254", "169.254.1.1", "fd00::5", "fe80::1", "::ffff:192.168.1.2"))
            assertTrue(a, HubAddress.isLocal(ip(a)))
        for (a in listOf("8.8.8.8", "172.32.0.1", "127.0.0.1", "::1", "2001:db8::1", "::ffff:8.8.8.8", "100.64.0.1"))
            assertFalse(a, HubAddress.isLocal(ip(a)))
        assertFalse(HubAddress.isLocal(ByteArray(5)))
    }
}
