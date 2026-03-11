import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, Scan, Wifi, Shield, AlertTriangle,
  X, ZoomIn, ZoomOut, Maximize2, Play
} from 'lucide-react';

const API = 'http://localhost:8000';

const RISK_COLOR = {
  CRITICAL: '#c94040',
  HIGH:     '#e4692a',
  MEDIUM:   '#c8a951',
  SAFE:     '#5ba32b',
  UNKNOWN:  '#8f98a0',
};

const DANGEROUS_PORTS = new Set([21,22,23,25,53,135,139,443,445,1433,1521,3306,3389,5432,5900,6379,8080,8443,9200,27017]);
const TYPE_EMOJI = { gateway: '🔀', server: '🖥️', windows: '🪟', linux: '🐧', unknown: '💻' };

function safeStr(v)  { return (v == null || v === '') ? null : String(v); }
function safeArr(v)  { return Array.isArray(v) ? v : []; }
function safeNum(v)  { return typeof v === 'number' && isFinite(v) ? v : null; }

function normalizeHost(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const ip = safeStr(raw.ip);
  if (!ip) return null;
  return {
    ip,
    hostname:    safeStr(raw.hostname),
    os:          safeStr(raw.os),
    mac:         safeStr(raw.mac),
    vendor:      safeStr(raw.vendor),
    device_type: safeStr(raw.device_type),
    latency:     safeNum(raw.latency),
    open_ports:  safeArr(raw.open_ports).filter(p => typeof p === 'number'),
    is_gateway:  Boolean(raw.is_gateway),
    alive:       raw.alive !== false,
    last_score:  safeNum(raw.last_score),
  };
}

function getRisk(host) {
  if (!host || host.alive === false) return 'UNKNOWN';
  const ports = safeArr(host.open_ports);
  if (ports.some(p => DANGEROUS_PORTS.has(p))) return 'HIGH';
  if (ports.length > 6) return 'MEDIUM';
  if (ports.length > 0) return 'SAFE';
  return 'UNKNOWN';
}

function getType(host) {
  if (!host) return 'unknown';
  if (host.is_gateway) return 'gateway';
  const dt = (host.device_type || '').toLowerCase();
  if (dt.includes('router') || dt.includes('firewall')) return 'gateway';
  const os = (host.os || '').toLowerCase();
  if (os.includes('windows')) return 'windows';
  if (os.includes('linux') || os.includes('ubuntu')) return 'linux';
  const ports = safeArr(host.open_ports);
  if (ports.includes(80) || ports.includes(443)) return 'server';
  return 'unknown';
}

