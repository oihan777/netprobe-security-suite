import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus, Trash2, Play, Pause, ChevronDown,
         CheckCircle, AlertTriangle, Calendar, Loader2, History } from 'lucide-react';
import { MODULES } from '../../data/modules.js';

const CRON_LABELS = {
  hourly:   'Cada hora',
  daily:    'Diario',
  weekly:   'Semanal',
  interval: 'Cada X minutos',
  manual:   'Solo manual',
};

function statusColor(s) {
  if (s === 'OK') return '#30d158';
  if (s?.startsWith('ERROR')) return '#ff453a';
  return '#636366';
}

function NextRunBadge({ nextRun }) {
  if (!nextRun) return <span className="text-[rgba(255,255,255,0.25)]">—</span>;
  const dt   = new Date(nextRun);
  const now  = new Date();
  const diff = dt - now;
  let label;
  if (diff < 0)          label = 'Pendiente';
  else if (diff < 3600000)  label = `${Math.round(diff/60000)}m`;
  else if (diff < 86400000) label = `${Math.round(diff/3600000)}h`;
  else                   label = dt.toLocaleDateString('es-ES', { weekday:'short', hour:'2-digit', minute:'2-digit' });
  return <span className="text-[10px] font-mono text-[rgba(100,210,255,0.8)]">{label}</span>;
}

function HistoryList({ sid }) {
  const [hist, setHist] = useState([]);
  useEffect(() => {
    fetch(`http://localhost:8000/api/scheduler/schedules/${sid}/history`)
      .then(r => r.json()).then(d => setHist(d.history || [])).catch(() => {});
  }, [sid]);
  if (!hist.length) return <p className="text-[10px] text-[rgba(255,255,255,0.25)] px-3 py-2">Sin historial todavía</p>;
  return (
    <div className="divide-y divide-[rgba(255,255,255,0.05)]">
      {hist.map(h => (
        <div key={h.id} className="flex items-center gap-3 px-3 py-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor(h.status) }} />
          <span className="text-[9px] font-mono text-[rgba(255,255,255,0.4)]">
            {new Date(h.run_at).toLocaleString('es-ES')}
          </span>
          <span className="text-[9px] font-bold ml-auto" style={{ color: h.score != null ? (h.score >= 70 ? '#30d158' : h.score >= 40 ? '#ff9f0a' : '#ff453a') : '#636366' }}>
            {h.score != null ? `${h.score}/100` : '—'}
          </span>
          <span className="text-[9px] text-[rgba(255,255,255,0.3)]">{h.modules_run} módulos · {h.duration_s}s</span>
        </div>
      ))}
    </div>
  );
}

