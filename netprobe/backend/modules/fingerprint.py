"""
NetProbe Security Suite - Hardware & Software Fingerprinting
Identifica SO, hardware, servicios, tecnologías web y vulnerabilidades conocidas.
Tools: nmap, snmpwalk, whatweb, curl
"""
import re
import shutil
import asyncio
from utils.raw_exec import raw_exec

# ── Module dispatcher ─────────────────────────────────────────────
async def run_fingerprint_module(module_id, target, intensity, duration, log_fn):
    dispatch = {
        "os_detect":  _os_detect,
        "hw_info":    _hw_info,
        "sw_versions": _sw_versions,
        "smb_enum":   _smb_enum,
        "web_tech":   _web_tech,
        "vuln_scan":  _vuln_scan,
    }
    fn = dispatch.get(module_id)
    if not fn:
        await log_fn("WARN", f"Módulo {module_id} no encontrado", module_id)
        return {}, "ERROR", None
    return await fn(target, intensity, log_fn, module_id)


# ── 1. OS Detection ───────────────────────────────────────────────
async def _os_detect(target, intensity, log_fn, mid):
    await log_fn("MODULE", "▶ OS Detection — nmap -O + scripts", mid)

    timing = {1:"-T2", 2:"-T3", 3:"-T4", 4:"-T4", 5:"-T5"}.get(intensity, "-T4")

    # Full OS detection with aggressive guessing
    cmd = f"nmap -O --osscan-guess --fuzzy {timing} -p 22,80,135,139,443,445,3389,8080 {target}"
    out, _, _ = await raw_exec(cmd, log_fn, mid, timeout=90)

    data = {}

    # OS matches
    os_matches = re.findall(r"OS details:\s*(.+)", out)
    os_guess   = re.findall(r"Aggressive OS guesses:\s*(.+)", out)
    os_cpe     = re.findall(r"OS CPE:\s*(.+)", out)

    if os_matches:
        data["os"]          = os_matches[0].strip()
        data["os_source"]   = "nmap -O exact"
    elif os_guess:
        # Take first guess with percentage
        first = os_guess[0].split(",")[0].strip()
        data["os"]          = first
        data["os_source"]   = "nmap aggressive guess"
    else:
        data["os"]          = "No detectado"

    if os_cpe:
        data["cpe"] = [c.strip() for c in os_cpe[0].split() if "cpe:/" in c]

    # Network distance
    hop_m = re.search(r"Network Distance:\s*(\d+) hop", out)
    if hop_m:
        data["hops"] = int(hop_m.group(1))

    # TTL from ping (reveals OS family)
    ttl_cmd = f"ping -c 1 -W 2 {target}"
    ttl_out, _, _ = await raw_exec(ttl_cmd, log_fn, mid, timeout=5)
    ttl_m = re.search(r"ttl=(\d+)", ttl_out, re.I)
    if ttl_m:
        ttl = int(ttl_m.group(1))
        data["ttl"] = ttl
        if ttl >= 120:
            data["os_family"] = "Windows (TTL≈128)"
        elif ttl >= 60:
            data["os_family"] = "Linux/Unix (TTL≈64)"
        elif ttl >= 250:
            data["os_family"] = "Cisco/Network Device (TTL≈255)"
        else:
            data["os_family"] = f"Desconocido (TTL={ttl})"

    # Uptime if available
    uptime_m = re.search(r"Uptime guess:\s*(.+)", out)
    if uptime_m:
        data["uptime"] = uptime_m.group(1).strip()

    status = "PASSED" if data.get("os") and data["os"] != "No detectado" else "PARTIAL"
    score  = 30 if status == "PASSED" else 60

    await log_fn("INFO", f"SO detectado: {data.get('os','?')} | Familia: {data.get('os_family','?')}", mid)
    return data, status, score


