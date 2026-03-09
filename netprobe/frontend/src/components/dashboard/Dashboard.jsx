import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, Shield, AlertTriangle,
  Clock, Target, Trash2, ChevronRight, RefreshCw, BarChart2,
  History, Zap, Check, Eye
} from 'lucide-react';

const API = 'http://localhost:8000';

const STATUS_CFG = {
  BLOCKED:   { color: '#30d158', label: 'Bloqueado'  },
  DETECTED:  { color: '#ff9f0a', label: 'Detectado'  },
  PARTIAL:   { color: '#ff6b35', label: 'Parcial'    },
  VULNERABLE:{ color: '#ff453a', label: 'Vulnerable' },
  ERROR:     { color: '#636366', label: 'Error'      },
};

const CAT_COLORS = {
  recon:'#0a84ff', fingerprint:'#30d158', flood:'#ff453a',
  brute_force:'#ff9f0a', protocol:'#bf5af2', web:'#ff375f',
  dns:'#ffd60a', evasion:'#64d2ff', firewall:'#ffd60a',
};

function scoreColor(s) {
  if (s == null) return '#636366';
  if (s >= 80)  return '#30d158';
  if (s >= 60)  return '#ff9f0a';
  if (s >= 35)  return '#ff6b35';
  return '#ff453a';
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
      className="rounded-xl border border-[rgba(255,255,255,0.08)] p-4 flex flex-col gap-2"
      style={{ background:'rgba(255,255,255,0.03)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.35)] font-semibold">{label}</span>
        {Icon && <Icon className="w-4 h-4 opacity-30" />}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold" style={{ color }}>{value}</span>
        {trend !== undefined && (
          <span className="text-xs mb-0.5 flex items-center gap-0.5"
            style={{ color: trend > 0 ? '#30d158' : trend < 0 ? '#ff453a' : '#636366' }}>
            {trend > 0 ? <TrendingUp className="w-3 h-3"/> : trend < 0 ? <TrendingDown className="w-3 h-3"/> : <Minus className="w-3 h-3"/>}
            {Math.abs(trend)}
          </span>
        )}
      </div>
      {sub && <span className="text-[10px] text-[rgba(255,255,255,0.3)]">{sub}</span>}
    </motion.div>
  );
}

// ── Score chart tooltip ───────────────────────────────────────────
function ScoreTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.12)] px-3 py-2 text-xs"
      style={{ background:'#1a1a24' }}>
      <p className="font-bold" style={{ color: scoreColor(d.score) }}>{d.score}/100</p>
      <p className="text-[rgba(255,255,255,0.5)]">{d.target}</p>
      <p className="text-[rgba(255,255,255,0.35)]">{fmtDate(d.date)}</p>
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
      className="flex items-center gap-3 px-4 py-2.5 border-b border-[rgba(255,255,255,0.05)] last:border-0 hover:bg-[rgba(255,255,255,0.02)] transition-colors group">
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
          <span className="text-[9px] text-[rgba(255,255,255,0.3)]">{fmtDateTime(session.started_at)}</span>
          <span className="text-[9px] text-[rgba(255,255,255,0.2)]">{session.total_modules} módulos</span>
          {session.profile && (
            <span className="text-[9px] text-[rgba(100,210,255,0.6)]">{session.profile}</span>
          )}
        </div>
      </div>

      {/* Status mini bars */}
      <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
        {[
          ['#ff453a', session.vulnerable],
          ['#ff6b35', session.partial],
          ['#ff9f0a', session.detected],
          ['#30d158', session.blocked],
        ].filter(([,v]) => v > 0).map(([color, val], i) => (
          <span key={i} className="text-[9px] font-bold px-1 rounded"
            style={{ color, background:`${color}18` }}>{val}</span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => onView(session)}
          className="p-1.5 rounded-lg text-[rgba(255,255,255,0.4)] hover:text-[#0a84ff] hover:bg-[rgba(10,132,255,0.1)] transition-all">
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(session.id)}
          className="p-1.5 rounded-lg text-[rgba(255,255,255,0.4)] hover:text-[#ff453a] hover:bg-[rgba(255,69,58,0.1)] transition-all">
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
      style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale:0.95, y:20 }} animate={{ scale:1, y:0 }} exit={{ scale:0.95 }}
        className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl border border-[rgba(255,255,255,0.1)] overflow-hidden"
        style={{ background:'#111118' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(255,255,255,0.08)]">
          <div className="text-xl font-bold" style={{ color: scoreColor(session.score) }}>
            {session.score ?? '?'}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">{session.target}</div>
            <div className="text-[10px] text-[rgba(255,255,255,0.35)]">{fmtDateTime(session.started_at)}</div>
          </div>
          <button onClick={onClose} className="text-[rgba(255,255,255,0.4)] hover:text-white transition-colors text-xl">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Module results */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.3)] font-semibold mb-2">Módulos</p>
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
            <p className="text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.3)] font-semibold mb-2">Notas de sesión</p>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Añade contexto, observaciones, próximos pasos..."
              className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[rgba(0,255,136,0.4)] resize-none placeholder-[rgba(255,255,255,0.2)]" />
            <button onClick={saveNote}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background:'rgba(0,255,136,0.1)', border:'1px solid rgba(0,255,136,0.3)', color:'#00ff88' }}>
              {saved ? <><Check className="w-3 h-3"/> Guardado</> : 'Guardar nota'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const NOTE_STATUSES = [
  { id:'',           label:'Sin estado',     color:'rgba(255,255,255,0.3)' },
  { id:'accepted',   label:'Aceptado',       color:'#30d158' },
  { id:'false_pos',  label:'Falso positivo', color:'#0a84ff' },
  { id:'in_progress',label:'En progreso',    color:'#ff9f0a' },
  { id:'fixed',      label:'Corregido',      color:'#64d2ff' },
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
    <div className="rounded-lg border border-[rgba(255,255,255,0.06)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[rgba(255,255,255,0.03)]"
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
            <div className="px-3 pb-3 pt-1 space-y-2 bg-[rgba(255,255,255,0.02)]">
              {/* Status picker */}
              <div className="flex flex-wrap gap-1">
                {NOTE_STATUSES.map(ns => (
                  <button key={ns.id} onClick={() => setStatus(ns.id)}
                    className="text-[9px] px-2 py-1 rounded-full font-semibold transition-all"
                    style={{
                      background: status === ns.id ? `${ns.color}25` : 'rgba(255,255,255,0.05)',
                      color:      status === ns.id ? ns.color : 'rgba(255,255,255,0.4)',
                      border:     `1px solid ${status === ns.id ? ns.color+'50' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    {ns.label}
                  </button>
                ))}
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Añade una nota a este resultado..."
                className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded px-2 py-1.5 text-[11px] text-white outline-none resize-none placeholder-[rgba(255,255,255,0.2)] focus:border-[rgba(0,255,136,0.3)]" />
              <button onClick={save}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-all"
                style={{ background:'rgba(0,255,136,0.1)', border:'1px solid rgba(0,255,136,0.3)', color:'#00ff88' }}>
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
export function Dashboard({ currentResults = [], currentScore = null, currentTarget = '' }) {
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
      const q   = filterTarget ? `?target=${encodeURIComponent(filterTarget)}` : '';
      const [s, h] = await Promise.all([
        fetch(`${API}/api/history/dashboard${q}`).then(r => r.json()),
        fetch(`${API}/api/history/sessions${q}&limit=50`).then(r => r.json()),
      ]);
      setStats(s);
      setSessions(h.sessions || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterTarget]);

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
    name: STATUS_CFG[k]?.label || k, value: v, color: STATUS_CFG[k]?.color || '#636366',
  })).filter(d => d.value > 0) : [];

  const catData = stats ? Object.entries(stats.category_stats || {}).map(([cat, counts]) => ({
    name: cat, vuln: (counts.PASSED||0), partial: (counts.PARTIAL||0), blocked: (counts.BLOCKED||0),
  })).sort((a,b) => (b.vuln+b.partial)-(a.vuln+a.partial)).slice(0, 8) : [];

  const trend = scoreHist.length >= 2
    ? (scoreHist[scoreHist.length-1]?.score ?? 0) - (scoreHist[scoreHist.length-2]?.score ?? 0)
    : null;

  return (
    <div className="h-full overflow-y-auto" style={{ background:'rgba(0,0,0,0.3)' }}>
      <div className="w-full p-4 space-y-4">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-[rgba(255,255,255,0.1)] overflow-hidden">
              {[['dashboard','Dashboard', BarChart2], ['history','Historial', History]].map(([id, label, Icon]) => (
                <button key={id} onClick={() => setActiveView(id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: activeView === id ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color:      activeView === id ? 'white' : 'rgba(255,255,255,0.4)',
                  }}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>
            <input value={filterTarget} onChange={e => setFilterTarget(e.target.value)}
              placeholder="Filtrar por target..."
              className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[rgba(0,255,136,0.3)] placeholder-[rgba(255,255,255,0.2)] w-48" />
          </div>
          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[rgba(255,255,255,0.5)] hover:text-white hover:bg-[rgba(255,255,255,0.06)] transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>

        {loading && !stats ? (
          <div className="flex items-center justify-center h-48 text-[rgba(255,255,255,0.3)] text-sm">
            Cargando datos...
          </div>
        ) : activeView === 'dashboard' ? (
          <>
            {/* ── Stat cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                sub="Acumulado histórico" color="#ff453a" />
              <StatCard label="Total scans"
                value={stats?.total_sessions ?? 0} icon={Clock}
                sub="Sesiones guardadas" />
            </div>

            {/* ── Score history chart ── */}
            {withLive.length > 1 && (
              <div className="rounded-xl border border-[rgba(255,255,255,0.08)] p-4"
                style={{ background:'rgba(255,255,255,0.02)' }}>
                <p className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#00ff88]" /> Evolución del score
                </p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={withLive} margin={{ left:-20, right:8, top:4, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize:10, fill:'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0,100]} tick={{ fontSize:10, fill:'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ScoreTooltip />} />
                    <Line type="monotone" dataKey="score" stroke="#00ff88" strokeWidth={2}
                      dot={{ r:3, fill:'#00ff88', strokeWidth:0 }}
                      activeDot={{ r:5, fill:'#00ff88' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Status donut */}
              {statusData.length > 0 && (
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] p-4"
                  style={{ background:'rgba(255,255,255,0.02)' }}>
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
                          <span className="text-[10px] text-[rgba(255,255,255,0.6)] flex-1">{d.name}</span>
                          <span className="text-[10px] font-bold" style={{ color: d.color }}>{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Top vulnerable modules */}
              {stats?.top_vulnerable?.length > 0 && (
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] p-4"
                  style={{ background:'rgba(255,255,255,0.02)' }}>
                  <p className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-[#ff453a]" /> Módulos más problemáticos
                  </p>
                  <div className="space-y-2">
                    {stats.top_vulnerable.map((m, i) => (
                      <div key={m.module_id} className="flex items-center gap-2">
                        <span className="text-[9px] text-[rgba(255,255,255,0.25)] w-4">{i+1}</span>
                        <span className="flex-1 text-[11px] text-white truncate">{m.module_name || m.module_id}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background:'rgba(255,69,58,0.15)', color:'#ff453a' }}>
                          {m.hits}x
                        </span>
                        <span className="text-[9px] text-[rgba(255,255,255,0.3)] w-8 text-right">
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
              <div className="rounded-xl border border-[rgba(255,255,255,0.08)] p-4"
                style={{ background:'rgba(255,255,255,0.02)' }}>
                <p className="text-xs font-semibold text-white mb-3">Resultados por categoría</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={catData} margin={{ left:-20, right:8, top:4, bottom:0 }} barSize={10}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize:9, fill:'rgba(255,255,255,0.35)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize:9, fill:'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background:'#1a1a24', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, fontSize:11 }}
                      labelStyle={{ color:'white' }} />
                    <Bar dataKey="vuln"    fill="#ff453a" radius={[3,3,0,0]} name="Vulnerable" />
                    <Bar dataKey="partial" fill="#ff9f0a" radius={[3,3,0,0]} name="Parcial" />
                    <Bar dataKey="blocked" fill="#30d158" radius={[3,3,0,0]} name="Bloqueado" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Empty state */}
            {!stats?.total_sessions && !liveScore && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-4">📊</div>
                <p className="text-sm font-semibold text-white mb-2">Sin datos históricos aún</p>
                <p className="text-xs text-[rgba(255,255,255,0.35)] max-w-xs">
                  Ejecuta tu primer scan y los resultados aparecerán aquí automáticamente.
                </p>
              </div>
            )}
          </>
        ) : (
          /* ── History view ── */
          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] overflow-hidden"
            style={{ background:'rgba(255,255,255,0.02)' }}>
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-4">🗂️</div>
                <p className="text-sm text-white">Sin sesiones guardadas</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-2.5 border-b border-[rgba(255,255,255,0.07)] flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.4)] font-semibold">
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
