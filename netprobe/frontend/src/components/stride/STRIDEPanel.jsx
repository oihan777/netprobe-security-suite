import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, UserX, Edit3, EyeOff, FileSearch, ZapOff, ShieldOff,
  ChevronDown, AlertTriangle, CheckCircle, Loader2, Copy, Check,
  BarChart2, Layers, Target, Lightbulb, ArrowRight, RefreshCw,
  Play, Terminal as TerminalIcon, Wrench, ExternalLink
} from 'lucide-react';

const API = 'http://localhost:8000';

const STRIDE_CFG = {
  S: { label: 'Spoofing',               color: '#e4692a', bg: 'rgba(228,105,42,0.12)',  Icon: UserX      },
  T: { label: 'Tampering',              color: '#c94040', bg: 'rgba(201,64,64,0.12)',   Icon: Edit3      },
  R: { label: 'Repudiation',            color: '#c8a951', bg: 'rgba(200,169,81,0.12)',  Icon: EyeOff     },
  I: { label: 'Info Disclosure',        color: '#9b59b6', bg: 'rgba(155,89,182,0.12)',  Icon: FileSearch },
  D: { label: 'Denial of Service',      color: '#c94040', bg: 'rgba(201,64,64,0.12)',   Icon: ZapOff     },
  E: { label: 'Elevation of Privilege', color: '#ff6b9d', bg: 'rgba(255,107,157,0.12)', Icon: ShieldOff  },
};

const RISK_CFG = {
  'CRÍTICO': { color: '#c94040', bg: 'rgba(201,64,64,0.15)'  },
  'ALTO':    { color: '#e4692a', bg: 'rgba(228,105,42,0.15)' },
  'MEDIO':   { color: '#c8a951', bg: 'rgba(200,169,81,0.15)' },
  'BAJO':    { color: '#5ba32b', bg: 'rgba(91,163,43,0.15)'  },
};

