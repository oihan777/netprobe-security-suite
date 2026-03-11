import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Zap, Copy, Check, Download, ChevronDown,
  AlertTriangle, Loader2, FileCode, ToggleLeft, ToggleRight,
  Info, ShieldAlert, ShieldCheck
} from 'lucide-react';

const API = 'http://localhost:8000';

// ── Paleta riesgo ─────────────────────────────────────────────────
const RISK_CFG = {
  CRITICAL: { color: '#c94040', bg: 'rgba(201,64,64,0.12)',  label: 'CRÍTICO'  },
  HIGH:     { color: '#e4692a', bg: 'rgba(228,105,42,0.12)', label: 'ALTO'     },
  MEDIUM:   { color: '#c8a951', bg: 'rgba(200,169,81,0.12)', label: 'MEDIO'    },
  LOW:      { color: '#5ba32b', bg: 'rgba(91,163,43,0.12)',  label: 'BAJO'     },
};

const FP_COLOR = {
  bajo:  '#5ba32b',
  medio: '#c8a951',
  alto:  '#e4692a',
};

const CATEGORY_COLOR = {
  Reconnaissance: '#66c0f4',
  DoS:            '#c94040',
  BruteForce:     '#e4692a',
  WebAttack:      '#9b59b6',
  Protocol:       '#66c0f4',
  DNS:            '#5ba32b',
};

// ── Helpers ───────────────────────────────────────────────────────

