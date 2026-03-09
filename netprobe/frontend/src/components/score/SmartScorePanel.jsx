import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Shield,
         ChevronDown, Zap, CheckCircle2, Info, Minus } from 'lucide-react';

const API = 'http://localhost:8000';

const RISK_CFG = {
  CRITICAL: { color: '#ff453a', weight: 4, label: 'Crítico' },
  HIGH:     { color: '#ff9f0a', weight: 3, label: 'Alto'    },
  MEDIUM:   { color: '#ffd60a', weight: 2, label: 'Medio'   },
  LOW:      { color: '#30d158', weight: 1, label: 'Bajo'    },
};

function scoreColor(s) {
  if (s >= 80) return '#30d158';
  if (s >= 60) return '#ff9f0a';
  if (s >= 35) return '#ff6b35';
  return '#ff453a';
}
function scoreLabel(s) {
  if (s >= 80) return 'Seguro';
  if (s >= 60) return 'Aceptable';
  if (s >= 35) return 'En Riesgo';
  return 'Crítico';
}

// ── Score ring ────────────────────────────────────────────────────
function ScoreRing({ score, size = 96, method }) {
  const r    = (size/2) - 8;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const col  = scoreColor(score);

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={col} strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - fill }}
          transition={{ duration: 1.2, ease: 'easeOut' }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-black leading-none" style={{ color: col }}>{score}</span>
        <span className="text-[8px] font-bold" style={{ color: col }}>{scoreLabel(score)}</span>
        {method === 'ai' && (
          <span className="text-[7px] text-[rgba(191,90,242,0.8)] font-semibold mt-0.5 flex items-center gap-0.5">
            <Brain className="w-2 h-2" />IA
          </span>
        )}
      </div>
    </div>
  );
}

