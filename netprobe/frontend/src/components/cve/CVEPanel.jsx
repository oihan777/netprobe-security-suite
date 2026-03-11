import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, AlertTriangle, Search, ExternalLink, Zap, ChevronDown,
         RefreshCw, Bug, Package, Loader2 } from 'lucide-react';

const SEV_CFG = {
  CRITICAL: { color: '#c94040', bg: 'rgba(201,64,64,0.12)',  border: 'rgba(201,64,64,0.3)',  label: 'CRÍTICO' },
  HIGH:     { color: '#e4692a', bg: 'rgba(228,105,42,0.12)', border: 'rgba(228,105,42,0.3)', label: 'ALTO'    },
  MEDIUM:   { color: '#e4692a', bg: 'rgba(228,105,42,0.12)', border: 'rgba(228,105,42,0.3)', label: 'MEDIO'   },
  LOW:      { color: '#5ba32b', bg: 'rgba(91,163,43,0.12)',  border: 'rgba(91,163,43,0.3)',  label: 'BAJO'    },
  NONE:     { color: '#8f98a0', bg: 'rgba(99,99,102,0.1)',   border: 'rgba(99,99,102,0.2)',  label: 'INFO'    },
};
const sev = s => SEV_CFG[s] || SEV_CFG.NONE;

function ScoreBadge({ score, severity }) {
  const c = sev(severity);
  return (
    <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl flex-shrink-0"
      style={{ background: c.bg, border: `1.5px solid ${c.border}` }}>
      <span className="text-lg font-bold leading-none" style={{ color: c.color }}>
        {score != null ? score.toFixed(1) : '—'}
      </span>
      <span className="text-[8px] font-bold mt-0.5" style={{ color: c.color }}>{c.label}</span>
    </div>
  );
}

