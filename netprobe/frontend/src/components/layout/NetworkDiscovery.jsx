import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, Wifi, Server, Monitor, Shield, Globe,
  Smartphone, Cpu, Database, Search, X, ChevronDown, Loader2
} from 'lucide-react';

const DEVICE_ICONS = {
  'linux-server':    <Server className="w-3.5 h-3.5 text-[#66c0f4]"/>,
  'windows-server':  <Server className="w-3.5 h-3.5 text-[#66c0f4]"/>,
  'windows':         <Monitor className="w-3.5 h-3.5 text-[#66c0f4]"/>,
  'web-server':      <Globe className="w-3.5 h-3.5 text-[#e4692a]"/>,
  'firewall-router': <Shield className="w-3.5 h-3.5 text-[#c94040]"/>,
  'dns-server':      <Globe className="w-3.5 h-3.5 text-[#9b59b6]"/>,
  'database':        <Database className="w-3.5 h-3.5 text-[#c8a951]"/>,
  'mobile':          <Smartphone className="w-3.5 h-3.5 text-[#5ba32b]"/>,
  'iot':             <Cpu className="w-3.5 h-3.5 text-[#66c0f4]"/>,
  'host':            <Monitor className="w-3.5 h-3.5 text-[rgba(198,212,223,0.7)]"/>,
  'unknown':         <Wifi className="w-3.5 h-3.5 text-[rgba(143,152,160,0.9)]"/>,
};

const DEVICE_LABELS = {
  'linux-server':    'Linux Server',
  'windows-server':  'Windows Server',
  'windows':         'Windows',
  'web-server':      'Web Server',
  'firewall-router': 'Firewall/Router',
  'dns-server':      'DNS Server',
  'database':        'Database',
  'mobile':          'Móvil',
  'iot':             'IoT',
  'host':            'Host',
  'unknown':         'Desconocido',
};

function HostCard({ host, onSelect, selected }) {
  const icon = DEVICE_ICONS[host.device_type] || DEVICE_ICONS.unknown;
  const label = DEVICE_LABELS[host.device_type] || host.device_type;
  const isSelected = selected === host.ip;

  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => onSelect(host.ip)}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all
        ${isSelected
          ? 'bg-[rgba(87,203,222,0.12)] border border-[rgba(87,203,222,0.3)]'
          : 'bg-[rgba(42,71,94,0.3)] border border-[rgba(102,192,244,0.1)] hover:bg-[rgba(102,192,244,0.08)] hover:border-[rgba(143,152,160,0.5)]'
        }`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
        ${isSelected ? 'bg-[rgba(87,203,222,0.15)]' : 'bg-[rgba(102,192,244,0.08)]'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-mono font-semibold ${isSelected ? 'text-[#66c0f4]' : 'text-white'}`}>
            {host.ip}
          </span>
          {host.latency && (
            <span className="text-[9px] text-[rgba(143,152,160,0.9)] font-mono">{host.latency}ms</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-[rgba(198,212,223,0.7)]">{label}</span>
          {host.hostname && (
            <span className="text-[9px] text-[rgba(143,152,160,0.7)] truncate max-w-[100px]">{host.hostname}</span>
          )}
        </div>
        {host.open_ports?.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {host.open_ports.slice(0, 5).map(p => (
              <span key={p.port} className="text-[9px] px-1 py-0.5 rounded bg-[rgba(102,192,244,0.08)] text-[rgba(198,212,223,0.7)] font-mono">
                {p.port}/{p.service}
              </span>
            ))}
            {host.open_ports.length > 5 && (
              <span className="text-[9px] text-[rgba(143,152,160,0.7)]">+{host.open_ports.length - 5}</span>
            )}
          </div>
        )}
      </div>
      {host.vendor && (
        <span className="text-[9px] text-[rgba(143,152,160,0.6)] text-right flex-shrink-0 max-w-[60px] leading-tight">{host.vendor}</span>
      )}
    </motion.button>
  );
}

