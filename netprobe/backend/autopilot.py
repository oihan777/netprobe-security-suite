"""
NetProbe - Autopilot Engine v2
Modo Manual : genera plan, usuario elige y lanza
Modo Full Auto: bucle IA->ejecuta->analiza->repite con comandos personalizados
"""
import json, re, asyncio, time, httpx
from typing import Optional

# ── Prompt Manual ──────────────────────────────────────────────────
MANUAL_PROMPT = """Eres el motor de decisión de NetProbe, una suite de pentesting automatizado.
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
- Sin datos previos → empieza con: syn_scan, banner, svc_enum, os_detect
- Puerto 22 → ssh_brute
- Puerto 80/443 → web_tech, sqli, xss, lfi_rfi, dir_trav
- Puerto 445/139 → smb_enum, smb_brute
- Puerto 3389 → rdp_brute
- Puerto 53 → dns_tunnel, dns_poison
- OS Windows → smb_enum, rdp_brute
- Score bajo (<50) → ttl_manip, decoy_scan
- Siempre incluir → vuln_scan, policy_chk

Responde ÚNICAMENTE con JSON válido sin texto adicional:
{"plan":[{"module":"id","priority":8,"reason":"motivo","intensity":3}],"summary":"frase","risk_level":"HIGH","estimated_duration":"15 minutos"}"""

# ── Prompt Full Auto ───────────────────────────────────────────────
FULL_AUTO_PROMPT = """Eres el cerebro de NetProbe Full Auto, un sistema de pentesting autónomo.
Eres llamado en bucle: analizas resultados acumulados → decides el SIGUIENTE PASO → se ejecuta → repites.

MÓDULOS DISPONIBLES (usa IDs exactos):
syn_scan, udp_scan, os_fp, os_detect, smb_enum, web_tech, vuln_scan,
syn_flood, udp_flood, icmp_flood, http_flood, slowloris,
ssh_brute, ftp_brute, http_auth, rdp_brute, smb_brute,
sqli, xss, lfi_rfi, dir_trav, ssrf,
ttl_manip, decoy_scan, policy_chk, acl_bypass, admin_probe

MÓDULOS LENTOS — EVITAR en autopilot (timeout 45s):
banner, svc_enum (muy lentos). Usa comandos nmap personalizados en su lugar.

COMANDOS PERSONALIZADOS RECOMENDADOS (usa {target}):
- Scan rápido:  "nmap -sS -T4 -F {target}"
- Versiones:    "nmap -sV --version-intensity 2 -T4 -p- --open {target}"
- Web check:    "curl -sk --max-time 8 -I http://{target}"
- SSH version:  "nmap -sV -p 22 --version-intensity 0 -T4 {target}"

ESTRATEGIA (máx 3 módulos por ciclo para no bloquear):
- Ciclo 1: syn_scan + os_detect  (rápidos, siempre)
- Ciclo 2: según puertos → smb_enum / web_tech / os_fp + comando nmap -sV
- Ciclo 3+: ataques según hallazgos → ssh_brute / sqli / http_auth...
- Profundiza en lo que funciona, cambia de vector si falla
- Si agotaste vectores → action_type: "stop"

Responde SOLO con JSON válido (sin markdown):
{
  "thinking": "razonamiento técnico de 2-3 frases",
  "action_type": "modules" | "commands" | "both" | "stop",
  "modules": ["id1", "id2"],
  "commands": [{"cmd": "nmap -sS -T4 -F {target}", "label": "Scan rápido top ports", "timeout": 30}],
  "reason": "objetivo de este ciclo en una frase",
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "stop_reason": "si action_type es stop: resumen de conclusiones"
}"""


def _extract_json(text: str) -> Optional[dict]:
    try: return json.loads(text.strip())
    except: pass
    clean = re.sub(r'```(?:json)?\s*', '', text)
    clean = re.sub(r'```\s*$', '', clean)
    try: return json.loads(clean.strip())
    except: pass
    m = re.search(r'\{[\s\S]*\}', text)
    if m:
        try: return json.loads(m.group(0))
        except: pass
    return None


