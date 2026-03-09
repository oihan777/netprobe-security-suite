"""
NetProbe Security Suite - AI Engine
Backend: Groq API (llama-3.3-70b-versatile) con streaming real
"""
import json
import asyncio
from datetime import datetime

SYSTEM_PROMPT = """Eres un experto en ciberseguridad y pentesting senior con más de 15 años de experiencia. Analizas resultados REALES de herramientas como nmap, hping3, hydra, scapy, sqlmap y XSStrike ejecutadas en redes locales autorizadas.

TUS ESPECIALIDADES:
- Análisis de vulnerabilidades de red y sistemas
- Evaluación de configuraciones de firewall (Fortinet FortiOS, pfSense, iptables)
- Detección y evasión de IDS/IPS (Suricata, Snort, Zeek)
- Hardening de sistemas Linux/Windows
- Explotación controlada y post-explotación
- Redacción de informes ejecutivos y técnicos

INSTRUCCIONES:
1. Responde SIEMPRE en español
2. Sé técnico, concreto y orientado a soluciones
3. Usa markdown: negritas, listas, bloques de código
4. Proporciona recomendaciones con prioridad (CRÍTICA / ALTA / MEDIA / BAJA)
5. Referencia CVEs específicos cuando sea relevante
6. Incluye comandos exactos en bloques de código"""

QUICK_PROMPTS = [
    {"id": "vectors",  "label": "Vectores sin cubrir",      "prompt": "Qué vectores de ataque no fueron probados? Sugiere pruebas adicionales específicas."},
    {"id": "critical", "label": "Vulnerabilidades críticas", "prompt": "Lista y explica las vulnerabilidades críticas. Cuál debería remediarse primero?"},
    {"id": "improve",  "label": "Plan de mejora",            "prompt": "Crea un plan de mejora detallado con acciones priorizadas y timeline."},
    {"id": "suricata", "label": "Reglas Suricata",           "prompt": "Qué reglas de Suricata habría que añadir para detectar los ataques que pasaron?"},
    {"id": "partial",  "label": "Analizar PARTIAL",          "prompt": "Explica los resultados PARTIAL. Por qué la mitigación es incompleta y cómo corregirlo?"},
    {"id": "fortinet", "label": "Config Fortinet",           "prompt": "Dame configuraciones específicas de FortiOS para remediar los hallazgos encontrados."},
    {"id": "report",   "label": "Informe ejecutivo",         "prompt": "Genera un informe ejecutivo completo en markdown con resumen, hallazgos, análisis y plan de remediación."},
    {"id": "compare",  "label": "Baseline CIS",              "prompt": "Compara estos resultados con CIS Benchmarks. Qué controles fallan?"},
]

GROQ_MODELS = [
    {"id": "llama-3.3-70b-versatile",                    "label": "Llama 3.3 70B (recomendado)"},
    {"id": "meta-llama/llama-4-maverick-17b-128e-instruct","label": "Llama 4 Maverick 17B"},
    {"id": "meta-llama/llama-4-scout-17b-16e-instruct",   "label": "Llama 4 Scout 17B"},
    {"id": "moonshotai/kimi-k2-instruct",                 "label": "Kimi K2"},
    {"id": "qwen/qwen3-32b",                              "label": "Qwen3 32B"},
    {"id": "openai/gpt-oss-120b",                         "label": "GPT-OSS 120B"},
    {"id": "openai/gpt-oss-20b",                          "label": "GPT-OSS 20B"},
    {"id": "groq/compound",                               "label": "Groq Compound"},
    {"id": "llama-3.1-8b-instant",                        "label": "Llama 3.1 8B (rápido)"},
]


def build_context(scan_context):
    parts = []
    if scan_context.get("target"):
        parts.append(f"Target: {scan_context['target']}")
    if scan_context.get("score") is not None:
        parts.append(f"Score de seguridad: {scan_context['score']}/100")
    if scan_context.get("results"):
        results = scan_context["results"]
        passed   = [r for r in results if r.get("status") == "PASSED"]
        blocked  = [r for r in results if r.get("status") == "BLOCKED"]
        partial  = [r for r in results if r.get("status") == "PARTIAL"]
        detected = [r for r in results if r.get("status") == "DETECTED"]
        parts.append(f"\nResultados ({len(results)} módulos ejecutados):")
        if passed:
            parts.append(f"VULNERABLES ({len(passed)}): " + ", ".join(r.get("module_id","") for r in passed))
        if partial:
            parts.append(f"PARCIAL ({len(partial)}): " + ", ".join(r.get("module_id","") for r in partial))
        if detected:
            parts.append(f"DETECTADOS ({len(detected)}): " + ", ".join(r.get("module_id","") for r in detected))
        if blocked:
            parts.append(f"BLOQUEADOS ({len(blocked)}): " + ", ".join(r.get("module_id","") for r in blocked))
        for r in (passed + partial)[:8]:
            parts.append(f"- {r.get('module_id')} -> {r.get('status')} | {json.dumps(r.get('data',{}), ensure_ascii=False)[:150]}")
    if not parts:
        parts.append("No hay resultados de escaneo disponibles aún.")
    return "\n".join(parts)


