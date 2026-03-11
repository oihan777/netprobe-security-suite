import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Search, Loader2, AlertTriangle, ExternalLink, RefreshCw, ChevronDown } from 'lucide-react';

const SEV_CFG = {
  CRITICAL: { color: '#c94040', bg: 'rgba(201,64,64,0.12)',  label: 'CRÍTICO' },
  HIGH:     { color: '#e4692a', bg: 'rgba(228,105,42,0.12)', label: 'ALTO'    },
  MEDIUM:   { color: '#e4692a', bg: 'rgba(228,105,42,0.12)', label: 'MEDIO'   },
  LOW:      { color: '#5ba32b', bg: 'rgba(91,163,43,0.12)',  label: 'BAJO'    },
  UNKNOWN:  { color: '#8f98a0', bg: 'rgba(142,142,147,0.1)', label: '?'       },
};
const sev = (s) => SEV_CFG[s] || SEV_CFG.UNKNOWN;

function CvssBar({ score }) {
  const pct   = ((score || 0) / 10) * 100;
  const s     = score >= 9 ? 'CRITICAL' : score >= 7 ? 'HIGH' : score >= 4 ? 'MEDIUM' : score > 0 ? 'LOW' : 'UNKNOWN';
  const color = sev(s).color;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-[rgba(102,192,244,0.1)] overflow-hidden">
        <motion.div className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }} />
      </div>
      <span className="text-[11px] font-mono font-bold" style={{ color }}>{score?.toFixed(1) ?? '?'}</span>
    </div>
  );
}

