"""
NetProbe - Smart Score Engine
Sistema de puntuación inteligente en dos capas:
  1. Score ponderado por riesgo (rápido, sin API)
  2. Ajuste contextual por IA Groq (análisis profundo)
"""
import json
from datetime import datetime

# ── Pesos por nivel de riesgo ─────────────────────────────────────
RISK_WEIGHTS = {
    "CRITICAL": 4.0,
    "HIGH":     3.0,
    "MEDIUM":   2.0,
    "LOW":      1.0,
}

# Score base por estado
STATUS_SCORES = {
    "BLOCKED":  100,
    "DETECTED":  60,
    "PARTIAL":   35,
    "PASSED":     0,
    "ERROR":   None,
}

# Módulos con riesgo conocido (sincronizado con frontend/src/data/modules.js)
MODULE_RISK = {
    # Recon
    "syn_scan":    "LOW",    "udp_scan":    "MEDIUM", "xmas_scan":  "MEDIUM",
    "null_scan":   "LOW",    "fin_scan":    "LOW",    "os_fp":      "MEDIUM",
    "banner":      "LOW",    "svc_enum":    "LOW",
    # Fingerprint
    "os_detect":   "LOW",    "hw_info":     "LOW",    "sw_versions":"LOW",
    "smb_enum":    "MEDIUM", "web_tech":    "LOW",    "vuln_scan":  "HIGH",
    # Flood
    "syn_flood":   "CRITICAL","udp_flood":  "CRITICAL","icmp_flood": "HIGH",
    "http_flood":  "CRITICAL","slowloris":  "HIGH",   "fragflood":  "CRITICAL",
    # Brute force
    "ssh_brute":   "HIGH",   "ftp_brute":  "HIGH",   "http_auth":  "HIGH",
    "rdp_brute":   "HIGH",   "snmp_brute": "MEDIUM",  "smb_brute":  "HIGH",
    # Protocol
    "arp_spoof":   "CRITICAL","vlan_hop":   "HIGH",   "ipv6_flood": "HIGH",
    "frag_attack": "CRITICAL","tcp_reset":  "HIGH",
    # Web
    "sqli":        "CRITICAL","xss":        "HIGH",   "lfi_rfi":    "CRITICAL",
    "dir_trav":    "HIGH",   "ssrf":        "HIGH",   "http_smug":  "CRITICAL",
    # DNS
    "dns_amplif":  "CRITICAL","dns_tunnel": "HIGH",   "dns_poison": "CRITICAL",
    "dga_query":   "MEDIUM",
    # Evasion
    "ttl_manip":   "MEDIUM", "decoy_scan": "MEDIUM",  "timing_ev":  "LOW",
    "enc_payload": "HIGH",   "poly_payload":"HIGH",
    # Firewall
    "policy_chk":  "LOW",    "acl_bypass": "HIGH",   "admin_probe":"MEDIUM",
    "nat_bypass":  "HIGH",
}

# Combos peligrosos que merecen penalización extra
DANGEROUS_COMBOS = [
    {
        "modules": ["sqli", "xss"],
        "penalty": 10,
        "reason": "SQLi + XSS simultáneos indican aplicación web sin sanitización de inputs",
    },
    {
        "modules": ["sqli", "lfi_rfi"],
        "penalty": 12,
        "reason": "SQLi + LFI/RFI — riesgo de exfiltración de datos y acceso al sistema de archivos",
    },
    {
        "modules": ["ssh_brute", "rdp_brute"],
        "penalty": 8,
        "reason": "Múltiples servicios de acceso remoto sin protección anti-brute force",
    },
    {
        "modules": ["syn_flood", "http_flood"],
        "penalty": 10,
        "reason": "Múltiples vectores DoS efectivos — sistema sin protección de disponibilidad",
    },
    {
        "modules": ["arp_spoof", "dns_poison"],
        "penalty": 15,
        "reason": "ARP spoofing + DNS poisoning — red completamente interceptable (MitM total)",
    },
    {
        "modules": ["acl_bypass", "nat_bypass"],
        "penalty": 12,
        "reason": "Bypasses de ACL y NAT — la arquitectura de seguridad perimetral está comprometida",
    },
    {
        "modules": ["smb_enum", "smb_brute"],
        "penalty": 10,
        "reason": "SMB enumerable y con fuerza bruta exitosa — riesgo de movimiento lateral en red Windows",
    },
]

