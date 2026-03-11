import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Zap, Play, Loader2, ChevronRight, AlertTriangle, Shield,
         Target, Clock, Layers, CheckCircle2 } from 'lucide-react';
import { MODULES, CATEGORIES } from '../../data/modules.js';

const THREAT_CFG = {
  CRITICAL: { color: '#c94040', label: 'Crítico',  icon: '💀' },
  HIGH:     { color: '#e4692a', label: 'Alto',     icon: '🔴' },
  MEDIUM:   { color: '#e4692a', label: 'Medio',    icon: '🟡' },
  LOW:      { color: '#5ba32b', label: 'Bajo',     icon: '🟢' },
};

function IntensityDots({ value }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="w-1.5 h-1.5 rounded-full transition-colors"
          style={{ background: i <= value ? '#57cbde' : 'rgba(143,152,160,0.4)' }} />
      ))}
    </div>
  );
}

function PhaseCard({ phase, index, onSelectModules, selectedModules }) {
  const [open, setOpen] = useState(index === 0);
  const cat = (id) => MODULES.find(m => m.id === id)?.category;
  const catCfg = (id) => CATEGORIES[cat(id)];
  const selected = phase.modules.filter(m => selectedModules.includes(m.id)).length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl border border-[rgba(102,192,244,0.1)] overflow-hidden bg-[rgba(42,71,94,0.2)]">

      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[rgba(42,71,94,0.2)] transition-colors text-left">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
          style={{ background: 'rgba(87,203,222,0.12)', color: '#57cbde', border: '1px solid rgba(87,203,222,0.2)' }}>
          {index + 1}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">{phase.phase}</div>
          <div className="text-[10px] text-[rgba(198,212,223,0.7)] mt-0.5">{phase.rationale}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[rgba(143,152,160,0.9)] font-mono">
            {phase.modules.length} módulos
          </span>
          {selected > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(87,203,222,0.15)', color: '#57cbde' }}>
              {selected} sel.
            </span>
          )}
          <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.18 }}>
            <ChevronRight className="w-3.5 h-3.5 text-[rgba(143,152,160,0.7)]" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}>
            <div className="px-4 pb-4 space-y-2 border-t border-[rgba(102,192,244,0.07)]">
              {phase.modules.map((mod, mi) => {
                const modInfo = MODULES.find(m => m.id === mod.id);
                const cfg     = catCfg(mod.id);
                const isSel   = selectedModules.includes(mod.id);
                return (
                  <motion.div key={mod.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: mi * 0.04 }}
                    className="flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer"
                    style={{
                      background:  isSel ? 'rgba(87,203,222,0.06)' : 'rgba(42,71,94,0.2)',
                      borderColor: isSel ? 'rgba(87,203,222,0.2)' : 'rgba(102,192,244,0.08)',
                    }}
                    onClick={() => onSelectModules(mod.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: isSel ? '#57cbde' : 'white' }}>
                          {modInfo?.name || mod.id}
                        </span>
                        <span className="text-[8px] px-1.5 py-0.5 rounded"
                          style={{ background: `${cfg?.color || '#fff'}12`, color: cfg?.color || '#fff' }}>
                          {cfg?.name || cat(mod.id)}
                        </span>
                      </div>
                      <p className="text-[9px] text-[rgba(198,212,223,0.7)] mt-0.5 leading-relaxed">
                        {mod.reason}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <IntensityDots value={mod.intensity} />
                      <span className="text-[8px] text-[rgba(143,152,160,0.9)]">Int. {mod.intensity}/5</span>
                    </div>
                    <div className="flex-shrink-0">
                      {isSel
                        ? <CheckCircle2 className="w-4 h-4 text-[#66c0f4]" />
                        : <div className="w-4 h-4 rounded-full border border-[rgba(143,152,160,0.5)]" />}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function Autopilot({ target, results, apiKey, onApplyModules }) {
  const [loading, setLoading] = useState(false);
  const [plan,    setPlan]    = useState(null);
  const [error,   setError]   = useState('');
  const [selMods, setSelMods] = useState([]);

  const generate = async (quickRecon = false) => {
    if (!apiKey) { setError('Introduce una API Key de Groq en el sidebar.'); return; }
    if (!target) { setError('Selecciona un target primero.'); return; }
    setLoading(true); setError(''); setPlan(null); setSelMods([]);

    const endpoint = quickRecon ? '/api/autopilot/quick-recon' : '/api/autopilot/plan';
    try {
      const res = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          results,
          modules: MODULES.map(m => ({ id: m.id, name: m.name, category: m.category,
                                        description: m.description, risk: m.risk })),
          api_key: apiKey,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPlan(data.plan);
        // Auto-select priority modules
        const priorities = data.plan.priority_modules || [];
        setSelMods(priorities.slice(0, 10));
      } else {
        setError(data.error || 'Error generando plan');
      }
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleMod = (id) => {
    setSelMods(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const applyPlan = () => {
    if (selMods.length > 0) onApplyModules(selMods);
  };

  const threat = plan ? THREAT_CFG[plan.threat_level] || THREAT_CFG.MEDIUM : null;
  const allMods = plan?.phases?.flatMap(p => p.modules.map(m => m.id)) || [];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[rgba(102,192,244,0.1)] flex-shrink-0"
        style={{ background: 'rgba(10,10,14,0.95)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs"
            style={{ background: 'rgba(155,89,182,0.12)', border: '1px solid rgba(155,89,182,0.25)' }}>🤖</div>
          <span className="text-xs font-semibold text-white">Autopilot</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
            style={{ background: 'rgba(155,89,182,0.15)', color: '#9b59b6', border: '1px solid rgba(155,89,182,0.3)' }}>
            IA
          </span>
        </div>

        <div className="flex-1" />

        {target && (
          <span className="text-[10px] font-mono text-[rgba(198,212,223,0.7)] flex items-center gap-1">
            <Target className="w-3 h-3" /> {target}
          </span>
        )}

        <button onClick={() => generate(results.length === 0)}
          disabled={loading || !target || !apiKey}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
          style={{ background: 'rgba(155,89,182,0.12)', border: '1px solid rgba(155,89,182,0.3)', color: '#9b59b6' }}>
          {loading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analizando...</>
            : <><Bot className="w-3.5 h-3.5" /> Generar plan</>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">

          {/* Empty state */}
          {!plan && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full border border-[rgba(155,89,182,0.2)] animate-pulse" />
                <div className="absolute inset-3 rounded-full border border-[rgba(155,89,182,0.15)] animate-pulse"
                  style={{ animationDelay: '0.3s' }} />
                <div className="absolute inset-0 flex items-center justify-center text-3xl">🤖</div>
              </div>
              <h3 className="text-white font-semibold text-sm mb-2">Autopilot</h3>
              <p className="text-xs text-[rgba(198,212,223,0.6)] max-w-xs leading-relaxed mb-6">
                La IA analiza el target{results.length > 0 ? ' y los resultados del scan' : ''} y genera un plan de pentesting inteligente: qué módulos ejecutar, en qué orden y con qué intensidad.
              </p>
              <div className="flex gap-2">
                {!apiKey && (
                  <p className="text-xs text-[rgba(228,105,42,0.8)] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Necesitas una API Key de Groq
                  </p>
                )}
                {!target && (
                  <p className="text-xs text-[rgba(228,105,42,0.8)] flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" /> Selecciona un target primero
                  </p>
                )}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative w-20 h-20 mb-6">
                {[0,1,2].map(i => (
                  <div key={i} className="absolute inset-0 rounded-full border border-[rgba(155,89,182,0.25)] animate-ping"
                    style={{ animationDelay: `${i*0.5}s`, animationDuration: '2s' }} />
                ))}
                <div className="absolute inset-0 flex items-center justify-center text-3xl">🤖</div>
              </div>
              <p className="text-sm font-medium text-white">Analizando target...</p>
              <p className="text-xs text-[rgba(198,212,223,0.6)] mt-1">La IA está generando tu plan de pentesting</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-[rgba(228,105,42,0.25)] bg-[rgba(228,105,42,0.06)] p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-[#e4692a] flex-shrink-0" />
              <p className="text-sm text-[#c6d4df]">{error}</p>
            </div>
          )}

          {plan && (
            <>
              {/* Plan header */}
              <div className="rounded-xl border p-4 space-y-3"
                style={{ borderColor: `${threat.color}30`, background: `${threat.color}08` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{threat.icon}</span>
                      <span className="text-sm font-bold" style={{ color: threat.color }}>
                        Nivel de amenaza: {threat.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#c6d4df] leading-relaxed max-w-2xl">
                      {plan.summary}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-4">
                    <div className="flex items-center gap-1.5 text-[10px] text-[rgba(198,212,223,0.7)]">
                      <Clock className="w-3 h-3" /> {plan.estimated_duration}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-[rgba(198,212,223,0.7)]">
                      <Layers className="w-3 h-3" /> {plan.phases?.length || 0} fases
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-[rgba(198,212,223,0.7)]">
                      <Zap className="w-3 h-3" /> {allMods.length} módulos
                    </div>
                  </div>
                </div>

                {plan.warnings?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {plan.warnings.map((w, i) => (
                      <span key={i} className="text-[9px] px-2 py-1 rounded-lg flex items-center gap-1"
                        style={{ background: 'rgba(228,105,42,0.1)', color: '#e4692a', border: '1px solid rgba(228,105,42,0.2)' }}>
                        ⚠️ {w}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Phases */}
              <div className="space-y-2">
                <h3 className="text-[9px] uppercase tracking-widest text-[rgba(143,152,160,0.9)] font-semibold px-1">
                  Plan de ejecución — click en módulos para seleccionarlos
                </h3>
                {plan.phases?.map((phase, i) => (
                  <PhaseCard key={i} phase={phase} index={i}
                    onSelectModules={toggleMod}
                    selectedModules={selMods} />
                ))}
              </div>

              {/* Apply button */}
              <div className="sticky bottom-0 pt-2 pb-1"
                style={{ background: 'linear-gradient(to top, #171a21 80%, transparent)' }}>
                <div className="flex items-center gap-3 p-3 rounded-xl border"
                  style={{ background: 'rgba(10,10,14,0.95)', borderColor: 'rgba(102,192,244,0.1)' }}>
                  <div className="flex-1">
                    <p className="text-xs text-[#c6d4df]">
                      <strong className="text-white">{selMods.length}</strong> módulos seleccionados
                    </p>
                    <p className="text-[9px] text-[rgba(143,152,160,0.7)] mt-0.5">
                      Se aplicarán al selector de módulos
                    </p>
                  </div>
                  <button onClick={() => setSelMods(allMods)}
                    className="px-3 py-1.5 rounded-lg text-xs border border-[rgba(102,192,244,0.15)] text-[rgba(198,212,223,0.8)] hover:text-white transition-colors">
                    Todos
                  </button>
                  <button onClick={() => setSelMods([])}
                    className="px-3 py-1.5 rounded-lg text-xs border border-[rgba(102,192,244,0.15)] text-[rgba(198,212,223,0.8)] hover:text-white transition-colors">
                    Ninguno
                  </button>
                  <button onClick={applyPlan} disabled={selMods.length === 0}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                    style={{ background: 'rgba(87,203,222,0.12)', border: '1.5px solid rgba(87,203,222,0.35)', color: '#57cbde' }}>
                    <Play className="w-4 h-4" /> Aplicar y lanzar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
