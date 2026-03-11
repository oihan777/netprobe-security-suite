"""
stride.py — STRIDE Threat Modeling Generator
Genera modelos de amenazas completos usando IA (Groq) para cualquier sistema.
STRIDE: Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege
"""
import httpx
import json
import re
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

# ── STRIDE definitions ────────────────────────────────────────────
STRIDE_META = {
    "S": { "id": "S", "name": "Spoofing",                "color": "#e4692a", "icon": "user-x",
           "desc": "Suplantar identidad de usuarios, servicios o componentes",
           "examples": ["Robo de credenciales", "Session hijacking", "IP spoofing", "DNS spoofing"] },
    "T": { "id": "T", "name": "Tampering",               "color": "#c94040", "icon": "edit",
           "desc": "Modificar datos, código o configuración sin autorización",
           "examples": ["SQL injection", "Man-in-the-middle", "Parameter tampering", "Log manipulation"] },
    "R": { "id": "R", "name": "Repudiation",             "color": "#c8a951", "icon": "eye-off",
           "desc": "Negar haber realizado una acción sin que se pueda probar lo contrario",
           "examples": ["Logs insuficientes", "Transacciones no firmadas", "Falta de auditoría"] },
    "I": { "id": "I", "name": "Information Disclosure",  "color": "#9b59b6", "icon": "file-search",
           "desc": "Exposición de información sensible a partes no autorizadas",
           "examples": ["Error messages verbosos", "Credenciales en código", "APIs sin autenticación"] },
    "D": { "id": "D", "name": "Denial of Service",       "color": "#c94040", "icon": "zap-off",
           "desc": "Degradar o interrumpir la disponibilidad del sistema",
           "examples": ["Flood attacks", "Resource exhaustion", "Deadlocks", "Amplification attacks"] },
    "E": { "id": "E", "name": "Elevation of Privilege",  "color": "#ff6b9d", "icon": "shield-off",
           "desc": "Obtener permisos superiores a los autorizados",
           "examples": ["Privilege escalation", "IDOR", "Path traversal", "Command injection"] },
}

RISK_LEVELS = {
    "CRÍTICO": { "color": "#c94040", "score": 4 },
    "ALTO":    { "color": "#e4692a", "score": 3 },
    "MEDIO":   { "color": "#c8a951", "score": 2 },
    "BAJO":    { "color": "#5ba32b", "score": 1 },
}

# ── Models ────────────────────────────────────────────────────────
class StrideRequest(BaseModel):
    system_name:        str
    system_description: str
    components:         str          # comma-separated list
    trust_boundaries:   Optional[str] = ""
    data_flows:         Optional[str] = ""
    tech_stack:         Optional[str] = ""
    scan_results:       Optional[list] = []
    target:             Optional[str] = ""
    open_ports:         Optional[list] = []
    api_key:            str
    model:              str = "llama-3.3-70b-versatile"

