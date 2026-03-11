import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Code2, Folder, Braces, Terminal, FileCode,
  ExternalLink, Copy, Check, Zap, ChevronDown,
  Shuffle, AlertTriangle, Search, DownloadCloud, X
} from 'lucide-react';

const API = 'http://localhost:8000';

const RISK_CFG = {
  CRITICAL: { color: '#c94040', bg: 'rgba(201,64,64,0.15)',  label: 'CRÍTICO' },
  HIGH:     { color: '#e4692a', bg: 'rgba(228,105,42,0.15)', label: 'ALTO'    },
  MEDIUM:   { color: '#c8a951', bg: 'rgba(200,169,81,0.15)', label: 'MEDIO'   },
  LOW:      { color: '#5ba32b', bg: 'rgba(91,163,43,0.15)',  label: 'BAJO'    },
};

const ICONS = {
  database:         Database,
  code:             Code2,
  folder:           Folder,
  braces:           Braces,
  terminal:         Terminal,
  'file-code':      FileCode,
  'external-link':  ExternalLink,
};

const ENCODINGS = [
  { id: 'none',       label: 'Sin encoding'    },
  { id: 'url',        label: 'URL encode'      },
  { id: 'double_url', label: 'Double URL'      },
  { id: 'base64',     label: 'Base64'          },
  { id: 'html',       label: 'HTML entities'   },
  { id: 'hex',        label: 'HEX (%XX)'       },
  { id: 'unicode',    label: 'Unicode \\uXXXX' },
];

