import { useState, useCallback, useRef } from 'react';

const BACKEND    = 'http://localhost:8000';
const WS_BACKEND = 'ws://localhost:8000';

export function useAI(apiKey = '') {
  const [messages,    setMessages]    = useState([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [isStreaming, setIsStreaming]  = useState(false);
  const [error,       setError]       = useState(null);
  const [usage,       setUsage]       = useState(null);
  const wsRef    = useRef(null);
  const abortRef = useRef(null);

  const addMsg = (role, content, extra = {}) => {
    const msg = { id: Date.now() + Math.random(), role, content, ts: new Date().toISOString(), ...extra };
    setMessages(prev => [...prev, msg]);
    return msg;
  };

  const updateLastMsg = (updater) => {
    setMessages(prev => {
      const copy = [...prev];
      copy[copy.length - 1] = updater(copy[copy.length - 1]);
      return copy;
    });
  };

  // ── streaming via WebSocket ──────────────────────────────────
  const streamMessage = useCallback(async (userMessage, results = [], target = '', modules = [], model = 'llama-3.3-70b-versatile') => {
    if (!apiKey) {
      addMsg('user', userMessage);
      addMsg('assistant', '⚠️ **API Key no configurada**\n\nIntroduce tu API Key de Groq en el panel lateral.\nObtén una gratis en **console.groq.com**', { isError: true });
      return;
    }

    setIsLoading(true);
    setIsStreaming(false);
    setError(null);
    addMsg('user', userMessage);

    const placeholder = { id: Date.now() + 1, role: 'assistant', content: '', ts: new Date().toISOString(), isStreaming: true, model };
    setMessages(prev => [...prev, placeholder]);

    const history = messages.slice(-12).map(m => ({ role: m.role, content: m.content }));

    // Build scan_context as expected by backend
    const scan_context = { target, results, score: null };

    try {
      const ws = new WebSocket(`${WS_BACKEND}/api/ai/stream`);
      wsRef.current = ws;

      await new Promise((resolve, reject) => {
        ws.onopen = () => {
          ws.send(JSON.stringify({
            api_key:      apiKey,
            model:        model,
            message:      userMessage,
            history:      history,
            scan_context: scan_context,
          }));
        };

        ws.onmessage = (e) => {
          const data = JSON.parse(e.data);
          if (data.type === 'start') {
            setIsStreaming(true);
          } else if (data.type === 'chunk') {
            // backend sends data.text (not data.content)
            updateLastMsg(m => ({ ...m, content: m.content + (data.text || '') }));
          } else if (data.type === 'done') {
            updateLastMsg(m => ({ ...m, isStreaming: false, model: data.model || model }));
            ws.close();
            resolve();
          } else if (data.type === 'error') {
            reject(new Error(data.message || data.content || 'Error desconocido'));
          }
        };

        ws.onerror = () => reject(new Error('Error de conexión WebSocket'));
        ws.onclose = (e) => { if (e.code !== 1000 && e.code !== 1005) reject(new Error('Conexión cerrada inesperadamente')); };
      });

    } catch (err) {
      updateLastMsg(m => ({ ...m, content: `⚠️ **Error:** ${err.message}`, isError: true, isStreaming: false }));
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      wsRef.current = null;
    }
  }, [messages, apiKey]);

  // ── generate full report ─────────────────────────────────────
  const generateReport = useCallback(async (results, target, modules, model = 'llama-3.3-70b-versatile') => {
    if (!apiKey) {
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key:      apiKey,
          model:        model,
          message:      'generate report',
          scan_context: { target, results },
        }),
      });
      const data = await resp.json();
      // backend returns data.report
      const content = data.report || data.response || data.content || data.error || 'Sin respuesta';
      updateLastMsg(m => ({ ...m, content, isStreaming: false }));
    } catch (err) {
      updateLastMsg(m => ({ ...m, content: `⚠️ **Error:** ${err.message}`, isError: true, isStreaming: false }));
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey]);

  // ── validate API key ─────────────────────────────────────────
  const validateKey = useCallback(async (key) => {
    try {
      const resp = await fetch(`${BACKEND}/api/ai/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key }),
      });
      return await resp.json();
    } catch {
      return { valid: false, error: 'No se pudo conectar con el backend' };
    }
  }, []);

  const quickPrompts = [
    { id: 'vectors',  label: 'Vectores sin cubrir',      prompt: 'Qué vectores de ataque no fueron probados? Sugiere pruebas adicionales.' },
    { id: 'critical', label: 'Vulnerabilidades críticas', prompt: 'Lista las vulnerabilidades críticas. Cuál debe remediarse primero?' },
    { id: 'improve',  label: 'Plan de mejora',            prompt: 'Crea un plan de mejora con acciones priorizadas y timeline.' },
    { id: 'suricata', label: 'Reglas Suricata',           prompt: 'Qué reglas de Suricata ajustar para los ataques que pasaron?' },
    { id: 'partial',  label: 'Analizar PARTIAL',          prompt: 'Explica los resultados PARTIAL y cómo mejorar la defensa.' },
    { id: 'fortinet', label: 'Config Fortinet',           prompt: 'Configuraciones FortiOS específicas para remediar los hallazgos.' },
    { id: 'compare',  label: 'CIS Benchmark',             prompt: 'Compara con CIS Benchmarks. Qué controles fallan?' },
  ];

  return {
    messages, isLoading, isStreaming, error, usage,
    sendMessage:     streamMessage,
    generateReport,
    validateKey,
    quickPrompts,
    clearMessages: () => { setMessages([]); setError(null); setUsage(null); },
    cancelRequest: () => {
      wsRef.current?.close();
      abortRef.current?.abort();
      setIsLoading(false);
      setIsStreaming(false);
    },
  };
}