export function NetworkDiscovery({ onSelectTarget, currentTarget, caseId = null, onHostsChange = null }) {
  const [open, setOpen] = useState(false);
  const [networks, setNetworks] = useState([]);
  const [selectedNet, setSelectedNet] = useState('');
  const [scanning, setScanning] = useState(false);
  const [hosts, setHosts] = useState(() => {
    try {
      const key = caseId ? `np-hosts-${caseId}` : 'np-hosts';
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch { return []; }
  });
  const [progress, setProgress] = useState(0);
  const [method, setMethod] = useState('nmap');
  const [error, setError] = useState('');
  const wsRef = useRef(null);

  // When caseId changes, load hosts for that case
  useEffect(() => {
    try {
      const key = caseId ? `np-hosts-${caseId}` : 'np-hosts';
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      setHosts(saved);
      if (onHostsChange) onHostsChange(saved);
    } catch {}
  }, [caseId]);

  // Load networks on open
  useEffect(() => {
    if (open && networks.length === 0) {
      fetch('http://localhost:8000/api/discovery/networks')
        .then(r => r.json())
        .then(data => {
          setNetworks(data.networks || []);
          if (data.networks?.length > 0) setSelectedNet(data.networks[0].cidr);
        })
        .catch(() => setError('No se pudo conectar con el backend'));
    }
  }, [open]);

  const startScan = () => {
    if (!selectedNet || scanning) return;
    setScanning(true);
    setHosts([]);
    try {
      const key = caseId ? `np-hosts-${caseId}` : 'np-hosts';
      localStorage.removeItem(key);
    } catch {}
    if (onHostsChange) onHostsChange([]);
    setProgress(0);
    setError('');

    const ws = new WebSocket('ws://localhost:8000/api/discovery/scan');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ cidr: selectedNet, method }));
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'host') {
        setHosts(prev => {
          const next = [...prev, data.host];
          try {
            const key = caseId ? `np-hosts-${caseId}` : 'np-hosts';
            localStorage.setItem(key, JSON.stringify(next));
          } catch {}
          if (onHostsChange) onHostsChange(next);
          return next;
        });
        setProgress(data.progress);
      } else if (data.type === 'done') {
        setScanning(false);
        setProgress(100);
      } else if (data.type === 'error') {
        setError(data.message);
        setScanning(false);
      }
    };

    ws.onerror = () => { setError('Error de conexión'); setScanning(false); };
    ws.onclose = () => setScanning(false);
  };

  const stopScan = () => {
    wsRef.current?.close();
    setScanning(false);
  };

  const handleSelect = (ip) => {
    onSelectTarget(ip);
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger button */}
      <button onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all
          ${open
            ? 'bg-[rgba(87,203,222,0.08)] border-[rgba(87,203,222,0.3)] text-[#66c0f4]'
            : 'bg-[rgba(42,71,94,0.4)] border-[rgba(102,192,244,0.15)] text-[rgba(198,212,223,0.8)] hover:text-white hover:border-[rgba(143,152,160,0.6)]'
          }`}>
        <Radar className="w-3.5 h-3.5 flex-shrink-0"/>
        <span className="flex-1 text-left">Descubrir red</span>
        {hosts.length > 0 && !scanning && (
          <span className="text-[10px] bg-[rgba(87,203,222,0.15)] text-[#66c0f4] px-1.5 py-0.5 rounded-full font-mono">
            {hosts.length}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}/>
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1 left-0 right-0 z-50 bg-[#111] border border-[rgba(102,192,244,0.15)] rounded-xl shadow-2xl overflow-hidden"
            style={{ maxHeight: '420px' }}>

            {/* Header */}
            <div className="px-3 py-2.5 border-b border-[rgba(102,192,244,0.1)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radar className="w-3.5 h-3.5 text-[#66c0f4]"/>
                <span className="text-xs font-semibold text-white">Descubrimiento de Red</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-[rgba(143,152,160,0.9)] hover:text-white">
                <X className="w-3.5 h-3.5"/>
              </button>
            </div>

            <div className="p-3 space-y-2.5">
              {/* Network selector */}
              {networks.length > 0 ? (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-[rgba(198,212,223,0.7)] uppercase tracking-wider">Red</label>
                  <select value={selectedNet} onChange={e => setSelectedNet(e.target.value)}
                    className="w-full bg-[rgba(102,192,244,0.08)] border border-[rgba(102,192,244,0.15)] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[rgba(87,203,222,0.4)]">
                    {networks.map(n => (
                      <option key={n.cidr} value={n.cidr} style={{ background: '#111' }}>
                        {n.cidr} — {n.interface} ({n.local_ip})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-xs text-[rgba(143,152,160,0.9)] text-center py-1">
                  {error || 'Cargando interfaces...'}
                </div>
              )}

              {/* Method + scan button */}
              <div className="flex gap-2">
                <select value={method} onChange={e => setMethod(e.target.value)}
                  className="flex-1 bg-[rgba(102,192,244,0.08)] border border-[rgba(102,192,244,0.15)] rounded-lg px-2 py-1.5 text-[10px] text-[#c6d4df] focus:outline-none">
                  <option value="nmap" style={{ background: '#111' }}>nmap -sn (rápido)</option>
                  <option value="ping" style={{ background: '#111' }}>ping sweep</option>
                  <option value="arp"  style={{ background: '#111' }}>arp-scan (L2)</option>
                </select>
                {scanning ? (
                  <button onClick={stopScan}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,64,64,0.15)] border border-[rgba(201,64,64,0.3)] text-[#c94040] text-xs hover:bg-[rgba(201,64,64,0.2)] transition-all">
                    <X className="w-3 h-3"/> Stop
                  </button>
                ) : (
                  <button onClick={startScan} disabled={!selectedNet}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(87,203,222,0.12)] border border-[rgba(87,203,222,0.3)] text-[#66c0f4] text-xs hover:bg-[rgba(87,203,222,0.18)] transition-all disabled:opacity-40">
                    <Search className="w-3 h-3"/> Escanear
                  </button>
                )}
              </div>

              {/* Progress */}
              {scanning && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 text-[#66c0f4] animate-spin"/>
                    <span className="text-[10px] text-[#66c0f4]">
                      Escaneando {selectedNet}... {hosts.length} hosts encontrados
                    </span>
                  </div>
                  <div className="h-1 bg-[rgba(102,192,244,0.08)] rounded-full overflow-hidden">
                    <motion.div className="h-full bg-[#57cbde] rounded-full"
                      animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }}/>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-[10px] text-[#c94040]">⚠️ {error}</p>
              )}
            </div>

            {/* Host list */}
            {hosts.length > 0 && (
              <div className="border-t border-[rgba(102,192,244,0.1)]">
                <div className="px-3 py-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-[rgba(198,212,223,0.7)] uppercase tracking-wider">
                    {hosts.length} hosts activos — click para seleccionar
                  </span>
                </div>
                <div className="px-3 pb-3 space-y-1.5 overflow-y-auto" style={{ maxHeight: '220px' }}>
                  {hosts.map(host => (
                    <HostCard key={host.ip} host={host}
                      onSelect={handleSelect} selected={currentTarget}/>
                  ))}
                </div>
              </div>
            )}

            {!scanning && hosts.length === 0 && networks.length > 0 && (
              <div className="px-3 pb-3 text-center">
                <p className="text-[10px] text-[rgba(143,152,160,0.7)]">
                  Pulsa "Escanear" para descubrir hosts en la red
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