# ── 2. Hardware Info ──────────────────────────────────────────────
async def _hw_info(target, intensity, log_fn, mid):
    await log_fn("MODULE", "▶ Hardware Info — SNMP + nmap scripts", mid)

    data = {}

    # SNMP v1/v2 hardware enumeration
    if shutil.which("snmpget") or shutil.which("snmpwalk"):
        communities = ["public", "private", "community", "admin", "cisco", "manager"]
        working_community = None

        for comm in communities:
            test_cmd = f"snmpget -v2c -c {comm} -t 2 -r 1 {target} 1.3.6.1.2.1.1.1.0"
            out, _, rc = await raw_exec(test_cmd, log_fn, mid, timeout=5)
            if rc == 0 and "STRING:" in out:
                working_community = comm
                # sysDescr — full hardware/OS description
                data["snmp_community"] = comm
                desc_m = re.search(r'STRING:\s*"?(.+?)"?\s*$', out, re.M)
                if desc_m:
                    data["sys_descr"] = desc_m.group(1).strip()
                break

        if working_community:
            # sysName
            name_out, _, _ = await raw_exec(
                f"snmpget -v2c -c {working_community} -t 2 {target} 1.3.6.1.2.1.1.5.0",
                log_fn, mid, timeout=5)
            name_m = re.search(r'STRING:\s*"?(.+?)"?\s*$', name_out, re.M)
            if name_m:
                data["hostname"] = name_m.group(1).strip()

            # sysContact
            contact_out, _, _ = await raw_exec(
                f"snmpget -v2c -c {working_community} -t 2 {target} 1.3.6.1.2.1.1.4.0",
                log_fn, mid, timeout=5)
            contact_m = re.search(r'STRING:\s*"?(.+?)"?\s*$', contact_out, re.M)
            if contact_m:
                data["contact"] = contact_m.group(1).strip()

            # sysLocation
            loc_out, _, _ = await raw_exec(
                f"snmpget -v2c -c {working_community} -t 2 {target} 1.3.6.1.2.1.1.6.0",
                log_fn, mid, timeout=5)
            loc_m = re.search(r'STRING:\s*"?(.+?)"?\s*$', loc_out, re.M)
            if loc_m:
                data["location"] = loc_m.group(1).strip()

            # Interface info
            if_out, _, _ = await raw_exec(
                f"snmpwalk -v2c -c {working_community} -t 2 {target} 1.3.6.1.2.1.2.2.1.2",
                log_fn, mid, timeout=10)
            interfaces = re.findall(r'STRING:\s*"?([^"\n]+)"?\s*$', if_out, re.M)
            if interfaces:
                data["interfaces"] = [i.strip() for i in interfaces[:8]]

            # CPU / memory OIDs (Cisco, Linux HOST-MIB)
            cpu_out, _, _ = await raw_exec(
                f"snmpget -v2c -c {working_community} -t 2 {target} 1.3.6.1.4.1.9.2.1.57.0",
                log_fn, mid, timeout=5)
            cpu_m = re.search(r'INTEGER:\s*(\d+)', cpu_out)
            if cpu_m:
                data["cpu_usage_pct"] = int(cpu_m.group(1))

            await log_fn("INFO", f"SNMP OK: {data.get('sys_descr','')[:80]}", mid)
        else:
            await log_fn("WARN", "SNMP: ninguna community string funcionó", mid)
            data["snmp"] = "BLOQUEADO o no disponible"

    # nmap SNMP + hardware scripts
    timing = {1:"-T2", 2:"-T3", 3:"-T4", 4:"-T4", 5:"-T5"}.get(intensity, "-T3")
    nmap_cmd = (f"nmap {timing} -sU -p 161 "
                f"--script snmp-sysdescr,snmp-interfaces,snmp-netstat,snmp-info "
                f"{target}")
    nmap_out, _, _ = await raw_exec(nmap_cmd, log_fn, mid, timeout=60)

    # Parse nmap SNMP script output
    sysdescr_m = re.search(r"snmp-sysdescr:\s*\n\s*(.+)", nmap_out)
    if sysdescr_m and not data.get("sys_descr"):
        data["sys_descr"] = sysdescr_m.group(1).strip()

    # MAC address from ARP
    arp_out, _, _ = await raw_exec(f"arp -n {target}", log_fn, mid, timeout=5)
    mac_m = re.search(r"([0-9a-f]{2}(?::[0-9a-f]{2}){5})", arp_out, re.I)
    if mac_m:
        data["mac"] = mac_m.group(1).upper()
        data["vendor"] = _lookup_vendor(mac_m.group(1))

    exposed = bool(data.get("sys_descr") or data.get("snmp_community"))
    status = "PASSED" if exposed else "BLOCKED"
    score  = 20 if exposed else 100

    return data, status, score


