import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './components/layout/Sidebar.jsx';
import { Header } from './components/layout/Header.jsx';
import { ModulesGrid } from './components/modules/ModulesGrid.jsx';
import { Terminal } from './components/terminal/Terminal.jsx';
import { Results } from './components/results/Results.jsx';
import { CVEPanel } from './components/cve/CVEPanel.jsx';
import { AutopilotPanel } from './components/autopilot/AutopilotPanel.jsx';
import { SchedulerPanel } from './components/scheduler/SchedulerPanel.jsx';
import { AIAnalyst } from './components/ai/AIAnalyst.jsx';
import { Report } from './components/report/Report.jsx';
import { NetworkTopology } from './components/topology/NetworkTopology.jsx';
import { LegalBanner } from './components/ui/LegalBanner.jsx';
import { Dashboard } from './components/dashboard/Dashboard.jsx';
import { CampaignPanel } from './components/campaign/CampaignPanel.jsx';
import { OSINTPanel } from './components/osint/OSINTPanel.jsx';
import { LogAnalyzerPanel } from './components/logs/LogAnalyzerPanel.jsx';
import { RevShellPanel } from './components/revshell/RevShellPanel.jsx';
import { IDSRulesPanel } from './components/ids/IDSRulesPanel.jsx';
import { PayloadPanel } from './components/payloads/PayloadPanel.jsx';
import { STRIDEPanel } from './components/stride/STRIDEPanel.jsx';
import { NetworkTopologyMap } from './components/topology/NetworkTopologyMap.jsx';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useAI } from './hooks/useAI.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { CaseManager } from './components/cases/CaseManager.jsx';

