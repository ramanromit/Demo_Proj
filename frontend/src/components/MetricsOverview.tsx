import React from 'react';
import type { TelemetryMetrics } from '../services/api';
import { Activity, Clock, Zap, AlertCircle, TrendingUp, Layers } from 'lucide-react';

interface Props {
  metrics: TelemetryMetrics | null;
  onResetMetrics: () => void;
}

export const MetricsOverview: React.FC<Props> = ({ metrics, onResetMetrics }) => {
  if (!metrics) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-4 gap-4">
          <div className="h-20 bg-slate-800/60 rounded-xl"></div>
          <div className="h-20 bg-slate-800/60 rounded-xl"></div>
          <div className="h-20 bg-slate-800/60 rounded-xl"></div>
          <div className="h-20 bg-slate-800/60 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const errorRate = metrics.traffic.error_rate_percent;
  const isHighError = errorRate > 5.0;
  const isHighLatency = metrics.latency_ms.p95 > 1000;

  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-bold text-slate-100 tracking-tight">Real Telemetry & Metrics</h3>
          <span className="text-xs text-slate-400 ml-2 font-mono">
            Uptime: {metrics.uptime_seconds}s
          </span>
        </div>
        <button
          onClick={onResetMetrics}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
        >
          Reset Counters
        </button>
      </div>

      {/* Top Counters Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Requests */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase">
            <span>Total Requests</span>
            <Layers className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-100">
              {metrics.traffic.total_requests.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-emerald-400/90 mt-1 font-mono">
            {metrics.traffic.successful_requests} successful (2xx)
          </p>
        </div>

        {/* Server Failures */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase">
            <span>Server Errors (5xx)</span>
            <AlertCircle className={`w-4 h-4 ${metrics.traffic.server_errors_5xx > 0 ? 'text-rose-400' : 'text-slate-500'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${metrics.traffic.server_errors_5xx > 0 ? 'text-rose-400' : 'text-slate-100'}`}>
              {metrics.traffic.server_errors_5xx.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            {metrics.traffic.client_errors_4xx} client errors (4xx)
          </p>
        </div>

        {/* Error Rate */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase">
            <span>Error Rate</span>
            <TrendingUp className={`w-4 h-4 ${isHighError ? 'text-rose-400' : 'text-emerald-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${isHighError ? 'text-rose-400' : 'text-emerald-400'}`}>
              {errorRate.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Window (120s): <span className="font-mono text-slate-300">{metrics.rolling_window_120s.error_rate_percent}%</span>
          </p>
        </div>

        {/* p95 Response Latency */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase">
            <span>p95 Latency</span>
            <Clock className={`w-4 h-4 ${isHighLatency ? 'text-amber-400' : 'text-indigo-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${isHighLatency ? 'text-amber-400' : 'text-indigo-300'}`}>
              {metrics.latency_ms.p95}ms
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Avg: <span className="font-mono text-slate-300">{metrics.latency_ms.avg}ms</span> | Max: <span className="font-mono text-slate-300">{metrics.latency_ms.max}ms</span>
          </p>
        </div>
      </div>

      {/* Latency Percentiles Breakdown */}
      <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          Measured Latency Distribution (Rolling 120s Window)
        </h4>
        <div className="grid grid-cols-5 gap-2 text-center">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
            <p className="text-[11px] text-slate-400 uppercase">Average</p>
            <p className="text-base font-bold font-mono text-slate-200 mt-0.5">{metrics.latency_ms.avg}ms</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
            <p className="text-[11px] text-slate-400 uppercase">p50 (Median)</p>
            <p className="text-base font-bold font-mono text-slate-200 mt-0.5">{metrics.latency_ms.p50}ms</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
            <p className="text-[11px] text-slate-400 uppercase">p90</p>
            <p className="text-base font-bold font-mono text-slate-200 mt-0.5">{metrics.latency_ms.p90}ms</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
            <p className="text-[11px] text-slate-400 uppercase">p95</p>
            <p className={`text-base font-bold font-mono mt-0.5 ${metrics.latency_ms.p95 > 1000 ? 'text-amber-400' : 'text-slate-200'}`}>
              {metrics.latency_ms.p95}ms
            </p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
            <p className="text-[11px] text-slate-400 uppercase">Max</p>
            <p className={`text-base font-bold font-mono mt-0.5 ${metrics.latency_ms.max > 1000 ? 'text-amber-400' : 'text-slate-200'}`}>
              {metrics.latency_ms.max}ms
            </p>
          </div>
        </div>
      </div>

      {/* Endpoint Table */}
      {Object.keys(metrics.endpoints).length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2 font-medium uppercase">Endpoint</th>
                <th className="pb-2 font-medium uppercase text-right">Calls</th>
                <th className="pb-2 font-medium uppercase text-right">Errors</th>
                <th className="pb-2 font-medium uppercase text-right">Error %</th>
                <th className="pb-2 font-medium uppercase text-right">Avg Latency</th>
                <th className="pb-2 font-medium uppercase text-right">Max Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {Object.entries(metrics.endpoints).map(([endpoint, stat]) => (
                <tr key={endpoint} className="hover:bg-slate-800/30">
                  <td className="py-2.5 text-slate-300 font-sans">{endpoint}</td>
                  <td className="py-2.5 text-right text-slate-200">{stat.total_calls}</td>
                  <td className={`py-2.5 text-right ${stat.error_calls > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                    {stat.error_calls}
                  </td>
                  <td className={`py-2.5 text-right ${stat.error_rate_pct > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {stat.error_rate_pct}%
                  </td>
                  <td className={`py-2.5 text-right ${stat.avg_latency_ms > 1000 ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                    {stat.avg_latency_ms}ms
                  </td>
                  <td className="py-2.5 text-right text-slate-400">{stat.max_latency_ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
