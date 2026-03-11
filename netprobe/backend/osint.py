"""
NetProbe - OSINT Engine
Reconocimiento pasivo: Shodan, VirusTotal, HaveIBeenPwned, DNS, Whois, Cert transparency
Sin tocar el objetivo — todo información pública.
"""
import asyncio, json, re, socket
from datetime import datetime

# ── Helpers ────────────────────────────────────────────────────────
async def http_get(url, headers=None, timeout=15):
    import httpx
    try:
        async with httpx.AsyncClient(timeout=timeout) as c:
            r = await c.get(url, headers=headers or {})
            return r.status_code, r.json() if 'json' in r.headers.get('content-type','') else r.text
    except Exception as e:
        return None, str(e)

def is_ip(val):
    return bool(re.match(r'^(\d{1,3}\.){3}\d{1,3}$', val))

def extract_domain(val):
    """Extrae dominio de IP o URL"""
    val = re.sub(r'^https?://', '', val).split('/')[0].split(':')[0]
    return val

# ── Shodan ─────────────────────────────────────────────────────────
async def query_shodan(target: str, api_key: str) -> dict:
    if not api_key:
        return {"error": "API key de Shodan requerida", "source": "shodan"}

    if is_ip(target):
        url = f"https://api.shodan.io/shodan/host/{target}?key={api_key}"
    else:
        url = f"https://api.shodan.io/dns/resolve?hostnames={target}&key={api_key}"

    status, data = await http_get(url)
    if status != 200:
        err = data if isinstance(data, str) else data.get("error", "Error desconocido")
        return {"error": str(err), "source": "shodan"}

    if not is_ip(target):
        # Resolve then query IP
        ip = list(data.values())[0] if isinstance(data, dict) else None
        if not ip:
            return {"error": "No se pudo resolver el dominio", "source": "shodan"}
        status, data = await http_get(f"https://api.shodan.io/shodan/host/{ip}?key={api_key}")
        if status != 200:
            return {"error": str(data), "source": "shodan"}

    ports   = data.get("ports", [])
    vulns   = list(data.get("vulns", {}).keys())
    country = data.get("country_name", "?")
    org     = data.get("org", "?")
    os_val  = data.get("os", None)
    hostnames = data.get("hostnames", [])
    tags    = data.get("tags", [])

    services = []
    for item in data.get("data", [])[:10]:
        svc = {
            "port":      item.get("port"),
            "transport": item.get("transport", "tcp"),
            "product":   item.get("product", ""),
            "version":   item.get("version", ""),
            "cpe":       item.get("cpe", []),
            "banner":    (item.get("data","")[:200] if item.get("data") else ""),
        }
        if item.get("http"):
            svc["http_title"]  = item["http"].get("title","")
            svc["http_server"] = item["http"].get("server","")
        services.append(svc)

    return {
        "source":    "shodan",
        "ip":        data.get("ip_str", target),
        "org":       org,
        "country":   country,
        "os":        os_val,
        "hostnames": hostnames,
        "tags":      tags,
        "ports":     sorted(ports),
        "vulns":     vulns,
        "services":  services,
        "last_update": data.get("last_update",""),
        "asn":       data.get("asn",""),
        "isp":       data.get("isp",""),
    }

