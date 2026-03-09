"""
NetProbe Security Suite - Network Utilities
"""
import subprocess
import socket

def get_interfaces():
    try:
        import netifaces
        ifaces = netifaces.interfaces()
        return [i for i in ifaces if i != 'lo']
    except ImportError:
        try:
            result = subprocess.run(['ip', 'link', 'show'], capture_output=True, text=True)
            import re
            return re.findall(r'\d+: (\w+):', result.stdout)
        except Exception:
            return ['eth0', 'wlan0']

def check_host_alive(target: str, timeout: int = 2):
    """Quick check if host is reachable."""
    try:
        result = subprocess.run(
            ['ping', '-c', '1', '-W', str(timeout), target],
            capture_output=True, timeout=timeout + 1
        )
        return result.returncode == 0
    except Exception:
        return False

def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"
