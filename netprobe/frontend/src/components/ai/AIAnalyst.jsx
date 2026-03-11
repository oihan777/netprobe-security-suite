import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Loader2, Trash2, FileText, StopCircle, CheckCircle2, AlertCircle, Cpu, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button.jsx';

const MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', badge: 'Recomendado ⚡' },
  { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B',  badge: 'Ultrarrápido' },
  { id: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B',  badge: 'Contexto largo' },
  { id: 'gemma2-9b-it',            label: 'Gemma 2 9B',    badge: 'Google' },
];

// ── Markdown renderer (sin dependencias extra) ─────────────────
function MdLine({ text }) {
  // bold, inline code
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <span>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**'))
          return <strong key={i} className="text-white font-semibold">{p.slice(2,-2)}</strong>;
        if (p.startsWith('`') && p.endsWith('`'))
          return <code key={i} className="bg-[rgba(102,192,244,0.15)] px-1 py-0.5 rounded text-[#66c0f4] font-mono text-[11px]">{p.slice(1,-1)}</code>;
        return p;
      })}
    </span>
  );
}

function MdContent({ content }) {
  const lines = content.split('\n');
  const result = [];
  let inCode = false, codeLang = '', codeLines = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('```')) {
      if (!inCode) { inCode = true; codeLang = l.slice(3); codeLines = []; }
      else {
        result.push(
          <div key={i} className="my-2 rounded-lg overflow-hidden border border-[rgba(102,192,244,0.15)]">
            {codeLang && <div className="px-3 py-1 text-[9px] text-[rgba(143,152,160,0.9)] bg-[rgba(42,71,94,0.4)] font-mono uppercase">{codeLang}</div>}
            <pre className="p-3 text-[11px] font-mono text-[#c6d4df] overflow-x-auto bg-[rgba(23,26,33,0.4)] leading-relaxed whitespace-pre-wrap">
              {codeLines.join('\n')}
            </pre>
          </div>
        );
        inCode = false; codeLines = [];
      }
      continue;
    }
    if (inCode) { codeLines.push(l); continue; }

    if (l.startsWith('# '))
      result.push(<h1 key={i} className="text-base font-bold text-white mt-3 mb-1">{l.slice(2)}</h1>);
    else if (l.startsWith('## '))
      result.push(<h2 key={i} className="text-sm font-bold text-[#66c0f4] mt-3 mb-1 border-b border-[rgba(102,192,244,0.2)] pb-1">{l.slice(3)}</h2>);
    else if (l.startsWith('### '))
      result.push(<h3 key={i} className="text-xs font-semibold text-[rgba(255,255,255,0.8)] mt-2 mb-0.5">{l.slice(4)}</h3>);
    else if (l.startsWith('- ') || l.startsWith('* '))
      result.push(<li key={i} className="ml-3 text-xs text-[rgba(255,255,255,0.75)] list-disc list-inside leading-relaxed"><MdLine text={l.slice(2)}/></li>);
    else if (/^\d+\. /.test(l))
      result.push(<li key={i} className="ml-3 text-xs text-[rgba(255,255,255,0.75)] list-decimal list-inside leading-relaxed"><MdLine text={l.replace(/^\d+\. /,'')}/></li>);
    else if (l.startsWith('> '))
      result.push(<blockquote key={i} className="border-l-2 border-[#66c0f4] pl-3 my-1 text-xs text-[rgba(198,212,223,0.8)] italic">{l.slice(2)}</blockquote>);
    else if (l.trim() === '')
      result.push(<div key={i} className="h-1.5"/>);
    else
      result.push(<p key={i} className="text-xs text-[rgba(255,255,255,0.78)] leading-relaxed"><MdLine text={l}/></p>);
  }
  return <div className="space-y-0.5">{result}</div>;
}

// ── Streaming cursor ───────────────────────────────────────────
function Cursor() {
  return <span className="inline-block w-[2px] h-3 bg-[#57cbde] ml-0.5 animate-pulse align-middle"/>;
}