# ── 3. Software & Service Versions ───────────────────────────────
async def _sw_versions(target, intensity, log_fn, mid):
    await log_fn("MODULE", "▶ Software Versions — nmap -sV + banner grab", mid)

    timing  = {1:"-T2", 2:"-T3", 3:"-T4", 4:"-T4", 5:"-T5"}.get(intensity, "-T4")
    ports   = {1:"1-1024", 2:"1-2000", 3:"1-5000", 4:"1-10000", 5:"1-65535"}.get(intensity,"1-2000")
    cmd     = f"nmap -sV --version-intensity 7 {timing} -p {ports} {target}"
    out, _, _ = await raw_exec(cmd, log_fn, mid, timeout=120)

    services = []
    for line in out.splitlines():
        m = re.match(r"\s*(\d+)/(tcp|udp)\s+open\s+(\S+)\s*(.*)", line)
        if m:
            port, proto, svc, version = m.groups()
            entry = {"port": int(port), "proto": proto, "service": svc, "version": version.strip()}
            # Extract CVE hints from version strings
            entry["cves"] = _check_known_vuln_versions(svc, version)
            services.append(entry)

    # NSE script for detailed version info
    if intensity >= 3:
        script_cmd = f"nmap -sV -sC {timing} --script=banner,version,http-server-header,ssh2-enum-algos -p 22,80,443,8080,8443,21,25,110,143,3306 {target}"
        sc_out, _, _ = await raw_exec(script_cmd, log_fn, mid, timeout=90)

        # SSH version
        ssh_m = re.search(r"ssh-hostkey.*?\n.*?(\d{3,4}).*?RSA", sc_out, re.S)
        # HTTP server header
        http_server = re.findall(r"\|_?http-server-header:\s*(.+)", sc_out)
        if http_server:
            for svc in services:
                if svc["service"] in ("http","https","http-alt"):
                    svc["http_server"] = http_server[0].strip()
                    break

    # Summarize interesting findings
    vuln_services = [s for s in services if s.get("cves")]
    data = {
        "services":      services,
        "total_open":    len(services),
        "vuln_hints":    vuln_services,
        "unique_vendors": list({s["service"] for s in services}),
    }

    status = "PASSED" if vuln_services else ("PARTIAL" if services else "BLOCKED")
    score  = {True: 20, False: 60}.get(bool(vuln_services), 80)
    await log_fn("INFO", f"{len(services)} servicios detectados, {len(vuln_services)} con posibles CVEs", mid)
    return data, status, score


