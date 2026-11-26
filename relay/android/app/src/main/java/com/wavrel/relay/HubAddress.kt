package com.wavrel.relay

/**
 * Where the PC hub listens, as typed by the user: `192.168.0.12`, `192.168.0.12:1883`,
 * `[fd00::5]:1883` or a host name such as `my-pc.local`.
 *
 * The hub only accepts connections from private addresses (desktop/main/broker.mjs), so a
 * public literal can be rejected before the phone tries it.
 */
data class HubAddress(val host: String, val port: Int) {

    val uri: String get() = "tcp://" + hostForUri + ":" + port

    private val hostForUri: String get() = if (host.contains(':')) "[$host]" else host

    override fun toString(): String = if (port == DEFAULT_PORT) hostForUri else "$hostForUri:$port"

    enum class Problem { EMPTY, BAD_HOST, BAD_PORT, LOOPBACK, NOT_PRIVATE }

    class Parsed(val address: HubAddress?, val problem: Problem?)

    companion object {
        const val DEFAULT_PORT = 1883

        private val HOSTNAME = Regex("^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\\.?$")
        private val IPV4 = Regex("^\\d{1,3}(\\.\\d{1,3}){3}$")
        private val IPV6 = Regex("^[0-9A-Fa-f:.]+(%[A-Za-z0-9_.-]+)?$")

        fun parse(input: String): Parsed {
            var s = input.trim()
            if (s.isEmpty()) return bad(Problem.EMPTY)
            s = s.removePrefix("tcp://").removePrefix("mqtt://").trimEnd('/')

            val host: String
            var portText: String? = null
            if (s.startsWith("[")) {
                val end = s.indexOf(']')
                if (end < 0) return bad(Problem.BAD_HOST)
                host = s.substring(1, end)
                val rest = s.substring(end + 1)
                if (rest.isNotEmpty()) {
                    if (!rest.startsWith(":")) return bad(Problem.BAD_HOST)
                    portText = rest.substring(1)
                }
            } else if (s.count { it == ':' } == 1) {
                host = s.substringBefore(':')
                portText = s.substringAfter(':')
            } else {
                host = s // bare IPv6 (several colons, no port) or a name / IPv4 without a port
            }

            val pt = portText
            val port = when {
                pt == null -> DEFAULT_PORT
                pt.isNotEmpty() && pt.length <= 5 && pt.all(Char::isDigit) && pt.toInt() in 1..65535 -> pt.toInt()
                else -> return bad(Problem.BAD_PORT)
            }

            return when {
                IPV4.matches(host) -> {
                    val parts = host.split('.').map { it.toInt() }
                    if (parts.any { it > 255 }) bad(Problem.BAD_HOST)
                    else if (parts[0] == 127) bad(Problem.LOOPBACK)
                    else if (!privateV4(parts[0], parts[1])) bad(Problem.NOT_PRIVATE)
                    else ok(host, port)
                }
                host.contains(':') -> {
                    if (!IPV6.matches(host)) return bad(Problem.BAD_HOST)
                    val h = host.lowercase()
                    if (h == "::1") bad(Problem.LOOPBACK)
                    else if (!(h.startsWith("fc") || h.startsWith("fd") || Regex("^fe[89ab]").containsMatchIn(h))) bad(Problem.NOT_PRIVATE)
                    else ok(host, port)
                }
                host.equals("localhost", ignoreCase = true) -> bad(Problem.LOOPBACK)
                HOSTNAME.matches(host) && host.length <= 253 -> ok(host, port)
                else -> bad(Problem.BAD_HOST)
            }
        }

        /**
         * Whether a resolved address is one the relay may send the password to: private or
         * link-local, IPv4 or IPv6 (including IPv4-mapped), and not this phone's loopback.
         * A host name is checked this way after it resolves, so a name cannot lead off the LAN.
         */
        fun isLocal(raw: ByteArray): Boolean {
            val b = raw.map { it.toInt() and 0xff }
            if (b.size == 4) return b[0] != 127 && privateV4(b[0], b[1])
            if (b.size != 16) return false
            if (b.subList(0, 10).all { it == 0 } && b[10] == 0xff && b[11] == 0xff) return isLocal(raw.copyOfRange(12, 16))
            return (b[0] and 0xfe) == 0xfc || (b[0] == 0xfe && (b[1] and 0xc0) == 0x80)
        }

        /** RFC 1918 and link-local, the IPv4 ranges the hub accepts besides loopback. */
        private fun privateV4(a: Int, b: Int) =
            a == 10 || (a == 172 && b in 16..31) || (a == 192 && b == 168) || (a == 169 && b == 254)

        private fun ok(host: String, port: Int) = Parsed(HubAddress(host, port), null)
        private fun bad(p: Problem) = Parsed(null, p)
    }
}
