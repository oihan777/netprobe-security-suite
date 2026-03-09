"""
NetProbe Security Suite - Firewall Testing Module
Tools: nmap, socket, scapy
"""
import asyncio
import os
import re
import shutil
import socket
from utils.raw_exec import raw_exec

MODULE_NAMES = {
    "policy_chk": "Policy Compliance",
    "acl_bypass":  "ACL Bypass",
    "admin_probe": "Admin Interface Probe",
    "nat_bypass":  "NAT Bypass",
}

# Ports that should be blocked by policy
POLICY_PORTS = {
    23:   "Telnet (cleartext)",
    135:  "RPC/DCOM",
    137:  "NetBIOS Name",
    138:  "NetBIOS Datagram",
    139:  "NetBIOS Session",
    445:  "SMB (ransomware vector)",
    1433: "MSSQL",
    1521: "Oracle DB",
    3306: "MySQL/MariaDB",
    3389: "RDP",
    5432: "PostgreSQL",
    5900: "VNC",
    6379: "Redis",
    27017:"MongoDB",
}

ADMIN_PORTS = [8443, 10443, 4433, 9443, 8080, 8888, 9090, 8008, 8181, 10000]

async def run_firewall_module(module_id, target, intensity, duration, log_fn):
    name = MODULE_NAMES.get(module_id, module_id)
    await log_fn("MODULE", f"▶ {name}", module_id)
    runners = {
        "policy_chk": _policy_check,
        "acl_bypass":  _acl_bypass,
        "admin_probe": _admin_probe,
        "nat_bypass":  _nat_bypass,
    }
    return await runners[module_id](target, intensity, log_fn)


async def _policy_check(target, intensity, log_fn):
    """Check which dangerous ports are open (policy violations)."""
    ports_str = ",".join(str(p) for p in POLICY_PORTS.keys())
    cmd = f"nmap -p {ports_str} -sV --open -T4 {target}"

    if shutil.which("nmap"):
        out, err, rc = await raw_exec(cmd, log_fn, "policy_chk", timeout=60)
        violations = []
        for port, desc in POLICY_PORTS.items():
            if re.search(rf"{port}/tcp\s+open", out):
                violations.append({"port": port, "service": desc})
                await log_fn("WARN", f"🚨 Puerto {port} abierto: {desc}", "policy_chk")
            else:
                await log_fn("RAW", f"Port {port}/tcp ({desc}): cerrado/filtrado ✓", "policy_chk")
    else:
        # Socket fallback
        await log_fn("CMD", f"socket connect check → {target} ports {list(POLICY_PORTS.keys())}", "policy_chk")
        violations = []
        for port, desc in POLICY_PORTS.items():
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(2)
                rc = s.connect_ex((target, port))
                s.close()
                if rc == 0:
                    violations.append({"port": port, "service": desc})
                    await log_fn("WARN", f"🚨 Puerto {port} abierto: {desc}", "policy_chk")
                else:
                    await log_fn("RAW", f"Port {port} ({desc}): cerrado ✓", "policy_chk")
            except Exception:
                pass

    if violations:
        return {"violations": violations, "count": len(violations)}, "PASSED", 0
    return {"violations": [], "all_ports_blocked": True}, "BLOCKED", 100


async def _acl_bypass(target, intensity, log_fn):
    """Try ACL bypass techniques: source port spoofing, fragmentation."""
    results = {"bypass_successful": False, "methods_tried": [], "findings": []}

    # Method 1: Source port 53 (DNS bypass trick) — needs nmap
    if shutil.which("nmap") and os.geteuid() == 0:
        cmd = f"nmap --source-port 53 -p 80,443,22,8080 -sS -T3 {target}"
        out, err, rc = await raw_exec(cmd, log_fn, "acl_bypass", timeout=60)
        results["methods_tried"].append("source_port_53")
        open_ports = re.findall(r"(\d+)/tcp\s+open\s*(\S*)", out)
        if open_ports:
            results["bypass_successful"] = True
            results["findings"].append({"method": "source_port_53", "ports": open_ports})
            await log_fn("WARN", f"🚨 ACL bypass via src:53 — {open_ports}", "acl_bypass")
    elif not shutil.which("nmap"):
        await log_fn("WARN", "nmap no instalado — usando scapy para ACL bypass", "acl_bypass")

    # Method 2: scapy src port 53
    if os.geteuid() == 0 and not results["bypass_successful"]:
        try:
            from scapy.all import IP, TCP, sr1, conf
            conf.verb = 0
            await log_fn("CMD", f"scapy: IP(dst={target})/TCP(sport=53, dport=80, flags=S)", "acl_bypass")

            def do_probe():
                pkt  = IP(dst=target) / TCP(sport=53, dport=80, flags="S")
                resp = sr1(pkt, timeout=3, verbose=False)
                return resp

            resp = await asyncio.get_event_loop().run_in_executor(None, do_probe)
            results["methods_tried"].append("scapy_src53")
            if resp and resp.haslayer("TCP") and resp["TCP"].flags & 0x12:  # SYN-ACK
                results["bypass_successful"] = True
                results["findings"].append({"method": "scapy_src_port_53", "port": 80})
                await log_fn("WARN", "🚨 ACL bypass: puerto 80 respondió a SYN desde src:53", "acl_bypass")
            else:
                await log_fn("RAW", f"src:53 → dport:80: {'RST/no response' if resp else 'timeout'} ✓", "acl_bypass")
        except ImportError:
            await log_fn("WARN", "scapy no instalado: pip install scapy", "acl_bypass")

    if not results["methods_tried"]:
        await log_fn("WARN", "ACL bypass requiere root y nmap/scapy", "acl_bypass")
        return {}, "ERROR", None

    if results["bypass_successful"]:
        return results, "PASSED", 0
    return results, "BLOCKED", 100


