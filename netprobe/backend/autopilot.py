"""
NetProbe - Autopilot Engine
AI analyzes recon results and decides which modules to run next.
"""
import json, re, httpx

AUTOPILOT_PROMPT = """Eres el motor de decisión de NetProbe, una suite de pentesting automatizado.
Analiza los resultados de reconocimiento y decide qué módulos ejecutar a continuación.

MÓDULOS DISPONIBLES:
Recon: syn_scan, udp_scan, xmas_scan, null_scan, fin_scan, os_fp, banner, svc_enum
Fingerprint: os_detect, hw_info, sw_versions, smb_enum, web_tech, vuln_scan
Flood/DoS: syn_flood, udp_flood, icmp_flood, http_flood, slowloris, fragflood
Brute Force: ssh_brute, ftp_brute, http_auth, rdp_brute, smb_brute, snmp_brute
Protocol: arp_spoof, vlan_hop, ipv6_flood, frag_attack, tcp_reset
Web Attacks: sqli, xss, lfi_rfi, dir_trav, ssrf, http_smug
DNS: dns_amplif, dns_tunnel, dns_poison, dga_query
Evasion: ttl_manip, decoy_scan, timing_ev, enc_payload, poly_payload
Firewall: policy_chk, acl_bypass, admin_probe, nat_bypass

REGLAS:
- Sin datos previos → empieza con recon básico: syn_scan, banner, svc_enum, os_detect
- Puerto 22 abierto → ssh_brute
- Puerto 80/443 → web_tech, sqli, xss, lfi_rfi, dir_trav
- Puerto 445/139 → smb_enum, smb_brute
- Puerto 3389 → rdp_brute
- Puerto 53 → dns_tunnel, dns_poison
- OS Windows → smb_enum, rdp_brute
- OS Linux → ssh_brute, svc_enum
- Score bajo (<50) → ttl_manip, decoy_scan
- Siempre incluir → vuln_scan, policy_chk

IMPORTANTE: Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin explicaciones fuera del JSON.

Esquema exacto requerido:
{"plan":[{"module":"id","priority":8,"reason":"motivo","intensity":3}],"summary":"frase","risk_level":"HIGH","estimated_duration":"15 minutos"}"""


def _extract_json(text):
    """Extract JSON from model response, handling markdown code blocks."""
    # Try direct parse first
    try:
        return json.loads(text.strip())
    except Exception:
        pass
    # Strip markdown code blocks
    clean = re.sub(r"```(?:json)?\s*", "", text)
    clean = re.sub(r"```\s*$", "", clean)
    try:
        return json.loads(clean.strip())
    except Exception:
        pass
    # Find JSON object in text
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    return None


async def generate_autopilot_plan(recon_results, api_key, model="llama-3.3-70b-versatile"):
    context_parts = []
    already_run   = []

    for r in recon_results:
        data  = r.get("data", {})
        name  = r.get("name", r.get("module", "?"))
        mod   = r.get("module", r.get("id", ""))
        ports = data.get("open_ports", [])
        svcs  = data.get("services", [])
        os_m  = data.get("os_matches", [])

        line = f"- {name}: {r.get('status','?')}"
        if ports: line += f" | Puertos: {','.join(str(p) for p in ports[:10])}"
        if svcs:  line += f" | Servicios: {','.join(svcs[:5])}"
        if os_m:  line += f" | OS: {os_m[0]}"
        context_parts.append(line)
        if mod:
            already_run.append(mod)

    context_str = "\n".join(context_parts) if context_parts else "Sin resultados previos — target no escaneado todavía"

    user_msg = (
        f"Resultados actuales:\n{context_str}\n\n"
        f"Módulos ya ejecutados: {', '.join(already_run) if already_run else 'ninguno'}\n\n"
        "Genera el plan de ataque. Responde SOLO con el JSON, sin texto adicional."
    )

    messages = [
        {"role": "system", "content": AUTOPILOT_PROMPT},
        {"role": "user",   "content": user_msg},
    ]

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "max_tokens": 1000, "temperature": 0.3},
            )
            if resp.status_code != 200:
                err = resp.text[:300]
                return {"error": f"Groq API error {resp.status_code}: {err}", "plan": [], "summary": "Error"}

            data = resp.json()
            if "error" in data:
                return {"error": data["error"].get("message", str(data["error"])), "plan": [], "summary": "Error"}

            raw  = data["choices"][0]["message"]["content"]
            plan = _extract_json(raw)

            if not plan:
                return {"error": f"No se pudo parsear JSON. Respuesta: {raw[:200]}", "plan": [], "summary": "Error"}

            # Validate structure
            if "plan" not in plan:
                plan = {"plan": plan if isinstance(plan, list) else [], "summary": "Plan generado", "risk_level": "MEDIUM", "estimated_duration": "?"}

            return plan

    except httpx.ConnectError:
        return {"error": "No se puede conectar a Groq API. Verifica tu conexión.", "plan": [], "summary": "Error"}
    except Exception as e:
        return {"error": f"{type(e).__name__}: {str(e)}", "plan": [], "summary": "Error"}


def register_autopilot_routes(app):
    from pydantic import BaseModel

    class AutopilotRequest(BaseModel):
        results:   list = []
        api_key:   str  = ""
        model:     str  = "llama-3.3-70b-versatile"
        intensity: int  = 3

    @app.post("/api/autopilot/plan")
    async def autopilot_plan(req: AutopilotRequest):
        if not req.api_key:
            return {"error": "API key de Groq requerida para Autopilot"}
        plan = await generate_autopilot_plan(req.results, req.api_key, req.model)
        return plan
