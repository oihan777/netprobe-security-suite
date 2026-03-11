"""
NetProbe - Log Analyzer
Análisis forense de logs con IA: Apache, Nginx, Windows Events, auth.log, syslog
"""
import re, json
from datetime import datetime
from collections import defaultdict, Counter
from typing import Optional, List, Dict, Tuple

# ── Parsers ────────────────────────────────────────────────────────
APACHE_RE = re.compile(
    r'(?P<ip>\S+)\s+\S+\s+\S+\s+\[(?P<time>[^\]]+)\]\s+"(?P<method>\S+)\s+(?P<path>\S+)\s+\S+"\s+(?P<status>\d+)\s+(?P<size>\S+)(?:\s+"(?P<referer>[^"]*)"\s+"(?P<agent>[^"]*)")?'
)
SYSLOG_RE = re.compile(
    r'(?P<month>\w+)\s+(?P<day>\d+)\s+(?P<time>\d+:\d+:\d+)\s+(?P<host>\S+)\s+(?P<process>[^:]+):\s+(?P<message>.+)'
)
AUTH_RE = re.compile(
    r'(?P<month>\w+)\s+(?P<day>\d+)\s+(?P<time>\d+:\d+:\d+)\s+(?P<host>\S+)\s+(?P<process>[^:]+):\s+(?P<message>.+)'
)

# Known attack patterns
ATTACK_PATTERNS = [
    { "name": "Directory Traversal",  "regex": r"\.\./|%2e%2e%2f|%252e|\.\.\\", "severity": "HIGH"     },
    { "name": "SQL Injection",        "regex": r"union\s+select|or\s+1=1|'--|\bselect\b.*\bfrom\b|information_schema|%27|exec\s*\(", "severity": "CRITICAL" },
    { "name": "XSS",                  "regex": r"<script|javascript:|onerror=|onload=|alert\(|%3cscript|eval\(", "severity": "HIGH"     },
    { "name": "LFI/RFI",             "regex": r"/etc/passwd|/etc/shadow|/proc/self|php://|expect://|data://", "severity": "CRITICAL" },
    { "name": "Command Injection",    "regex": r";\s*(ls|cat|id|whoami|uname|wget|curl)\b|&&|\|\|.*\bsh\b|\$\(", "severity": "CRITICAL" },
    { "name": "Scanner/Recon",        "regex": r"nikto|sqlmap|nmap|masscan|dirsearch|gobuster|nuclei|acunetix|burp|zap", "severity": "MEDIUM"   },
    { "name": "Brute Force",          "regex": r"password|passwd|login|auth.*fail|invalid.*user|authentication fail", "severity": "HIGH"     },
    { "name": "Shell Upload",         "regex": r"\.(php|phtml|php5|phar|jsp|asp|aspx)\?|webshell|c99|r57", "severity": "CRITICAL" },
    { "name": "Sensitive Files",      "regex": r"\.env|\.git/|\.htaccess|wp-config|database\.yml|config\.php|backup", "severity": "HIGH"     },
    { "name": "SSRF",                 "regex": r"169\.254\.169\.254|metadata\.google|localhost|127\.0\.0|::1", "severity": "HIGH"     },
    { "name": "XXE",                  "regex": r"<!ENTITY|SYSTEM\s+['\"]|file:///", "severity": "HIGH"     },
    { "name": "HTTP Smuggling",       "regex": r"Transfer-Encoding:.*chunked.*Content-Length|Content-Length.*Transfer-Encoding", "severity": "HIGH" },
]

def detect_attacks(line: str) -> list:
    """Busca patrones de ataque en una línea"""
    found = []
    line_lower = line.lower()
    for p in ATTACK_PATTERNS:
        if re.search(p["regex"], line_lower, re.IGNORECASE):
            found.append({"name": p["name"], "severity": p["severity"]})
    return found

