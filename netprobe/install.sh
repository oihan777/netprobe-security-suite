#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║     NetProbe Security Suite — Instalador Completo v2.0          ║
# ║     Ubuntu 20.04+ / Debian 11+ / Kali Linux / Parrot OS / WSL   ║
# ╚══════════════════════════════════════════════════════════════════╝
# Uso: sudo bash install.sh

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
step() { echo -e "\n${BLUE}${BOLD}[$1]${NC} $2"; }

# Detectar si estamos en WSL
detect_wsl() {
    if grep -qi microsoft /proc/version 2>/dev/null; then
        return 0  # Es WSL
    else
        return 1  # No es WSL
    fi
}

IS_WSL=false
if detect_wsl; then
    IS_WSL=true
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║     NetProbe Security Suite — Instalador v2.0           ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  ${YELLOW}⚠  USO EXCLUSIVO EN REDES PROPIAS O CON AUTORIZACIÓN${NC}"

if [ "$IS_WSL" = true ]; then
    echo -e "  ${CYAN}ℹ  Detectado: WSL (Windows Subsystem for Linux)${NC}"
    echo -e "  ${YELLOW}⚠  Algunas herramientas de red tendrán funcionalidad limitada${NC}"
fi
echo ""

if [[ $EUID -ne 0 ]]; then
    fail "Ejecuta como root: sudo bash install.sh"
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive
TOTAL=9; S=0
ns() { S=$((S+1)); step "$S/$TOTAL" "$1"; }

# ── 1. Sistema ────────────────────────────────────────────────────
ns "Actualizando sistema"
apt-get update -qq && ok "Repos actualizados" || warn "No se pudo actualizar"
apt-get upgrade -y -qq && ok "Sistema al día" || warn "Upgrade parcial"

# ── 2. Paquetes sistema ───────────────────────────────────────────
ns "Instalando herramientas del sistema"

# Paquetes base (funcionan en todos los sistemas)
PKGS_BASE=(
    nmap nikto whois dnsutils net-tools iputils-ping
    python3 python3-pip python3-venv python3-dev
    libpcap-dev libssl-dev libffi-dev build-essential
    git curl wget jq unzip snmp netcat-openbsd socat
)

# Paquetes que NO funcionan bien en WSL
PKGS_LINUX_ONLY=(
    hping3 tcpdump tshark masscan arp-scan hydra
)

# Instalar paquetes base
for pkg in "${PKGS_BASE[@]}"; do
    if dpkg -l "$pkg" &>/dev/null 2>&1; then
        ok "$pkg (ya instalado)"
    elif apt-get install -y -qq "$pkg" 2>/dev/null; then
        ok "$pkg"
    else
        warn "$pkg (omitido)"
    fi
done

# Instalar paquetes Linux-only si no estamos en WSL
if [ "$IS_WSL" = false ]; then
    for pkg in "${PKGS_LINUX_ONLY[@]}"; do
        if dpkg -l "$pkg" &>/dev/null 2>&1; then
            ok "$pkg (ya instalado)"
        elif apt-get install -y -qq "$pkg" 2>/dev/null; then
            ok "$pkg"
        else
            warn "$pkg (omitido)"
        fi
    done
else
    info "WSL detectado: omitiendo hping3, tcpdump, tshark, masscan, arp-scan, hydra"
    info "Alternativas en WSL: usa nmap para escaneos, o herramientas nativas de Windows"
fi

# ── 3. Herramientas pentesting ────────────────────────────────────
ns "Instalando herramientas de pentesting"

# sqlmap
if command -v sqlmap &>/dev/null; then
    ok "sqlmap (ya instalado)"
elif [ -d /opt/sqlmap ]; then
    ln -sf /opt/sqlmap/sqlmap.py /usr/local/bin/sqlmap 2>/dev/null || true
    ok "sqlmap (ya en /opt)"
else
    info "Clonando sqlmap..."
    git clone --quiet --depth 1 https://github.com/sqlmapproject/sqlmap /opt/sqlmap 2>/dev/null \
        && ln -sf /opt/sqlmap/sqlmap.py /usr/local/bin/sqlmap \
        && ok "sqlmap" || warn "sqlmap no instalado"
