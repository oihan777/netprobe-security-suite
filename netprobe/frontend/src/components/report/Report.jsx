import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Bot, Loader2, CheckCircle, FileDown } from 'lucide-react';
import { CATEGORIES, STATUS_CONFIG } from '../../data/modules.js';
import { getScoreColor, getScoreLabel, formatDate } from '../../utils/formatters.js';

const SEV_ORDER = { PASSED:0, PARTIAL:1, DETECTED:2, BLOCKED:3, ERROR:4 };

export function Report({ results, target, globalScore, onGenerateAIReport }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfDone,    setPdfDone]    = useState(false);
  const [pdfError,   setPdfError]   = useState('');

  const byStatus = { BLOCKED:[], DETECTED:[], PARTIAL:[], PASSED:[], ERROR:[] };
  results.forEach(r => (byStatus[r.status] || byStatus.ERROR).push(r));

  // ── Export Markdown ──────────────────────────────────────────
  const exportMarkdown = () => {
    const date = new Date().toLocaleString('es-ES');
    const lines = [
      `# NetProbe Security Suite — Informe de Seguridad`,
      `**Fecha:** ${date}  `,`**Target:** ${target||'N/A'}  `,
      `**Score Global:** ${globalScore}/100 (${getScoreLabel(globalScore)})`,
      ``,`---`,`## Resumen`,``,
      `| Estado | Módulos |`,`|--------|---------|`,
      ...Object.entries(byStatus).filter(([,v])=>v.length).map(([s,v])=>`| ${s} | ${v.length} |`),
      ``,`---`,`## Detalle`,``,
      `| Módulo | Categoría | Estado | Score |`,`|--------|-----------|--------|-------|`,
      ...results.map(r=>`| ${r.name} | ${CATEGORIES[r.category]?.name||r.category} | ${r.status} | ${r.score??'N/A'} |`),
      ``,`---`,
      `*Generado por NetProbe Security Suite — Uso exclusivo en redes propias o con autorización.*`,
    ];
    const blob = new Blob([lines.join('\n')], { type:'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `netprobe-report-${new Date().toISOString().slice(0,10)}.md`; a.click();
  };

  // ── Export PDF ───────────────────────────────────────────────
  const exportPDF = async () => {
    setPdfLoading(true); setPdfError(''); setPdfDone(false);
    try {
      const res = await fetch('http://localhost:8000/api/report/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          score:   globalScore,
          results,
          date_str: new Date().toLocaleString('es-ES'),
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt.slice(0,200));
      }
      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = `netprobe-${(target||'report').replace(/\./g,'_')}-${new Date().toISOString().slice(0,10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setPdfDone(true);
      setTimeout(() => setPdfDone(false), 3000);
    } catch(e) {
      setPdfError(e.message);
    } finally {
      setPdfLoading(false);
    }
  };

  if (!results.length) {
    return (
      <div className="h-full flex items-center justify-center text-[rgba(143,152,160,0.6)]">
        <div className="text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm">Sin resultados</p>
          <p className="text-xs mt-1">Ejecuta un scan primero</p>
        </div>
      </div>
    );
  }

  const sorted = [...results].sort((a,b) => (SEV_ORDER[a.status]??5)-(SEV_ORDER[b.status]??5));

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">

      {/* ── Header + export buttons ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Informe de Seguridad</h2>
          <p className="text-[10px] text-[rgba(198,212,223,0.6)]">
            {target || 'Sin target'} · {results.length} módulos · Score {globalScore}/100
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onGenerateAIReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background:'rgba(0,132,255,0.1)', border:'1px solid rgba(102,192,244,0.3)', color:'#66c0f4' }}>
            <Bot className="w-3.5 h-3.5"/> Informe IA
          </button>
          <button onClick={exportMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background:'rgba(102,192,244,0.08)', border:'1px solid rgba(143,152,160,0.4)', color:'#c6d4df' }}>
            <FileText className="w-3.5 h-3.5"/> Markdown
          </button>
          <button onClick={exportPDF} disabled={pdfLoading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-60"
            style={{ background: pdfDone ? 'rgba(91,163,43,0.15)' : 'rgba(201,64,64,0.12)',
                     border:`1px solid ${pdfDone ? 'rgba(91,163,43,0.4)' : 'rgba(201,64,64,0.35)'}`,
                     color: pdfDone ? '#5ba32b' : '#c94040' }}>
            {pdfLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/> Generando...</>
             : pdfDone   ? <><CheckCircle className="w-3.5 h-3.5"/> Descargado</>
                         : <><FileDown className="w-3.5 h-3.5"/> Exportar PDF</>}
          </button>
        </div>
      </div>

      {pdfError && (
        <div className="text-xs text-[#c94040] bg-[rgba(201,64,64,0.08)] border border-[rgba(201,64,64,0.25)] rounded-lg px-3 py-2">
          {pdfError}
        </div>
      )}

      {/* ── Score + status summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="sm:col-span-1 rounded-xl border border-[rgba(102,192,244,0.1)] bg-[rgba(42,71,94,0.2)] p-4 flex flex-col items-center gap-1">
          <div className="text-3xl font-bold" style={{ color: getScoreColor(globalScore) }}>{globalScore}</div>
          <div className="text-[9px] text-[rgba(198,212,223,0.6)]">/ 100</div>
          <div className="text-[10px] font-semibold" style={{ color: getScoreColor(globalScore) }}>{getScoreLabel(globalScore)}</div>
        </div>
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const count = byStatus[status]?.length || 0;
          return (
            <div key={status} className="rounded-xl border p-3 flex flex-col items-center gap-1"
              style={{ background:`${cfg.color}08`, borderColor:`${cfg.color}20` }}>
              <span className="text-xl">{cfg.emoji}</span>
              <span className="text-xl font-bold" style={{ color:cfg.color }}>{count}</span>
              <span className="text-[8px] text-[rgba(198,212,223,0.6)] uppercase tracking-wider">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* ── Results by severity ── */}
      <div className="rounded-xl border border-[rgba(102,192,244,0.1)] overflow-hidden">
        <div className="px-4 py-2.5 bg-[rgba(42,71,94,0.2)] border-b border-[rgba(102,192,244,0.1)]">
          <span className="text-[9px] uppercase tracking-widest text-[rgba(198,212,223,0.7)] font-semibold">
            Resultados ordenados por severidad
          </span>
        </div>
        {sorted.map((r, i) => {
          const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.ERROR;
          const cat = CATEGORIES[r.category];
          return (
            <motion.div key={r.id} initial={{ opacity:0 }} animate={{ opacity:1 }}
              transition={{ delay: i*0.015 }}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-[rgba(42,71,94,0.4)] last:border-0">
              <span className="text-base w-5 text-center">{cfg.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white truncate">{r.name}</div>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                  style={{ background:`${cat?.color||'#fff'}12`, color:cat?.color||'#fff' }}>
                  {cat?.name || r.category}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 w-24">
                <div className="flex-1 h-1 rounded-full bg-[rgba(102,192,244,0.08)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width:`${r.score||0}%`, background:cfg.color }} />
                </div>
                <span className="text-[10px] font-mono font-bold w-5 text-right" style={{ color:cfg.color }}>
                  {r.score??'—'}
                </span>
              </div>
              <span className="text-[9px] px-2 py-1 rounded-lg font-bold"
                style={{ background:`${cfg.color}15`, color:cfg.color, border:`1px solid ${cfg.color}28` }}>
                {cfg.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* ── PDF info ── */}
      <div className="rounded-xl border border-[rgba(102,192,244,0.08)] bg-[rgba(42,71,94,0.2)] p-4">
        <p className="text-[9px] text-[rgba(143,152,160,0.9)] leading-relaxed">
          <span className="font-semibold text-[rgba(198,212,223,0.8)]">Exportar PDF</span> — genera un informe profesional con portada,
          resumen ejecutivo, tabla de resultados, hallazgos detallados, recomendaciones priorizadas y apéndice de comandos.
          Listo para entregar a un cliente o responsable de seguridad.
        </p>
      </div>
    </div>
  );
}
