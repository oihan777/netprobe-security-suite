#!/usr/bin/env python3
"""
NetProbe Security Suite - Backend
FastAPI + WebSocket Server
USO EXCLUSIVO EN REDES PROPIAS O CON AUTORIZACION ESCRITA
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from typing import Callable, Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# ─────────────────────────── logging ─────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ─────────────────────────── app ─────────────────────────────────
app = FastAPI(title="NetProbe Security Suite v1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────── imports ─────────────────────────────
from utils.validators import validate_target_ip
from utils.evaluator import calculate_global_score
from utils.network import get_interfaces, check_host_alive
from modules import MODULE_RUNNERS

MODULE_NAMES = {
    "syn_scan":    "TCP SYN Scan",
    "udp_scan":    "UDP Port Scan",
    "xmas_scan":   "XMAS Scan",
    "null_scan":   "NULL Scan",
    "fin_scan":    "FIN Scan",
    "os_fp":       "OS Fingerprinting",
    "banner":      "Banner Grabbing",
    "svc_enum":    "Service Enumeration",
    "syn_flood":   "SYN Flood",
    "udp_flood":   "UDP Flood",
    "icmp_flood":  "ICMP Flood",
    "http_flood":  "HTTP Flood",
    "slowloris":   "Slowloris Attack",
    "fragflood":   "Fragment Flood",
    "ssh_brute":   "SSH Brute Force",
    "ftp_brute":   "FTP Brute Force",
    "http_auth":   "HTTP Basic Auth Brute",
    "rdp_brute":   "RDP Brute Force",
    "snmp_brute":  "SNMP Community String",
    "smb_brute":   "SMB Auth Brute",
    "arp_spoof":   "ARP Spoofing",
    "vlan_hop":    "VLAN Hopping",
    "ipv6_flood":  "IPv6 ND Flood",
    "frag_attack": "Teardrop Attack",
    "tcp_reset":   "TCP RST Injection",
    "sqli":        "SQL Injection",
    "xss":         "XSS Attack",
    "lfi_rfi":     "LFI/RFI",
    "dir_trav":    "Directory Traversal",
    "ssrf":        "SSRF Probing",
    "http_smug":   "HTTP Smuggling",
    "dns_amplif":  "DNS Amplification",
    "dns_tunnel":  "DNS Tunneling",
    "dns_poison":  "DNS Cache Poison",
    "dga_query":   "DGA Domain Queries",
    "ttl_manip":   "TTL Manipulation",
    "decoy_scan":  "Decoy Scanning",
    "timing_ev":   "Timing Evasion",
    "enc_payload": "Encrypted Payload",
    "poly_payload":"Polymorphic Payload",
    "policy_chk":  "Policy Compliance",
    "acl_bypass":  "ACL Bypass",
    "admin_probe": "Admin Interface Probe",
    "nat_bypass":  "NAT Bypass",
}

# ─────────────────────────── ws helpers ──────────────────────────
async def ws_log(ws: WebSocket, log_type: str, message: str, module: Optional[str] = None):
    await ws.send_json({
        "type": "LOG",
        "log_type": log_type,
        "message": message,
        "module": module,
        "timestamp": datetime.now().isoformat(),
    })

async def ws_result(ws: WebSocket, module_id: str, category: str,
                    status: str, score, data: dict,
                    duration_ms: int = None, commands: list = None, raw_output: str = None):
    await ws.send_json({
        "type": "MODULE_RESULT",
        "module": module_id,
        "module_name": MODULE_NAMES.get(module_id, module_id),
        "category": category,
        "status": status,
        "score": score,
        "data": data or {},
        "duration_ms": duration_ms,
        "commands": commands or [],
        "raw_output": raw_output or "",
        "timestamp": datetime.now().isoformat(),
    })

# ─────────────────────────── websocket ───────────────────────────
active_scans = {}

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    client_id = str(id(ws))
    active_scans[client_id] = False
    logger.info("Cliente conectado: %s", client_id)

    async def log(log_type: str, message: str, module: Optional[str] = None):
        try:
            await ws_log(ws, log_type, message, module)
        except Exception:
            pass

    await log("SYSTEM", "=" * 56)
    await log("SYSTEM", "  NetProbe Security Suite v1.0")
    await log("WARN",   "  USO EXCLUSIVO EN REDES PROPIAS / AUTORIZACION")
    await log("SYSTEM", "  IPs: 192.168.x.x | 10.x.x.x | 172.16-31.x.x")
    await log("SYSTEM", "=" * 56)

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            action = msg.get("action", "")

            # ── START_SCAN ──────────────────────────────────────
            if action == "START_SCAN":
                target     = msg.get("target", "")
                modules    = msg.get("modules", [])
                intensity  = int(msg.get("intensity", 3))
                duration   = int(msg.get("duration", 30))
                interface  = msg.get("interface", "eth0")
                case_id    = msg.get("case_id", None)

                validation = validate_target_ip(target)
                if not validation["valid"]:
                    await log("ERROR", f"Target invalido: {validation['message']}")
                    continue

                active_scans[client_id] = True
                await log("SYSTEM", f"Target    : {target}")
                await log("SYSTEM", f"Modulos   : {len(modules)}")
                await log("SYSTEM", f"Intensidad: {intensity}")
                await log("SYSTEM", f"Duracion  : {duration}s")
                await log("SYSTEM", "-" * 40)

                results = []

                for i, module_id in enumerate(modules):
                    if not active_scans.get(client_id, True):
                        await log("WARN", "Scan detenido por el usuario")
                        break

                    # progress
                    await ws.send_json({
                        "type": "MODULE_START",
                        "module": module_id,
                        "module_name": MODULE_NAMES.get(module_id, module_id),
                        "current": i + 1,
                        "total": len(modules),
                    })

                    entry = MODULE_RUNNERS.get(module_id)
                    if not entry:
                        await log("WARN", f"Modulo {module_id} no registrado", module_id)
                        await ws_result(ws, module_id, "unknown", "ERROR", None, {})
                        continue

                    category, runner = entry

                    import time as _time
                    _t0 = _time.time()
                    _cmds = []
                    _raws = []

                    # Wrap log to capture CMD/RAW entries for this module
                    async def log_capturing(log_type, message, mod=None):
                        if log_type == "CMD":
                            _cmds.append(message)
                        elif log_type == "RAW":
                            _raws.append(message)
                        await log(log_type, message, mod)

                    try:
                        data, status, score = await runner(
                            module_id, target, intensity, duration, log_capturing
                        )
                    except Exception as e:
                        await log("ERROR", f"{module_id}: {e}", module_id)
                        data, status, score = {}, "ERROR", None

                    _dur_ms = int((_time.time() - _t0) * 1000)
                    await ws_result(ws, module_id, category, status, score, data,
                                    duration_ms=_dur_ms,
                                    commands=_cmds,
                                    raw_output="\n".join(_raws)[:8000])
                    results.append({"module": module_id, "status": status, "score": score})

                # Smart score (IA + ponderado)
                _api_key = ""
                try:
                    _smart = await compute_smart_score(results, _api_key, target)
                    global_score = _smart["adjusted_score"]
                except Exception:
                    global_score = calculate_global_score(results)
                    _smart = {"adjusted_score": global_score, "method": "simple"}

                active_scans[client_id] = False

                # Auto-save to history
                _sid = None
                try:
                    from history import create_session, finish_session, save_result
                    _sid = create_session(target, case_id=case_id)
                    for _r in results:
                        save_result(_sid, _r)
                    finish_session(_sid, results, global_score)
                    await log("SYSTEM", f"Sesión guardada en historial (ID: {_sid})")
                except Exception as _he:
                    await log("WARN", f"No se pudo guardar historial: {_he}")

                await ws.send_json({
                    "type": "SCAN_COMPLETE",
                    "total_executed": len(results),
                    "global_score": global_score,
                    "smart_score": _smart,
                    "session_id": _sid,
                })
                await log("SYSTEM", "=" * 40)
                await log("SYSTEM", f"Scan completo | Score global: {global_score}/100")

            # ── MULTI_SCAN ──────────────────────────────────────
            elif action == "MULTI_SCAN":
                targets   = msg.get("targets", [])
                modules   = msg.get("modules", [])
                intensity = int(msg.get("intensity", 3))
                duration  = int(msg.get("duration", 30))
                mc_case_id = msg.get("case_id", None)

                # Validate all targets first
                valid_targets = []
                for t in targets:
                    t = t.strip()
                    if not t: continue
                    v = validate_target_ip(t)
                    if v["valid"]:
                        valid_targets.append(t)
                    else:
                        await log("WARN", f"Target inválido ignorado: {t} — {v['message']}")

                if not valid_targets:
                    await log("ERROR", "No hay targets válidos para el scan multi-target")
                    continue

                await log("SYSTEM", f"Multi-target: {len(valid_targets)} targets · {len(modules)} módulos cada uno")
                await log("SYSTEM", "=" * 48)
                active_scans[client_id] = True
                campaign_results = {}

                for t_idx, t_target in enumerate(valid_targets):
                    if not active_scans.get(client_id, True):
                        await log("WARN", "Campaña detenida por el usuario")
                        break
                    await log("SYSTEM", f"[{t_idx+1}/{len(valid_targets)}] Escaneando {t_target}…")
                    await ws.send_json({"type": "TARGET_START", "target": t_target, "index": t_idx+1, "total": len(valid_targets)})

                    t_results = []
                    for i, module_id in enumerate(modules):
                        if not active_scans.get(client_id, True): break
                        await ws.send_json({"type": "MODULE_START", "module": module_id,
                            "module_name": MODULE_NAMES.get(module_id, module_id),
                            "current": i+1, "total": len(modules)})
                        entry = MODULE_RUNNERS.get(module_id)
                        if not entry:
                            await ws_result(ws, module_id, "unknown", "ERROR", None, {})
                            continue
                        category, runner = entry
                        import time as _time; _t0 = _time.time(); _cmds = []; _raws = []
                        async def _log_c(lt, msg, mod=None):
                            if lt == "CMD": _cmds.append(msg)
                            elif lt == "RAW": _raws.append(msg)
                            await log(lt, msg, mod)
                        try:
                            data, status, score = await runner(module_id, t_target, intensity, duration, _log_c)
                        except Exception as e:
                            data, status, score = {}, "ERROR", None
                        _dur_ms = int((_time.time() - _t0)*1000)
                        r_obj = {"module": module_id, "name": MODULE_NAMES.get(module_id, module_id),
                                 "category": category, "status": status, "score": score,
                                 "data": data, "commands": _cmds, "raw_output": "\n".join(_raws)[:4000],
                                 "duration_ms": _dur_ms, "timestamp": datetime.now().isoformat()}
                        t_results.append(r_obj)
                        await ws_result(ws, module_id, category, status, score, data, duration_ms=_dur_ms,
                                        commands=_cmds, raw_output="\n".join(_raws)[:4000])

                    t_score = calculate_global_score([{"status":r["status"],"score":r["score"]} for r in t_results])
                    campaign_results[t_target] = {"results": t_results, "score": t_score}

                    # Save to history
                    try:
                        _sid = create_session(t_target, "multi-target", case_id=mc_case_id)
                        for _r in t_results: save_result(_sid, _r)
                        finish_session(_sid, t_results, t_score)
                    except Exception as _he:
                        pass

                    await ws.send_json({"type": "TARGET_COMPLETE", "target": t_target,
                        "score": t_score, "index": t_idx+1, "total": len(valid_targets)})
                    await log("RESULT", f"✓ {t_target} — Score: {t_score}/100", None)
                    await log("SYSTEM", "-" * 40)

                active_scans[client_id] = False
                await ws.send_json({"type": "MULTI_SCAN_COMPLETE",
                    "results": {t: {"score": v["score"]} for t, v in campaign_results.items()},
                    "total_targets": len(valid_targets)})
                await log("SYSTEM", f"Campaña completa — {len(valid_targets)} targets escaneados")

            # ── STOP_SCAN ───────────────────────────────────────
            elif action == "STOP_SCAN":
                active_scans[client_id] = False
                await log("WARN", "Deteniendo scan...")

            # ── RUN_COMMAND ─────────────────────────────────────
            elif action == "RUN_COMMAND":
                cmd = msg.get("command", "").strip()
                if not cmd:
                    await log("WARN", "Comando vacío")
                    continue
                # Safety: block obviously dangerous commands
                blocked_cmds = ["rm -rf", "mkfs", "dd if=", ":(){", "shutdown", "reboot", "halt", "init 0"]
                if any(b in cmd for b in blocked_cmds):
                    await log("ERROR", f"Comando bloqueado por seguridad: {cmd}")
                    continue
                await log("CMD", cmd, "custom")
                try:
                    proc = await asyncio.create_subprocess_shell(
                        cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.STDOUT,
                        limit=1024*256,
                    )
                    try:
                        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=600)
                        output = stdout.decode("utf-8", errors="replace").strip()
                        if output:
                            for line in output.split("\n"):
                                await log("RAW", line, "custom")
                        rc = proc.returncode
                        await log("SYSTEM" if rc == 0 else "WARN",
                                  f"Proceso finalizado (código {rc})", "custom")
                    except asyncio.TimeoutError:
                        proc.kill()
                        await log("ERROR", "Comando cancelado: timeout 10min", "custom")
                except Exception as e:
                    await log("ERROR", f"Error ejecutando comando: {e}", "custom")

            # ── HEALTH_CHECK ────────────────────────────────────
            elif action == "HEALTH_CHECK":
                import shutil
                tools = {t: bool(shutil.which(t)) for t in
                         ["nmap", "hping3", "hydra", "sqlmap", "tshark"]}
                await ws.send_json({
                    "type": "HEALTH_CHECK",
                    "tools": tools,
                    "root": os.geteuid() == 0,
                })

    except WebSocketDisconnect:
        logger.info("Cliente desconectado: %s", client_id)
    except Exception as e:
        logger.error("Error WS: %s", e)
    finally:
        active_scans.pop(client_id, None)

# ─────────────────────────── REST endpoints ──────────────────────
@app.get("/api/health")
async def health():
    import shutil
    return {
        "status": "ok",
        "root": os.geteuid() == 0,
        "tools": {t: bool(shutil.which(t)) for t in ["nmap","hping3","hydra"]},
        "python": sys.version,
    }

@app.get("/api/ping/{target}")
async def ping_target(target: str):
    """Quick connectivity check: ping + TCP port probe."""
    import asyncio, re, time

    result = {"target": target, "ping": None, "tcp_ports": [], "alive": False, "latency_ms": None}

    # 1. ICMP ping (3 packets)
    try:
        t0 = time.time()
        proc = await asyncio.create_subprocess_shell(
            f"ping -c 3 -W 1 {target}",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=8)
        out = stdout.decode("utf-8", errors="ignore")
        if "bytes from" in out:
            lat_m = re.search(r"rtt min/avg/max.*?=([\d.]+)/([\d.]+)", out)
            result["ping"]       = "OK"
            result["alive"]      = True
            result["latency_ms"] = float(lat_m.group(2)) if lat_m else round((time.time()-t0)*1000, 1)
        else:
            result["ping"] = "TIMEOUT"
    except Exception as e:
        result["ping"] = f"ERROR: {e}"

    # 2. TCP port probe on common ports
    import socket
    for port in [80, 443, 22, 8080, 8443, 21, 25, 3389]:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1)
            rc = s.connect_ex((target, port))
            s.close()
            if rc == 0:
                result["tcp_ports"].append(port)
                result["alive"] = True
        except Exception:
            pass

    return result

@app.post("/api/ai/analyze-result")
async def analyze_result(req: dict):
    """Generate AI analysis for a single module result using Groq."""
    import httpx
    from datetime import datetime

    api_key  = req.get("api_key", "")
    result   = req.get("result", {})
    model    = req.get("model", "llama-3.3-70b-versatile")

    if not api_key:
        return {"error": "API key requerida"}

    mod_name = result.get("name", result.get("module", "?"))
    category = result.get("category", "?")
    status   = result.get("status", "?")
    score    = result.get("score")
    commands = result.get("commands", [])
    raw_out  = (result.get("raw_output") or "")[:2000]
    details  = result.get("details") or result.get("data") or {}

    cmds_str    = ", ".join(commands[:3]) if commands else "N/A"
    raw_section = ("Salida del comando (extracto):\n" + raw_out[:800]) if raw_out else ""
    det_section = ("Datos del módulo: " + str(details)[:400]) if details else ""

    prompt = (
        "Eres un experto en ciberseguridad analizando resultados de un pentesting automatizado.\n\n"
        f"Módulo: {mod_name}\n"
        f"Categoría: {category}\n"
        f"Estado: {status}\n"
        f"Puntuación: {score}/100\n"
        f"Comandos ejecutados: {cmds_str}\n"
        + (raw_section + "\n" if raw_section else "")
        + (det_section + "\n" if det_section else "")
        + "\nResponde en español con exactamente este formato (sin texto extra):\n"
        "**Qué significa:** (1-2 frases explicando qué implica este resultado de seguridad)\n"
        "**Riesgo:** [CRÍTICO/ALTO/MEDIO/BAJO] — (1 frase con el motivo)\n"
        "**Recomendación:** (acción concreta y técnica, 1-2 frases)\n\n"
        "Máximo 110 palabras. Sé técnico y directo."
    )

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "messages": [{"role": "user", "content": prompt}], "max_tokens": 300}
            )
            data = resp.json()
            text = data["choices"][0]["message"]["content"]
            return {"analysis": text}
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/interfaces")
async def interfaces():
    return {"interfaces": get_interfaces()}

# ─────────────────────────── AI routes ───────────────────────────
from ai_engine import register_ai_routes
register_ai_routes(app)

# ─────────────────────────── Discovery routes ─────────────────────
from network_discovery import register_discovery_routes, get_local_networks, discover_hosts_streaming
register_discovery_routes(app)

# REST wrapper for NetworkTopologyMap component
@app.post("/api/network/discover")
async def network_discover_rest(request: Request):
    """REST endpoint que usa la misma lógica que el WebSocket de discovery"""
    import ipaddress as _ip
    body = await request.json()
    subnet = body.get("subnet", "auto")

    # Auto-detect local subnet
    if subnet in ("auto", ""):
        nets = await get_local_networks()
        private = [n for n in nets if n.get("is_private", True)]
        subnet = private[0]["cidr"] if private else "192.168.1.0/24"

    # Validate CIDR
    try:
        net = _ip.IPv4Network(subnet, strict=False)
        if not net.is_private:
            return JSONResponse({"error": "Solo redes privadas RFC1918"}, status_code=400)
    except Exception as e:
        return JSONResponse({"error": f"CIDR inválido: {e}"}, status_code=400)

    # Run discovery with a fake WS collector
    collected_hosts = {}  # ip -> host dict

    class FakeWS:
        async def send_json(self, data):
            t = data.get("type")
            if t == "host":
                h = data.get("host", {})
                collected_hosts[h.get("ip")] = h
            elif t == "host_update":
                h = data.get("host", {})
                ip = h.get("ip")
                if ip and ip in collected_hosts:
                    collected_hosts[ip].update(h)
                else:
                    collected_hosts[ip] = h

    await discover_hosts_streaming(subnet, FakeWS())
    hosts = list(collected_hosts.values())
    return {"hosts": hosts, "cidr": subnet, "total": len(hosts)}


# ─────────────────────────── CVE routes ──────────────────────────
from cve_lookup import register_cve_routes
register_cve_routes(app)

# ─────────────────────────── Autopilot routes ────────────────────
from autopilot import register_autopilot_routes
register_autopilot_routes(app)
from autopilot_pdf import register_autopilot_pdf_routes
register_autopilot_pdf_routes(app)

# ─────────────────────────── History routes ─────────────────────
from log_analyzer import register_log_routes
from osint import register_osint_routes
from smart_score import register_smart_score_routes, smart_score as compute_smart_score, calculate_weighted_score
from history import register_history_routes, register_cases_routes, create_session, finish_session, save_result, init_db as history_init_db
register_log_routes(app)
register_osint_routes(app)
register_smart_score_routes(app)
register_history_routes(app)
register_cases_routes(app)
history_init_db()

# ─────────────────────────── PDF routes ─────────────────────────
from pdf_report import register_pdf_routes
register_pdf_routes(app)

# ─────────────────────────── Scheduler routes ───────────────────
from scheduler import register_scheduler_routes
register_scheduler_routes(app)

# ─────────────────────────── Reverse Shell Generator ────────────
from reverse_shell import register_revshell_routes
register_revshell_routes(app)

# ─────────────────────────── IDS Rule Generator ──────────────────
from ids_rules import register_ids_routes
register_ids_routes(app)

# ─────────────────────────── Payload Generator ───────────────────
from payload_generator import register_payload_routes
register_payload_routes(app)

# ─────────────────────────── STRIDE Threat Modeling ──────────────
from stride import register_stride_routes
register_stride_routes(app)

# ─────────────────────────── entrypoint ──────────────────────────
if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════╗
║       NetProbe Security Suite  v1.0  — Backend          ║
╠══════════════════════════════════════════════════════════╣
║  ⚠  USO EXCLUSIVO EN REDES PROPIAS / AUTORIZACION       ║
║     El uso no autorizado constituye un delito penal.     ║
╚══════════════════════════════════════════════════════════╝
""")
    if os.geteuid() != 0:
        print("  ⚠  Sin root: algunos modulos (scapy/hping3) no funcionaran.\n")

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
