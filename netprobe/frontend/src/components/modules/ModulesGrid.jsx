import { motion } from 'framer-motion';
import { MODULES, CATEGORIES, RISK_COLORS, STATUS_CONFIG } from '../../data/modules.js';
import { CheckCircle2 } from 'lucide-react';

export function ModulesGrid({ selectedModules, setSelectedModules, results }) {
  const resultMap = Object.fromEntries(results.map(r => [r.id, r]));
  const toggle = (id) =>
    setSelectedModules(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const grouped = Object.entries(CATEGORIES).map(([key, cat]) => ({
    key, cat,
    modules: MODULES.filter(m => m.category === key),
  }));

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {grouped.map(({ key, cat, modules }) => (
        <div key={key}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ background: cat.color }} />
            <h3 className="text-xs font-semibold text-[rgba(255,255,255,0.6)] uppercase tracking-wider">{cat.name}</h3>
            <span className="text-[10px] text-[rgba(255,255,255,0.3)]">{modules.length} módulos</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {modules.map(m => {
              const sel    = selectedModules.includes(m.id);
              const result = resultMap[m.id];
              const sc     = result ? STATUS_CONFIG[result.status] : null;
              return (
                <motion.button key={m.id} onClick={() => toggle(m.id)}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className={`relative p-3 rounded-xl text-left transition-all border ${sel && !result ? 'border-[rgba(0,255,136,0.3)] bg-[rgba(0,255,136,0.06)]' : result ? 'border-opacity-30' : 'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]'}`}
                  style={result ? { borderColor:`${sc?.color}40`, background:`${sc?.color}08` } : {}}>

                  {/* Status indicator */}
                  {result ? (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-mono font-bold" style={{ color: sc?.color }}>{sc?.emoji} {result.status}</span>
                      <span className="text-[9px] font-mono" style={{ color: sc?.color }}>{result.score ?? 'N/A'}</span>
                    </div>
                  ) : sel ? (
                    <div className="flex items-center justify-between mb-2">
                      <CheckCircle2 className="w-3 h-3 text-[#00ff88]" />
                      <span className="text-[9px] text-[#00ff88]">SEL</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: RISK_COLORS[m.risk] }} />
                      <span className="text-[9px]" style={{ color: RISK_COLORS[m.risk] }}>{m.risk}</span>
                    </div>
                  )}

                  <p className="text-xs font-medium text-white leading-snug mb-1">{m.name}</p>
                  <p className="text-[10px] text-[rgba(255,255,255,0.4)] leading-snug line-clamp-2">{m.description}</p>

                  {/* Category dot */}
                  <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full opacity-60" style={{ background: CATEGORIES[m.category]?.color }} />
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