# ── VirusTotal ─────────────────────────────────────────────────────
async def query_virustotal(target: str, api_key: str) -> dict:
    if not api_key:
        return {"error": "API key de VirusTotal requerida", "source": "virustotal"}

    headers = {"x-apikey": api_key}
    if is_ip(target):
        url = f"https://www.virustotal.com/api/v3/ip_addresses/{target}"
    else:
        import base64
        domain = extract_domain(target)
        url = f"https://www.virustotal.com/api/v3/domains/{domain}"

    status, data = await http_get(url, headers=headers)
    if status != 200:
        err = data if isinstance(data, str) else json.dumps(data)[:200]
        return {"error": f"HTTP {status}: {err}", "source": "virustotal"}

    attrs = data.get("data", {}).get("attributes", {})
    stats = attrs.get("last_analysis_stats", {})
    results = attrs.get("last_analysis_results", {})

    # Engines that flagged it
    malicious_engines = [
        k for k, v in results.items()
        if v.get("category") in ("malicious", "suspicious")
    ]

    return {
        "source":           "virustotal",
        "target":           target,
        "malicious":        stats.get("malicious", 0),
        "suspicious":       stats.get("suspicious", 0),
        "harmless":         stats.get("harmless", 0),
        "undetected":       stats.get("undetected", 0),
        "malicious_engines":malicious_engines[:10],
        "reputation":       attrs.get("reputation", 0),
        "categories":       attrs.get("categories", {}),
        "tags":             attrs.get("tags", []),
        "country":          attrs.get("country", ""),
        "asn":              attrs.get("asn", ""),
        "as_owner":         attrs.get("as_owner", ""),
        "network":          attrs.get("network", ""),
        "whois":            (attrs.get("whois","")[:500] if attrs.get("whois") else ""),
        "last_analysis_date": attrs.get("last_analysis_date",""),
        "total_votes":      attrs.get("total_votes", {}),
    }

# ── HaveIBeenPwned ─────────────────────────────────────────────────
async def query_hibp(email_or_domain: str, api_key: str = "") -> dict:
    """Comprueba brechas para email o dominio — no aplica a IPs"""
    import httpx

    # Skip IPs — HIBP no tiene sentido para direcciones IP
    if is_ip(email_or_domain):
        return {
            "source": "hibp",
            "target": email_or_domain,
            "skipped": True,
            "reason": "HIBP no aplica a direcciones IP — introduce un dominio o email",
        }

    # If it looks like a domain (not email), check domain breaches
    if "@" not in email_or_domain:
        domain = extract_domain(email_or_domain)
        # HIBP domain search requires paid API; use public breach list instead
        url = "https://haveibeenpwned.com/api/v3/breaches"
        headers = {"hibp-api-key": api_key} if api_key else {}
        status, data = await http_get(url, headers=headers)
        if status == 200 and isinstance(data, list):
            domain_breaches = [b for b in data if domain.lower() in b.get("Domain","").lower()]
            return {
                "source": "hibp",
                "target": domain,
                "type": "domain",
                "breaches": [{
                    "name":         b.get("Name",""),
                    "date":         b.get("BreachDate",""),
                    "pwn_count":    b.get("PwnCount",0),
                    "data_classes": b.get("DataClasses",[]),
                    "description":  (b.get("Description","")[:200] if b.get("Description") else ""),
                    "verified":     b.get("IsVerified",False),
                } for b in domain_breaches[:15]],
                "total_breaches": len(domain_breaches),
            }

    # Email lookup
    headers = {
        "hibp-api-key": api_key,
        "User-Agent": "NetProbe-Security-Suite",
    } if api_key else {"User-Agent": "NetProbe-Security-Suite"}

    url = f"https://haveibeenpwned.com/api/v3/breachedaccount/{email_or_domain}?truncateResponse=false"
    status, data = await http_get(url, headers=headers)

    if status == 404:
        return {"source": "hibp", "target": email_or_domain, "breaches": [], "total_breaches": 0, "clean": True}
    if status == 401:
        return {"source": "hibp", "error": "API key de HIBP requerida para búsqueda por email", "target": email_or_domain}
    if status != 200:
        return {"source": "hibp", "error": f"HTTP {status}", "target": email_or_domain}

    breaches = data if isinstance(data, list) else []
    return {
        "source":        "hibp",
        "target":        email_or_domain,
        "type":          "email",
        "breaches": [{
            "name":         b.get("Name",""),
            "date":         b.get("BreachDate",""),
            "pwn_count":    b.get("PwnCount",0),
            "data_classes": b.get("DataClasses",[]),
            "verified":     b.get("IsVerified",False),
        } for b in breaches[:20]],
        "total_breaches": len(breaches),
        "clean":         len(breaches) == 0,
    }

