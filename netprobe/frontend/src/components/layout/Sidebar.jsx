import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Wifi, Gauge, Clock, Play, Square, AlertCircle, CheckCircle2, Key, Activity, FolderOpen, ChevronLeft } from 'lucide-react';
import { MODULES, CATEGORIES } from '../../data/modules.js';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { ConnectionStatus } from '../ui/ConnectionStatus.jsx';
import { validateIP } from '../../utils/validators.js';
import { NetworkDiscovery } from './NetworkDiscovery.jsx';
import { ProfileSelector } from '../modules/ProfileSelector.jsx';

const INTENSITY_LABELS = { 1:'Sigiloso', 2:'Normal', 3:'Agresivo', 4:'Intenso', 5:'Extremo' };

export function Sidebar({
  target, setTarget, apiKey, setApiKey,
  selectedModules, setSelectedModules,
  intensity, setIntensity, duration, setDuration,
  onStartScan, onNewScan, onStopScan, isRunning, connectionStatus, resultCount = 0,
  activeCase, onChangeCase,
  caseId = null, onHostsChange = null,
}) {
  const [ipError, setIpError]       = useState('');
  const [filterCat, setFilterCat]   = useState('all');
  const [search, setSearch]         = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (target) { const v = validateIP(target); setIpError(v.valid ? '' : v.message); }
    else setIpError('');
  }, [target]);

  const filtered = MODULES.filter(m =>
    (filterCat === 'all' || m.category === filterCat) &&
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleModule = (id) =>
    setSelectedModules(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const canStart = !ipError && target && selectedModules.length > 0 && connectionStatus === 'connected';

  return (
    <aside className="w-[272px] h-full flex flex-col border-r border-[rgba(102,192,244,0.1)]" style={{ background:'#171a21' }}>
      {/* Header */}
      <div className="p-4 border-b border-[rgba(102,192,244,0.1)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:'linear-gradient(135deg,rgba(87,203,222,0.2),rgba(102,192,244,0.2))', border:'1px solid rgba(87,203,222,0.3)' }}>
            <Target className="w-4 h-4 text-[#66c0f4]" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">NetProbe Suite</h1>
            <p className="text-[10px] text-[rgba(143,152,160,0.9)]">Pentesting Profesional</p>
          </div>
        </div>
      </div>

      {/* Case widget */}
      {activeCase && (
        <div className="px-3 py-2 flex items-center gap-2"
          style={{ background: `${activeCase.color}0a`, borderBottom: '1px solid rgba(102,192,244,0.08)' }}>
          <div className="w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0"
            style={{ background: `${activeCase.color}20` }}>
            📁
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold truncate" style={{ color: activeCase.color }}>{activeCase.name}</p>
          </div>
          <button onClick={onChangeCase}
            className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded transition-colors flex-shrink-0"
            style={{ color: 'rgba(143,152,160,0.9)', background: 'rgba(42,71,94,0.4)' }}
            title="Cambiar caso">
            <ChevronLeft className="w-2.5 h-2.5" />
            Casos
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Target */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-[rgba(198,212,223,0.7)] uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-3 h-3" /> Target IP
          </label>
          <div className="flex gap-1.5">
            <div className="flex-1">
              <Input value={target} onChange={e => setTarget(e.target.value)}
                placeholder="192.168.1.1" disabled={isRunning} error={!!ipError} success={target && !ipError} />
            </div>
            <PingButton target={target} disabled={!target || !!ipError || isRunning} />
          </div>
          {ipError && (
            <p className="text-[10px] text-[#c94040] flex items-center gap-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />{ipError}
            </p>
          )}
          <NetworkDiscovery onSelectTarget={setTarget} currentTarget={target} caseId={caseId} onHostsChange={onHostsChange} />
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-[rgba(198,212,223,0.7)] uppercase tracking-wider flex items-center gap-1.5 justify-between">
            <span className="flex items-center gap-1.5"><Key className="w-3 h-3" /> API Key (Groq)</span>
            {apiKey
              ? <span className="flex items-center gap-1 text-[9px] font-semibold" style={{ color: '#5ba32b' }}>
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#5ba32b' }} />
                  guardada
                </span>
              : <span className="text-[9px]" style={{ color: 'rgba(228,105,42,0.8)' }}>vacía</span>
            }
          </label>
          <div className="relative">
            <Input value={apiKey} onChange={e => setApiKey(e.target.value)}
              type={showApiKey ? 'text' : 'password'}
              placeholder={apiKey ? '••••••••••••••••••••' : 'gsk_xxxxxxxxxxxxxxxxxxxx'}
              className="pr-16" />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {apiKey && (
                <button onClick={() => { if(window.confirm('¿Borrar la API key guardada?')) setApiKey(''); }}
                  className="text-[9px] transition-colors"
                  style={{ color: 'rgba(201,64,64,0.6)' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#c94040'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,64,64,0.6)'}
                  title="Borrar API key">
                  ✕
                </button>
              )}
              <button onClick={() => setShowApiKey(p => !p)}
                className="text-[10px] transition-colors"
                style={{ color: 'rgba(143,152,160,0.9)' }}
                onMouseEnter={e => e.currentTarget.style.color = '#c6d4df'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(143,152,160,0.9)'}>
                {showApiKey ? 'ocultar' : 'ver'}
              </button>
            </div>
          </div>
          {!apiKey && (
            <p className="text-[9px]" style={{ color: 'rgba(143,152,160,0.6)' }}>
              Obtén una gratis en <span style={{ color: '#66c0f4' }}>console.groq.com</span>
            </p>
          )}
        </div>

        {/* Intensity */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-[rgba(198,212,223,0.7)] uppercase tracking-wider flex items-center gap-1.5">
            <Gauge className="w-3 h-3" /> Intensidad — {INTENSITY_LABELS[intensity]}
          </label>
          <div className="flex gap-1">
            {[1,2,3,4,5].map(v => (
              <button key={v} onClick={() => !isRunning && setIntensity(v)} disabled={isRunning}
                className={`flex-1 h-7 rounded text-xs font-medium transition-all ${intensity >= v ? 'bg-[rgba(87,203,222,0.2)] text-[#66c0f4] border border-[rgba(87,203,222,0.3)]' : 'bg-[rgba(42,71,94,0.4)] text-[rgba(143,152,160,0.9)] border border-[rgba(102,192,244,0.08)]'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-[rgba(198,212,223,0.7)] uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Duración flood (seg)
          </label>
          <Input type="number" value={duration} onChange={e => setDuration(+e.target.value||30)}
            min={5} max={300} disabled={isRunning} />
        </div>

        <div className="h-px bg-[rgba(102,192,244,0.08)]" />

        {/* Profiles */}
        <ProfileSelector
          currentModules={selectedModules}
          disabled={isRunning}
          onApply={(profile) => {
            setSelectedModules(profile.modules);
            setIntensity(profile.intensity);
            setDuration(profile.duration);
          }}
        />

        {/* Module selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-[rgba(198,212,223,0.7)] uppercase tracking-wider">
              Módulos ({selectedModules.length}/{MODULES.length})
            </label>
            <div className="flex gap-1">
              <button onClick={() => setSelectedModules(filtered.map(m=>m.id))} disabled={isRunning}
                className="text-[9px] text-[rgba(198,212,223,0.7)] hover:text-white px-1.5 py-0.5 rounded bg-[rgba(42,71,94,0.4)] hover:bg-[rgba(102,192,244,0.1)] transition-colors">
                todos
              </button>
              <button onClick={() => setSelectedModules([])} disabled={isRunning}
                className="text-[9px] text-[rgba(198,212,223,0.7)] hover:text-white px-1.5 py-0.5 rounded bg-[rgba(42,71,94,0.4)] hover:bg-[rgba(102,192,244,0.1)] transition-colors">
                limpiar
              </button>
            </div>
          </div>

          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar módulo…" disabled={isRunning} />

          {/* Category pills */}
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setFilterCat('all')}
              className={`px-2 py-0.5 text-[10px] rounded-full transition-all ${filterCat==='all' ? 'bg-[rgba(87,203,222,0.15)] text-[#66c0f4] border border-[rgba(87,203,222,0.3)]' : 'bg-[rgba(42,71,94,0.4)] text-[rgba(198,212,223,0.7)] border border-transparent hover:border-[rgba(102,192,244,0.15)]'}`}>
              Todos
            </button>
            {Object.entries(CATEGORIES).map(([k, cat]) => (
              <button key={k} onClick={() => setFilterCat(k)}
                className={`px-2 py-0.5 text-[10px] rounded-full transition-all border ${filterCat===k ? 'text-white border-opacity-50' : 'text-[rgba(198,212,223,0.7)] border-transparent hover:border-[rgba(102,192,244,0.15)]'}`}
                style={filterCat===k ? { background:`${cat.color}20`, borderColor:`${cat.color}50`, color: cat.color } : {}}>
                {cat.name}
              </button>
            ))}
          </div>

          {/* Module list */}
          <div className="max-h-[220px] overflow-y-auto space-y-0.5 pr-0.5">
            {filtered.map(m => {
              const sel = selectedModules.includes(m.id);
              const cat = CATEGORIES[m.category];
              return (
                <motion.button key={m.id} onClick={() => !isRunning && toggleModule(m.id)}
                  whileHover={{ x: 2 }} disabled={isRunning}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${sel ? 'bg-[rgba(87,203,222,0.08)] border border-[rgba(87,203,222,0.2)]' : 'bg-[rgba(42,71,94,0.2)] border border-transparent hover:bg-[rgba(102,192,244,0.07)]'}`}>
                  <div className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border ${sel ? 'bg-[#57cbde] border-[#57cbde]' : 'border-[rgba(143,152,160,0.6)]'}`}>
                    {sel && <CheckCircle2 className="w-2.5 h-2.5 text-black" />}
                  </div>
                  <span className={`flex-1 truncate ${sel ? 'text-white' : 'text-[#c6d4df]'}`}>{m.name}</span>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cat?.color }} />
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[rgba(102,192,244,0.1)] space-y-2">
        <ConnectionStatus status={connectionStatus} />
        {isRunning ? (
          <Button onClick={onStopScan} variant="danger" className="w-full" size="sm"
            icon={<Square className="w-3.5 h-3.5" />}>
            Detener Scan
          </Button>
        ) : (
          <div className="space-y-1.5">
            <Button onClick={onStartScan} variant="primary" className="w-full" size="sm"
              disabled={!canStart} icon={<Play className="w-3.5 h-3.5" />}>
              {resultCount > 0 ? 'Añadir al scan' : 'Ejecutar'} ({selectedModules.length} módulos)
            </Button>
            {resultCount > 0 && (
              <button onClick={onNewScan} disabled={!canStart}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all disabled:opacity-40"
                style={{ background:'rgba(102,192,244,0.07)', border:'1px solid rgba(102,192,244,0.15)', color:'rgba(198,212,223,0.8)' }}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Nuevo scan (borrar {resultCount} resultados)
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Ping Button ───────────────────────────────────────────────────
function PingButton({ target, disabled }) {
  const [state,  setState]  = useState('idle'); // idle | pinging | ok | fail
  const [result, setResult] = useState(null);
  const [show,   setShow]   = useState(false);

  const doPing = async () => {
    if (disabled || state === 'pinging') return;
    setState('pinging');
    setResult(null);
    setShow(true);
    try {
      const r = await fetch(`http://localhost:8000/api/ping/${encodeURIComponent(target)}`);
      const data = await r.json();
      setResult(data);
      setState(data.alive ? 'ok' : 'fail');
      setTimeout(() => setShow(false), 8000);
    } catch (e) {
      setResult({ error: String(e) });
      setState('fail');
      setTimeout(() => setShow(false), 5000);
    }
  };

  const colors = {
    idle:    { bg: 'rgba(102,192,244,0.08)', border: 'rgba(143,152,160,0.4)', text: 'rgba(198,212,223,0.7)' },
    pinging: { bg: 'rgba(228,105,42,0.1)',  border: 'rgba(228,105,42,0.3)',  text: '#e4692a' },
    ok:      { bg: 'rgba(87,203,222,0.1)',   border: 'rgba(87,203,222,0.3)',   text: '#57cbde' },
    fail:    { bg: 'rgba(201,64,64,0.1)',   border: 'rgba(201,64,64,0.3)',   text: '#c94040' },
  };
  const c = colors[state];

  return (
    <div className="relative">
      <button
        onClick={doPing}
        disabled={disabled}
        title="Comprobar conectividad"
        className="h-full flex items-center justify-center px-2.5 rounded-lg border transition-all disabled:opacity-30"
        style={{ background: c.bg, borderColor: c.border, color: c.text, minHeight: '34px' }}>
        {state === 'pinging'
          ? <Activity className="w-3.5 h-3.5 animate-pulse" />
          : <Activity className="w-3.5 h-3.5" />}
      </button>

      <AnimatePresence>
        {show && result && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1.5 right-0 z-50 rounded-xl border shadow-2xl overflow-hidden"
            style={{
              width: '220px',
              background: '#171a21',
              borderColor: result.alive ? 'rgba(87,203,222,0.25)' : 'rgba(201,64,64,0.25)',
            }}>
            {/* Header */}
            <div className="px-3 py-2 flex items-center gap-2 border-b"
              style={{ borderColor: result.alive ? 'rgba(87,203,222,0.12)' : 'rgba(201,64,64,0.12)',
                       background: result.alive ? 'rgba(87,203,222,0.06)' : 'rgba(201,64,64,0.06)' }}>
              <span className="text-sm">{result.alive ? '✅' : '❌'}</span>
              <div>
                <p className="text-[11px] font-semibold" style={{ color: result.alive ? '#57cbde' : '#c94040' }}>
                  {result.alive ? 'Host alcanzable' : 'Sin respuesta'}
                </p>
                <p className="text-[9px] text-[rgba(143,152,160,0.9)] font-mono">{result.target}</p>
              </div>
            </div>
            {/* Details */}
            <div className="px-3 py-2 space-y-1.5">
              <Row label="ICMP Ping" value={result.ping}
                ok={result.ping === 'OK'} />
              {result.latency_ms != null && (
                <Row label="Latencia" value={`${result.latency_ms} ms`} ok />
              )}
              {result.tcp_ports?.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-[rgba(143,152,160,0.9)] uppercase tracking-wider">Puertos TCP abiertos</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {result.tcp_ports.map(p => (
                      <span key={p} className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                        style={{ background: 'rgba(87,203,222,0.1)', color: '#57cbde', border: '1px solid rgba(87,203,222,0.2)' }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {result.error && (
                <p className="text-[9px] text-[#c94040] font-mono">{result.error}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value, ok }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] text-[rgba(143,152,160,0.9)] uppercase tracking-wider">{label}</span>
      <span className="text-[10px] font-mono font-medium"
        style={{ color: ok ? '#57cbde' : '#c94040' }}>{value}</span>
    </div>
  );
}