# ── 4. SMB / NetBIOS / Windows Enumeration ───────────────────────
async def _smb_enum(target, intensity, log_fn, mid):
    await log_fn("MODULE", "▶ SMB/Windows Enumeration — nmap scripts + nbtscan", mid)

    data = {}
    timing = {1:"-T2", 2:"-T3", 3:"-T4", 4:"-T4", 5:"-T5"}.get(intensity, "-T4")

    # NetBIOS scan
    if shutil.which("nbtscan"):
        nb_out, _, _ = await raw_exec(f"nbtscan -r {target}", log_fn, mid, timeout=15)
        nb_m = re.search(r"(\d+\.\d+\.\d+\.\d+)\s+(\S+)\s+(\S+)", nb_out)
        if nb_m:
            data["netbios_name"]    = nb_m.group(2)
            data["netbios_domain"]  = nb_m.group(3)

    # nmap SMB scripts
    smb_cmd = (f"nmap {timing} -p 139,445 "
               f"--script smb-os-discovery,smb-security-mode,smb2-security-mode,"
               f"smb-system-info,smb-enum-shares,smb2-capabilities "
               f"{target}")
    smb_out, _, _ = await raw_exec(smb_cmd, log_fn, mid, timeout=90)

    # OS from SMB
    os_m = re.search(r"OS:\s*(.+)", smb_out)
    if os_m:
        data["windows_version"] = os_m.group(1).strip()

    # Computer name
    comp_m = re.search(r"Computer name:\s*(.+)", smb_out)
    if comp_m:
        data["computer_name"] = comp_m.group(1).strip()

    # Domain
    domain_m = re.search(r"(?:Domain name|Workgroup):\s*(.+)", smb_out, re.I)
    if domain_m:
        data["domain"] = domain_m.group(1).strip()

    # SMB security mode
    signing_m = re.search(r"Message signing:\s*(.+)", smb_out)
    if signing_m:
        data["smb_signing"] = signing_m.group(1).strip()
        if "disabled" in signing_m.group(1).lower():
            data["smb_signing_risk"] = "CRÍTICO: SMB signing deshabilitado — vulnerable a relay attacks"

    # Shares
    shares = re.findall(r"\|\s+(\S+)\s*\n.*?Type:\s*(\S+)", smb_out, re.S)
    if shares:
        data["shares"] = [{"name": s[0], "type": s[1]} for s in shares[:10]]

    # SMB2 dialect
    dialect_m = re.search(r"SMB2 dialect:\s*(.+)", smb_out)
    if dialect_m:
        data["smb_dialect"] = dialect_m.group(1).strip()

    # Check for EternalBlue (MS17-010)
    eternal_cmd = f"nmap -p 445 --script smb-vuln-ms17-010 {target}"
    eternal_out, _, _ = await raw_exec(eternal_cmd, log_fn, mid, timeout=60)
    if "VULNERABLE" in eternal_out:
        data["ms17_010"] = "VULNERABLE — EternalBlue/WannaCry"
    elif "likely VULNERABLE" in eternal_out:
        data["ms17_010"] = "POSIBLEMENTE VULNERABLE"
    else:
        data["ms17_010"] = "No vulnerable"

    exposed = bool(data.get("windows_version") or data.get("computer_name") or data.get("shares"))
    status  = "PASSED" if exposed else "BLOCKED"
    score   = 25 if exposed else 100

    if data.get("smb_signing_risk"):
        status, score = "PASSED", 10

    await log_fn("INFO", f"SMB: {data.get('windows_version','?')} | Equipo: {data.get('computer_name','?')}", mid)
    return data, status, score


