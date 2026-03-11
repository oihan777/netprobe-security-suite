import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Globe, Shield, AlertTriangle, CheckCircle2, XCircle,
  Server, Lock, ChevronDown, ChevronRight, RefreshCw, Key,
  Wifi, Database, FileText, Eye, Zap, Clock
} from 'lucide-react';

const API = 'http://localhost:8000';

const RISK_CFG = {
  CRITICAL: { color: '#c94040', bg: 'rgba(201,64,64,0.12)', label: 'Crítico'  },
  HIGH:     { color: '#e4692a', bg: 'rgba(228,105,42,0.12)', label: 'Alto'    },
  MEDIUM:   { color: '#c8a951', bg: 'rgba(200,169,81,0.12)', label: 'Medio'   },
  LOW:      { color: '#5ba32b', bg: 'rgba(91,163,43,0.12)',  label: 'Bajo'    },
};

// ── Source badge ──────────────────────────────────────────────────
function SourceBadge({ name, status, color }) {
  const s = status === 'ok'      ? '#5ba32b'
          : status === 'error'   ? '#c94040'
          : status === 'no_key'  ? '#8f98a0'
          : '#e4692a';
  return (
    <span className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-full font-semibold"
      style={{ background: `${s}15`, border: `1px solid ${s}30`, color: s }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s }} />
      {name}
    </span>
  );
}

// ── Collapsible section ───────────────────────────────────────────
function Section({ title, icon: Icon, color = '#66c0f4', badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-[rgba(102,192,244,0.1)] overflow-hidden"
      style={{ background: 'rgba(42,71,94,0.2)' }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[rgba(42,71,94,0.3)] transition-colors">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="text-xs font-semibold text-white flex-1 text-left">{title}</span>
        {badge && <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
          style={{ background: `${color}18`, color }}>{badge}</span>}
        <ChevronDown className={`w-3.5 h-3.5 text-[rgba(143,152,160,0.9)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            style={{ overflow: 'hidden' }}>
            <div className="px-4 pb-4 pt-1 border-t border-[rgba(102,192,244,0.07)]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── KV row ────────────────────────────────────────────────────────
function KV({ label, value, mono = false, color }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2 py-1 border-b border-[rgba(42,71,94,0.4)] last:border-0">
      <span className="text-[10px] text-[rgba(198,212,223,0.6)] w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-[10px] flex-1 break-all ${mono ? 'font-mono' : ''}`}
        style={{ color: color || '#c6d4df' }}>
        {Array.isArray(value) ? value.join(', ') : String(value)}
      </span>
    </div>
  );
}

// ── Port chip ─────────────────────────────────────────────────────
const DANGEROUS_PORTS = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 9200, 27017];
function PortChip({ port }) {
  const risky = DANGEROUS_PORTS.includes(port);
  return (
    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold"
      style={{
        background: risky ? 'rgba(228,105,42,0.15)' : 'rgba(102,192,244,0.08)',
        color:      risky ? '#e4692a' : 'rgba(198,212,223,0.8)',
        border:     `1px solid ${risky ? 'rgba(228,105,42,0.3)' : 'rgba(102,192,244,0.1)'}`,
      }}>{port}</span>
  );
}

