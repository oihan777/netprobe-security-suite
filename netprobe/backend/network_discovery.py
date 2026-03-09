"""
NetProbe Security Suite - Network Discovery
Detección correcta de interfaces + descubrimiento en tiempo real
"""
import asyncio
import ipaddress
import json
import re
import shutil
import socket


async def get_local_networks():
    """
    Returns all network interfaces from BOTH WSL (ip addr) and Windows (ipconfig.exe).
    This ensures all physical adapters are visible.
    """
    networks = []
    seen_nets = set()

    # ── 1. WSL interfaces via ip addr show ──────────────────────
    await _parse_ip_addr(networks, seen_nets)

    # ── 2. Windows interfaces via ipconfig.exe ──────────────────
    # ipconfig.exe is always available from WSL at /mnt/c/Windows/System32/ipconfig.exe
    await _parse_ipconfig(networks, seen_nets)

    # Sort: physical first, then wifi, then virtual
    order = {"eth":0,"ens":0,"enp":0,"eno":0,"wlan":1,"wlp":1,"wi-fi":1,
             "ethernet":0,"docker":3,"br-":3,"virbr":3,"vethernet":3}
    networks.sort(key=lambda n: next(
        (v for k,v in order.items() if n["interface"].lower().startswith(k)), 2
    ))
    return networks