function RiskBadge({ risk }) {
  const cfg = RISK_CFG[risk] || RISK_CFG.LOW;
  return (
    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}30`, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function CatBadge({ category }) {
  const color = CATEGORY_COLOR[category] || '#66c0f4';
  return (
    <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
      style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}>
      {category}
    </span>
  );
}

// ── Tarjeta de regla ──────────────────────────────────────────────

function RuleCard({ rule, format, copied, onCopy }) {
  const [expanded, setExpanded] = useState(false);
  const ruleText = format === 'snort' ? rule.snort_rule : rule.suricata_rule;
  const copyKey  = `${rule.module_id}_${format}`;

  if (!ruleText) return null;

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(42,71,94,0.2)', border: '1px solid rgba(102,192,244,0.1)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: expanded ? '1px solid rgba(102,192,244,0.07)' : 'none' }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${RISK_CFG[rule.risk]?.color || '#66c0f4'}18`, border: `1px solid ${RISK_CFG[rule.risk]?.color || '#66c0f4'}30` }}>
          <ShieldAlert className="w-3 h-3" style={{ color: RISK_CFG[rule.risk]?.color || '#66c0f4' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-white">{rule.module_name}</span>
            <RiskBadge risk={rule.risk} />
            <CatBadge category={rule.ids_category} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => onCopy(copyKey, ruleText)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-colors"
            style={{ background: 'rgba(102,192,244,0.07)', border: '1px solid rgba(102,192,244,0.1)', color: 'rgba(198,212,223,0.8)' }}>
            {copied[copyKey]
              ? <><Check className="w-3 h-3" style={{ color: '#5ba32b' }} /><span style={{ color: '#5ba32b' }}>Copiado</span></>
              : <><Copy className="w-3 h-3" /> Copiar</>}
          </button>
          <button onClick={() => setExpanded(v => !v)}
            className="p-1 rounded-lg transition-colors"
            style={{ color: 'rgba(143,152,160,0.9)' }}>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Regla compacta siempre visible */}
      <div className="px-4 py-2.5 overflow-x-auto" style={{ background: 'rgba(23,26,33,0.25)' }}>
        <pre className="text-[10px] font-mono leading-relaxed whitespace-nowrap"
          style={{ color: format === 'snort' ? '#e4692a' : '#66c0f4' }}>
          {ruleText}
        </pre>
      </div>

      {/* Detalle expandible */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div className="px-4 py-3 space-y-2.5"
              style={{ borderTop: '1px solid rgba(102,192,244,0.07)' }}>

              {/* Descripción */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-1"
                  style={{ color: 'rgba(143,152,160,0.9)' }}>Qué detecta</p>
                <p className="text-[11px]" style={{ color: '#c6d4df' }}>{rule.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Riesgo de falso positivo */}
                <div className="p-3 rounded-xl"
                  style={{ background: 'rgba(42,71,94,0.2)', border: '1px solid rgba(102,192,244,0.08)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: 'rgba(143,152,160,0.9)' }}>Riesgo de falso positivo</p>
                  <p className="text-[11px] font-semibold"
                    style={{ color: FP_COLOR[rule.false_positive_risk] || '#c8a951' }}>
                    {(rule.false_positive_risk || 'medio').charAt(0).toUpperCase() + (rule.false_positive_risk || 'medio').slice(1)}
                  </p>
                </div>

                {/* Recomendación */}
                <div className="p-3 rounded-xl"
                  style={{ background: 'rgba(42,71,94,0.2)', border: '1px solid rgba(102,192,244,0.08)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: 'rgba(143,152,160,0.9)' }}>Recomendación de tuning</p>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{rule.recommendation}</p>
                </div>
              </div>

              {/* Mostrar ambos formatos si están disponibles */}
              {rule.snort_rule && rule.suricata_rule && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: 'rgba(143,152,160,0.9)' }}>
                    Formato alternativo ({format === 'snort' ? 'Suricata' : 'Snort'})
                  </p>
                  <div className="p-3 rounded-xl overflow-x-auto" style={{ background: 'rgba(23,26,33,0.3)' }}>
                    <pre className="text-[10px] font-mono whitespace-nowrap"
                      style={{ color: format === 'snort' ? '#66c0f4' : '#e4692a' }}>
                      {format === 'snort' ? rule.suricata_rule : rule.snort_rule}
                    </pre>
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

// ── Panel principal ───────────────────────────────────────────────

export function IDSRulesPanel({ results = [], target = '', apiKey = '' }) {
  const [format,    setFormat]   = useState('suricata');
  const [loading,   setLoading]  = useState(false);
  const [rules,     setRules]    = useState(null);
  const [error,     setError]    = useState('');
  const [copied,    setCopied]   = useState({});
  const [filterCat, setFilterCat]= useState('all');
  const [filterRisk,setFilterRisk]= useState('all');

  // Contar vulnerabilidades disponibles
  const vulnerable = results.filter(r => r.status === 'PASSED' || r.status === 'PARTIAL');

  const generate = useCallback(async () => {
    if (!apiKey) { setError('Necesitas una API key de Groq en la barra lateral'); return; }
    if (!vulnerable.length) { setError('No hay vulnerabilidades detectadas en el scan actual'); return; }

    setError(''); setLoading(true); setRules(null);
    try {
      const resp = await fetch(`${API}/api/ids/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          results: vulnerable.map(r => ({
            module_id:   r.module_id   || r.id   || '',
            module_name: r.module_name || r.name || r.module_id || '',
            status:      r.status,
            category:    r.category    || '',
            risk:        r.risk        || 'MEDIUM',
            output:      r.output      || '',
          })),
          groq_key: apiKey,
          format: 'both',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Error generando reglas');
      setRules(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiKey, target, vulnerable]);

  const copy = (key, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(c => ({ ...c, [key]: true }));
      setTimeout(() => setCopied(c => ({ ...c, [key]: false })), 2000);
    });
  };

  // Exportar todas las reglas como archivo
  const exportAll = async () => {
    if (!rules?.rules?.length) return;
    try {
      const resp = await fetch(`${API}/api/ids/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: rules.rules, format, target }),
      });
      const data = await resp.json();
      const blob = new Blob([data.content], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = data.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  };

  // Copiar todas
  const copyAll = () => {
    if (!rules?.rules?.length) return;
    const lines = rules.rules
      .map(r => format === 'snort' ? r.snort_rule : r.suricata_rule)
      .filter(Boolean)
      .join('\n');
    copy('all', lines);
  };

  // Filtros
  const categories = rules
    ? ['all', ...new Set(rules.rules.map(r => r.ids_category).filter(Boolean))]
    : ['all'];
  const risks = ['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

  const filteredRules = rules?.rules?.filter(r => {
    if (filterCat  !== 'all' && r.ids_category !== filterCat)  return false;
    if (filterRisk !== 'all' && r.risk          !== filterRisk) return false;
    return true;
  }) || [];

  // Agrupar por categoría
  const grouped = filteredRules.reduce((acc, r) => {
    const cat = r.ids_category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#1b2838', color: '#fff' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid rgba(102,192,244,0.1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(91,163,43,0.15)', border: '1px solid rgba(91,163,43,0.3)' }}>
            <Shield className="w-3.5 h-3.5" style={{ color: '#5ba32b' }} />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">IDS / IPS Rule Generator</p>
            <p className="text-[10px]" style={{ color: 'rgba(198,212,223,0.6)' }}>
              Genera reglas Snort y Suricata desde los resultados del scan · IA Groq
            </p>
          </div>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-3">
          {/* Toggle formato */}
          {rules && (
            <div className="flex items-center gap-1 p-1 rounded-xl"
              style={{ background: 'rgba(42,71,94,0.4)', border: '1px solid rgba(102,192,244,0.1)' }}>
              {['snort', 'suricata'].map(f => (
                <button key={f} onClick={() => setFormat(f)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors capitalize"
                  style={format === f
                    ? { background: f === 'snort' ? 'rgba(228,105,42,0.2)' : 'rgba(102,192,244,0.15)', color: f === 'snort' ? '#e4692a' : '#66c0f4', border: `1px solid ${f === 'snort' ? 'rgba(228,105,42,0.3)' : 'rgba(102,192,244,0.25)'}` }
                    : { color: 'rgba(198,212,223,0.6)', border: '1px solid transparent' }}>
                  {f}
                </button>
              ))}
            </div>
          )}

          {/* Copiar todo */}
          {rules && (
            <button onClick={copyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-colors"
              style={{ background: 'rgba(102,192,244,0.07)', border: '1px solid rgba(102,192,244,0.15)', color: 'rgba(198,212,223,0.8)' }}>
              {copied.all
                ? <><Check className="w-3 h-3" style={{ color: '#5ba32b' }} /><span style={{ color: '#5ba32b' }}>Copiado</span></>
                : <><Copy className="w-3 h-3" /> Copiar todo</>}
            </button>
          )}

          {/* Exportar */}
          {rules && (
            <button onClick={exportAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-colors"
              style={{ background: 'rgba(91,163,43,0.1)', border: '1px solid rgba(91,163,43,0.25)', color: '#5ba32b' }}>
              <Download className="w-3 h-3" /> .rules
            </button>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Sidebar izquierdo ──────────────────────────────────── */}
        <div className="w-[260px] flex-shrink-0 flex flex-col overflow-hidden p-4 space-y-4"
          style={{ borderRight: '1px solid rgba(102,192,244,0.1)' }}>

          {/* Stats del scan */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-3"
              style={{ color: 'rgba(143,152,160,0.9)' }}>Scan actual</p>
            <div className="space-y-2">
              <StatRow label="Módulos ejecutados" value={results.length} color="#66c0f4" />
              <StatRow label="Vulnerabilidades"   value={vulnerable.length} color="#c94040" />
              <StatRow label="Reglas generadas"   value={rules?.total || 0} color="#5ba32b" />
            </div>
          </div>

          {/* Filtro por categoría */}
          {rules && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
                style={{ color: 'rgba(143,152,160,0.9)' }}>Categoría</p>
              <div className="space-y-1">
                {categories.map(cat => {
                  const col = CATEGORY_COLOR[cat] || '#66c0f4';
                  const count = cat === 'all'
                    ? rules.rules.length
                    : rules.rules.filter(r => r.ids_category === cat).length;
                  return (
                    <button key={cat} onClick={() => setFilterCat(cat)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left"
                      style={filterCat === cat
                        ? { background: `${col}12`, border: `1px solid ${col}30` }
                        : { background: 'rgba(42,71,94,0.2)', border: '1px solid rgba(102,192,244,0.07)' }}>
                      <span className="text-[11px]"
                        style={{ color: filterCat === cat ? col : 'rgba(198,212,223,0.8)' }}>
                        {cat === 'all' ? 'Todas' : cat}
                      </span>
                      <span className="text-[10px] font-mono"
                        style={{ color: 'rgba(143,152,160,0.9)' }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filtro por riesgo */}
          {rules && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
                style={{ color: 'rgba(143,152,160,0.9)' }}>Riesgo</p>
              <div className="space-y-1">
                {risks.map(risk => {
                  const cfg = RISK_CFG[risk];
                  const count = risk === 'all'
                    ? rules.rules.length
                    : rules.rules.filter(r => r.risk === risk).length;
                  if (risk !== 'all' && count === 0) return null;
                  return (
                    <button key={risk} onClick={() => setFilterRisk(risk)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left"
                      style={filterRisk === risk
                        ? { background: cfg ? cfg.bg : 'rgba(102,192,244,0.07)', border: `1px solid ${cfg?.color || '#66c0f4'}30` }
                        : { background: 'rgba(42,71,94,0.2)', border: '1px solid rgba(102,192,244,0.07)' }}>
                      <span className="text-[11px]"
                        style={{ color: filterRisk === risk ? (cfg?.color || '#66c0f4') : 'rgba(198,212,223,0.8)' }}>
                        {risk === 'all' ? 'Todos' : cfg?.label || risk}
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: 'rgba(143,152,160,0.9)' }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Botón generar */}
          <div className="mt-auto pt-2">
            <button onClick={generate} disabled={loading || !vulnerable.length}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: (!vulnerable.length || loading) ? 'rgba(91,163,43,0.2)' : '#5ba32b',
                color: (!vulnerable.length || loading) ? 'rgba(91,163,43,0.5)' : '#000',
                cursor: (!vulnerable.length || loading) ? 'not-allowed' : 'pointer',
              }}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" style={{ color: 'rgba(91,163,43,0.7)' }} /> Generando...</>
                : <><Zap className="w-4 h-4" /> Generar reglas</>}
            </button>
            {!vulnerable.length && !loading && (
              <p className="mt-2 text-[10px] text-center" style={{ color: 'rgba(143,152,160,0.9)' }}>
                Ejecuta un scan primero
              </p>
            )}
            {error && (
              <p className="mt-2 text-[10px] text-center" style={{ color: '#c94040' }}>{error}</p>
            )}
          </div>
        </div>

        {/* ── Área principal ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Empty state */}
          {!rules && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(42,71,94,0.2)', border: '1px solid rgba(102,192,244,0.1)' }}>
                <FileCode className="w-7 h-7" style={{ color: 'rgba(143,152,160,0.4)' }} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(143,152,160,0.6)' }}>
                {vulnerable.length > 0
                  ? `${vulnerable.length} vulnerabilidad${vulnerable.length > 1 ? 'es' : ''} lista${vulnerable.length > 1 ? 's' : ''} para convertir en reglas`
                  : 'Ejecuta un scan para generar reglas IDS'}
              </p>
              <p className="text-xs" style={{ color: 'rgba(143,152,160,0.4)' }}>
                La IA generará reglas Snort y Suricata basadas en los ataques que superaron tus defensas
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#5ba32b' }} />
                <p className="text-sm" style={{ color: 'rgba(198,212,223,0.7)' }}>
                  Groq generando reglas Snort & Suricata...
                </p>
              </div>
            </div>
          )}

          {/* Resultados */}
          {rules && !loading && (
            <div className="space-y-6">

              {/* Summary */}
              <div className="p-4 rounded-xl"
                style={{ background: 'rgba(91,163,43,0.06)', border: '1px solid rgba(91,163,43,0.15)' }}>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#5ba32b' }} />
                  <p className="text-[11px] leading-relaxed" style={{ color: '#c6d4df' }}>
                    {rules.summary}
                  </p>
                </div>
              </div>

              {/* Reglas por categoría */}
              {Object.entries(grouped).map(([cat, catRules]) => {
                const col = CATEGORY_COLOR[cat] || '#66c0f4';
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1" style={{ background: `${col}25` }} />
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2"
                        style={{ color: col }}>{cat}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: `${col}15`, color: col }}>{catRules.length}</span>
                      <div className="h-px flex-1" style={{ background: `${col}25` }} />
                    </div>
                    <div className="space-y-2">
                      {catRules.map(rule => (
                        <RuleCard key={rule.module_id} rule={rule}
                          format={format} copied={copied} onCopy={copy} />
                      ))}
                    </div>
                  </div>
                );
              })}

              {filteredRules.length === 0 && (
                <div className="text-center py-12"
                  style={{ color: 'rgba(143,152,160,0.6)' }}>
                  <p className="text-sm">Sin reglas para los filtros aplicados</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── StatRow ───────────────────────────────────────────────────────

function StatRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-xl"
      style={{ background: `${color}08`, border: `1px solid ${color}18` }}>
      <span className="text-[10px]" style={{ color: 'rgba(198,212,223,0.7)' }}>{label}</span>
      <span className="text-sm font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

export default IDSRulesPanel;