function CVECard({ cve, index }) {
  const [open, setOpen] = useState(false);
  const c = sev(cve.severity);
  return (
    <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: open ? c.border : 'rgba(102,192,244,0.1)', background: 'rgba(42,71,94,0.2)' }}>

      <button onClick={() => setOpen(o=>!o)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-[rgba(42,71,94,0.3)] transition-colors">
        <ScoreBadge score={cve.score} severity={cve.severity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-white">{cve.id}</span>
            {cve.has_exploit && (
              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-bold"
                style={{ background:'rgba(201,64,64,0.15)', color:'#c94040', border:'1px solid rgba(201,64,64,0.3)' }}>
                <Zap className="w-2.5 h-2.5" /> EXPLOIT
              </span>
            )}
            <span className="text-[9px] text-[rgba(143,152,160,0.7)] ml-auto">{cve.published}</span>
          </div>
          <p className="text-[11px] text-[rgba(255,255,255,0.55)] leading-snug line-clamp-2">
            {cve.description}
          </p>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[rgba(143,152,160,0.7)] flex-shrink-0 transition-transform ${open?'rotate-180':''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
            exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
            style={{ overflow:'hidden' }}>
            <div className="px-4 pb-4 pt-1 border-t space-y-3"
              style={{ borderColor:'rgba(102,192,244,0.08)' }}>
              <p className="text-xs text-[rgba(255,255,255,0.65)] leading-relaxed">{cve.description}</p>
              <div className="flex flex-wrap gap-2">
                <div className="text-[9px] px-2 py-1 rounded-lg border"
                  style={{ background: c.bg, borderColor: c.border, color: c.color }}>
                  CVSS {cve.cvss_ver}: {cve.score ?? 'N/A'}
                </div>
                <div className="text-[9px] px-2 py-1 rounded-lg border border-[rgba(102,192,244,0.15)] text-[rgba(198,212,223,0.7)]">
                  Publicado: {cve.published || '—'}
                </div>
                {cve.has_exploit && (
                  <div className="text-[9px] px-2 py-1 rounded-lg" style={{ background:'rgba(201,64,64,0.1)', color:'#c94040', border:'1px solid rgba(201,64,64,0.2)' }}>
                    ⚡ Exploit conocido
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <a href={cve.nvd_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg transition-all"
                  style={{ background:'rgba(0,132,255,0.1)', color:'#66c0f4', border:'1px solid rgba(102,192,244,0.3)' }}>
                  <ExternalLink className="w-3 h-3" /> Ver en NVD
                </a>
                {cve.patch_url && (
                  <a href={cve.patch_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg transition-all"
                    style={{ background:'rgba(91,163,43,0.1)', color:'#5ba32b', border:'1px solid rgba(91,163,43,0.3)' }}>
                    <Shield className="w-3 h-3" /> Ver Parche
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ServiceGroup({ service, cves, index }) {
  const [open, setOpen] = useState(true);
  const worst  = cves.reduce((a,b) => (b.score||0) > (a.score||0) ? b : a, cves[0]);
  const c      = sev(worst?.severity);
  const hasExp = cves.some(c => c.has_exploit);

  return (
    <motion.div initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: open ? c.border : 'rgba(102,192,244,0.1)' }}>

      <button onClick={() => setOpen(o=>!o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: open ? `${c.color}08` : 'rgba(42,71,94,0.2)' }}>
        <Package className="w-4 h-4 flex-shrink-0" style={{ color: c.color }} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white font-mono">{service}</span>
            {hasExp && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
              style={{ background:'rgba(201,64,64,0.15)', color:'#c94040' }}>⚡ EXPLOIT</span>}
          </div>
          <span className="text-[10px] text-[rgba(198,212,223,0.6)]">
            {cves.length} CVE{cves.length !== 1 ? 's' : ''} encontrado{cves.length !== 1 ? 's' : ''} · Peor: CVSS {worst?.score?.toFixed(1) ?? '?'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 rounded-lg text-[9px] font-bold"
            style={{ background: c.bg, color: c.color, border:`1px solid ${c.border}` }}>
            {c.label}
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-[rgba(143,152,160,0.9)] transition-transform ${open?'rotate-180':''}`} />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height:0 }} animate={{ height:'auto' }} exit={{ height:0 }}
            transition={{ duration:0.2 }} style={{ overflow:'hidden' }}>
            <div className="px-3 pb-3 pt-1 space-y-2">
              {cves.map((cve, i) => <CVECard key={cve.id} cve={cve} index={i} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function CVEPanel({ results }) {
  const [cveData,  setCveData]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [query,    setQuery]    = useState('');
  const [searched, setSearched] = useState(false);

  // Extract services from scan results
  const detectedServices = [...new Set(
    results.flatMap(r => r.data?.services || [])
           .filter(Boolean)
  )];

  const autoLookup = async () => {
    if (!detectedServices.length && !searched) return;
    setLoading(true); setError(''); setCveData(null);
    try {
      const res = await fetch('http://localhost:8000/api/cve/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: detectedServices }),
      });
      const data = await res.json();
      setCveData(data.results);
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const searchQuery = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(''); setCveData(null); setSearched(true);
    try {
      const res = await fetch(`http://localhost:8000/api/cve/search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      setCveData({ [query]: data.cves });
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const totalCVEs    = cveData ? Object.values(cveData).flat().length : 0;
  const criticalCVEs = cveData ? Object.values(cveData).flat().filter(c => c.severity === 'CRITICAL').length : 0;
  const exploitCVEs  = cveData ? Object.values(cveData).flat().filter(c => c.has_exploit).length : 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[rgba(102,192,244,0.1)] flex-shrink-0"
        style={{ background:'#1b2838' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[rgba(201,64,64,0.12)] border border-[rgba(201,64,64,0.2)] flex items-center justify-center text-xs">🔍</div>
          <span className="text-xs font-semibold text-white">CVE Lookup</span>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="flex-1 flex items-center gap-2 bg-[rgba(102,192,244,0.07)] border border-[rgba(102,192,244,0.15)] rounded-lg px-2.5 py-1.5">
            <Search className="w-3 h-3 text-[rgba(143,152,160,0.9)]" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchQuery()}
              placeholder="Buscar CVE (ej: Apache 2.4, OpenSSH 7...)"
              className="flex-1 bg-transparent text-xs text-white placeholder-[rgba(143,152,160,0.7)] outline-none"
              style={{ fontFamily: 'monospace' }} />
          </div>
          <button onClick={searchQuery} disabled={!query.trim() || loading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
            style={{ background:'rgba(0,132,255,0.12)', border:'1px solid rgba(102,192,244,0.3)', color:'#66c0f4' }}>
            Buscar
          </button>
        </div>

        {/* Auto-scan button */}
        {detectedServices.length > 0 && (
          <button onClick={autoLookup} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
            style={{ background:'rgba(201,64,64,0.1)', border:'1px solid rgba(201,64,64,0.3)', color:'#c94040' }}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bug className="w-3.5 h-3.5" />}
            Analizar servicios detectados ({detectedServices.length})
          </button>
        )}

        {cveData && (
          <button onClick={() => { setCveData(null); setSearched(false); }}
            className="p-1.5 rounded-lg text-[rgba(143,152,160,0.9)] hover:text-white border border-[rgba(102,192,244,0.1)] transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Empty state */}
        {!cveData && !loading && !error && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-[rgba(201,64,64,0.06)] border border-[rgba(201,64,64,0.12)] flex items-center justify-center text-4xl mb-5">🔍</div>
            <h3 className="text-white font-semibold mb-2">CVE Lookup Automático</h3>
            <p className="text-xs text-[rgba(198,212,223,0.6)] max-w-sm leading-relaxed mb-6">
              {detectedServices.length > 0
                ? `Se detectaron ${detectedServices.length} servicios en el último scan. Haz click en "Analizar servicios detectados" para buscar CVEs automáticamente.`
                : 'Ejecuta un scan primero para detectar servicios, o busca manualmente un software específico.'}
            </p>
            {detectedServices.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center mb-5 max-w-md">
                {detectedServices.map(s => (
                  <span key={s} className="text-[9px] px-2 py-1 rounded-lg font-mono"
                    style={{ background:'rgba(102,192,244,0.08)', color:'rgba(198,212,223,0.8)', border:'1px solid rgba(102,192,244,0.15)' }}>
                    {s}
                  </span>
                ))}
              </div>
            )}
            {detectedServices.length > 0 && (
              <button onClick={autoLookup}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background:'rgba(201,64,64,0.1)', border:'1.5px solid rgba(201,64,64,0.35)', color:'#c94040' }}>
                <Bug className="w-4 h-4" /> Buscar CVEs automáticamente
              </button>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#c94040]" />
            <p className="text-sm text-[rgba(198,212,223,0.8)]">Consultando NVD Database...</p>
            <p className="text-xs text-[rgba(143,152,160,0.7)]">National Vulnerability Database · nvd.nist.gov</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-xl border border-[rgba(201,64,64,0.3)] bg-[rgba(201,64,64,0.08)] p-4 text-sm text-[#c94040]">
            {error}
          </div>
        )}

        {/* Results */}
        {cveData && !loading && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Total CVEs', totalCVEs,    '#66c0f4'],
                ['Críticos',   criticalCVEs, '#c94040'],
                ['Con exploit',exploitCVEs,  '#e4692a'],
              ].map(([lbl, val, color]) => (
                <div key={lbl} className="rounded-xl border border-[rgba(102,192,244,0.1)] bg-[rgba(42,71,94,0.2)] p-4 text-center">
                  <div className="text-2xl font-bold" style={{ color }}>{val}</div>
                  <div className="text-[10px] text-[rgba(198,212,223,0.6)] mt-1">{lbl}</div>
                </div>
              ))}
            </div>

            {/* CVE groups by service */}
            {Object.entries(cveData).length === 0 ? (
              <div className="text-center py-10 text-[rgba(143,152,160,0.9)] text-sm">
                No se encontraron CVEs para los servicios detectados
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(cveData).map(([service, cves], i) => (
                  cves.length > 0 && (
                    <ServiceGroup key={service} service={service} cves={cves} index={i} />
                  )
                ))}
              </div>
            )}

            <p className="text-center text-[9px] text-[rgba(143,152,160,0.6)]">
              Datos de la National Vulnerability Database (NVD) · nvd.nist.gov
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
