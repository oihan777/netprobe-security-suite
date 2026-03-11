import { motion } from 'framer-motion';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

const CONFIG = {
  connected:    { color:'#57cbde', label:'Conectado',   Icon: Wifi,     pulse: true  },
  connecting:   { color:'#c8a951', label:'Conectando…', Icon: Loader2,  pulse: false, spin: true },
  disconnected: { color:'#c94040', label:'Desconectado',Icon: WifiOff,  pulse: false },
  error:        { color:'#c94040', label:'Error WS',    Icon: WifiOff,  pulse: false },
};

export function ConnectionStatus({ status }) {
  const cfg = CONFIG[status] || CONFIG.disconnected;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(42,71,94,0.4)] border border-[rgba(102,192,244,0.1)]">
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