def parse_apache_line(line: str) -> Optional[dict]:
    m = APACHE_RE.match(line)
    if not m: return None
    return {
        "type":    "apache",
        "ip":      m.group("ip"),
        "time":    m.group("time"),
        "method":  m.group("method"),
        "path":    m.group("path"),
        "status":  int(m.group("status")),
        "size":    m.group("size"),
        "agent":   m.group("agent") if m.lastindex and m.lastindex >= 8 else "",
        "raw":     line,
    }

def parse_auth_line(line: str) -> Optional[dict]:
    m = AUTH_RE.match(line)
    if not m: return None
    return {
        "type":    "auth",
        "time":    f"{m.group('month')} {m.group('day')} {m.group('time')}",
        "host":    m.group("host"),
        "process": m.group("process").strip(),
        "message": m.group("message").strip(),
        "raw":     line,
    }

def auto_detect_format(lines: list) -> str:
    sample = "\n".join(lines[:20])
    if re.search(r'\[\d{2}/\w+/\d{4}:\d{2}:\d{2}:\d{2}', sample): return "apache"
    if re.search(r'sshd|sudo|PAM|su\[', sample): return "auth"
    if re.search(r'EventID|EvtID|<Event', sample): return "windows"
    if re.search(r'kern\.|daemon\.|syslog', sample): return "syslog"
    return "generic"

def analyze_logs(content: str, format_hint: str = "auto") -> dict:
    """Análisis estático de logs sin IA"""
    lines = content.strip().split("\n")
    fmt   = format_hint if format_hint != "auto" else auto_detect_format(lines)

    events         = []
    attacks        = []
    ips            = Counter()
    status_codes   = Counter()
    paths          = Counter()
    timeline       = defaultdict(int)
    brute_force_ips= defaultdict(int)
    error_lines    = []

    for i, line in enumerate(lines):
        if not line.strip(): continue
        attacks_in_line = detect_attacks(line)

        if fmt == "apache":
            parsed = parse_apache_line(line)
            if parsed:
                ips[parsed["ip"]] += 1
                status_codes[parsed["status"]] += 1
                paths[parsed["path"]] += 1
                # Extract hour for timeline
                try:
                    hour = parsed["time"].split(":")[1][:2]  # HH from dd/Mon/YYYY:HH
                    timeline[hour] += 1
                except: pass
                if parsed["status"] >= 400:
                    error_lines.append({"line_no": i+1, **parsed})
                parsed["attacks"] = attacks_in_line
                if attacks_in_line: attacks.append({"line_no": i+1, **parsed})
                events.append(parsed)
            else:
                if attacks_in_line:
                    attacks.append({"line_no": i+1, "raw": line, "attacks": attacks_in_line})

        elif fmt in ("auth", "syslog"):
            parsed = parse_auth_line(line)
            msg    = (parsed["message"] if parsed else line).lower()
            if "failed" in msg or "invalid" in msg or "failure" in msg:
                ip_match = re.search(r'from (\d+\.\d+\.\d+\.\d+)', line)
                if ip_match:
                    brute_force_ips[ip_match.group(1)] += 1
            if attacks_in_line:
                attacks.append({"line_no": i+1, "raw": line, "attacks": attacks_in_line})
            if parsed: events.append(parsed)

        else:  # generic
            if attacks_in_line:
                attacks.append({"line_no": i+1, "raw": line, "attacks": attacks_in_line})

    # Top attackers
    brute_candidates = [(ip, cnt) for ip, cnt in brute_force_ips.items() if cnt >= 5]
    brute_candidates.sort(key=lambda x: -x[1])

    # Attack summary by type
    attack_types = Counter()
    attack_severity = Counter()
    for ev in attacks:
        for a in ev.get("attacks", []):
            attack_types[a["name"]] += 1
            attack_severity[a["severity"]] += 1

    return {
        "format":          fmt,
        "total_lines":     len(lines),
        "total_events":    len(events),
        "total_attacks":   len(attacks),
        "attacks":         attacks[:100],  # cap
        "attack_types":    dict(attack_types.most_common(10)),
        "attack_severity": dict(attack_severity),
        "top_ips":         ips.most_common(15),
        "status_codes":    dict(status_codes),
        "top_paths":       paths.most_common(15),
        "timeline":        dict(sorted(timeline.items())),
        "brute_force_ips": brute_candidates[:10],
        "error_count":     len(error_lines),
        "error_lines":     error_lines[:20],
    }