# ── Capa 1: Score ponderado por riesgo ────────────────────────────
def calculate_weighted_score(results: list) -> dict:
    """
    Score ponderado: módulos CRITICAL pesan 4x más que LOW.
    Devuelve score + breakdown por módulo.
    """
    total_weight   = 0.0
    weighted_sum   = 0.0
    breakdown      = []
    vulnerable_critical = []

    for r in results:
        status = r.get("status", "ERROR")
        score  = STATUS_SCORES.get(status)
        if score is None:
            continue

        module_id = r.get("module") or r.get("id") or r.get("module_id", "")
        risk      = MODULE_RISK.get(module_id, r.get("risk", "MEDIUM"))
        weight    = RISK_WEIGHTS.get(risk, 2.0)

        weighted_sum += weight * score
        total_weight += weight * 100  # max posible

        breakdown.append({
            "module":    module_id,
            "name":      r.get("name") or r.get("module_name", module_id),
            "status":    status,
            "risk":      risk,
            "weight":    weight,
            "score":     score,
            "contribution": round((weight * score) / max(total_weight, 1) * 100, 1),
        })

        if status in ("PASSED", "PARTIAL") and risk in ("CRITICAL", "HIGH"):
            vulnerable_critical.append(module_id)

    if total_weight == 0:
        return {"score": 0, "breakdown": [], "vulnerable_critical": []}

    base_score = round(weighted_sum / total_weight * 100)

    # Penalización por combos peligrosos
    passed_modules = {r.get("module") or r.get("id") or r.get("module_id","")
                      for r in results if r.get("status") in ("PASSED", "PARTIAL")}
    combo_penalties = []
    for combo in DANGEROUS_COMBOS:
        if all(m in passed_modules for m in combo["modules"]):
            combo_penalties.append({
                "modules": combo["modules"],
                "penalty": combo["penalty"],
                "reason":  combo["reason"],
            })
            base_score = max(0, base_score - combo["penalty"])

    return {
        "score":              base_score,
        "breakdown":          sorted(breakdown, key=lambda x: x["weight"], reverse=True),
        "vulnerable_critical": vulnerable_critical,
        "combo_penalties":    combo_penalties,
        "method":             "weighted",
    }

# ── Capa 2: Ajuste contextual por IA ─────────────────────────────
AI_SCORE_PROMPT = """Eres un experto en ciberseguridad evaluando resultados de un pentest automatizado.

Recibirás:
- Score ponderado calculado matemáticamente
- Lista de módulos ejecutados con sus resultados
- Módulos críticos/altos que fallaron
- Combos peligrosos detectados

Tu tarea: Analiza el CONTEXTO COMPLETO y devuelve un JSON con el score final ajustado.

Considera:
1. ¿Falló algún módulo CRÍTICO? Penaliza fuerte (hasta -15 por módulo)
2. ¿Hay módulos que se refuerzan mutuamente en severidad?
3. ¿El perfil de módulos ejecutados cubre los vectores más relevantes?
4. ¿Hay señales de una postura de seguridad coherente o parches parciales?
5. Si solo hay módulos de reconocimiento bloqueados, el score no debería ser muy alto

RESPONDE ÚNICAMENTE CON ESTE JSON (sin markdown, sin explicación):
{
  "adjusted_score": <0-100>,
  "adjustment": <diferencia respecto al score ponderado, puede ser negativa>,
  "confidence": <"alta"|"media"|"baja">,
  "key_finding": "<hallazgo más crítico en 1 frase>",
  "risk_factors": ["factor1", "factor2", "factor3"],
  "strengths": ["fortaleza1", "fortaleza2"],
  "reasoning": "<explicación del ajuste en 2-3 frases>"
}"""

