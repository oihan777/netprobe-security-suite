import { SmartScorePanel } from '../score/SmartScorePanel.jsx';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Loader2, Sparkles, Filter, SortAsc, Terminal, FileText } from 'lucide-react';
import { CATEGORIES, STATUS_CONFIG } from '../../data/modules.js';
import { getScoreColor, getScoreLabel } from '../../utils/formatters.js';

// ── Score gauge ───────────────────────────────────────────────────
function ScoreGauge({ score }) {
  const c = getScoreColor(score);
  const r = 44, circ = 2 * Math.PI * r;
  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
        <motion.circle cx="50" cy="50" r={r} fill="none" stroke={c} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (score / 100) * circ }}
          transition={{ duration: 1.2, ease: 'easeOut' }} />
      </svg>
      <div className="text-center">
        <div className="text-2xl font-bold" style={{ color: c }}>{score}</div>
        <div className="text-[10px] text-[rgba(255,255,255,0.4)]">/ 100</div>
      </div>
    </div>
  );
}

// ── Format duration ───────────────────────────────────────────────
function fmtDuration(ms) {
  if (!ms && ms !== 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`;
  return `${Math.floor(ms/60000)}m ${Math.round((ms%60000)/1000)}s`;
}

// ── Command explanation (heuristic) ──────────────────────────────
function explainCommand(cmd) {
  if (!cmd) return '';
  const explanations = [
    [/nmap\s+-sn/,         'Ping scan — descubre hosts sin escanear puertos'],
    [/nmap\s+-sS/,         'SYN scan sigiloso — no completa el handshake TCP'],
    [/nmap\s+-sV/,         'Detección de versiones de servicios'],
    [/nmap\s+-O/,          'Detección del sistema operativo mediante fingerprinting TCP/IP'],
    [/nmap\s+-A/,          'Scan agresivo: OS, versiones, scripts y traceroute'],
    [/nmap\s+-T(\d)/,      (m) => `Timing T${m[1]}: ${['Paranoico','Sigiloso','Cortés','Normal','Agresivo','Insano'][m[1]]||'ajustado'}`],
    [/nmap\s+--script/,    'Scripts NSE para detección avanzada de vulnerabilidades'],
    [/-p\s+([\d,-]+)/,     (m) => `Escaneo de puertos: ${m[1]}`],
    [/hydra\s+/,           'Fuerza bruta de credenciales con diccionario'],
    [/hping3\s+/,          'Generación de paquetes TCP/UDP/ICMP personalizados'],
    [/sqlmap\s+/,          'Detección y explotación automática de inyección SQL'],
    [/--flood/,            'Modo flood: envío máximo de paquetes sin esperar respuesta'],
    [/--syn/,              'Paquetes SYN: inicio de conexión TCP sin completar (DoS)'],
    [/--udp/,              'Paquetes UDP: protocolo sin conexión, difícil de filtrar'],
    [/-D\s+RND/,           'Decoy scan: usa IPs señuelo para ocultar el origen real'],
    [/--ttl\s+(\d+)/,      (m) => `TTL forzado a ${m[1]}: evita detección por análisis de red`],
    [/--source-port\s+53/, 'Puerto origen 53 (DNS): bypassa firewalls que confían en DNS'],
    [/dig\s+/,             'Consulta DNS directa al servidor'],
    [/snmpget|snmpwalk/,   'Consulta SNMP: obtiene información del dispositivo por MIB'],
    [/curl|httpx/,         'Petición HTTP/HTTPS para análisis de la aplicación web'],
  ];

  for (const [pattern, explain] of explanations) {
    const m = cmd.match(pattern);
    if (m) return typeof explain === 'function' ? explain(m) : explain;
  }
  return 'Comando de análisis de seguridad';
}

// ── Parse nmap flags ──────────────────────────────────────────────
function parseFlags(cmd) {
  const flags = [];
  const patterns = [
    [/-sS/g, '-sS', 'SYN Stealth scan'],
    [/-sV/g, '-sV', 'Detección de versiones'],
    [/-sU/g, '-sU', 'UDP scan'],
    [/-sn/g, '-sn', 'Ping scan (sin puertos)'],
    [/-O\b/g, '-O', 'OS detection'],
    [/-A\b/g, '-A', 'Modo agresivo'],
    [/-T(\d)/g, null, null],
    [/--min-rate\s+(\d+)/g, null, null],
    [/-p\s+([\S]+)/g, null, null],
    [/--flood/g, '--flood', 'Envío máximo de paquetes'],
    [/--syn/g, '--syn', 'Paquetes SYN'],
    [/--udp/g, '--udp', 'Paquetes UDP'],
    [/-c\s+(\d+)/g, null, null],
    [/--script\s+(\S+)/g, null, null],
    [/-D\s+(\S+)/g, null, null],
    [/--ttl\s+(\d+)/g, null, null],
    [/--source-port\s+(\d+)/g, null, null],
  ];
  // Just extract all flags that look like -x or --xxx
  const raw = cmd.match(/(?:--?[\w-]+=?[\w,./]*)/g) || [];
  return raw.slice(0, 8); // cap at 8
}

// ── AI analysis hook — calls backend ─────────────────────────────
function useAIAnalysis(apiKey) {
  const [cache,   setCache]   = useState({});
  const [loading, setLoading] = useState({});

  const analyze = useCallback(async (result) => {
    const key = result.id;
    if (cache[key] || loading[key]) return;
    if (!apiKey) {
      setCache(c => ({ ...c, [key]: '_no_key_' }));
      return;
    }
    setLoading(l => ({ ...l, [key]: true }));
    try {
      const res = await fetch('http://localhost:8000/api/ai/analyze-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, result }),
      });
      const data = await res.json();
      setCache(c => ({ ...c, [key]: data.analysis || data.error || 'Sin análisis.' }));
    } catch (e) {
      setCache(c => ({ ...c, [key]: `Error: ${e.message}` }));
    } finally {
      setLoading(l => ({ ...l, [key]: false }));
    }
  }, [cache, loading, apiKey]);

  return { cache, loading, analyze };
}

// ── Render bold markdown ──────────────────────────────────────────
function AIText({ text }) {
  if (text === '_no_key_') return (
    <p className="text-[11px] text-[rgba(255,255,255,0.3)] italic">
      Introduce una API Key de Groq en el sidebar para activar el análisis IA.
    </p>
  );
  return (
    <div className="space-y-1.5">
      {text.split('\n').filter(l => l.trim()).map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="text-[11px] leading-relaxed text-[rgba(255,255,255,0.72)]">
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={j} className="text-white font-semibold">{p.slice(2,-2)}</strong>
                : <span key={j}>{p}</span>
            )}
          </p>
        );
      })}
    </div>
  );
}

// ── Risk bar ──────────────────────────────────────────────────────
function RiskIndicator({ status }) {
  const levels = [
    { label: 'Bajo',    color: '#30d158', statuses: ['BLOCKED']  },
    { label: 'Medio',   color: '#ff9f0a', statuses: ['DETECTED'] },
    { label: 'Alto',    color: '#ff6b35', statuses: ['PARTIAL']  },
    { label: 'Crítico', color: '#ff453a', statuses: ['PASSED']   },
  ];
  const current = levels.find(l => l.statuses.includes(status)) || levels[1];
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.06)] px-3 py-2 bg-[rgba(255,255,255,0.02)]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.3)]">Nivel de riesgo</span>
        <span className="text-[10px] font-bold" style={{ color: current.color }}>{current.label}</span>
      </div>
      <div className="flex gap-1">
        {levels.map((l) => (
          <div key={l.label} className="flex-1 h-1 rounded-full transition-all duration-500"
            style={{ background: l.label === current.label ? l.color : 'rgba(255,255,255,0.07)' }} />
        ))}
      </div>
    </div>
  );
}

// ── Expandable result row ─────────────────────────────────────────
function ResultRow({ result, index, apiKey, aiCache, aiLoading, onAnalyze }) {
  const [open,    setOpen]    = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const cfg = STATUS_CONFIG[result.status] || STATUS_CONFIG.ERROR;
  const cat = CATEGORIES[result.category];

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !aiCache[result.id] && !aiLoading[result.id]) {
      onAnalyze(result);
    }
  };

  const commands   = result.commands   || [];
  const rawOutput  = result.raw_output || '';
  const details    = result.details    || result.data || {};
  const durationMs = result.duration_ms;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="border-b border-[rgba(255,255,255,0.05)] last:border-0">

      {/* ── Collapsed header ── */}
      <button onClick={toggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[rgba(255,255,255,0.025)] transition-colors text-left group">
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.18 }} className="flex-shrink-0">
          <ChevronRight className="w-3.5 h-3.5 text-[rgba(255,255,255,0.2)] group-hover:text-[rgba(255,255,255,0.5)]" />
        </motion.span>

        <span className="text-base w-5 text-center flex-shrink-0">{cfg.emoji}</span>

        <div className="flex-1 min-w-0">
          <div className="text-sm text-white font-medium truncate">{result.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: `${cat?.color || '#fff'}15`, color: cat?.color || '#fff' }}>
              {cat?.name || result.category}
            </span>
            <span className="text-[9px] text-[rgba(255,255,255,0.25)] font-mono">
              {new Date(result.timestamp).toLocaleTimeString('es-ES')}
            </span>
            {durationMs != null && (
              <span className="text-[9px] text-[rgba(255,255,255,0.2)] font-mono">
                {fmtDuration(durationMs)}
              </span>
            )}
            {commands.length > 0 && (
              <span className="text-[8px] flex items-center gap-0.5 text-[rgba(100,210,255,0.5)]">
                <Terminal className="w-2.5 h-2.5" />{commands.length} cmd
              </span>
            )}
            {aiCache[result.id] && aiCache[result.id] !== '_no_key_' && (
              <span className="text-[8px] flex items-center gap-0.5 text-[rgba(0,255,136,0.6)]">
                <Sparkles className="w-2.5 h-2.5" />IA
              </span>
            )}
          </div>
        </div>

        {/* Score bar */}
        <div className="hidden sm:flex items-center gap-2 w-28 flex-shrink-0">
          <div className="flex-1 h-1 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ background: cfg.color }}
              initial={{ width: 0 }}
              animate={{ width: `${result.score ?? 0}%` }}
              transition={{ duration: 0.8, delay: index * 0.02 }} />
          </div>
          <span className="text-xs font-mono font-bold w-5 text-right" style={{ color: cfg.color }}>
            {result.score ?? '—'}
          </span>
        </div>

        <span className="flex-shrink-0 px-2 py-1 rounded-lg text-[9px] font-bold tracking-wider"
          style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}28` }}>
          {cfg.label}
        </span>
      </button>

      {/* ── Expanded panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}>

            <div className="mx-4 mb-4 mt-1 space-y-3 border-t border-[rgba(255,255,255,0.05)] pt-3">

              {/* Row 1: metrics + AI */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

                {/* Left: metrics */}
                <div className="space-y-2.5">
                  <p className="text-[8px] uppercase tracking-widest text-[rgba(255,255,255,0.3)] font-semibold">
                    Detalles técnicos
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      ['Estado',    cfg.label,                     cfg.color],
                      ['Score',     result.score != null ? `${result.score}/100` : 'N/A', cfg.color],
                      ['Categoría', cat?.name || result.category,  cat?.color || 'rgba(255,255,255,0.6)'],
                      ['ID',        result.id,                     'rgba(255,255,255,0.35)'],
                      ['Duración',  fmtDuration(durationMs),       'rgba(255,255,255,0.5)'],
                      ['Hora',      new Date(result.timestamp).toLocaleTimeString('es-ES'), 'rgba(255,255,255,0.35)'],
                    ].map(([lbl, val, col]) => (
                      <div key={lbl} className="rounded-lg px-2.5 py-2 border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                        <div className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.25)] mb-0.5">{lbl}</div>
                        <div className="text-[11px] font-mono font-semibold truncate" style={{ color: col }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <RiskIndicator status={result.status} />
                </div>

                {/* Right: AI */}
                <div className="space-y-2.5">
                  <p className="text-[8px] uppercase tracking-widest text-[rgba(255,255,255,0.3)] font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-[rgba(0,255,136,0.6)]" />
                    Análisis IA
                  </p>
                  <div className="rounded-xl border p-3.5 min-h-[90px] flex items-start"
                    style={{ borderColor: 'rgba(0,255,136,0.12)', background: 'rgba(0,255,136,0.025)' }}>
                    {aiLoading[result.id] ? (
                      <div className="flex items-center gap-2.5">
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 text-[#00ff88]" />
                        <div>
                          <p className="text-xs text-[rgba(255,255,255,0.5)]">Analizando resultado...</p>
                          <p className="text-[9px] text-[rgba(255,255,255,0.25)] mt-0.5">Consultando IA (Groq)</p>
                        </div>
                      </div>
                    ) : aiCache[result.id] ? (
                      <AIText text={aiCache[result.id]} />
                    ) : (
                      <p className="text-xs text-[rgba(255,255,255,0.25)]">Generando análisis...</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Commands used */}
              {commands.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[8px] uppercase tracking-widest text-[rgba(255,255,255,0.3)] font-semibold flex items-center gap-1.5">
                    <Terminal className="w-3 h-3 text-[rgba(100,210,255,0.6)]" />
                    Comandos ejecutados ({commands.length})
                  </p>
                  <div className="space-y-1.5">
                    {commands.map((cmd, ci) => (
                      <div key={ci} className="rounded-lg border border-[rgba(100,210,255,0.1)] bg-[rgba(0,0,0,0.3)] overflow-hidden">
                        {/* Command line */}
                        <div className="flex items-start gap-2 px-3 py-2 border-b border-[rgba(255,255,255,0.05)]">
                          <span className="text-[rgba(100,210,255,0.5)] font-mono text-[10px] mt-0.5 flex-shrink-0">$</span>
                          <code className="text-[10px] font-mono text-[rgba(100,210,255,0.9)] break-all leading-relaxed flex-1">{cmd}</code>
                        </div>
                        {/* Flags breakdown */}
                        <div className="px-3 py-2 space-y-1.5">
                          <p className="text-[9px] text-[rgba(255,255,255,0.35)] italic">{explainCommand(cmd)}</p>
                          {parseFlags(cmd).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {parseFlags(cmd).map((flag, fi) => (
                                <span key={fi} className="text-[8px] px-1.5 py-0.5 rounded font-mono"
                                  style={{ background: 'rgba(100,210,255,0.08)', color: 'rgba(100,210,255,0.7)', border: '1px solid rgba(100,210,255,0.15)' }}>
                                  {flag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 3: Raw output */}
              {rawOutput && (
                <div className="space-y-2">
                  <button onClick={() => setRawOpen(o => !o)}
                    className="text-[8px] uppercase tracking-widest text-[rgba(255,255,255,0.3)] font-semibold flex items-center gap-1.5 hover:text-[rgba(255,255,255,0.6)] transition-colors">
                    <FileText className="w-3 h-3" />
                    Salida completa del comando
                    <ChevronRight className={`w-3 h-3 transition-transform ${rawOpen ? 'rotate-90' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {rawOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}>
                        <div className="rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(0,0,0,0.4)] max-h-64 overflow-y-auto">
                          <pre className="p-3 text-[9px] font-mono text-[rgba(255,255,255,0.45)] whitespace-pre-wrap leading-relaxed">
                            {rawOutput}
                          </pre>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Row 4: Module data */}
              {Object.keys(details).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[8px] uppercase tracking-widest text-[rgba(255,255,255,0.3)] font-semibold">
                    Datos del módulo
                  </p>
                  <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.25)] max-h-36 overflow-y-auto">
                    <pre className="p-3 text-[9px] font-mono text-[rgba(255,255,255,0.4)] whitespace-pre-wrap leading-relaxed">
                      {JSON.stringify(details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main export ───────────────────────────────────────────────────
export function Results({ results, globalScore, apiKey, target = '' }) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [catFilter,    setCatFilter]    = useState('ALL');
  const [sortBy,       setSortBy]       = useState('time');
  const { cache, loading, analyze }     = useAIAnalysis(apiKey);

  const byStatus = { BLOCKED:[], DETECTED:[], PARTIAL:[], PASSED:[], ERROR:[] };
  results.forEach(r => (byStatus[r.status] || byStatus.ERROR).push(r));

  let visible = [...results];
  if (statusFilter !== 'ALL') visible = visible.filter(r => r.status === statusFilter);
  if (catFilter    !== 'ALL') visible = visible.filter(r => r.category === catFilter);
  if (sortBy === 'score')  visible.sort((a, b) => (a.score ?? -1) - (b.score ?? -1));
  if (sortBy === 'status') {
    const ord = { PASSED:0, PARTIAL:1, DETECTED:2, BLOCKED:3, ERROR:4 };
    visible.sort((a, b) => (ord[a.status] ?? 5) - (ord[b.status] ?? 5));
  }

  const categories = [...new Set(results.map(r => r.category))];

  if (!results.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-sm text-[rgba(255,255,255,0.4)]">Sin resultados todavía</p>
          <p className="text-xs text-[rgba(255,255,255,0.2)] mt-1">Ejecuta un scan para ver los resultados aquí</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">

        {/* Smart Score */}
        {results.length > 0 && (
          <SmartScorePanel results={results} apiKey={apiKey} target={target} />
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5 flex flex-col items-center gap-3">
            <ScoreGauge score={globalScore} />
            <div className="text-center">
              <div className="font-semibold text-sm" style={{ color: getScoreColor(globalScore) }}>
                {getScoreLabel(globalScore)}
              </div>
              <div className="text-[10px] text-[rgba(255,255,255,0.3)] mt-0.5">
                {results.length} módulos evaluados
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
              const count  = byStatus[status]?.length || 0;
              const active = statusFilter === status;
              return (
                <button key={status}
                  onClick={() => setStatusFilter(f => f === status ? 'ALL' : status)}
                  className="rounded-xl border p-3 flex flex-col items-center gap-1.5 transition-all"
                  style={{
                    background:  active ? `${cfg.color}18` : `${cfg.color}08`,
                    borderColor: active ? `${cfg.color}45` : `${cfg.color}18`,
                  }}>
                  <span className="text-xl">{cfg.emoji}</span>
                  <span className="text-xl font-bold leading-none" style={{ color: cfg.color }}>{count}</span>
                  <span className="text-[8px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider">{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3 h-3 text-[rgba(255,255,255,0.25)]" />
          {['ALL', ...categories].map(c => {
            const active = catFilter === c;
            const color  = CATEGORIES[c]?.color;
            return (
              <button key={c} onClick={() => setCatFilter(c)}
                className="text-[9px] px-2 py-1 rounded-lg border transition-all"
                style={{
                  background:  active ? `${color||'#fff'}15` : 'rgba(255,255,255,0.03)',
                  borderColor: active ? `${color||'#fff'}35` : 'rgba(255,255,255,0.07)',
                  color:       active ? (color || '#fff') : 'rgba(255,255,255,0.35)',
                }}>
                {c === 'ALL' ? 'Todos' : CATEGORIES[c]?.name || c}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-1">
            <SortAsc className="w-3 h-3 text-[rgba(255,255,255,0.25)]" />
            {[['time','Tiempo'],['score','Score'],['status','Estado']].map(([val,lbl]) => (
              <button key={val} onClick={() => setSortBy(val)}
                className="text-[9px] px-2 py-1 rounded-lg border transition-all"
                style={{
                  background:  sortBy === val ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                  borderColor: sortBy === val ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
                  color:       sortBy === val ? 'white' : 'rgba(255,255,255,0.3)',
                }}>
                {lbl}
              </button>
            ))}
          </div>
          <span className="text-[9px] text-[rgba(255,255,255,0.2)] font-mono">
            {visible.length}/{results.length}
          </span>
        </div>

        {/* List */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] overflow-hidden bg-[rgba(255,255,255,0.01)]">
          <div className="px-4 py-2.5 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-widest text-[rgba(255,255,255,0.4)] font-semibold">
              Resultados — click para expandir
            </span>
            <span className="text-[9px] flex items-center gap-1 text-[rgba(255,255,255,0.25)]">
              <Sparkles className="w-2.5 h-2.5 text-[rgba(0,255,136,0.5)]" />
              Análisis IA · Comandos · Output
            </span>
          </div>
          {visible.length === 0
            ? <div className="py-10 text-center text-[rgba(255,255,255,0.2)] text-xs">Sin resultados con los filtros aplicados</div>
            : visible.map((r, i) => (
              <ResultRow key={r.id} result={r} index={i}
                apiKey={apiKey}
                aiCache={cache} aiLoading={loading} onAnalyze={analyze} />
            ))
          }
        </div>
      </div>
    </div>
  );
}