# ── AI Analysis ────────────────────────────────────────────────────
LOG_AI_PROMPT = """Eres un experto en análisis forense de logs y ciberseguridad.
Recibirás un resumen estadístico de logs y una muestra de las líneas más sospechosas.

Proporciona:
1. Un análisis ejecutivo de lo que pasó (2-3 párrafos)
2. Los eventos más críticos con timestamp si está disponible
3. IPs más sospechosas con razonamiento
4. Línea de tiempo del ataque si es posible reconstruirla
5. Recomendaciones de respuesta inmediata

RESPONDE EN ESPAÑOL. Sé técnico y concreto. Usa markdown."""

async def ai_analyze_logs(stats: dict, sample_attacks: list, api_key: str, model: str = "llama-3.3-70b-versatile") -> str:
    if not api_key:
        return "⚠ API key de Groq requerida para análisis IA. El análisis estático está disponible en las métricas."

    import httpx
    context = f"""ESTADÍSTICAS DEL LOG:
- Formato detectado: {stats.get('format', '?')}
- Total líneas: {stats.get('total_lines', 0)}
- Eventos parseados: {stats.get('total_events', 0)}
- Ataques detectados: {stats.get('total_attacks', 0)}
- Tipos de ataque: {json.dumps(stats.get('attack_types', {}), ensure_ascii=False)}
- Severidad: {json.dumps(stats.get('attack_severity', {}), ensure_ascii=False)}
- Top IPs: {json.dumps(stats.get('top_ips', [])[:8], ensure_ascii=False)}
- Códigos HTTP: {json.dumps(stats.get('status_codes', {}), ensure_ascii=False)}
- Intentos brute force: {json.dumps(stats.get('brute_force_ips', [])[:5], ensure_ascii=False)}
- Top paths solicitados: {json.dumps(stats.get('top_paths', [])[:8], ensure_ascii=False)}

MUESTRA DE LÍNEAS SOSPECHOSAS (máx 20):
"""
    for ev in sample_attacks[:20]:
        context += f"\n[L{ev.get('line_no','?')}] {ev.get('raw','')[:200]}"
        for a in ev.get("attacks", []):
            context += f"\n  → [{a['severity']}] {a['name']}"

    try:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model, "stream": False, "max_tokens": 2048, "temperature": 0.3,
            "messages": [
                {"role": "system", "content": LOG_AI_PROMPT},
                {"role": "user",   "content": context},
            ],
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post("https://api.groq.com/openai/v1/chat/completions",
                                     headers=headers, json=payload)
            if resp.status_code != 200:
                return f"Error Groq ({resp.status_code}): {resp.text[:200]}"
            return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        return f"Error: {str(e)}"

# ── FastAPI routes ─────────────────────────────────────────────────
def register_log_routes(app):
    from fastapi import UploadFile, File, Form
    from pydantic import BaseModel
    from typing import Optional

    class LogAnalyzeRequest(BaseModel):
        content:    str
        format:     Optional[str] = "auto"
        api_key:    Optional[str] = ""
        model:      Optional[str] = "llama-3.3-70b-versatile"
        ai_analyze: Optional[bool] = True

    @app.post("/api/logs/analyze")
    async def analyze(req: LogAnalyzeRequest):
        stats = analyze_logs(req.content, req.format or "auto")
        ai    = ""
        if req.ai_analyze and req.api_key:
            ai = await ai_analyze_logs(stats, stats.get("attacks",[]), req.api_key, req.model or "llama-3.3-70b-versatile")
        return {"stats": stats, "ai_analysis": ai, "timestamp": datetime.now().isoformat()}

    @app.post("/api/logs/static")
    async def static_only(req: LogAnalyzeRequest):
        stats = analyze_logs(req.content, req.format or "auto")
        return {"stats": stats, "timestamp": datetime.now().isoformat()}
