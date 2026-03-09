"""
NetProbe Security Suite - Reconnaissance Module
Tools: nmap
"""
import re
import shutil
from utils.raw_exec import raw_exec

NMAP_SCAN_FLAGS = {
    "syn_scan":  "-sS",
    "udp_scan":  "-sU",
    "xmas_scan": "-sX",
    "null_scan": "-sN",
    "fin_scan":  "-sF",
    "os_fp":     "-O --osscan-guess",
    "banner":    "-sV --version-intensity 7",
    "svc_enum":  "-sV -sC --script=default,safe",
}

INTENSITY_TIMING = {1: "-T0", 2: "-T2", 3: "-T3", 4: "-T4", 5: "-T5"}
INTENSITY_RATE   = {1: "50", 2: "200", 3: "1000", 4: "3000", 5: "10000"}

MODULE_NAMES = {
    "syn_scan":  "TCP SYN Scan",
    "udp_scan":  "UDP Port Scan",
    "xmas_scan": "XMAS Scan",
    "null_scan": "NULL Scan",
    "fin_scan":  "FIN Scan",
    "os_fp":     "OS Fingerprinting",
    "banner":    "Banner Grabbing",
    "svc_enum":  "Service Enumeration",
}

async def run_recon_module(module_id, target, intensity, duration, log_fn):
    if not shutil.which("nmap"):
        await log_fn("WARN", "nmap no encontrado: sudo apt install nmap", module_id)
        return {}, "ERROR", None

    flags  = NMAP_SCAN_FLAGS.get(module_id, "-sS")
    timing = INTENSITY_TIMING.get(intensity, "-T3")
    rate   = INTENSITY_RATE.get(intensity, "1000")
    cmd    = f"nmap {flags} {timing} --min-rate {rate} -p 1-1000 {target}"

    await log_fn("MODULE", f"▶ {MODULE_NAMES.get(module_id, module_id)}", module_id)
    output, stderr, rc = await raw_exec(cmd, log_fn, module_id, timeout=120)

    open_ports     = re.findall(r"(\d+)/(?:tcp|udp)\s+open", output)
    filtered_ports = re.findall(r"(\d+)/(?:tcp|udp)\s+filtered", output)
    services       = re.findall(r"\d+/\w+\s+open\s+(\S+)", output)
    os_matches     = re.findall(r"OS details:\s*(.+)", output)

    if open_ports:
        status, score = "DETECTED", 60
    elif filtered_ports:
        status, score = "BLOCKED", 100
    else:
        status, score = "BLOCKED", 100

    return {
        "open_ports":     open_ports,
        "filtered_ports": filtered_ports,
        "services":       services,
        "os_matches":     os_matches,
    }, status, score