const CAT_ORDER = ['sqli','xss','lfi','ssti','cmdi','xxe','open_redirect'];

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <button onClick={copy} title="Copiar" className="p-1 rounded transition-colors"
      style={{ color: copied ? '#5ba32b' : 'rgba(102,192,244,0.6)' }}
      onMouseEnter={e => { if (!copied) e.currentTarget.style.color = '#66c0f4'; }}
      onMouseLeave={e => { if (!copied) e.currentTarget.style.color = 'rgba(102,192,244,0.6)'; }}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function PayloadRow({ p, onObfuscate, isObfuscating }) {
  const [expanded, setExpanded] = useState(false);
  const risk = RISK_CFG[p.risk] || RISK_CFG.MEDIUM;
  return (
    <div className="border-b last:border-0" style={{ borderColor: 'rgba(102,192,244,0.07)' }}>
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-[rgba(42,71,94,0.2)] transition-colors group">
        <span className="w-14 flex-shrink-0 text-center text-[9px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ color: risk.color, background: risk.bg }}>{risk.label}</span>
        <span className="w-32 flex-shrink-0 text-[10px] font-semibold text-[#c6d4df]">{p.name}</span>
        <span className="w-24 flex-shrink-0 text-[9px] text-[rgba(143,152,160,0.7)] hidden lg:block">{p.context}</span>
        <code className="flex-1 text-[10px] font-mono truncate" style={{ color: p.category_color || '#c8a951' }}>
          {p.payload}
        </code>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <CopyBtn text={p.payload} />
          <button onClick={() => { onObfuscate(p); setExpanded(true); }} disabled={isObfuscating}
            title="Generar variantes IA" className="p-1 rounded transition-colors disabled:opacity-40"
            style={{ color: 'rgba(200,169,81,0.6)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c8a951'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(200,169,81,0.6)'}>
            {isObfuscating ? <Shuffle className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          </button>
          <button onClick={() => setExpanded(v => !v)} className="p-1 rounded"
            style={{ color: 'rgba(143,152,160,0.6)' }}>
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="px-3 pb-3 pt-1 space-y-2" style={{ background: 'rgba(22,32,45,0.7)' }}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] uppercase tracking-widest text-[rgba(143,152,160,0.7)]">Payload completo</span>
                  <CopyBtn text={p.payload} />
                </div>
                <pre className="text-[10px] font-mono p-2.5 rounded-lg break-all whitespace-pre-wrap"
                  style={{ background: 'rgba(102,192,244,0.05)', border: '1px solid rgba(102,192,244,0.1)', color: '#c6d4df' }}>
                  {p.payload}
                </pre>
              </div>
              {p._variants && (
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-[#c8a951] flex items-center gap-1 mb-1.5">
                    <Zap className="w-2.5 h-2.5" /> Variantes IA — WAF Bypass
                  </span>
                  <div className="space-y-1.5">
                    {p._variants.map((v, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg"
                        style={{ background: 'rgba(200,169,81,0.05)', border: '1px solid rgba(200,169,81,0.15)' }}>
                        <span className="text-[9px] font-bold text-[#c8a951] w-28 flex-shrink-0 mt-0.5">{v.technique}</span>
                        <div className="flex-1 min-w-0">
                          <code className="text-[10px] font-mono text-[#c6d4df] break-all">{v.payload}</code>
                          {v.notes && <p className="text-[9px] text-[rgba(143,152,160,0.7)] mt-0.5">{v.notes}</p>}
                        </div>
                        <CopyBtn text={v.payload} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {p._variantError && (
                <p className="text-[10px] flex items-center gap-1" style={{ color: '#c94040' }}>
                  <AlertTriangle className="w-3 h-3" /> {p._variantError}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SubcategoryBlock({ label, payloads, color, onObfuscate, obfuscatingId, search }) {
  const [open, setOpen] = useState(true);
  const filtered = search
    ? payloads.filter(p => p.name.toLowerCase().includes(search) || p.payload.toLowerCase().includes(search) || p.context.toLowerCase().includes(search))
    : payloads;
  if (filtered.length === 0) return null;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(102,192,244,0.08)' }}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors"
        style={{ background: 'rgba(42,71,94,0.3)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(42,71,94,0.5)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(42,71,94,0.3)'}>
        <span className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-[11px] font-bold text-white flex-1 text-left">{label}</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
          style={{ background: 'rgba(102,192,244,0.1)', color: '#66c0f4' }}>{filtered.length}</span>
        <ChevronDown className={`w-3 h-3 transition-transform text-[rgba(143,152,160,0.7)] ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden" style={{ background: '#16202d' }}>
            {filtered.map(p => (
              <PayloadRow key={p.id} p={p} onObfuscate={onObfuscate}
                isObfuscating={obfuscatingId === p.id} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PayloadPanel({ apiKey = '' }) {
  const [categories,    setCategories]    = useState(null);
  const [activecat,     setActiveCat]     = useState('sqli');
  const [encoding,      setEncoding]      = useState('none');
  const [lhost,         setLhost]         = useState('');
  const [lport,         setLport]         = useState('4444');
  const [activeSub,     setActiveSub]     = useState('all');
  const [search,        setSearch]        = useState('');
  const [payloads,      setPayloads]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [obfuscatingId, setObfuscatingId] = useState(null);

  // Load categories on mount
  useEffect(() => {
    fetch(`${API}/api/payloads/categories`)
      .then(r => r.json())
      .then(d => setCategories(d.categories))
      .catch(() => {});
  }, []);

  const generate = async (cat, sub, enc, lh, lp) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/payloads/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat, subcategory: sub === 'all' ? null : sub, encoding: enc, lhost: lh, lport: lp }),
      });
      const data = await res.json();
      setPayloads(data.payloads || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCatChange = (cid) => { setActiveCat(cid); setActiveSub('all'); setPayloads([]); };

  const handleObfuscate = useCallback(async (p) => {
    if (!apiKey) { alert('Introduce una API Key de Groq en el sidebar para usar IA'); return; }
    setObfuscatingId(p.id);
    try {
      const res = await fetch(`${API}/api/payloads/obfuscate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: p.payload, category: p.category_label, api_key: apiKey }),
      });
      const data = await res.json();
      setPayloads(prev => prev.map(x => x.id === p.id
        ? { ...x, _variants: data.variants, _variantError: data.error } : x));
    } catch (e) {
      setPayloads(prev => prev.map(x => x.id === p.id ? { ...x, _variantError: e.message } : x));
    } finally { setObfuscatingId(null); }
  }, [apiKey]);

  const exportAll = () => {
    const txt = payloads.map(p =>
      `# ${p.subcategory_label} — ${p.name} [${p.risk}]\n# Context: ${p.context}\n${p.payload}\n`
    ).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = `payloads_${activecat}_${Date.now()}.txt`; a.click();
  };

  const cat = categories?.[activecat];
  const grouped = {};
  for (const p of payloads) {
    if (!grouped[p.subcategory]) grouped[p.subcategory] = { label: p.subcategory_label, items: [] };
    grouped[p.subcategory].items.push(p);
  }
  const searchLow = search.toLowerCase();

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'rgba(23,26,33,0.2)' }}>

      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b" style={{ borderColor: 'rgba(102,192,244,0.08)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(201,64,64,0.15)', border: '1px solid rgba(201,64,64,0.3)' }}>
            <Code2 className="w-4 h-4 text-[#c94040]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Payload Generator</h2>
            <p className="text-[10px] text-[rgba(198,212,223,0.6)]">SQLi · XSS · LFI/RFI · SSTI · CMDi · XXE · SSRF · Redirección abierta</p>
          </div>
          {payloads.length > 0 && (
            <button onClick={exportAll}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
              style={{ background: 'rgba(102,192,244,0.1)', border: '1px solid rgba(102,192,244,0.2)', color: '#66c0f4' }}>
              <DownloadCloud className="w-3 h-3" /> Exportar .txt
            </button>
          )}
        </div>

        {/* Options */}
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase tracking-widest text-[rgba(143,152,160,0.7)]">Encoding</label>
            <select value={encoding} onChange={e => setEncoding(e.target.value)}
              className="text-[10px] px-2 py-1.5 rounded-lg outline-none cursor-pointer"
              style={{ background: 'rgba(102,192,244,0.07)', border: '1px solid rgba(102,192,244,0.15)', color: '#c6d4df' }}>
              {ENCODINGS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase tracking-widest text-[rgba(143,152,160,0.7)]">LHOST</label>
            <input value={lhost} onChange={e => setLhost(e.target.value)} placeholder="192.168.1.100"
              className="w-36 text-[10px] px-2 py-1.5 rounded-lg outline-none"
              style={{ background: 'rgba(102,192,244,0.07)', border: '1px solid rgba(102,192,244,0.15)', color: '#c6d4df' }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase tracking-widest text-[rgba(143,152,160,0.7)]">LPORT</label>
            <input value={lport} onChange={e => setLport(e.target.value)} placeholder="4444"
              className="w-16 text-[10px] px-2 py-1.5 rounded-lg outline-none"
              style={{ background: 'rgba(102,192,244,0.07)', border: '1px solid rgba(102,192,244,0.15)', color: '#c6d4df' }} />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-32">
            <label className="text-[9px] uppercase tracking-widest text-[rgba(143,152,160,0.7)]">Buscar</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[rgba(143,152,160,0.6)]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="nombre, técnica, payload…"
                className="w-full pl-6 pr-6 text-[10px] py-1.5 rounded-lg outline-none"
                style={{ background: 'rgba(102,192,244,0.07)', border: '1px solid rgba(102,192,244,0.15)', color: '#c6d4df' }} />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-2.5 h-2.5 text-[rgba(143,152,160,0.6)]" />
                </button>
              )}
            </div>
          </div>
          <button onClick={() => generate(activecat, activeSub, encoding, lhost, lport)} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
            style={{ background: 'rgba(201,64,64,0.15)', border: '1px solid rgba(201,64,64,0.4)', color: '#c94040' }}>
            {loading ? <Shuffle className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Generar
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Category sidebar */}
        <div className="w-44 flex-shrink-0 border-r overflow-y-auto py-2"
          style={{ borderColor: 'rgba(102,192,244,0.08)', background: 'rgba(23,26,33,0.4)' }}>
          {categories && CAT_ORDER.map(cid => {
            const c = categories[cid]; if (!c) return null;
            const Icon = ICONS[c.icon] || Code2;
            const active = activecat === cid;
            const total = Object.values(c.subcategories).reduce((a, s) => a + s.count, 0);
            return (
              <button key={cid} onClick={() => handleCatChange(cid)}
                className="w-full flex items-center gap-2 px-3 py-2.5 transition-all text-left"
                style={{
                  background: active ? `${c.color}18` : 'transparent',
                  borderRight: active ? `2px solid ${c.color}` : '2px solid transparent',
                }}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: c.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold text-white truncate">{c.label}</div>
                  <div className="text-[9px]" style={{ color: 'rgba(143,152,160,0.7)' }}>{total} payloads</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Payload list */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {cat && (
            <div className="flex-shrink-0 px-3 py-2 border-b flex items-center gap-2 flex-wrap"
              style={{ borderColor: 'rgba(102,192,244,0.08)', background: 'rgba(42,71,94,0.1)' }}>
              {[{id:'all',label:'Todos'}, ...Object.entries(cat.subcategories).map(([id,s])=>({id,label:s.label}))].map(s => (
                <button key={s.id} onClick={() => setActiveSub(s.id)}
                  className="text-[9px] font-semibold px-2.5 py-1 rounded-full transition-all"
                  style={{
                    background: activeSub === s.id ? `${cat.color}25` : 'rgba(102,192,244,0.06)',
                    border: `1px solid ${activeSub === s.id ? cat.color + '60' : 'rgba(102,192,244,0.12)'}`,
                    color: activeSub === s.id ? cat.color : 'rgba(198,212,223,0.7)',
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {payloads.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(201,64,64,0.1)', border: '1px solid rgba(201,64,64,0.2)' }}>
                  <Code2 className="w-7 h-7 text-[#c94040]" />
                </div>
                <p className="text-sm font-semibold text-white mb-1">Listo para generar</p>
                <p className="text-[11px] mb-4 max-w-xs" style={{ color: 'rgba(143,152,160,0.7)' }}>
                  Selecciona una categoría, configura encoding/LHOST y pulsa Generar
                </p>
                <button onClick={() => generate(activecat, activeSub, encoding, lhost, lport)}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold"
                  style={{ background: 'rgba(201,64,64,0.15)', border: '1px solid rgba(201,64,64,0.4)', color: '#c94040' }}>
                  <Zap className="w-3.5 h-3.5" /> Generar payloads
                </button>
              </div>
            )}
            {loading && (
              <div className="flex items-center justify-center h-32 gap-3">
                <Shuffle className="w-5 h-5 text-[#c94040] animate-spin" />
                <span className="text-sm" style={{ color: 'rgba(198,212,223,0.7)' }}>Generando…</span>
              </div>
            )}
            {!loading && payloads.length > 0 && (
              <>
                <div className="text-[10px] mb-1" style={{ color: 'rgba(143,152,160,0.7)' }}>
                  {payloads.length} payloads · encoding: <span style={{ color: '#66c0f4' }}>{encoding}</span>
                  {apiKey
                    ? <span style={{ color: '#c8a951' }}> · IA disponible (⚡ botón por payload)</span>
                    : <span style={{ color: 'rgba(228,105,42,0.7)' }}> · Sin API key (no IA)</span>}
                </div>
                {Object.entries(grouped).map(([sid, g]) => (
                  <SubcategoryBlock key={sid} label={g.label} payloads={g.items}
                    color={cat?.color || '#66c0f4'}
                    onObfuscate={handleObfuscate}
                    obfuscatingId={obfuscatingId}
                    search={searchLow} />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