async def _ask_groq(messages: list, api_key: str, model: str, max_tokens=1200) -> str:
    async with httpx.AsyncClient(timeout=45) as c:
        r = await c.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": 0.25},
        )
        if r.status_code != 200:
            raise RuntimeError(f"Groq {r.status_code}: {r.text[:200]}")
        d = r.json()
        if "error" in d:
            raise RuntimeError(d["error"].get("message", str(d["error"])))
        return d["choices"][0]["message"]["content"]


def _build_context(all_results: list, cycle: int, target: str) -> str:
    lines = [f"TARGET: {target}", f"CICLO ACTUAL: {cycle}", ""]
    if not all_results:
        lines.append("Sin resultados previos — es el primer ciclo.")
        return "\n".join(lines)

    lines.append(f"RESULTADOS ACUMULADOS ({len(all_results)} hallazgos):")
    by_cycle = {}
    for r in all_results:
        by_cycle.setdefault(r.get("cycle", 0), []).append(r)

    for c_num in sorted(by_cycle.keys()):
        lines.append(f"\n  [Ciclo {c_num}]")
        for r in by_cycle[c_num]:
            name   = r.get("name", r.get("module", r.get("label", "?")))
            status = r.get("status", "ok")
            data   = r.get("data", {})
            line   = f"    • {name}: {status}"
            ports  = data.get("open_ports", [])
            svcs   = data.get("services", [])
            os_m   = data.get("os_matches", [])
            out    = r.get("output", "")[:200] if r.get("type") == "command" else ""
            if ports: line += f" | puertos: {','.join(str(p) for p in ports[:8])}"
            if svcs:  line += f" | servicios: {','.join(svcs[:4])}"
            if os_m:  line += f" | OS: {os_m[0]}"
            if out:   line += f" | salida: {out[:150]}…"
            lines.append(line)

    already = list({r.get("module", "") for r in all_results if r.get("module")})
    lines.append(f"\nMÓDULOS YA EJECUTADOS: {', '.join(already) or 'ninguno'}")
    return "\n".join(lines)