fi

# XSStrike
if [ -d /opt/xsstrike ]; then
    ok "XSStrike (ya instalado)"
else
    info "Clonando XSStrike..."
    git clone --quiet --depth 1 https://github.com/s0md3v/XSStrike /opt/xsstrike 2>/dev/null \
        && ok "XSStrike" || warn "XSStrike no instalado"
fi

# SecLists
if [ -d /opt/seclists ]; then
    ok "SecLists (ya instalado)"
else
    info "Descargando SecLists (puede tardar)..."
    git clone --quiet --depth 1 https://github.com/danielmiessler/SecLists /opt/seclists 2>/dev/null \
        && ok "SecLists" || warn "SecLists no instalado"
fi

# ── 4. Wordlists ────────────────────────────────────────────────────
ns "Configurando wordlists"

# rockyou.txt — la lista más usada en pentesting
ROCKYOU="/usr/share/wordlists/rockyou.txt"
ROCKYOU_GZ="/usr/share/wordlists/rockyou.txt.gz"

if [ -f "$ROCKYOU" ]; then
    ok "rockyou.txt (ya instalada)"
elif [ -f "$ROCKYOU_GZ" ]; then
    info "Descomprimiendo rockyou.txt..."
    if gunzip -k "$ROCKYOU_GZ" 2>/dev/null; then
        ok "rockyou.txt descomprimida"
    else
        warn "Error descomprimiendo rockyou, intentando descarga directa..."
    fi
else
    info "Descargando rockyou.txt..."
    mkdir -p /usr/share/wordlists
    
    # Intentar instalar paquete wordlists (solo existe en Kali/Parrot)
    apt-get install -y -qq wordlists 2>/dev/null || true
    
    # Verificar si se instaló y descomprimir si existe el .gz
    if [ ! -f "$ROCKYOU" ] && [ -f "$ROCKYOU_GZ" ]; then
        gunzip -k "$ROCKYOU_GZ" 2>/dev/null || true
    fi
    
    # Si aún no existe, descargar desde GitHub
    if [ ! -f "$ROCKYOU" ]; then
        info "Descargando desde fuente alternativa..."
        if wget -q --timeout=120 --tries=3 \
            "https://github.com/brannondorsey/naive-hashcat/releases/download/data/rockyou.txt" \
            -O "$ROCKYOU" 2>/dev/null; then
            ok "rockyou.txt descargada ($(du -sh "$ROCKYOU" 2>/dev/null | cut -f1))"
        elif curl -fsSL --connect-timeout 120 --retry 3 \
            "https://github.com/brannondorsey/naive-hashcat/releases/download/data/rockyou.txt" \
            -o "$ROCKYOU" 2>/dev/null; then
            ok "rockyou.txt descargada con curl ($(du -sh "$ROCKYOU" 2>/dev/null | cut -f1))"
        else
            warn "No se pudo descargar rockyou.txt (conexión lenta o bloqueada)"
            info "Creando lista básica de passwords comunes..."
            printf '%s\n' \
                123456 password 12345678 qwerty 123456789 \
                12345 1234 111111 1234567 dragon \
                123123 baseball abc123 football monkey \
                letmein 696969 shadow master 666666 \
                qwertyuiop 123321 mustang 1234567890 \
                michael 654321 pussy superman 1qaz2wsx \
                7777777 fuckyou 121212 000000 qazwsx \
                123qwe killer trustno1 1q2w3e jordan \
                jennifer zxcvbnm asdfgh hunter buster \
                soccer harley batman andrew tigger \
                sunshine iloveyou fuckme 2000 charlie \
                robert thomas hockey ranger daniel \
                starwars klaster 112233 george asshole \
                computer michelle jessica pepper 1111 \
                zxcvbn 555555 131313 freedom 777777 \
                pass fuck maggie 159753 aaaaaa \
                ginger princess joshua cheese amanda \
                summer love ashley 6969 nicole \
                chelsea biteme matthew access yankees \
                987654321 dallas austin thunder taylor \
                matrix > "$ROCKYOU"
            ok "Lista básica creada ($(wc -l < "$ROCKYOU") passwords)"
        fi
    else
        ok "rockyou.txt instalada"
    fi
