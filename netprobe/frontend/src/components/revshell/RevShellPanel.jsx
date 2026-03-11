import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Copy, Check, Zap, AlertTriangle,
  Loader2, Cpu, Globe, Code2, Server, ChevronDown
} from 'lucide-react';

const API = 'http://localhost:8000';

const CAT_CFG = {
  Shell:     { color: '#5ba32b', icon: Terminal },
  Scripting: { color: '#66c0f4', icon: Code2    },
  Windows:   { color: '#9b59b6', icon: Server   },
  Web:       { color: '#e4692a', icon: Globe     },
};

const OS_COLOR = {
  'Linux':         '#c8a951',
  'Linux/Mac':     '#c8a951',
  'Windows':       '#9b59b6',
  'Linux/Windows': '#66c0f4',
};

const ENCODINGS = [
  { id: 'none',   label: 'Ninguna' },
  { id: 'base64', label: 'Base64'  },
  { id: 'url',    label: 'URL'     },
];

const USAGE_NOTES = {
  socat:          ['socat genera una TTY completamente interactiva — permite usar Ctrl+C, vim y ssh', 'Instalar en víctima: apt install socat'],
  php_web:        ['Sube el archivo como shell.php a un directorio escribible (/uploads, /tmp)', 'Activa el listener ANTES de acceder al archivo vía navegador'],
  powershell:     ['Copia en una sola línea — no insertes saltos de línea', 'Si AMSI bloquea, prueba la variante PowerShell Base64', 'Ejecutar desde cmd.exe para evitar restricciones de PS'],
  powershell_b64: ['Usa -EncodedCommand para evitar problemas con caracteres especiales', 'Compatible con todas las versiones de PowerShell v2+'],
  bash_udp:       ['UDP puede evadir firewalls que solo filtran TCP', 'El listener nc necesita -u para escuchar en UDP: nc -u -lvnp PUERTO'],
  netcat_mkfifo:  ['Variante para versiones de nc sin soporte -e (netcat-openbsd)', 'Limpia el FIFO después: rm /tmp/f'],
};

function StatBadge({ label, color = '#66c0f4' }) {
  return (
    <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
      style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}>
      {label}
    </span>
  );
}

