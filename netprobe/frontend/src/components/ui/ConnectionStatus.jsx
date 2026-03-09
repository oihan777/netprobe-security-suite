import { motion } from 'framer-motion';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

const CONFIG = {
  connected:    { color:'#00ff88', label:'Conectado',   Icon: Wifi,     pulse: true  },
  connecting:   { color:'#ffd60a', label:'Conectando…', Icon: Loader2,  pulse: false, spin: true },
  disconnected: { color:'#ff453a', label:'Desconectado',Icon: WifiOff,  pulse: false },
  error:        { color:'#ff453a', label:'Error WS',    Icon: WifiOff,  pulse: false },
};

export function ConnectionStatus({ status }) {
  const cfg = CONFIG[status] || CONFIG.disconnected;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)]">
      <div className="relative flex items-center justify-center w-4 h-4">
        <cfg.Icon className={`w-3.5 h-3.5 ${cfg.spin ? 'animate-spin':''}`} style={{ color: cfg.color }} />
        {cfg.pulse && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: cfg.color, opacity: 0.3 }}
            animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </div>
      <span className="text-xs" style={{ color: cfg.color }}>{cfg.label}</span>
    </div>
  );
}