# ── 5. Web Technology Detection ──────────────────────────────────
async def _web_tech(target, intensity, log_fn, mid):
    await log_fn("MODULE", "▶ Web Technology Detection — nmap http scripts + headers", mid)

    data = {"technologies": [], "headers": {}, "endpoints": []}
    timing = {1:"-T2", 2:"-T3", 3:"-T4", 4:"-T4", 5:"-T5"}.get(intensity, "-T4")

    # Detect web ports first
    port_cmd = f"nmap {timing} -p 80,443,8080,8443,8000,8888,3000,5000,9000 --open {target}"
    port_out, _, _ = await raw_exec(port_cmd, log_fn, mid, timeout=30)
    web_ports = re.findall(r"(\d+)/tcp\s+open", port_out)

    if not web_ports:
        data["note"] = "No se detectaron puertos web abiertos"
        return data, "BLOCKED", 100

    # Run http scripts on detected ports
    ports_str = ",".join(web_ports)
    http_cmd  = (f"nmap {timing} -p {ports_str} "
                 f"--script http-title,http-server-header,http-headers,"
                 f"http-auth-finder,http-methods,http-generator,http-robots.txt "
                 f"{target}")
    http_out, _, _ = await raw_exec(http_cmd, log_fn, mid, timeout=90)

    # Parse titles
    titles = re.findall(r"http-title:\s*(.+)", http_out)
    if titles:
        data["page_titles"] = [t.strip() for t in titles]

    # Server header
    servers = re.findall(r"http-server-header:\s*(.+)", http_out)
    if servers:
        data["server"] = servers[0].strip()
        data["technologies"].append(servers[0].strip())

    # Generator (CMS)
    generators = re.findall(r"Generator:\s*(.+)", http_out)
    if generators:
        data["cms"] = generators[0].strip()
        data["technologies"].append(generators[0].strip())

    # HTTP methods
    methods_m = re.findall(r"http-methods:.*?Supported Methods:\s*(.+)", http_out)
    if methods_m:
        data["http_methods"] = methods_m[0].strip().split()
        if "TRACE" in data["http_methods"] or "PUT" in data["http_methods"]:
            data["dangerous_methods"] = [m for m in data["http_methods"] if m in ("TRACE","PUT","DELETE","CONNECT")]

    # Robots.txt disallowed paths
    robots = re.findall(r"/robots.txt.*?Disallow:\s*(\S+)", http_out)
    if robots:
        data["robots_disallow"] = robots[:10]

    # curl for detailed headers on each port
    import httpx
    for port in web_ports[:3]:
        scheme = "https" if port in ("443","8443") else "http"
        url    = f"{scheme}://{target}:{port}/"
        try:
            async with httpx.AsyncClient(verify=False, timeout=8, follow_redirects=True) as client:
                resp = await client.get(url)
                headers = dict(resp.headers)
                data["headers"][port] = {
                    "status":          resp.status_code,
                    "server":          headers.get("server",""),
                    "x-powered-by":    headers.get("x-powered-by",""),
                    "x-frame-options": headers.get("x-frame-options",""),
                    "csp":             headers.get("content-security-policy",""),
                    "hsts":            headers.get("strict-transport-security",""),
                    "x-content-type":  headers.get("x-content-type-options",""),
                }
                # Detect technologies from headers
                techs = _detect_tech_from_headers(headers, resp.text[:2000])
                data["technologies"].extend(techs)
                await log_fn("INFO", f"Port {port}: HTTP {resp.status_code} | {headers.get('server','')}", mid)
        except Exception as e:
            await log_fn("WARN", f"Port {port}: {e}", mid)

    data["technologies"] = list(dict.fromkeys(data["technologies"]))  # deduplicate

    # Whatweb if available
    if shutil.which("whatweb"):
        ww_cmd = f"whatweb --color=never --quiet http://{target}"
        ww_out, _, _ = await raw_exec(ww_cmd, log_fn, mid, timeout=30)
        if ww_out:
            data["whatweb"] = ww_out.strip()[:400]

    missing_headers = []
    for port, hdrs in data.get("headers", {}).items():
        if not hdrs.get("hsts"):       missing_headers.append("HSTS")
        if not hdrs.get("csp"):        missing_headers.append("CSP")
        if not hdrs.get("x-frame-options"): missing_headers.append("X-Frame-Options")
    data["missing_security_headers"] = list(set(missing_headers))

    info_leak = bool(data.get("server") or data.get("cms") or data.get("x-powered-by"))
    status    = "PASSED" if info_leak else "PARTIAL"
    score     = 30 if info_leak else 60

    await log_fn("INFO", f"Tecnologías: {', '.join(data['technologies'][:5]) or 'ninguna'}", mid)
    return data, status, score


