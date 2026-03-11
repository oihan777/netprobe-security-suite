import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, Plus, Trash2, ChevronRight, Shield,
  Clock, Target, BarChart2, Loader2, Edit2, Check, X,
  AlertTriangle, Search, Zap
} from 'lucide-react';

const API = 'http://localhost:8000';

// ── Paleta de colores para casos ──────────────────────────────────
const CASE_COLORS = [
  '#66c0f4', '#5ba32b', '#e4692a', '#c94040',
  '#9b59b6', '#57cbde', '#c8a951', '#ff6b9d',
];

const CASE_ICONS = [
  { id: 'folder',  emoji: '📁' },
  { id: 'shield',  emoji: '🛡️' },
  { id: 'target',  emoji: '🎯' },
  { id: 'bug',     emoji: '🐛' },
  { id: 'lock',    emoji: '🔒' },
  { id: 'globe',   emoji: '🌐' },
  { id: 'server',  emoji: '🖥️' },
  { id: 'fire',    emoji: '🔥' },
];

function getEmoji(icon) {
  return CASE_ICONS.find(i => i.id === icon)?.emoji || '📁';
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getScoreColor(score) {
  if (score === null || score === undefined) return 'rgba(143,152,160,0.7)';
  if (score >= 80) return '#5ba32b';
  if (score >= 60) return '#c8a951';
  if (score >= 40) return '#e4692a';
  return '#c94040';
}

// ── Modal crear/editar caso ───────────────────────────────────────

function CaseModal({ initial, onSave, onClose }) {
  const [name,    setName]    = useState(initial?.name        || '');
  const [desc,    setDesc]    = useState(initial?.description || '');
  const [target,  setTarget]  = useState(initial?.target      || '');
  const [color,   setColor]   = useState(initial?.color       || '#66c0f4');
  const [icon,    setIcon]    = useState(initial?.icon        || 'folder');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const isEdit = !!initial;

  const handleSave = async () => {
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const url    = isEdit ? `${API}/api/cases/${initial.id}` : `${API}/api/cases`;
      const method = isEdit ? 'PATCH' : 'POST';
      const resp   = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: desc.trim(), target: target.trim(), color, icon }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Error guardando caso');
      onSave(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 flex items-center justify-center z-50"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ background: 'rgba(23,26,33,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="w-[480px] rounded-2xl overflow-hidden"
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        style={{ background: '#1e2d3d', border: '1px solid rgba(102,192,244,0.15)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(102,192,244,0.1)' }}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
              <span className="text-sm">{getEmoji(icon)}</span>
            </div>
            <p className="text-sm font-semibold text-white">
              {isEdit ? 'Editar caso' : 'Nuevo caso'}
            </p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(198,212,223,0.7)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(198,212,223,0.7)'}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Nombre */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
              style={{ color: 'rgba(198,212,223,0.7)' }}>Nombre *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: Auditoría cliente XYZ"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: 'rgba(102,192,244,0.07)', border: '1px solid rgba(102,192,244,0.15)', color: '#fff' }}
              onFocus={e => e.target.style.borderColor = `${color}80`}
              onBlur={e  => e.target.style.borderColor = 'rgba(102,192,244,0.15)'}
              autoFocus
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
              style={{ color: 'rgba(198,212,223,0.7)' }}>Descripción</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Contexto, objetivo, alcance..."
              rows={3}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
              style={{ background: 'rgba(102,192,244,0.07)', border: '1px solid rgba(102,192,244,0.15)', color: '#fff' }}
              onFocus={e => e.target.style.borderColor = `${color}80`}
              onBlur={e  => e.target.style.borderColor = 'rgba(102,192,244,0.15)'}
            />
          </div>

          {/* Target */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
              style={{ color: 'rgba(198,212,223,0.7)' }}>Target por defecto</label>
            <input value={target} onChange={e => setTarget(e.target.value)}
              placeholder="192.168.1.1"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none font-mono"
              style={{ background: 'rgba(102,192,244,0.07)', border: '1px solid rgba(102,192,244,0.15)', color: '#fff' }}
              onFocus={e => e.target.style.borderColor = `${color}80`}
              onBlur={e  => e.target.style.borderColor = 'rgba(102,192,244,0.15)'}
            />
          </div>

          {/* Color + Icono */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
                style={{ color: 'rgba(198,212,223,0.7)' }}>Color</label>
              <div className="flex gap-2 flex-wrap">
                {CASE_COLORS.map((c, i) => (
                  <button key={i} onClick={() => setColor(c)}
                    className="w-6 h-6 rounded-lg transition-all"
                    style={{
                      background: c,
                      border: color === c ? `2px solid #fff` : '2px solid transparent',
                      transform: color === c ? 'scale(1.15)' : 'scale(1)',
                    }} />
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
                style={{ color: 'rgba(198,212,223,0.7)' }}>Icono</label>
              <div className="flex gap-2 flex-wrap">
                {CASE_ICONS.map(ic => (
                  <button key={ic.id} onClick={() => setIcon(ic.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all"
                    style={icon === ic.id
                      ? { background: `${color}25`, border: `1px solid ${color}50` }
                      : { background: 'rgba(102,192,244,0.07)', border: '1px solid rgba(102,192,244,0.1)' }}>
                    {ic.emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-center" style={{ color: '#c94040' }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
            style={{ background: 'rgba(102,192,244,0.07)', border: '1px solid rgba(102,192,244,0.15)', color: 'rgba(198,212,223,0.8)' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: color, color: '#000', opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEdit ? 'Guardar' : 'Crear caso'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Tarjeta de caso ───────────────────────────────────────────────

function CaseCard({ caso, onSelect, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const scoreColor = getScoreColor(caso.last_score);

  return (
    <motion.div layout
      className="rounded-2xl overflow-hidden cursor-pointer group transition-all"
      style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid rgba(102,192,244,0.1)` }}
      whileHover={{ borderColor: `${caso.color}40`, background: 'rgba(42,71,94,0.4)' }}
      onClick={() => !confirmDelete && onSelect(caso)}>

      {/* Color stripe */}
      <div className="h-1 w-full" style={{ background: caso.color }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: `${caso.color}15`, border: `1px solid ${caso.color}30` }}>
              {getEmoji(caso.icon)}
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">{caso.name}</p>
              {caso.target && (
                <p className="text-[10px] font-mono mt-0.5" style={{ color: caso.color }}>
                  {caso.target}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => onEdit(caso)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(143,152,160,0.9)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(143,152,160,0.9)'}>
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            {!confirmDelete
              ? <button onClick={() => setConfirmDelete(true)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'rgba(143,152,160,0.9)' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#c94040'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(143,152,160,0.9)'}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              : <div className="flex items-center gap-1">
                  <button onClick={() => onDelete(caso.id)}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold"
                    style={{ background: 'rgba(201,64,64,0.2)', border: '1px solid rgba(201,64,64,0.35)', color: '#c94040' }}>
                    Borrar
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 rounded-lg text-[10px]"
                    style={{ background: 'rgba(102,192,244,0.07)', color: 'rgba(198,212,223,0.7)' }}>
                    No
                  </button>
                </div>
            }
          </div>
        </div>

        {/* Descripción */}
        {caso.description && (
          <p className="text-[11px] mb-4 line-clamp-2 leading-relaxed"
            style={{ color: 'rgba(198,212,223,0.7)' }}>
            {caso.description}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3" style={{ color: 'rgba(143,152,160,0.7)' }} />
            <span className="text-[10px]" style={{ color: 'rgba(198,212,223,0.7)' }}>
              {caso.total_scans} scan{caso.total_scans !== 1 ? 's' : ''}
            </span>
          </div>
          {caso.last_score !== null && caso.last_score !== undefined && (
            <div className="flex items-center gap-1.5">
              <BarChart2 className="w-3 h-3" style={{ color: 'rgba(143,152,160,0.7)' }} />
              <span className="text-[10px] font-bold" style={{ color: scoreColor }}>
                {caso.last_score}/100
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            <Clock className="w-3 h-3" style={{ color: 'rgba(143,152,160,0.6)' }} />
            <span className="text-[9px]" style={{ color: 'rgba(143,152,160,0.7)' }}>
              {formatDate(caso.updated_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Abrir */}
      <div className="flex items-center justify-between px-5 py-3"
        style={{ borderTop: '1px solid rgba(102,192,244,0.07)', background: `${caso.color}06` }}>
        <span className="text-[10px] font-semibold" style={{ color: caso.color }}>
          Abrir caso
        </span>
        <ChevronRight className="w-3.5 h-3.5" style={{ color: caso.color }} />
      </div>
    </motion.div>
  );
}

// ── Panel principal ───────────────────────────────────────────────

export function CaseManager({ onSelectCase }) {
  const [cases,   setCases]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);  // null | 'create' | caso (editar)
  const [search,  setSearch]  = useState('');

  const load = async () => {
    try {
      const resp = await fetch(`${API}/api/cases`);
      const data = await resp.json();
      setCases(data.cases || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = (saved) => {
    setModal(null);
    load();
  };

  const handleDelete = async (cid) => {
    try {
      await fetch(`${API}/api/cases/${cid}`, { method: 'DELETE' });
      setCases(c => c.filter(x => x.id !== cid));
    } catch (e) { console.error(e); }
  };

  const filtered = cases.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.target || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#1b2838', color: '#fff' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-8 pt-10 pb-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(102,192,244,0.15)', border: '1px solid rgba(102,192,244,0.3)' }}>
            <Shield className="w-5 h-5" style={{ color: '#66c0f4' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">NetProbe Security Suite</h1>
            <p className="text-xs" style={{ color: 'rgba(198,212,223,0.6)' }}>
              Selecciona un caso para continuar o crea uno nuevo
            </p>
          </div>
        </div>
      </div>

      {/* ── Barra de acciones ───────────────────────────────────── */}
      <div className="px-8 pb-6 flex items-center gap-4">
        {/* Búsqueda */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: 'rgba(143,152,160,0.9)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar caso..."
            className="w-full rounded-xl pl-9 pr-4 py-2 text-sm outline-none"
            style={{ background: 'rgba(102,192,244,0.07)', border: '1px solid rgba(102,192,244,0.1)', color: '#fff' }}
          />
        </div>

        {/* Nuevo caso */}
        <button onClick={() => setModal('create')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: '#66c0f4', color: '#fff' }}>
          <Plus className="w-4 h-4" />
          Nuevo caso
        </button>
      </div>

      {/* ── Grid de casos ──────────────────────────────────────── */}
      <div className="flex-1 px-8 pb-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'rgba(143,152,160,0.9)' }} />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(42,71,94,0.2)', border: '1px solid rgba(102,192,244,0.1)' }}>
              <FolderOpen className="w-7 h-7" style={{ color: 'rgba(143,152,160,0.4)' }} />
            </div>
            {search
              ? <p className="text-sm" style={{ color: 'rgba(143,152,160,0.7)' }}>No se encontraron casos para "{search}"</p>
              : <>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(143,152,160,0.7)' }}>
                    Sin casos todavía
                  </p>
                  <p className="text-xs mb-4" style={{ color: 'rgba(143,152,160,0.5)' }}>
                    Crea tu primer caso para empezar a auditar
                  </p>
                  <button onClick={() => setModal('create')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: 'rgba(102,192,244,0.15)', border: '1px solid rgba(102,192,244,0.3)', color: '#66c0f4' }}>
                    <Plus className="w-4 h-4" /> Crear primer caso
                  </button>
                </>
            }
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {filtered.map(caso => (
                <motion.div key={caso.id} layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}>
                  <CaseCard
                    caso={caso}
                    onSelect={onSelectCase}
                    onEdit={c => setModal(c)}
                    onDelete={handleDelete}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ── Aviso legal ────────────────────────────────────────── */}
      <div className="px-8 py-4 flex items-center gap-2"
        style={{ borderTop: '1px solid rgba(102,192,244,0.08)' }}>
        <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: '#e4692a' }} />
        <p className="text-[10px]" style={{ color: 'rgba(143,152,160,0.7)' }}>
          Uso exclusivo en redes propias o con autorización expresa por escrito. El uso no autorizado constituye un delito penal.
        </p>
      </div>

      {/* ── Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal && (
          <CaseModal
            initial={modal === 'create' ? null : modal}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default CaseManager;