// ── Single message bubble ──────────────────────────────────────
function ChatBubble({ msg }) {
  const isBot = msg.role === 'assistant';
  return (
    <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.2 }}
      className={`flex gap-2.5 ${isBot ? '' : 'flex-row-reverse'}`}>
      <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs
        ${isBot ? 'bg-[rgba(102,192,244,0.15)] border border-[rgba(102,192,244,0.3)]' 
                : 'bg-[rgba(87,203,222,0.1)] border border-[rgba(87,203,222,0.2)]'}`}>
        {isBot ? '🤖' : '👤'}
      </div>
      <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm
        ${isBot
          ? msg.isError
            ? 'bg-[rgba(201,64,64,0.08)] border border-[rgba(201,64,64,0.2)]'
            : 'bg-[rgba(42,71,94,0.4)] border border-[rgba(102,192,244,0.1)]'
          : 'bg-[rgba(87,203,222,0.07)] border border-[rgba(87,203,222,0.18)]'
        }`}>
        {isBot
          ? <><MdContent content={msg.content || ''}/>{msg.isStreaming && <Cursor/>}</>
          : <p className="text-xs text-[rgba(255,255,255,0.85)] leading-relaxed">{msg.content}</p>
        }
        <div className="text-[9px] text-[rgba(255,255,255,0.18)] mt-1.5">
          {new Date(msg.ts).toLocaleTimeString('es-ES')}
        </div>
      </div>
    </motion.div>
  );
}

