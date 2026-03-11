import { useState, useRef, useEffect, useCallback, useReducer } from 'react';
import { motion } from 'framer-motion';
import {
  Play, Loader2, CheckCircle, AlertTriangle,
  Sparkles, Target, Square, ChevronDown, ChevronRight,
  Terminal, Activity, Brain, RefreshCw, FileText, Download
} from 'lucide-react';
import { MODULES, CATEGORIES } from '../../data/modules.js';

const API_HTTP = 'http://localhost:8000';
const API_WS   = 'ws://localhost:8000';

const RISK_CFG = {
  LOW:      { color:'#5ba32b', bg:'rgba(91,163,43,0.12)',   label:'Bajo'    },
  MEDIUM:   { color:'#e4692a', bg:'rgba(228,105,42,0.12)',  label:'Medio'   },
  HIGH:     { color:'#e4692a', bg:'rgba(228,105,42,0.12)',  label:'Alto'    },
  CRITICAL: { color:'#c94040', bg:'rgba(201,64,64,0.12)',   label:'Crítico' },
};

/* ── Manual: card de módulo ─────────────────────────────────────── */
function PlanCard({ item, selected, onToggle }) {
  const mod    = MODULES.find(m => m.id === item.module);
  const cat    = CATEGORIES[mod?.category];
  const pColor = item.priority >= 9 ? '#c94040' : item.priority >= 7 ? '#e4692a' : item.priority >= 5 ? '#66c0f4' : '#8f98a0';
  const isSel  = selected.has(item.module);
  return (
    <motion.div initial={{ opacity:0,x:-10 }} animate={{ opacity:1,x:0 }}
      onClick={() => onToggle(item.module)}
      className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all"
      style={{ background:isSel?`${pColor}10`:'rgba(42,71,94,0.2)', borderColor:isSel?`${pColor}40`:'rgba(102,192,244,0.1)' }}>
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
          style={{ background:`${pColor}18`,color:pColor,border:`1px solid ${pColor}35` }}>
          {item.priority}
        </div>
        <div className="w-3.5 h-3.5 rounded flex items-center justify-center border transition-all"
          style={{ background:isSel?pColor:'transparent', borderColor:isSel?pColor:'rgba(143,152,160,0.6)' }}>
          {isSel && <CheckCircle className="w-2.5 h-2.5 text-black" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-white">{mod?.name || item.module}</span>
          {cat && <span className="text-[8px] px-1.5 py-0.5 rounded font-semibold"
            style={{ background:`${cat.color}15`,color:cat.color }}>{cat.name}</span>}
          <span className="text-[9px] ml-auto font-mono text-[rgba(143,152,160,0.6)]">i{item.intensity}</span>
        </div>
        <p className="text-[11px] text-[rgba(198,212,223,0.7)] leading-snug">{item.reason}</p>
      </div>
    </motion.div>
  );
}

/* ── Full Auto: burbuja de decisión IA ──────────────────────────── */
function AIDecisionBubble({ ev }) {
  const [open, setOpen] = useState(true);
  const risk = RISK_CFG[ev.risk_level] || RISK_CFG.MEDIUM;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border:'1px solid rgba(155,89,182,0.25)', background:'rgba(155,89,182,0.06)' }}>
      <button onClick={() => setOpen(o=>!o)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
        <Brain className="w-3.5 h-3.5 text-[#9b59b6] flex-shrink-0" />
        <span className="text-[10px] font-bold text-[#9b59b6] flex-1">Ciclo {ev.cycle} — IA decide</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background:risk.bg,color:risk.color }}>{risk.label}</span>
        {open ? <ChevronDown className="w-3 h-3 text-[rgba(143,152,160,0.9)]"/>:<ChevronRight className="w-3 h-3 text-[rgba(143,152,160,0.9)]"/>}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-[rgba(155,89,182,0.15)]">
          {ev.thinking && <p className="text-[10px] text-[rgba(198,212,223,0.8)] pt-2 italic leading-relaxed">"{ev.thinking}"</p>}
          <p className="text-[11px] text-white font-semibold">{ev.reason}</p>
          {ev.modules?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[9px] text-[rgba(143,152,160,0.9)] self-center mr-1">módulos:</span>
              {ev.modules.map(m=>(
                <span key={m} className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background:'rgba(102,192,244,0.15)',color:'#66c0f4',border:'1px solid rgba(102,192,244,0.25)' }}>{m}</span>
              ))}
            </div>
          )}
          {ev.cmd_labels?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[9px] text-[rgba(143,152,160,0.9)] self-center mr-1">comandos:</span>
              {ev.cmd_labels.map((c,i)=>(
                <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background:'rgba(200,169,81,0.1)',color:'#c8a951',border:'1px solid rgba(200,169,81,0.2)' }}>{c}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Análisis IA inline ─────────────────────────────────────────── */
function AIAnalysisBadge({ text }) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg mt-1"
      style={{ background:'rgba(155,89,182,0.08)', border:'1px solid rgba(155,89,182,0.18)' }}>
      <Brain className="w-3 h-3 text-[#9b59b6] mt-0.5 flex-shrink-0"/>
      <span className="text-[10px] text-[rgba(155,89,182,0.85)] leading-relaxed">{text}</span>
    </div>
  );
}

