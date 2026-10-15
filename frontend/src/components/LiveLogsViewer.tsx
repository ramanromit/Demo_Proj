import React, { useState } from 'react';
import type { LogEntry } from '../services/api';
import { Terminal, Search, ChevronDown, ChevronRight, Copy, Check, RefreshCw } from 'lucide-react';

interface Props {
  logs: LogEntry[];
  selectedLevel: string;
  onLevelChange: (level: string) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const LiveLogsViewer: React.FC<Props> = ({
  logs,
  selectedLevel,
  onLevelChange,
  searchTerm,
  onSearchChange,
  onRefresh,
  loading,
}) => {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const copyLog = (log: LogEntry) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLevelBadge = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'WARNING':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-bold text-slate-100 tracking-tight">Application Telemetry Logs</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {logs.length} entries
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Level Filter Buttons */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
            {['ALL', 'INFO', 'WARNING', 'ERROR'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => onLevelChange(lvl === 'ALL' ? '' : lvl)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  (lvl === 'ALL' && !selectedLevel) || selectedLevel === lvl
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search logs & stack traces..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48 sm:w-60"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Log Feed */}
      <div className="bg-slate-950/90 border border-slate-800/80 rounded-xl overflow-hidden font-mono text-xs">
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/50">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-sans">
              No matching application logs found.
            </div>
          ) : (
            logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const isError = log.level === 'ERROR' || log.level === 'CRITICAL';
              const isWarning = log.level === 'WARNING';

              return (
                <div
                  key={log.id}
                  className={`p-3 transition-colors ${
                    isExpanded ? 'bg-slate-900/60' : 'hover:bg-slate-900/30'
                  } ${isError ? 'border-l-2 border-l-rose-500' : isWarning ? 'border-l-2 border-l-amber-500' : ''}`}
                >
                  <div
                    onClick={() => toggleExpand(log.id)}
                    className="flex items-start gap-2.5 cursor-pointer select-none"
                  >
                    <button className="text-slate-500 mt-0.5 hover:text-slate-300">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <span className="text-slate-500 shrink-0 text-[11px]">
                      {log.timestamp.split('T')[1]?.replace('Z', '') || log.timestamp}
                    </span>

                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold border shrink-0 ${getLevelBadge(
                        log.level
                      )}`}
                    >
                      {log.level}
                    </span>

                    <span className="text-indigo-400 font-semibold shrink-0 text-[11px]">
                      [{log.service}]
                    </span>

                    {log.endpoint && (
                      <span className="text-slate-400 shrink-0 text-[11px]">
                        {log.method} {log.endpoint}
                      </span>
                    )}

                    <span className={`truncate flex-1 ${isError ? 'text-rose-200 font-medium' : isWarning ? 'text-amber-200' : 'text-slate-300'}`}>
                      {log.message}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyLog(log);
                      }}
                      className="text-slate-500 hover:text-slate-300 p-1 shrink-0"
                      title="Copy JSON entry"
                    >
                      {copiedId === log.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Traceback / Details View */}
                  {isExpanded && (
                    <div className="mt-3 pl-6 pr-2 pt-2 border-t border-slate-800/60 space-y-2 text-slate-300">
                      {log.error_type && (
                        <div>
                          <span className="text-slate-500">Exception Type: </span>
                          <span className="text-rose-400 font-bold">{log.error_type}</span>
                        </div>
                      )}

                      {log.details && Object.keys(log.details).length > 0 && (
                        <div>
                          <span className="text-slate-500">Context: </span>
                          <span className="text-slate-400">{JSON.stringify(log.details)}</span>
                        </div>
                      )}

                      {log.traceback && (
                        <div className="mt-2">
                          <p className="text-slate-500 text-[11px] uppercase tracking-wider mb-1 font-sans font-semibold">
                            Authentic Traceback (Observable to AI Agent):
                          </p>
                          <pre className="p-3 bg-black/60 rounded-lg text-rose-300 text-[11px] overflow-x-auto border border-rose-950/50 whitespace-pre leading-relaxed">
                            {log.traceback}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
