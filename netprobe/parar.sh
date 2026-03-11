#!/bin/bash
# NetProbe — Parar todos los servicios
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}Deteniendo NetProbe...${NC}"

# Por PID guardado
for f in "$SCRIPT_DIR/logs/backend.pid" "$SCRIPT_DIR/logs/frontend.pid"; do
    if [ -f "$f" ]; then
        PID=$(cat "$f")
        kill "$PID" 2>/dev/null && echo -e "  ${GREEN}✓${NC} Proceso $PID detenido"
        rm -f "$f"
    fi
done

# Por nombre (por si acaso)
pkill -f "python3.*main.py" 2>/dev/null || true
pkill -f "uvicorn.*main" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo -e "${GREEN}✓ NetProbe detenido${NC}"