# ── 6. Vulnerability Scan ─────────────────────────────────────────
async def _vuln_scan(target, intensity, log_fn, mid):
    await log_fn("MODULE", "▶ Vulnerability Scan — nmap vuln scripts + CVE check", mid)

    timing = {1:"-T2", 2:"-T3", 3:"-T4", 4:"-T4", 5:"-T5"}.get(intensity, "-T3")
    data   = {"vulnerabilities": [], "cves": [], "severity": "NONE"}

    # nmap vuln category scripts
    vuln_cmd = (f"nmap {timing} -sV "
                f"--script vuln,exploit "
                f"-p 21,22,23,25,53,80,110,135,139,143,443,445,1433,1521,3306,3389,5432,6379,8080,27017 "
                f"{target}")
    await log_fn("CMD", vuln_cmd, mid)
    out, _, _ = await raw_exec(vuln_cmd, log_fn, mid, timeout=180)

    # Parse vulnerabilities
    vuln_blocks = re.split(r"\|\s*(?=\w)", out)
    for block in out.splitlines():
        # VULNERABLE lines
        if "VULNERABLE" in block or "vulnerable" in block.lower():
            vuln = block.strip().lstrip("|").strip()
            if len(vuln) > 5 and vuln not in data["vulnerabilities"]:
                data["vulnerabilities"].append(vuln)

        # CVE references
        cves = re.findall(r"CVE-\d{4}-\d{4,}", block)
        data["cves"].extend(cves)

        # MS Bulletins
        ms = re.findall(r"MS\d{2}-\d{3}", block)
        data["cves"].extend(ms)

    # Deduplicate
    data["cves"] = list(dict.fromkeys(data["cves"]))

    # Specific high-value checks
    checks = [
        ("smb-vuln-ms17-010",  "445",  "EternalBlue (MS17-010) / WannaCry"),
        ("smb-vuln-ms08-067",  "445",  "Conficker (MS08-067)"),
        ("rdp-vuln-ms12-020",  "3389", "BlueKeep-precursor (MS12-020)"),
        ("ssl-heartbleed",     "443",  "Heartbleed (CVE-2014-0160)"),
        ("ssl-poodle",         "443",  "POODLE (CVE-2014-3566)"),
        ("ftp-vsftpd-backdoor","21",   "vsftpd 2.3.4 Backdoor"),
        ("ftp-anon",           "21",   "FTP anónimo permitido"),
        ("http-shellshock",    "80,443","ShellShock (CVE-2014-6271)"),
    ]

    for script, port, desc in checks:
        check_cmd = f"nmap -p {port} --script {script} {timing} {target}"
        check_out, _, _ = await raw_exec(check_cmd, log_fn, mid, timeout=45)
        if "VULNERABLE" in check_out or "State: OPEN" in check_out and "ftp-anon" in script:
            entry = {"script": script, "description": desc, "severity": "CRITICAL"}
            if entry not in data["vulnerabilities"]:
                data["vulnerabilities"].append(entry)
            await log_fn("WARN", f"VULNERABLE: {desc}", mid)

    # Severity
    crit_count = len([v for v in data["vulnerabilities"] if isinstance(v, dict)])
    if crit_count > 0:
        data["severity"] = "CRITICAL"
        status, score = "PASSED", 5
    elif data["vulnerabilities"]:
        data["severity"] = "HIGH"
        status, score = "PASSED", 20
    elif data["cves"]:
        data["severity"] = "MEDIUM"
        status, score = "PARTIAL", 40
    else:
        data["severity"] = "LOW"
        status, score = "BLOCKED", 90

    data["vuln_count"] = len(data["vulnerabilities"])
    data["cve_count"]  = len(data["cves"])

    await log_fn("INFO",
        f"Vulnerabilidades: {data['vuln_count']} | CVEs: {data['cve_count']} | Severidad: {data['severity']}", mid)
    return data, status, score


# ── Helpers ───────────────────────────────────────────────────────

