import React, { useState } from 'react';
import type { ControlStatus } from '../services/api';
import { AlertOctagon, RotateCcw, Database, Clock, GitCommit, CheckCircle2, ShieldAlert } from 'lucide-react';

interface Props {
  controlStatus: ControlStatus | null;
  onInjectDbFault: (type: string) => Promise<void>;
  onInjectLatencyFault: (delayMs: number) => Promise<void>;
  onInjectReleaseFault: () => Promise<void>;
  onResetToHealthy: () => Promise<void>;
  loadingAction: boolean;
}

export const FaultControlPanel: React.FC<Props> = ({
  controlStatus,
  onInjectDbFault,
  onInjectLatencyFault,
  onInjectReleaseFault,
  onResetToHealthy,
  loadingAction,
}) => {
  const [latencyInput, setLatencyInput] = useState<number>(2500);

  const dbActive = controlStatus?.faults.database_failure.active ?? false;
  const latencyActive = controlStatus?.faults.high_latency.active ?? false;
  const releaseActive = controlStatus?.faults.faulty_release.active ?? false;

  const anyFaultActive = dbActive || latencyActive || releaseActive;

  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header and Active Fault Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-slate-100 tracking-tight">Fault Injection Control Engine</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Trigger controlled real faults for your DevOps Agent to investigate, diagnose, and remediate.
          </p>
        </div>

        {/* Global Reset Button */}
        <button
          onClick={onResetToHealthy}
          disabled={loadingAction}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg ${
            anyFaultActive
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
          }`}
        >
          <RotateCcw className={`w-4 h-4 ${loadingAction ? 'animate-spin' : ''}`} />
          <span>Reset to Healthy Baseline</span>
        </button>
      </div>

      {/* Confirmation Banner */}
      <div
        className={`px-4 py-3 rounded-xl border flex items-center gap-3 transition-colors ${
          anyFaultActive
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
        }`}
      >
        {anyFaultActive ? (
          <>
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold uppercase tracking-wider text-rose-400">Active Injected Fault: </span>
              {dbActive && <span className="font-semibold text-rose-200">Database Connection Failure (Pool Exhausted) </span>}
              {latencyActive && (
                <span className="font-semibold text-amber-200">
                  Artificial High Latency ({controlStatus?.faults.high_latency.delay_ms}ms on {controlStatus?.faults.high_latency.target_endpoint}){' '}
                </span>
              )}
              {releaseActive && (
                <span className="font-semibold text-purple-200">
                  Faulty Release Active ({controlStatus?.faults.faulty_release.current_version} with bad payment gateway config){' '}
                </span>
              )}
              <span className="text-slate-400 block mt-0.5">
                Observable symptoms are currently propagating to application logs, health checks, and metrics.
              </span>
            </div>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold uppercase tracking-wider text-emerald-400">Baseline Normal: </span>
              <span className="text-slate-300">No faults injected. All subsystems and dependencies responding nominally.</span>
            </div>
          </>
        )}
      </div>

      {/* 3 Repeatable Fault Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Fault A: Database Connection Failure */}
        <div
          className={`border rounded-xl p-5 flex flex-col justify-between transition-all ${
            dbActive
              ? 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-950/20 ring-1 ring-rose-500/30'
              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700/80'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className={`w-4 h-4 ${dbActive ? 'text-rose-400' : 'text-slate-400'}`} />
                <h4 className="text-sm font-bold text-slate-100">A. Database Connection Failure</h4>
              </div>
              <span
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                  dbActive
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {dbActive ? 'FAULT ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
              Causes SQLite connection pool exhaustion / connection refusal on queries. Degrades health to 503 and logs genuine tracebacks.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/60 space-y-3">
            <button
              onClick={() => onInjectDbFault('connection_refused')}
              disabled={loadingAction || dbActive}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                dbActive
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-900/30'
              }`}
            >
              {dbActive ? 'Database Fault Injected' : 'Inject Database Failure'}
            </button>
          </div>
        </div>

        {/* Fault B: High Latency */}
        <div
          className={`border rounded-xl p-5 flex flex-col justify-between transition-all ${
            latencyActive
              ? 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/30'
              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700/80'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${latencyActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <h4 className="text-sm font-bold text-slate-100">B. High Endpoint Latency</h4>
              </div>
              <span
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                  latencyActive
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {latencyActive ? `${controlStatus?.faults.high_latency.delay_ms}ms DELAY` : 'INACTIVE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
              Injects artificial processing delay into <code className="text-amber-300">/api/checkout</code>. Measures response time and records SLA breach warnings in telemetry.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/60 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-slate-400 font-medium">Delay (ms):</label>
              <input
                type="number"
                min="200"
                max="10000"
                step="200"
                value={latencyInput}
                onChange={(e) => setLatencyInput(Number(e.target.value))}
                className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-right font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={() => onInjectLatencyFault(latencyInput)}
              disabled={loadingAction || latencyActive}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                latencyActive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-not-allowed'
                  : 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-900/30'
              }`}
            >
              {latencyActive ? 'Latency Fault Injected' : `Inject ${latencyInput}ms Delay`}
            </button>
          </div>
        </div>

        {/* Fault C: Faulty Release / Config */}
        <div
          className={`border rounded-xl p-5 flex flex-col justify-between transition-all ${
            releaseActive
              ? 'bg-purple-950/20 border-purple-500/40 shadow-lg shadow-purple-950/20 ring-1 ring-purple-500/30'
              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700/80'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitCommit className={`w-4 h-4 ${releaseActive ? 'text-purple-400' : 'text-slate-400'}`} />
                <h4 className="text-sm font-bold text-slate-100">C. Faulty Demo Release</h4>
              </div>
              <span
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                  releaseActive
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {releaseActive ? 'v2.4.1-rc2 ACTIVE' : 'v2.4.0 STABLE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
              Deploys faulty release <code className="text-purple-300">v2.4.1-rc2</code> with invalid payment gateway URL and 25ms timeout. Records entry in change history and causes 502 Bad Gateway.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/60 space-y-3">
            <button
              onClick={onInjectReleaseFault}
              disabled={loadingAction || releaseActive}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                releaseActive
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30'
              }`}
            >
              {releaseActive ? 'Release v2.4.1-rc2 Active' : 'Deploy Faulty Release (v2.4.1-rc2)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
