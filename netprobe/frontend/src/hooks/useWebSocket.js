import { useState, useEffect, useCallback, useRef } from 'react';

const WS_URL = 'ws://localhost:8000/ws';

// ── LocalStorage helpers para resultados por caso ─────────────────
function loadCaseResults(caseId) {
  if (!caseId) return [];
  try {
    const raw = window.localStorage.getItem(`np-results-${caseId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCaseResults(caseId, results) {
  if (!caseId) return;
  try {
    window.localStorage.setItem(`np-results-${caseId}`, JSON.stringify(results));
  } catch (e) { console.error('Error saving results:', e); }
}

function loadCaseLogs(caseId) {
  if (!caseId) return [];
  try {
    const raw = window.localStorage.getItem(`np-logs-${caseId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCaseLogs(caseId, logs) {
  if (!caseId) return;
  try {
    // Guardar solo los últimos 500 logs para no saturar localStorage
    const trimmed = logs.slice(-500);
    window.localStorage.setItem(`np-logs-${caseId}`, JSON.stringify(trimmed));
  } catch (e) { console.error('Error saving logs:', e); }
}

export function useWebSocket(caseId = null) {
  const [isConnected, setIsConnected]   = useState(false);
  const [isRunning, setIsRunning]       = useState(false);
  // Cargar resultados persistidos del caso activo al inicializar
  const [results, setResults]           = useState(() => loadCaseResults(caseId));
  const [logs, setLogs]                 = useState(() => loadCaseLogs(caseId));
  const [progress, setProgress]         = useState({ current:0, total:0, module:null });
  const [campaignResults, setCampaignResults] = useState({});
  const [connectionStatus, setStatus]   = useState('disconnected');
  const [discoveredHosts, setDiscoveredHosts] = useState([]);

  const wsRef          = useRef(null);
  const reconnectRef   = useRef(null);
  const attemptsRef    = useRef(0);
  const caseIdRef      = useRef(caseId);
  const resultsRef     = useRef(results);
  const logsRef        = useRef(logs);
  const MAX_ATTEMPTS   = 8;

  // Sincronizar refs
  useEffect(() => { caseIdRef.current = caseId; }, [caseId]);
  useEffect(() => { resultsRef.current = results; }, [results]);
  useEffect(() => { logsRef.current = logs; }, [logs]);

  // Cuando cambia el caso activo, cargar sus resultados/logs
  useEffect(() => {
    setResults(loadCaseResults(caseId));
    setLogs(loadCaseLogs(caseId));
  }, [caseId]);

  const addLog = useCallback((type, message, module = null) => {
    const entry = {
      id: Date.now() + Math.random(),
      type, message, module,
      timestamp: new Date().toISOString(),
    };
    setLogs(prev => {
      const next = [...prev, entry];
      saveCaseLogs(caseIdRef.current, next);
      return next;
    });
  }, []);

  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'LOG':
        addLog(data.log_type || 'INFO', data.message, data.module);
        break;

      case 'MODULE_START':
        setIsRunning(true);
        setProgress({ current: data.current, total: data.total, module: data.module_name || data.module });
        break;

      case 'MODULE_RESULT':
        setResults(prev => {
          const filtered = prev.filter(r => r.id !== data.module);
          const next = [...filtered, {
            id:          data.module,
            name:        data.module_name,
            category:    data.category,
            status:      data.status,
            score:       data.score,
            data:        data.data || {},
            timestamp:   data.timestamp || new Date().toISOString(),
            duration_ms: data.duration_ms ?? null,
            commands:    data.commands   || [],
            raw_output:  data.raw_output || '',
          }];
          // Persistir inmediatamente en localStorage
          saveCaseResults(caseIdRef.current, next);
          return next;
        });
        const e = { BLOCKED:'🛡️', DETECTED:'👁️', PARTIAL:'⚠️', PASSED:'🚨', ERROR:'❌' };
        addLog('RESULT', `${e[data.status]||'•'} ${data.module_name}: ${data.status} (score: ${data.score ?? 'N/A'})`, data.module);
        break;

      case 'SCAN_COMPLETE':
        setIsRunning(false);
        setProgress({ current:0, total:0, module:null });
        addLog('SYSTEM', `✓ Scan completo — ${data.total_executed} módulos — Score: ${data.global_score}/100`);
        // Persistir resultados finales
        saveCaseResults(caseIdRef.current, resultsRef.current);
        break;

      case 'DISCOVERED_HOSTS':
        setDiscoveredHosts(data.hosts || []);
        break;

      case 'TARGET_START':
        setProgress(p => ({ ...p, module: `${data.target} (${data.index}/${data.total})` }));
        addLog('SYSTEM', `▶ Target ${data.index}/${data.total}: ${data.target}`);
        break;

      case 'TARGET_COMPLETE':
        addLog('RESULT', `✓ ${data.target} — Score: ${data.score}/100`);
        setCampaignResults(p => ({ ...p, [data.target]: { score: data.score } }));
        setProgress(p => ({ ...p, current: data.index, total: data.total }));
        break;

      case 'MULTI_SCAN_COMPLETE':
        setIsRunning(false);
        setProgress({ current:0, total:0, module:null });
        addLog('SYSTEM', `✓ Campaña completa — ${data.total_targets} targets escaneados`);
        break;

      case 'SCAN_ERROR':
        setIsRunning(false);
        addLog('ERROR', `Error: ${data.message}`);
        break;

      case 'HEALTH_CHECK':
        const available = Object.entries(data.tools || {}).filter(([,v])=>v).map(([k])=>k);
        addLog('INFO', `Herramientas: ${available.join(', ') || 'ninguna detectada'}`);
        addLog('INFO', `Root: ${data.root ? 'Sí' : 'No (algunos módulos requieren sudo)'}`);
        break;

      default:
        break;
    }
  }, [addLog]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setStatus('connecting');
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        setIsConnected(true);
        setStatus('connected');
        attemptsRef.current = 0;
        addLog('SYSTEM', '✓ Conectado al backend NetProbe (localhost:8000)');
        ws.send(JSON.stringify({ action: 'HEALTH_CHECK' }));
      };
      ws.onclose = (ev) => {
        setIsConnected(false);
        setStatus('disconnected');
        setIsRunning(false);
        if (!ev.wasClean && attemptsRef.current < MAX_ATTEMPTS) {
          const delay = Math.min(1000 * Math.pow(1.5, attemptsRef.current), 15000);
          reconnectRef.current = setTimeout(() => {
            attemptsRef.current++;
            connect();
          }, delay);
        }
      };
      ws.onerror = () => setStatus('error');
      ws.onmessage = (ev) => {
        try { handleMessage(JSON.parse(ev.data)); }
        catch (e) { addLog('ERROR', `Parse error: ${e.message}`); }
      };
    } catch (e) {
      setStatus('error');
    }
  }, [addLog, handleMessage]);

  const send = useCallback((action, params = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, ...params }));
      return true;
    }
    addLog('WARN', 'No conectado al backend');
    return false;
  }, [addLog]);

  const startScan = useCallback((config) => {
    setProgress({ current:0, total: config.modules?.length || 0, module:null });
    return send('START_SCAN', {
      target:    config.target,
      modules:   config.modules,
      intensity: config.intensity || 3,
      duration:  config.duration  || 30,
      interface: config.interface || 'eth0',
      case_id:   caseIdRef.current || null,
    });
  }, [send]);

  const clearAndStartScan = useCallback((config) => {
    const next = [];
    setResults(next);
    saveCaseResults(caseIdRef.current, next);
    setProgress({ current:0, total: config.modules?.length || 0, module:null });
    return send('START_SCAN', {
      target:    config.target,
      modules:   config.modules,
      intensity: config.intensity || 3,
      duration:  config.duration  || 30,
      interface: config.interface || 'eth0',
      case_id:   caseIdRef.current || null,
    });
  }, [send]);

  const stopScan     = useCallback(() => send('STOP_SCAN'), [send]);
  const runCommand   = useCallback((command) => send('RUN_COMMAND', { command }), [send]);
  const runMultiScan = useCallback((config) => {
    setCampaignResults({});
    setIsRunning(true);
    return send('MULTI_SCAN', {
      targets:   config.targets,
      modules:   config.modules,
      intensity: config.intensity || 3,
      duration:  config.duration  || 30,
      case_id:   caseIdRef.current || null,
    });
  }, [send]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    saveCaseLogs(caseIdRef.current, []);
  }, []);

  const clearResults = useCallback(() => {
    const next = [];
    setResults(next);
    saveCaseResults(caseIdRef.current, next);
    setProgress({ current:0, total:0, module:null });
  }, []);

  const calculateScore = useCallback(() => {
    const valid = results.filter(r => r.score !== null && r.score !== undefined);
    if (!valid.length) return 0;
    return Math.round(valid.reduce((s,r) => s + r.score, 0) / valid.length);
  }, [results]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, []);

  return {
    isConnected, isRunning, connectionStatus, logs, results, progress,
    discoveredHosts,
    send, startScan, stopScan, clearLogs, clearResults, clearAndStartScan,
    runCommand, runMultiScan, campaignResults, connect, calculateScore, addLog,
  };
}