// ── Module breakdown bar ──────────────────────────────────────────
function ModuleBar({ item }) {
  const risk = RISK_CFG[item.risk] || RISK_CFG.MEDIUM;
  const sc   = item.score ?? 0;
  const col  = scoreColor(sc);

  return (
    <div className="flex items-center gap-2 py-1">
      <div className="w-2 flex-shrink-0 flex flex-col gap-0.5">
        {Array.from({ length: Math.round(risk.weight) }).map((_, i) => (
          <div key={i} className="h-1 w-2 rounded-sm" style={{ background: risk.color }} />
        ))}
      </div>
      <span className="text-[10px] text-[rgba(255,255,255,0.6)] w-32 truncate flex-shrink-0">{item.name || item.module}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)]">
        <motion.div className="h-full rounded-full"
          style={{ background: col }}
          initial={{ width: 0 }}
          animate={{ width: `${sc}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }} />
      </div>
      <span className="text-[10px] font-bold w-8 text-right flex-shrink-0" style={{ color: col }}>{sc}</span>
      <span className="text-[9px] w-12 text-right flex-shrink-0" style={{ color: risk.color }}>{risk.label}</span>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────
export function SmartScorePanel({ results = [], apiKey = '', target = '' }) {
  const [data,       setData]    = useState(null);
  const [loading,    setLoading] = useState(false);
  const [expanded,   setExpanded]= useState(false);
  const [showBreak,  setShowBreak]=useState(false);
  const [error,      setError]   = useState('');

  const compute = async () => {
    if (!results.length) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`${API}/api/score/smart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, api_key: apiKey, target }),
      });
      const json = await resp.json();
      setData(json);
      setExpanded(true);
    } catch(e) {
      setError('Error al calcular score: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-compute when results change
  useEffect(() => {
    if (results.length > 0) compute();
  }, [results.length]);

  if (!results.length) return null;

  const score      = data?.adjusted_score ?? 0;
  const weighted   = data?.weighted_score ?? 0;
  const diff       = data ? score - weighted : 0;
  const method     = data?.method || 'pending';
  const isAI       = method === 'ai';
  const breakdown  = data?.breakdown || [];
  const combos     = data?.combo_penalties || [];
  const factors    = data?.risk_factors || [];
  const strengths  = data?.strengths || [];

  return (
    <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
      className="rounded-xl border border-[rgba(255,255,255,0.09)] overflow-hidden"
      style={{ background:'rgba(255,255,255,0.02)' }}>

      {/* Header row */}
      <div className="flex items-center gap-4 p-4">
        {data ? (
          <ScoreRing score={score} method={method} />
        ) : (
          <div className="w-24 h-24 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ border:'2px solid rgba(255,255,255,0.08)' }}>
            {loading
              ? <div className="w-6 h-6 border-2 border-[#bf5af2] border-t-transparent rounded-full animate-spin" />
              : <Brain className="w-6 h-6 text-[rgba(255,255,255,0.2)]" />}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-white">Score Inteligente</span>
            {isAI && (
              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background:'rgba(191,90,242,0.15)', color:'#bf5af2', border:'1px solid rgba(191,90,242,0.3)' }}>
                <Brain className="w-2.5 h-2.5" /> Groq IA
              </span>
            )}
            {method === 'rules' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background:'rgba(255,159,10,0.1)', color:'#ff9f0a', border:'1px solid rgba(255,159,10,0.25)' }}>
                Ponderado
              </span>
            )}
          </div>

          {data?.key_finding && (
            <p className="text-[11px] text-[rgba(255,255,255,0.55)] leading-relaxed line-clamp-2 mb-2">
              {data.key_finding}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {diff !== 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold"
                style={{ color: diff >= 0 ? '#30d158' : '#ff453a' }}>
                {diff >= 0
                  ? <TrendingUp className="w-3 h-3"/>
                  : <TrendingDown className="w-3 h-3"/>}
                {diff >= 0 ? '+' : ''}{diff} ajuste IA
              </span>
            )}
            {weighted > 0 && (
              <span className="text-[10px] text-[rgba(255,255,255,0.3)]">
                Base ponderado: {weighted}
              </span>
            )}
            {data?.confidence && (
              <span className="text-[10px] text-[rgba(255,255,255,0.3)]">
                Confianza: {data.confidence}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button onClick={compute} disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-40"
            style={{ background:'rgba(191,90,242,0.1)', border:'1px solid rgba(191,90,242,0.3)', color:'#bf5af2' }}>
            {loading
              ? <div className="w-3 h-3 border-2 border-[#bf5af2] border-t-transparent rounded-full animate-spin" />
              : <Brain className="w-3 h-3" />}
            {loading ? 'Analizando…' : 'Recalcular'}
          </button>
          {data && (
            <button onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all"
              style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.5)' }}>
              <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? 'Ocultar' : 'Detalle'}
            </button>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {expanded && data && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
            exit={{ height:0, opacity:0 }} style={{ overflow:'hidden' }}>
            <div className="border-t border-[rgba(255,255,255,0.06)] px-4 pb-4 pt-3 space-y-4">

              {/* Risk factors & strengths */}
              {(factors.length > 0 || strengths.length > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  {factors.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] uppercase tracking-widest font-semibold text-[rgba(255,69,58,0.8)] flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> Factores de riesgo
                      </p>
                      {factors.map((f, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[10px] text-[rgba(255,255,255,0.55)]">
                          <span className="text-[#ff453a] mt-0.5 flex-shrink-0">•</span>{f}
                        </div>
                      ))}
                    </div>
                  )}
                  {strengths.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] uppercase tracking-widest font-semibold text-[rgba(48,209,88,0.8)] flex items-center gap-1">
                        <Shield className="w-2.5 h-2.5" /> Fortalezas
                      </p>
                      {strengths.map((s, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[10px] text-[rgba(255,255,255,0.55)]">
                          <CheckCircle2 className="w-3 h-3 text-[#30d158] mt-0.5 flex-shrink-0" />{s}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Combo penalties */}
              {combos.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] uppercase tracking-widest font-semibold flex items-center gap-1"
                    style={{ color:'rgba(255,69,58,0.7)' }}>
                    <Zap className="w-2.5 h-2.5" /> Combinaciones peligrosas detectadas
                  </p>
                  {combos.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 px-2.5 py-2 rounded-lg"
                      style={{ background:'rgba(255,69,58,0.07)', border:'1px solid rgba(255,69,58,0.2)' }}>
                      <span className="text-[9px] font-bold text-[#ff453a] mt-0.5 flex-shrink-0">-{c.penalty}</span>
                      <div>
                        <span className="text-[9px] font-mono text-[rgba(255,255,255,0.5)]">{c.modules.join(' + ')}</span>
                        <p className="text-[10px] text-[rgba(255,255,255,0.5)] mt-0.5">{c.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI reasoning */}
              {data.reasoning && isAI && (
                <div className="flex gap-2 px-3 py-2.5 rounded-lg"
                  style={{ background:'rgba(191,90,242,0.06)', border:'1px solid rgba(191,90,242,0.15)' }}>
                  <Brain className="w-3.5 h-3.5 text-[#bf5af2] flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-[rgba(255,255,255,0.55)] leading-relaxed">{data.reasoning}</p>
                </div>
              )}

              {/* Module breakdown */}
              {breakdown.length > 0 && (
                <div>
                  <button onClick={() => setShowBreak(s => !s)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold text-[rgba(255,255,255,0.4)] hover:text-white transition-colors mb-2">
                    <ChevronDown className={`w-3 h-3 transition-transform ${showBreak ? 'rotate-180' : ''}`} />
                    Desglose por módulo
                    <span className="text-[9px] font-normal text-[rgba(255,255,255,0.25)]">
                      (peso = {'{'}LOW×1, MED×2, HIGH×3, CRIT×4{'}'})
                    </span>
                  </button>
                  <AnimatePresence>
                    {showBreak && (
                      <motion.div initial={{ height:0 }} animate={{ height:'auto' }} exit={{ height:0 }}
                        style={{ overflow:'hidden' }}>
                        <div className="space-y-0.5 pr-2">
                          {breakdown.map((item, i) => <ModuleBar key={i} item={item} />)}
                        </div>
                        <div className="mt-3 text-[9px] text-[rgba(255,255,255,0.25)] flex items-center gap-1.5">
                          <Info className="w-2.5 h-2.5" />
                          Las barras de peso (izquierda) indican cuánto influye cada módulo en el score final
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="px-4 pb-3 text-[10px] text-[#ff453a]">{error}</div>
      )}
    </motion.div>
  );
}
