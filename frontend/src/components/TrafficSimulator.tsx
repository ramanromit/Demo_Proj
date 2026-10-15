import React from 'react';
import { Play, Square, Radio } from 'lucide-react';

interface Props {
  running: boolean;
  requestCount: number;
  onToggle: () => Promise<void>;
  loading: boolean;
}

export const TrafficSimulator: React.FC<Props> = ({
  running,
  requestCount,
  onToggle,
  loading,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl border ${running ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
          <Radio className={`w-5 h-5 ${running ? 'animate-pulse' : ''}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-100">Live Traffic Simulator</h4>
            <span
              className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                running
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {running ? 'Streaming' : 'Idle'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Generates realistic background user traffic (~0.5 req/sec) to continuously feed telemetry & logs.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-[11px] text-slate-500 uppercase font-medium">Generated Traffic</p>
          <p className="text-sm font-bold font-mono text-slate-200">{requestCount.toLocaleString()} reqs</p>
        </div>

        <button
          onClick={onToggle}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            running
              ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-900/30'
          }`}
        >
          {running ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Simulator</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Simulator</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