# ── AI Prompt ─────────────────────────────────────────────────────
def build_stride_prompt(req: StrideRequest) -> str:
    components_list = [c.strip() for c in req.components.split(',') if c.strip()]

    # Build exploitation context from scan results
    exploit_ctx = ""
    if req.target:
        exploit_ctx += f"\nTARGET IP/HOST: {req.target}\n"
    if req.open_ports:
        exploit_ctx += f"PUERTOS ABIERTOS DETECTADOS: {', '.join(str(p) for p in req.open_ports)}\n"
    if req.scan_results:
        vulns = [r for r in req.scan_results if r.get("status") in ("VULNERABLE", "PARTIAL")]
        if vulns:
            exploit_ctx += "\nVULNERABILIDADES CONFIRMADAS EN SCANS:\n"
            for v in vulns:
                data = v.get("data", {})
                cmds = v.get("commands", [])
                exploit_ctx += f"  - [{v.get('status')}] {v.get('module_name','?')}: {str(data)[:150]}\n"
                if cmds:
                    exploit_ctx += f"    Comandos usados: {', '.join(cmds[:2])}\n"
        services = [r for r in req.scan_results if r.get("data", {}).get("services") or r.get("data", {}).get("banner")]
        if services:
            exploit_ctx += "\nSERVICIOS/BANNERS DETECTADOS:\n"
            for s in services[:5]:
                d = s.get("data", {})
                svc = d.get("services") or d.get("banner") or ""
                if svc:
                    exploit_ctx += f"  - {s.get('module_name','?')}: {str(svc)[:100]}\n"

    return f"""Eres un experto en pentesting ofensivo y threat modeling. 
Genera un modelo de amenazas STRIDE completo con comandos de explotación REALES y ejecutables.

SISTEMA: {req.system_name}
DESCRIPCIÓN: {req.system_description}
COMPONENTES: {', '.join(components_list)}
{f"STACK TECNOLÓGICO: {req.tech_stack}" if req.tech_stack else ""}
{f"FRONTERAS DE CONFIANZA: {req.trust_boundaries}" if req.trust_boundaries else ""}
{f"FLUJOS DE DATOS: {req.data_flows}" if req.data_flows else ""}
{exploit_ctx}

INSTRUCCIONES CRÍTICAS:
- Para cada amenaza, genera comandos de explotación REALES y concretos usando el target {req.target or "TARGET"} y los puertos/servicios detectados
- Los comandos deben ser ejecutables directamente en Linux (nmap, hydra, sqlmap, curl, netcat, msfconsole, etc.)
- Usa los datos reales del caso: IP del target, puertos abiertos, vulnerabilidades confirmadas
- Si un servicio está confirmado vulnerable, el comando debe apuntar directamente a él
- Marca con "netprobe_executable": true los comandos que se pueden ejecutar directamente en la terminal de NetProbe (nmap, hydra, curl, nikto, sqlmap, netcat, hping3, etc.)
- Marca con "netprobe_executable": false los que requieren setup previo (metasploit, burpsuite, etc.)

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta (sin markdown, sin texto extra):
{{
  "system_summary": "resumen del sistema en 2-3 frases",
  "risk_score": <número 0-100 representando el riesgo global>,
  "total_threats": <número total de amenazas>,
  "components": [
    {{
      "name": "nombre del componente",
      "description": "qué hace este componente",
      "threats": [
        {{
          "stride_category": "S|T|R|I|D|E",
          "title": "título corto de la amenaza",
          "description": "descripción detallada de la amenaza",
          "attack_vector": "cómo se explotaría técnicamente",
          "impact": "qué pasaría si se explota",
          "risk": "CRÍTICO|ALTO|MEDIO|BAJO",
          "mitigations": ["mitigación técnica 1", "mitigación técnica 2"],
          "cvss_estimate": <número 0.0-10.0>,
          "affected_asset": "qué activo está en riesgo",
          "exploit_commands": [
            {{
              "description": "qué hace este comando",
              "command": "comando completo y ejecutable con el target real",
              "tool": "nombre de la herramienta (nmap/hydra/curl/sqlmap/etc)",
              "netprobe_executable": true,
              "notes": "nota breve sobre el resultado esperado o precondiciones"
            }}
          ]
        }}
      ]
    }}
  ],
  "top_risks": [
    {{
      "title": "riesgo principal",
      "component": "componente afectado",
      "stride": "S|T|R|I|D|E",
      "risk": "CRÍTICO|ALTO|MEDIO|BAJO",
      "priority_action": "acción inmediata recomendada"
    }}
  ],
  "security_recommendations": [
    {{
      "category": "categoría",
      "recommendation": "recomendación concreta y técnica",
      "effort": "BAJO|MEDIO|ALTO",
      "impact": "BAJO|MEDIO|ALTO"
    }}
  ]
}}

Sé exhaustivo: 3-5 amenazas por componente. Cada amenaza debe tener 1-2 comandos de explotación reales.

REGLAS CRÍTICAS PARA EL JSON:
1. En los valores de "command", usa SOLO comillas simples para los argumentos shell, NUNCA comillas dobles dentro del valor
2. No uses saltos de línea dentro de ningún string — todo en una sola línea
3. Escapa correctamente cualquier carácter especial
4. El JSON debe ser 100% válido y parseable sin modificaciones"""

