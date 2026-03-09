#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate

cd backend
python3 main.py &
BACKEND_PID=$!
cd ..

sleep 2

cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✓ NetProbe listo en http://localhost:5173"
echo "Ctrl+C para detener"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT
wait
