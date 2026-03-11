import { useState, useCallback, useRef, useEffect } from 'react';

const BACKEND    = 'http://localhost:8000';
const WS_BACKEND = 'ws://localhost:8000';

// ── Persistencia de chat por caso ─────────────────────────────────
function loadCaseMessages(caseId) {
  if (!caseId) return [];
  try {
    const raw = window.localStorage.getItem(`np-ai-${caseId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCaseMessages(caseId, messages) {
  if (!caseId) return;
  try {
    // Guardar solo los últimos 100 mensajes para no saturar localStorage
    const trimmed = messages.slice(-100);
    window.localStorage.setItem(`np-ai-${caseId}`, JSON.stringify(trimmed));
  } catch (e) { console.error('Error saving AI messages:', e); }
}

export function useAI(apiKey = '', model = 'llama-3.3-70b-versatile', caseId = null) {
  const [messages,    setMessages]   = useState(() => loadCaseMessages(caseId));
  const [isLoading,   setIsLoading]  = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error,       setError]      = useState(null);
  const [usage,       setUsage]      = useState(null);
  const wsRef    = useRef(null);
  const abortRef = useRef(null);
  const caseIdRef = useRef(caseId);

  // Sincronizar ref
  useEffect(() => { caseIdRef.current = caseId; }, [caseId]);

  // Al cambiar de caso, cargar su historial de chat
  useEffect(() => {
    setMessages(loadCaseMessages(caseId));
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);
  }, [caseId]);

  const addMsg = useCallback((role, content, extra = {}) => {
    const msg = { id: Date.now() + Math.random(), role, content, ts: new Date().toISOString(), ...extra };
    setMessages(prev => {
      const next = [...prev, msg];
      saveCaseMessages(caseIdRef.current, next);
      return next;
    });
    return msg;
  }, []);

  const updateLastMsg = useCallback((updater) => {
    setMessages(prev => {
      const copy = [...prev];
      copy[copy.length - 1] = updater(copy[copy.length - 1]);
      saveCaseMessages(caseIdRef.current, copy);
      return copy;
    });
  }, []);

  // ── streaming via WebSocket ──────────────────────────────────
  const streamMessage = useCallback(async (userMessage, results = [], target = '', modules = []) => {
    if (!apiKey) {
      addMsg('user', userMessage);
      addMsg('assistant', '⚠️ **API Key no configurada**\n\nIntroduce tu Groq API Key en el panel lateral.', { isError: true });
      return;
    }

    setIsLoading(true);
    setIsStreaming(false);
    setError(null);

    addMsg('user', userMessage);

    const placeholder = { id: Date.now() + 1, role: 'assistant', content: '', ts: new Date().toISOString(), isStreaming: true };
    setMessages(prev => [...prev, placeholder]);

    // Leer historial actual para contexto
    const currentMsgs = loadCaseMessages(caseIdRef.current);
    const history = currentMsgs.slice(-12).map(m => ({ role: m.role, content: m.content }));

    try {
      const ws = new WebSocket(`${WS_BACKEND}/api/ai/stream`);
      wsRef.current = ws;

      await new Promise((resolve, reject) => {
        ws.onopen = () => {
          ws.send(JSON.stringify({
            api_key:      apiKey,
            model,
            message:      userMessage,
            history,
            scan_context: { results, target, modules },
          }));
        };

        ws.onmessage = (e) => {
          const data = JSON.parse(e.data);
          if (data.type === 'start') {
            setIsStreaming(true);
          } else if (data.type === 'chunk') {
            const chunk = data.text ?? data.content ?? '';
            updateLastMsg(m => ({ ...m, content: m.content + chunk }));
          } else if (data.type === 'done') {
            updateLastMsg(m => ({ ...m, isStreaming: false }));
            ws.close();
            resolve();
          } else if (data.type === 'error') {
            reject(new Error(data.message || data.content || 'Error desconocido'));
          }
        };

        ws.onerror = () => reject(new Error('Error de conexión WebSocket'));
        ws.onclose = (e) => { if (e.code !== 1000) resolve(); };
      });

    } catch (err) {
      updateLastMsg(m => ({ ...m, content: `⚠️ **Error:** ${err.message}`, isError: true, isStreaming: false }));
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      wsRef.current = null;
    }
  }, [apiKey, model, addMsg, updateLastMsg]);

  // ── non-streaming fallback ────────────────────────────────────
  const sendMessageSync = useCallback(async (userMessage, results = [], target = '', modules = []) => {
    if (!apiKey) {
      addMsg('user', userMessage);
      addMsg('assistant', '⚠️ **API Key no configurada**', { isError: true });
      return null;
    }

    setIsLoading(true);
    setError(null);
    abortRef.current = new AbortController();
    addMsg('user', userMessage);

    const currentMsgs = loadCaseMessages(caseIdRef.current);
    const history = currentMsgs.slice(-12).map(m => ({ role: m.role, content: m.content }));

    try {
      const resp = await fetch(`${BACKEND}/api/ai/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key:      apiKey,
          model,
          message:      userMessage,
          history,
          scan_context: { results, target, modules },
        }),
        signal: abortRef.current.signal,
      });

      const data = await resp.json();
      const content = data.response ?? data.content ?? data.message ?? JSON.stringify(data);
      if (!resp.ok) throw new Error(content);

      if (data.usage) setUsage(data.usage);
      return addMsg('assistant', content);

    } catch (err) {
      if (err.name === 'AbortError') return null;
      addMsg('assistant', `⚠️ **Error:** ${err.message}`, { isError: true });
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, model, addMsg]);

  // ── generate report ───────────────────────────────────────────
  const generateReport = useCallback(async (results, target, modules) => {
    if (!apiKey) {
      addMsg('user', 'Genera el informe ejecutivo completo');
      addMsg('assistant', '⚠️ **API Key no configurada**', { isError: true });
      return;
    }

    setIsLoading(true);
    setError(null);
    addMsg('user', '📄 Genera el informe ejecutivo completo de seguridad');
    const placeholder = { id: Date.now() + 1, role: 'assistant', content: '', ts: new Date().toISOString(), isStreaming: true };
    setMessages(prev => [...prev, placeholder]);

    try {
      const resp = await fetch(`${BACKEND}/api/ai/report`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key:      apiKey,
          model,
          scan_context: { results, target, modules },
          results, target, modules,
        }),
      });
      const data = await resp.json();
      const content = data.report ?? data.response ?? data.content ?? 'Sin respuesta';
      if (!resp.ok) throw new Error(content);
      updateLastMsg(m => ({ ...m, content, isStreaming: false }));
    } catch (err) {
      updateLastMsg(m => ({ ...m, content: `⚠️ **Error:** ${err.message}`, isError: true, isStreaming: false }));
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, model, addMsg, updateLastMsg]);

  // ── validate key ──────────────────────────────────────────────
  const validateKey = useCallback(async (key) => {
    try {
      const resp = await fetch(`${BACKEND}/api/ai/validate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key }),
      });
      return await resp.json();
    } catch {
      return { valid: false, error: 'No se pudo conectar con el backend' };
    }
  }, []);

  const quickPrompts = [
    { id: 'vectors',  label: 'Vectores sin cubrir',      prompt: '¿Qué vectores de ataque no fueron probados? Sugiere pruebas adicionales.' },
    { id: 'critical', label: 'Vulnerabilidades críticas', prompt: 'Lista las vulnerabilidades críticas. ¿Cuál debe remediarse primero?' },
    { id: 'improve',  label: 'Plan de mejora',            prompt: 'Crea un plan de mejora con acciones priorizadas y timeline.' },
    { id: 'suricata', label: 'Reglas Suricata/Zeek',      prompt: '¿Qué reglas de Suricata/Zeek ajustar para los ataques que pasaron?' },
    { id: 'partial',  label: 'Analizar PARTIAL',          prompt: 'Explica los resultados PARTIAL y cómo mejorar la defensa.' },
    { id: 'fortinet', label: 'Config Fortinet',           prompt: 'Configuraciones FortiOS específicas para remediar los hallazgos.' },
    { id: 'compare',  label: 'CIS Benchmark',             prompt: 'Compara con CIS Benchmarks. ¿Qué controles fallan?' },
  ];

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setUsage(null);
    if (caseIdRef.current) {
      window.localStorage.removeItem(`np-ai-${caseIdRef.current}`);
    }
  }, []);

  return {
    messages, isLoading, isStreaming, error, usage,
    sendMessage:     streamMessage,
    sendMessageSync,
    generateReport,
    validateKey,
    quickPrompts,
    clearMessages,
    cancelRequest: () => {
      wsRef.current?.close();
      abortRef.current?.abort();
      setIsLoading(false);
      setIsStreaming(false);
    },
  };
}
