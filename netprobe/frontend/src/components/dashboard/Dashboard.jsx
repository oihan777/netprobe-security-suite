import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, Shield, AlertTriangle,
  Clock, Target, Trash2, ChevronRight, RefreshCw, BarChart2,
  Wifi, Monitor, Server, Globe, Shield as ShieldIcon, Smartphone, Cpu as CpuIcon, Database as DatabaseIcon,
  Network, Activity, Hash, MapPin,
  History, Zap, Check, Eye
} from 'lucide-react';

const API = 'http://localhost:8000';

const STATUS_CFG = {
  BLOCKED:   { color: '#5ba32b', label: 'Bloqueado'  },
  DETECTED:  { color: '#e4692a', label: 'Detectado'  },
  PARTIAL:   { color: '#e4692a', label: 'Parcial'    },
  VULNERABLE:{ color: '#c94040', label: 'Vulnerable' },
  ERROR:     { color: '#8f98a0', label: 'Error'      },
};

const CAT_COLORS = {
  recon:'#66c0f4', fingerprint:'#5ba32b', flood:'#c94040',
  brute_force:'#e4692a', protocol:'#9b59b6', web:'#c94040',
  dns:'#c8a951', evasion:'#66c0f4', firewall:'#c8a951',
};

function scoreColor(s) {
  if (s == null) return '#8f98a0';
  if (s >= 80)  return '#5ba32b';
  if (s >= 60)  return '#e4692a';
  if (s >= 35)  return '#e4692a';
  return '#c94040';
}
function scoreLabel(s) {
  if (s == null) return 'N/A';
  if (s >= 80)  return 'Seguro';
  if (s >= 60)  return 'Aceptable';
  if (s >= 35)  return 'En Riesgo';
  return 'Crítico';
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day:'2-digit', month:'short' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

// ── Stat card ────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'rgba(255,255,255,0.8)', icon: Icon, trend }) {
  return (
    <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
      className="rounded-xl border border-[rgba(102,192,244,0.1)] p-4 flex flex-col gap-2"
      style={{ background:'rgba(42,71,94,0.3)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-[rgba(198,212,223,0.6)] font-semibold">{label}</span>
        {Icon && <Icon className="w-4 h-4 opacity-30" />}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold" style={{ color }}>{value}</span>
        {trend !== undefined && (
          <span className="text-xs mb-0.5 flex items-center gap-0.5"
            style={{ color: trend > 0 ? '#5ba32b' : trend < 0 ? '#c94040' : '#8f98a0' }}>
            {trend > 0 ? <TrendingUp className="w-3 h-3"/> : trend < 0 ? <TrendingDown className="w-3 h-3"/> : <Minus className="w-3 h-3"/>}
            {Math.abs(trend)}
          </span>
        )}
      </div>
      {sub && <span className="text-[10px] text-[rgba(143,152,160,0.9)]">{sub}</span>}
    </motion.div>
  );
}

// ── Device type config ───────────────────────────────────────────
const DEVICE_CFG = {
  'linux-server':    { label: 'Linux Server',    color: '#66c0f4', Icon: Server   },
  'windows-server':  { label: 'Windows Server',  color: '#9b59b6', Icon: Server   },
  'windows':         { label: 'Windows',         color: '#9b59b6', Icon: Monitor  },
  'web-server':      { label: 'Web Server',      color: '#e4692a', Icon: Globe    },
  'firewall-router': { label: 'Firewall/Router', color: '#c94040', Icon: ShieldIcon },
  'dns-server':      { label: 'DNS Server',      color: '#5ba32b', Icon: Globe    },
  'database':        { label: 'Database',        color: '#c8a951', Icon: DatabaseIcon },
  'mobile':          { label: 'Móvil',           color: '#57cbde', Icon: Smartphone },
  'iot':             { label: 'IoT',             color: '#ff6b9d', Icon: CpuIcon  },
  'host':            { label: 'Host',            color: '#c6d4df', Icon: Monitor  },
  'unknown':         { label: 'Desconocido',     color: 'rgba(143,152,160,0.7)', Icon: Wifi },
};

function DeviceTable({ hosts }) {
  const [sortBy, setSortBy] = useState('ip');
  const [sortDir, setSortDir] = useState('asc');
  const [filter, setFilter] = useState('');

  const sorted = [...hosts]
    .filter(h => !filter || h.ip.includes(filter) || (h.hostname||'').includes(filter) || (h.device_type||'').includes(filter))
    .sort((a, b) => {
      let av = a[sortBy] || '', bv = b[sortBy] || '';
      if (sortBy === 'ip') {
        // numeric IP sort
        const toNum = ip => ip.split('.').reduce((acc, n) => acc * 256 + parseInt(n||0), 0);
        av = isNaN(toNum(av)) ? 0 : toNum(av);
        bv = isNaN(toNum(bv)) ? 0 : toNum(bv);
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });

  const col = (key, label) => (
    <th className="text-left py-2 px-3 text-[9px] uppercase tracking-widest cursor-pointer select-none"
      style={{ color: sortBy === key ? '#66c0f4' : 'rgba(143,152,160,0.7)' }}
      onClick={() => { if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(key); setSortDir('asc'); } }}>
      {label} {sortBy === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  // Device type distribution
  const typeDist = {};
  for (const h of hosts) { const t = h.device_type || 'unknown'; typeDist[t] = (typeDist[t]||0)+1; }

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(typeDist).sort((a,b)=>b[1]-a[1]).map(([t, n]) => {
          const cfg = DEVICE_CFG[t] || DEVICE_CFG.unknown;
          const Icon = cfg.Icon;
          return (
            <div key={t} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
              style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}35` }}>
              <Icon className="w-3 h-3" style={{ color: cfg.color }} />
              <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
              <span className="text-[9px] font-bold" style={{ color: cfg.color }}>{n}</span>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="relative">
        <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'rgba(143,152,160,0.5)' }} />
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filtrar por IP, hostname o tipo..."
          className="w-full pl-7 text-[10px] px-2.5 py-1.5 rounded-lg outline-none"
          style={{ background: 'rgba(102,192,244,0.06)', border: '1px solid rgba(102,192,244,0.12)', color: '#c6d4df' }} />
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(102,192,244,0.1)' }}>
        <table className="w-full">
          <thead style={{ background: 'rgba(42,71,94,0.5)' }}>
            <tr>
              {col('ip',          'IP')}
              {col('hostname',    'Hostname')}
              {col('device_type', 'Tipo')}
              <th className="text-left py-2 px-3 text-[9px] uppercase tracking-widest" style={{ color: 'rgba(143,152,160,0.7)' }}>Puertos</th>
              <th className="text-left py-2 px-3 text-[9px] uppercase tracking-widest" style={{ color: 'rgba(143,152,160,0.7)' }}>OS</th>
              {col('latency', 'Latencia')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((h, i) => {
              const cfg = DEVICE_CFG[h.device_type] || DEVICE_CFG.unknown;
              const Icon = cfg.Icon;
              return (
                <tr key={h.ip} className="border-t transition-colors"
                  style={{
                    borderColor: 'rgba(102,192,244,0.06)',
                    background: i % 2 === 0 ? 'rgba(22,32,45,0.4)' : 'transparent',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(102,192,244,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'rgba(22,32,45,0.4)' : 'transparent'}>
                  <td className="py-2 px-3">
                    <span className="text-[10px] font-mono font-semibold" style={{ color: '#66c0f4' }}>{h.ip}</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-[10px] text-[#c6d4df]">{h.hostname || <span style={{ color: 'rgba(143,152,160,0.5)' }}>—</span>}</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="flex items-center gap-1.5">
                      <Icon className="w-3 h-3 flex-shrink-0" style={{ color: cfg.color }} />
                      <span className="text-[10px]" style={{ color: cfg.color }}>{cfg.label}</span>
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {h.open_ports?.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {h.open_ports.slice(0, 8).map(p => (
                          <span key={p} className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(102,192,244,0.1)', color: '#66c0f4' }}>{p}</span>
                        ))}
                        {h.open_ports.length > 8 && (
                          <span className="text-[9px]" style={{ color: 'rgba(143,152,160,0.6)' }}>+{h.open_ports.length - 8}</span>
                        )}
                      </div>
                    ) : <span style={{ color: 'rgba(143,152,160,0.4)', fontSize: '10px' }}>—</span>}
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-[10px]" style={{ color: 'rgba(198,212,223,0.7)' }}>{h.os || '—'}</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-[10px] font-mono"
                      style={{ color: h.latency < 5 ? '#5ba32b' : h.latency < 20 ? '#c8a951' : '#c94040' }}>
                      {h.latency ? `${h.latency}ms` : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-8 text-center text-[11px]" style={{ color: 'rgba(143,152,160,0.6)' }}>
            Sin dispositivos que coincidan
          </div>
        )}
      </div>
    </div>
  );
}

// ── Score chart tooltip ───────────────────────────────────────────
function ScoreTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-[rgba(143,152,160,0.4)] px-3 py-2 text-xs"
      style={{ background:'#1e2d3d' }}>
      <p className="font-bold" style={{ color: scoreColor(d.score) }}>{d.score}/100</p>
      <p className="text-[rgba(198,212,223,0.8)]">{d.target}</p>
      <p className="text-[rgba(198,212,223,0.6)]">{fmtDate(d.date)}</p>
    </div>
  );
}

// ── Session row ───────────────────────────────────────────────────
function SessionRow({ session, onDelete, onView, current }) {
  const sc = session.score;
  const trend = current && current !== session.id
    ? (sc ?? 0) - (0)  // placeholder; real diff computed in parent
    : null;

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
      className="flex items-center gap-3 px-4 py-2.5 border-b border-[rgba(102,192,244,0.07)] last:border-0 hover:bg-[rgba(42,71,94,0.2)] transition-colors group">
      {/* Score pill */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
        style={{ background:`${scoreColor(sc)}18`, color: scoreColor(sc), border:`1px solid ${scoreColor(sc)}30` }}>
        {sc ?? '?'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white font-mono truncate">{session.target}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
            style={{ background:`${scoreColor(sc)}15`, color: scoreColor(sc) }}>
            {scoreLabel(sc)}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[9px] text-[rgba(143,152,160,0.9)]">{fmtDateTime(session.started_at)}</span>
          <span className="text-[9px] text-[rgba(143,152,160,0.6)]">{session.total_modules} módulos</span>
          {session.profile && (
            <span className="text-[9px] text-[rgba(102,192,244,0.6)]">{session.profile}</span>
          )}
        </div>
      </div>

      {/* Status mini bars */}
      <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
        {[
          ['#c94040', session.vulnerable],
          ['#e4692a', session.partial],
          ['#e4692a', session.detected],
          ['#5ba32b', session.blocked],
        ].filter(([,v]) => v > 0).map(([color, val], i) => (
          <span key={i} className="text-[9px] font-bold px-1 rounded"
            style={{ color, background:`${color}18` }}>{val}</span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => onView(session)}
          className="p-1.5 rounded-lg text-[rgba(198,212,223,0.7)] hover:text-[#66c0f4] hover:bg-[rgba(102,192,244,0.1)] transition-all">
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(session.id)}
          className="p-1.5 rounded-lg text-[rgba(198,212,223,0.7)] hover:text-[#c94040] hover:bg-[rgba(201,64,64,0.1)] transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Session detail modal ──────────────────────────────────────────
function SessionModal({ session, results, onClose, onNoteChange }) {
  const [note, setNote] = useState(session.notes || '');
  const [saved, setSaved] = useState(false);

  const saveNote = async () => {
    await fetch(`${API}/api/history/sessions/${session.id}/note`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ notes: note }),
    });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    onNoteChange(session.id, note);
  };

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(23,26,33,0.7)', backdropFilter:'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale:0.95, y:20 }} animate={{ scale:1, y:0 }} exit={{ scale:0.95 }}
        className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl border border-[rgba(102,192,244,0.15)] overflow-hidden"
        style={{ background:'#171a21' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(102,192,244,0.1)]">
          <div className="text-xl font-bold" style={{ color: scoreColor(session.score) }}>
            {session.score ?? '?'}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">{session.target}</div>
            <div className="text-[10px] text-[rgba(198,212,223,0.6)]">{fmtDateTime(session.started_at)}</div>
          </div>
          <button onClick={onClose} className="text-[rgba(198,212,223,0.7)] hover:text-white transition-colors text-xl">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Module results */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[rgba(143,152,160,0.9)] font-semibold mb-2">Módulos</p>
            <div className="space-y-1">
              {results.map(r => {
                const cfg = STATUS_CFG[r.status] || STATUS_CFG.ERROR;
                return (
                  <ResultNoteRow key={r.id} result={r} cfg={cfg} />
                );
              })}
            </div>
          </div>

          {/* Session notes */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[rgba(143,152,160,0.9)] font-semibold mb-2">Notas de sesión</p>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Añade contexto, observaciones, próximos pasos..."
              className="w-full bg-[rgba(42,71,94,0.4)] border border-[rgba(102,192,244,0.15)] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[rgba(87,203,222,0.4)] resize-none placeholder-[rgba(143,152,160,0.6)]" />
            <button onClick={saveNote}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background:'rgba(87,203,222,0.1)', border:'1px solid rgba(87,203,222,0.3)', color:'#57cbde' }}>
              {saved ? <><Check className="w-3 h-3"/> Guardado</> : 'Guardar nota'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const NOTE_STATUSES = [
  { id:'',           label:'Sin estado',     color:'rgba(143,152,160,0.9)' },
  { id:'accepted',   label:'Aceptado',       color:'#5ba32b' },
  { id:'false_pos',  label:'Falso positivo', color:'#66c0f4' },
  { id:'in_progress',label:'En progreso',    color:'#e4692a' },
  { id:'fixed',      label:'Corregido',      color:'#66c0f4' },
];

function ResultNoteRow({ result, cfg }) {
  const [open,   setOpen]   = useState(false);
  const [note,   setNote]   = useState(result.note || '');
  const [status, setStatus] = useState(result.note_status || '');
  const [saved,  setSaved]  = useState(false);

  const save = async () => {
    await fetch(`${API}/api/history/results/${result.id}/note`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ note, note_status: status }),
    });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    setOpen(false);
  };

  const ns = NOTE_STATUSES.find(x => x.id === status);

  return (
    <div className="rounded-lg border border-[rgba(102,192,244,0.08)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[rgba(42,71,94,0.3)]"
        onClick={() => setOpen(o => !o)}>
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
        <span className="text-xs font-medium text-white flex-1 truncate">{result.module_name || result.module_id}</span>
        {ns?.id && (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
            style={{ color: ns.color, background:`${ns.color}18` }}>{ns.label}</span>
        )}
        <span className="text-[9px] font-bold flex-shrink-0" style={{ color: cfg.color }}>{cfg.label}</span>
        <span className="text-[9px] font-bold flex-shrink-0" style={{ color: cfg.color }}>{result.score ?? 'N/A'}</span>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height:0 }} animate={{ height:'auto' }} exit={{ height:0 }}
            style={{ overflow:'hidden' }}>
            <div className="px-3 pb-3 pt-1 space-y-2 bg-[rgba(42,71,94,0.2)]">
              {/* Status picker */}
              <div className="flex flex-wrap gap-1">
                {NOTE_STATUSES.map(ns => (
                  <button key={ns.id} onClick={() => setStatus(ns.id)}
                    className="text-[9px] px-2 py-1 rounded-full font-semibold transition-all"
                    style={{
                      background: status === ns.id ? `${ns.color}25` : 'rgba(102,192,244,0.07)',
                      color:      status === ns.id ? ns.color : 'rgba(198,212,223,0.7)',
                      border:     `1px solid ${status === ns.id ? ns.color+'50' : 'rgba(102,192,244,0.1)'}`,
                    }}>
                    {ns.label}
                  </button>
                ))}
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Añade una nota a este resultado..."
                className="w-full bg-[rgba(42,71,94,0.4)] border border-[rgba(102,192,244,0.1)] rounded px-2 py-1.5 text-[11px] text-white outline-none resize-none placeholder-[rgba(143,152,160,0.6)] focus:border-[rgba(87,203,222,0.3)]" />
              <button onClick={save}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-all"
                style={{ background:'rgba(87,203,222,0.1)', border:'1px solid rgba(87,203,222,0.3)', color:'#57cbde' }}>
                {saved ? <><Check className="w-3 h-3"/>Guardado</> : 'Guardar'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────
export function Dashboard({ currentResults = [], currentScore = null, currentTarget = '', caseId = null, discoveredHosts = [] }) {
  const [stats,         setStats]        = useState(null);
  const [sessions,      setSessions]     = useState([]);
  const [loading,       setLoading]      = useState(true);
  const [filterTarget,  setFilterTarget] = useState('');
  const [viewSession,   setViewSession]  = useState(null);
  const [viewResults,   setViewResults]  = useState([]);
  const [activeView,    setActiveView]   = useState('dashboard'); // dashboard | history

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (caseId) {
        // Filtrar estrictamente por caso
        const tq = filterTarget ? `?target_filter=${encodeURIComponent(filterTarget)}` : '';
        const [s, h] = await Promise.all([
          fetch(`${API}/api/cases/${caseId}/dashboard`).then(r => r.json()),
          fetch(`${API}/api/cases/${caseId}/sessions?limit=50`).then(r => r.json()),
        ]);
        setStats(s);
        // Filtro adicional en cliente por target si se especifica
        let sesiones = h.sessions || [];
        if (filterTarget) sesiones = sesiones.filter(s => s.target.includes(filterTarget));
        setSessions(sesiones);
      } else {
        // Sin caso activo — no mostrar nada
        setStats(null);
        setSessions([]);
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterTarget, caseId]);

  useEffect(() => { load(); }, [load]);

  const deleteSession = async (sid) => {
    if (!confirm('¿Eliminar esta sesión?')) return;
    await fetch(`${API}/api/history/sessions/${sid}`, { method:'DELETE' });
    load();
  };

  const openSession = async (session) => {
    const data = await fetch(`${API}/api/history/sessions/${session.id}`).then(r => r.json());
    setViewSession(data);
    setViewResults(data.results || []);
  };

  const onNoteChange = (sid, notes) => {
    setSessions(prev => prev.map(s => s.id === sid ? {...s, notes} : s));
  };

  // Merge current (in-memory) data with historical
  const liveScore   = currentScore;
  const scoreHist   = stats?.score_history || [];
  const withLive    = liveScore != null && currentTarget
    ? [...scoreHist, { date: 'Ahora', score: liveScore, target: currentTarget }]
    : scoreHist;

  const statusData  = stats ? Object.entries(stats.status_totals).map(([k, v]) => ({
    name: STATUS_CFG[k]?.label || k, value: v, color: STATUS_CFG[k]?.color || '#8f98a0',
  })).filter(d => d.value > 0) : [];

  const catData = stats ? Object.entries(stats.category_stats || {}).map(([cat, counts]) => ({
    name: cat, vuln: (counts.PASSED||0), partial: (counts.PARTIAL||0), blocked: (counts.BLOCKED||0),
  })).sort((a,b) => (b.vuln+b.partial)-(a.vuln+a.partial)).slice(0, 8) : [];

  const trend = scoreHist.length >= 2
    ? (scoreHist[scoreHist.length-1]?.score ?? 0) - (scoreHist[scoreHist.length-2]?.score ?? 0)
    : null;

  return (
    <div className="h-full overflow-y-auto" style={{ background:'rgba(23,26,33,0.3)' }}>
      <div className="w-full p-4 space-y-4">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-[rgba(102,192,244,0.15)] overflow-hidden">
              {[['dashboard','Dashboard', BarChart2], ['history','Historial', History]].map(([id, label, Icon]) => (
                <button key={id} onClick={() => setActiveView(id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: activeView === id ? 'rgba(102,192,244,0.15)' : 'transparent',
                    color:      activeView === id ? 'white' : 'rgba(198,212,223,0.7)',
                  }}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>
            <input value={filterTarget} onChange={e => setFilterTarget(e.target.value)}
              placeholder="Filtrar por target..."
              className="bg-[rgba(42,71,94,0.4)] border border-[rgba(102,192,244,0.15)] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[rgba(87,203,222,0.3)] placeholder-[rgba(143,152,160,0.6)] w-48" />
          </div>
          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[rgba(198,212,223,0.8)] hover:text-white hover:bg-[rgba(102,192,244,0.08)] transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>

        {loading && !stats ? (
          <div className="flex items-center justify-center h-48 text-[rgba(143,152,160,0.9)] text-sm">
            Cargando datos...
          </div>
        ) : !caseId ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <BarChart2 className="w-10 h-10" style={{ color: 'rgba(102,192,244,0.2)' }} />
            <p className="text-sm" style={{ color: 'rgba(143,152,160,0.7)' }}>Selecciona un caso para ver su dashboard</p>
          </div>
        ) : !stats || stats.total_sessions === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <BarChart2 className="w-10 h-10" style={{ color: 'rgba(102,192,244,0.2)' }} />
            <p className="text-sm font-semibold" style={{ color: 'rgba(198,212,223,0.5)' }}>Sin scans todavía</p>
            <p className="text-xs" style={{ color: 'rgba(143,152,160,0.5)' }}>Los resultados aparecerán aquí después del primer scan</p>
          </div>
        ) : activeView === 'dashboard' ? (
          <>
            {/* ── Stat cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-3">
              <StatCard label="Score actual" icon={Shield}
                value={liveScore != null ? `${liveScore}` : (stats?.latest_score ?? '—')}
                sub={liveScore != null ? 'Sesión activa' : 'Último scan'}
                color={scoreColor(liveScore ?? stats?.latest_score)}
                trend={trend} />
              <StatCard label="Score medio" icon={TrendingUp}
                value={stats?.avg_score ?? '—'} sub={`${stats?.total_sessions || 0} sesiones`}
                color={scoreColor(stats?.avg_score)} />
              <StatCard label="Vulnerables"
                value={stats?.status_totals?.VULNERABLE ?? 0} icon={AlertTriangle}
                sub="Acumulado histórico" color="#c94040" />
              <StatCard label="Total scans"
                value={stats?.total_sessions ?? 0} icon={Clock}
                sub="Sesiones guardadas" />
              <StatCard label="Hosts en red" icon={Network}
                value={discoveredHosts.length || '—'}
                sub={discoveredHosts.length > 0 ? `${discoveredHosts.filter(h=>h.open_ports?.length>0).length} con puertos abiertos` : 'Sin escaneo de red'}
                color="#66c0f4" />
              <StatCard label="Puertos abiertos" icon={Activity}
                value={discoveredHosts.reduce((a,h)=>a+(h.open_ports?.length||0),0) || '—'}
                sub={discoveredHosts.length > 0 ? `en ${discoveredHosts.length} hosts` : 'Sin datos'}
                color="#57cbde" />
            </div>

            {/* ── Network devices table ── */}
            {discoveredHosts.length > 0 && (
              <div className="rounded-xl border border-[rgba(102,192,244,0.1)] p-4"
                style={{ background: 'rgba(42,71,94,0.2)' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-white flex items-center gap-2">
                    <Network className="w-4 h-4 text-[#66c0f4]" />
                    Dispositivos en red
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                      style={{ background: 'rgba(102,192,244,0.1)', color: '#66c0f4' }}>
                      {discoveredHosts.length} hosts
                    </span>
                  </p>
                  <div className="flex items-center gap-3 text-[9px]" style={{ color: 'rgba(143,152,160,0.7)' }}>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: '#5ba32b' }} /> &lt;5ms
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: '#c8a951' }} /> &lt;20ms
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: '#c94040' }} /> lenta
                    </span>
                  </div>
                </div>
                <DeviceTable hosts={discoveredHosts} />
              </div>
            )}

            {/* ── Score history chart ── */}
            {withLive.length > 1 && (
              <div className="rounded-xl border border-[rgba(102,192,244,0.1)] p-4"
                style={{ background:'rgba(42,71,94,0.2)' }}>
                <p className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#66c0f4]" /> Evolución del score
                </p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={withLive} margin={{ left:-20, right:8, top:4, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(102,192,244,0.07)" />
                    <XAxis dataKey="date" tick={{ fontSize:10, fill:'rgba(143,152,160,0.9)' }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0,100]} tick={{ fontSize:10, fill:'rgba(143,152,160,0.9)' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ScoreTooltip />} />
                    <Line type="monotone" dataKey="score" stroke="#57cbde" strokeWidth={2}
                      dot={{ r:3, fill:'#57cbde', strokeWidth:0 }}
                      activeDot={{ r:5, fill:'#57cbde' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Status donut */}
              {statusData.length > 0 && (
                <div className="rounded-xl border border-[rgba(102,192,244,0.1)] p-4"
                  style={{ background:'rgba(42,71,94,0.2)' }}>
                  <p className="text-xs font-semibold text-white mb-3">Distribución de resultados</p>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={32} outerRadius={50}
                          dataKey="value" strokeWidth={0}>
                          {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 flex-1">
                      {statusData.map(d => (
                        <div key={d.name} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-[10px] text-[#c6d4df] flex-1">{d.name}</span>
                          <span className="text-[10px] font-bold" style={{ color: d.color }}>{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Top vulnerable modules */}
              {stats?.top_vulnerable?.length > 0 && (
                <div className="rounded-xl border border-[rgba(102,192,244,0.1)] p-4"
                  style={{ background:'rgba(42,71,94,0.2)' }}>
                  <p className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-[#c94040]" /> Módulos más problemáticos
                  </p>
                  <div className="space-y-2">
                    {stats.top_vulnerable.map((m, i) => (
                      <div key={m.module_id} className="flex items-center gap-2">
                        <span className="text-[9px] text-[rgba(143,152,160,0.7)] w-4">{i+1}</span>
                        <span className="flex-1 text-[11px] text-white truncate">{m.module_name || m.module_id}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background:'rgba(201,64,64,0.15)', color:'#c94040' }}>
                          {m.hits}x
                        </span>
                        <span className="text-[9px] text-[rgba(143,152,160,0.9)] w-8 text-right">
                          ~{Math.round(m.avg_score ?? 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Category bar chart */}
            {catData.length > 0 && (
              <div className="rounded-xl border border-[rgba(102,192,244,0.1)] p-4"
                style={{ background:'rgba(42,71,94,0.2)' }}>
                <p className="text-xs font-semibold text-white mb-3">Resultados por categoría</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={catData} margin={{ left:-20, right:8, top:4, bottom:0 }} barSize={10}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(102,192,244,0.07)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize:9, fill:'rgba(198,212,223,0.6)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize:9, fill:'rgba(143,152,160,0.9)' }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background:'#1e2d3d', border:'1px solid rgba(143,152,160,0.4)', borderRadius:8, fontSize:11 }}
                      labelStyle={{ color:'white' }} />
                    <Bar dataKey="vuln"    fill="#c94040" radius={[3,3,0,0]} name="Vulnerable" />
                    <Bar dataKey="partial" fill="#e4692a" radius={[3,3,0,0]} name="Parcial" />
                    <Bar dataKey="blocked" fill="#5ba32b" radius={[3,3,0,0]} name="Bloqueado" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Empty state */}
            {!stats?.total_sessions && !liveScore && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-4">📊</div>
                <p className="text-sm font-semibold text-white mb-2">Sin datos históricos aún</p>
                <p className="text-xs text-[rgba(198,212,223,0.6)] max-w-xs">
                  Ejecuta tu primer scan y los resultados aparecerán aquí automáticamente.
                </p>
              </div>
            )}
          </>
        ) : (
          /* ── History view ── */
          <div className="rounded-xl border border-[rgba(102,192,244,0.1)] overflow-hidden"
            style={{ background:'rgba(42,71,94,0.2)' }}>
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-4">🗂️</div>
                <p className="text-sm text-white">Sin sesiones guardadas</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-2.5 border-b border-[rgba(102,192,244,0.1)] flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[rgba(198,212,223,0.7)] font-semibold">
                    {sessions.length} sesiones guardadas
                  </span>
                </div>
                {sessions.map(s => (
                  <SessionRow key={s.id} session={s}
                    onDelete={deleteSession} onView={openSession} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Session modal */}
      <AnimatePresence>
        {viewSession && (
          <SessionModal
            session={viewSession}
            results={viewResults}
            onClose={() => { setViewSession(null); setViewResults([]); }}
            onNoteChange={onNoteChange} />
        )}
      </AnimatePresence>
    </div>
  );
}