fi

# Listas adicionales útiles
WLDIR="/opt/netprobe-wordlists"
mkdir -p "$WLDIR"

if [ ! -f "$WLDIR/top-usernames.txt" ]; then
    if [ -f "/opt/seclists/Usernames/top-usernames-shortlist.txt" ]; then
        cp /opt/seclists/Usernames/top-usernames-shortlist.txt "$WLDIR/top-usernames.txt"
        ok "top-usernames.txt (desde SecLists)"
    else
        printf '%s\n' \
            admin root user test guest administrator \
            oracle sa postgres manager operator ftpuser \
            www-data service backup pi ubuntu anonymous \
            kali nobody mysql tomcat apache nginx administrator \
            support sysadmin developer devops ansible jenkins > "$WLDIR/top-usernames.txt"
        ok "top-usernames.txt (lista interna)"
    fi
fi

if [ ! -f "$WLDIR/top-passwords.txt" ]; then
    if [ -f "/opt/seclists/Passwords/Common-Credentials/10-million-password-list-top-1000.txt" ]; then
        cp /opt/seclists/Passwords/Common-Credentials/10-million-password-list-top-1000.txt "$WLDIR/top-passwords.txt"
        ok "top-passwords.txt (1000 passwords, desde SecLists)"
    elif [ -f "$ROCKYOU" ]; then
        head -1000 "$ROCKYOU" > "$WLDIR/top-passwords.txt" 2>/dev/null || true
        if [ -s "$WLDIR/top-passwords.txt" ]; then
            ok "top-passwords.txt (top 1000 de rockyou)"
        else
            printf '%s\n' admin password 123456 root test 12345 qwerty letmein changeme 1234 > "$WLDIR/top-passwords.txt"
            ok "top-passwords.txt (lista interna reducida)"
        fi
    else
        printf '%s\n' \
            admin password 123456 root test 12345 qwerty letmein changeme 1234 \
            admin123 pass welcome login master dragon monkey shadow password1 football > "$WLDIR/top-passwords.txt"
        ok "top-passwords.txt (lista interna)"
    fi
fi

if [ ! -f "$WLDIR/ssh-passwords.txt" ]; then
    if [ -f "/opt/seclists/Passwords/Common-Credentials/top-20-common-SSH-passwords.txt" ]; then
        cp /opt/seclists/Passwords/Common-Credentials/top-20-common-SSH-passwords.txt "$WLDIR/ssh-passwords.txt"
        ok "ssh-passwords.txt (desde SecLists)"
    elif [ -f "$ROCKYOU" ]; then
        head -500 "$ROCKYOU" > "$WLDIR/ssh-passwords.txt" 2>/dev/null || true
        if [ -s "$WLDIR/ssh-passwords.txt" ]; then
            ok "ssh-passwords.txt (top 500 de rockyou)"
        else
            printf '%s\n' root admin password 123456 test 1234 > "$WLDIR/ssh-passwords.txt"
            ok "ssh-passwords.txt (lista básica)"
        fi
    fi
fi

# ── 5. Python venv ────────────────────────────────────────────────
ns "Configurando entorno Python"
VENV_DIR="$SCRIPT_DIR/venv"
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR" && ok "venv creado" || { fail "Error creando venv"; exit 1; }
else
    ok "venv existente"
fi

source "$VENV_DIR/bin/activate"
pip install --quiet --upgrade pip setuptools wheel

info "Instalando paquetes Python..."
pip install --quiet \
    "fastapi==0.111.0" \
    "uvicorn[standard]==0.29.0" \
    "websockets==12.0" \
    "scapy==2.5.0" \
    "python-nmap==0.7.1" \
    "paramiko==3.4.0" \
    "requests==2.31.0" \
    "httpx==0.27.0" \
    "aiohttp==3.9.5" \
    "dnspython==2.6.1" \
    "pyyaml==6.0.1" \
    "rich==13.7.1" \
    "psutil==5.9.8" \
    "netifaces==0.11.0" \
    "reportlab>=4.0.0" \
    "Pillow>=10.0.0" \
    "python-multipart" \
    "cryptography" \
    && ok "Paquetes Python instalados" || { fail "Error paquetes Python"; exit 1; }
