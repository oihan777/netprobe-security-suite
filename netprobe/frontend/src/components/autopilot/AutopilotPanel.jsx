import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Play, Loader2, Zap, CheckCircle, Clock, Shield,
         AlertTriangle, ChevronRight, Sparkles, Target } from 'lucide-react';
import { MODULES, CATEGORIES } from '../../data/modules.js';

const RISK_CFG = {
  LOW:      { color:'#30d158', label:'Bajo',    icon:'🟢' },
  MEDIUM:   { color:'#ff9f0a', label:'Medio',   icon:'🟡' },
  HIGH:     { color:'#ff6b35', label:'Alto',    icon:'🟠' },
  CRITICAL: { color:'#ff453a', label:'Crítico', icon:'🔴' },
};

const PRIORITY_COLOR = (p) => {
  if (p >= 9) return '#ff453a';
  if (p >= 7) return '#ff9f0a';
  if (p >= 5) return '#0a84ff';
  return '#636366';
};

function PlanCard({ item, index, selected, onToggle }) {
  const mod    = MODULES.find(m => m.id === item.module);
  const cat    = CATEGORIES[mod?.category];
  const pColor = PRIORITY_COLOR(item.priority);
  const isSelected = selected.has(item.module);

  return (
    <motion.div
      initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => onToggle(item.module)}
      className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all"
      style={{
        background:   isSelected ? `${pColor}10` : 'rgba(255,255,255,0.02)',
        borderColor:  isSelected ? `${pColor}40` : 'rgba(255,255,255,0.07)',
      }}>

      {/* Priority badge */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
          style={{ background: `${pColor}18`, color: pColor, border:`1px solid ${pColor}35` }}>
          {item.priority}
        </div>
        <div className="w-3 h-3 rounded-sm flex items-center justify-center"
          style={{ background: isSelected ? pColor : 'rgba(255,255,255,0.1)', transition:'all 0.15s' }}>
          {isSelected && <CheckCircle className="w-2.5 h-2.5 text-black" />}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-white">
            {mod?.name || item.module}
          </span>
          {cat && (
            <span className="text-[8px] px-1.5 py-0.5 rounded font-semibold"
              style={{ background:`${cat.color}15`, color: cat.color }}>
              {cat.name}
            </span>
          )}
          <span className="text-[9px] ml-auto font-mono text-[rgba(255,255,255,0.25)]">
            Intensidad {item.intensity}
          </span>
        </div>
        <p className="text-[11px] text-[rgba(255,255,255,0.45)] leading-snug">
          {item.reason}
        </p>
        {mod?.description && (
          <p className="text-[9px] text-[rgba(255,255,255,0.25)] mt-0.5 italic">{mod.description}</p>
        )}
      </div>
    </motion.div>
  );
}