async def _run_command(cmd: str, target: str, timeout: int = 45) -> dict:
    resolved = cmd.replace("{target}", target)
    start    = time.time()
    try:
        proc = await asyncio.create_subprocess_shell(
            resolved,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        try:
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            output = out.decode("utf-8", errors="ignore")[:4000]
            rc     = proc.returncode
        except asyncio.TimeoutError:
            try: proc.kill()
            except: pass
            output = f"[TIMEOUT tras {timeout}s]"
            rc     = -1
    except Exception as e:
        output = f"[ERROR: {e}]"
        rc     = -1
    return {"cmd": resolved, "output": output, "rc": rc, "duration": round(time.time() - start, 2)}


async def full_auto_loop(ws, target, api_key, model, intensity, duration, max_cycles, module_runners, module_names):
    all_results = []
    stop_flag   = {"v": False}
    cycle       = 0

    # Background listener para el botón de Stop
    async def listen_stop():
        while not stop_flag["v"]:
            try:
                msg = await asyncio.wait_for(ws.receive_text(), timeout=0.5)
                if json.loads(msg).get("action") == "stop":
                    stop_flag["v"] = True
                    return
            except asyncio.TimeoutError:
                continue
            except Exception:
                stop_flag["v"] = True
                return

    listener = asyncio.create_task(listen_stop())

    try:
        while cycle < max_cycles and not stop_flag["v"]:
            cycle += 1
            await ws.send_json({"type": "cycle_start", "cycle": cycle, "max": max_cycles})

            # ── IA decide ──────────────────────────────────────
            await ws.send_json({"type": "thinking", "cycle": cycle})
            try:
                context = _build_context(all_results, cycle, target)
                raw = await _ask_groq(
                    [{"role": "system", "content": FULL_AUTO_PROMPT},
                     {"role": "user", "content": f"{context}\n\nDecide el siguiente paso. Solo JSON."}],
                    api_key, model,
                )
                decision = _extract_json(raw)
                if not decision:
                    await ws.send_json({"type": "error", "cycle": cycle, "message": f"JSON inválido: {raw[:200]}"})
                    break
            except Exception as e:
                await ws.send_json({"type": "error", "cycle": cycle, "message": f"Error IA: {e}"})
                break

            await ws.send_json({
                "type":        "ai_decision",
                "cycle":       cycle,
                "thinking":    decision.get("thinking", ""),
                "reason":      decision.get("reason", ""),
                "risk_level":  decision.get("risk_level", "MEDIUM"),
                "action_type": decision.get("action_type", "modules"),
                "modules":     decision.get("modules", []),
                "cmd_labels":  [c.get("label", c.get("cmd","?")[:40]) for c in decision.get("commands", [])],
            })

            if decision.get("action_type") == "stop" or stop_flag["v"]:
                await ws.send_json({
                    "type": "stopped", "cycle": cycle,
                    "reason": decision.get("stop_reason", "Análisis completado"),
                    "total": len(all_results),
                })
                break

            # ── Ejecutar módulos ────────────────────────────────
            atype = decision.get("action_type", "modules")
            if atype in ("modules", "both"):
                # Timeout por categoría: brute force necesita más tiempo
                SLOW_MODULES = {"ssh_brute", "ftp_brute", "http_auth", "rdp_brute",
                                "smb_brute", "snmp_brute", "vuln_scan", "svc_enum"}
                for mod_id in (decision.get("modules") or []):
                    if stop_flag["v"]: break
                    entry = module_runners.get(mod_id)
                    if not entry:
                        await ws.send_json({"type": "module_skip", "cycle": cycle, "module": mod_id})
                        continue
                    category, runner = entry[0], entry[1]
                    await ws.send_json({"type": "module_start", "cycle": cycle, "module": mod_id,
                                        "name": module_names.get(mod_id, mod_id)})
                    t0 = time.time()
                    mod_timeout = 120 if mod_id in SLOW_MODULES else 50
                    try:
                        result_logs = []
                        async def _log(t, m, mod=None, _l=result_logs): _l.append(m)
                        try:
                            data, status, score = await asyncio.wait_for(
                                runner(mod_id, target, intensity, duration, _log),
                                timeout=mod_timeout
                            )
                        except asyncio.TimeoutError:
                            data, status, score = {}, "TIMEOUT", None
                            await ws.send_json({"type": "module_error", "cycle": cycle,
                                                "module": mod_id, "error": f"Timeout ({mod_timeout}s)"})
                            continue
                        result = {"cycle":cycle,"module":mod_id,
                                  "name":module_names.get(mod_id,mod_id),"category":category,
                                  "status":status,"score":score,"data":data or {},
                                  "duration_ms":round((time.time()-t0)*1000)}
                        all_results.append({"type":"module", **result})
                        await ws.send_json({"type": "module_result", **result})
                    except Exception as e:
                        await ws.send_json({"type":"module_error","cycle":cycle,"module":mod_id,"error":str(e)})

            # ── Ejecutar comandos personalizados ─────────────────
            if atype in ("commands", "both"):
                for cmd_item in (decision.get("commands") or []):
                    if stop_flag["v"]: break
                    cmd   = cmd_item.get("cmd","")
                    label = cmd_item.get("label", cmd[:40])
                    tout  = int(cmd_item.get("timeout", 45))
                    if not cmd: continue
                    await ws.send_json({"type":"command_start","cycle":cycle,
                                        "cmd":cmd.replace("{target}",target),"label":label})
                    res = await _run_command(cmd, target, tout)
                    result = {"cycle":cycle,"label":label,"cmd":res["cmd"],
                              "output":res["output"],"rc":res["rc"],"duration_ms":round(res["duration"]*1000)}
                    all_results.append({"type":"command", **result})
                    await ws.send_json({"type":"command_result", **result})

            cycle_count = len([r for r in all_results if r.get("cycle")==cycle])
            await ws.send_json({"type":"cycle_end","cycle":cycle,"this_cycle":cycle_count,"total":len(all_results)})

            if not stop_flag["v"] and cycle < max_cycles:
                await asyncio.sleep(1.5)

        if not stop_flag["v"]:
            await ws.send_json({"type":"stopped","cycle":cycle,
                                 "reason":f"Completados {cycle} ciclos automáticos","total":len(all_results)})
    except Exception as e:
        try: await ws.send_json({"type":"error","message":f"Error bucle: {e}"})
        except: pass
    finally:
        listener.cancel()
        try: await listener
        except: pass


async def generate_autopilot_plan(recon_results, api_key, model="llama-3.3-70b-versatile"):
    parts, already = [], []
    for r in recon_results:
        data = r.get("data",{})
        line = f"- {r.get('name',r.get('module','?'))}: {r.get('status','?')}"
        if data.get("open_ports"): line += f" | puertos: {','.join(str(p) for p in data['open_ports'][:10])}"
        if data.get("services"):   line += f" | servicios: {','.join(data['services'][:5])}"
        if data.get("os_matches"): line += f" | OS: {data['os_matches'][0]}"
        parts.append(line)
        if r.get("module"): already.append(r["module"])
    ctx = "\n".join(parts) if parts else "Sin resultados previos"
    try:
        raw  = await _ask_groq(
            [{"role":"system","content":MANUAL_PROMPT},
             {"role":"user","content":f"Resultados:\n{ctx}\n\nYa ejecutados: {', '.join(already) or 'ninguno'}\n\nSolo JSON."}],
            api_key, model,
        )
        plan = _extract_json(raw)
        if not plan:
            return {"error":f"JSON inválido: {raw[:200]}","plan":[],"summary":"Error"}
        if "plan" not in plan:
            plan = {"plan": plan if isinstance(plan,list) else [],"summary":"Plan generado","risk_level":"MEDIUM","estimated_duration":"?"}
        return plan
    except Exception as e:
        return {"error":str(e),"plan":[],"summary":"Error"}


def register_autopilot_routes(app):
    from pydantic import BaseModel
    from fastapi import WebSocket, WebSocketDisconnect
    from modules import MODULE_RUNNERS
    from main import MODULE_NAMES

    class AutopilotRequest(BaseModel):
        results:   list = []
        api_key:   str  = ""
        model:     str  = "llama-3.3-70b-versatile"
        intensity: int  = 3

    @app.post("/api/autopilot/plan")
    async def autopilot_plan(req: AutopilotRequest):
        if not req.api_key:
            return {"error": "API key de Groq requerida"}
        return await generate_autopilot_plan(req.results, req.api_key, req.model)

    @app.websocket("/api/autopilot/auto")
    async def autopilot_auto_ws(ws: WebSocket):
        await ws.accept()
        try:
            raw    = await asyncio.wait_for(ws.receive_text(), timeout=10)
            cfg    = json.loads(raw)
            target = cfg.get("target","")
            apikey = cfg.get("api_key","")
            if not target or not apikey:
                await ws.send_json({"type":"error","message":"target y api_key requeridos"})
                return
            await ws.send_json({"type":"started","target":target,"max":cfg.get("max_cycles",10)})
            await full_auto_loop(
                ws, target, apikey,
                cfg.get("model","llama-3.3-70b-versatile"),
                int(cfg.get("intensity",3)),
                int(cfg.get("duration",20)),
                int(cfg.get("max_cycles",10)),
                MODULE_RUNNERS, MODULE_NAMES,
            )
        except asyncio.TimeoutError:
            await ws.send_json({"type":"error","message":"Timeout esperando config"})
        except WebSocketDisconnect:
            pass
        except Exception as e:
            try: await ws.send_json({"type":"error","message":str(e)})
            except: pass