// ── Force layout ───────────────────────────────────────────────────
function useForceLayout(nodeIds, edgePairs, W, H) {
  const [pos, setPos] = useState({});
  const frameRef = useRef(null);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (!nodeIds.length || W < 10 || H < 10) { setPos({}); return; }

    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.30;
    const cur = {}, vel = {};
    nodeIds.forEach((id, i) => {
      const angle = (i / nodeIds.length) * 2 * Math.PI;
      cur[id] = i === 0 ? { x: cx, y: cy } : { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
      vel[id] = { x: 0, y: 0 };
    });

    let step = 0;
    const REST = Math.min(W, H) * 0.20;

    const tick = () => {
      step++;
      // Repulsion
      for (let i = 0; i < nodeIds.length; i++) {
        for (let j = i + 1; j < nodeIds.length; j++) {
          const a = nodeIds[i], b = nodeIds[j];
          if (!cur[a] || !cur[b]) continue;
          const dx = cur[b].x - cur[a].x, dy = cur[b].y - cur[a].y;
          const d  = Math.sqrt(dx*dx + dy*dy) || 1;
          const f  = 2800 / (d * d);
          vel[a].x -= f*dx/d; vel[a].y -= f*dy/d;
          vel[b].x += f*dx/d; vel[b].y += f*dy/d;
        }
      }
      // Spring
      edgePairs.forEach(([s, t]) => {
        if (!cur[s] || !cur[t]) return;
        const dx = cur[t].x - cur[s].x, dy = cur[t].y - cur[s].y;
        const d  = Math.sqrt(dx*dx + dy*dy) || 1;
        const f  = 0.06 * (d - REST);
        vel[s].x += f*dx/d; vel[s].y += f*dy/d;
        vel[t].x -= f*dx/d; vel[t].y -= f*dy/d;
      });
      // Apply
      nodeIds.forEach(id => {
        if (!cur[id]) return;
        vel[id].x = (vel[id].x + (cx - cur[id].x) * 0.007) * 0.84;
        vel[id].y = (vel[id].y + (cy - cur[id].y) * 0.007) * 0.84;
        cur[id] = {
          x: Math.max(50, Math.min(W - 50, cur[id].x + vel[id].x)),
          y: Math.max(50, Math.min(H - 50, cur[id].y + vel[id].y)),
        };
      });

      if (step % 4 === 0 || step >= 150) setPos({ ...cur });
      if (step < 150) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [nodeIds.join('|'), W, H]);

  return pos;
}

// ── InfoRow ────────────────────────────────────────────────────────
function InfoRow({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="text-[9px] text-[rgba(143,152,160,0.9)] w-20 flex-shrink-0">{label}</span>
      <span className={`text-[9px] text-[#c6d4df] flex-1 break-all ${mono ? 'font-mono' : ''}`}>
        {String(value)}
      </span>
    </div>
  );
}

// ── MapNode ────────────────────────────────────────────────────────
function MapNode({ host, x, y, selected, onClick }) {
  if (!host || !isFinite(x) || !isFinite(y)) return null;
  const risk  = getRisk(host);
  const color = RISK_COLOR[risk] || RISK_COLOR.UNKNOWN;
  const type  = getType(host);
  const ports = safeArr(host.open_ports);
  const R     = host.is_gateway ? 26 : ports.length > 5 ? 21 : 17;

  return (
    <g transform={`translate(${x},${y})`} onClick={onClick} style={{ cursor: 'pointer' }}>
      {selected && (
        <motion.circle r={R + 10} fill="none" stroke={color} strokeWidth={1.5}
          initial={{ r: R + 6, opacity: 0.9 }} animate={{ r: R + 18, opacity: 0 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }} />
      )}
      <circle r={R + 7} fill={color} opacity={0.07} />
      <circle r={R} fill={`${color}22`} stroke={color} strokeWidth={selected ? 2.5 : 1.5} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={R * 0.88}
        style={{ userSelect: 'none', pointerEvents: 'none' }}>
        {TYPE_EMOJI[type] || '💻'}
      </text>
      <text y={R + 13} textAnchor="middle" fontSize={8.5}
        fill="rgba(255,255,255,0.55)" style={{ userSelect: 'none', pointerEvents: 'none' }}>
        {host.ip}
      </text>
      {ports.length > 0 && (
        <g transform={`translate(${R - 5},${-R + 5})`}>
          <circle r={7.5} fill={color} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={7.5}
            fill="white" fontWeight="bold" style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {ports.length}
          </text>
        </g>
      )}
    </g>
  );
}

// ── HostDetail ────────────────────────────────────────────────────
function HostDetail({ host, onClose, onScan }) {
  if (!host) return null;
  const risk  = getRisk(host);
  const color = RISK_COLOR[risk] || RISK_COLOR.UNKNOWN;
  const type  = getType(host);
  const ports = safeArr(host.open_ports);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      className="absolute top-4 right-4 w-72 rounded-2xl overflow-hidden shadow-2xl z-30"
      style={{ background: '#1b2838', border: `1px solid ${color}40` }}>

      <div className="flex items-center gap-3 px-4 py-3"
        style={{ background: `${color}12`, borderBottom: `1px solid ${color}22` }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
          {TYPE_EMOJI[type] || '💻'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white font-mono">{host.ip}</p>
          <p className="text-[9px] font-semibold" style={{ color }}>Riesgo {risk}</p>
        </div>
        <button onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[rgba(102,192,244,0.15)] transition-colors flex-shrink-0">
          <X className="w-3.5 h-3.5 text-[rgba(255,255,255,0.45)]" />
        </button>
      </div>

      <div className="p-3 space-y-1">
        <InfoRow label="Hostname"   value={host.hostname} mono />
        <InfoRow label="Sistema"    value={host.os} />
        <InfoRow label="MAC"        value={host.mac} mono />
        <InfoRow label="Fabricante" value={host.vendor} />
        <InfoRow label="Tipo"       value={host.device_type} />
        <InfoRow label="Latencia"   value={host.latency != null ? `${host.latency} ms` : null} />

        {ports.length > 0 && (
          <div className="pt-1.5">
            <p className="text-[9px] uppercase tracking-widest text-[rgba(143,152,160,0.7)] font-semibold mb-1.5">
              Puertos ({ports.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {ports.map(p => (
                <span key={p} className="font-mono px-1.5 py-0.5 rounded text-[9px] font-semibold"
                  style={{
                    background: DANGEROUS_PORTS.has(p) ? 'rgba(228,105,42,0.15)' : 'rgba(102,192,244,0.1)',
                    color:      DANGEROUS_PORTS.has(p) ? '#e4692a' : 'rgba(255,255,255,0.45)',
                    border:     `1px solid ${DANGEROUS_PORTS.has(p) ? 'rgba(228,105,42,0.3)' : 'rgba(102,192,244,0.1)'}`,
                  }}>{p}</span>
              ))}
            </div>
          </div>
        )}

        {host.last_score != null && (
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg mt-1"
            style={{ background: 'rgba(42,71,94,0.4)', border: '1px solid rgba(102,192,244,0.1)' }}>
            <Shield className="w-3 h-3 text-[rgba(143,152,160,0.9)]" />
            <span className="text-[10px] text-[rgba(198,212,223,0.6)]">Último score</span>
            <span className="font-bold ml-auto text-sm"
              style={{ color: host.last_score >= 70 ? '#5ba32b' : host.last_score >= 40 ? '#e4692a' : '#c94040' }}>
              {host.last_score}
            </span>
          </div>
        )}

        <button
          onClick={() => { try { onScan && onScan(host.ip); } catch(e){} onClose(); }}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold mt-2 transition-all hover:opacity-80"
          style={{ background: `${color}18`, border: `1px solid ${color}35`, color }}>
          <Play className="w-3 h-3" /> Escanear este host
        </button>
      </div>
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────
export function NetworkTopologyMap({ hosts: propHosts = [], onScanHost }) {
  const containerRef = useRef(null);
  const [dims,     setDims]    = useState({ w: 900, h: 560 });
  const [hosts,    setHosts]   = useState([]);
  const [selected, setSelected]= useState(null);
  const [filter,   setFilter]  = useState('ALL');
  const [loading,  setLoading] = useState(false);
  const [subnet,   setSubnet]  = useState('');
  const [zoom,     setZoom]    = useState(1);
  const [pan,      setPan]     = useState({ x: 0, y: 0 });
  const [error,    setError]   = useState('');
  const dragging   = useRef(false);
  const dragStart  = useRef({ x:0, y:0, px:0, py:0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 10 && height > 10) setDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (Array.isArray(propHosts) && propHosts.length > 0)
      setHosts(propHosts.map(normalizeHost).filter(Boolean));
  }, [propHosts.length]);

  const discover = useCallback(async () => {
    setLoading(true); setError(''); setSelected(null);
    try {
      const r = await fetch(`${API}/api/network/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subnet: subnet.trim() || 'auto' }),
      });
      if (!r.ok) { const e = await r.json().catch(()=>{}); throw new Error(e?.error || `HTTP ${r.status}`); }
      const data = await r.json();
      const norm = (data.hosts || []).map(normalizeHost).filter(Boolean);
      setHosts(norm);
      if (!norm.length) setError('No se encontraron hosts activos');
    } catch(e) { setError(`Error: ${e.message}`); }
    finally { setLoading(false); }
  }, [subnet]);

  const aliveHosts = hosts.filter(h => h.alive !== false);
  const filtered   = filter === 'ALL' ? aliveHosts
    : aliveHosts.filter(h => getRisk(h) === filter);
  const gateway    = filtered.find(h => h.is_gateway) || filtered[0];
  const nodeIds    = filtered.map(h => h.ip);
  const edgePairs  = gateway
    ? filtered.filter(h => h.ip !== gateway.ip).map(h => [gateway.ip, h.ip])
    : [];
  const positions  = useForceLayout(nodeIds, edgePairs, dims.w, dims.h);

  const FILTERS = ['ALL','HIGH','MEDIUM','SAFE','UNKNOWN'];
  const counts  = Object.fromEntries(FILTERS.map(f => [
    f, f === 'ALL' ? aliveHosts.length : aliveHosts.filter(h => getRisk(h) === f).length
  ]));

  // Wheel zoom
  const onWheel = useCallback(e => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(3, z * (e.deltaY < 0 ? 1.1 : 0.91))));
  }, []);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const onMouseDown = e => {
    const tag = e.target?.tagName?.toLowerCase?.() || '';
    if (['circle','text','g','path'].includes(tag)) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onMouseMove = e => {
    if (!dragging.current) return;
    setPan({ x: dragStart.current.px + e.clientX - dragStart.current.x,
             y: dragStart.current.py + e.clientY - dragStart.current.y });
  };
  const onMouseUp = () => { dragging.current = false; };

  const handleNodeClick = useCallback((host) => {
    try { setSelected(prev => prev?.ip === host?.ip ? null : host); }
    catch(e) { console.error('node click error', e); }
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Controls */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[rgba(102,192,244,0.1)] flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(102,192,244,0.15)', border: '1px solid rgba(102,192,244,0.3)' }}>
            <Wifi className="w-3.5 h-3.5 text-[#66c0f4]" />
          </div>
          <span className="text-xs font-bold text-white">Mapa de Red</span>
        </div>
        <input value={subnet} onChange={e => setSubnet(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && discover()}
          placeholder="192.168.1.0/24  (auto)"
          className="w-44 bg-[rgba(102,192,244,0.07)] border border-[rgba(102,192,244,0.15)] rounded-lg px-2.5 py-1.5 text-[10px] text-white outline-none focus:border-[rgba(102,192,244,0.4)] placeholder-[rgba(143,152,160,0.6)]" />
        <button onClick={discover} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-50"
          style={{ background: 'rgba(102,192,244,0.15)', border: '1px solid rgba(102,192,244,0.35)', color: '#66c0f4' }}>
          {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Scan className="w-3 h-3" />}
          {loading ? 'Descubriendo…' : 'Descubrir'}
        </button>
        <div className="flex items-center gap-1">
          {FILTERS.map(f => (counts[f] > 0 || f === 'ALL') && (
            <button key={f} onClick={() => setFilter(f)}
              className="px-2 py-1 rounded-lg text-[9px] font-bold transition-all"
              style={{
                background: filter===f ? `${RISK_COLOR[f]||'#66c0f4'}22` : 'rgba(42,71,94,0.4)',
                border: `1px solid ${filter===f ? `${RISK_COLOR[f]||'#66c0f4'}45` : 'rgba(102,192,244,0.1)'}`,
                color:  filter===f ? (RISK_COLOR[f]||'#66c0f4') : 'rgba(198,212,223,0.6)',
              }}>
              {f==='ALL' ? `Todos (${counts.ALL})` : `${f} (${counts[f]})`}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {[['in', ZoomIn, () => setZoom(z=>Math.min(3,z*1.2))],
            ['out', ZoomOut, () => setZoom(z=>Math.max(0.3,z/1.2))],
            ['reset', Maximize2, () => { setZoom(1); setPan({x:0,y:0}); }]
          ].map(([k, Icon, fn]) => (
            <button key={k} onClick={fn}
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-[rgba(102,192,244,0.07)] hover:bg-[rgba(102,192,244,0.15)] transition-colors">
              <Icon className="w-3.5 h-3.5 text-[rgba(255,255,255,0.45)]" />
            </button>
          ))}
          <span className="text-[9px] text-[rgba(143,152,160,0.7)] w-9 text-center font-mono">
            {Math.round(zoom*100)}%
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden select-none"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(102,192,244,0.05) 0%, transparent 65%)' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25">
          <defs>
            <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="14" cy="14" r="0.9" fill="rgba(255,255,255,0.18)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {filtered.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
            {loading ? (
              <><RefreshCw className="w-9 h-9 animate-spin text-[#66c0f4]" />
                <p className="text-sm font-semibold text-white">Descubriendo hosts…</p>
                <p className="text-[10px] text-[rgba(143,152,160,0.9)]">Puede tardar 20–60 segundos</p></>
            ) : error ? (
              <><AlertTriangle className="w-9 h-9 text-[#e4692a]" />
                <p className="text-sm font-semibold text-white">Sin resultados</p>
                <p className="text-[10px] text-[rgba(198,212,223,0.7)]">{error}</p></>
            ) : (
              <><div className="text-5xl">🗺️</div>
                <p className="text-sm font-semibold text-white">Red sin explorar</p>
                <p className="text-[10px] text-[rgba(198,212,223,0.6)] max-w-xs text-center">
                  Pulsa "Descubrir" para escanear la subred y visualizar los hosts
                </p></>
            )}
            {!loading && (
              <button onClick={discover}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold pointer-events-auto mt-1"
                style={{ background:'rgba(102,192,244,0.15)', border:'1px solid rgba(102,192,244,0.4)', color:'#66c0f4' }}>
                <Scan className="w-4 h-4" /> Descubrir ahora
              </button>
            )}
          </div>
        )}

        {filtered.length > 0 && (
          <svg width={dims.w} height={dims.h}
            style={{ transform:`scale(${zoom}) translate(${pan.x/zoom}px,${pan.y/zoom}px)`,
                     transformOrigin:'center', cursor: dragging.current ? 'grabbing' : 'grab' }}>
            {edgePairs.map(([s,t],i) => {
              const a = positions[s], b = positions[t];
              if (!a||!b||!isFinite(a.x)||!isFinite(b.x)) return null;
              const tgtH = filtered.find(h=>h.ip===t);
              const col  = RISK_COLOR[getRisk(tgtH)] || RISK_COLOR.UNKNOWN;
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={col} strokeWidth={1} opacity={0.22} />;
            })}
            {filtered.map(host => {
              const p = positions[host.ip];
              if (!p||!isFinite(p.x)||!isFinite(p.y)) return null;
              return <MapNode key={host.ip} host={host} x={p.x} y={p.y}
                selected={selected?.ip === host.ip}
                onClick={() => handleNodeClick(host)} />;
            })}
          </svg>
        )}

        {filtered.length > 0 && (
          <div className="absolute top-3 left-3 rounded-xl px-3 py-2 flex items-center gap-3 pointer-events-none"
            style={{ background:'rgba(10,12,20,0.9)', border:'1px solid rgba(102,192,244,0.1)' }}>
            <div className="text-center">
              <div className="text-sm font-bold text-white">{filtered.length}</div>
              <div className="text-[8px] text-[rgba(143,152,160,0.9)]">hosts</div>
            </div>
            {['HIGH','MEDIUM'].map(r => counts[r]>0 && (
              <div key={r} className="text-center">
                <div className="text-sm font-bold" style={{color:RISK_COLOR[r]}}>{counts[r]}</div>
                <div className="text-[8px]" style={{color:RISK_COLOR[r]}}>{r.toLowerCase()}</div>
              </div>
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="absolute bottom-4 left-4 rounded-xl px-3 py-2.5 space-y-1.5 pointer-events-none"
            style={{ background:'rgba(10,12,20,0.9)', border:'1px solid rgba(102,192,244,0.1)' }}>
            <p className="text-[8px] uppercase tracking-widest text-[rgba(143,152,160,0.7)] font-semibold">Riesgo</p>
            {Object.entries(RISK_COLOR).map(([k,c]) => (
              <div key={k} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{background:c}} />
                <span className="text-[9px] text-[rgba(198,212,223,0.7)]">{k}</span>
              </div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {selected && (
            <HostDetail key={selected.ip} host={selected}
              onClose={() => setSelected(null)}
              onScan={ip => { try { onScanHost && onScanHost(ip); } catch(e){} }} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
