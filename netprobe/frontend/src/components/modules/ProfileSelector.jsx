import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Zap, X, Check } from 'lucide-react';
import { PROFILES, RISK_LABELS } from '../../data/profiles.js';
import { MODULES } from '../../data/modules.js';

export function ProfileSelector({ onApply, currentModules = [], disabled = false }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);

  const apply = (profile) => {
    onApply(profile);
    setOpen(false);
    setPreview(null);
  };

  // Active profile = exact module match
  const active = PROFILES.find(p =>
    p.modules.length === currentModules.length &&
    p.modules.every(m => currentModules.includes(m))
  );

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all disabled:opacity-40"
        style={{
          background: open ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.08)'}`,
          color: 'rgba(255,255,255,0.7)',
        }}>
        <Zap className="w-3.5 h-3.5 text-[#00ff88] flex-shrink-0" />
        <span className="flex-1 text-left truncate">
          {active ? active.name : 'Perfiles de escaneo'}
        </span>
        {active && (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
            style={{ background: `${active.color}20`, color: active.color }}>
            activo
          </span>
        )}
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform opacity-50 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setPreview(null); }} />

            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-[rgba(255,255,255,0.1)] overflow-hidden shadow-2xl"
              style={{ background: '#111116' }}>

              <div className="p-2 border-b border-[rgba(255,255,255,0.06)]">
                <p className="text-[9px] uppercase tracking-widest text-[rgba(255,255,255,0.3)] font-semibold px-1">
                  Selecciona un perfil
                </p>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {PROFILES.map(profile => {
                  const risk     = RISK_LABELS[profile.risk];
                  const isActive = active?.id === profile.id;
                  const isPrev   = preview?.id === profile.id;

                  return (
                    <div key={profile.id}
                      onMouseEnter={() => setPreview(profile)}
                      onMouseLeave={() => setPreview(null)}
                      className="relative">

                      <button
                        onClick={() => apply(profile)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                        style={{ background: isActive ? `${profile.color}10` : undefined }}>

                        {/* Left color bar */}
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r transition-all"
                          style={{ background: isPrev || isActive ? profile.color : 'transparent' }} />

                        <span className="text-xl flex-shrink-0">{profile.icon}</span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white truncate">{profile.name}</span>
                            {isActive && <Check className="w-3 h-3 flex-shrink-0" style={{ color: profile.color }} />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-semibold" style={{ color: risk.color }}>
                              {risk.label}
                            </span>
                            <span className="text-[rgba(255,255,255,0.2)] text-[9px]">·</span>
                            <span className="text-[9px] text-[rgba(255,255,255,0.35)]">
                              {profile.modules.length} módulos
                            </span>
                            <span className="text-[rgba(255,255,255,0.2)] text-[9px]">·</span>
                            <span className="text-[9px] text-[rgba(255,255,255,0.35)]">
                              int. {profile.intensity}
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Inline preview on hover */}
                      <AnimatePresence>
                        {isPrev && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden">
                            <div className="px-3 pb-2.5 pt-0.5 space-y-2"
                              style={{ background: `${profile.color}08` }}>
                              <p className="text-[10px] text-[rgba(255,255,255,0.45)] leading-relaxed">
                                {profile.description}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {profile.modules.map(mid => {
                                  const m = MODULES.find(x => x.id === mid);
                                  return (
                                    <span key={mid}
                                      className="text-[8px] px-1.5 py-0.5 rounded font-mono"
                                      style={{
                                        background: `${profile.color}15`,
                                        color:      profile.color,
                                        border:     `1px solid ${profile.color}30`,
                                      }}>
                                      {m?.name || mid}
                                    </span>
                                  );
                                })}
                              </div>
                              <button
                                onClick={() => apply(profile)}
                                className="w-full py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                                style={{
                                  background: `${profile.color}20`,
                                  border:     `1px solid ${profile.color}50`,
                                  color:      profile.color,
                                }}>
                                Aplicar perfil →
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