// ── Shodan section ────────────────────────────────────────────────
function ShodanSection({ data }) {
  if (data?.error) return <p className="text-[10px] text-[#e4692a] mt-2">{data.error}</p>;
  return (
    <div className="space-y-3 mt-2">
      <KV label="IP" value={data.ip} mono />
      <KV label="Organización" value={data.org} />
      <KV label="País" value={data.country} />
      <KV label="ISP" value={data.isp} />
      <KV label="ASN" value={data.asn} mono />
      <KV label="SO" value={data.os} />
      {data.hostnames?.length > 0 && <KV label="Hostnames" value={data.hostnames} />}
      <KV label="Última vista" value={data.last_update?.slice(0, 10)} />

      {data.ports?.length > 0 && (
        <div className="pt-1">
          <p className="text-[9px] uppercase tracking-widest text-[rgba(143,152,160,0.9)] font-semibold mb-2">
            Puertos abiertos ({data.ports.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {data.ports.map(p => <PortChip key={p} port={p} />)}
          </div>
        </div>
      )}

      {data.vulns?.length > 0 && (
        <div className="pt-1">
          <p className="text-[9px] uppercase tracking-widest text-[rgba(201,64,64,0.8)] font-semibold mb-2 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" /> CVEs conocidos ({data.vulns.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {data.vulns.map(v => (
              <a key={v} href={`https://nvd.nist.gov/vuln/detail/${v}`} target="_blank" rel="noreferrer"
                className="text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold hover:opacity-80 transition-opacity"
                style={{ background: 'rgba(201,64,64,0.15)', color: '#c94040', border: '1px solid rgba(201,64,64,0.3)' }}>
                {v}
              </a>
            ))}
          </div>
        </div>
      )}

      {data.services?.length > 0 && (
        <div className="pt-1">
          <p className="text-[9px] uppercase tracking-widest text-[rgba(143,152,160,0.9)] font-semibold mb-2">Servicios</p>
          <div className="space-y-1.5">
            {data.services.map((svc, i) => (
              <div key={i} className="rounded-lg px-2.5 py-2 text-[10px]"
                style={{ background: 'rgba(42,71,94,0.3)', border: '1px solid rgba(102,192,244,0.1)' }}>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#66c0f4]">{svc.port}/{svc.transport}</span>
                  {svc.product && <span className="text-white">{svc.product}</span>}
                  {svc.version && <span className="text-[rgba(198,212,223,0.7)]">v{svc.version}</span>}
                  {svc.http_title && <span className="text-[rgba(198,212,223,0.7)] truncate">— {svc.http_title}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── VirusTotal section ────────────────────────────────────────────
function VTSection({ data }) {
  if (data?.error) return <p className="text-[10px] text-[#e4692a] mt-2">{data.error}</p>;
  const total = (data.malicious || 0) + (data.suspicious || 0) + (data.harmless || 0) + (data.undetected || 0);
  const bad   = (data.malicious || 0) + (data.suspicious || 0);
  const pct   = total > 0 ? Math.round(bad / total * 100) : 0;
  return (
    <div className="space-y-3 mt-2">
      {/* Detection bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[rgba(198,212,223,0.8)]">Detección</span>
          <span className="text-[10px] font-bold" style={{ color: bad > 0 ? '#c94040' : '#5ba32b' }}>
            {bad}/{total} motores
          </span>
        </div>
        <div className="h-2 rounded-full bg-[rgba(102,192,244,0.1)] overflow-hidden">
          <motion.div className="h-full rounded-full"
            style={{ background: bad > 5 ? '#c94040' : bad > 0 ? '#e4692a' : '#5ba32b' }}
            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          ['Malicioso',  data.malicious,  '#c94040'],
          ['Sospechoso', data.suspicious, '#e4692a'],
          ['Limpio',     data.harmless,   '#5ba32b'],
          ['Sin datos',  data.undetected, '#8f98a0'],
        ].map(([label, val, color]) => (
          <div key={label} className="rounded-lg px-2.5 py-2 text-center"
            style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
            <div className="text-lg font-bold" style={{ color }}>{val ?? 0}</div>
            <div className="text-[9px] text-[rgba(198,212,223,0.7)]">{label}</div>
          </div>
        ))}
      </div>

      <KV label="Reputación" value={data.reputation} color={data.reputation < 0 ? '#c94040' : '#5ba32b'} />
      <KV label="País" value={data.country} />
      <KV label="AS Owner" value={data.as_owner} />
      <KV label="Red" value={data.network} mono />

      {data.malicious_engines?.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-[rgba(201,64,64,0.7)] font-semibold mb-1.5">
            Motores que lo marcan
          </p>
          <div className="flex flex-wrap gap-1">
            {data.malicious_engines.map(e => (
              <span key={e} className="text-[9px] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(201,64,64,0.12)', color: '#c94040', border: '1px solid rgba(201,64,64,0.25)' }}>
                {e}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.categories && Object.keys(data.categories).length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-[rgba(143,152,160,0.9)] font-semibold mb-1.5">Categorías</p>
          <div className="flex flex-wrap gap-1">
            {Object.values(data.categories).map((cat, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(102,192,244,0.08)] text-[rgba(198,212,223,0.8)]">
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── HIBP section ──────────────────────────────────────────────────
function HIBPSection({ data }) {
  if (data?.error) return <p className="text-[10px] text-[#e4692a] mt-2">{data.error}</p>;
  if (data?.clean || data?.total_breaches === 0) return (
    <div className="mt-2 flex items-center gap-2 text-[#5ba32b] text-xs">
      <CheckCircle2 className="w-4 h-4" /> No encontrado en ninguna brecha conocida
    </div>
  );
  return (
    <div className="space-y-2 mt-2">
      <p className="text-[10px] font-bold text-[#c94040] flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        {data.total_breaches} brecha(s) de datos asociadas
      </p>
      {data.breaches?.map((b, i) => (
        <div key={i} className="rounded-lg px-3 py-2"
          style={{ background: 'rgba(201,64,64,0.07)', border: '1px solid rgba(201,64,64,0.2)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-white">{b.name}</span>
            <span className="text-[9px] text-[rgba(143,152,160,0.9)]">{b.date}</span>
            {b.verified && <span className="text-[8px] px-1 py-0.5 rounded bg-[rgba(201,64,64,0.2)] text-[#c94040] font-bold">Verificado</span>}
          </div>
          {b.pwn_count > 0 && (
            <p className="text-[9px] text-[rgba(198,212,223,0.7)]">
              {b.pwn_count.toLocaleString()} cuentas comprometidas
            </p>
          )}
          {b.data_classes?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {b.data_classes.map(d => (
                <span key={d} className="text-[8px] px-1 py-0.5 rounded bg-[rgba(102,192,244,0.1)] text-[rgba(198,212,223,0.7)]">{d}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── DNS section ───────────────────────────────────────────────────
function DNSSection({ data }) {
  if (data?.error) return <p className="text-[10px] text-[#e4692a] mt-2">{data.error}</p>;
  return (
    <div className="space-y-2 mt-2">
      {data.reverse_dns && <KV label="PTR (reverso)" value={data.reverse_dns} mono />}
      {Object.entries(data.records || {}).map(([type, vals]) => (
        <KV key={type} label={type} value={Array.isArray(vals) ? vals.join('\n') : vals} mono />
      ))}
      {data.spf   && <KV label="SPF"   value={data.spf}   mono color="#5ba32b" />}
      {data.dmarc && <KV label="DMARC" value={data.dmarc} mono color="#5ba32b" />}
      {!data.spf   && <p className="text-[9px] text-[#e4692a]">⚠ Sin registro SPF — vulnerable a email spoofing</p>}
      {!data.dmarc && <p className="text-[9px] text-[#e4692a]">⚠ Sin registro DMARC — sin política anti-phishing</p>}
      {data.subdomains_hint?.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-[rgba(143,152,160,0.9)] font-semibold mb-1.5">Subdominios activos</p>
          {data.subdomains_hint.map((s, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="text-[10px] font-mono text-[#66c0f4]">{s.subdomain}</span>
              <span className="text-[9px] text-[rgba(143,152,160,0.9)]">→ {s.ip}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SSL section ───────────────────────────────────────────────────
function SSLSection({ data }) {
  if (data?.ssl_error && !data.subject) return (
    <p className="text-[10px] text-[#e4692a] mt-2">{data.ssl_error}</p>
  );
  return (
    <div className="space-y-1 mt-2">
      <KV label="Sujeto" value={data.subject?.commonName || data.subject?.CN} />
      <KV label="Emisor" value={data.issuer?.organizationName || data.issuer?.O} />
      <KV label="Válido desde" value={data.not_before} />
      <KV label="Expira" value={data.not_after}
        color={data.expiry_warning ? '#c94040' : undefined} />
      {data.days_until_expiry !== undefined && (
        <KV label="Días restantes" value={`${data.days_until_expiry} días`}
          color={data.days_until_expiry < 30 ? '#c94040' : data.days_until_expiry < 90 ? '#e4692a' : '#5ba32b'} />
      )}
      {data.sans?.length > 0 && <KV label="SANs" value={data.sans.slice(0, 8).join(', ')} mono />}
      {data.cert_invalid && (
        <p className="text-[9px] text-[#c94040] mt-1">⚠ Certificado inválido: {data.ssl_error}</p>
      )}
    </div>
  );
}

// ── Whois section ─────────────────────────────────────────────────
function WhoisSection({ data }) {
  if (data?.error) return <p className="text-[10px] text-[#e4692a] mt-2">{data.error}</p>;
  return (
    <div className="space-y-1 mt-2">
      <KV label="Registrador" value={data.registrar} />
      <KV label="Creado" value={data.created} />
      <KV label="Expira" value={data.expires} />
      <KV label="País" value={data.registrant_country} />
      <KV label="Nameservers" value={data.nameservers} mono />
    </div>
  );
}

// ── API Keys modal ────────────────────────────────────────────────
function KeysModal({ keys, onChange, onClose }) {
  const [local, setLocal] = useState({ ...keys });
  const FIELDS = [
    { key: 'shodan',     label: 'Shodan API Key',      url: 'https://account.shodan.io',                 hint: 'Gratuita',  placeholder: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' },
    { key: 'virustotal', label: 'VirusTotal API Key',   url: 'https://www.virustotal.com/gui/my-apikey',  hint: 'Gratuita',  placeholder: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' },
    { key: 'hibp',       label: 'HIBP API Key',         url: 'https://haveibeenpwned.com/API/Key',        hint: 'De pago',   placeholder: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX' },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(23,26,33,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-[rgba(102,192,244,0.15)] overflow-hidden"
        style={{ background: '#171a21' }}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(102,192,244,0.1)]">
          <Key className="w-4 h-4 text-[#c8a951]" />
          <span className="text-sm font-bold text-white flex-1">API Keys para OSINT</span>
          <button onClick={onClose} className="text-[rgba(198,212,223,0.7)] hover:text-white text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[10px] text-[rgba(198,212,223,0.7)]">
            DNS, SSL y Whois funcionan sin API key. Shodan y VirusTotal son gratuitos.
          </p>
          {FIELDS.map(f => (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-[#c6d4df] flex items-center gap-1.5">
                  {f.label}
                  {local[f.key]
                    ? <span className="flex items-center gap-1 text-[9px] font-semibold" style={{ color: '#5ba32b' }}>
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#5ba32b' }} />guardada
                      </span>
                    : <span className="text-[9px]" style={{ color: 'rgba(228,105,42,0.8)' }}>vacía</span>
                  }
                </label>
                <a href={f.url} target="_blank" rel="noreferrer"
                  className="text-[9px] text-[#66c0f4] hover:underline">{f.hint} →</a>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={local[f.key] || ''}
                  onChange={e => setLocal(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={local[f.key] ? '••••••••••••••••••••' : f.placeholder}
                  className="w-full bg-[rgba(102,192,244,0.07)] border border-[rgba(102,192,244,0.15)] rounded-lg px-3 py-2 pr-10 text-xs text-white outline-none focus:border-[rgba(200,169,81,0.4)] placeholder-[rgba(143,152,160,0.6)]" />
                {local[f.key] && (
                  <button onClick={() => { if(window.confirm('¿Borrar esta API key?')) setLocal(p => ({ ...p, [f.key]: '' })); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] transition-colors"
                    style={{ color: 'rgba(201,64,64,0.6)' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#c94040'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,64,64,0.6)'}
                    title="Borrar">✕</button>
                )}
              </div>
            </div>
          ))}
          <button onClick={() => { onChange(local); onClose(); }}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ background: 'rgba(200,169,81,0.15)', border: '1px solid rgba(200,169,81,0.4)', color: '#c8a951' }}>
            Guardar API Keys
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────
export function OSINTPanel({ target: propTarget = '' }) {
  const [target,   setTarget]  = useState(propTarget);
  const [loading,  setLoading] = useState(false);
  const [data,     setData]    = useState(null);
  const [error,    setError]   = useState('');
  const [keys,     setKeys]    = useState(() => {
    try { return JSON.parse(localStorage.getItem('np-osint-keys') || '{}'); } catch { return {}; }
  });
  const [showKeys, setShowKeys]= useState(false);

  const saveKeys = (k) => {
    setKeys(k);
    try { localStorage.setItem('np-osint-keys', JSON.stringify(k)); } catch {}
  };

  const run = async () => {
    if (!target.trim()) return;
    setLoading(true); setError(''); setData(null);
    try {
      const resp = await fetch(`${API}/api/osint/full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target:      target.trim(),
          shodan_key:  keys.shodan  || '',
          vt_key:      keys.virustotal || '',
          hibp_key:    keys.hibp    || '',
        }),
      });
      const json = await resp.json();
      setData(json);
    } catch(e) { setError('Error al conectar con el backend: ' + e.message); }
    finally { setLoading(false); }
  };

  const summary  = data?.summary;
  const risk     = summary ? RISK_CFG[summary.risk_level] : null;
  const shodanOk = data?.shodan && !data.shodan.error;
  const vtOk     = data?.virustotal && !data.virustotal.error;
  const hibpOk   = data?.hibp && !data.hibp.error;
  const dnsOk    = data?.dns && !data.dns.error;
  const sslOk    = data?.ssl;
  const whoisOk  = data?.whois;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4" style={{ background: 'rgba(23,26,33,0.2)' }}>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(102,192,244,0.15)', border: '1px solid rgba(102,192,244,0.3)' }}>
              <Eye className="w-4.5 h-4.5 text-[#66c0f4]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">OSINT — Reconocimiento Pasivo</h2>
              <p className="text-[10px] text-[rgba(198,212,223,0.6)]">Sin tocar el objetivo · Solo información pública</p>
            </div>
          </div>
          <button onClick={() => setShowKeys(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
            style={{ background: 'rgba(200,169,81,0.08)', border: '1px solid rgba(200,169,81,0.25)', color: '#c8a951' }}>
            <Key className="w-3 h-3" /> API Keys
          </button>
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input value={target} onChange={e => setTarget(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && run()}
              placeholder="IP, dominio o email  (ej: 8.8.8.8 · google.com · user@company.com)"
              className="w-full bg-[rgba(102,192,244,0.07)] border border-[rgba(102,192,244,0.15)] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[rgba(102,192,244,0.5)] placeholder-[rgba(143,152,160,0.6)] pr-10" />
            <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgba(143,152,160,0.6)]" />
          </div>
          <button onClick={run} disabled={loading || !target.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, rgba(102,192,244,0.3), rgba(87,203,222,0.2))', border: '1px solid rgba(102,192,244,0.5)', color: 'white' }}>
            {loading
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Search className="w-4 h-4" />}
            {loading ? 'Analizando…' : 'Analizar'}
          </button>
        </div>

        {/* API key status */}
        <div className="flex flex-wrap gap-1.5">
          <SourceBadge name="DNS/SSL/Whois" status="ok" />
          <SourceBadge name="Shodan"     status={keys.shodan     ? 'ok' : 'no_key'} />
          <SourceBadge name="VirusTotal" status={keys.virustotal ? 'ok' : 'no_key'} />
          <SourceBadge name="HIBP"       status={keys.hibp       ? 'ok' : 'no_key'} />
        </div>

        {error && <p className="text-xs text-[#c94040]">{error}</p>}

        {/* Risk summary banner */}
        {summary && risk && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: risk.bg, border: `1px solid ${risk.color}30` }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${risk.color}25`, border: `1px solid ${risk.color}40` }}>
              {summary.risk_level === 'LOW'
                ? <CheckCircle2 className="w-4 h-4" style={{ color: risk.color }} />
                : <AlertTriangle className="w-4 h-4" style={{ color: risk.color }} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold" style={{ color: risk.color }}>
                  Nivel de riesgo: {risk.label}
                </span>
                <span className="text-[9px] text-[rgba(143,152,160,0.9)]">{summary.target}</span>
              </div>
              {summary.risk_indicators.length > 0 ? (
                <ul className="space-y-0.5">
                  {summary.risk_indicators.map((r, i) => (
                    <li key={i} className="text-[10px] text-[#c6d4df] flex items-start gap-1.5">
                      <span style={{ color: risk.color }}>•</span>{r}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[10px] text-[rgba(198,212,223,0.8)]">No se encontraron indicadores de riesgo significativos</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Results sections */}
        {data && (
          <div className="space-y-2">
            {shodanOk && (
              <Section title="Shodan — Puertos, servicios y CVEs" icon={Server} color="#e4692a"
                badge={`${data.shodan.ports?.length || 0} puertos · ${data.shodan.vulns?.length || 0} CVEs`}
                defaultOpen>
                <ShodanSection data={data.shodan} />
              </Section>
            )}
            {!shodanOk && data.shodan?.error && (
              <Section title="Shodan" icon={Server} color="#8f98a0">
                <p className="text-[10px] text-[rgba(198,212,223,0.7)] mt-2">{data.shodan.error}</p>
              </Section>
            )}

            {vtOk && (
              <Section title="VirusTotal — Reputación y detecciones" icon={Shield} color="#9b59b6"
                badge={`${data.virustotal.malicious || 0} malicioso`}
                defaultOpen={data.virustotal.malicious > 0}>
                <VTSection data={data.virustotal} />
              </Section>
            )}

            {hibpOk && (
              <Section title="Have I Been Pwned — Brechas de datos" icon={AlertTriangle} color="#c94040"
                badge={data.hibp.total_breaches > 0 ? `${data.hibp.total_breaches} brechas` : 'Limpio'}
                defaultOpen={data.hibp.total_breaches > 0}>
                <HIBPSection data={data.hibp} />
              </Section>
            )}

            {dnsOk && (
              <Section title="DNS — Registros y subdominios" icon={Globe} color="#66c0f4"
                badge={`${Object.keys(data.dns.records || {}).length} tipos`}>
                <DNSSection data={data.dns} />
              </Section>
            )}

            {sslOk && (
              <Section title="SSL/TLS — Certificado" icon={Lock}
                color={data.ssl.expiry_warning || data.ssl.cert_invalid ? '#c94040' : '#5ba32b'}
                badge={data.ssl.days_until_expiry !== undefined ? `${data.ssl.days_until_expiry}d` : ''}>
                <SSLSection data={data.ssl} />
              </Section>
            )}

            {whoisOk && (
              <Section title="Whois — Registro del dominio" icon={FileText} color="#66c0f4">
                <WhoisSection data={data.whois} />
              </Section>
            )}
          </div>
        )}

        {/* Empty state */}
        {!data && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-4">🔭</div>
            <p className="text-sm font-semibold text-white mb-2">Reconocimiento pasivo</p>
            <p className="text-xs text-[rgba(198,212,223,0.6)] max-w-sm">
              Introduce una IP, dominio o email para obtener información pública sin alertar al objetivo.
              DNS y SSL funcionan sin API key.
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showKeys && <KeysModal keys={keys} onChange={saveKeys} onClose={() => setShowKeys(false)} />}
      </AnimatePresence>
    </div>
  );
}