# ── DNS Recon ──────────────────────────────────────────────────────
async def query_dns(target: str) -> dict:
    import subprocess, asyncio
    domain = extract_domain(target) if not is_ip(target) else None

    result = {
        "source": "dns",
        "target": target,
        "records": {},
        "reverse_dns": None,
        "mx": [],
        "ns": [],
        "txt": [],
        "subdomains_hint": [],
    }

    if is_ip(target):
        try:
            host = socket.gethostbyaddr(target)
            result["reverse_dns"] = host[0]
            result["aliases"]     = list(host[1])
        except:
            pass
        return result

    # Forward DNS
    record_types = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"]
    for rtype in record_types:
        try:
            proc = await asyncio.create_subprocess_exec(
                "dig", "+short", rtype, domain,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
            lines = [l.strip() for l in out.decode().strip().split("\n") if l.strip()]
            if lines:
                result["records"][rtype] = lines
                if rtype == "MX": result["mx"] = lines
                if rtype == "NS": result["ns"] = lines
                if rtype == "TXT":
                    result["txt"] = lines
                    # Extract SPF, DMARC hints
                    for t in lines:
                        if "v=spf" in t.lower():  result["spf"]   = t
                        if "v=dmarc" in t.lower(): result["dmarc"] = t
        except:
            pass

    # Common subdomains
    common_subs = ["www", "mail", "ftp", "vpn", "api", "dev", "admin", "portal", "remote", "ssh"]
    for sub in common_subs:
        try:
            addrs = socket.getaddrinfo(f"{sub}.{domain}", None, socket.AF_INET)
            if addrs:
                result["subdomains_hint"].append({
                    "subdomain": f"{sub}.{domain}",
                    "ip": addrs[0][4][0],
                })
        except:
            pass

    return result

# ── SSL/TLS Certificate ────────────────────────────────────────────
async def query_ssl(target: str) -> dict:
    import ssl, socket as sock
    domain = extract_domain(target) if not is_ip(target) else target
    result = {"source": "ssl", "target": domain}
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(sock.socket(), server_hostname=domain) as s:
            s.settimeout(8)
            s.connect((domain, 443))
            cert = s.getpeercert()
            result["subject"]     = dict(x[0] for x in cert.get("subject", []))
            result["issuer"]      = dict(x[0] for x in cert.get("issuer", []))
            result["not_before"]  = cert.get("notBefore","")
            result["not_after"]   = cert.get("notAfter","")
            result["sans"]        = [v for t,v in cert.get("subjectAltName",[]) if t == "DNS"]
            result["serial"]      = cert.get("serialNumber","")
            result["version"]     = cert.get("version","")
            # Check expiry
            from datetime import datetime
            try:
                exp = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z")
                days_left = (exp - datetime.utcnow()).days
                result["days_until_expiry"] = days_left
                result["expiry_warning"] = days_left < 30
            except:
                pass
    except ssl.SSLCertVerificationError as e:
        result["ssl_error"] = str(e)
        result["cert_invalid"] = True
    except Exception as e:
        result["ssl_error"] = str(e)
    return result

# ── Whois ──────────────────────────────────────────────────────────
async def query_whois(target: str) -> dict:
    domain = extract_domain(target) if not is_ip(target) else target
    try:
        proc = await asyncio.create_subprocess_exec(
            "whois", domain,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
        text = out.decode(errors="ignore")

        result = {"source": "whois", "target": domain, "raw": text[:2000]}

        # Parse common fields
        for line in text.split("\n"):
            low = line.lower()
            if "registrar:" in low and "registrar" not in result:
                result["registrar"] = line.split(":",1)[1].strip()
            if "creation date:" in low and "created" not in result:
                result["created"] = line.split(":",1)[1].strip()[:30]
            if ("expir" in low and "date" in low) and "expires" not in result:
                result["expires"] = line.split(":",1)[1].strip()[:30]
            if "registrant" in low and "country" in low and "registrant_country" not in result:
                result["registrant_country"] = line.split(":",1)[1].strip()
            if "name server:" in low:
                result.setdefault("nameservers",[]).append(line.split(":",1)[1].strip())

        return result
    except Exception as e:
        return {"source": "whois", "target": domain, "error": str(e)}

# ── Full OSINT scan ────────────────────────────────────────────────
async def run_osint(target: str, keys: dict) -> dict:
    """
    keys: {
      shodan:      str,
      virustotal:  str,
      hibp:        str,
    }
    """
    tasks = {
        "dns":        query_dns(target),
        "ssl":        query_ssl(target),
        "whois":      query_whois(target),
        "shodan":     query_shodan(target, keys.get("shodan","")),
        "virustotal": query_virustotal(target, keys.get("virustotal","")),
        "hibp":       query_hibp(target, keys.get("hibp","")),
    }

    results = {}
    gathered = await asyncio.gather(*tasks.values(), return_exceptions=True)
    for key, res in zip(tasks.keys(), gathered):
        if isinstance(res, Exception):
            results[key] = {"source": key, "error": str(res)}
        else:
            results[key] = res

    # Risk summary
    risk_indicators = []
    shodan = results.get("shodan", {})
    vt     = results.get("virustotal", {})
    hibp   = results.get("hibp", {})
    ssl    = results.get("ssl", {})

    if shodan.get("vulns"):
        risk_indicators.append(f"Shodan: {len(shodan['vulns'])} CVE(s) conocidos")
    if vt.get("malicious", 0) > 0:
        risk_indicators.append(f"VirusTotal: {vt['malicious']} motores reportan como malicioso")
    if hibp.get("total_breaches", 0) > 0:
        risk_indicators.append(f"HIBP: {hibp['total_breaches']} brecha(s) de datos asociadas")
    if ssl.get("cert_invalid"):
        risk_indicators.append("SSL: Certificado inválido o expirado")
    if ssl.get("expiry_warning"):
        risk_indicators.append(f"SSL: Expira en {ssl.get('days_until_expiry')} días")
    open_ports = shodan.get("ports", [])
    dangerous  = [p for p in open_ports if p in [21,22,23,3389,445,3306,5432,27017,6379]]
    if dangerous:
        risk_indicators.append(f"Puertos sensibles expuestos: {dangerous}")

    results["summary"] = {
        "target":          target,
        "timestamp":       datetime.now().isoformat(),
        "risk_indicators": risk_indicators,
        "risk_level":      "CRITICAL" if len(risk_indicators) >= 4
                           else "HIGH" if len(risk_indicators) >= 2
                           else "MEDIUM" if risk_indicators
                           else "LOW",
    }

    return results

# ── FastAPI routes ─────────────────────────────────────────────────
def register_osint_routes(app):
    from pydantic import BaseModel
    from typing import Optional

    class OSINTRequest(BaseModel):
        target:      str
        shodan_key:  Optional[str] = ""
        vt_key:      Optional[str] = ""
        hibp_key:    Optional[str] = ""

    class SingleRequest(BaseModel):
        target:  str
        api_key: Optional[str] = ""

    @app.post("/api/osint/full")
    async def osint_full(req: OSINTRequest):
        return await run_osint(req.target, {
            "shodan":     req.shodan_key or "",
            "virustotal": req.vt_key or "",
            "hibp":       req.hibp_key or "",
        })

    @app.post("/api/osint/shodan")
    async def osint_shodan(req: SingleRequest):
        return await query_shodan(req.target, req.api_key or "")

    @app.post("/api/osint/virustotal")
    async def osint_vt(req: SingleRequest):
        return await query_virustotal(req.target, req.api_key or "")

    @app.post("/api/osint/dns")
    async def osint_dns(req: SingleRequest):
        return await query_dns(req.target)

    @app.post("/api/osint/ssl")
    async def osint_ssl(req: SingleRequest):
        return await query_ssl(req.target)

    @app.post("/api/osint/whois")
    async def osint_whois(req: SingleRequest):
        return await query_whois(req.target)

    @app.post("/api/osint/hibp")
    async def osint_hibp(req: SingleRequest):
        return await query_hibp(req.target, req.api_key or "")