async def calculate_ai_score(results: list, weighted: dict, api_key: str, target: str = "") -> dict:
    """
    Usa Groq para ajustar el score ponderado según contexto.
    Si no hay API key, devuelve el score ponderado con análisis de reglas.
    """
    if not api_key:
        return _rule_based_analysis(results, weighted)

    # Construir resumen para la IA
    summary_lines = [
        f"Target: {target or 'N/A'}",
        f"Score ponderado por riesgo: {weighted['score']}/100",
        f"Módulos ejecutados: {len(results)}",
        "",
        "RESULTADOS POR MÓDULO:",
    ]
    for r in results:
        module_id = r.get("module") or r.get("id") or r.get("module_id", "")
        risk      = MODULE_RISK.get(module_id, "MEDIUM")
        summary_lines.append(
            f"  [{risk}] {r.get('name', module_id)}: {r.get('status')} (score: {r.get('score')})"
        )

    if weighted["vulnerable_critical"]:
        summary_lines.append(f"\nMÓDULOS CRÍTICOS/ALTOS FALLIDOS: {', '.join(weighted['vulnerable_critical'])}")

    if weighted["combo_penalties"]:
        summary_lines.append("\nCOMBOS PELIGROSOS DETECTADOS:")
        for c in weighted["combo_penalties"]:
            summary_lines.append(f"  - {', '.join(c['modules'])}: {c['reason']} (penalización: -{c['penalty']})")

    context = "\n".join(summary_lines)

    import httpx
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": AI_SCORE_PROMPT},
            {"role": "user",   "content": context},
        ],
        "stream":      False,
        "max_tokens":  512,
        "temperature": 0.2,  # Baja temperatura para consistencia numérica
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers, json=payload
            )
            if resp.status_code != 200:
                return _rule_based_analysis(results, weighted)

            content = resp.json()["choices"][0]["message"]["content"].strip()
            # Strip possible markdown fences
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            ai_data = json.loads(content)

            # Clamp score to 0-100
            ai_data["adjusted_score"] = max(0, min(100, int(ai_data.get("adjusted_score", weighted["score"]))))
            ai_data["weighted_score"] = weighted["score"]
            ai_data["breakdown"]      = weighted["breakdown"]
            ai_data["combo_penalties"]= weighted["combo_penalties"]
            ai_data["method"]         = "ai"
            return ai_data

    except Exception as e:
        # Fallback to rule-based
        fb = _rule_based_analysis(results, weighted)
        fb["ai_error"] = str(e)
        return fb

def _rule_based_analysis(results: list, weighted: dict) -> dict:
    """Análisis por reglas cuando no hay API key disponible."""
    score    = weighted["score"]
    factors  = []
    strengths= []

    passed = [r for r in results if r.get("status") == "PASSED"]
    blocked = [r for r in results if r.get("status") == "BLOCKED"]
    partial = [r for r in results if r.get("status") == "PARTIAL"]

    if weighted["vulnerable_critical"]:
        factors.append(f"{len(weighted['vulnerable_critical'])} módulo(s) crítico/alto sin defensa")
    if weighted["combo_penalties"]:
        factors.append(f"{len(weighted['combo_penalties'])} combinación(es) peligrosa(s) detectada(s)")
    if len(passed) > len(results) * 0.5:
        factors.append("Más del 50% de módulos sin defensa efectiva")
    if blocked:
        strengths.append(f"{len(blocked)} módulo(s) bloqueados correctamente")
    if not passed and not partial:
        strengths.append("Ningún módulo logró comprometer el sistema")

    key_finding = "Sin hallazgos críticos"
    if weighted["combo_penalties"]:
        key_finding = weighted["combo_penalties"][0]["reason"]
    elif weighted["vulnerable_critical"]:
        key_finding = f"Módulos críticos sin defensa: {', '.join(weighted['vulnerable_critical'][:2])}"

    return {
        "adjusted_score":  score,
        "weighted_score":  score,
        "adjustment":      0,
        "confidence":      "media",
        "key_finding":     key_finding,
        "risk_factors":    factors,
        "strengths":       strengths,
        "reasoning":       "Score calculado por ponderación de riesgo (sin ajuste IA — API key no disponible)",
        "breakdown":       weighted["breakdown"],
        "combo_penalties": weighted["combo_penalties"],
        "method":          "rules",
    }

# ── Función principal ─────────────────────────────────────────────
async def smart_score(results: list, api_key: str = "", target: str = "") -> dict:
    """
    Calcula el score inteligente completo.
    Devuelve score final + análisis completo.
    """
    weighted = calculate_weighted_score(results)
    analysis = await calculate_ai_score(results, weighted, api_key, target)
    analysis["timestamp"] = datetime.now().isoformat()
    return analysis

# ── FastAPI routes ────────────────────────────────────────────────
def register_smart_score_routes(app):
    from pydantic import BaseModel
    from typing import Optional

    class SmartScoreRequest(BaseModel):
        results:  list
        api_key:  Optional[str] = ""
        target:   Optional[str] = ""

    @app.post("/api/score/smart")
    async def compute_smart_score(req: SmartScoreRequest):
        return await smart_score(req.results, req.api_key or "", req.target or "")

    @app.post("/api/score/weighted")
    async def compute_weighted(req: SmartScoreRequest):
        return calculate_weighted_score(req.results)
