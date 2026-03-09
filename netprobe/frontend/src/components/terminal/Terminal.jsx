import { useRef, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal as TermIcon, Download, Trash2, Send, X, Copy, Check, Cpu, Zap } from 'lucide-react';

const LOG_STYLES = {
  MODULE:  { color: '#00ff88', prefix: '━ ' },
  CMD:     { color: '#ffd60a', prefix: '$ ' },
  RAW:     { color: '#c8c8d8', prefix: ''   },
  RESULT:  { color: '#0a84ff', prefix: '◆ ' },
  WARN:    { color: '#ff9f0a', prefix: '⚠ ' },
  ERROR:   { color: '#ff453a', prefix: '✖ ' },
  SYSTEM:  { color: '#505060', prefix: '· ' },
  INFO:    { color: '#ebebf5', prefix: '  ' },
};

function LogLine({ log }) {
  const style = LOG_STYLES[log.type] || LOG_STYLES.INFO;
  const ts = new Date(log.timestamp).toLocaleTimeString('es-ES', { hour12: false });

  if (log.type === 'RAW') {
    return (
      <div className="my-0.5 pl-14">
        {String(log.message).split('\n').map((line, i) => (
          <div key={i} className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all"
            style={{ color: '#c8c8d8', opacity: line.trim() ? 0.8 : 0 }}>
            {line || '\u00A0'}
          </div>
        ))}
      </div>
    );
  }

  if (log.type === 'CMD') {
    return (
      <div className="flex items-start gap-2 my-1 mx-1 px-2.5 py-1.5 rounded-lg bg-[rgba(255,214,10,0.07)] border border-[rgba(255,214,10,0.15)]">
        <span className="text-[9px] text-[rgba(255,255,255,0.2)] font-mono flex-shrink-0 mt-0.5 w-12 text-right select-none">{ts}</span>
        <span className="font-mono text-[11px] font-bold text-[#ffd60a] flex-shrink-0">$</span>
        <span className="font-mono text-[11px] text-[#ffd60a] break-all whitespace-pre-wrap">{log.message}</span>
      </div>
    );
  }

  if (log.type === 'RESULT') {
    return (
      <div className="flex items-start gap-2 my-1 mx-1 px-2.5 py-1.5 rounded-lg bg-[rgba(10,132,255,0.07)] border border-[rgba(10,132,255,0.15)]">
        <span className="text-[9px] text-[rgba(255,255,255,0.2)] font-mono flex-shrink-0 mt-0.5 w-12 text-right select-none">{ts}</span>
        <span className="font-mono text-[11px] text-[#0a84ff] break-all whitespace-pre-wrap">{log.message}</span>
      </div>
    );
  }

  if (log.type === 'MODULE') {
    return (
      <div className="flex items-center gap-2 my-2.5 opacity-50">
        <div className="h-px flex-1 bg-[rgba(0,255,136,0.2)]" />
        <span className="font-mono text-[10px] font-semibold text-[#00ff88]">{log.message}</span>
        <div className="h-px flex-1 bg-[rgba(0,255,136,0.2)]" />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 font-mono text-[11px] leading-relaxed px-1">
      <span className="text-[9px] text-[rgba(255,255,255,0.18)] flex-shrink-0 mt-0.5 w-12 text-right select-none">{ts}</span>
      <span className="flex-shrink-0 opacity-50 w-3" style={{ color: style.color }}>{style.prefix}</span>
      <span className="break-all whitespace-pre-wrap" style={{ color: style.color }}>{log.message}</span>
    </div>
  );
}

// ── Command panel ─────────────────────────────────────────────────
const QUICK_CMDS = [
  { label: 'ping -c 4',        cmd: 'ping -c 4 TARGET',                     icon: '🏓' },
  { label: 'nmap -sV',         cmd: 'nmap -sV -T4 --min-rate 1000 TARGET',  icon: '🔍' },
  { label: 'nmap top ports',   cmd: 'nmap -sS -T4 --top-ports 1000 TARGET', icon: '📡' },
  { label: 'nmap vuln',        cmd: 'nmap --script vuln -T4 TARGET',        icon: '🛡️' },
  { label: 'curl headers',     cmd: 'curl -sI http://TARGET',               icon: '🌐' },
  { label: 'whois',            cmd: 'whois TARGET',                         icon: '📋' },
  { label: 'traceroute',       cmd: 'traceroute TARGET',                    icon: '🗺️' },
  { label: 'nmap OS detect',   cmd: 'nmap -O -T4 TARGET',                   icon: '💻' },
];

function CommandPanel({ onRun, onClose, results }) {
  const [input,   setInput]   = useState('');
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [copied,  setCopied]  = useState(null);
  const inputRef = useRef(null);

  const aiCmds = useMemo(() => {
    const seen = new Set();
    const cmds = [];
    (results || []).forEach(r => {
      (r.commands || []).forEach(c => {
        if (c && !seen.has(c)) { seen.add(c); cmds.push(c); }
      });
    });
    return cmds.slice(0, 10);
  }, [results]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    const cmd = input.trim();
    if (!cmd) return;
    onRun(cmd);
    setHistory(h => [cmd, ...h.slice(0, 49)]);
    setInput(''); setHistIdx(-1);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter')     { submit(); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); const i = Math.min(histIdx+1, history.length-1); setHistIdx(i); setInput(history[i]||''); }
    if (e.key === 'ArrowDown') { e.preventDefault(); const i = Math.max(histIdx-1,-1); setHistIdx(i); setInput(i===-1?'':history[i]); }
    if (e.key === 'Escape')    { onClose(); }
  };

  const copy = (cmd) => {
    navigator.clipboard.writeText(cmd);
    setCopied(cmd);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="w-68 flex-shrink-0 flex flex-col border-l border-[rgba(255,255,255,0.08)]"
      style={{ background: '#0f0f0f', width: '272px' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[rgba(255,255,255,0.07)] flex-shrink-0">
        <Zap className="w-3.5 h-3.5 text-[#ffd60a]" />
        <span className="text-xs font-semibold text-white flex-1">Ejecutar comando</span>
        <button onClick={onClose} className="text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-b border-[rgba(255,255,255,0.06)] flex-shrink-0">
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-[rgba(255,214,10,0.3)] bg-[rgba(255,214,10,0.05)] focus-within:border-[rgba(255,214,10,0.6)] transition-colors">
          <span className="text-[#ffd60a] font-mono text-xs font-bold flex-shrink-0">$</span>
          <input ref={inputRef} value={input}
            onChange={e => { setInput(e.target.value); setHistIdx(-1); }}
            onKeyDown={handleKey}
            placeholder="comando aquí..."
            className="flex-1 bg-transparent text-[11px] font-mono text-white outline-none placeholder-[rgba(255,255,255,0.2)] min-w-0" />
          <button onClick={submit} disabled={!input.trim()}
            className="flex-shrink-0 p-1 rounded text-[#ffd60a] disabled:opacity-30 hover:bg-[rgba(255,214,10,0.15)] transition-colors">
            <Send className="w-3 h-3" />
          </button>
        </div>
        <p className="text-[9px] text-[rgba(255,255,255,0.18)] mt-1.5">↑↓ historial  ·  Enter ejecutar  ·  Esc cerrar</p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* Quick commands */}
        <Section title="Comandos rápidos">
          {QUICK_CMDS.map(({ label, cmd, icon }) => (
            <CmdRow key={label} icon={icon} label={label} cmd={cmd}
              onUse={() => setInput(cmd)} onRun={() => onRun(cmd)} onCopy={() => copy(cmd)}
              isCopied={copied === cmd} />
          ))}
        </Section>

        {/* AI commands from scan */}
        {aiCmds.length > 0 && (
          <Section title="Del análisis anterior" color="rgba(191,90,242,0.7)" icon={<Cpu className="w-2.5 h-2.5" />}>
            {aiCmds.map((cmd, i) => (
              <CmdRow key={i} icon="🤖" label={cmd} cmd={cmd}
                onUse={() => setInput(cmd)} onRun={() => onRun(cmd)} onCopy={() => copy(cmd)}
                isCopied={copied === cmd} monoLabel />
            ))}
          </Section>
        )}

        {/* History */}
        {history.length > 0 && (
          <Section title="Historial reciente">
            {history.slice(0, 8).map((cmd, i) => (
              <button key={i} onClick={() => setInput(cmd)}
                className="w-full text-left px-2 py-1.5 rounded text-[10px] font-mono text-[rgba(255,255,255,0.35)] hover:text-white hover:bg-[rgba(255,255,255,0.04)] transition-all truncate">
                {cmd}
              </button>
            ))}
          </Section>
        )}
      </div>
    </motion.div>
  );
}

function Section({ title, color = 'rgba(255,255,255,0.3)', icon, children }) {
  return (
    <div className="px-3 py-2.5 border-b border-[rgba(255,255,255,0.05)]">
      <p className="text-[9px] uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5" style={{ color }}>
        {icon}{title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function CmdRow({ icon, label, cmd, onUse, onRun, onCopy, isCopied, monoLabel = false }) {
  return (
    <div className="group flex items-center gap-2 px-1.5 py-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition-colors cursor-pointer" onClick={onUse}>
      <span className="text-sm flex-shrink-0">{icon}</span>
      <span className={`flex-1 text-[10px] text-[rgba(255,255,255,0.45)] group-hover:text-white transition-colors truncate ${monoLabel ? 'font-mono' : ''}`}>
        {label}
      </span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={e => { e.stopPropagation(); onCopy(); }}
          className="p-1 rounded text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
          {isCopied ? <Check className="w-2.5 h-2.5 text-[#00ff88]" /> : <Copy className="w-2.5 h-2.5" />}
        </button>
        <button onClick={e => { e.stopPropagation(); onRun(); }}
          className="p-1 rounded text-[rgba(255,255,255,0.3)] hover:text-[#ffd60a] transition-colors">
          <Send className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}

// ── Log pane ──────────────────────────────────────────────────────
function LogPane({ logs }) {
  const ref = useRef(null);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (auto && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs, auto]);

  const onScroll = () => {
    if (!ref.current) return;
    const { scrollTop, scrollHeight, clientHeight } = ref.current;
    setAuto(scrollHeight - scrollTop - clientHeight < 50);
  };

  return (
    <div ref={ref} onScroll={onScroll}
      className="flex-1 overflow-y-auto py-2 space-y-0.5"
      style={{ background: '#080808' }}>
      {!logs.length && (
        <div className="flex flex-col items-center justify-center h-full text-center py-16">
          <TermIcon className="w-7 h-7 text-[rgba(255,255,255,0.07)] mb-3" />
          <p className="text-xs text-[rgba(255,255,255,0.18)]">Sin logs para este módulo</p>
        </div>
      )}
      {logs.map((log, i) => <LogLine key={log.id || i} log={log} />)}
      {!auto && (
        <button onClick={() => { setAuto(true); if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }}
          className="sticky bottom-2 ml-auto mr-3 flex items-center gap-1 px-2 py-1 rounded-full text-[9px] bg-[rgba(0,255,136,0.12)] border border-[rgba(0,255,136,0.3)] text-[#00ff88]">
          ↓ ir al final
        </button>
      )}
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 px-2.5 py-1 rounded-t text-[10px] font-medium transition-all whitespace-nowrap flex-shrink-0 border-b-2"
      style={{
        borderBottomColor: active ? '#00ff88' : 'transparent',
        background:  active ? 'rgba(255,255,255,0.07)' : 'transparent',
        color:       active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.38)',
      }}>
      {children}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export function Terminal({ logs, isRunning, progress, onClear, onRunCommand, results = [] }) {
  const [activeTab,   setActiveTab]   = useState('__ALL__');
  const [showCmd,     setShowCmd]     = useState(false);

  const STATUS_DOT = { BLOCKED:'#30d158', DETECTED:'#ff9f0a', PARTIAL:'#ff6b35', PASSED:'#ff453a', ERROR:'#636366' };

  // Build per-module tabs from log.module field
  const moduleTabs = useMemo(() => {
    const map = new Map();
    logs.forEach(log => {
      if (!log.module || log.module === 'custom') return;
      if (!map.has(log.module)) {
        const r = results.find(x => x.id === log.module);
        map.set(log.module, { id: log.module, name: r?.name || log.module.replace(/_/g,' '), count: 0, status: r?.status || null, hasError: false });
      }
      const e = map.get(log.module);
      e.count++;
      if (log.type === 'ERROR') e.hasError = true;
      const r = results.find(x => x.id === log.module);
      if (r) e.status = r.status;
    });
    return [...map.values()];
  }, [logs, results]);

  const customLogs = useMemo(() => logs.filter(l => l.module === 'custom'), [logs]);

  const visibleLogs = useMemo(() => {
    if (activeTab === '__ALL__')    return logs;
    if (activeTab === '__CUSTOM__') return customLogs;
    return logs.filter(l => l.module === activeTab);
  }, [logs, activeTab, customLogs]);

  // Keep active tab valid
  useEffect(() => {
    if (activeTab !== '__ALL__' && activeTab !== '__CUSTOM__') {
      if (!moduleTabs.find(t => t.id === activeTab)) setActiveTab('__ALL__');
    }
  }, [moduleTabs]);

  const exportLogs = () => {
    const text = visibleLogs.map(l => `[${new Date(l.timestamp).toLocaleTimeString('es-ES')}] [${l.type}] ${l.message}`).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text])), download: `netprobe-${activeTab}-${Date.now()}.txt` });
    a.click();
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#0a0a0a' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(255,255,255,0.07)] flex-shrink-0" style={{ background: '#0f0f0f' }}>
        <div className="flex items-center gap-2">
          <TermIcon className="w-3.5 h-3.5 text-[#00ff88]" />
          <span className="text-xs font-semibold text-white">Terminal</span>
          <span className="text-[9px] text-[rgba(255,255,255,0.25)] font-mono">{logs.length} líneas</span>
          {isRunning && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[rgba(0,255,136,0.1)] border border-[rgba(0,255,136,0.2)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
              <span className="text-[9px] text-[#00ff88] font-mono">{progress.current}/{progress.total}</span>
              {progress.module && <span className="text-[9px] text-[rgba(0,255,136,0.6)] truncate max-w-28">{progress.module}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={exportLogs}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] text-[rgba(255,255,255,0.35)] hover:text-white hover:bg-[rgba(255,255,255,0.05)] transition-all">
            <Download className="w-3 h-3" /> Export
          </button>
          <button onClick={onClear}
            className="p-1 rounded text-[rgba(255,255,255,0.3)] hover:text-[#ff453a] hover:bg-[rgba(255,69,58,0.07)] transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowCmd(p => !p)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
            style={{
              background: showCmd ? 'rgba(255,214,10,0.12)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${showCmd ? 'rgba(255,214,10,0.45)' : 'rgba(255,255,255,0.1)'}`,
              color: showCmd ? '#ffd60a' : 'rgba(255,255,255,0.5)',
            }}>
            <Zap className="w-3 h-3" /> Ejecutar
          </button>
        </div>
      </div>

      {/* Progress */}
      {isRunning && progress.total > 0 && (
        <div className="h-0.5 bg-[rgba(255,255,255,0.05)] flex-shrink-0">
          <motion.div className="h-full bg-[#00ff88]"
            animate={{ width: `${(progress.current / progress.total) * 100}%` }}
            transition={{ duration: 0.4 }} />
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-end gap-0.5 px-2 pt-1 border-b border-[rgba(255,255,255,0.07)] overflow-x-auto flex-shrink-0"
        style={{ background: '#0a0a0a', scrollbarWidth: 'none' }}>

        <TabBtn active={activeTab === '__ALL__'} onClick={() => setActiveTab('__ALL__')}>
          Todos
          <span className="ml-1 text-[9px] px-1 rounded-sm bg-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.4)]">{logs.length}</span>
        </TabBtn>

        {moduleTabs.map(tab => (
          <TabBtn key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.status && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[tab.status] || '#505060' }} />}
            <span className="truncate max-w-24">{tab.name}</span>
            <span className="ml-1 text-[9px] px-1 rounded-sm bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.3)]">{tab.count}</span>
            {tab.hasError && <span className="text-[#ff453a] font-bold">!</span>}
          </TabBtn>
        ))}

        {customLogs.length > 0 && (
          <TabBtn active={activeTab === '__CUSTOM__'} onClick={() => setActiveTab('__CUSTOM__')}>
            <Zap className="w-2.5 h-2.5 text-[#ffd60a]" />
            <span style={{ color: activeTab === '__CUSTOM__' ? '#ffd60a' : undefined }}>Custom</span>
            <span className="ml-1 text-[9px] px-1 rounded-sm bg-[rgba(255,214,10,0.1)] text-[rgba(255,214,10,0.5)]">{customLogs.length}</span>
          </TabBtn>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        <LogPane logs={visibleLogs} />
        <AnimatePresence>
          {showCmd && (
            <CommandPanel
              onRun={cmd => { onRunCommand(cmd); setActiveTab('__CUSTOM__'); }}
              onClose={() => setShowCmd(false)}
              results={results}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
