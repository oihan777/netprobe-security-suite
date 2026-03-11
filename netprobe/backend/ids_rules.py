"""
ids_rules.py — Snort/Suricata Rule Generator
Genera reglas IDS/IPS basadas en los resultados de un scan de NetProbe.
"""
import httpx
import json
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

# ─── Modelos ──────────────────────────────────────────────────────────────────

class ScanResult(BaseModel):
    module_id:   str
    module_name: str
    status:      str
    category:    str
    risk:        str
    output:      Optional[str] = ""

class RulesRequest(BaseModel):
    target:   str
    results:  List[ScanResult]
    groq_key: str
    format:   str = "both"


# ─── Contexto técnico completo por módulo ─────────────────────────────────────
# Cada entrada define proto, puerto destino, firma técnica real y categoría IDS

MODULE_CONTEXT = {
    # ── Recon ────────────────────────────────────────────────────────────────
    "syn_scan":   {
        "proto": "tcp", "port": "any", "category": "Reconnaissance",
        "signature": "TCP SYN packet with no ACK flag, half-open scan probe",
        "snort_hint": "flags:S; threshold:type threshold,track by_src,count 20,seconds 1",
        "suricata_hint": "flags:S,12; threshold: type threshold, track by_src, count 20, seconds 1",
    },
    "udp_scan":   {
        "proto": "udp", "port": "any", "category": "Reconnaissance",
        "signature": "UDP packets to multiple ports in rapid succession",
        "snort_hint": "threshold:type threshold,track by_src,count 15,seconds 2",
        "suricata_hint": "threshold: type threshold, track by_src, count 15, seconds 2",
    },
    "xmas_scan":  {
        "proto": "tcp", "port": "any", "category": "Reconnaissance",
        "signature": "TCP packet with FIN+PSH+URG flags set simultaneously (XMAS tree)",
        "snort_hint": "flags:FPU",
        "suricata_hint": "flags:FPU,12",
    },
    "null_scan":  {
        "proto": "tcp", "port": "any", "category": "Reconnaissance",
        "signature": "TCP packet with no flags set (NULL scan)",
        "snort_hint": "flags:0",
        "suricata_hint": "flags:0,12",
    },
    "fin_scan":   {
        "proto": "tcp", "port": "any", "category": "Reconnaissance",
        "signature": "TCP FIN packet without established connection",
        "snort_hint": "flags:F; flow:stateless",
        "suricata_hint": "flags:F,12; flow:stateless",
    },
    "os_fp":      {
        "proto": "tcp", "port": "any", "category": "Reconnaissance",
        "signature": "nmap OS fingerprinting probe: unusual TTL values and TCP option combinations",
        "snort_hint": "itype:8; ttl:100<>200; flags:S",
        "suricata_hint": "ttl:100<>200; flags:S,12",
    },
    "os_detect":  {
        "proto": "tcp", "port": "any", "category": "Reconnaissance",
        "signature": "OS detection via TCP/IP stack fingerprinting, probes with unusual window sizes and options",
        "snort_hint": "flags:S; window:1024; ttl:64",
        "suricata_hint": "flags:S,12; window:1024",
    },
    "banner":     {
        "proto": "tcp", "port": "any", "category": "Reconnaissance",
        "signature": "Connection to service port followed immediately by disconnect (banner grab)",
        "snort_hint": "flow:to_server,established; dsize:0",
        "suricata_hint": "flow:to_server,established; dsize:0",
    },
    "svc_enum":   {
        "proto": "tcp", "port": "any", "category": "Reconnaissance",
        "signature": "nmap NSE script probes to multiple ports and services",
        "snort_hint": "threshold:type threshold,track by_src,count 10,seconds 5",
        "suricata_hint": "threshold: type threshold, track by_src, count 10, seconds 5",
    },
    # ── Fingerprint ──────────────────────────────────────────────────────────
    "hw_info":    {
        "proto": "udp", "port": "161", "category": "Reconnaissance",
        "signature": "SNMP GET/WALK request to enumerate hardware information via MIB OIDs",
        "snort_hint": "content:\"|30|\"; content:\"|02 01 00|\"; depth:10",
        "suricata_hint": "content:\"|30|\"; content:\"|02 01 00|\"; depth:10",
    },
    "sw_versions": {
        "proto": "tcp", "port": "any", "category": "Reconnaissance",
        "signature": "nmap -sV version detection probes sending crafted payloads to identify service versions",
        "snort_hint": "flow:to_server,established; threshold:type threshold,track by_src,count 5,seconds 3",
        "suricata_hint": "flow:to_server,established; threshold: type threshold, track by_src, count 5, seconds 3",
    },
    "smb_enum":   {
        "proto": "tcp", "port": "445", "category": "Reconnaissance",
        "signature": "SMB enumeration: NetServerEnum, SamrEnumDomainUsers, shares listing via IPC$",
        "snort_hint": "flow:to_server,established; content:\"|ff|SMB|\"; offset:4; depth:5",
        "suricata_hint": "flow:to_server,established; content:\"|ff 53 4d 42|\"; offset:4",
    },
    "web_tech":   {
        "proto": "tcp", "port": "80", "category": "Reconnaissance",
        "signature": "HTTP requests to /.git, /wp-admin, /phpinfo.php and technology fingerprinting paths",
        "snort_hint": "flow:to_server,established; content:\"GET\"; http_method; pcre:\"/\\/(wp-admin|\\.git|phpinfo|admin|config)/i\"",
        "suricata_hint": "http.method; content:\"GET\"; http.uri; pcre:\"/\\/(wp-admin|\\.git|phpinfo|admin)/i\"",
    },
    "vuln_scan":  {
        "proto": "tcp", "port": "any", "category": "Reconnaissance",
        "signature": "nmap --script vuln probes including Heartbleed TLS probe and EternalBlue SMB checks",
        "snort_hint": "flow:to_server,established; threshold:type threshold,track by_src,count 20,seconds 10",
        "suricata_hint": "threshold: type threshold, track by_src, count 20, seconds 10",
    },
    # ── Flood / DoS ──────────────────────────────────────────────────────────
    "syn_flood":  {
        "proto": "tcp", "port": "any", "category": "DoS",
        "signature": "High-rate SYN packets from single source exhausting TCP connection table",
        "snort_hint": "flags:S,12; threshold:type threshold,track by_src,count 200,seconds 1",
        "suricata_hint": "flags:S,12; threshold: type threshold, track by_src, count 200, seconds 1",
    },
    "udp_flood":  {
        "proto": "udp", "port": "any", "category": "DoS",
        "signature": "High-rate UDP packets to random ports from single source",
        "snort_hint": "threshold:type threshold,track by_src,count 500,seconds 1",
        "suricata_hint": "threshold: type threshold, track by_src, count 500, seconds 1",
    },
    "icmp_flood": {
        "proto": "icmp", "port": "any", "category": "DoS",
        "signature": "ICMP echo request flood, high rate from single source",
        "snort_hint": "itype:8; threshold:type threshold,track by_src,count 100,seconds 1",
        "suricata_hint": "itype:8; threshold: type threshold, track by_src, count 100, seconds 1",
    },
    "http_flood": {
        "proto": "tcp", "port": "80", "category": "DoS",
        "signature": "HTTP GET flood with high request rate from single source to same URI",
        "snort_hint": "flow:to_server,established; content:\"GET\"; http_method; threshold:type threshold,track by_src,count 100,seconds 5",
        "suricata_hint": "http.method; content:\"GET\"; threshold: type threshold, track by_src, count 100, seconds 5",
    },
    "slowloris":  {
        "proto": "tcp", "port": "80", "category": "DoS",
        "signature": "HTTP connection kept alive with incomplete headers, Slowloris pattern",
        "snort_hint": "flow:to_server,established; content:\"X-a:\"; http_header; threshold:type threshold,track by_src,count 50,seconds 30",
        "suricata_hint": "http.header; content:\"X-a:\"; threshold: type threshold, track by_src, count 50, seconds 30",
    },
    "fragflood":  {
        "proto": "ip",  "port": "any", "category": "DoS",
        "signature": "IP fragmented packets flood, MF flag set at high rate",
        "snort_hint": "fragbits:M; threshold:type threshold,track by_src,count 100,seconds 1",
        "suricata_hint": "fragbits:M; threshold: type threshold, track by_src, count 100, seconds 1",
    },
    # ── Brute Force ──────────────────────────────────────────────────────────
    "ssh_brute":  {
        "proto": "tcp", "port": "22", "category": "BruteForce",
        "signature": "Multiple SSH authentication failures from single source",
        "snort_hint": "flow:to_server,established; content:\"SSH-\"; depth:4; threshold:type threshold,track by_src,count 5,seconds 60",
        "suricata_hint": "flow:to_server,established; content:\"SSH-\"; depth:4; threshold: type threshold, track by_src, count 5, seconds 60",
    },
    "ftp_brute":  {
        "proto": "tcp", "port": "21", "category": "BruteForce",
        "signature": "Multiple FTP PASS commands indicating brute force login attempts",
        "snort_hint": "flow:to_server,established; content:\"PASS \"; threshold:type threshold,track by_src,count 10,seconds 60",
        "suricata_hint": "flow:to_server,established; content:\"PASS \"; threshold: type threshold, track by_src, count 10, seconds 60",
    },
    "http_auth":  {
        "proto": "tcp", "port": "80", "category": "BruteForce",
        "signature": "Repeated HTTP 401 responses indicating HTTP Basic Auth brute force",
        "snort_hint": "flow:to_client,established; content:\"HTTP/1\"; content:\"401\"; within:12; threshold:type threshold,track by_dst,count 10,seconds 60",
        "suricata_hint": "http.stat_code; content:\"401\"; threshold: type threshold, track by_dst, count 10, seconds 60",
    },
    "rdp_brute":  {
        "proto": "tcp", "port": "3389", "category": "BruteForce",
        "signature": "Multiple RDP connection attempts indicating brute force against Terminal Services",
        "snort_hint": "flow:to_server,established; content:\"|03 00|\"; depth:2; threshold:type threshold,track by_src,count 10,seconds 60",
        "suricata_hint": "flow:to_server,established; content:\"|03 00|\"; depth:2; threshold: type threshold, track by_src, count 10, seconds 60",
    },
    "snmp_brute": {
        "proto": "udp", "port": "161", "category": "BruteForce",
        "signature": "Multiple SNMP GET requests with different community strings",
        "snort_hint": "content:\"|30|\"; threshold:type threshold,track by_src,count 20,seconds 10",
        "suricata_hint": "content:\"|30|\"; threshold: type threshold, track by_src, count 20, seconds 10",
    },
    "smb_brute":  {
        "proto": "tcp", "port": "445", "category": "BruteForce",
        "signature": "Multiple SMB authentication failures STATUS_LOGON_FAILURE from single source",
        "snort_hint": "flow:to_client,established; content:\"|c0 00 00 c0|\"; threshold:type threshold,track by_src,count 5,seconds 60",
        "suricata_hint": "flow:to_client,established; content:\"|c0 00 00 c0|\"; threshold: type threshold, track by_src, count 5, seconds 60",
    },
    # ── Protocol ─────────────────────────────────────────────────────────────
    "arp_spoof":  {
        "proto": "arp", "port": "any", "category": "Protocol",
        "signature": "Gratuitous ARP reply with mismatched MAC address (ARP cache poisoning)",
        "snort_hint": "arp:3",
        "suricata_hint": "arp.opcode:2",
    },
    "vlan_hop":   {
        "proto": "udp", "port": "any", "category": "Protocol",
        "signature": "Double-tagged 802.1Q VLAN frames for VLAN hopping attack",
        "snort_hint": "content:\"|81 00|\"; offset:12; depth:2",
        "suricata_hint": "content:\"|81 00|\"; offset:12; depth:2",
    },
    "ipv6_flood": {
        "proto": "ipv6-icmp", "port": "any", "category": "DoS",
        "signature": "IPv6 Neighbor Discovery flood with high rate ICMPv6 type 135",
        "snort_hint": "ip_proto:58; itype:135; threshold:type threshold,track by_src,count 100,seconds 1",
        "suricata_hint": "icmpv6.type:135; threshold: type threshold, track by_src, count 100, seconds 1",
    },
    "frag_attack": {
        "proto": "ip", "port": "any", "category": "Protocol",
        "signature": "Teardrop attack: overlapping IP fragments with negative offset",
        "snort_hint": "fragbits:M+; fragoffset:>0",
        "suricata_hint": "fragbits:M; fragoffset:>0",
    },
    "tcp_reset":  {
        "proto": "tcp", "port": "any", "category": "Protocol",
        "signature": "Forged TCP RST packets injected to terminate established connections",
        "snort_hint": "flags:R; flow:stateless; threshold:type threshold,track by_src,count 20,seconds 1",
        "suricata_hint": "flags:R,12; flow:stateless; threshold: type threshold, track by_src, count 20, seconds 1",
    },
    # ── Web ───────────────────────────────────────────────────────────────────
    "sqli":       {
        "proto": "tcp", "port": "80", "category": "WebAttack",
        "signature": "SQL injection patterns in HTTP URI: quotes, UNION SELECT, OR 1=1, comment sequences",
        "snort_hint": "flow:to_server,established; content:\"GET\"; http_method; pcre:\"/(%27|'|%22|\\\"|UNION.{1,20}SELECT|OR.{1,10}=|--|\\/\\*)/i\"; http_uri",
        "suricata_hint": "http.method; content:\"GET\"; http.uri; pcre:\"/(%27|'|UNION.{1,20}SELECT|OR.{1,10}=)/i\"",
    },
    "xss":        {
        "proto": "tcp", "port": "80", "category": "WebAttack",
        "signature": "XSS payloads in HTTP parameters: script tags, javascript: URI, event handlers",
        "snort_hint": "flow:to_server,established; pcre:\"/<script[^>]*>|javascript:/i\"; http_uri",
        "suricata_hint": "http.uri; pcre:\"/<script[^>]*>|javascript:/i\"",
    },
    "lfi_rfi":    {
        "proto": "tcp", "port": "80", "category": "WebAttack",
        "signature": "LFI path traversal sequences ../etc/passwd and RFI http:// in file parameters",
        "snort_hint": "flow:to_server,established; pcre:\"/(\\.\\.\\/){2,}|etc\\/passwd|http:\\/\\//i\"; http_uri",
        "suricata_hint": "http.uri; pcre:\"/(\\.\\.\\/){2,}|etc\\/passwd/i\"",
    },
    "dir_trav":   {
        "proto": "tcp", "port": "80", "category": "WebAttack",
        "signature": "Directory traversal: encoded ../ sequences %2e%2e%2f and backslash variants",
        "snort_hint": "flow:to_server,established; pcre:\"/(%2e%2e%2f|%2e%2e\\/|\\.\\.\\/)/i\"; http_uri",
        "suricata_hint": "http.uri; pcre:\"/(%2e%2e%2f|\\.\\.\\/)/i\"",
    },
    "ssrf":       {
        "proto": "tcp", "port": "80", "category": "WebAttack",
        "signature": "SSRF probing internal metadata endpoints: 169.254.169.254, localhost, internal IPs in URL params",
        "snort_hint": "flow:to_server,established; content:\"169.254.169.254\"; http_uri",
        "suricata_hint": "http.uri; content:\"169.254.169.254\"",
    },
    "http_smug":  {
        "proto": "tcp", "port": "80", "category": "WebAttack",
        "signature": "HTTP request smuggling: conflicting Content-Length and Transfer-Encoding headers",
        "snort_hint": "flow:to_server,established; content:\"Transfer-Encoding\"; content:\"Content-Length\"; http_header",
        "suricata_hint": "http.header; content:\"Transfer-Encoding\"; content:\"Content-Length\"",
    },
    # ── DNS ───────────────────────────────────────────────────────────────────
    "dns_amplif": {
        "proto": "udp", "port": "53", "category": "DNS",
        "signature": "DNS ANY query to open resolver for amplification attack, large response ratio",
        "snort_hint": "content:\"|00 ff|\"; offset:12; depth:2",
        "suricata_hint": "dns.query.type:255",
    },
    "dns_tunnel": {
        "proto": "udp", "port": "53", "category": "DNS",
        "signature": "DNS TXT/NULL queries with unusually long subdomains for data exfiltration tunnel",
        "snort_hint": "content:\"|00 10|\"; offset:12; depth:2; dsize:>100",
        "suricata_hint": "dns.query.type:16; dsize:>100",
    },
    "dns_poison": {
        "proto": "udp", "port": "53", "category": "DNS",
        "signature": "DNS response with mismatched transaction ID, cache poisoning attempt",
        "snort_hint": "content:\"|81 80|\"; offset:2; depth:2; threshold:type threshold,track by_src,count 20,seconds 1",
        "suricata_hint": "dns.answer.rrname; threshold: type threshold, track by_src, count 20, seconds 1",
    },
}