function ScheduleCard({ schedule, onToggle, onDelete, onRefresh }) {
  const [open,    setOpen]    = useState(false);
  const [showHist,setShowHist]= useState(false);
  const isOn = !!schedule.enabled;

  return (
    <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: isOn ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.02)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => onToggle(schedule.id)}
          className="w-8 h-5 rounded-full transition-all flex-shrink-0 relative"
          style={{ background: isOn ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.1)' }}>
          <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
            style={{ left: isOn ? '14px' : '2px', background: isOn ? '#00ff88' : '#636366' }} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">{schedule.name}</span>
            {schedule.alert_below && (
              <span className="text-[8px] px-1.5 py-0.5 rounded border text-[#ff9f0a] border-[rgba(255,159,10,0.3)] bg-[rgba(255,159,10,0.08)]">
                ⚠ alerta &lt;{schedule.alert_below}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] font-mono text-[rgba(255,255,255,0.4)]">{schedule.target}</span>
            <span className="text-[rgba(255,255,255,0.2)]">·</span>
            <span className="text-[9px] text-[rgba(255,255,255,0.35)]">{CRON_LABELS[schedule.cron_type] || schedule.cron_type}</span>
            {schedule.cron_value && schedule.cron_type !== 'hourly' && schedule.cron_type !== 'manual' && (
              <span className="text-[9px] font-mono text-[rgba(100,210,255,0.5)]">{schedule.cron_value}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <div className="text-[8px] text-[rgba(255,255,255,0.25)]">Próximo</div>
            <NextRunBadge nextRun={schedule.next_run} />
          </div>
          <div className="text-right">
            <div className="text-[8px] text-[rgba(255,255,255,0.25)]">Ejecuciones</div>
            <span className="text-[10px] font-bold text-white">{schedule.run_count || 0}</span>
          </div>
          {schedule.last_score != null && (
            <div className="text-right">
              <div className="text-[8px] text-[rgba(255,255,255,0.25)]">Último score</div>
              <span className="text-[10px] font-bold" style={{ color: schedule.last_score >= 70 ? '#30d158' : schedule.last_score >= 40 ? '#ff9f0a' : '#ff453a' }}>
                {schedule.last_score}
              </span>
            </div>
          )}
          <button onClick={() => setOpen(o=>!o)}
            className="p-1 rounded text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open?'rotate-180':''}`} />
          </button>
          <button onClick={() => onDelete(schedule.id)}
            className="p-1 rounded text-[rgba(255,69,58,0.4)] hover:text-[#ff453a] transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height:0 }} animate={{ height:'auto' }} exit={{ height:0 }}
            transition={{ duration:0.2 }} style={{ overflow:'hidden' }}>
            <div className="border-t border-[rgba(255,255,255,0.06)] px-4 py-3 space-y-3">
              {/* Modules */}
              <div>
                <p className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.3)] mb-1.5">Módulos ({schedule.modules?.length || 0})</p>
                <div className="flex flex-wrap gap-1">
                  {(schedule.modules || []).map(mid => {
                    const m = MODULES.find(x => x.id === mid);
                    return (
                      <span key={mid} className="text-[8px] px-1.5 py-0.5 rounded font-mono"
                        style={{ background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)', border:'1px solid rgba(255,255,255,0.1)' }}>
                        {m?.name || mid}
                      </span>
                    );
                  })}
                  {!schedule.modules?.length && <span className="text-[9px] text-[rgba(255,255,255,0.25)]">Sin módulos configurados</span>}
                </div>
              </div>

              {/* History toggle */}
              <button onClick={() => setShowHist(h=>!h)}
                className="flex items-center gap-1.5 text-[9px] text-[rgba(255,255,255,0.4)] hover:text-white transition-colors">
                <History className="w-3 h-3" />
                {showHist ? 'Ocultar historial' : 'Ver historial de ejecuciones'}
              </button>

              {showHist && (
                <div className="rounded-lg border border-[rgba(255,255,255,0.07)] overflow-hidden">
                  <HistoryList sid={schedule.id} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function NewScheduleForm({ selectedModules, onCreated, onCancel }) {
  const [form, setForm] = useState({
    name: '', target: '', cron_type: 'daily', cron_value: '03:00',
    intensity: 3, duration: 30, alert_below: '', modules: selectedModules || [],
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleMod = (id) => {
    set('modules', form.modules.includes(id) ? form.modules.filter(x=>x!==id) : [...form.modules, id]);
  };

  const save = async () => {
    if (!form.name.trim() || !form.target.trim()) { setError('Nombre y target son obligatorios'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('http://localhost:8000/api/scheduler/schedules', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, alert_below: form.alert_below ? parseInt(form.alert_below) : null }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onCreated(data);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const placeholders = { daily:'03:00', weekly:'MON 03:00', interval:'60', hourly:'', manual:'' };

  return (
    <div className="rounded-xl border border-[rgba(0,255,136,0.2)] bg-[rgba(0,255,136,0.03)] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Nuevo schedule</h3>
        <button onClick={onCancel} className="text-[10px] text-[rgba(255,255,255,0.35)] hover:text-white">Cancelar</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Name */}
        <div>
          <label className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.35)] mb-1 block">Nombre</label>
          <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Auditoría semanal"
            className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[rgba(0,255,136,0.4)]" />
        </div>
        {/* Target */}
        <div>
          <label className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.35)] mb-1 block">Target</label>
          <input value={form.target} onChange={e=>set('target',e.target.value)} placeholder="192.168.1.1"
            className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-[rgba(0,255,136,0.4)]" />
        </div>
        {/* Cron type */}
        <div>
          <label className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.35)] mb-1 block">Frecuencia</label>
          <select value={form.cron_type} onChange={e=>{set('cron_type',e.target.value); set('cron_value', placeholders[e.target.value]||'');}}
            className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[rgba(0,255,136,0.4)]">
            {Object.entries(CRON_LABELS).map(([k,v]) => <option key={k} value={k} style={{background:'#1c1c1e'}}>{v}</option>)}
          </select>
        </div>
        {/* Cron value */}
        {form.cron_type !== 'hourly' && form.cron_type !== 'manual' && (
          <div>
            <label className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.35)] mb-1 block">
              {form.cron_type === 'daily' ? 'Hora (HH:MM)' : form.cron_type === 'weekly' ? 'Día + hora (MON 03:00)' : 'Minutos de intervalo'}
            </label>
            <input value={form.cron_value} onChange={e=>set('cron_value',e.target.value)}
              placeholder={placeholders[form.cron_type]}
              className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-[rgba(0,255,136,0.4)]" />
          </div>
        )}
        {/* Alert below */}
        <div>
          <label className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.35)] mb-1 block">Alerta si score &lt; (opcional)</label>
          <input value={form.alert_below} onChange={e=>set('alert_below',e.target.value)} placeholder="70" type="number" min="0" max="100"
            className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[rgba(0,255,136,0.4)]" />
        </div>
        {/* Intensity */}
        <div>
          <label className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.35)] mb-1 block">Intensidad ({form.intensity})</label>
          <input type="range" min="1" max="5" value={form.intensity} onChange={e=>set('intensity',parseInt(e.target.value))}
            className="w-full accent-[#00ff88]" />
        </div>
      </div>

      {/* Module selector */}
      <div>
        <label className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.35)] mb-2 block">
          Módulos ({form.modules.length} seleccionados)
        </label>
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
          {MODULES.map(m => {
            const sel = form.modules.includes(m.id);
            return (
              <button key={m.id} onClick={() => toggleMod(m.id)}
                className="text-[8px] px-1.5 py-0.5 rounded font-mono transition-all"
                style={{ background: sel ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.05)',
                         color:      sel ? '#00ff88' : 'rgba(255,255,255,0.4)',
                         border:     `1px solid ${sel ? 'rgba(0,255,136,0.35)' : 'rgba(255,255,255,0.08)'}` }}>
                {m.name}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-[10px] text-[#ff453a]">{error}</p>}

      <button onClick={save} disabled={saving}
        className="w-full py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
        style={{ background:'rgba(0,255,136,0.12)', border:'1.5px solid rgba(0,255,136,0.35)', color:'#00ff88' }}>
        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5"/>Guardando...</> : 'Crear Schedule'}
      </button>
    </div>
  );
}

export function SchedulerPanel({ selectedModules }) {
  const [schedules, setSchedules] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);

  const load = async () => {
    try {
      const res  = await fetch('http://localhost:8000/api/scheduler/schedules');
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (sid) => {
    await fetch(`http://localhost:8000/api/scheduler/schedules/${sid}/toggle`, { method:'POST' });
    load();
  };

  const del = async (sid) => {
    if (!confirm('¿Eliminar este schedule?')) return;
    await fetch(`http://localhost:8000/api/scheduler/schedules/${sid}`, { method:'DELETE' });
    load();
  };

  const onCreated = (s) => { setShowForm(false); load(); };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[rgba(255,255,255,0.07)] flex-shrink-0"
        style={{ background:'rgba(10,10,14,0.95)' }}>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[rgba(0,255,136,0.6)]" />
          <span className="text-xs font-semibold text-white">Scheduler</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded border text-[rgba(255,255,255,0.4)] border-[rgba(255,255,255,0.1)]">
            {schedules.filter(s=>s.enabled).length} activos
          </span>
        </div>
        <button onClick={() => setShowForm(f=>!f)}
          className="flex items-center gap-1.5 ml-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background:'rgba(0,255,136,0.1)', border:'1px solid rgba(0,255,136,0.3)', color:'#00ff88' }}>
          <Plus className="w-3.5 h-3.5" /> Nuevo schedule
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* New form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}>
              <NewScheduleForm selectedModules={selectedModules} onCreated={onCreated} onCancel={() => setShowForm(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Schedules */}
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-[rgba(0,255,136,0.5)]" />
            <span className="text-xs text-[rgba(255,255,255,0.4)]">Cargando schedules...</span>
          </div>
        ) : schedules.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[rgba(0,255,136,0.06)] border border-[rgba(0,255,136,0.12)] flex items-center justify-center text-3xl mb-4">⏰</div>
            <h3 className="text-sm font-semibold text-white mb-2">Sin schedules configurados</h3>
            <p className="text-xs text-[rgba(255,255,255,0.35)] max-w-xs leading-relaxed mb-5">
              Programa scans automáticos contra tus targets. Se ejecutan en background y guardan historial de resultados.
            </p>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
              style={{ background:'rgba(0,255,136,0.1)', border:'1.5px solid rgba(0,255,136,0.35)', color:'#00ff88' }}>
              <Plus className="w-4 h-4" /> Crear primer schedule
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map(s => (
              <ScheduleCard key={s.id} schedule={s} onToggle={toggle} onDelete={del} onRefresh={load} />
            ))}
          </div>
        )}

        {/* Info */}
        {schedules.length > 0 && (
          <p className="text-[9px] text-[rgba(255,255,255,0.2)] text-center pt-2">
            Los scans se ejecutan automáticamente mientras el backend está activo · Historial persistente en SQLite
          </p>
        )}
      </div>
    </div>
  );
}
