#!/bin/bash
# NetProbe Security Suite — Script de inicio rápido
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    NetProbe Security Suite — Inicio                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

# Kill old instances
pkill -f "main.py" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Activate venv if exists
VENV="$SCRIPT_DIR/venv/bin/activate"
if [ -f "$VENV" ]; then
    source "$VENV"
else
    echo -e "${YELLOW}Advertencia: venv no encontrado. Usando Python del sistema.${NC}"
fi

# Start backend
echo -e "${GREEN}[+] Iniciando backend (puerto 8000)...${NC}"
if [[ $EUID -ne 0 ]]; then
    echo -e "${YELLOW}  Recomendado: sudo ./start.sh (algunos módulos requieren root)${NC}"
fi
cd "$SCRIPT_DIR/backend"
python3 main.py &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

sleep 2

# Start frontend
echo -e "${GREEN}[+] Iniciando frontend (puerto 5173)...${NC}"
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

sleep 2

echo -e "\n${GREEN}✓ NetProbe activo:${NC}"
echo -e "  Frontend : ${BLUE}http://localhost:5173${NC}"
echo -e "  Backend  : ${BLUE}http://localhost:8000${NC}"
echo -e "  WebSocket: ${BLUE}ws://localhost:8000/ws${NC}"
echo ""
echo -e "Presiona ${RED}Ctrl+C${NC} para detener"

trap "echo -e '\n${YELLOW}Deteniendo...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