# ── Route ─────────────────────────────────────────────────────────
@router.post("/api/stride/analyze")
async def analyze_stride(req: StrideRequest):
    if not req.api_key:
        return {"error": "API key requerida"}
    if not req.system_name or not req.components:
        return {"error": "Nombre del sistema y componentes son obligatorios"}

    prompt = build_stride_prompt(req)

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {req.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": req.model,
                    "messages": [
                        {"role": "system", "content": "Eres un experto en seguridad. Responde SIEMPRE con JSON válido y bien formado. Nunca incluyas texto fuera del objeto JSON. Nunca uses saltos de línea dentro de strings JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": 8192,
                    "temperature": 0.3,
                }
            )
            data = resp.json()
            if resp.status_code != 200:
                return {"error": data.get("error", {}).get("message", "Error API Groq")}

            content = data["choices"][0]["message"]["content"]

            # Robust JSON extraction with aggressive sanitization
            def sanitize_json_string(text):
                """Fix common AI JSON generation issues character by character inside strings."""
                result = []
                in_string = False
                i = 0
                while i < len(text):
                    ch = text[i]
                    if ch == '"'  and (i == 0 or text[i-1] != '\\'):
                        in_string = not in_string
                        result.append(ch)
                    elif in_string:
                        # Inside a string: escape any bare control chars
                        if ch == '\n':
                            result.append('\\n')
                        elif ch == '\r':
                            result.append('\\r')
                        elif ch == '\t':
                            result.append('\\t')
                        else:
                            result.append(ch)
                    else:
                        result.append(ch)
                    i += 1
                return ''.join(result)

            def extract_json(text):
                # 1. Strip markdown fences
                text = re.sub(r'```json', '', text)
                text = re.sub(r'```', '', text)
                text = text.strip()

                # 2. Find outermost { ... } block (in case AI added preamble)
                start = text.find('{')
                if start == -1:
                    raise ValueError("No JSON object found")
                # Find matching end brace by counting depth outside strings
                depth = 0
                end = -1
                in_str = False
                skip = False
                for i, ch in enumerate(text[start:], start):
                    if skip:
                        skip = False
                        continue
                    if ch == '\\':
                        skip = True
                        continue
                    if ch == '"':
                        in_str = not in_str
                    if not in_str:
                        if ch == '{': depth += 1
                        elif ch == '}':
                            depth -= 1
                            if depth == 0:
                                end = i + 1
                                break
                if end == -1:
                    end = len(text)
                candidate = text[start:end]

                # 3. Try direct parse first
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    pass

                # 4. Sanitize: fix bare newlines/tabs inside strings
                candidate = sanitize_json_string(candidate)

                # 5. Remove trailing commas before } or ]
                candidate = re.sub(r',[ \t\r\n]*([}\]])', r'\1', candidate)

                # 6. Try again
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError as e:
                    # 7. Last resort: use json5-style tolerant parse via ast literal_eval on cleaned text
                    # Just raise with context for debugging
                    raise json.JSONDecodeError(
                        f"Fallo tras sanitización: {e.msg}",
                        e.doc, e.pos
                    )

            result = extract_json(content)

            # Enrich with STRIDE metadata
            result["stride_meta"] = STRIDE_META
            result["risk_levels"] = RISK_LEVELS

            # Count by STRIDE category
            stride_counts = {k: 0 for k in STRIDE_META}
            stride_risk   = {k: {"CRÍTICO":0,"ALTO":0,"MEDIO":0,"BAJO":0} for k in STRIDE_META}
            for comp in result.get("components", []):
                for t in comp.get("threats", []):
                    cat = t.get("stride_category","")
                    if cat in stride_counts:
                        stride_counts[cat] += 1
                        risk = t.get("risk","BAJO")
                        if risk in stride_risk[cat]:
                            stride_risk[cat][risk] += 1

            result["stride_counts"] = stride_counts
            result["stride_risk"]   = stride_risk
            return result

    except json.JSONDecodeError as e:
        return {"error": f"Error parseando respuesta IA: {e}"}
    except Exception as e:
        return {"error": str(e)}


@router.get("/api/stride/meta")
def get_stride_meta():
    return {"stride": STRIDE_META, "risk_levels": RISK_LEVELS}


def register_stride_routes(app):
    app.include_router(router)