deactivate

# ── 6. Node.js + frontend ─────────────────────────────────────────
ns "Configurando Node.js y frontend"
if command -v node &>/dev/null; then
    ok "Node.js $(node --version) (ya instalado)"
else
    info "Instalando Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
    apt-get install -y -qq nodejs && ok "Node.js instalado" || { fail "Error Node.js"; exit 1; }
fi

if [ -d "$SCRIPT_DIR/frontend" ]; then
    cd "$SCRIPT_DIR/frontend"
    info "Instalando dependencias frontend..."
    npm install --silent && ok "Frontend listo" || { fail "Error npm install"; exit 1; }
    cd "$SCRIPT_DIR"
else
    warn "Directorio frontend no encontrado, omitiendo"
fi

# ── 7. Permisos ───────────────────────────────────────────────────
ns "Configurando permisos"
chmod +x "$SCRIPT_DIR/arrancar.sh" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/install.sh"
mkdir -p "$SCRIPT_DIR/logs"
ok "Scripts ejecutables"

# Capacidades de red para Python (solo en Linux nativo, no WSL)
PYTHON_BIN="$VENV_DIR/bin/python3"
if [ "$IS_WSL" = false ]; then
    if command -v setcap &>/dev/null && [ -f "$PYTHON_BIN" ]; then
        setcap cap_net_raw,cap_net_admin+eip "$PYTHON_BIN" 2>/dev/null \
            && ok "Capacidades de red asignadas a Python" \
            || warn "No se asignaron capacidades (usa sudo al arrancar)"
    fi
else
    info "WSL detectado: omitiendo setcap (no soportado)"
fi

# ── 8. Verificación ───────────────────────────────────────────────
ns "Verificando herramientas"
OK=0; MISS=0
chk() {
    if command -v "$1" &>/dev/null; then
        ok "$1"; OK=$((OK+1))
    else
        warn "$1 (no encontrado)"; MISS=$((MISS+1))
    fi
}

# Verificar herramientas principales
chk nmap; chk nikto; chk whois; chk socat
chk sqlmap; chk node; chk python3

# Verificar snmpwalk (viene con paquete snmp)
if command -v snmpwalk &>/dev/null; then
    ok "snmpwalk (desde paquete snmp)"
fi

# Verificar herramientas Linux-only solo si no estamos en WSL
if [ "$IS_WSL" = false ]; then
    chk hping3; chk hydra; chk tcpdump; chk tshark
else
    info "Herramientas no disponibles en WSL: hping3, hydra, tcpdump, tshark"
fi

# ── 9. Finalizar ──────────────────────────────────────────────────
ns "Finalizando"
ok "Base de datos SQLite se crea al primer arranque"

if [ "$IS_WSL" = true ]; then
    ok "Instalación completada en WSL (funcionalidad limitada)"
else
    ok "Instalación completada ($OK herramientas OK, $MISS no encontradas)"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
if [ "$IS_WSL" = true ]; then
    echo -e "${GREEN}║     ✓  NetProbe listo para usar (modo WSL)              ║${NC}"
else
    echo -e "${GREEN}║           ✓  NetProbe listo para usar                    ║${NC}"
fi
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Inicia con:  ${BOLD}${BLUE}sudo bash arrancar.sh${NC}"
echo -e "  Frontend  :  ${BLUE}http://localhost:5173${NC}"
echo -e "  Backend   :  ${BLUE}http://localhost:8000${NC}"
if [ "$IS_WSL" = true ]; then
    echo ""
    echo -e "  ${YELLOW}📌 Notas para WSL:${NC}"
    echo -e "  ${YELLOW}   • Usa nmap para escaneos (hping3/masscan no funcionan)${NC}"
    echo -e "  ${YELLOW}   • Para captura de paquetes, usa Wireshark en Windows${NC}"
    echo -e "  ${YELLOW}   • hydra disponible instalándolo manualmente: apt install hydra${NC}"
fi
echo ""