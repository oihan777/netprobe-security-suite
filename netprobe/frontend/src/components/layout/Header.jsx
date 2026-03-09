import { motion } from 'framer-motion';
import { LayoutGrid, Terminal, BarChart3, Bot, FileText, Network, ShieldAlert, Cpu, Clock } from 'lucide-react';
import { getScoreColor, getScoreLabel } from '../../utils/formatters.js';

const TABS = [
  { id:'topology', label:'Red',        Icon: Network    },
  { id:'modules',  label:'Módulos',    Icon: LayoutGrid },
  { id:'terminal', label:'Terminal',   Icon: Terminal   },
  { id:'results',  label:'Resultados', Icon: BarChart3  },
  { id:'ai',       label:'IA Analyst', Icon: Bot        },
  { id:'report',   label:'Informe',    Icon: FileText   },
  { id:'cve',      label:'CVEs',       Icon: ShieldAlert },
  { id:'autopilot',label:'Autopilot',  Icon: Cpu         },
  { id:'scheduler', label:'Scheduler',  Icon: Clock       },
];

export function Header({ activeTab, setActiveTab, isRunning, progress, globalScore }) {
  const scoreColor = getScoreColor(globalScore);

  return (
    <header className="flex items-center gap-0 border-b border-[rgba(255,255,255,0.08)] px-4" style={{ background:'rgba(8,8,8,0.9)', height:'48px' }}>
      {/* Tabs */}
      <div className="flex items-center gap-1 flex-1">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab===id ? 'text-white bg-[rgba(255,255,255,0.08)]' : 'text-[rgba(255,255,255,0.4)] hover:text-white hover:bg-[rgba(255,255,255,0.04)]'}`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
            {id==='terminal' && isRunning && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Progress */}
      {isRunning && progress.total > 0 && (
        <div className="flex items-center gap-2 mr-4">
          <div className="w-28 h-1 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full bg-[#00ff88]"
              animate={{ width: `${(progress.current / progress.total) * 100}%` }}
              transition={{ duration: 0.3 }} />
          </div>
          <span className="text-xs text-[rgba(255,255,255,0.4)]">{progress.current}/{progress.total}</span>
        </div>
      )}

      {/* Score */}
      <div className="flex items-center gap-2 pl-4 border-l border-[rgba(255,255,255,0.08)]">
        <div className="text-right">
          <div className="text-[10px] text-[rgba(255,255,255,0.3)] uppercase tracking-wider">Score</div>
          <div className="text-sm font-semibold leading-none" style={{ color: scoreColor }}>
            {globalScore}/100
          </div>
        </div>
        <div className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background:`${scoreColor}20`, color: scoreColor }}>
          {getScoreLabel(globalScore)}
        </div>
      </div>
    </header>
  );
}