function CVECard({ cve, index }) {
  const [open, setOpen] = useState(false);
  const cfg = sev(cve.severity);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: `${cfg.color}25`, background: `${cfg.color}06` }}>

      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-[rgba(42,71,94,0.2)] transition-colors">
        {/* Severity badge */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1 mt-0.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
            {cfg.label}
          </span>
          {cve.exploit && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-[rgba(201,64,64,0.15)] text-[#c94040] border border-[rgba(201,64,64,0.25)]">
              EXPLOIT
            </span>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-white">{cve.id}</span>
            <span className="text-[9px] text-[rgba(143,152,160,0.9)] font-mono">{cve.published}</span>
          </div>
          <p className="text-[10px] text-[rgba(255,255,255,0.55)] mt-1 leading-relaxed line-clamp-2">
            {cve.desc}
          </p>
        </div>

        {/* Score + chevron */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <CvssBar score={cve.score} />
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-3.5 h-3.5 text-[rgba(143,152,160,0.6)]" />
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
            <div className="px-3 pb-3 pt-1 border-t border-[rgba(102,192,244,0.07)] space-y-2">
              <p className="text-[10px] text-[#c6d4df] leading-relaxed">{cve.desc}</p>
              {cve.vector && (
                <code className="text-[9px] font-mono text-[rgba(198,212,223,0.6)] bg-[rgba(23,26,33,0.3)] px-2 py-1 rounded block">
                  {cve.vector}
                </code>
              )}
              {cve.refs?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {cve.refs.map((ref, i) => (
                    <a key={i} href={ref} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border transition-colors"
                      style={{ color: cfg.color, borderColor: `${cfg.color}30` }}
                      onClick={e => e.stopPropagation()}>
                      <ExternalLink className="w-2.5 h-2.5" />
                      Ref {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SeverityPill({ label, count, color, active, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition-all"
      style={{
        background:  active ? `${color}18` : 'rgba(42,71,94,0.3)',
        borderColor: active ? `${color}40` : 'rgba(102,192,244,0.1)',
        color:       active ? color : 'rgba(198,212,223,0.7)',
      }}>
      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
        style={{ background: `${color}25`, color }}>
        {count}
      </span>
      {label}
    </button>
  );
}

export function CVELookup({ results }) {
  const [cveData,   setCveData]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [filter,    setFilter]    = useState('ALL');
  const [search,    setSearch]    = useState('');
  const [manualSvc, setManualSvc] = useState('');
  const [manualVer, setManualVer] = useState('');

  const runScan = async () => {
    setLoading(true); setError(''); setCveData(null);
    try {
      const res = await fetch('http://localhost:8000/api/cve/from-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      });
      const data = await res.json();
      setCveData(data);
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runManual = async () => {
    if (!manualSvc.trim()) return;
    setLoading(true); setError('');
    try {
      const url = new URL('http://localhost:8000/api/cve/lookup');
      url.searchParams.set('service', manualSvc.trim());
      if (manualVer.trim()) url.searchParams.set('version', manualVer.trim());
      const res  = await fetch(url);
      const data = await res.json();
      setCveData(prev => {
        const prevCves = prev?.cves || [];
        const newCves  = data.cves || [];
        const merged   = [...newCves, ...prevCves.filter(c => !newCves.find(n => n.id === c.id))];
        return {
          ...(prev || {}),
          cves:       merged,
          total_cves: merged.length,
          critical:   merged.filter(c => c.severity === 'CRITICAL').length,
          high:       merged.filter(c => c.severity === 'HIGH').length,
          medium:     merged.filter(c => c.severity === 'MEDIUM').length,
          low:        merged.filter(c => c.severity === 'LOW').length,
        };
      });
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run if we have scan results
  useEffect(() => {
    if (results.length > 0 && !cveData && !loading) runScan();
  }, [results.length]);

  const allCves  = cveData?.cves || [];
  const visible  = allCves
    .filter(c => filter === 'ALL' || c.severity === filter)
    .filter(c => !search || c.id.toLowerCase().includes(search.toLowerCase()) ||
                 c.desc.toLowerCase().includes(search.toLowerCase()));

  const counts = {
    CRITICAL: cveData?.critical || 0,
    HIGH:     cveData?.high     || 0,
    MEDIUM:   cveData?.medium   || 0,
    LOW:      cveData?.low      || 0,
  };
  const hasExploits = allCves.filter(c => c.exploit).length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[rgba(102,192,244,0.1)] flex-shrink-0"
        style={{ background: 'rgba(10,10,14,0.95)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[rgba(201,64,64,0.1)] border border-[rgba(201,64,64,0.2)] flex items-center justify-center text-xs">🔍</div>
          <span className="text-xs font-semibold text-white">CVE Lookup</span>
        </div>

        {/* Manual search */}
        <div className="flex items-center gap-1.5 flex-1 max-w-md">
          <input value={manualSvc} onChange={e => setManualSvc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runManual()}
            placeholder="Servicio (ej: apache, openssh)"
            className="flex-1 bg-[rgba(102,192,244,0.07)] border border-[rgba(102,192,244,0.15)] rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-[rgba(143,152,160,0.7)] focus:outline-none focus:border-[rgba(201,64,64,0.4)]"
            style={{ fontFamily: 'monospace' }} />
          <input value={manualVer} onChange={e => setManualVer(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runManual()}
            placeholder="Versión (opcional)"
            className="w-28 bg-[rgba(102,192,244,0.07)] border border-[rgba(102,192,244,0.15)] rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-[rgba(143,152,160,0.7)] focus:outline-none focus:border-[rgba(201,64,64,0.4)]"
            style={{ fontFamily: 'monospace' }} />
          <button onClick={runManual} disabled={loading || !manualSvc.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
            style={{ background: 'rgba(201,64,64,0.12)', border: '1px solid rgba(201,64,64,0.3)', color: '#c94040' }}>
            <Search className="w-3.5 h-3.5" /> Buscar
          </button>
        </div>

        {results.length > 0 && (
          <button onClick={runScan} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
            style={{ background: 'rgba(102,192,244,0.08)', border: '1px solid rgba(102,192,244,0.15)', color: '#c6d4df' }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Buscando...' : 'Re-escanear desde resultados'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">

          {/* Empty / loading state */}
          {!cveData && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-sm text-[rgba(198,212,223,0.7)] mb-2">Búsqueda de CVEs</p>
              <p className="text-xs text-[rgba(143,152,160,0.6)] max-w-xs leading-relaxed">
                {results.length > 0
                  ? 'Analizando servicios detectados en el scan...'
                  : 'Ejecuta un scan o introduce un servicio manualmente para buscar CVEs conocidos en la NVD.'}
              </p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative w-16 h-16 mb-5">
                {[0,1,2].map(i => (
                  <div key={i} className="absolute inset-0 rounded-full border border-[rgba(201,64,64,0.3)] animate-ping"
                    style={{ animationDelay: `${i*0.4}s`, animationDuration: '1.8s' }} />
                ))}
                <div className="absolute inset-0 flex items-center justify-center text-2xl">🔍</div>
              </div>
              <p className="text-sm text-[rgba(198,212,223,0.8)]">Consultando NVD...</p>
              <p className="text-xs text-[rgba(143,152,160,0.7)] mt-1 font-mono">services.nvd.nist.gov</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-[rgba(201,64,64,0.25)] bg-[rgba(201,64,64,0.06)] p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-[#c94040] flex-shrink-0" />
              <p className="text-sm text-[#c6d4df]">{error}</p>
            </div>
          )}

          {cveData && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ['CRITICAL', counts.CRITICAL, '#c94040', '💀'],
                  ['HIGH',     counts.HIGH,     '#e4692a', '🔴'],
                  ['MEDIUM',   counts.MEDIUM,   '#e4692a', '🟡'],
                  ['LOW',      counts.LOW,      '#5ba32b', '🟢'],
                ].map(([sev, cnt, color, icon]) => (
                  <button key={sev}
                    onClick={() => setFilter(f => f === sev ? 'ALL' : sev)}
                    className="rounded-xl border p-3 flex flex-col items-center gap-1 transition-all"
                    style={{
                      background:  filter === sev ? `${color}15` : `${color}07`,
                      borderColor: filter === sev ? `${color}40` : `${color}18`,
                    }}>
                    <span className="text-xl">{icon}</span>
                    <span className="text-2xl font-bold" style={{ color }}>{cnt}</span>
                    <span className="text-[8px] uppercase tracking-wider text-[rgba(198,212,223,0.7)]">
                      {sev === 'CRITICAL' ? 'Crítico' : sev === 'HIGH' ? 'Alto' : sev === 'MEDIUM' ? 'Medio' : 'Bajo'}
                    </span>
                  </button>
                ))}
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-[rgba(198,212,223,0.8)]">
                  <strong className="text-white">{cveData.total_cves}</strong> CVEs encontrados
                  {cveData.services_checked > 0 && ` en ${cveData.services_checked} servicios`}
                </span>
                {hasExploits > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-lg font-semibold"
                    style={{ background: 'rgba(201,64,64,0.15)', color: '#c94040', border: '1px solid rgba(201,64,64,0.3)' }}>
                    ⚡ {hasExploits} con exploit conocido
                  </span>
                )}
                {/* Search */}
                <div className="ml-auto relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[rgba(143,152,160,0.9)]" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Filtrar CVEs..."
                    className="pl-6 pr-3 py-1 bg-[rgba(102,192,244,0.07)] border border-[rgba(102,192,244,0.15)] rounded-lg text-[10px] text-white placeholder-[rgba(143,152,160,0.7)] focus:outline-none w-40"
                    style={{ fontFamily: 'monospace' }} />
                </div>
              </div>

              {/* CVE list */}
              {visible.length === 0 ? (
                <div className="py-10 text-center text-[rgba(143,152,160,0.7)] text-xs">
                  Sin CVEs con los filtros aplicados
                </div>
              ) : (
                <div className="space-y-2">
                  {visible.map((cve, i) => (
                    <CVECard key={cve.id} cve={cve} index={i} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