const EFFORT_CFG = {
  'BAJO':  { color: '#5ba32b' },
  'MEDIO': { color: '#c8a951' },
  'ALTO':  { color: '#c94040' },
};

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  return (
    <button onClick={copy} title="Copiar comando"
      className="p-1 rounded transition-colors flex-shrink-0"
      style={{ color: copied ? '#5ba32b' : 'rgba(102,192,244,0.5)' }}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function ExploitCommand({ cmd, onRunInNetProbe }) {
  const canRun = cmd.netprobe_executable !== false;
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${canRun ? 'rgba(91,163,43,0.25)' : 'rgba(102,192,244,0.1)'}` }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5"
        style={{ background: canRun ? 'rgba(91,163,43,0.08)' : 'rgba(102,192,244,0.05)' }}>
        <Wrench className="w-3 h-3 flex-shrink-0" style={{ color: canRun ? '#5ba32b' : '#66c0f4' }} />
        <span className="text-[9px] font-bold flex-1" style={{ color: canRun ? '#5ba32b' : '#66c0f4' }}>
          {cmd.tool || 'cmd'}
        </span>
        <span className="text-[9px]" style={{ color: 'rgba(143,152,160,0.6)' }}>{cmd.description}</span>
        {canRun
          ? <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: 'rgba(91,163,43,0.15)', color: '#5ba32b' }}>NetProbe ✓</span>
          : <span className="text-[8px] px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: 'rgba(102,192,244,0.08)', color: 'rgba(143,152,160,0.6)' }}>Setup requerido</span>
        }
      </div>
      {/* Command */}
      <div className="flex items-center gap-1 px-3 py-2" style={{ background: 'rgba(10,16,24,0.8)' }}>
        <code className="flex-1 text-[10px] font-mono break-all leading-relaxed"
          style={{ color: canRun ? '#c6d4df' : 'rgba(198,212,223,0.5)' }}>
          {cmd.command}
        </code>
        <CopyBtn text={cmd.command} />
        {canRun && onRunInNetProbe && (
          <button onClick={() => onRunInNetProbe(cmd.command)}
            title="Ejecutar en terminal NetProbe"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold transition-all flex-shrink-0 ml-1"
            style={{ background: 'rgba(91,163,43,0.15)', border: '1px solid rgba(91,163,43,0.4)', color: '#5ba32b' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(91,163,43,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(91,163,43,0.15)'}>
            <Play className="w-2.5 h-2.5" /> Ejecutar
          </button>
        )}
      </div>
      {/* Notes */}
      {cmd.notes && (
        <div className="px-3 py-1.5 border-t" style={{ borderColor: 'rgba(102,192,244,0.06)', background: 'rgba(22,32,45,0.4)' }}>
          <p className="text-[9px]" style={{ color: 'rgba(143,152,160,0.6)' }}>💡 {cmd.notes}</p>
        </div>
      )}
    </div>
  );
}

function RiskBadge({ risk, small }) {
  const cfg = RISK_CFG[risk] || RISK_CFG['BAJO'];
  return (
    <span className={`font-bold rounded-full ${small ? 'text-[8px] px-1.5 py-0.5' : 'text-[9px] px-2 py-0.5'}`}
      style={{ color: cfg.color, background: cfg.bg }}>
      {risk}
    </span>
  );
}

function StrideBadge({ cat }) {
  const cfg = STRIDE_CFG[cat];
  if (!cfg) return null;
  return (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, background: cfg.bg }}>
      {cat} · {cfg.label}
    </span>
  );
}

function ThreatCard({ threat, componentColor, onRunInNetProbe }) {
  const [open, setOpen] = useState(false);
  const scfg = STRIDE_CFG[threat.stride_category] || {};
  const rcfg = RISK_CFG[threat.risk]              || {};
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${scfg.color || '#66c0f4'}25` }}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
        style={{ background: open ? `${scfg.color}0d` : 'rgba(22,32,45,0.5)' }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'rgba(42,71,94,0.3)'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'rgba(22,32,45,0.5)'; }}>
        {/* STRIDE badge */}
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: scfg.bg }}>
          <span className="text-[10px] font-black" style={{ color: scfg.color }}>{threat.stride_category}</span>
        </div>
        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-white truncate">{threat.title}</p>
          <p className="text-[9px] truncate" style={{ color: 'rgba(143,152,160,0.8)' }}>{threat.affected_asset}</p>
        </div>
        {/* CVSS */}
        {threat.cvss_estimate != null && (
          <span className="text-[9px] font-mono font-bold flex-shrink-0"
            style={{ color: threat.cvss_estimate >= 7 ? '#c94040' : threat.cvss_estimate >= 4 ? '#c8a951' : '#5ba32b' }}>
            CVSS {threat.cvss_estimate.toFixed(1)}
          </span>
        )}
        <RiskBadge risk={threat.risk} small />
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform`}
          style={{ color: 'rgba(143,152,160,0.6)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-2 space-y-3" style={{ background: 'rgba(16,24,35,0.6)' }}>
              <div className="flex flex-wrap gap-2">
                <StrideBadge cat={threat.stride_category} />
                <RiskBadge risk={threat.risk} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'rgba(143,152,160,0.6)' }}>Descripción</p>
                  <p className="text-[11px] text-[#c6d4df] leading-relaxed">{threat.description}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'rgba(143,152,160,0.6)' }}>Vector de ataque</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(228,105,42,0.9)' }}>{threat.attack_vector}</p>
                </div>
              </div>

              <div>
                <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'rgba(143,152,160,0.6)' }}>Impacto</p>
                <p className="text-[11px] text-[#c6d4df] leading-relaxed">{threat.impact}</p>
              </div>

              {threat.mitigations?.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: 'rgba(143,152,160,0.6)' }}>Mitigaciones</p>
                  <div className="space-y-1">
                    {threat.mitigations.map((m, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: '#5ba32b' }} />
                        <span className="text-[10px] text-[#c6d4df]">{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {threat.exploit_commands?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TerminalIcon className="w-3 h-3" style={{ color: '#c94040' }} />
                    <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: '#c94040' }}>
                      Comandos de explotación
                    </p>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(201,64,64,0.1)', color: '#c94040' }}>
                      {threat.exploit_commands.filter(c => c.netprobe_executable !== false).length} ejecutables en NetProbe
                    </span>
                  </div>
                  <div className="space-y-2">
                    {threat.exploit_commands.map((cmd, i) => (
                      <ExploitCommand key={i} cmd={cmd} onRunInNetProbe={onRunInNetProbe} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ComponentBlock({ comp, index, onRunInNetProbe }) {
  const [open, setOpen] = useState(true);
  const colors = ['#66c0f4','#e4692a','#9b59b6','#5ba32b','#c8a951','#57cbde','#ff6b9d','#c94040'];
  const color  = colors[index % colors.length];

  const criticals = comp.threats?.filter(t => t.risk === 'CRÍTICO').length || 0;
  const highs     = comp.threats?.filter(t => t.risk === 'ALTO').length    || 0;
  const sorted    = [...(comp.threats || [])].sort((a,b) => {
    const order = { 'CRÍTICO':0,'ALTO':1,'MEDIO':2,'BAJO':3 };
    return (order[a.risk]||3)-(order[b.risk]||3);
  });

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${color}25` }}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
        style={{ background: open ? `${color}10` : 'rgba(42,71,94,0.2)' }}
        onMouseEnter={e => e.currentTarget.style.background = `${color}12`}
        onMouseLeave={e => e.currentTarget.style.background = open ? `${color}10` : 'rgba(42,71,94,0.2)'}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black"
          style={{ background: `${color}20`, color }}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-bold text-white">{comp.name}</p>
          <p className="text-[10px] truncate" style={{ color: 'rgba(143,152,160,0.7)' }}>{comp.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {criticals > 0 && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(201,64,64,0.15)', color: '#c94040' }}>
              {criticals} CRÍTICO{criticals > 1 ? 'S' : ''}
            </span>
          )}
          {highs > 0 && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(228,105,42,0.15)', color: '#e4692a' }}>
              {highs} ALTO{highs > 1 ? 'S' : ''}
            </span>
          )}
          <span className="text-[9px]" style={{ color: 'rgba(143,152,160,0.6)' }}>
            {comp.threats?.length || 0} amenazas
          </span>
          <ChevronDown className="w-3.5 h-3.5 transition-transform"
            style={{ color: 'rgba(143,152,160,0.6)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }}
            exit={{ height: 0 }} className="overflow-hidden">
            <div className="p-3 space-y-2">
              {sorted.map((t, i) => <ThreatCard key={i} threat={t} componentColor={color} onRunInNetProbe={onRunInNetProbe} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Input Form ────────────────────────────────────────────────────
function InputForm({ onAnalyze, loading, scanResults, apiKey }) {
  const [name,   setName]   = useState('');
  const [desc,   setDesc]   = useState('');
  const [comps,  setComps]  = useState('');
  const [stack,  setStack]  = useState('');
  const [trust,  setTrust]  = useState('');
  const [flows,  setFlows]  = useState('');

  const canSubmit = name.trim() && comps.trim() && apiKey && !loading;

  const field = (label, value, set, placeholder, hint, multiline) => (
    <div>
      <label className="text-[10px] uppercase tracking-widest font-semibold mb-1.5 block"
        style={{ color: 'rgba(143,152,160,0.8)' }}>
        {label}
      </label>
      {hint && <p className="text-[9px] mb-1.5" style={{ color: 'rgba(143,152,160,0.5)' }}>{hint}</p>}
      {multiline ? (
        <textarea value={value} onChange={e => set(e.target.value)}
          placeholder={placeholder} rows={3}
          className="w-full text-[11px] px-3 py-2 rounded-xl outline-none resize-none"
          style={{ background: 'rgba(102,192,244,0.06)', border: '1px solid rgba(102,192,244,0.12)', color: '#c6d4df' }} />
      ) : (
        <input value={value} onChange={e => set(e.target.value)}
          placeholder={placeholder}
          className="w-full text-[11px] px-3 py-2 rounded-xl outline-none"
          style={{ background: 'rgba(102,192,244,0.06)', border: '1px solid rgba(102,192,244,0.12)', color: '#c6d4df' }} />
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 space-y-4"
        style={{ background: 'rgba(42,71,94,0.2)', border: '1px solid rgba(102,192,244,0.1)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-[#66c0f4]" />
          <span className="text-sm font-bold text-white">Definición del sistema</span>
          <span className="text-[9px] px-2 py-0.5 rounded-full ml-auto"
            style={{ background: 'rgba(201,64,64,0.15)', color: '#c94040' }}>* Obligatorio</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('Nombre del sistema *', name, setName, 'ej. API de pagos, Portal corporativo…', '')}
          {field('Stack tecnológico', stack, setStack, 'ej. Node.js, PostgreSQL, Nginx, AWS…', '')}
        </div>

        {field('Descripción *', desc, setDesc,
          'Explica qué hace el sistema, quiénes lo usan y qué datos maneja…', '', true)}

        {field('Componentes *', comps, setComps,
          'ej. Frontend React, API REST, Base de datos, Servicio de autenticación, CDN…',
          'Separa cada componente con comas — la IA analizará amenazas para cada uno', false)}
      </div>

      <div className="rounded-2xl p-5 space-y-4"
        style={{ background: 'rgba(42,71,94,0.15)', border: '1px solid rgba(102,192,244,0.08)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-[#c8a951]" />
          <span className="text-sm font-bold text-white">Contexto adicional</span>
          <span className="text-[9px] ml-auto" style={{ color: 'rgba(143,152,160,0.5)' }}>Opcional — mejora la calidad</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('Fronteras de confianza', trust, setTrust,
            'ej. Internet → WAF → API interna → BD privada…',
            'Zonas de confianza y puntos de entrada externos')}
          {field('Flujos de datos', flows, setFlows,
            'ej. Usuario → Login → JWT → API → BD…',
            'Cómo fluye la información entre componentes')}
        </div>
      </div>

      {!apiKey && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(201,64,64,0.1)', border: '1px solid rgba(201,64,64,0.3)' }}>
          <AlertTriangle className="w-4 h-4 text-[#c94040] flex-shrink-0" />
          <span className="text-[11px]" style={{ color: '#c94040' }}>
            Necesitas una API Key de Groq en el sidebar para usar el análisis IA
          </span>
        </div>
      )}

      <button onClick={() => onAnalyze({ name, desc, comps, stack, trust, flows })}
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'rgba(155,89,182,0.15)', border: '1px solid rgba(155,89,182,0.4)', color: '#9b59b6' }}>
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando amenazas STRIDE…</>
          : <><ShieldAlert className="w-4 h-4" /> Generar Threat Model STRIDE</>}
      </button>
    </div>
  );
}

// ── Results ───────────────────────────────────────────────────────
function Results({ result, onReset, onRunInNetProbe }) {
  const [activeView, setActiveView] = useState('components'); // components | matrix | recommendations

  const strideBar = Object.entries(STRIDE_CFG).map(([k, cfg]) => ({
    ...cfg, id: k,
    count: result.stride_counts?.[k] || 0,
  }));

  const total   = result.total_threats || 0;
  const score   = result.risk_score    || 0;
  const scoreColor = score >= 70 ? '#c94040' : score >= 40 ? '#e4692a' : score >= 20 ? '#c8a951' : '#5ba32b';

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(102,192,244,0.15)' }}>
          {[['components','Componentes',Layers],['matrix','Matriz STRIDE',BarChart2],['recommendations','Recomendaciones',Lightbulb]].map(([id,label,Icon]) => (
            <button key={id} onClick={() => setActiveView(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: activeView===id ? 'rgba(155,89,182,0.15)' : 'transparent',
                color:      activeView===id ? '#9b59b6' : 'rgba(198,212,223,0.6)',
              }}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
        <button onClick={onReset}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
          style={{ background: 'rgba(102,192,244,0.08)', color: 'rgba(198,212,223,0.7)' }}>
          <RefreshCw className="w-3 h-3" /> Nuevo análisis
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(42,71,94,0.3)', border: '1px solid rgba(102,192,244,0.1)' }}>
          <div className="text-2xl font-black mb-1" style={{ color: scoreColor }}>{score}</div>
          <div className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(143,152,160,0.7)' }}>Riesgo Global</div>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(42,71,94,0.3)', border: '1px solid rgba(102,192,244,0.1)' }}>
          <div className="text-2xl font-black mb-1 text-white">{total}</div>
          <div className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(143,152,160,0.7)' }}>Total amenazas</div>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(42,71,94,0.3)', border: '1px solid rgba(102,192,244,0.1)' }}>
          <div className="text-2xl font-black mb-1" style={{ color: '#c94040' }}>
            {result.components?.reduce((a,c) => a+(c.threats?.filter(t=>t.risk==='CRÍTICO').length||0), 0)||0}
          </div>
          <div className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(143,152,160,0.7)' }}>Críticos</div>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(42,71,94,0.3)', border: '1px solid rgba(102,192,244,0.1)' }}>
          <div className="text-2xl font-black mb-1 text-white">{result.components?.length||0}</div>
          <div className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(143,152,160,0.7)' }}>Componentes</div>
        </div>
      </div>

      {/* Summary text */}
      {result.system_summary && (
        <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(155,89,182,0.08)', border: '1px solid rgba(155,89,182,0.2)' }}>
          <p className="text-[11px] text-[#c6d4df] leading-relaxed">{result.system_summary}</p>
        </div>
      )}

      {/* Views */}
      {activeView === 'components' && (
        <div className="space-y-3">
          {result.components?.map((comp, i) => (
            <ComponentBlock key={i} comp={comp} index={i} onRunInNetProbe={onRunInNetProbe} />
          ))}
        </div>
      )}

      {activeView === 'matrix' && (
        <div className="space-y-4">
          {/* STRIDE distribution */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(42,71,94,0.2)', border: '1px solid rgba(102,192,244,0.1)' }}>
            <p className="text-xs font-bold text-white mb-4">Distribución por categoría STRIDE</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {strideBar.map(s => (
                <div key={s.id} className="rounded-xl p-3" style={{ background: s.bg, border: `1px solid ${s.color}30` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg font-black" style={{ color: s.color }}>{s.id}</span>
                    <span className="text-[10px] font-semibold text-white">{s.label}</span>
                  </div>
                  <div className="text-2xl font-black mb-1" style={{ color: s.color }}>{s.count}</div>
                  <div className="text-[9px]" style={{ color: 'rgba(143,152,160,0.7)' }}>amenazas</div>
                  {/* Mini bar */}
                  <div className="mt-2 h-1 rounded-full" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${total ? (s.count/total)*100 : 0}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top risks */}
          {result.top_risks?.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: 'rgba(42,71,94,0.2)', border: '1px solid rgba(102,192,244,0.1)' }}>
              <p className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#c94040]" /> Top riesgos prioritarios
              </p>
              <div className="space-y-2">
                {result.top_risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: 'rgba(22,32,45,0.5)', border: '1px solid rgba(102,192,244,0.07)' }}>
                    <span className="text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(201,64,64,0.2)', color: '#c94040' }}>{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[11px] font-semibold text-white">{r.title}</span>
                        <StrideBadge cat={r.stride} />
                        <RiskBadge risk={r.risk} small />
                      </div>
                      <p className="text-[10px]" style={{ color: 'rgba(143,152,160,0.7)' }}>
                        <span style={{ color: '#66c0f4' }}>{r.component}</span>
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: '#5ba32b' }} />
                        <p className="text-[10px]" style={{ color: '#5ba32b' }}>{r.priority_action}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeView === 'recommendations' && result.security_recommendations?.length > 0 && (
        <div className="space-y-2">
          {result.security_recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl"
              style={{ background: 'rgba(42,71,94,0.2)', border: '1px solid rgba(102,192,244,0.08)' }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(91,163,43,0.15)' }}>
                <CheckCircle className="w-3.5 h-3.5 text-[#5ba32b]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(102,192,244,0.1)', color: '#66c0f4' }}>{rec.category}</span>
                  <span className="text-[9px]" style={{ color: 'rgba(143,152,160,0.6)' }}>
                    Esfuerzo: <span style={{ color: EFFORT_CFG[rec.effort]?.color || '#c6d4df' }}>{rec.effort}</span>
                    {' · '}
                    Impacto: <span style={{ color: EFFORT_CFG[rec.impact]?.color || '#c6d4df' }}>{rec.impact}</span>
                  </span>
                </div>
                <p className="text-[11px] text-[#c6d4df] leading-relaxed">{rec.recommendation}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────
export function STRIDEPanel({ apiKey = '', results: scanResults = [], target = '', onRunCommand, onGoToTerminal, caseId = null }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Persist result per case in localStorage
  const storageKey = caseId ? `np-stride-${caseId}` : 'np-stride';
  const [result, setResultRaw] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); }
    catch { return null; }
  });

  const setResult = (val) => {
    setResultRaw(val);
    try {
      if (val) localStorage.setItem(storageKey, JSON.stringify(val));
      else localStorage.removeItem(storageKey);
    } catch {}
  };

  // Reload when case changes
  useState(() => {
    try {
      const key = caseId ? `np-stride-${caseId}` : 'np-stride';
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      setResultRaw(saved);
    } catch {}
  });

  const handleRunInNetProbe = (cmd) => {
    if (onRunCommand) onRunCommand(cmd);
    if (onGoToTerminal) onGoToTerminal();
  };

  // Extract open ports from scan results
  const openPorts = [...new Set(
    scanResults.flatMap(r => r.data?.open_ports || r.data?.ports || [])
      .filter(p => typeof p === 'number')
  )].slice(0, 20);

  const analyze = async ({ name, desc, comps, stack, trust, flows }) => {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${API}/api/stride/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_name:        name,
          system_description: desc,
          components:         comps,
          tech_stack:         stack,
          trust_boundaries:   trust,
          data_flows:         flows,
          scan_results:       scanResults,
          target:             target,
          open_ports:         openPorts,
          api_key:            apiKey,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="h-full overflow-y-auto p-5" style={{ background: 'rgba(23,26,33,0.2)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(155,89,182,0.15)', border: '1px solid rgba(155,89,182,0.3)' }}>
          <ShieldAlert className="w-5 h-5" style={{ color: '#9b59b6' }} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Threat Modeling STRIDE</h2>
          <p className="text-[10px]" style={{ color: 'rgba(198,212,223,0.6)' }}>
            Spoofing · Tampering · Repudiation · Information Disclosure · DoS · Elevation of Privilege
          </p>
        </div>
        {result && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-semibold"
            style={{ background: 'rgba(91,163,43,0.1)', border: '1px solid rgba(91,163,43,0.3)', color: '#5ba32b' }}>
            <CheckCircle className="w-3.5 h-3.5" /> Análisis completado
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4"
          style={{ background: 'rgba(201,64,64,0.1)', border: '1px solid rgba(201,64,64,0.3)' }}>
          <AlertTriangle className="w-4 h-4 text-[#c94040] flex-shrink-0" />
          <span className="text-[11px] text-[#c94040]">{error}</span>
        </div>
      )}

      {!result
        ? <InputForm onAnalyze={analyze} loading={loading} scanResults={scanResults} apiKey={apiKey} />
        : <Results result={result} onReset={() => setResult(null)} onRunInNetProbe={handleRunInNetProbe} />
      }
    </div>
  );
}
