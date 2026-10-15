import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import type {
  HealthResponse,
  TelemetryMetrics,
  LogEntry,
  ControlStatus,
  SanitizedConfig,
  ChangeRecord,
} from './services/api';
import { HealthStatusCard } from './components/HealthStatusCard';
import { FaultControlPanel } from './components/FaultControlPanel';
import { MetricsOverview } from './components/MetricsOverview';
import { LiveLogsViewer } from './components/LiveLogsViewer';
import { ConfigAndReleases } from './components/ConfigAndReleases';
import { EndpointTester } from './components/EndpointTester';
import { TrafficSimulator } from './components/TrafficSimulator';
import { Cpu, RefreshCw, ExternalLink, BookOpen } from 'lucide-react';

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [controlStatus, setControlStatus] = useState<ControlStatus | null>(null);
  const [metrics, setMetrics] = useState<TelemetryMetrics | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [config, setConfig] = useState<SanitizedConfig | null>(null);
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [trafficRunning, setTrafficRunning] = useState<boolean>(false);
  const [trafficCount, setTrafficCount] = useState<number>(0);

  const [logLevel, setLogLevel] = useState<string>('');
  const [logSearch, setLogSearch] = useState<string>('');
  const [loadingAction, setLoadingAction] = useState<boolean>(false);
  const [isAutoPolling, setIsAutoPolling] = useState<boolean>(true);

  // Polling data fetcher
  const fetchAllData = useCallback(async () => {
    try {
      const [hData, cData, mData, lData, cfgData, chgData, tData] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getControlStatus().catch(() => null),
        api.getMetrics().catch(() => null),
        api.getLogs({ level: logLevel, search: logSearch, limit: 60 }).catch(() => ({ count: 0, logs: [] })),
        api.getConfig().catch(() => null),
        api.getChanges().catch(() => ({ total_records: 0, active_release: 'v2.4.0', recent_changes: [] })),
        api.getTrafficStatus().catch(() => ({ running: false, requests_generated: 0, interval_seconds: 2 })),
      ]);

      if (hData) setHealth(hData);
      if (cData) setControlStatus(cData);
      if (mData) setMetrics(mData);
      if (lData?.logs) setLogs(lData.logs);
      if (cfgData) setConfig(cfgData);
      if (chgData?.recent_changes) setChanges(chgData.recent_changes);
      if (tData) {
        setTrafficRunning(tData.running);
        setTrafficCount(tData.requests_generated);
      }
    } catch (e) {
      console.error('Data poll error:', e);
    }
  }, [logLevel, logSearch]);

  // Initial load & Polling interval (every 2.5 seconds)
  useEffect(() => {
    fetchAllData();
    if (!isAutoPolling) return;
    const interval = setInterval(fetchAllData, 2500);
    return () => clearInterval(interval);
  }, [fetchAllData, isAutoPolling]);

  // Fault Action Handlers
  const handleInjectDbFault = async (type: string) => {
    setLoadingAction(true);
    await api.injectDatabaseFault(type);
    await fetchAllData();
    setLoadingAction(false);
  };

  const handleInjectLatencyFault = async (delayMs: number) => {
    setLoadingAction(true);
    await api.injectLatencyFault(delayMs);
    await fetchAllData();
    setLoadingAction(false);
  };

  const handleInjectReleaseFault = async () => {
    setLoadingAction(true);
    await api.injectFaultyRelease('v2.4.1-rc2');
    await fetchAllData();
    setLoadingAction(false);
  };

  const handleResetToHealthy = async () => {
    setLoadingAction(true);
    await api.resetToHealthy();
    await fetchAllData();
    setLoadingAction(false);
  };

  const handleResetMetrics = async () => {
    await api.resetMetrics();
    await fetchAllData();
  };

  const handleToggleTraffic = async () => {
    setLoadingAction(true);
    const res = await api.toggleTraffic();
    setTrafficRunning(res.traffic_running);
    await fetchAllData();
    setLoadingAction(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-950/50">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-100 tracking-tight">OrderFlow Demo Target</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                DevOps Agent Target
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Live Controlled Failure & Telemetry Environment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto poll indicator */}
          <button
            onClick={() => setIsAutoPolling(!isAutoPolling)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isAutoPolling
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Toggle live telemetry polling"
          >
            <span className={`w-2 h-2 rounded-full ${isAutoPolling ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>{isAutoPolling ? 'Live Polling' : 'Paused'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={fetchAllData}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Swagger / OpenAPI Docs Link */}
          <a
            href="http://127.0.0.1:8080/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>OpenAPI Docs</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
          </a>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* 1. Health Status Overview */}
        <HealthStatusCard health={health} loading={!health} />

        {/* 2. Background Traffic Generator */}
        <TrafficSimulator
          running={trafficRunning}
          requestCount={trafficCount}
          onToggle={handleToggleTraffic}
          loading={loadingAction}
        />

        {/* 3. Controlled Fault Injection Controls */}
        <FaultControlPanel
          controlStatus={controlStatus}
          onInjectDbFault={handleInjectDbFault}
          onInjectLatencyFault={handleInjectLatencyFault}
          onInjectReleaseFault={handleInjectReleaseFault}
          onResetToHealthy={handleResetToHealthy}
          loadingAction={loadingAction}
        />

        {/* 4. Real Request Telemetry & Metrics */}
        <MetricsOverview metrics={metrics} onResetMetrics={handleResetMetrics} />

        {/* 5. Interactive Test Bench */}
        <EndpointTester onExecuted={fetchAllData} />

        {/* 6. Live Structured Application Logs */}
        <LiveLogsViewer
          logs={logs}
          selectedLevel={logLevel}
          onLevelChange={setLogLevel}
          searchTerm={logSearch}
          onSearchChange={setLogSearch}
          onRefresh={fetchAllData}
          loading={loadingAction}
        />

        {/* 7. Sanitized Configuration & Change History */}
        <ConfigAndReleases config={config} changes={changes} />
      </main>

      {/* Footer & Integration Reference */}
      <footer className="mt-12 border-t border-slate-800 bg-slate-900/60 px-6 py-6 text-xs text-slate-400 text-center">
        <div className="max-w-4xl mx-auto space-y-2">
          <p className="font-semibold text-slate-300">
            OrderFlow DevOps Incident-Response Demo Application
          </p>
          <p className="text-slate-400">
            Diagnostic endpoints exposed for external AI Agent tools:{' '}
            <code className="text-indigo-400">/api/diagnostics/health</code>,{' '}
            <code className="text-indigo-400">/api/diagnostics/logs</code>,{' '}
            <code className="text-indigo-400">/api/diagnostics/metrics</code>,{' '}
            <code className="text-indigo-400">/api/diagnostics/config</code>,{' '}
            <code className="text-indigo-400">/api/diagnostics/changes</code>,{' '}
            <code className="text-indigo-400">/api/diagnostics/overview</code>.
          </p>
          <p className="text-slate-500 text-[11px]">
            Backend: Python 3.13 / FastAPI | Frontend: React 19 / TypeScript / Vite / Tailwind CSS
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