# ─── Endpoint principal ───────────────────────────────────────────────────────

@router.post("/api/ids/generate")
async def generate_ids_rules(req: RulesRequest):
    vulnerable = [r for r in req.results if r.status in ("PASSED", "PARTIAL")]

    if not vulnerable:
        return JSONResponse(content={
            "rules": [], "total": 0, "target": req.target,
            "summary": "No se encontraron vulnerabilidades activas para generar reglas.",
        })

    modules_info = []
    for r in vulnerable:
        ctx = MODULE_CONTEXT.get(r.module_id)
        if ctx:
            modules_info.append({
                "module_id":    r.module_id,
                "module_name":  r.module_name,
                "risk":         r.risk,
                "status":       r.status,
                "proto":        ctx["proto"],
                "port":         ctx["port"],
                "ids_category": ctx["category"],
                "signature":    ctx["signature"],
                "snort_hint":   ctx.get("snort_hint", ""),
                "suricata_hint":ctx.get("suricata_hint", ""),
            })
        else:
            # Módulo sin contexto: usamos lo que sabemos sin inventar content
            modules_info.append({
                "module_id":    r.module_id,
                "module_name":  r.module_name,
                "risk":         r.risk,
                "status":       r.status,
                "proto":        "tcp",
                "port":         "any",
                "ids_category": r.category or "Reconnaissance",
                "signature":    f"Anomalous activity related to {r.module_name}",
                "snort_hint":   "threshold:type threshold,track by_src,count 10,seconds 5",
                "suricata_hint":"threshold: type threshold, track by_src, count 10, seconds 5",
            })

    rules_data = await _groq_generate_rules(req.groq_key, req.target, modules_info, req.format)
    return JSONResponse(content=rules_data)