export function AutopilotPanel({ results, apiKey, onLaunchModules }) {
  const [plan,      setPlan]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [selected,  setSelected]  = useState(new Set());
  const [launched,  setLaunched]  = useState(false);

  const generatePlan = async () => {
    if (!apiKey) { setError('Necesitas una API Key de Groq en el sidebar'); return; }
    setLoading(true); setError(''); setPlan(null); setLaunched(false); setError('');

    try {
      const res = await fetch('http://localhost:8000/api/autopilot/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, api_key: apiKey }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setPlan(data);
      // Pre-select top 6 modules
      const top = (data.plan || []).slice(0, 6).map(p => p.module);
      setSelected(new Set(top));
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (id) => {
    setSelected(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAll   = () => setSelected(new Set((plan?.plan||[]).map(p=>p.module)));
  const deselectAll = () => setSelected(new Set());

  const launchSelected = () => {
    const modules = [...selected];
    if (!modules.length) return;
    onLaunchModules(modules);
    setLaunched(true);
  };

  const riskCfg = plan ? (RISK_CFG[plan.risk_level] || RISK_CFG.MEDIUM) : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[rgba(255,255,255,0.07)] flex-shrink-0"
        style={{ background:'rgba(10,10,14,0.95)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[rgba(0,255,136,0.1)] border border-[rgba(0,255,136,0.2)] flex items-center justify-center text-xs">🤖</div>
          <span className="text-xs font-semibold text-white">Autopilot</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded border text-[rgba(0,255,136,0.7)] border-[rgba(0,255,136,0.25)] bg-[rgba(0,255,136,0.06)]">
            IA
          </span>
        </div>

        <button onClick={generatePlan} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
          style={{ background:'rgba(0,255,136,0.1)', border:'1px solid rgba(0,255,136,0.3)', color:'#00ff88' }}>
          {loading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/> Analizando...</>
            : <><Sparkles className="w-3.5 h-3.5"/> {plan ? 'Regenerar plan' : 'Generar plan de ataque'}</>}
        </button>

        {plan && (
          <>
            <button onClick={selectAll}   className="text-[10px] px-2 py-1 rounded-lg border border-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.4)] hover:text-white transition-colors">Seleccionar todos</button>
            <button onClick={deselectAll} className="text-[10px] px-2 py-1 rounded-lg border border-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.4)] hover:text-white transition-colors">Ninguno</button>
            <div className="flex-1 text-[10px] text-[rgba(255,255,255,0.3)]">
              {selected.size} de {plan.plan?.length||0} módulos seleccionados
            </div>
            <button onClick={launchSelected} disabled={!selected.size || launched}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
              style={{ background: launched ? 'rgba(48,209,88,0.12)' : 'rgba(0,255,136,0.15)',
                       border: `1px solid ${launched ? 'rgba(48,209,88,0.4)' : 'rgba(0,255,136,0.4)'}`,
                       color: launched ? '#30d158' : '#00ff88' }}>
              {launched ? <><CheckCircle className="w-3.5 h-3.5"/> Lanzado</> : <><Play className="w-3.5 h-3.5"/> Lanzar {selected.size} módulo{selected.size!==1?'s':''}</>}
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* Empty */}
        {!plan && !loading && !error && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="relative w-24 h-24 mb-6">
              {[0,1,2].map(i => (
                <div key={i} className="absolute inset-0 rounded-full border border-[rgba(0,255,136,0.15)]"
                  style={{ margin:`${i*10}px`, animation:`spin ${6+i*2}s linear infinite`, animationDirection: i%2?'reverse':'normal' }}/>
              ))}
              <div className="absolute inset-0 flex items-center justify-center text-3xl">🤖</div>
            </div>
            <h3 className="text-white font-semibold mb-2">Autopilot — IA decide el siguiente paso</h3>
            <p className="text-xs text-[rgba(255,255,255,0.35)] max-w-sm leading-relaxed mb-6">
              {results.length > 0
                ? `Analiza tus ${results.length} resultados de scan y genera automáticamente el plan de ataque más efectivo.`
                : 'Ejecuta primero un scan de reconocimiento para que la IA tenga datos con los que trabajar.'}
            </p>
            {results.length > 0 && (
              <button onClick={generatePlan}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background:'rgba(0,255,136,0.1)', border:'1.5px solid rgba(0,255,136,0.35)', color:'#00ff88' }}>
                <Sparkles className="w-4 h-4"/> Generar plan de ataque con IA
              </button>
            )}
            {!results.length && (
              <p className="text-xs text-[rgba(255,255,255,0.25)]">
                Ve a la pestaña Módulos y ejecuta syn_scan, banner y svc_enum primero.
              </p>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#00ff88]" />
            <p className="text-sm text-[rgba(255,255,255,0.5)]">La IA está analizando los resultados...</p>
            <p className="text-xs text-[rgba(255,255,255,0.25)]">Groq LLM · Generando plan de ataque óptimo</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-xl border border-[rgba(255,69,58,0.3)] bg-[rgba(255,69,58,0.08)] p-4 text-sm text-[#ff453a]">
            {error}
          </div>
        )}

        {/* Plan */}
        {plan && !loading && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-xl border p-4 grid grid-cols-1 md:grid-cols-3 gap-4"
              style={{ borderColor: `${riskCfg?.color}30`, background: `${riskCfg?.color}06` }}>
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4" style={{ color: '#00ff88' }} />
                  <span className="text-xs font-semibold text-[rgba(255,255,255,0.6)] uppercase tracking-wider">Estrategia IA</span>
                </div>
                <p className="text-sm text-white leading-relaxed">{plan.summary}</p>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  ['Nivel de riesgo', `${riskCfg?.icon} ${riskCfg?.label}`, riskCfg?.color],
                  ['Módulos',         `${plan.plan?.length || 0} recomendados`, '#0a84ff'],
                  ['Duración est.',   plan.estimated_duration || '—', 'rgba(255,255,255,0.5)'],
                ].map(([lbl, val, col]) => (
                  <div key={lbl} className="flex items-center justify-between">
                    <span className="text-[9px] text-[rgba(255,255,255,0.35)] uppercase tracking-wider">{lbl}</span>
                    <span className="text-[11px] font-semibold" style={{ color: col }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selection hint */}
            <p className="text-[10px] text-[rgba(255,255,255,0.3)] flex items-center gap-1.5">
              <Target className="w-3 h-3" />
              Click en cada módulo para seleccionar/deseleccionar. Los {Math.min(6, plan.plan?.length||0)} de mayor prioridad están preseleccionados.
            </p>

            {/* Module cards */}
            <div className="space-y-2">
              {(plan.plan || []).map((item, i) => (
                <PlanCard key={item.module} item={item} index={i}
                  selected={selected} onToggle={toggleModule} />
              ))}
            </div>

            {launched && (
              <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                className="rounded-xl border border-[rgba(48,209,88,0.3)] bg-[rgba(48,209,88,0.08)] p-4 text-center">
                <CheckCircle className="w-6 h-6 text-[#30d158] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#30d158]">Módulos añadidos a la cola</p>
                <p className="text-xs text-[rgba(255,255,255,0.4)] mt-1">
                  Ve a la pestaña Módulos y pulsa Iniciar Scan para ejecutarlos
                </p>
              </motion.div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