def _check_known_vuln_versions(service, version_str):
    """Flag services with known-vulnerable version strings."""
    v = version_str.lower()
    vulns = []
    patterns = [
        ("vsftpd 2.3.4",   "CVE backdoor vsftpd 2.3.4"),
        ("openssh 4.",      "OpenSSH 4.x — múltiples CVEs"),
        ("openssh 5.",      "OpenSSH 5.x — CVEs conocidos"),
        ("apache 2.2.",     "Apache 2.2 — EoL, múltiples CVEs"),
        ("apache 2.4.4",    "Apache 2.4.49/50 — Path Traversal CVE-2021-41773"),
        ("apache 2.4.49",   "Apache Path Traversal CVE-2021-41773 CRÍTICO"),
        ("apache 2.4.50",   "Apache Path Traversal CVE-2021-42013"),
        ("iis 6.0",         "IIS 6.0 — EoL, CVE-2017-7269 Buffer Overflow"),
        ("iis 7.0",         "IIS 7.0 — EoL"),
        ("php/5.",           "PHP 5.x — EoL, múltiples CVEs críticos"),
        ("php/7.0",         "PHP 7.0 — EoL"),
        ("php/7.1",         "PHP 7.1 — EoL"),
        ("openssl 1.0.1",   "OpenSSH 1.0.1 — Heartbleed CVE-2014-0160"),
        ("proftpd 1.3.3",   "ProFTPD 1.3.3c backdoor"),
        ("microsoft-ds",    "SMB expuesto — revisar ms17-010"),
        ("mysql 5.0",       "MySQL 5.0 — EoL"),
        ("mysql 5.1",       "MySQL 5.1 — EoL"),
    ]
    for pattern, desc in patterns:
        if pattern in v:
            vulns.append(desc)
    return vulns


def _detect_tech_from_headers(headers, body):
    """Detect technologies from HTTP headers and body."""
    techs = []
    h = {k.lower(): v.lower() for k, v in headers.items()}
    b = body.lower()

    if "php" in h.get("x-powered-by",""):       techs.append(f"PHP ({h['x-powered-by']})")
    if "asp.net" in h.get("x-powered-by",""):   techs.append("ASP.NET")
    if "express" in h.get("x-powered-by",""):   techs.append("Express.js")
    if "nginx" in h.get("server",""):           techs.append(f"nginx ({h['server']})")
    if "apache" in h.get("server",""):          techs.append(f"Apache ({h['server']})")
    if "iis" in h.get("server",""):             techs.append(f"IIS ({h['server']})")
    if "wordpress" in b:                         techs.append("WordPress")
    if "joomla" in b:                            techs.append("Joomla")
    if "drupal" in b:                            techs.append("Drupal")
    if "react" in b or "__react" in b:           techs.append("React")
    if "angular" in b:                           techs.append("Angular")
    if "jquery" in b:                            techs.append("jQuery")
    if "laravel" in b or "laravel_session" in str(headers): techs.append("Laravel")
    if "django" in h.get("x-frame-options","").lower(): techs.append("Django")
    return techs


def _lookup_vendor(mac):
    """Basic OUI vendor lookup for common prefixes."""
    oui = mac.upper().replace("-",":")[0:8]
    vendors = {
        "00:50:56": "VMware", "00:0C:29": "VMware", "00:1C:14": "VMware",
        "08:00:27": "VirtualBox", "52:54:00": "QEMU/KVM",
        "00:1A:A0": "Dell", "00:14:22": "Dell", "B8:AC:6F": "Dell",
        "3C:D9:2B": "HP", "00:1B:78": "HP", "00:25:B3": "HP",
        "00:1D:60": "Cisco", "00:1E:BD": "Cisco", "F4:6D:04": "Cisco",
        "00:1C:BF": "Fortinet", "90:6C:AC": "Fortinet",
        "B8:27:EB": "Raspberry Pi", "DC:A6:32": "Raspberry Pi",
        "00:1B:21": "Intel", "00:26:B9": "Intel",
        "00:50:B6": "Good Way Technology",
    }
    return vendors.get(oui, "")