async def _admin_probe(target, intensity, log_fn):
    """Probe for exposed admin interfaces."""
    if not shutil.which("nmap"):
        await log_fn("WARN", "nmap no instalado: sudo apt install nmap", "admin_probe")
        return {}, "ERROR", None

    ports_str = ",".join(str(p) for p in ADMIN_PORTS)
    cmd = f"nmap -p {ports_str} -sV --script http-title,http-auth-finder --open -T4 {target}"
    out, err, rc = await raw_exec(cmd, log_fn, "admin_probe", timeout=90)

    found = []
    for port in ADMIN_PORTS:
        if re.search(rf"{port}/tcp\s+open", out):
            svc = re.search(rf"{port}/tcp\s+open\s+(\S+)", out)
            title = re.search(rf"http-title.*?:\s*(.+)", out)
            found.append({
                "port":    port,
                "service": svc.group(1) if svc else "http",
                "title":   title.group(1).strip() if title else "unknown"
            })
            await log_fn("WARN", f"🚨 Interfaz admin expuesta: :{port} ({svc.group(1) if svc else 'http'})", "admin_probe")

    # Also check common admin paths with httpx
    try:
        import httpx
        admin_paths = ["/admin", "/manager", "/console", "/dashboard",
                       "/panel", "/wp-admin", "/phpmyadmin", "/adminer.php"]
        for path in admin_paths:
            try:
                async with httpx.AsyncClient(verify=False, timeout=5) as client:
                    r = await client.get(f"http://{target}{path}", follow_redirects=True)
                    await log_fn("RAW", f"GET {path} → HTTP {r.status_code}", "admin_probe")
                    if r.status_code in [200, 401, 403]:
                        found.append({"path": path, "status": r.status_code})
                        await log_fn("WARN", f"⚠️ Admin path accesible: {path} → {r.status_code}", "admin_probe")
            except Exception:
                pass
    except ImportError:
        pass

    if found:
        return {"admin_interfaces": found, "count": len(found)}, "DETECTED", 60
    return {"admin_interfaces": [], "all_hidden": True}, "BLOCKED", 100


async def _nat_bypass(target, intensity, log_fn):
    """Test NAT/firewall bypass techniques."""
    results = {"bypass_successful": False, "methods_tried": [], "open_paths": []}

    # Method 1: Alternate HTTP ports
    alt_ports = [8080, 8000, 8008, 8888, 3000, 5000, 9000]
    try:
        import httpx
        await log_fn("CMD", f"httpx probe alternate ports → {target}", "nat_bypass")
        async with httpx.AsyncClient(verify=False, timeout=5) as client:
            for port in alt_ports:
                try:
                    r = await client.get(f"http://{target}:{port}/")
                    await log_fn("RAW", f"http://{target}:{port}/ → HTTP {r.status_code}", "nat_bypass")
                    if r.status_code < 500:
                        results["open_paths"].append(f":{port}")
                        results["bypass_successful"] = True
                        await log_fn("WARN", f"⚠️ Puerto alternativo abierto: {port}", "nat_bypass")
                except Exception as e:
                    await log_fn("RAW", f":{port} → {type(e).__name__}", "nat_bypass")
        results["methods_tried"].append("alternate_http_ports")
    except ImportError:
        pass

    # Method 2: UDP hole punch simulation
    await log_fn("CMD", f"socket UDP hole punch → {target}:12345", "nat_bypass")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(3)
        s.sendto(b"\x00\x01\x00\x00", (target, 12345))
        try:
            data, addr = s.recvfrom(64)
            await log_fn("RAW", f"UDP response from {addr}: {data.hex()}", "nat_bypass")
            results["bypass_successful"] = True
            results["open_paths"].append("udp:12345")
        except socket.timeout:
            await log_fn("RAW", f"UDP {target}:12345 → timeout (filtrado ✓)", "nat_bypass")
        s.close()
        results["methods_tried"].append("udp_hole_punch")
    except Exception as e:
        await log_fn("RAW", f"UDP error: {e}", "nat_bypass")

    # Method 3: ICMP echo to check if ICMP is allowed
    cmd_ping = f"ping -c 3 -W 2 {target}"
    out, _, rc = await raw_exec(cmd_ping, log_fn, "nat_bypass", timeout=10)
    results["methods_tried"].append("icmp_echo")
    if rc == 0:
        await log_fn("RAW", f"ICMP echo: permitido — target responde a ping", "nat_bypass")
    else:
        await log_fn("RAW", f"ICMP echo: bloqueado — target no responde a ping ✓", "nat_bypass")

    if results["bypass_successful"]:
        return results, "PARTIAL", 35
    return results, "BLOCKED", 100