/* ── Full Auto: resultado de módulo ─────────────────────────────── */
function ModuleCard({ ev }) {
  const [open, setOpen] = useState(false);
  const mod   = MODULES.find(m => m.id === ev.module);
  const isErr = ev.status === 'ERROR' || ev.status === 'TIMEOUT';
  const color = isErr ? '#c94040' : ev.status === 'BLOCKED' ? '#e4692a' : '#5ba32b';
  const ports = ev.data?.open_ports || [];
  return (
    <div className="rounded-lg overflow-hidden" style={{ border:`1px solid ${color}22`,background:`${color}05` }}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full flex items-center gap-2 px-3 py-2 text-left">
        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background:`${color}20` }}>
          {isErr ? <AlertTriangle className="w-3 h-3" style={{color}}/> : <CheckCircle className="w-3 h-3" style={{color}}/>}
        </div>
        <span className="text-[10px] font-semibold text-white flex-1">{mod?.name || ev.module}</span>
        {ports.length > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded font-mono"
          style={{ background:'rgba(228,105,42,0.15)',color:'#e4692a' }}>{ports.length} puertos</span>}
        <span className="text-[9px] font-bold font-mono" style={{color}}>{ev.status}</span>
        <span className="text-[9px] text-[rgba(143,152,160,0.6)] font-mono">{ev.duration_ms ? `${(ev.duration_ms/1000).toFixed(1)}s`:''}</span>
        {open?<ChevronDown className="w-3 h-3 text-[rgba(143,152,160,0.6)]"/>:<ChevronRight className="w-3 h-3 text-[rgba(143,152,160,0.6)]"/>}
      </button>
      {ev.ai_analysis && !open && <AIAnalysisBadge text={ev.ai_analysis}/>}
      {open && (
        <div className="px-3 pb-2 border-t border-[rgba(42,71,94,0.4)] space-y-1.5">
          {ev.data && Object.keys(ev.data).length > 0 && (
            <pre className="text-[9px] font-mono text-[rgba(198,212,223,0.7)] mt-1.5 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
              {JSON.stringify(ev.data,null,2)}
            </pre>
          )}
          {ev.ai_analysis && <AIAnalysisBadge text={ev.ai_analysis}/>}
        </div>
      )}
    </div>
  );
}

