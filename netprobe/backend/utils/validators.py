"""
NetProbe Security Suite - IP Validators
"""
import re

RFC1918_PATTERNS = [
    r'^192\.168\.',
    r'^10\.',
    r'^172\.(1[6-9]|2[0-9]|3[0-1])\.',
    r'^127\.',
    r'^::1$',
]

def validate_target_ip(ip: str, allow_external: bool = False) -> dict:
    """Validates that the IP is within RFC1918 ranges."""
    if not ip:
        return {"valid": False, "message": "IP requerida"}

    ip = ip.strip()
    ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
    if not re.match(ip_pattern, ip):
        return {"valid": False, "message": "Formato de IP inválido"}

    octets = ip.split('.')
    for o in octets:
        if not 0 <= int(o) <= 255:
            return {"valid": False, "message": "Octetos fuera de rango (0-255)"}

    if allow_external:
        return {"valid": True, "message": "IP externa permitida (--allow-external)"}

    for pattern in RFC1918_PATTERNS:
        if re.match(pattern, ip):
            return {"valid": True, "message": "IP privada válida (RFC1918)"}

    return {
        "valid": False,
        "message": "IP fuera de rango RFC1918. Solo se permiten: 192.168.x.x / 10.x.x.x / 172.16-31.x.x"
    }