// ── Model selector ─────────────────────────────────────────────
function ModelSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = MODELS.find(m => m.id === value) || MODELS[0];
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[rgba(102,192,244,0.07)] border border-[rgba(102,192,244,0.15)] text-[10px] text-[#c6d4df] hover:text-white transition-colors">
        <Cpu className="w-3 h-3"/>
        {current.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}/>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}
            className="absolute top-full mt-1 left-0 z-50 bg-[#1e2d3d] border border-[rgba(143,152,160,0.4)] rounded-xl overflow-hidden shadow-xl min-w-[180px]">
            {MODELS.map(m => (
              <button key={m.id} onClick={() => { onChange(m.id); setOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[rgba(102,192,244,0.08)] transition-colors
                  ${m.id === value ? 'text-[#66c0f4]' : 'text-[#c6d4df]'}`}>
                <span className="text-xs font-medium">{m.label}</span>
                <span className="text-[9px] text-[rgba(198,212,223,0.6)]">{m.badge}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export function AIAnalyst({ messages, isLoading, isStreaming, usage, error,
  onSendMessage, onGenerateReport, onCancel, quickPrompts, onClear,
  apiKey, onValidateKey }) {

  const [input, setInput]       = useState('');
  const [model, setModel]       = useState('llama-3.3-70b-versatile');
  const [keyStatus, setKeyStatus] = useState(null); // null | 'checking' | 'valid' | 'invalid'
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const send = (text) => {
    if (!text?.trim() || isLoading) return;
    onSendMessage(text.trim(), model);
    setInput('');
  };

  const handleValidate = async () => {
    if (!apiKey) return;
    setKeyStatus('checking');
    const res = await onValidateKey(apiKey);
    setKeyStatus(res.valid ? 'valid' : 'invalid');
    setTimeout(() => setKeyStatus(null), 3000);
  };

  return (
    <div className="h-full flex flex-col">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(102,192,244,0.1)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[rgba(102,192,244,0.15)] border border-[rgba(102,192,244,0.3)] flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-[#66c0f4]"/>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">IA Analyst</h3>
            <p className="text-[10px] text-[rgba(143,152,160,0.9)]">Groq · Llama 3.3 · Streaming</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModelSelector value={model} onChange={setModel}/>
          {isLoading
            ? <Button onClick={onCancel} variant="danger" size="sm" icon={<StopCircle className="w-3 h-3"/>}>Stop</Button>
            : <Button onClick={onGenerateReport} variant="secondary" size="sm" icon={<FileText className="w-3 h-3"/>}>Informe</Button>
          }
          <Button onClick={onClear} variant="ghost" size="sm" icon={<Trash2 className="w-3 h-3"/>}/>
        </div>
      </div>

      {/* ── API key status bar ──────────────────────────────── */}
      {apiKey && (
        <div className="px-4 py-1.5 border-b border-[rgba(102,192,244,0.07)] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${keyStatus === 'valid' ? 'bg-[#57cbde]' : keyStatus === 'invalid' ? 'bg-[#c94040]' : 'bg-[rgba(143,152,160,0.6)]'}`}/>
            <span className="text-[10px] text-[rgba(143,152,160,0.9)]">
              {keyStatus === 'checking' ? 'Verificando…' : keyStatus === 'valid' ? 'API Key válida ✓' : keyStatus === 'invalid' ? 'API Key inválida ✗' : `API Key: ${apiKey.slice(0,8)}…`}
            </span>
          </div>
          <button onClick={handleValidate} disabled={keyStatus === 'checking'}
            className="text-[9px] text-[rgba(143,152,160,0.9)] hover:text-white transition-colors disabled:opacity-40">
            Verificar
          </button>
        </div>
      )}

      {/* ── Token usage ────────────────────────────────────── */}
      {usage && (
        <div className="px-4 py-1 border-b border-[rgba(42,71,94,0.4)] flex gap-4">
          {[['Prompt', usage.prompt_tokens], ['Respuesta', usage.completion_tokens], ['Total', usage.total_tokens]].map(([k,v]) => (
            <div key={k} className="flex items-center gap-1">
              <span className="text-[9px] text-[rgba(143,152,160,0.7)]">{k}:</span>
              <span className="text-[9px] text-[rgba(198,212,223,0.8)] font-mono">{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Messages ───────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {!messages.length && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[rgba(102,192,244,0.08)] border border-[rgba(102,192,244,0.15)] flex items-center justify-center mb-4 text-3xl">🤖</div>
            <h3 className="text-white font-semibold mb-1.5">Analista de Seguridad IA</h3>
            <p className="text-xs text-[rgba(198,212,223,0.7)] max-w-xs leading-relaxed">
              Ejecuta un scan y pregúntame sobre los resultados, vulnerabilidades o cómo mejorar tu postura de seguridad.
            </p>
            {!apiKey && (
              <div className="mt-4 px-3 py-2 rounded-lg bg-[rgba(228,105,42,0.08)] border border-[rgba(228,105,42,0.2)]">
                <p className="text-[10px] text-[#e4692a]">⚠️ Configura tu API Key de Groq en el panel lateral · console.groq.com</p>
              </div>
            )}
            {apiKey && (
              <div className="mt-4 px-3 py-2 rounded-lg bg-[rgba(87,203,222,0.06)] border border-[rgba(87,203,222,0.15)]">
                <p className="text-[10px] text-[#66c0f4]">✓ API Key configurada · Modelo: {model}</p>
              </div>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map(m => <ChatBubble key={m.id} msg={m}/>)}
        </AnimatePresence>

        {isLoading && !isStreaming && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[rgba(102,192,244,0.15)] border border-[rgba(102,192,244,0.3)] flex items-center justify-center">🤖</div>
            <div className="bg-[rgba(42,71,94,0.4)] border border-[rgba(102,192,244,0.1)] rounded-xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-[#66c0f4] animate-spin"/>
              <span className="text-xs text-[rgba(198,212,223,0.7)]">Conectando con Groq…</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Quick prompts ──────────────────────────────────── */}
      <div className="px-3 py-2 border-t border-[rgba(102,192,244,0.07)] flex flex-wrap gap-1.5">
        {quickPrompts.map(qp => (
          <button key={qp.id} onClick={() => send(qp.prompt)} disabled={isLoading}
            className="px-2.5 py-1 text-[10px] rounded-full bg-[rgba(42,71,94,0.4)] border border-[rgba(255,255,255,0.09)] text-[rgba(255,255,255,0.45)] hover:text-white hover:bg-[rgba(102,192,244,0.1)] hover:border-[rgba(143,152,160,0.6)] transition-all disabled:opacity-30 disabled:cursor-not-allowed">
            {qp.label}
          </button>
        ))}
      </div>

      {/* ── Input ──────────────────────────────────────────── */}
      <div className="p-3 border-t border-[rgba(102,192,244,0.1)] flex gap-2 items-end">
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Pregunta sobre los resultados… (Enter para enviar, Shift+Enter nueva línea)"
          rows={1}
          className="flex-1 bg-[rgba(102,192,244,0.07)] border border-[rgba(102,192,244,0.15)] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-[rgba(255,255,255,0.22)] focus:outline-none focus:border-[rgba(102,192,244,0.4)] transition-colors resize-none"
          style={{ minHeight: '38px', maxHeight: '100px' }}
        />
        <Button onClick={() => send(input)} variant="primary" size="sm"
          disabled={!input.trim() || isLoading}
          icon={isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Send className="w-3.5 h-3.5"/>}
        />
      </div>
    </div>
  );
}
