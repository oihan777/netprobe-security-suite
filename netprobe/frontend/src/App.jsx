import { useState, useEffect } from 'react';
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
import { useWebSocket } from './hooks/useWebSocket.js';
import { useAI } from './hooks/useAI.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';

export default function App() {
  const [activeTab, setActiveTab]         = useState('modules');
  const [target, setTarget]               = useLocalStorage('np-target', '');
  const [apiKey, setApiKey]               = useLocalStorage('np-apikey', '');
  const [selectedModules, setSelectedModules] = useState([]);
  const [intensity, setIntensity]         = useState(3);
  const [duration, setDuration]           = useState(30);
  const [legalAccepted, setLegalAccepted] = useLocalStorage('np-legal', false);

  const ws = useWebSocket();
  const ai = useAI(apiKey);

  // Auto-analyze on scan complete
  useEffect(() => {
    if (!ws.isRunning && ws.results.length > 0 && ai.messages.length === 0) {
      ai.sendMessage(
        'El scan ha finalizado. Proporciona un análisis ejecutivo rápido con los hallazgos más importantes.',
        ws.results, target, selectedModules
      );
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

  return (
    <div className="h-screen flex overflow-hidden bg-black text-white">
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
                  {activeTab === 'topology'  && <NetworkTopology onSetTarget={setTarget} />}
                  {activeTab === 'modules'  && <ModulesGrid selectedModules={selectedModules} setSelectedModules={setSelectedModules} results={ws.results} />}
                  {activeTab === 'terminal' && <Terminal logs={ws.logs} isRunning={ws.isRunning} progress={ws.progress} onClear={ws.clearLogs} onRunCommand={ws.runCommand} results={ws.results} />}
                  {activeTab === 'results'  && <Results results={ws.results} globalScore={ws.calculateScore()} apiKey={apiKey} />}
                  {activeTab === 'ai'       && <AIAnalyst messages={ai.messages} isLoading={ai.isLoading} isStreaming={ai.isStreaming} usage={ai.usage} error={ai.error} onSendMessage={(m, model) => ai.sendMessage(m, ws.results, target, selectedModules)} onGenerateReport={() => { setActiveTab('ai'); ai.generateReport(ws.results, target, selectedModules); }} onCancel={ai.cancelRequest} quickPrompts={ai.quickPrompts} onClear={ai.clearMessages} apiKey={apiKey} onValidateKey={ai.validateKey} />}
                  {activeTab === 'cve'       && <CVEPanel results={ws.results} />}
                  {activeTab === 'autopilot' && <AutopilotPanel results={ws.results} apiKey={apiKey} onLaunchModules={(mods) => { setSelectedModules(mods); setActiveTab('modules'); }} />}
                  {activeTab === 'scheduler' && <SchedulerPanel selectedModules={selectedModules} />}
                  {activeTab === 'report'   && <Report results={ws.results} target={target} globalScore={ws.calculateScore()} onGenerateAIReport={() => { setActiveTab('ai'); ai.generateReport(ws.results, target, selectedModules); }} />}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </>
      )}
    </div>
  );
}
