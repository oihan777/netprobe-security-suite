import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Play, Target, ChevronRight, Upload, AlertCircle, CheckCircle2, Clock, Zap } from 'lucide-react';
import { PROFILES } from '../../data/profiles.js';

const scoreColor = s => {
  if (s == null) return '#8f98a0';
  if (s >= 80) return '#5ba32b';
  if (s >= 60) return '#e4692a';
  if (s >= 35) return '#e4692a';
  return '#c94040';
};
const scoreLabel = s => {
  if (s == null) return 'Pendiente';
  if (s >= 80) return 'Seguro';
  if (s >= 60) return 'Aceptable';
  if (s >= 35) return 'En Riesgo';
  return 'Crítico';
};

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
function isValidIP(ip) {
  if (!IP_RE.test(ip)) return false;
  return ip.split('.').every(n => +n >= 0 && +n <= 255);
}

export function CampaignPanel({ ws, selectedModules, intensity, duration }) {
  const [targets,     setTargets]     = useState([]);
  const [inputVal,    setInputVal]    = useState('');
  const [inputError,  setInputError]  = useState('');
  const [campaignRes, setCampaignRes] = useState({});   // { ip -> { score, status } }
  const [currentTgt,  setCurrentTgt]  = useState(null);
  const [progress,    setProgress]    = useState({ current:0, total:0 });
  const [running,     setRunning]     = useState(false);
  const [profile,     setProfile]     = useState(null);
  const [useProfile,  setUseProfile]  = useState(false);

  // Derive modules to use
  const modules = useProfile && profile
    ? (PROFILES.find(p => p.id === profile)?.modules || selectedModules)
    : selectedModules;

  const addTarget = () => {
    const val = inputVal.trim();
    if (!val) return;
    // Handle CIDR or range? Just IPs for now
    const ips = val.split(/[,\n\s]+/).map(s => s.trim()).filter(Boolean);
    const invalid = ips.filter(ip => !isValidIP(ip));
    if (invalid.length) { setInputError(`IPs inválidas: ${invalid.join(', ')}`); return; }
    const dupes = ips.filter(ip => targets.includes(ip));
    const newIps = ips.filter(ip => !targets.includes(ip));
    if (dupes.length) setInputError(`Ya incluidos: ${dupes.join(', ')}`);
    else setInputError('');
    setTargets(p => [...p, ...newIps]);
    setInputVal('');
  };

  const removeTarget = ip => setTargets(p => p.filter(t => t !== ip));

  const importCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const ips = ev.target.result.split(/[\n,\r]+/)
        .map(s => s.trim()).filter(s => isValidIP(s));
      setTargets(p => [...new Set([...p, ...ips])]);
    };
    reader.readAsText(file);
  };

  const startCampaign = () => {
    if (!targets.length || !modules.length || running) return;
    setCampaignRes({});
    setRunning(true);
    setProgress({ current:0, total: targets.length });

    // Listen for campaign events
    const origHandle = ws._handleMessage;
    ws.send('MULTI_SCAN', {
      targets: targets,
      modules: modules,
      intensity: intensity || 3,
      duration:  duration  || 30,
    });
  };

  // Track campaign progress via ws events
  // We listen to ws.logs for TARGET_COMPLETE-style RESULT logs
  // The ws hook emits logs, we parse them
  const campaignStatus = targets.map(ip => {
    const r = campaignRes[ip];
    return { ip, score: r?.score ?? null, done: r !== undefined };
  });
  const done    = campaignStatus.filter(t => t.done).length;
  const allDone = done === targets.length && targets.length > 0;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4" style={{ background:'rgba(23,26,33,0.2)' }}>
      <div className="w-full space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background:'rgba(102,192,244,0.15)', border:'1px solid rgba(102,192,244,0.3)' }}>
            <Target className="w-4.5 h-4.5 text-[#66c0f4]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Campaña Multi-Target</h2>
            <p className="text-[10px] text-[rgba(198,212,223,0.6)]">Escanea múltiples IPs con el mismo perfil de módulos</p>
          </div>
        </div>

        {/* Target input */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.09)] p-4 space-y-3"
          style={{ background:'rgba(42,71,94,0.2)' }}>
          <p className="text-[10px] uppercase tracking-widest text-[rgba(198,212,223,0.6)] font-semibold">Targets</p>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input value={inputVal} onChange={e => { setInputVal(e.target.value); setInputError(''); }}
                onKeyDown={e => e.key === 'Enter' && addTarget()}
                placeholder="192.168.1.1  o  192.168.1.1, 192.168.1.2"
                className="w-full bg-[rgba(102,192,244,0.07)] border border-[rgba(102,192,244,0.15)] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[rgba(102,192,244,0.4)] placeholder-[rgba(143,152,160,0.6)]" />
              {inputError && (
                <p className="text-[9px] text-[#e4692a] mt-1 flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5" />{inputError}
                </p>
              )}
            </div>
            <button onClick={addTarget} disabled={!inputVal.trim()}
              className="px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-30"
              style={{ background:'rgba(102,192,244,0.15)', border:'1px solid rgba(102,192,244,0.3)', color:'#66c0f4' }}>
              <Plus className="w-4 h-4" />
            </button>
            <label className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:bg-[rgba(102,192,244,0.08)]"
              style={{ border:'1px solid rgba(102,192,244,0.15)', color:'rgba(198,212,223,0.8)' }}>
              <Upload className="w-4 h-4" />
              <input type="file" accept=".csv,.txt" className="hidden" onChange={importCSV} />
            </label>
          </div>

          {/* Target chips */}
          {targets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <AnimatePresence>
                {targets.map(ip => {
                  const res = campaignRes[ip];
                  return (
                    <motion.div key={ip}
                      initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.85 }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono"
                      style={{
                        background: res ? `${scoreColor(res.score)}18` : 'rgba(102,192,244,0.08)',
                        border: `1px solid ${res ? scoreColor(res.score)+'40' : 'rgba(102,192,244,0.15)'}`,
                        color: res ? scoreColor(res.score) : '#c6d4df',
                      }}>
                      {running && currentTgt === ip && <div className="w-1.5 h-1.5 rounded-full bg-[#66c0f4] animate-pulse" />}
                      {res && <CheckCircle2 className="w-3 h-3" />}
                      {ip}
                      {res && <span className="text-[9px] font-bold">{res.score}/100</span>}
                      {!running && (
                        <button onClick={() => removeTarget(ip)}
                          className="text-[rgba(143,152,160,0.9)] hover:text-[#c94040] transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Module config */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.09)] p-4 space-y-3"
          style={{ background:'rgba(42,71,94,0.2)' }}>
          <p className="text-[10px] uppercase tracking-widest text-[rgba(198,212,223,0.6)] font-semibold">Configuración</p>

          <div className="flex gap-2">
            <button onClick={() => setUseProfile(false)}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: !useProfile ? 'rgba(102,192,244,0.15)' : 'rgba(42,71,94,0.3)',
                border: `1px solid ${!useProfile ? 'rgba(143,152,160,0.6)' : 'rgba(102,192,244,0.1)'}`,
                color: !useProfile ? 'white' : 'rgba(198,212,223,0.7)',
              }}>
              Módulos actuales ({selectedModules.length})
            </button>
            <button onClick={() => setUseProfile(true)}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: useProfile ? 'rgba(87,203,222,0.08)' : 'rgba(42,71,94,0.3)',
                border: `1px solid ${useProfile ? 'rgba(87,203,222,0.25)' : 'rgba(102,192,244,0.1)'}`,
                color: useProfile ? '#57cbde' : 'rgba(198,212,223,0.7)',
              }}>
              Usar perfil
            </button>
          </div>

          {useProfile && (
            <div className="grid grid-cols-2 gap-1.5">
              {PROFILES.map(p => (
                <button key={p.id} onClick={() => setProfile(p.id)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[10px] font-medium transition-all"
                  style={{
                    background: profile === p.id ? `${p.color}15` : 'rgba(42,71,94,0.3)',
                    border: `1px solid ${profile === p.id ? p.color+'40' : 'rgba(102,192,244,0.1)'}`,
                    color: profile === p.id ? p.color : 'rgba(198,212,223,0.8)',
                  }}>
                  <span>{p.icon}</span>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 text-[10px] text-[rgba(198,212,223,0.6)] pt-1">
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {modules.length} módulos</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ~{Math.round(modules.length * (duration||30) / 60)}min estimado</span>
          </div>
        </div>

        {/* Launch */}
        <button
          onClick={startCampaign}
          disabled={!targets.length || !modules.length || running || !ws.isConnected}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, rgba(102,192,244,0.25), rgba(87,203,222,0.15))',
            border: '1px solid rgba(102,192,244,0.4)',
            color: running ? '#66c0f4' : 'white',
          }}>
          {running ? (
            <><div className="w-4 h-4 border-2 border-[#66c0f4] border-t-transparent rounded-full animate-spin" />
              Campaña en curso ({done}/{targets.length})</>
          ) : (
            <><Play className="w-4 h-4" /> Iniciar campaña — {targets.length} targets</>
          )}
        </button>

        {/* Results summary */}
        {Object.keys(campaignRes).length > 0 && (
          <div className="rounded-xl border border-[rgba(255,255,255,0.09)] overflow-hidden"
            style={{ background:'rgba(42,71,94,0.2)' }}>
            <div className="px-4 py-2.5 border-b border-[rgba(102,192,244,0.1)]">
              <p className="text-xs font-semibold text-white">Resultados de campaña</p>
            </div>
            {Object.entries(campaignRes).map(([ip, res]) => (
              <div key={ip} className="flex items-center gap-3 px-4 py-2.5 border-b border-[rgba(102,192,244,0.07)] last:border-0">
                <span className="text-xs font-mono text-white flex-1">{ip}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{ color: scoreColor(res.score), background:`${scoreColor(res.score)}18` }}>
                  {res.score}/100
                </span>
                <span className="text-[10px]" style={{ color: scoreColor(res.score) }}>{scoreLabel(res.score)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