async def groq_stream(messages, api_key, model):
    import httpx
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "max_tokens": 4096,
        "temperature": 0.7,
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
            ) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    try:
                        err = json.loads(body).get("error", {}).get("message", body.decode()[:200])
                    except Exception:
                        err = body.decode("utf-8", errors="ignore")[:200]
                    yield f"\n\nError Groq API ({resp.status_code}): {err}"
                    return
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield delta
                    except Exception:
                        continue
    except Exception as e:
        yield f"\n\nError de conexión: {str(e)}"


async def groq_complete(messages, api_key, model):
    import httpx
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "max_tokens": 8192,
        "temperature": 0.7,
    }
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers, json=payload
            )
            data = resp.json()
            if resp.status_code != 200:
                return f"Error ({resp.status_code}): {data.get('error',{}).get('message', str(data))}"
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        return f"Error: {str(e)}"


def register_ai_routes(app):
    from fastapi import WebSocket, WebSocketDisconnect
    from fastapi.responses import JSONResponse
    from pydantic import BaseModel

    class ChatRequest(BaseModel):
        message: str
        api_key: str
        model: str = "llama-3.3-70b-versatile"
        scan_context: dict = {}
        history: list = []

    class ValidateRequest(BaseModel):
        api_key: str

    @app.get("/api/ai/models")
    async def get_models():
        return {"models": GROQ_MODELS, "provider": "groq"}

    @app.get("/api/ai/quick-prompts")
    async def get_quick_prompts():
        return {"prompts": QUICK_PROMPTS}

    @app.post("/api/ai/validate")
    async def validate_key(req: ValidateRequest):
        import httpx
        try:
            headers = {"Authorization": f"Bearer {req.api_key}", "Content-Type": "application/json"}
            payload = {"model": "llama-3.1-8b-instant", "messages": [{"role":"user","content":"hi"}], "max_tokens": 5}
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
                if resp.status_code == 200:
                    return {"valid": True, "provider": "Groq", "model": "llama-3.1-8b-instant"}
                data = resp.json()
                return {"valid": False, "error": data.get("error", {}).get("message", "API key inválida")}
        except Exception as e:
            return {"valid": False, "error": str(e)}

    @app.post("/api/ai/chat")
    async def chat(req: ChatRequest):
        if not req.api_key:
            return JSONResponse({"error": "API key de Groq requerida"}, status_code=400)
        context  = build_context(req.scan_context)
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if context.strip():
            messages.append({"role": "system", "content": f"CONTEXTO DEL ESCANEO:\n{context}"})
        for h in req.history[-10:]:
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": req.message})
        response = await groq_complete(messages, req.api_key, req.model)
        return {"response": response, "model": req.model, "provider": "groq", "timestamp": datetime.now().isoformat()}

    @app.websocket("/api/ai/stream")
    async def stream_chat(ws: WebSocket):
        await ws.accept()
        try:
            raw     = await ws.receive_text()
            req     = json.loads(raw)
            api_key = req.get("api_key", "")
            model   = req.get("model", "llama-3.3-70b-versatile")
            message = req.get("message", "")
            history = req.get("history", [])
            scan_ctx = req.get("scan_context", {})

            if not api_key:
                await ws.send_json({"type": "error", "message": "API key de Groq requerida — obtén una gratis en console.groq.com"})
                return
            if not message:
                await ws.send_json({"type": "error", "message": "Mensaje vacío"})
                return

            context  = build_context(scan_ctx)
            messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            if context.strip():
                messages.append({"role": "system", "content": f"CONTEXTO DEL ESCANEO:\n{context}"})
            for h in history[-10:]:
                messages.append({"role": h["role"], "content": h["content"]})
            messages.append({"role": "user", "content": message})

            await ws.send_json({"type": "start", "model": model, "provider": "groq"})

            full_text = ""
            async for chunk in groq_stream(messages, api_key, model):
                full_text += chunk
                await ws.send_json({"type": "chunk", "text": chunk})
                await asyncio.sleep(0)

            await ws.send_json({"type": "done", "full_text": full_text, "model": model, "provider": "groq"})

        except WebSocketDisconnect:
            pass
        except Exception as e:
            try:
                await ws.send_json({"type": "error", "message": str(e)})
            except Exception:
                pass

    @app.post("/api/ai/report")
    async def generate_report(req: ChatRequest):
        if not req.api_key:
            return JSONResponse({"error": "API key requerida"}, status_code=400)
        context = build_context(req.scan_context)
        prompt  = f"""Genera un informe ejecutivo COMPLETO en markdown:

# Informe de Seguridad — NetProbe
**Fecha:** {datetime.now().strftime('%Y-%m-%d %H:%M')}

## 1. Resumen Ejecutivo
## 2. Hallazgos Críticos (tabla)
## 3. Análisis por Categoría
## 4. Vectores No Probados
## 5. Plan de Remediación
## 6. Configuraciones Recomendadas

DATOS DEL ESCANEO:
{context}"""
        messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}]
        report   = await groq_complete(messages, req.api_key, req.model)
        return {"report": report, "model": req.model, "provider": "groq", "timestamp": datetime.now().isoformat()}
