import { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scan, StopCircle, ZoomIn, ZoomOut, Maximize2,
  Target, ChevronRight, Wifi, X
} from 'lucide-react';

// ── Device config ─────────────────────────────────────────────────
const DEV = {
  'gateway':         { color: '#c94040', glow: '#c94040', emoji: '🛡️', label: 'Gateway/Router',   r: 26 },
  'firewall-router': { color: '#c94040', glow: '#c94040', emoji: '🛡️', label: 'Firewall/Router',  r: 26 },
  'linux-server':    { color: '#57cbde', glow: '#57cbde', emoji: '🖥️', label: 'Linux Server',     r: 20 },
  'windows-server':  { color: '#66c0f4', glow: '#66c0f4', emoji: '🖥️', label: 'Windows Server',  r: 20 },
  'windows':         { color: '#66c0f4', glow: '#66c0f4', emoji: '💻', label: 'Windows',          r: 18 },
  'web-server':      { color: '#e4692a', glow: '#e4692a', emoji: '🌐', label: 'Web Server',       r: 20 },
  'dns-server':      { color: '#9b59b6', glow: '#9b59b6', emoji: '🔍', label: 'DNS Server',       r: 18 },
  'database':        { color: '#c8a951', glow: '#c8a951', emoji: '🗄️', label: 'Base de Datos',   r: 18 },
  'mobile':          { color: '#5ba32b', glow: '#5ba32b', emoji: '📱', label: 'Móvil',            r: 16 },
  'iot':             { color: '#66c0f4', glow: '#66c0f4', emoji: '📡', label: 'IoT',              r: 16 },
  'host':            { color: '#8f98a0', glow: '#8f98a0', emoji: '💻', label: 'Host',             r: 16 },
  'scanner':         { color: '#57cbde', glow: '#57cbde', emoji: '🎯', label: 'Esta máquina',     r: 22 },
  'unknown':         { color: '#2a475e', glow: '#2a475e', emoji: '❓', label: 'Desconocido',      r: 15 },
};
const cfg = t => DEV[t] || DEV.unknown;

