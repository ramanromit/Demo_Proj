import React from 'react';
import type { HealthResponse } from '../services/api';
import { CheckCircle2, AlertTriangle, XCircle, Database, Server, ShieldCheck } from 'lucide-react';

interface Props {
  health: HealthResponse | null;
  loading: boolean;
}

export const HealthStatusCard: React.FC<Props> = ({ health, loading }) => {
  if (!health && loading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-1/4 mb-4"></div>
        <div className="h-4 bg-slate-800 rounded w-1/2"></div>
      </div>
    );
  }

  const isHealthy = health?.status === 'healthy';
  const isDegraded = health?.status === 'degraded';

  const statusBg = isHealthy
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
    : isDegraded
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
    : 'bg-rose-500/10 border-rose-500/30 text-rose-400';

  const StatusIcon = isHealthy ? CheckCircle2 : isDegraded ? AlertTriangle : XCircle;

  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md relative overflow-hidden">
      {/* Background glow */}
      <div
        className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none ${
          isHealthy ? 'bg-emerald-500' : isDegraded ? 'bg-amber-500' : 'bg-rose-500'
        }`}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">OrderFlow Target Service</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {health?.release_version || 'v2.4.0'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
              {health?.environment || 'demo-staging'}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Controlled fault injection target for external DevOps Incident-Response Agent
          </p>
        </div>

        {/* Status Badge */}
        <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border font-semibold text-sm ${statusBg}`}>
          <StatusIcon className="w-5 h-5 animate-pulse-subtle" />
          <span className="uppercase tracking-wider">
            {health?.status ? health.status : 'Unknown'}
          </span>
        </div>
      </div>

      {/* Subsystem Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* Database Component */}
        <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-4 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-slate-800 text-slate-300">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Data Store</p>
              <h4 className="text-sm font-semibold text-slate-200 mt-0.5">SQLite Isolation Pool</h4>
              <p className="text-xs text-slate-400 mt-1">
                Latency: <span className="text-slate-200 font-mono">{health?.dependencies.database.latency_ms ?? 0}ms</span>
              </p>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
              health?.dependencies.database.connected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            {health?.dependencies.database.connected ? 'Connected' : 'Offline'}
          </span>
        </div>

        {/* Downstream Payment Gateway */}
        <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-4 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-slate-800 text-slate-300">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Downstream Service</p>
              <h4 className="text-sm font-semibold text-slate-200 mt-0.5">Payment Gateway API</h4>
              <p className="text-xs text-slate-400 mt-1 truncate max-w-[160px]" title={health?.dependencies.downstream_services.payment_gateway.target_endpoint}>
                {health?.dependencies.downstream_services.payment_gateway.target_endpoint}
              </p>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
              health?.dependencies.downstream_services.payment_gateway.status === 'healthy'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {health?.dependencies.downstream_services.payment_gateway.status === 'healthy' ? 'Valid' : 'Config Error'}
          </span>
        </div>

        {/* API Runtime Service */}
        <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-4 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-slate-800 text-slate-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">HTTP Engine</p>
              <h4 className="text-sm font-semibold text-slate-200 mt-0.5">FastAPI Core</h4>
              <p className="text-xs text-slate-400 mt-1">
                Port: <span className="font-mono text-slate-200">8000</span> | Uptime active
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Listening
          </span>
        </div>
      </div>
    </div>
  );
};