async def _parse_ip_addr(networks, seen_nets):
    """Parse WSL/Linux interfaces from ip addr show."""
    try:
        proc = await asyncio.create_subprocess_shell(
            "ip addr show",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, _ = await proc.communicate()
        output = stdout.decode("utf-8", errors="ignore")

        current_iface = None
        current_mac   = ""
        current_state = ""

        for line in output.splitlines():
            iface_m = re.match(r"^\d+:\s+(\S+?)(@\S+)?:\s+<([^>]*)>", line)
            if iface_m:
                current_iface = iface_m.group(1)
                current_state = iface_m.group(3)
                current_mac   = ""
                continue
            mac_m = re.match(r"\s+link/ether\s+([0-9a-f:]{17})", line)
            if mac_m:
                current_mac = mac_m.group(1).upper()
                continue
            inet_m = re.match(r"\s+inet\s+(\d+\.\d+\.\d+\.\d+)/(\d+)", line)
            if inet_m and current_iface:
                ip, prefix = inet_m.group(1), int(inet_m.group(2))
                _add_network(networks, seen_nets, ip, prefix,
                             current_iface, current_mac, current_state, source="WSL")
    except Exception:
        pass


async def _parse_ipconfig(networks, seen_nets):
    """
    Parse Windows network interfaces via PowerShell (handles UTF-16 encoding correctly).
    Falls back to ipconfig.exe with iconv if PowerShell is not available.
    """
    import os

    # Method 1: PowerShell Get-NetIPAddress (cleanest, structured output)
    ps_paths = [
        "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
        "/mnt/c/Windows/SysNative/WindowsPowerShell/v1.0/powershell.exe",
    ]
    ps = next((p for p in ps_paths if os.path.exists(p)), None)

    if ps:
        # Get IP addresses with interface info as CSV
        ps_cmd = (
            f'"{ps}" -NoProfile -NonInteractive -Command '
            '"Get-NetIPAddress -AddressFamily IPv4 | '
            'Select-Object InterfaceAlias,IPAddress,PrefixLength | '
            'ConvertTo-Csv -NoTypeInformation"'
        )
        try:
            proc = await asyncio.create_subprocess_shell(
                ps_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
            output = stdout.decode("utf-8", errors="replace").strip()
            if not output:
                output = stdout.decode("utf-16-le", errors="replace").strip()

            lines = [l.strip() for l in output.splitlines() if l.strip()]
            # Skip header row
            for line in lines[1:]:
                # CSV: "Interface Alias","IP","PrefixLength"
                parts = [p.strip().strip('"') for p in line.split(",")]
                if len(parts) < 3:
                    continue
                iface, ip, prefix_str = parts[0], parts[1], parts[2]
                try:
                    prefix = int(prefix_str)
                except ValueError:
                    prefix = 24
                _add_network(networks, seen_nets, ip, prefix,
                             iface, "", "UP", source="Windows")
            return  # success
        except Exception:
            pass

    # Method 2: ipconfig.exe with UTF-16 decoding
    ipconfig_paths = [
        "/mnt/c/Windows/System32/ipconfig.exe",
        "/mnt/c/Windows/SysNative/ipconfig.exe",
    ]
    ipconfig = next((p for p in ipconfig_paths if os.path.exists(p)), None)
    if not ipconfig:
        return

    try:
        proc = await asyncio.create_subprocess_shell(
            f'"{ipconfig}" /all',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)

        # Try multiple encodings — ipconfig can output UTF-16LE or CP850/1252
        output = ""
        for enc in ["utf-16-le", "utf-8", "latin-1", "cp850", "cp1252"]:
            try:
                decoded = stdout.decode(enc, errors="strict")
                if any(c.isalpha() for c in decoded[:100]):
                    output = decoded
                    break
            except Exception:
                continue

        if not output:
            output = stdout.decode("utf-8", errors="ignore")

        current_iface  = None
        current_mac    = ""
        pending_ip     = None

        for line in output.splitlines():
            line = line.strip()
            if not line:
                continue

            # Adapter header
            adapter_m = re.match(r"^(?:Ethernet|Wireless LAN|PPP|Tunnel).+?adapter\s+(.+?)\s*:", line, re.I)
            if adapter_m:
                current_iface = adapter_m.group(1).strip()
                current_mac   = ""
                pending_ip    = None
                continue

            # MAC
            mac_m = re.search(r"Physical Address[.\s]*:\s*([0-9A-Fa-f]{2}(?:[-:][0-9A-Fa-f]{2}){5})", line)
            if mac_m and current_iface:
                current_mac = mac_m.group(1).replace("-", ":").upper()
                continue

            # IPv4
            ipv4_m = re.search(r"IPv4 Address[.\s]*:\s*([\d.]+)", line)
            if ipv4_m and current_iface:
                pending_ip = ipv4_m.group(1).strip()
                continue

            # Subnet mask (comes right after IPv4 line)
            mask_m = re.search(r"Subnet Mask[.\s]*:\s*([\d.]+)", line)
            if mask_m and current_iface and pending_ip:
                prefix = _mask_to_prefix(mask_m.group(1).strip())
                _add_network(networks, seen_nets, pending_ip, prefix,
                             current_iface, current_mac, "UP", source="Windows")
                pending_ip = None

    except Exception:
        pass


def _mask_to_prefix(mask):
    """Convert subnet mask like 255.255.255.0 to prefix length 24."""
    try:
        return sum(bin(int(x)).count("1") for x in mask.split("."))
    except Exception:
        return 24


def _add_network(networks, seen_nets, ip, prefix, iface, mac, state, source=""):
    try:
        net = ipaddress.IPv4Network(f"{ip}/{prefix}", strict=False)
    except ValueError:
        return
    if net.is_loopback or str(net).startswith("169.254"):
        return
    cidr = f"{net.network_address}/{prefix}"
    if cidr in seen_nets:
        return
    seen_nets.add(cidr)
    networks.append({
        "interface":  iface,
        "iface_type": _iface_type(iface),
        "local_ip":   ip,
        "mac":        mac,
        "network":    str(net),
        "cidr":       cidr,
        "prefix":     prefix,
        "hosts":      max(net.num_addresses - 2, 1),
        "is_private": net.is_private,
        "state":      state,
        "source":     source,
    })


def _iface_type(name):
    n = name.lower()
    # Linux
    if n.startswith(("eth","ens","enp","eno")):  return "Ethernet"
    if n.startswith(("wlan","wlp")):             return "Wi-Fi"
    if n.startswith("docker"):                   return "Docker"
    if n.startswith(("virbr","br-","vmnet")):    return "Bridge Virtual"
    if n.startswith("tun"):                      return "VPN/Tunnel"
    if n.startswith("veth"):                     return "veth (Container)"
    # Windows adapter names
    if "wi-fi" in n or "wireless" in n or "wifi" in n: return "Wi-Fi"
    if "ethernet" in n:                          return "Ethernet"
    if "vethernet" in n or "wsl" in n or "hyper-v" in n: return "WSL/Hyper-V"
    if "vpn" in n or "tunnel" in n or "tap" in n or "tun" in n: return "VPN"
    if "bluetooth" in n:                         return "Bluetooth"
    if "loopback" in n:                          return "Loopback"
    return "Interfaz"


async def discover_hosts_streaming(cidr, ws):
    if shutil.which("nmap"):
        return await _nmap_stream(cidr, ws)
    return await _ping_stream(cidr, ws)


async def _nmap_stream(cidr, ws):
    # Phase 1: host discovery
    cmd = f"nmap -sn -T4 --min-parallelism 50 --max-retries 1 {cidr}"
    await ws.send_json({"type": "status", "message": f"$ {cmd}"})
    try:
        proc = await asyncio.create_subprocess_shell(
            cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=120)
        output = stdout.decode("utf-8", errors="ignore")
    except asyncio.TimeoutError:
        await ws.send_json({"type": "status", "message": "Timeout — prueba con una subred /24"})
        return 0
    except Exception as e:
        await ws.send_json({"type": "status", "message": f"Error nmap: {e}"})
        return 0

    hosts_raw = _parse_nmap_sn(output)
    if not hosts_raw:
        return 0

    total = len(hosts_raw)

    # Emit initial hosts (no ports yet)
    for i, h in enumerate(hosts_raw):
        h["open_ports"]  = []
        h["device_type"] = _classify_device(h)
        await ws.send_json({"type": "host", "host": h, "progress": round((i+1)/total*50)})
        await asyncio.sleep(0)

    # Phase 2: fast port scan in batches
    ip_list  = [h["ip"] for h in hosts_raw]
    port_map = {}
    batch_sz = 10
    for bi, bs in enumerate(range(0, len(ip_list), batch_sz)):
        batch   = ip_list[bs:bs+batch_sz]
        port_cmd = f"nmap -T4 -F --open --min-parallelism 20 {' '.join(batch)}"
        await ws.send_json({"type": "status", "message": f"Port scan lote {bi+1} ({len(batch)} hosts)..."})
        try:
            pp = await asyncio.create_subprocess_shell(
                port_cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            pout, _ = await asyncio.wait_for(pp.communicate(), timeout=60)
            _parse_ports_into(pout.decode("utf-8", errors="ignore"), port_map)
        except Exception:
            pass

    # Emit updated hosts with ports
    for i, h in enumerate(hosts_raw):
        h["open_ports"]  = port_map.get(h["ip"], [])
        h["device_type"] = _classify_device(h)
        if not h.get("hostname"):
            try:    h["hostname"] = socket.gethostbyaddr(h["ip"])[0]
            except: h["hostname"] = ""
        await ws.send_json({"type": "host_update", "host": h, "progress": 50 + round((i+1)/total*50)})
        await asyncio.sleep(0)

    return total


def _parse_nmap_sn(output):
    hosts = []
    blocks = re.split(r"(?=Nmap scan report)", output)
    for block in blocks:
        ip_m = re.search(r"Nmap scan report for (?:(.+?)\s+\()?(\d+\.\d+\.\d+\.\d+)\)?", block)
        if not ip_m:
            continue
        hostname = (ip_m.group(1) or "").strip()
        ip       = ip_m.group(2)
        mac_m    = re.search(r"MAC Address: ([0-9A-Fa-f:]{17})\s*(?:\(([^)]+)\))?", block)
        lat_ms   = re.search(r"(\d+\.?\d+)ms", block)
        lat_s    = re.search(r"\((\d+\.?\d+)s latency\)", block)
        latency  = None
        if lat_ms:  latency = float(lat_ms.group(1))
        elif lat_s: latency = round(float(lat_s.group(1)) * 1000, 2)
        hosts.append({
            "ip":       ip,
            "hostname": hostname,
            "mac":      mac_m.group(1).upper() if mac_m else "",
            "vendor":   (mac_m.group(2) if mac_m and mac_m.group(2) else ""),
            "latency":  latency,
            "method":   "nmap",
        })
    return hosts


def _parse_ports_into(output, port_map):
    current_ip = None
    for line in output.splitlines():
        ip_m = re.search(r"Nmap scan report for (?:.+?\s+\()?(\d+\.\d+\.\d+\.\d+)\)?", line)
        if ip_m:
            current_ip = ip_m.group(1)
            if current_ip not in port_map:
                port_map[current_ip] = []
            continue
        port_m = re.search(r"(\d+)/tcp\s+open\s+(\S+)", line)
        if port_m and current_ip:
            port_map[current_ip].append({"port": int(port_m.group(1)), "service": port_m.group(2)})


async def _ping_stream(cidr, ws):
    try:
        network = ipaddress.IPv4Network(cidr, strict=False)
    except Exception:
        return 0
    if network.num_addresses > 1024:
        await ws.send_json({"type": "status", "message": "Red muy grande — instala nmap para escanear"})
        return 0
    host_ips = list(network.hosts())[:254]
    total    = len(host_ips)
    found    = 0
    sem      = asyncio.Semaphore(60)

    async def probe(ip_obj):
        nonlocal found
        ip = str(ip_obj)
        async with sem:
            try:
                proc = await asyncio.create_subprocess_shell(
                    f"ping -c 1 -W 1 {ip}",
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=3)
                out = stdout.decode()
                if "bytes from" in out:
                    lat_m = re.search(r"time=(\d+\.?\d*)", out)
                    try:    hostname = socket.gethostbyaddr(ip)[0]
                    except: hostname = ""
                    found += 1
                    await ws.send_json({
                        "type": "host",
                        "host": {"ip": ip, "hostname": hostname, "mac": "", "vendor": "",
                                 "latency": float(lat_m.group(1)) if lat_m else None,
                                 "method": "ping", "open_ports": [], "device_type": "host"},
                        "progress": round(found / total * 100),
                    })
            except Exception:
                pass

    await asyncio.gather(*[probe(ip) for ip in host_ips])
    return found


def _classify_device(host):
    ports    = {p["port"] for p in host.get("open_ports", [])}
    vendor   = (host.get("vendor") or "").lower()
    hostname = (host.get("hostname") or "").lower()

    router_vendors   = ["cisco","juniper","fortinet","palo alto","mikrotik","ubiquiti",
                        "zyxel","netgear","d-link","tp-link","asus","linksys","aruba","huawei"]
    router_hostnames = ["router","gateway","gw","fw","firewall","rt-","ap-","switch"]
    mobile_vendors   = ["apple","samsung","xiaomi","oppo","realme","oneplus","motorola","htc","lg electronics"]
    iot_vendors      = ["raspberry","arduino","espressif","tuya","shenzhen","hikvision","dahua","axis"]

    if any(k in vendor for k in router_vendors): return "firewall-router"
    if any(k in hostname for k in router_hostnames): return "firewall-router"
    if 3389 in ports or (445 in ports and 135 in ports):
        return "windows-server" if (80 in ports or 443 in ports) else "windows"
    if 22 in ports: return "linux-server"
    if 80 in ports or 443 in ports or 8080 in ports or 8443 in ports: return "web-server"
    if 53 in ports: return "dns-server"
    if ports & {3306,5432,1433,27017,6379}: return "database"
    if any(k in vendor for k in mobile_vendors): return "mobile"
    if any(k in vendor for k in iot_vendors): return "iot"
    if not ports: return "host"
    return "unknown"


def register_discovery_routes(app):
    from fastapi import WebSocket, WebSocketDisconnect

    @app.get("/api/discovery/networks")
    async def get_networks():
        nets = await get_local_networks()
        return {"networks": nets}

    @app.websocket("/api/discovery/scan")
    async def discovery_scan(ws: WebSocket):
        await ws.accept()
        try:
            raw  = await ws.receive_text()
            req  = json.loads(raw)
            cidr = req.get("cidr", "")
            try:
                net = ipaddress.IPv4Network(cidr, strict=False)
                if not net.is_private:
                    await ws.send_json({"type": "error", "message": "Solo redes privadas RFC1918"})
                    return
            except Exception:
                await ws.send_json({"type": "error", "message": f"CIDR inválido: {cidr}"})
                return

            await ws.send_json({"type": "start", "cidr": cidr})
            total = await discover_hosts_streaming(cidr, ws)
            await ws.send_json({"type": "done", "total": total})

        except WebSocketDisconnect:
            pass
        except Exception as e:
            try:
                await ws.send_json({"type": "error", "message": str(e)})
            except Exception:
                pass