# ─── Generación con Groq ──────────────────────────────────────────────────────

async def _groq_generate_rules(api_key: str, target: str, modules: list, fmt: str) -> dict:
    modules_json = json.dumps(modules, ensure_ascii=False, indent=2)

    format_instruction = {
        "snort":    "Genera SOLO reglas Snort 2.x. El campo suricata_rule debe ser null.",
        "suricata": "Genera SOLO reglas Suricata 6+. El campo snort_rule debe ser null.",
        "both":     "Genera ambos formatos. Rellena tanto snort_rule como suricata_rule.",
    }.get(fmt, "Genera ambos formatos.")

    system = """Eres un experto en Snort 2.x y Suricata 6+ generando reglas IDS/IPS de producción.

RESPONDE ÚNICAMENTE con JSON válido, sin markdown, sin bloques ```, sin texto extra.

Estructura exacta requerida:
{
  "rules": [
    {
      "module_id": "string — mismo valor que el module_id recibido",
      "module_name": "string — mismo valor que el module_name recibido",
      "risk": "CRITICAL|HIGH|MEDIUM|LOW — SIEMPRE en inglés, uno de estos 4 valores exactos",
      "ids_category": "string — misma categoría recibida",
      "snort_rule": "regla snort completa en UNA LÍNEA, o null",
      "suricata_rule": "regla suricata completa en UNA LÍNEA, o null",
      "description": "qué detecta esta regla en términos técnicos",
      "false_positive_risk": "bajo|medio|alto",
      "recommendation": "consejo de tuning específico para esta regla"
    }
  ],
  "summary": "resumen de las reglas en 2-3 frases",
  "sid_base": 9000001
}

REGLAS CRÍTICAS — INCUMPLIRLAS INVALIDA LA RESPUESTA:
1. NUNCA uses el module_id como valor de content. Ejemplo PROHIBIDO: content:"os_detect"
2. Usa las firmas técnicas reales del campo "signature" y los hints de "snort_hint"/"suricata_hint"
3. SIDs: empezar en 9000001 e incrementar uno a uno
4. El campo risk SOLO puede ser: CRITICAL, HIGH, MEDIUM o LOW (en inglés, exactamente así)
5. Cada regla en UNA SOLA LÍNEA
6. Usa $HOME_NET y $EXTERNAL_NET como variables de red
7. Prefijo en msg: "NetProbe - "
8. Terminar con sid:XXXXXX; rev:1;"""

    prompt = f"""Target: {target}

Vulnerabilidades a convertir en reglas IDS:
{modules_json}

{format_instruction}

Genera una regla funcional por cada módulo usando las firmas técnicas del campo "signature".
Los hints en "snort_hint" y "suricata_hint" son guías de las opciones a usar."""

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.3-70b-versatile",
                "max_tokens": 4000,
                "temperature": 0.05,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user",   "content": prompt},
                ],
            },
        )

    raw = resp.json()["choices"][0]["message"]["content"].strip()

    # Limpiar markdown si viene envuelto
    if "```" in raw:
        parts = raw.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{"):
                raw = part
                break

    try:
        data = json.loads(raw)
        # Normalizar risk values por si Groq devuelve español
        risk_map = {
            "CRITICO": "CRITICAL", "CRÍTICO": "CRITICAL",
            "ALTO": "HIGH", "MEDIO": "MEDIUM", "BAJO": "LOW",
        }
        for rule in data.get("rules", []):
            r = rule.get("risk", "MEDIUM").upper()
            rule["risk"] = risk_map.get(r, r)
    except json.JSONDecodeError:
        data = _fallback_rules(target, modules)

    data["target"] = target
    data["total"]  = len(data.get("rules", []))
    data["format"] = fmt
    return data


# ─── Fallback sin IA ──────────────────────────────────────────────────────────

def _fallback_rules(target: str, modules: list) -> dict:
    rules = []
    sid = 9000001
    for i, m in enumerate(modules):
        hint = m.get("snort_hint", "threshold:type threshold,track by_src,count 10,seconds 5")
        rules.append({
            "module_id":           m["module_id"],
            "module_name":         m["module_name"],
            "risk":                m["risk"],
            "ids_category":        m["ids_category"],
            "snort_rule":          f'alert {m["proto"]} $EXTERNAL_NET any -> $HOME_NET {m["port"]} (msg:"NetProbe - {m["module_name"]}"; {hint}; sid:{sid + i}; rev:1;)',
            "suricata_rule":       f'alert {m["proto"]} $EXTERNAL_NET any -> $HOME_NET {m["port"]} (msg:"NetProbe - {m["module_name"]}"; {m.get("suricata_hint", hint)}; sid:{sid + i}; rev:1;)',
            "description":         m.get("signature", f"Detecta actividad de {m['module_name']}"),
            "false_positive_risk": "medio",
            "recommendation":      "Ajusta $HOME_NET a tu rango de red interno antes de activar.",
        })
    return {"rules": rules, "summary": f"Se generaron {len(rules)} reglas (modo fallback).", "sid_base": sid}


# ─── Exportar como .rules ─────────────────────────────────────────────────────

@router.post("/api/ids/export")
async def export_rules(payload: dict):
    rules  = payload.get("rules", [])
    fmt    = payload.get("format", "suricata")
    target = payload.get("target", "target")

    lines = [
        f"# NetProbe IDS Rules — {target}",
        f"# Formato: {fmt.upper()}",
        f"# Generado por NetProbe Security Suite",
        "#" + "─" * 60,
        "",
    ]
    for rule in rules:
        lines.append(f"# [{rule.get('risk','?')}] {rule.get('module_name','?')}")
        lines.append(f"# {rule.get('description','')}")
        r = rule.get("snort_rule") if fmt == "snort" else rule.get("suricata_rule")
        if r:
            lines.append(r)
        lines.append("")

    return JSONResponse(content={
        "content":  "\n".join(lines),
        "filename": f"netprobe_{target.replace('.','_')}_{fmt}.rules",
    })


# ─── Registro ─────────────────────────────────────────────────────────────────

def register_ids_routes(app):
    app.include_router(router)