function CodeBlock({ label, badge, badgeColor = '#66c0f4', code, copyKey, copied, onCopy, accent }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${accent || 'rgba(102,192,244,0.1)'}` }}>
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ background: 'rgba(42,71,94,0.3)', borderBottom: '1px solid rgba(102,192,244,0.07)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold" style={{ color: 'rgba(198,212,223,0.8)' }}>{label}</span>
          <StatBadge label={badge} color={badgeColor} />
        </div>
        <button onClick={() => onCopy(copyKey, code)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-colors"
          style={{ background: 'rgba(102,192,244,0.07)', border: '1px solid rgba(102,192,244,0.1)', color: 'rgba(198,212,223,0.8)' }}>
          {copied[copyKey]
            ? <><Check className="w-3 h-3" style={{ color: '#5ba32b' }} /><span style={{ color: '#5ba32b' }}>Copiado</span></>
            : <><Copy className="w-3 h-3" /> Copiar</>}
        </button>
      </div>
      <div className="p-4 overflow-x-auto" style={{ background: 'rgba(23,26,33,0.3)' }}>
        <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all"
          style={{ color: badgeColor }}>
          {code}
        </pre>
      </div>
    </div>
  );
}

export function RevShellPanel({ target = '', apiKey = '' }) {
  const [languages, setLanguages] = useState([]);
  const [selected,  setSelected]  = useState('bash');
  const [lhost,     setLhost]     = useState('');
  const [lport,     setLport]     = useState(4444);
  const [encoding,  setEncoding]  = useState('none');
  const [obfuscate, setObfuscate] = useState(false);
  const [result,    setResult]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [copied,    setCopied]    = useState({});
  const [filterCat, setFilterCat] = useState('all');
  const [legalOpen, setLegalOpen] = useState(false);

  useEffect(() => { if (target && !lhost) setLhost(target); }, [target]);

  useEffect(() => {
    fetch(`${API}/api/revshell/languages`)
      .then(r => r.json())
      .then(d => setLanguages(d.languages || []))
      .catch(() => {});
  }, []);

  const categories = ['all', ...new Set(languages.map(l => l.category))];
  const filtered   = filterCat === 'all' ? languages : languages.filter(l => l.category === filterCat);
  const catColor   = cat => CAT_CFG[cat]?.color || '#66c0f4';

  const generate = useCallback(async () => {
    if (!lhost.trim()) { setError('Introduce el LHOST (IP de tu máquina atacante)'); return; }
    if (!lport || lport < 1 || lport > 65535) { setError('Puerto inválido (1-65535)'); return; }
    setError(''); setLoading(true); setResult(null);
    try {
      const resp = await fetch(`${API}/api/revshell/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lhost: lhost.trim(), lport: Number(lport), language: selected, encoding, groq_key: apiKey || null, obfuscate: obfuscate && !!apiKey }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error generando payload');
      setResult(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [lhost, lport, selected, encoding, obfuscate, apiKey]);

  const copy = (key, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(c => ({ ...c, [key]: true }));
      setTimeout(() => setCopied(c => ({ ...c, [key]: false })), 2000);
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#1b2838', color: '#fff' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(102,192,244,0.1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(201,64,64,0.15)', border: '1px solid rgba(201,64,64,0.3)' }}>
            <Terminal className="w-3.5 h-3.5" style={{ color: '#c94040' }} />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Reverse Shell Generator</p>
            <p className="text-[10px]" style={{ color: 'rgba(198,212,223,0.6)' }}>17 payloads · obfuscación IA · listener integrado</p>
          </div>
        </div>
        <button onClick={() => setLegalOpen(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]"
          style={{ background: 'rgba(228,105,42,0.1)', border: '1px solid rgba(228,105,42,0.25)', color: '#e4692a' }}>
          <AlertTriangle className="w-3 h-3" />
          Aviso legal
          <ChevronDown className={`w-3 h-3 transition-transform ${legalOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Legal */}
      <AnimatePresence>
        {legalOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div className="mx-6 mt-4 p-4 rounded-xl text-[11px] leading-relaxed"
              style={{ background: 'rgba(228,105,42,0.07)', border: '1px solid rgba(228,105,42,0.2)', color: 'rgba(255,200,100,0.8)' }}>
              <strong style={{ color: '#e4692a' }}>⚠ Advertencia legal:</strong> Esta herramienta genera payloads únicamente para uso en entornos propios, laboratorios o con autorización expresa por escrito. El uso no autorizado constituye un delito tipificado en el Art. 264 del Código Penal español y legislaciones equivalentes.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Columna izquierda */}
        <div className="w-[320px] flex-shrink-0 flex flex-col overflow-hidden" style={{ borderRight: '1px solid rgba(102,192,244,0.1)' }}>

          {/* Params */}
          <div className="p-4 space-y-3" style={{ borderBottom: '1px solid rgba(102,192,244,0.08)' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(143,152,160,0.9)' }}>Parámetros</p>

            <div>
              <label className="text-[10px] block mb-1" style={{ color: 'rgba(198,212,223,0.7)' }}>LHOST — IP atacante</label>
              <input value={lhost} onChange={e => setLhost(e.target.value)} placeholder="192.168.1.100"
                className="w-full rounded-lg px-3 py-2 text-xs font-mono outline-none"
                style={{ background: 'rgba(102,192,244,0.07)', border: '1px solid rgba(102,192,244,0.15)', color: '#fff' }}
                onFocus={e => e.target.style.borderColor = 'rgba(201,64,64,0.5)'}
                onBlur={e  => e.target.style.borderColor = 'rgba(102,192,244,0.15)'} />
            </div>

            <div>
              <label className="text-[10px] block mb-1" style={{ color: 'rgba(198,212,223,0.7)' }}>LPORT — Puerto</label>
              <input type="number" value={lport} min={1} max={65535} onChange={e => setLport(Number(e.target.value))}
                className="w-full rounded-lg px-3 py-2 text-xs font-mono outline-none"
                style={{ background: 'rgba(102,192,244,0.07)', border: '1px solid rgba(102,192,244,0.15)', color: '#fff' }}
                onFocus={e => e.target.style.borderColor = 'rgba(201,64,64,0.5)'}
                onBlur={e  => e.target.style.borderColor = 'rgba(102,192,244,0.15)'} />
            </div>

            <div>
              <label className="text-[10px] block mb-1" style={{ color: 'rgba(198,212,223,0.7)' }}>Codificación</label>
              <div className="flex gap-1.5">
                {ENCODINGS.map(enc => (
                  <button key={enc.id} onClick={() => setEncoding(enc.id)}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[11px]"
                    style={encoding === enc.id
                      ? { background: 'rgba(201,64,64,0.15)', border: '1px solid rgba(201,64,64,0.35)', color: '#c94040' }
                      : { background: 'rgba(42,71,94,0.4)', border: '1px solid rgba(102,192,244,0.1)', color: 'rgba(198,212,223,0.7)' }}>
                    {enc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle IA */}
            <div className="flex items-center justify-between p-3 rounded-xl"
              style={obfuscate
                ? { background: 'rgba(155,89,182,0.1)', border: '1px solid rgba(155,89,182,0.25)' }
                : { background: 'rgba(42,71,94,0.3)', border: '1px solid rgba(102,192,244,0.1)' }}>
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5" style={{ color: obfuscate ? '#9b59b6' : 'rgba(143,152,160,0.7)' }} />
                <div>
                  <p className="text-[11px] font-medium text-white">Obfuscación IA</p>
                  <p className="text-[9px]" style={{ color: 'rgba(143,152,160,0.9)' }}>{apiKey ? 'Groq API detectada' : 'Requiere API key'}</p>
                </div>
              </div>
              <button onClick={() => apiKey && setObfuscate(v => !v)}
                className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
                style={{ background: obfuscate ? '#9b59b6' : 'rgba(143,152,160,0.4)', opacity: apiKey ? 1 : 0.4, cursor: apiKey ? 'pointer' : 'not-allowed' }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                  style={{ transform: obfuscate ? 'translateX(16px)' : 'translateX(2px)' }} />
              </button>
            </div>
          </div>

          {/* Language list */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(143,152,160,0.9)' }}>Lenguaje</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {categories.map(cat => {
                const col = cat === 'all' ? '#66c0f4' : catColor(cat);
                return (
                  <button key={cat} onClick={() => setFilterCat(cat)}
                    className="px-2.5 py-1 rounded-lg text-[10px]"
                    style={filterCat === cat
                      ? { background: `${col}18`, border: `1px solid ${col}35`, color: col }
                      : { background: 'rgba(42,71,94,0.4)', border: '1px solid rgba(102,192,244,0.1)', color: 'rgba(198,212,223,0.6)' }}>
                    {cat === 'all' ? 'Todos' : cat}
                  </button>
                );
              })}
            </div>
            <div className="space-y-1">
              {filtered.map(lang => {
                const CatIcon = CAT_CFG[lang.category]?.icon || Code2;
                const col = catColor(lang.category);
                const active = selected === lang.id;
                return (
                  <button key={lang.id} onClick={() => setSelected(lang.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left"
                    style={active
                      ? { background: 'rgba(201,64,64,0.1)', border: '1px solid rgba(201,64,64,0.25)' }
                      : { background: 'rgba(42,71,94,0.2)', border: '1px solid rgba(102,192,244,0.08)' }}>
                    <div className="flex items-center gap-2">
                      <CatIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: active ? col : 'rgba(143,152,160,0.9)' }} />
                      <span className="text-[11px] font-medium" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.65)' }}>{lang.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px]" style={{ color: OS_COLOR[lang.os] || 'rgba(143,152,160,0.7)' }}>{lang.os}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: `${col}15`, border: `1px solid ${col}25`, color: col }}>{lang.category}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generar */}
          <div className="p-4" style={{ borderTop: '1px solid rgba(102,192,244,0.1)' }}>
            <button onClick={generate} disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: '#c94040', color: '#fff', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</> : <><Zap className="w-4 h-4" /> Generar Payload</>}
            </button>
            {error && <p className="mt-2 text-[11px] text-center" style={{ color: '#c94040' }}>{error}</p>}
          </div>
        </div>

        {/* Columna derecha */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {!result && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(42,71,94,0.2)', border: '1px solid rgba(102,192,244,0.1)' }}>
                <Terminal className="w-7 h-7" style={{ color: 'rgba(143,152,160,0.4)' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'rgba(143,152,160,0.6)' }}>Configura LHOST, LPORT y selecciona un lenguaje</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(143,152,160,0.4)' }}>Pulsa "Generar Payload" para obtener tu reverse shell</p>
            </div>
          )}

          {loading && (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#c94040' }} />
                <p className="text-sm" style={{ color: 'rgba(198,212,223,0.7)' }}>
                  {obfuscate ? 'Generando y obfuscando con IA...' : 'Generando payload...'}
                </p>
              </div>
            </div>
          )}

          {result && !loading && (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-white">{result.label}</h3>
                    <StatBadge label={result.category} color={catColor(result.category)} />
                    <span className="text-[10px]" style={{ color: OS_COLOR[result.os] || 'rgba(143,152,160,0.9)' }}>{result.os}</span>
                  </div>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{result.description}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-4">
                  <StatBadge label={`${lhost}:${lport}`} color="#66c0f4" />
                  {result.encoding !== 'none' && <StatBadge label={result.encoding} color="#66c0f4" />}
                </div>
              </div>

              <CodeBlock label="Payload" badge="victim" badgeColor="#c94040"
                code={result.payload} copyKey="payload" copied={copied} onCopy={copy} accent="rgba(201,64,64,0.2)" />

              <CodeBlock label="Listener — máquina atacante" badge="attacker" badgeColor="#5ba32b"
                code={result.listener} copyKey="listener" copied={copied} onCopy={copy} accent="rgba(91,163,43,0.2)" />

              {result.obfuscated && result.obfuscated_payload && (
                <CodeBlock label="Payload obfuscado (IA Groq)" badge="AI obfuscated" badgeColor="#9b59b6"
                  code={result.obfuscated_payload} copyKey="obf" copied={copied} onCopy={copy} accent="rgba(155,89,182,0.2)" />
              )}

              {result.obfuscation_error && (
                <div className="p-3 rounded-xl text-[11px]"
                  style={{ background: 'rgba(228,105,42,0.07)', border: '1px solid rgba(228,105,42,0.2)', color: 'rgba(255,200,100,0.8)' }}>
                  ⚠ Error obfuscación IA: {result.obfuscation_error}
                </div>
              )}

              {USAGE_NOTES[result.language] && (
                <div className="p-4 rounded-xl" style={{ background: 'rgba(102,192,244,0.06)', border: '1px solid rgba(102,192,244,0.15)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#66c0f4' }}>Notas de uso</p>
                  <ul className="space-y-1">
                    {USAGE_NOTES[result.language].map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px]" style={{ color: 'rgba(198,212,223,0.8)' }}>
                        <span style={{ color: '#66c0f4', marginTop: 2, flexShrink: 0 }}>›</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default RevShellPanel;