export function NetworkTopology({ onSetTarget }) {
  const svgRef       = useRef(null);
  const wrapRef      = useRef(null);
  const simRef       = useRef(null);
  const zoomBehRef   = useRef(null);
  const wsRef        = useRef(null);

  const [nodes,       setNodes]       = useState([]);
  const [links,       setLinks]       = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [scanning,    setScanning]    = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [status,      setStatus]      = useState('');
  const [networks,    setNetworks]    = useState([]);
  const [selNet,      setSelNet]      = useState('');
  const [dim,         setDim]         = useState({ w: 900, h: 520 });

  // Responsive dimensions
  useEffect(() => {
    const obs = new ResizeObserver(([e]) => {
      setDim({ w: e.contentRect.width || 900, h: Math.max(e.contentRect.height, 400) });
    });
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, []);

  // Load local networks
  useEffect(() => {
    fetch('http://localhost:8000/api/discovery/networks')
      .then(r => r.json())
      .then(d => {
        setNetworks(d.networks || []);
        if (d.networks?.length) setSelNet(d.networks[0].cidr);
      }).catch(() => {});
  }, []);

  // Rebuild D3 graph whenever nodes/links/dim change
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;
    renderGraph(nodes, links, dim);
  }, [nodes, links, dim]);

  const renderGraph = useCallback((nodeData, linkData, { w, h }) => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // ── defs: glows + grid ──────────────────────────────────────
    const defs = svg.append('defs');

    // Dot grid pattern
    const pat = defs.append('pattern').attr('id','dotgrid').attr('width',32).attr('height',32).attr('patternUnits','userSpaceOnUse');
    pat.append('circle').attr('cx',1).attr('cy',1).attr('r',0.8).attr('fill','rgba(102,192,244,0.08)');

    // Per-type glow filters
    Object.entries(DEV).forEach(([key, c]) => {
      const f = defs.append('filter').attr('id',`glow-${key}`).attr('x','-60%').attr('y','-60%').attr('width','220%').attr('height','220%');
      f.append('feGaussianBlur').attr('stdDeviation','4').attr('result','blur');
      const m = f.append('feMerge');
      m.append('feMergeNode').attr('in','blur');
      m.append('feMergeNode').attr('in','SourceGraphic');
    });

    // Line gradient
    const lg = defs.append('linearGradient').attr('id','linkgrad').attr('gradientUnits','userSpaceOnUse');
    lg.append('stop').attr('offset','0%').attr('stop-color','rgba(87,203,222,0.4)');
    lg.append('stop').attr('offset','100%').attr('stop-color','rgba(102,192,244,0.2)');

    svg.append('rect').attr('width',w).attr('height',h).attr('fill','url(#dotgrid)');

    const g = svg.append('g').attr('class','world');

    // ── zoom ──────────────────────────────────────────────────
    const zoom = d3.zoom().scaleExtent([0.25,5])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom).on('dblclick.zoom', null);
    zoomBehRef.current = { zoom, svg };

    // ── links ─────────────────────────────────────────────────
    const linkSel = g.append('g').selectAll('line')
      .data(linkData).join('line')
      .attr('stroke', d => d.type === 'gateway'
        ? `${cfg(d.targetType || 'unknown').color}55`
        : 'rgba(102,192,244,0.08)')
      .attr('stroke-width', d => d.type === 'gateway' ? 1.5 : 0.8)
      .attr('stroke-dasharray', d => d.type === 'peer' ? '3,5' : null);

    // Animated "data flow" dots on gateway links
    const flowDots = g.append('g').selectAll('circle.flow')
      .data(linkData.filter(l => l.type === 'gateway')).join('circle')
      .attr('class','flow').attr('r',2)
      .attr('fill', d => cfg(d.targetType || 'unknown').color)
      .attr('opacity', 0.7);

    // ── node groups ───────────────────────────────────────────
    const nodeG = g.append('g').selectAll('g.nd')
      .data(nodeData).join('g').attr('class','nd')
      .style('cursor','pointer')
      .call(d3.drag()
        .on('start', (e,d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
        .on('drag',  (e,d) => { d.fx=e.x; d.fy=e.y; })
        .on('end',   (e,d) => { if (!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null; })
      )
      .on('click', (e,d) => { e.stopPropagation(); setSelected(d); });

    // outer glow ring (always visible, subtle)
    nodeG.append('circle')
      .attr('r', d => cfg(d.device_type).r + 8)
      .attr('fill', d => `${cfg(d.device_type).color}08`)
      .attr('stroke', d => `${cfg(d.device_type).color}22`)
      .attr('stroke-width', 1);

    // main circle
    nodeG.append('circle')
      .attr('r', d => cfg(d.device_type).r)
      .attr('fill', d => `${cfg(d.device_type).color}18`)
      .attr('stroke', d => cfg(d.device_type).color)
      .attr('stroke-width', 1.5)
      .attr('filter', d => `url(#glow-${d.device_type})`);

    // emoji icon
    nodeG.append('text')
      .attr('text-anchor','middle').attr('dominant-baseline','central')
      .attr('font-size', d => d.device_type === 'gateway' ? '15px' : '12px')
      .style('user-select','none')
      .text(d => cfg(d.device_type).emoji);

    // IP label
    nodeG.append('text')
      .attr('text-anchor','middle')
      .attr('y', d => cfg(d.device_type).r + 13)
      .attr('font-size','9px').attr('font-family','monospace')
      .attr('fill', d => cfg(d.device_type).color)
      .style('user-select','none')
      .text(d => d.ip);

    // hostname (short)
    nodeG.append('text')
      .attr('text-anchor','middle')
      .attr('y', d => cfg(d.device_type).r + 23)
      .attr('font-size','7.5px').attr('font-family','monospace')
      .attr('fill','rgba(255,255,255,0.28)')
      .style('user-select','none')
      .text(d => d.hostname ? d.hostname.split('.')[0].slice(0,14) : '');

    // selected ring
    const selRing = nodeG.append('circle')
      .attr('class','selring')
      .attr('r', d => cfg(d.device_type).r + 5)
      .attr('fill','none').attr('stroke','white')
      .attr('stroke-width',1.5).attr('stroke-dasharray','4,3')
      .attr('opacity',0);

    // hover
    nodeG.on('mouseenter', function(e,d) {
      d3.select(this).select('circle').attr('stroke-width',2.5);
      // pulse
      d3.select(this).append('circle')
        .attr('r', cfg(d.device_type).r + 5)
        .attr('fill','none')
        .attr('stroke', cfg(d.device_type).color)
        .attr('stroke-width',1)
        .attr('opacity',0.7)
        .transition().duration(700)
        .attr('r', cfg(d.device_type).r + 22)
        .attr('opacity',0)
        .remove();
    }).on('mouseleave', function() {
      d3.select(this).select('circle').attr('stroke-width',1.5);
    });

    // Update selected ring visibility
    const updateSelection = (selectedId) => {
      selRing.attr('opacity', d => d.id === selectedId ? 0.8 : 0);
    };

    // ── simulation ────────────────────────────────────────────
    const sim = d3.forceSimulation(nodeData)
      .force('link', d3.forceLink(linkData).id(d => d.id).distance(d => d.type === 'gateway' ? 130 : 70).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(w/2, h/2))
      .force('collide', d3.forceCollide(d => cfg(d.device_type).r + 20))
      .on('tick', () => {
        linkSel
          .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        nodeG.attr('transform', d => `translate(${d.x},${d.y})`);

        // Animate flow dots along links
        const t = (Date.now() % 2000) / 2000;
        flowDots.attr('cx', d => d.source.x + (d.target.x - d.source.x) * t)
                .attr('cy', d => d.source.y + (d.target.y - d.source.y) * t);
      });

    simRef.current = sim;

    // Click svg to deselect
    svg.on('click', () => setSelected(null));

    // auto-fit after graph settles
    setTimeout(() => {
      const t = d3.zoomIdentity.translate(w * 0.05, h * 0.05).scale(0.9);
      svg.transition().duration(800).call(zoom.transform, t);
    }, 1800);

  }, []);

  // ── Scan ────────────────────────────────────────────────────────
  const startScan = () => {
    if (!selNet || scanning) return;
    setScanning(true);
    setNodes([]); setLinks([]); setSelected(null);
    setProgress(0); setStatus('Conectando...');

    const discovered = [];
    const ws = new WebSocket('ws://localhost:8000/api/discovery/scan');
    wsRef.current = ws;

    ws.onopen  = () => { ws.send(JSON.stringify({ cidr: selNet, method: 'nmap' })); setStatus(`Escaneando ${selNet}…`); };
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === 'host') {
        discovered.push(d.host);
        setProgress(d.progress);
        setStatus(`${discovered.length} hosts encontrados…`);
        const { ns, ls } = buildGraph(discovered, selNet);
        setNodes([...ns]);
        setLinks([...ls]);
      }
      if (d.type === 'host_update') {
        // Update existing host with ports + device type
        const idx = discovered.findIndex(h => h.ip === d.host.ip);
        if (idx >= 0) discovered[idx] = d.host;
        setProgress(d.progress);
        setStatus(`Actualizando puertos… ${d.progress}%`);
        const { ns, ls } = buildGraph(discovered, selNet);
        setNodes([...ns]);
        setLinks([...ls]);
      }
      if (d.type === 'status') {
        setStatus(d.message);
      }
      if (d.type === 'done') {
        setScanning(false);
        setProgress(100);
        setStatus(`✓ ${d.total} dispositivos encontrados`);
      }
      if (d.type === 'error') {
        setScanning(false);
        setStatus(`Error: ${d.message}`);
      }
    };
    ws.onerror = () => { setScanning(false); setStatus('Error de conexión WebSocket'); };
    ws.onclose = () => { if (scanning) setScanning(false); };
  };

  const stopScan = () => { wsRef.current?.close(); setScanning(false); setStatus('Escaneo detenido'); };

  const zoomIn  = () => { const {zoom,svg} = zoomBehRef.current||{}; if(zoom&&svg) svg.transition().call(zoom.scaleBy,1.4); };
  const zoomOut = () => { const {zoom,svg} = zoomBehRef.current||{}; if(zoom&&svg) svg.transition().call(zoom.scaleBy,0.7); };
  const fitView = () => {
    const {zoom,svg} = zoomBehRef.current||{};
    if (!zoom||!svg) return;
    svg.transition().duration(600).call(zoom.transform,
      d3.zoomIdentity.translate(dim.w*0.05, dim.h*0.05).scale(0.9));
  };

  const empty = nodes.length === 0;

  return (
    <div className="h-full flex flex-col" style={{ background:'#171a21' }}>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[rgba(102,192,244,0.1)] flex-shrink-0"
        style={{ background:'rgba(10,10,14,0.95)' }}>

        {/* Title */}
        <div className="flex items-center gap-2 mr-1">
          <div className="w-6 h-6 rounded-md bg-[rgba(87,203,222,0.1)] border border-[rgba(87,203,222,0.2)] flex items-center justify-center text-xs">🕸️</div>
          <span className="text-xs font-semibold text-white tracking-wide">Topología de Red</span>
        </div>

        {/* Network selector */}
        {networks.length > 0 && (
          <select value={selNet} onChange={e=>setSelNet(e.target.value)} disabled={scanning}
            className="bg-[rgba(102,192,244,0.07)] border border-[rgba(102,192,244,0.15)] rounded-lg px-2.5 py-1 text-[11px] text-[rgba(255,255,255,0.65)] focus:outline-none focus:border-[rgba(87,203,222,0.4)] disabled:opacity-40"
            style={{fontFamily:'monospace'}}>
            {networks.map(n => (
              <option key={n.cidr} value={n.cidr} style={{background:'#111'}}>
                {n.cidr} · {n.iface_type || n.interface} ({n.local_ip})
              </option>
            ))}
          </select>
        )}

        {/* Scan / Stop */}
        {scanning ? (
          <button onClick={stopScan}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{background:'rgba(201,64,64,0.12)', border:'1px solid rgba(201,64,64,0.3)', color:'#c94040'}}>
            <StopCircle className="w-3.5 h-3.5"/> Detener
          </button>
        ) : (
          <button onClick={startScan} disabled={!selNet}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
            style={{background:'rgba(87,203,222,0.1)', border:'1px solid rgba(87,203,222,0.3)', color:'#57cbde'}}>
            <Scan className="w-3.5 h-3.5"/>
            {nodes.length > 0 ? 'Re-escanear' : 'Escanear red'}
          </button>
        )}

        {/* Progress + status */}
        <div className="flex items-center gap-2 flex-1">
          {scanning && (
            <div className="flex items-center gap-2">
              <div className="w-28 h-1 rounded-full overflow-hidden" style={{background:'rgba(102,192,244,0.08)'}}>
                <motion.div className="h-full rounded-full" style={{background:'#57cbde'}}
                  animate={{width:`${progress}%`}} transition={{duration:0.3}}/>
              </div>
              <span className="text-[10px] font-mono" style={{color:'#57cbde'}}>{progress}%</span>
            </div>
          )}
          {status && <span className="text-[10px] font-mono text-[rgba(143,152,160,0.9)]">{status}</span>}
        </div>

        {/* Legend */}
        <div className="hidden lg:flex items-center gap-3 border-l border-[rgba(102,192,244,0.1)] pl-3">
          {[['gateway','🛡️','Router'],['linux-server','🖥️','Linux'],['windows','💻','Windows'],['web-server','🌐','Web'],['database','🗄️','DB'],['mobile','📱','Móvil'],['iot','📡','IoT']].map(([t,ic,lb])=>(
            <div key={t} className="flex items-center gap-1">
              <span className="text-[10px]">{ic}</span>
              <span className="text-[9px] font-mono" style={{color:cfg(t).color}}>{lb}</span>
            </div>
          ))}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 border-l border-[rgba(102,192,244,0.1)] pl-2">
          {[[ZoomIn,zoomIn],[ZoomOut,zoomOut],[Maximize2,fitView]].map(([Icon,fn],i)=>(
            <button key={i} onClick={fn}
              className="p-1.5 rounded text-[rgba(143,152,160,0.9)] hover:text-white hover:bg-[rgba(102,192,244,0.1)] transition-all">
              <Icon className="w-3.5 h-3.5"/>
            </button>
          ))}
        </div>
      </div>

      {/* ── Canvas ──────────────────────────────────────────── */}
      <div ref={wrapRef} className="flex-1 relative overflow-hidden" style={{minHeight:0}}>

        {/* Empty state */}
        {empty && !scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
            {/* Animated web rings */}
            <div className="relative w-32 h-32 mb-8">
              {[0,1,2,3].map(i=>(
                <div key={i} className="absolute inset-0 rounded-full border border-[rgba(87,203,222,0.12)]"
                  style={{
                    margin: `${i*14}px`,
                    animation:`spin ${8+i*3}s linear infinite`,
                    animationDirection: i%2?'reverse':'normal',
                  }}/>
              ))}
              <div className="absolute inset-0 flex items-center justify-center text-4xl">🕸️</div>
            </div>
            <p className="text-white font-semibold text-sm mb-1.5">Topología de Red</p>
            <p className="text-[rgba(198,212,223,0.6)] text-xs max-w-xs leading-relaxed mb-6">
              Descubre todos los dispositivos conectados a tu red y visualiza sus conexiones en un mapa interactivo en tiempo real.
            </p>
            <button onClick={startScan} disabled={!selNet}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
              style={{background:'rgba(87,203,222,0.1)', border:'1px solid rgba(87,203,222,0.35)', color:'#57cbde'}}>
              <Scan className="w-4 h-4"/> Iniciar escaneo de red
            </button>
          </div>
        )}

        {/* Scanning empty state */}
        {scanning && empty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative w-28 h-28 mb-6">
              {[0,1,2].map(i=>(
                <div key={i} className="absolute inset-0 rounded-full border border-[rgba(87,203,222,0.25)]"
                  style={{animation:'ping 1.8s cubic-bezier(0,0,0.2,1) infinite', animationDelay:`${i*0.5}s`}}/>
              ))}
              <div className="absolute inset-0 flex items-center justify-center text-3xl">🎯</div>
            </div>
            <p className="font-mono text-sm" style={{color:'#57cbde'}}>{status}</p>
            <p className="font-mono text-[10px] text-[rgba(143,152,160,0.7)] mt-1">nmap -sn -T4 --min-parallelism 100 {selNet}</p>
          </div>
        )}

        {/* D3 SVG */}
        {!empty && (
          <svg ref={svgRef} width="100%" height="100%" style={{display:'block'}}/>
        )}
      </div>

      {/* ── Selected host detail panel ───────────────────────── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{y:'100%', opacity:0}}
            animate={{y:0, opacity:1}}
            exit={{y:'100%', opacity:0}}
            transition={{type:'spring', damping:28, stiffness:320}}
            className="flex-shrink-0 border-t"
            style={{borderColor:'rgba(102,192,244,0.15)', background:'rgba(10,10,14,0.98)'}}>
            <HostPanel host={selected} onSetTarget={onSetTarget} onClose={()=>setSelected(null)}/>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes ping { 0%{transform:scale(0.95);opacity:0.7} 100%{transform:scale(1.6);opacity:0} }
      `}</style>
    </div>
  );
}

// ── Host detail panel ─────────────────────────────────────────────
function HostPanel({ host, onSetTarget, onClose }) {
  const c = cfg(host.device_type);
  return (
    <div className="px-4 py-3 flex items-start gap-5">

      {/* Device icon */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
          style={{background:`${c.color}12`, border:`1.5px solid ${c.color}35`}}>
          {c.emoji}
        </div>
        <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded"
          style={{background:`${c.color}15`, color:c.color}}>
          {c.label}
        </span>
      </div>

      {/* Info grid */}
      <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2.5">
        {[
          ['IP',       host.ip,                          true,  true],
          ['Hostname', host.hostname||'—',               false, false],
          ['MAC',      host.mac||'—',                    true,  false],
          ['Vendor',   host.vendor||'—',                 false, false],
          ['Latencia', host.latency?`${host.latency}ms`:'—', true, false],
          ['Método',   host.method||'nmap',              false, false],
          ['Puertos',  host.open_ports?.length ? `${host.open_ports.length} abiertos` : '0', false, false],
          ['Red',      host.network||'—',                true,  false],
        ].map(([lbl,val,mono,hi])=>(
          <div key={lbl} className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase tracking-widest text-[rgba(255,255,255,0.28)]">{lbl}</span>
            <span className={`text-xs truncate ${mono?'font-mono':''}`}
              style={{color: hi ? c.color : 'rgba(255,255,255,0.78)', fontWeight: hi ? 700 : 400}}>
              {val}
            </span>
          </div>
        ))}
      </div>

      {/* Open ports */}
      {host.open_ports?.length > 0 && (
        <div className="flex-shrink-0 max-w-[180px]">
          <p className="text-[9px] uppercase tracking-widest text-[rgba(255,255,255,0.28)] mb-1.5">Puertos abiertos</p>
          <div className="flex flex-wrap gap-1">
            {host.open_ports.slice(0,10).map(p=>(
              <span key={p.port} className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                style={{background:`${c.color}12`, color:c.color, border:`1px solid ${c.color}28`}}>
                {p.port}/{p.service}
              </span>
            ))}
            {host.open_ports.length > 10 && (
              <span className="text-[9px] text-[rgba(143,152,160,0.9)] font-mono">+{host.open_ports.length-10}</span>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="flex-shrink-0 flex flex-col gap-2">
        <button onClick={()=>{onSetTarget(host.ip); onClose();}}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{background:`${c.color}15`, border:`1.5px solid ${c.color}45`, color:c.color}}
          onMouseEnter={e=>e.currentTarget.style.background=`${c.color}28`}
          onMouseLeave={e=>e.currentTarget.style.background=`${c.color}15`}>
          <Target className="w-3.5 h-3.5"/>
          Usar como Target
        </button>
        <button onClick={onClose}
          className="flex items-center justify-center gap-1 px-4 py-1.5 rounded-xl text-[10px] text-[rgba(143,152,160,0.9)] hover:text-white border border-[rgba(102,192,244,0.1)] hover:border-[rgba(143,152,160,0.6)] transition-all">
          <X className="w-3 h-3"/> Cerrar
        </button>
      </div>
    </div>
  );
}

// ── Build D3 graph data from host list ────────────────────────────
function buildGraph(hosts, cidr) {
  const ns = [], ls = [];
  const gwIP = detectGateway(hosts, cidr);

  hosts.forEach(h => {
    ns.push({
      id: h.ip,
      ...h,
      device_type: h.ip === gwIP ? 'gateway' : (h.device_type || 'unknown'),
    });
  });

  // Every host → gateway
  if (gwIP) {
    ns.forEach(n => {
      if (n.id !== gwIP) {
        ls.push({ source: gwIP, target: n.id, type: 'gateway', targetType: n.device_type });
      }
    });
  }

  // Peer links: shared open services suggest communication
  const SHARED_SERVICES = new Set([80, 443, 22, 3306, 5432, 27017, 6379, 8080, 8443]);
  for (let i = 0; i < hosts.length; i++) {
    for (let j = i + 1; j < hosts.length; j++) {
      if (hosts[i].ip === gwIP || hosts[j].ip === gwIP) continue;
      const pA = new Set((hosts[i].open_ports||[]).map(p=>p.port));
      const pB = new Set((hosts[j].open_ports||[]).map(p=>p.port));
      const shared = [...pA].filter(p => SHARED_SERVICES.has(p) && pB.has(p));
      if (shared.length > 0) {
        ls.push({ source: hosts[i].ip, target: hosts[j].ip, type: 'peer' });
      }
    }
  }

  return { ns, ls };
}

function detectGateway(hosts, cidr) {
  const base = cidr.split('/')[0].split('.').slice(0,3).join('.');
  const gw1   = `${base}.1`;
  const gw254 = `${base}.254`;
  if (hosts.find(h => h.ip === gw1))   return gw1;
  if (hosts.find(h => h.ip === gw254)) return gw254;
  if (!hosts.length) return null;
  return hosts.reduce((a,b) =>
    (b.open_ports?.length||0) > (a.open_ports?.length||0) ? b : a
  ).ip;
}