export default function App() {
  const [activeTab, setActiveTab]         = useState('modules');
  const [target, setTarget]               = useLocalStorage('np-target', '');
  const [apiKey, setApiKey]               = useLocalStorage('np-apikey', '');
  const [selectedModules, setSelectedModules] = useState([]);
  const [intensity, setIntensity]         = useState(3);
  const [duration, setDuration]           = useState(30);
  const [legalAccepted, setLegalAccepted] = useLocalStorage('np-legal', false);
  const [activeCase,     setActiveCase]     = useLocalStorage('np-active-case', null);

  const [discoveredHosts, setDiscoveredHosts] = useState(() => {
    try {
      const cid = JSON.parse(localStorage.getItem('np-active-case') || 'null')?.id;
      const key = cid ? `np-hosts-${cid}` : 'np-hosts';
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch { return []; }
  });

  const ws = useWebSocket(activeCase?.id || null);
  const ai = useAI(apiKey, 'llama-3.3-70b-versatile', activeCase?.id || null);

  // Auto-analyze ONLY when a scan actually finishes in this session
  const wasScanRunning = useRef(false);
  useEffect(() => {
    if (ws.isRunning) {
      wasScanRunning.current = true;
    } else if (wasScanRunning.current && ws.results.length > 0) {
      wasScanRunning.current = false;
      // Solo auto-analizar si el chat está vacío (no interrumpir conversaciones previas)
      if (ai.messages.length === 0) {
        ai.sendMessage(
          'El scan ha finalizado. Proporciona un análisis ejecutivo rápido con los hallazgos más importantes.',
          ws.results, target, selectedModules
        );
      }
    }
  }, [ws.isRunning]);

  const handleStartScan = () => {
    if (!target || !selectedModules.length) return;
    ws.startScan({ target, modules: selectedModules, intensity, duration });
    setActiveTab('terminal');
  };

  const handleNewScan = () => {
    if (!target || !selectedModules.length) return;
    ws.clearAndStartScan({ target, modules: selectedModules, intensity, duration });
    setActiveTab('terminal');
  };

  // Reload hosts when case changes
  useEffect(() => {
    try {
      const key = activeCase?.id ? `np-hosts-${activeCase.id}` : 'np-hosts';
      setDiscoveredHosts(JSON.parse(localStorage.getItem(key) || '[]'));
    } catch { setDiscoveredHosts([]); }
  }, [activeCase?.id]);

  if (!activeCase) {
    return <CaseManager onSelectCase={(c) => { setActiveCase(c); if (c.target) setTarget(c.target); }} />;
  }

  return (
    <div className="h-screen flex overflow-hidden text-white" style={{ background: '#1b2838' }}>
      <AnimatePresence>
        {!legalAccepted && <LegalBanner onAccept={() => setLegalAccepted(true)} />}
      </AnimatePresence>

      {legalAccepted && (
        <>
          <Sidebar
            target={target} setTarget={setTarget}
            apiKey={apiKey} setApiKey={setApiKey}
            selectedModules={selectedModules} setSelectedModules={setSelectedModules}
            intensity={intensity} setIntensity={setIntensity}
            duration={duration} setDuration={setDuration}
            onStartScan={handleStartScan} onNewScan={handleNewScan} onStopScan={ws.stopScan} resultCount={ws.results.length}
            isRunning={ws.isRunning} connectionStatus={ws.connectionStatus}
            activeCase={activeCase} onChangeCase={() => setActiveCase(null)}
            caseId={activeCase?.id || null} onHostsChange={setDiscoveredHosts}
          />

          <div className="flex-1 flex flex-col overflow-hidden">
            <Header
              activeTab={activeTab} setActiveTab={setActiveTab}
              isRunning={ws.isRunning} progress={ws.progress}
              globalScore={ws.calculateScore()}
            />

            <main className="flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} className="h-full"
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  transition={{ duration:0.15 }}>
                  {activeTab === 'dashboard' && <Dashboard currentResults={ws.results} currentScore={ws.results.length ? ws.calculateScore() : null} currentTarget={target} caseId={activeCase?.id || null} discoveredHosts={discoveredHosts} />}
                  {activeTab === 'topology'  && <NetworkTopologyMap hosts={discoveredHosts} onScanHost={(ip) => { setTarget(ip); setActiveTab('modules'); }} />}
                  {activeTab === 'osint'     && <OSINTPanel target={target} />}
                  {activeTab === 'logs'      && <LogAnalyzerPanel groqKey={apiKey} />}
                  {activeTab === 'modules'  && <ModulesGrid selectedModules={selectedModules} setSelectedModules={setSelectedModules} results={ws.results} />}
                  {activeTab === 'terminal' && <Terminal logs={ws.logs} isRunning={ws.isRunning} progress={ws.progress} onClear={ws.clearLogs} onRunCommand={ws.runCommand} results={ws.results} />}
                  {activeTab === 'results'  && <Results results={ws.results} globalScore={ws.calculateScore()} apiKey={apiKey} target={target} />}
                  {activeTab === 'ai'       && <AIAnalyst messages={ai.messages} isLoading={ai.isLoading} isStreaming={ai.isStreaming} usage={ai.usage} error={ai.error} onSendMessage={(m, model) => ai.sendMessage(m, ws.results, target, selectedModules)} onGenerateReport={() => { setActiveTab('ai'); ai.generateReport(ws.results, target, selectedModules); }} onCancel={ai.cancelRequest} quickPrompts={ai.quickPrompts} onClear={ai.clearMessages} apiKey={apiKey} onValidateKey={ai.validateKey} />}
                  {activeTab === 'cve'       && <CVEPanel results={ws.results} />}
                  {activeTab === 'autopilot' && <AutopilotPanel results={ws.results} apiKey={apiKey} onLaunchModules={(mods) => { setSelectedModules(mods); setActiveTab('modules'); }} />}
                  {activeTab === 'scheduler' && <SchedulerPanel selectedModules={selectedModules} />}
                  {activeTab === 'campaign'  && <CampaignPanel ws={ws} selectedModules={selectedModules} intensity={intensity} duration={duration} />}
                  {activeTab === 'report'   && <Report results={ws.results} target={target} globalScore={ws.calculateScore()} onGenerateAIReport={() => { setActiveTab('ai'); ai.generateReport(ws.results, target, selectedModules); }} />}
                  {activeTab === 'revshell' && <RevShellPanel target={target} apiKey={apiKey} />}
                  {activeTab === 'payloads' && <PayloadPanel apiKey={apiKey} />}
                  {activeTab === 'stride'   && <STRIDEPanel apiKey={apiKey} results={ws.results} target={target} onRunCommand={ws.runCommand} onGoToTerminal={() => setActiveTab('terminal')} caseId={activeCase?.id || null} />}
                  {activeTab === 'ids'      && <IDSRulesPanel results={ws.results} target={target} apiKey={apiKey} />}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </>
      )}
    </div>
  );
}
