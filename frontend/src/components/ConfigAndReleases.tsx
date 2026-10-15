import React from 'react';
import type { SanitizedConfig, ChangeRecord } from '../services/api';
import { Settings, History, GitCommit, Shield, Server, Database } from 'lucide-react';

interface Props {
  config: SanitizedConfig | null;
  changes: ChangeRecord[];
}

export const ConfigAndReleases: React.FC<Props> = ({ config, changes }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Sanitized Runtime Configuration */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-100 tracking-tight">Sanitized Runtime Configuration</h3>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            AI Agent Permitted View
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Configuration exposed via <code className="text-indigo-300">/api/diagnostics/config</code> with credentials safely masked.
        </p>

        {config ? (
          <div className="space-y-3 text-xs">
            {/* App Level */}
            <div className="bg-slate-950/70 border border-slate-800/60 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-400 font-semibold uppercase text-[11px]">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Application Runtime</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                <div>
                  <span className="text-slate-500">Service: </span>
                  <span className="text-slate-200">{config.application.name}</span>
                </div>
                <div>
                  <span className="text-slate-500">Release Version: </span>
                  <span className={`font-bold ${config.application.release_version === 'v2.4.1-rc2' ? 'text-purple-400' : 'text-emerald-400'}`}>
                    {config.application.release_version}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Environment: </span>
                  <span className="text-slate-200">{config.application.environment}</span>
                </div>
                <div>
                  <span className="text-slate-500">Log Level: </span>
                  <span className="text-slate-200">{config.application.log_level}</span>
                </div>
              </div>
            </div>

            {/* Database Config */}
            <div className="bg-slate-950/70 border border-slate-800/60 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-400 font-semibold uppercase text-[11px]">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Database Pool Parameters</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                <div>
                  <span className="text-slate-500">Driver: </span>
                  <span className="text-slate-200">{config.database.driver}</span>
                </div>
                <div>
                  <span className="text-slate-500">Storage Type: </span>
                  <span className="text-slate-200">{config.database.storage_type}</span>
                </div>
                <div>
                  <span className="text-slate-500">Pool Size: </span>
                  <span className="text-slate-200">{config.database.pool_size} conns</span>
                </div>
                <div>
                  <span className="text-slate-500">Query Timeout: </span>
                  <span className="text-slate-200">{config.database.timeout_seconds}s</span>
                </div>
              </div>
            </div>

            {/* Downstream Service Config */}
            <div className="bg-slate-950/70 border border-slate-800/60 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-400 font-semibold uppercase text-[11px]">
                <Server className="w-3.5 h-3.5 text-amber-400" />
                <span>Payment Gateway Integration</span>
              </div>
              <div className="space-y-1.5 pt-1 font-mono">
                <div>
                  <span className="text-slate-500">Target Endpoint: </span>
                  <span className={`break-all ${config.downstream_services.payment_gateway.endpoint_url.includes('invalid') ? 'text-rose-400 font-bold' : 'text-slate-200'}`}>
                    {config.downstream_services.payment_gateway.endpoint_url}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500">Timeout: </span>
                    <span className={`font-bold ${config.downstream_services.payment_gateway.timeout_ms < 100 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {config.downstream_services.payment_gateway.timeout_ms}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Auth Token: </span>
                    <span className="text-slate-400">{config.downstream_services.payment_gateway.auth_token}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-slate-500 text-xs">Loading configuration...</div>
        )}
      </div>

      {/* Release & Configuration Change Timeline */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-100 tracking-tight">Recent Change History</h3>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {changes.length} events
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Inspected by the AI agent via <code className="text-indigo-300">/api/diagnostics/changes</code> to detect correlated anomalies.
        </p>

        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {changes.map((item) => {
            const isFaulty = item.version === 'v2.4.1-rc2';
            const isRollback = item.change_type === 'rollback';

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border text-xs transition-all ${
                  isFaulty
                    ? 'bg-purple-950/20 border-purple-500/40 ring-1 ring-purple-500/30'
                    : isRollback
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : 'bg-slate-950/60 border-slate-800/70'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <GitCommit className={`w-4 h-4 ${isFaulty ? 'text-purple-400' : isRollback ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className="font-bold text-slate-200 font-mono">{item.version}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase ${
                        isFaulty
                          ? 'bg-purple-500/20 text-purple-300'
                          : isRollback
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.change_type}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {item.timestamp.split('T')[0]} {item.timestamp.split('T')[1]?.substring(0, 5)}
                  </span>
                </div>

                <p className="text-slate-300 font-sans mt-1">{item.description}</p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
                  <span>Author: <code className="text-slate-300">{item.author}</code></span>
                  <span className="font-mono text-slate-500">ID: {item.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
