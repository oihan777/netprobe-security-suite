import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid, Terminal, BarChart3, Bot, FileText, Network,
  ShieldAlert, Shield, Cpu, Clock, BarChart2, Layers, Eye,
  ScrollText, Code2, Crosshair, Wrench, FlaskConical, Radio, Swords
} from 'lucide-react';
import { getScoreColor, getScoreLabel } from '../../utils/formatters.js';

// ── Grupos y tabs ─────────────────────────────────────────────────
const GROUPS = [
  {
    id: 'recon',
    label: 'Reconocimiento',
    Icon: Radio,
    color: '#66c0f4',
    tabs: [
      { id: 'dashboard', label: 'Dashboard',  Icon: BarChart2  },
      { id: 'topology',  label: 'Red',        Icon: Network    },
      { id: 'osint',     label: 'OSINT',      Icon: Eye        },
      { id: 'cve',       label: 'CVEs',       Icon: ShieldAlert },
    ],
  },
  {
    id: 'attack',
    label: 'Ataque',
    Icon: Crosshair,
    color: '#c94040',
    tabs: [
      { id: 'modules',   label: 'Módulos',    Icon: LayoutGrid },
      { id: 'terminal',  label: 'Terminal',   Icon: Terminal   },
      { id: 'campaign',  label: 'Campaña',    Icon: Layers     },
      { id: 'scheduler', label: 'Scheduler',  Icon: Clock      },
    ],
  },
  {
    id: 'results',
    label: 'Resultados',
    Icon: BarChart3,
    color: '#57cbde',
    tabs: [
      { id: 'results',   label: 'Resultados', Icon: BarChart3  },
      { id: 'logs',      label: 'Logs',       Icon: ScrollText },
      { id: 'report',    label: 'Informe',    Icon: FileText   },
    ],
  },
  {
    id: 'tools',
    label: 'Herramientas',
    Icon: Wrench,
    color: '#e4692a',
    tabs: [
      { id: 'revshell',  label: 'RevShell',   Icon: Terminal   },
      { id: 'payloads',  label: 'Payloads',   Icon: Code2      },
      { id: 'ids',       label: 'IDS Rules',  Icon: Shield     },
    ],
  },
  {
    id: 'ai',
    label: 'IA',
    Icon: Bot,
    color: '#9b59b6',
    tabs: [
      { id: 'ai',        label: 'IA Analyst', Icon: Bot        },
      { id: 'autopilot', label: 'Autopilot',  Icon: Cpu        },
      { id: 'stride',    label: 'STRIDE',     Icon: ShieldAlert },
    ],
  },
];

// Flatten para lookup rápido tab → group
const TAB_TO_GROUP = {};
for (const g of GROUPS) for (const t of g.tabs) TAB_TO_GROUP[t.id] = g.id;

export function Header({ activeTab, setActiveTab, isRunning, progress, globalScore }) {
  const scoreColor = getScoreColor(globalScore);

  // El grupo activo se deriva del tab activo
  const activeGroupId = TAB_TO_GROUP[activeTab] || GROUPS[0].id;
  const activeGroup   = GROUPS.find(g => g.id === activeGroupId) || GROUPS[0];

  const handleTabClick = (tabId) => setActiveTab(tabId);

  const handleGroupClick = (group) => {
    // Si ya estamos en este grupo, no hacer nada
    if (group.id === activeGroupId) return;
    // Ir al primer tab del grupo
    setActiveTab(group.tabs[0].id);
  };

  return (
    <header className="flex-shrink-0 border-b" style={{ background: '#171a21', borderColor: 'rgba(102,192,244,0.1)' }}>

      {/* ── Fila 1: grupos + score ── */}
      <div className="flex items-center px-4" style={{ height: '44px' }}>

        {/* Grupos */}
        <div className="flex items-center gap-1 flex-1">
          {GROUPS.map((group) => {
            const isActive = group.id === activeGroupId;
            const { Icon } = group;
            return (
              <button key={group.id} onClick={() => handleGroupClick(group)}
                className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background:  isActive ? `${group.color}18` : 'transparent',
                  color:       isActive ? group.color : 'rgba(198,212,223,0.55)',
                  border:      isActive ? `1px solid ${group.color}35` : '1px solid transparent',
                }}>
                <Icon className="w-3.5 h-3.5" />
                <span>{group.label}</span>
                {/* Punto activo si hay scan corriendo en este grupo */}
                {isRunning && group.id === 'attack' && (
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#57cbde' }} />
                )}
                {/* Indicador de tab activo bajo el grupo */}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                    style={{ background: group.color }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Progress + Score */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {isRunning && progress?.total > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(102,192,244,0.1)' }}>
                <motion.div className="h-full rounded-full" style={{ background: '#57cbde' }}
                  animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                  transition={{ duration: 0.3 }} />
              </div>
              <span className="text-[10px]" style={{ color: 'rgba(198,212,223,0.6)' }}>
                {progress.current}/{progress.total}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 pl-4" style={{ borderLeft: '1px solid rgba(102,192,244,0.1)' }}>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(143,152,160,0.8)' }}>Score</div>
              <div className="text-sm font-bold leading-none" style={{ color: scoreColor }}>{globalScore}/100</div>
            </div>
            <div className="px-2 py-0.5 rounded text-[9px] font-bold"
              style={{ background: `${scoreColor}20`, color: scoreColor }}>
              {getScoreLabel(globalScore)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Fila 2: sub-tabs del grupo activo ── */}
      <div className="px-4 flex items-center gap-0.5 overflow-x-auto"
        style={{ height: '34px', background: 'rgba(0,0,0,0.15)', scrollbarWidth: 'none' }}>
        <div className="flex items-center gap-0.5">
          {activeGroup.tabs.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button key={id} onClick={() => handleTabClick(id)}
                className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap"
                style={{
                  background: isActive ? `${activeGroup.color}20` : 'transparent',
                  color:      isActive ? activeGroup.color : 'rgba(198,212,223,0.5)',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#c6d4df'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'rgba(198,212,223,0.5)'; }}>
                <Icon className="w-3 h-3" />
                {label}
                {id === 'terminal' && isRunning && (
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#57cbde' }} />
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                    style={{ background: activeGroup.color }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
