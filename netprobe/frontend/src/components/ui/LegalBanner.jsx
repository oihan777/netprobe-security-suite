import { motion } from 'framer-motion';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Button } from './Button.jsx';

export function LegalBanner({ onAccept }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(23,26,33,0.92)', backdropFilter: 'blur(20px)' }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="max-w-lg w-full rounded-2xl border border-[rgba(255,165,0,0.3)] p-8"
        style={{ background: 'rgba(20,15,5,0.95)' }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-[rgba(255,165,0,0.15)] border border-[rgba(255,165,0,0.3)] flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-[#e4692a]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Aviso Legal</h2>
            <p className="text-xs text-[rgba(198,212,223,0.7)]">NetProbe Security Suite v1.0</p>
          </div>
        </div>

        <div className="space-y-3 mb-6 text-sm text-[#c6d4df] leading-relaxed">
          <p className="text-[#e4692a] font-medium">USO EXCLUSIVO EN REDES PROPIAS O CON AUTORIZACIÓN ESCRITA.</p>
          <p>El uso no autorizado de esta herramienta constituye un <strong className="text-white">delito penal</strong> según la legislación vigente.</p>
          <div className="rounded-lg bg-[rgba(42,71,94,0.4)] border border-[rgba(102,192,244,0.1)] p-4 space-y-1">
            <p className="text-xs text-[rgba(198,212,223,0.8)] uppercase tracking-wider mb-2">IPs permitidas (RFC1918)</p>
            {['192.168.0.0 / 16', '10.0.0.0 / 8', '172.16.0.0 / 12 — 172.31.x.x'].map(r => (
              <div key={r} className="flex items-center gap-2 text-xs font-mono text-[#66c0f4]">
                <span className="w-1 h-1 rounded-full bg-[#57cbde]" />
                {r}
              </div>
            ))}
          </div>
          <p className="text-xs text-[rgba(198,212,223,0.7)]">Al continuar, confirmas que tienes autorización expresa para analizar el objetivo.</p>
        </div>

        <Button variant="primary" className="w-full" icon={<CheckCircle2 className="w-4 h-4" />} onClick={onAccept}>
          Acepto los términos — Continuar
        </Button>
      </motion.div>
    </motion.div>
  );
}
