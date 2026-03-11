#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║     NetProbe Security Suite — Arranque v2.0                     ║
# ╚══════════════════════════════════════════════════════════════════╝
# Uso: sudo bash arrancar.sh

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Banner ─────────────────────────────────────────────────────────
clear
echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║     NetProbe Security Suite  v1.0  — Arranque           ║"
echo "  ╠══════════════════════════════════════════════════════════╣"
echo "  ║  ⚠  USO EXCLUSIVO EN REDES PROPIAS / AUTORIZACIÓN       ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Comprobar instalación ─────────────────────────────────────────
VENV="$SCRIPT_DIR/venv/bin/activate"
if [ ! -f "$VENV" ]; then
    fail "Entorno Python no encontrado. Ejecuta primero:"
    echo -e "  ${BOLD}sudo bash install.sh${NC}"
    exit 1
fi

if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    fail "Dependencias Node.js no instaladas. Ejecuta primero:"
    echo -e "  ${BOLD}sudo bash install.sh${NC}"
    exit 1
fi

# ── Root check ─────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    warn "Ejecutando sin root — algunos módulos de pentesting requieren sudo"
    warn "Recomendado: ${BOLD}sudo bash arrancar.sh${NC}"
    echo ""
fi

# ── Matar instancias anteriores ────────────────────────────────────
info "Limpiando procesos anteriores..."
pkill -f "uvicorn.*main" 2>/dev/null || true
pkill -f "python3.*main.py" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1
ok "Procesos anteriores detenidos"

# ── Activar venv ───────────────────────────────────────────────────
source "$VENV"

# ── Comprobar puerto 8000 ──────────────────────────────────────────
if ss -tlnp 2>/dev/null | grep -q ':8000 '; then
    warn "Puerto 8000 ocupado — matando proceso..."
    fuser -k 8000/tcp 2>/dev/null || true
    sleep 1
fi

# ── Arrancar backend ───────────────────────────────────────────────
echo ""
info "Arrancando backend (puerto 8000)..."
mkdir -p "$SCRIPT_DIR/logs"

cd "$SCRIPT_DIR/backend"
nohup python3 main.py > "$SCRIPT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

# Esperar a que el backend esté listo (máx 15s)
MAX_WAIT=15
WAITED=0
printf "  ${CYAN}→${NC} Esperando backend"
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -sf http://localhost:8000/health >/dev/null 2>&1 || \
       curl -sf http://localhost:8000/docs >/dev/null 2>&1 || \
       ss -tlnp 2>/dev/null | grep -q ':8000 '; then
        break
    fi
    printf "."
    sleep 1
    WAITED=$((WAITED + 1))
done
echo ""

if kill -0 $BACKEND_PID 2>/dev/null; then
    ok "Backend corriendo (PID $BACKEND_PID)"
else
    fail "Backend no arrancó — revisa logs/backend.log"
    cat "$SCRIPT_DIR/logs/backend.log" | tail -20
    exit 1
fi

# ── Comprobar puerto 5173 ──────────────────────────────────────────
if ss -tlnp 2>/dev/null | grep -q ':5173 '; then
    warn "Puerto 5173 ocupado — matando proceso..."
    fuser -k 5173/tcp 2>/dev/null || true
    sleep 1
fi

# ── Arrancar frontend ──────────────────────────────────────────────
info "Arrancando frontend (puerto 5173)..."
cd "$SCRIPT_DIR/frontend"
nohup npm run dev > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

# Esperar a que el frontend esté listo (máx 20s)
MAX_WAIT=20
WAITED=0
printf "  ${CYAN}→${NC} Esperando frontend"
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -sf http://localhost:5173 >/dev/null 2>&1 || \
       ss -tlnp 2>/dev/null | grep -q ':5173 '; then
        break
    fi
    printf "."
    sleep 1
    WAITED=$((WAITED + 1))
done
echo ""

if kill -0 $FRONTEND_PID 2>/dev/null; then
    ok "Frontend corriendo (PID $FRONTEND_PID)"
else
    fail "Frontend no arrancó — revisa logs/frontend.log"
    cat "$SCRIPT_DIR/logs/frontend.log" | tail -20
    exit 1
fi

# ── Guardar PIDs para el stop ─────────────────────────────────────
echo "$BACKEND_PID" > "$SCRIPT_DIR/logs/backend.pid"
echo "$FRONTEND_PID" > "$SCRIPT_DIR/logs/frontend.pid"

# ── Status final ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}  ╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}  ║        ✓  NetProbe listo en http://localhost:5173        ║${NC}"
echo -e "${GREEN}  ╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Frontend ${NC}: ${BLUE}http://localhost:5173${NC}"
echo -e "  ${BOLD}Backend  ${NC}: ${BLUE}http://localhost:8000${NC}"
echo -e "  ${BOLD}API Docs ${NC}: ${BLUE}http://localhost:8000/docs${NC}"
echo -e "  ${BOLD}Logs     ${NC}: ${CYAN}$SCRIPT_DIR/logs/${NC}"
echo ""
echo -e "  Para detener: ${RED}Ctrl+C${NC}  o  ${RED}bash parar.sh${NC}"
echo ""

# ── Mostrar logs en tiempo real ────────────────────────────────────
trap "
echo ''
echo -e '  ${YELLOW}Deteniendo NetProbe...${NC}'
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
sleep 1
pkill -f 'python3.*main.py' 2>/dev/null || true
pkill -f 'vite' 2>/dev/null || true
rm -f '$SCRIPT_DIR/logs/backend.pid' '$SCRIPT_DIR/logs/frontend.pid'
echo -e '  ${GREEN}✓ NetProbe detenido${NC}'
exit 0
" INT TERM

# Seguir logs combinados
tail -f "$SCRIPT_DIR/logs/backend.log" "$SCRIPT_DIR/logs/frontend.log" 2>/dev/null &
TAIL_PID=$!

wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
kill $TAIL_PID 2>/dev/null || true
