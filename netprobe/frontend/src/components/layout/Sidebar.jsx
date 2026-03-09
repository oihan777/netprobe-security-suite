import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Wifi, Gauge, Clock, Play, Square, AlertCircle, CheckCircle2, Key, Activity } from 'lucide-react';
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
    <aside className="w-[272px] h-full flex flex-col border-r border-[rgba(255,255,255,0.08)]" style={{ background:'rgba(10,10,10,0.95)' }}>
      {/* Header */}
      <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:'linear-gradient(135deg,rgba(0,255,136,0.2),rgba(10,132,255,0.2))', border:'1px solid rgba(0,255,136,0.3)' }}>
            <Target className="w-4 h-4 text-[#00ff88]" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">NetProbe Suite</h1>
            <p className="text-[10px] text-[rgba(255,255,255,0.3)]">Pentesting Profesional</p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Target */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider flex items-center gap-1.5">
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
            <p className="text-[10px] text-[#ff453a] flex items-center gap-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />{ipError}
            </p>
          )}
          <NetworkDiscovery onSelectTarget={setTarget} currentTarget={target} />
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider flex items-center gap-1.5">
            <Key className="w-3 h-3" /> API Key (Groq)
          </label>
          <div className="relative">
            <Input value={apiKey} onChange={e => setApiKey(e.target.value)}
              type={showApiKey ? 'text' : 'password'}
              placeholder="Pega tu API key aquí" className="pr-10" />
            <button onClick={() => setShowApiKey(p => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.3)] hover:text-white text-[10px]">
              {showApiKey ? 'ocultar' : 'ver'}
            </button>
          </div>
        </div>

        {/* Intensity */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider flex items-center gap-1.5">
            <Gauge className="w-3 h-3" /> Intensidad — {INTENSITY_LABELS[intensity]}
          </label>
          <div className="flex gap-1">
            {[1,2,3,4,5].map(v => (
              <button key={v} onClick={() => !isRunning && setIntensity(v)} disabled={isRunning}
                className={`flex-1 h-7 rounded text-xs font-medium transition-all ${intensity >= v ? 'bg-[rgba(0,255,136,0.2)] text-[#00ff88] border border-[rgba(0,255,136,0.3)]' : 'bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.3)] border border-[rgba(255,255,255,0.06)]'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Duración flood (seg)
          </label>
          <Input type="number" value={duration} onChange={e => setDuration(+e.target.value||30)}
            min={5} max={300} disabled={isRunning} />
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.06)]" />

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
            <label className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider">
              Módulos ({selectedModules.length}/{MODULES.length})
            </label>
            <div className="flex gap-1">
              <button onClick={() => setSelectedModules(filtered.map(m=>m.id))} disabled={isRunning}
                className="text-[9px] text-[rgba(255,255,255,0.4)] hover:text-white px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] transition-colors">
                todos
              </button>
              <button onClick={() => setSelectedModules([])} disabled={isRunning}
                className="text-[9px] text-[rgba(255,255,255,0.4)] hover:text-white px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] transition-colors">
                limpiar
              </button>
            </div>
          </div>

          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar módulo…" disabled={isRunning} />

          {/* Category pills */}
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setFilterCat('all')}
              className={`px-2 py-0.5 text-[10px] rounded-full transition-all ${filterCat==='all' ? 'bg-[rgba(0,255,136,0.15)] text-[#00ff88] border border-[rgba(0,255,136,0.3)]' : 'bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.4)] border border-transparent hover:border-[rgba(255,255,255,0.1)]'}`}>
              Todos
            </button>
            {Object.entries(CATEGORIES).map(([k, cat]) => (
              <button key={k} onClick={() => setFilterCat(k)}
                className={`px-2 py-0.5 text-[10px] rounded-full transition-all border ${filterCat===k ? 'text-white border-opacity-50' : 'text-[rgba(255,255,255,0.4)] border-transparent hover:border-[rgba(255,255,255,0.1)]'}`}
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
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${sel ? 'bg-[rgba(0,255,136,0.08)] border border-[rgba(0,255,136,0.2)]' : 'bg-[rgba(255,255,255,0.02)] border border-transparent hover:bg-[rgba(255,255,255,0.05)]'}`}>
                  <div className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border ${sel ? 'bg-[#00ff88] border-[#00ff88]' : 'border-[rgba(255,255,255,0.2)]'}`}>
                    {sel && <CheckCircle2 className="w-2.5 h-2.5 text-black" />}
                  </div>
                  <span className={`flex-1 truncate ${sel ? 'text-white' : 'text-[rgba(255,255,255,0.6)]'}`}>{m.name}</span>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cat?.color }} />
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[rgba(255,255,255,0.08)] space-y-2">
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
                style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.5)' }}>
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
    idle:    { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', text: 'rgba(255,255,255,0.4)' },
    pinging: { bg: 'rgba(255,159,10,0.1)',  border: 'rgba(255,159,10,0.3)',  text: '#ff9f0a' },
    ok:      { bg: 'rgba(0,255,136,0.1)',   border: 'rgba(0,255,136,0.3)',   text: '#00ff88' },
    fail:    { bg: 'rgba(255,69,58,0.1)',   border: 'rgba(255,69,58,0.3)',   text: '#ff453a' },
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
              background: '#0d0d0f',
              borderColor: result.alive ? 'rgba(0,255,136,0.25)' : 'rgba(255,69,58,0.25)',
            }}>
            {/* Header */}
            <div className="px-3 py-2 flex items-center gap-2 border-b"
              style={{ borderColor: result.alive ? 'rgba(0,255,136,0.12)' : 'rgba(255,69,58,0.12)',
                       background: result.alive ? 'rgba(0,255,136,0.06)' : 'rgba(255,69,58,0.06)' }}>
              <span className="text-sm">{result.alive ? '✅' : '❌'}</span>
              <div>
                <p className="text-[11px] font-semibold" style={{ color: result.alive ? '#00ff88' : '#ff453a' }}>
                  {result.alive ? 'Host alcanzable' : 'Sin respuesta'}
                </p>
                <p className="text-[9px] text-[rgba(255,255,255,0.3)] font-mono">{result.target}</p>
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
                  <span className="text-[9px] text-[rgba(255,255,255,0.3)] uppercase tracking-wider">Puertos TCP abiertos</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {result.tcp_ports.map(p => (
                      <span key={p} className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                        style={{ background: 'rgba(0,255,136,0.1)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.2)' }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {result.error && (
                <p className="text-[9px] text-[#ff453a] font-mono">{result.error}</p>
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
      <span className="text-[9px] text-[rgba(255,255,255,0.3)] uppercase tracking-wider">{label}</span>
      <span className="text-[10px] font-mono font-medium"
        style={{ color: ok ? '#00ff88' : '#ff453a' }}>{value}</span>
    </div>
  );
}