/* ── Full Auto: resultado de comando ────────────────────────────── */
function CmdCard({ ev }) {
  const [open, setOpen] = useState(false);
  const ok = ev.rc === 0;
  return (
    <div className="rounded-lg overflow-hidden" style={{ border:'1px solid rgba(200,169,81,0.18)',background:'rgba(200,169,81,0.04)' }}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full flex items-center gap-2 px-3 py-2 text-left">
        <Terminal className="w-3.5 h-3.5 text-[#c8a951] flex-shrink-0" />
        <span className="text-[10px] font-semibold text-white flex-1">{ev.label}</span>
        <span className="text-[9px] font-mono text-[rgba(143,152,160,0.6)]">{(ev.cmd||'').slice(0,35)}{(ev.cmd||'').length>35?'…':''}</span>
        <span className="text-[9px] font-mono" style={{color:ok?'#5ba32b':'#c94040'}}>rc={ev.rc}</span>
        {open?<ChevronDown className="w-3 h-3 text-[rgba(143,152,160,0.6)]"/>:<ChevronRight className="w-3 h-3 text-[rgba(143,152,160,0.6)]"/>}
      </button>
      {ev.ai_analysis && !open && <AIAnalysisBadge text={ev.ai_analysis}/>}
      {open && (
        <div className="px-3 pb-2 border-t border-[rgba(42,71,94,0.4)] space-y-1.5">
          <p className="text-[9px] font-mono text-[#c8a951] mt-1.5">$ {ev.cmd}</p>
          <pre className="text-[9px] font-mono text-[rgba(198,212,223,0.8)] whitespace-pre-wrap break-all max-h-48 overflow-y-auto bg-[rgba(23,26,33,0.3)] rounded p-2">
            {ev.output || '(sin salida)'}
          </pre>
          {ev.ai_analysis && <AIAnalysisBadge text={ev.ai_analysis}/>}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STATE REDUCER — evita race conditions en mensajes WS rápidos
   ═══════════════════════════════════════════════════════════════════ */
const initAutoState = { entries:[], byId:{}, counter:0, results:[], cyclesDone:0 };

function autoReducer(state, action) {
  const { entries, byId, counter, results, cyclesDone } = state;

  // add: append new display entry, always carry full state
  const add = (type, data) => ({
    ...state,
    entries:  [...entries, counter],
    byId:     { ...byId, [counter]:{ id:counter, ...data, type } },
    counter:  counter + 1,
  });

  // update: mutate an existing display entry in-place, always carry full state
  const update = (pred, newType, newData) => {
    let tid = null;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (pred(byId[entries[i]])) { tid = entries[i]; break; }
    }
    if (tid == null) return add(newType, newData);
    return {
      ...state,
      byId: { ...byId, [tid]: { ...byId[tid], ...newData, type: newType } },
    };
  };

  switch (action.type) {
    case 'RESET':        return initAutoState;
    case 'system':       return add('system',        { message: action.message });
    case 'ai_thinking':  return add('ai_thinking',   { cycle: action.cycle });
    case 'ai_decision':  return update(e => e.type === 'ai_thinking' && e.cycle === action.cycle, 'ai_decision', action.ev);
    case 'module_start': return add('module_running', { cycle: action.cycle, module: action.module, name: action.name });
    case 'module_result': return {
      ...update(e => e.type === 'module_running' && e.module === action.ev.module && e.cycle === action.ev.cycle, 'module_done', action.ev),
      results: [...results, { ...action.ev, type: 'module' }],
    };
    case 'module_error': return {
      ...update(e => e.type === 'module_running' && e.module === action.ev.module && e.cycle === action.ev.cycle, 'module_done', { ...action.ev, status: action.ev.error || 'ERROR', data: {} }),
      results: [...results, { ...action.ev, type: 'module', status: action.ev.error || 'ERROR' }],
    };
    case 'cmd_start':    return add('cmd_running', { cycle: action.cycle, label: action.label, cmd: action.cmd });
    case 'cmd_result':   return {
      ...update(e => e.type === 'cmd_running' && e.cycle === action.ev.cycle && e.label === action.ev.label, 'cmd_done', action.ev),
      results: [...results, { ...action.ev, type: 'command' }],
    };
    case 'cycle_sep':    return { ...add('cycle_sep', { cycle: action.cycle, thisCount: action.thisCount, total: action.total }), cyclesDone: action.cycle };
    case 'stopped':      return { ...add('stopped', { reason: action.reason, total: action.total, cycle: action.cycle }), cyclesDone: action.cycle };
    case 'error':        return add('error', { message: action.message });
    case 'enrich_module': {
      const newById = { ...byId };
      for (const id of entries) {
        const e = byId[id];
        if (e.type === 'module_done' && `${e.cycle}_module_${e.name || e.module}` === action.key) {
          newById[id] = { ...e, ai_analysis: action.text };
        }
      }
      return { ...state, byId: newById };
    }
    case 'enrich_cmd': {
      const newById = { ...byId };
      for (const id of entries) {
        const e = byId[id];
        if (e.type === 'cmd_done' && `${e.cycle}_command_${e.label || e.cmd}` === action.key) {
          newById[id] = { ...e, ai_analysis: action.text };
        }
      }
      return { ...state, byId: newById };
    }
    default: return state;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PANEL
   ═══════════════════════════════════════════════════════════════════ */
export function AutopilotPanel({ results, apiKey, onLaunchModules }) {
  const [mode,       setMode]      = useState('manual');

  /* Manual */
  const [plan,       setPlan]      = useState(null);
  const [loadingM,   setLoadingM]  = useState(false);
  const [errorM,     setErrorM]    = useState('');
  const [selected,   setSelected]  = useState(new Set());
  const [launched,   setLaunched]  = useState(false);

  /* Full Auto */
  const [autoState,  dispatchAuto] = useReducer(autoReducer, initAutoState);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoCycle,   setAutoCycle]   = useState(0);
  const [autoError,   setAutoError]   = useState('');
  const [autoStopped, setAutoStopped] = useState(false);
  const [maxCycles,   setMaxCycles]   = useState(8);
  const [autoTarget,  setAutoTarget]  = useState('');

  // Collected results for PDF
  const allResultsRef = useRef([]);
  const cyclesDoneRef = useRef(0);

  // PDF state
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [pdfError,    setPdfError]    = useState('');

  const wsRef     = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [autoState.entries.length]);

  useEffect(() => () => { wsRef.current?.close(); }, []);

  const getTarget = () => {
    if (autoTarget.trim()) return autoTarget.trim();
    for (const r of results) if (r.target) return r.target;
    return '';
  };

  /* ─── MANUAL ─── */
  const generatePlan = async () => {
    if (!apiKey) { setErrorM('Necesitas una API Key de Groq en el sidebar'); return; }
    setLoadingM(true); setErrorM(''); setPlan(null); setLaunched(false);
    try {
      const res  = await fetch(`${API_HTTP}/api/autopilot/plan`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ results, api_key:apiKey }),
      });
      const data = await res.json();
      if (data.error) { setErrorM(data.error); return; }
      setPlan(data);
      setSelected(new Set((data.plan||[]).slice(0,6).map(p=>p.module)));
    } catch(e) { setErrorM(`Error: ${e.message}`); }
    finally    { setLoadingM(false); }
  };

  const toggleModule = id => setSelected(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  const launchSelected = () => { const m=[...selected]; if(!m.length) return; onLaunchModules(m); setLaunched(true); };
  const riskCfg = plan ? (RISK_CFG[plan.risk_level]||RISK_CFG.MEDIUM) : null;

  /* ─── FULL AUTO ─── */
  const startAuto = () => {
    const target = getTarget();
    if (!target)  { setAutoError('Introduce el target arriba o ejecuta un scan previo'); return; }
    if (!apiKey)  { setAutoError('Necesitas una API Key de Groq en el sidebar'); return; }

    setAutoRunning(true); setAutoCycle(0); setAutoError(''); setAutoStopped(false);
    setPdfError('');
    dispatchAuto({ type:'RESET' });
    allResultsRef.current = [];
    cyclesDoneRef.current = 0;

    const ws = new WebSocket(`${API_WS}/api/autopilot/auto`);
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({
      target, api_key:apiKey, max_cycles:maxCycles, intensity:3, duration:20,
    }));

    ws.onmessage = ({ data }) => {
      let ev; try { ev = JSON.parse(data); } catch { return; }
      switch(ev.type) {
        case 'started':
          dispatchAuto({ type:'system', message:`🚀 Full Auto iniciado · target: ${ev.target} · ${ev.max} ciclos máx` });
          break;
        case 'cycle_start':
          setAutoCycle(ev.cycle);
          cyclesDoneRef.current = ev.cycle;
          break;
        case 'thinking':
          dispatchAuto({ type:'ai_thinking', cycle:ev.cycle });
          break;
        case 'ai_decision':
          dispatchAuto({ type:'ai_decision', cycle:ev.cycle, ev });
          break;
        case 'module_start':
          dispatchAuto({ type:'module_start', cycle:ev.cycle, module:ev.module, name:ev.name });
          break;
        case 'module_result':
          dispatchAuto({ type:'module_result', ev });
          allResultsRef.current = [...allResultsRef.current, { ...ev, type:'module' }];
          break;
        case 'module_error':
          dispatchAuto({ type:'module_error', ev });
          allResultsRef.current = [...allResultsRef.current, { ...ev, type:'module', status: ev.error||'ERROR' }];
          break;
        case 'module_skip':
          dispatchAuto({ type:'system', message:`⏭ '${ev.module}' no registrado — saltado` });
          break;
        case 'command_start':
          dispatchAuto({ type:'cmd_start', cycle:ev.cycle, label:ev.label, cmd:ev.cmd });
          break;
        case 'command_result':
          dispatchAuto({ type:'cmd_result', ev });
          allResultsRef.current = [...allResultsRef.current, { ...ev, type:'command' }];
          break;
        case 'cycle_end':
          dispatchAuto({ type:'cycle_sep', cycle:ev.cycle, thisCount:ev.this_cycle, total:ev.total });
          break;
        case 'stopped':
          setAutoStopped(true); setAutoRunning(false);
          cyclesDoneRef.current = ev.cycle;
          dispatchAuto({ type:'stopped', reason:ev.reason, total:ev.total, cycle:ev.cycle });
          break;
        case 'error':
          setAutoError(ev.message||'Error desconocido'); setAutoRunning(false);
          dispatchAuto({ type:'error', message:ev.message });
          break;
      }
    };

    ws.onerror  = () => { setAutoError('Error de conexión WebSocket'); setAutoRunning(false); };
    ws.onclose  = () => {};
  };

  const stopAuto = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ action:'stop' }));
    setAutoRunning(false); setAutoStopped(true);
  };

  /* ─── PDF DOWNLOAD ─── */
  const downloadPDF = async () => {
    const target     = getTarget();
    const pdfResults = autoState.results;
    const pdfCycles  = autoState.cyclesDone;
    if (!pdfResults.length) { setPdfError('No hay resultados para generar el informe'); return; }
    setPdfLoading(true); setPdfError('');
    try {
      const res = await fetch(`${API_HTTP}/api/autopilot/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target:      target || 'N/A',
          results:     pdfResults,
          cycles_done: pdfCycles,
          api_key:     apiKey,
          model:       'llama-3.3-70b-versatile',
          date_str:    new Date().toLocaleString('es-ES'),
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setPdfError(`Error generando PDF: ${txt.slice(0,200)}`);
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `netprobe-autopilot-${(target||'report').replace(/\./g,'_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) {
      setPdfError(`Error: ${e.message}`);
    } finally {
      setPdfLoading(false);
    }
  };

  /* ─── Render event entry ─── */
  const renderEntry = (id) => {
    const e = autoState.byId[id];
    if (!e) return null;
    switch(e.type) {
      case 'system':
        return <div key={id} className="flex items-center gap-2 text-[10px] text-[rgba(143,152,160,0.9)] py-0.5">
          <Activity className="w-3 h-3 flex-shrink-0"/>{e.message}
        </div>;
      case 'ai_thinking':
        return <div key={id} className="flex items-center gap-2 text-[10px] text-[#9b59b6] py-1">
          <Loader2 className="w-3 h-3 animate-spin flex-shrink-0"/>
          Ciclo {e.cycle} — consultando IA…
        </div>;
      case 'ai_decision':
        return <AIDecisionBubble key={id} ev={e}/>;
      case 'module_running':
        return <div key={id} className="flex items-center gap-2 text-[10px] text-[rgba(198,212,223,0.6)] py-0.5 pl-1">
          <Loader2 className="w-3 h-3 animate-spin text-[#66c0f4] flex-shrink-0"/>
          Ejecutando {e.name||e.module}…
        </div>;
      case 'module_done':
        return <ModuleCard key={id} ev={e}/>;
      case 'cmd_running':
        return <div key={id} className="flex items-center gap-2 text-[10px] text-[#c8a951] py-0.5 pl-1">
          <Loader2 className="w-3 h-3 animate-spin flex-shrink-0"/>$ {e.label}…
        </div>;
      case 'cmd_done':
        return <CmdCard key={id} ev={e}/>;
      case 'cycle_sep':
        return <div key={id} className="flex items-center gap-2 py-1">
          <div className="flex-1 h-px bg-[rgba(102,192,244,0.08)]"/>
          <span className="text-[9px] px-2 py-0.5 rounded-full text-[rgba(143,152,160,0.9)]"
            style={{ background:'rgba(102,192,244,0.07)',border:'1px solid rgba(102,192,244,0.1)' }}>
            Ciclo {e.cycle} — {e.thisCount} acciones · {e.total} total
          </span>
          <div className="flex-1 h-px bg-[rgba(102,192,244,0.08)]"/>
        </div>;
      case 'stopped':
        return <motion.div key={id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
          className="rounded-xl border p-4 text-center"
          style={{ borderColor:'rgba(91,163,43,0.3)',background:'rgba(91,163,43,0.07)' }}>
          <CheckCircle className="w-6 h-6 text-[#5ba32b] mx-auto mb-2"/>
          <p className="text-sm font-semibold text-[#5ba32b]">Autopilot detenido</p>
          <p className="text-xs text-[rgba(255,255,255,0.45)] mt-1">{e.reason}</p>
          <p className="text-[10px] text-[rgba(143,152,160,0.7)] mt-0.5">{e.total} acciones · {e.cycle} ciclos</p>
        </motion.div>;
      case 'error':
        return <div key={id} className="rounded-lg border border-[rgba(201,64,64,0.3)] bg-[rgba(201,64,64,0.07)] p-3 text-xs text-[#c94040]">
          ⚠ {e.message}
        </div>;
      default: return null;
    }
  };

  /* ─── RENDER ─── */
  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[rgba(102,192,244,0.1)] space-y-2"
        style={{ background:'#1b2838' }}>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Title */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[rgba(87,203,222,0.1)] border border-[rgba(87,203,222,0.2)] flex items-center justify-center text-sm">🤖</div>
            <span className="text-xs font-bold text-white">Autopilot</span>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center rounded-lg overflow-hidden border border-[rgba(102,192,244,0.15)]"
            style={{ background:'rgba(42,71,94,0.4)' }}>
            <button onClick={()=>setMode('manual')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold transition-all"
              style={{ background:mode==='manual'?'rgba(87,203,222,0.12)':'transparent', color:mode==='manual'?'#57cbde':'rgba(198,212,223,0.7)' }}>
              <Sparkles className="w-3 h-3"/> Manual
            </button>
            <div className="w-px h-4 bg-[rgba(102,192,244,0.15)]"/>
            <button onClick={()=>setMode('auto')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold transition-all"
              style={{ background:mode==='auto'?'rgba(155,89,182,0.12)':'transparent', color:mode==='auto'?'#9b59b6':'rgba(198,212,223,0.7)' }}>
              <Brain className="w-3 h-3"/> Full Auto
            </button>
          </div>

          {/* Manual controls */}
          {mode==='manual' && <>
            <button onClick={generatePlan} disabled={loadingM}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
              style={{ background:'rgba(87,203,222,0.1)',border:'1px solid rgba(87,203,222,0.3)',color:'#57cbde' }}>
              {loadingM?<><Loader2 className="w-3.5 h-3.5 animate-spin"/> Analizando…</>
                       :<><Sparkles className="w-3.5 h-3.5"/> {plan?'Regenerar':'Generar plan'}</>}
            </button>
            {plan && <>
              <button onClick={()=>setSelected(new Set((plan.plan||[]).map(p=>p.module)))}
                className="text-[10px] px-2 py-1 rounded-lg border border-[rgba(102,192,244,0.15)] text-[rgba(198,212,223,0.7)] hover:text-white">Todos</button>
              <button onClick={()=>setSelected(new Set())}
                className="text-[10px] px-2 py-1 rounded-lg border border-[rgba(102,192,244,0.15)] text-[rgba(198,212,223,0.7)] hover:text-white">Ninguno</button>
              <span className="text-[10px] text-[rgba(143,152,160,0.9)]">{selected.size}/{plan.plan?.length||0}</span>
              <button onClick={launchSelected} disabled={!selected.size||launched}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background:launched?'rgba(91,163,43,0.12)':'rgba(87,203,222,0.15)', border:`1px solid ${launched?'rgba(91,163,43,0.4)':'rgba(87,203,222,0.4)'}`, color:launched?'#5ba32b':'#57cbde' }}>
                {launched?<><CheckCircle className="w-3.5 h-3.5"/> Lanzado</>:<><Play className="w-3.5 h-3.5"/> Lanzar {selected.size}</>}
              </button>
            </>}
          </>}

          {/* Full Auto controls */}
          {mode==='auto' && <>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-[rgba(198,212,223,0.6)]">Ciclos:</span>
              <input type="number" min="1" max="20" value={maxCycles} disabled={autoRunning}
                onChange={e=>setMaxCycles(Math.max(1,Math.min(20,parseInt(e.target.value)||8)))}
                className="w-12 bg-[rgba(102,192,244,0.1)] border border-[rgba(143,152,160,0.4)] rounded px-2 py-1 text-[10px] text-white text-center outline-none"/>
            </div>

            {!autoRunning
              ? <button onClick={startAuto}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background:'rgba(155,89,182,0.15)',border:'1px solid rgba(155,89,182,0.4)',color:'#9b59b6' }}>
                  <Brain className="w-3.5 h-3.5"/> {autoStopped?'Reiniciar':'Iniciar Full Auto'}
                </button>
              : <button onClick={stopAuto}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background:'rgba(201,64,64,0.2)',border:'1px solid rgba(201,64,64,0.5)',color:'#c94040' }}>
                  <Square className="w-3.5 h-3.5"/> Detener autopilot
                </button>
            }

            {autoRunning && (
              <div className="flex items-center gap-1.5 text-[10px] text-[rgba(198,212,223,0.7)]">
                <RefreshCw className="w-3 h-3 animate-spin text-[#9b59b6]"/>
                Ciclo {autoCycle}/{maxCycles}
              </div>
            )}

            {/* PDF button — shown after stopped */}
            {autoStopped && autoState.results.length > 0 && (
              <button onClick={downloadPDF} disabled={pdfLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ml-auto disabled:opacity-50"
                style={{ background:'rgba(30,64,175,0.2)',border:'1px solid rgba(30,64,175,0.45)',color:'#66c0f4' }}>
                {pdfLoading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/> Generando PDF + IA…</>
                  : <><Download className="w-3.5 h-3.5"/> Descargar informe PDF</>}
              </button>
            )}
          </>}
        </div>

        {/* Target input (Full Auto only) */}
        {mode==='auto' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] text-[rgba(198,212,223,0.6)]">Target:</span>
            <input value={autoTarget} onChange={e=>setAutoTarget(e.target.value)}
              placeholder={getTarget() || "192.168.1.1"}
              disabled={autoRunning}
              className="flex-1 max-w-xs bg-[rgba(102,192,244,0.07)] border border-[rgba(102,192,244,0.15)] rounded-lg px-2.5 py-1.5 text-[10px] text-white outline-none focus:border-[rgba(155,89,182,0.4)] placeholder-[rgba(143,152,160,0.6)]"/>
            {getTarget() && !autoTarget && (
              <span className="text-[9px] text-[rgba(155,89,182,0.6)]">auto: {getTarget()}</span>
            )}
            {pdfError && (
              <span className="text-[9px] text-[#c94040]">{pdfError}</span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">

        {/* ── MANUAL ── */}
        {mode==='manual' && (
          <div className="h-full overflow-y-auto p-4">
            {!plan && !loadingM && !errorM && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="relative w-24 h-24 mb-6">
                  {[0,1,2].map(i=>(
                    <div key={i} className="absolute inset-0 rounded-full border border-[rgba(87,203,222,0.15)]"
                      style={{ margin:`${i*10}px`,animation:`spin ${6+i*2}s linear infinite`,animationDirection:i%2?'reverse':'normal' }}/>
                  ))}
                  <div className="absolute inset-0 flex items-center justify-center text-3xl">🤖</div>
                </div>
                <h3 className="text-white font-semibold mb-2">Modo Manual — IA sugiere, tú decides</h3>
                <p className="text-xs text-[rgba(198,212,223,0.6)] max-w-sm leading-relaxed mb-6">
                  {results.length>0 ? `Analiza ${results.length} resultados y genera el plan óptimo.` : 'Ejecuta un scan de reconocimiento primero.'}
                </p>
                <button onClick={generatePlan}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background:'rgba(87,203,222,0.1)',border:'1.5px solid rgba(87,203,222,0.35)',color:'#57cbde' }}>
                  <Sparkles className="w-4 h-4"/> Generar plan de ataque
                </button>
              </div>
            )}
            {loadingM && (
              <div className="flex flex-col items-center justify-center h-48 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-[#66c0f4]"/>
                <p className="text-sm text-[rgba(198,212,223,0.8)]">Analizando con IA…</p>
              </div>
            )}
            {errorM && !loadingM && (
              <div className="rounded-xl border border-[rgba(201,64,64,0.3)] bg-[rgba(201,64,64,0.08)] p-4 text-sm text-[#c94040]">{errorM}</div>
            )}
            {plan && !loadingM && (
              <div className="space-y-4">
                <div className="rounded-xl border p-4 grid md:grid-cols-3 gap-4"
                  style={{ borderColor:`${riskCfg?.color}30`,background:`${riskCfg?.color}06` }}>
                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-[#66c0f4]"/>
                      <span className="text-xs font-semibold text-[rgba(198,212,223,0.8)] uppercase tracking-wider">Estrategia IA</span>
                    </div>
                    <p className="text-sm text-white">{plan.summary}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {[['Riesgo',riskCfg?.label,riskCfg?.color],['Módulos',`${plan.plan?.length||0}`,'#66c0f4'],['Duración',plan.estimated_duration||'?','rgba(198,212,223,0.7)']].map(([l,v,c])=>(
                      <div key={l} className="flex items-center justify-between">
                        <span className="text-[9px] text-[rgba(198,212,223,0.6)] uppercase">{l}</span>
                        <span className="text-[11px] font-semibold" style={{color:c}}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-[rgba(143,152,160,0.9)] flex items-center gap-1.5">
                  <Target className="w-3 h-3"/> Click para seleccionar/deseleccionar
                </p>
                <div className="space-y-2">
                  {(plan.plan||[]).map(item=><PlanCard key={item.module} item={item} selected={selected} onToggle={toggleModule}/>)}
                </div>
                {launched && (
                  <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
                    className="rounded-xl border border-[rgba(91,163,43,0.3)] bg-[rgba(91,163,43,0.08)] p-4 text-center">
                    <CheckCircle className="w-6 h-6 text-[#5ba32b] mx-auto mb-2"/>
                    <p className="text-sm font-semibold text-[#5ba32b]">Módulos añadidos</p>
                    <p className="text-xs text-[rgba(198,212,223,0.7)] mt-1">Ve a Módulos y pulsa Iniciar Scan</p>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── FULL AUTO ── */}
        {mode==='auto' && (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Empty state */}
            {!autoRunning && !autoStopped && autoState.entries.length===0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <div className="relative w-28 h-28 mb-6">
                  {[0,1,2].map(i=>(
                    <div key={i} className="absolute inset-0 rounded-full border border-[rgba(155,89,182,0.15)]"
                      style={{ margin:`${i*10}px`,animation:`spin ${5+i*3}s linear infinite`,animationDirection:i%2?'reverse':'normal' }}/>
                  ))}
                  <div className="absolute inset-0 flex items-center justify-center text-4xl">🧠</div>
                </div>
                <h3 className="text-white font-semibold mb-2">Modo Full Auto</h3>
                <p className="text-xs text-[rgba(198,212,223,0.6)] max-w-md leading-relaxed mb-3">
                  La IA toma el control: escanea → analiza → decide → ejecuta. Al terminar, descarga el informe PDF con análisis IA de cada resultado.
                </p>
                {autoError && (
                  <div className="rounded-xl border border-[rgba(201,64,64,0.3)] bg-[rgba(201,64,64,0.08)] px-4 py-2 text-xs text-[#c94040] mb-3 max-w-sm">
                    {autoError}
                  </div>
                )}
                <button onClick={startAuto}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold mt-2"
                  style={{ background:'rgba(155,89,182,0.15)',border:'1.5px solid rgba(155,89,182,0.4)',color:'#9b59b6' }}>
                  <Brain className="w-4 h-4"/> Iniciar Full Auto
                </button>
              </div>
            )}

            {/* Event log */}
            {(autoRunning || autoStopped || autoState.entries.length > 0) && (
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1.5">
                {autoState.entries.map(id => renderEntry(id))}
                {autoRunning && (
                  <div className="flex items-center gap-2 text-[10px] text-[rgba(143,152,160,0.6)] py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#9b59b6] animate-pulse"/>
                    Autopilot activo · ciclo {autoCycle}/{maxCycles}
                  </div>
                )}
                {/* PDF hint after stopped */}
                {autoStopped && autoState.results.length > 0 && (
                  <div className="flex items-center gap-2 text-[10px] text-[rgba(96,165,250,0.7)] py-2 border-t border-[rgba(102,192,244,0.07)] mt-2 pt-3">
                    <FileText className="w-3.5 h-3.5 flex-shrink-0"/>
                    <span>Análisis completado. Pulsa <b>"Descargar informe PDF"</b> arriba — la IA analizará cada resultado y generará el informe completo.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
