#!/bin/bash
# NetProbe Security Suite — Instalador Automático
# Soporta: Ubuntu 20.04+ / Debian 11+ / Kali Linux

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    NetProbe Security Suite — Instalador v1.0           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] Ejecuta como root: sudo bash install.sh${NC}"
   exit 1
fi

# 1. Sistema
echo -e "\n${YELLOW}[1/6] Actualizando sistema...${NC}"
apt update -qq && apt upgrade -y -qq

# 2. Herramientas
echo -e "${YELLOW}[2/6] Instalando herramientas de seguridad...${NC}"
apt install -y -qq \
    nmap hping3 hydra nikto tshark tcpdump onesixtyone snmp \
    net-tools dnsutils libpcap-dev python3-venv python3-pip \
    git curl wget build-essential

# 3. Python
echo -e "${YELLOW}[3/6] Configurando Python...${NC}"
VENV_DIR="$(pwd)/venv"
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
pip install --quiet --upgrade pip
pip install --quiet \
    fastapi "uvicorn[standard]" websockets \
    scapy python-nmap paramiko requests httpx \
    aiohttp dnspython pyyaml rich psutil netifaces

# 4. SecLists + herramientas extra
echo -e "${YELLOW}[4/6] Descargando wordlists y herramientas...${NC}"
if [ ! -d /opt/seclists ]; then
    git clone --quiet --depth 1 https://github.com/danielmiessler/SecLists /opt/seclists
else echo "  ✓ SecLists ya existe"; fi

if [ ! -d /opt/sqlmap ]; then
    git clone --quiet --depth 1 https://github.com/sqlmapproject/sqlmap /opt/sqlmap
else echo "  ✓ sqlmap ya existe"; fi

if [ ! -d /opt/xsstrike ]; then
    git clone --quiet --depth 1 https://github.com/s0md3v/XSStrike /opt/xsstrike
else echo "  ✓ XSStrike ya existe"; fi

# 5. Node / frontend
echo -e "${YELLOW}[5/6] Instalando dependencias Node.js...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
    apt install -y -qq nodejs
fi
cd frontend && npm install --silent && cd ..

# 6. Permisos
echo -e "${YELLOW}[6/6] Configurando permisos...${NC}"
chmod +x start.sh

echo -e "\n${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓  Instalación completada                              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Para iniciar:"
echo -e "  ${BLUE}./start.sh${NC}  (o manualmente:)"
echo -e "  Terminal 1: ${BLUE}source venv/bin/activate && sudo python3 backend/main.py${NC}"
echo -e "  Terminal 2: ${BLUE}cd frontend && npm run dev${NC}"
echo ""
echo -e "Frontend: ${BLUE}http://localhost:5173${NC}"
