import React, { useState } from 'react';
import { api } from '../services/api';
import { Play, Clock, Send } from 'lucide-react';

interface Props {
  onExecuted: () => void;
}

export const EndpointTester: React.FC<Props> = ({ onExecuted }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<{
    endpoint: string;
    status: number;
    statusText: string;
    durationMs: number;
    data: any;
  } | null>(null);

  const executeTest = async (endpoint: string, method: string = 'GET', body?: any) => {
    setLoading(true);
    const res = await api.testEndpoint(endpoint, method, body);
    setResult({
      endpoint: `${method} ${endpoint}`,
      status: res.status,
      statusText: res.statusText,
      durationMs: res.durationMs,
      data: res.data,
    });
    setLoading(false);
    onExecuted();
  };

  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Send className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-bold text-slate-100 tracking-tight">Interactive Endpoint Test Bench</h3>
        </div>
        <span className="text-xs text-slate-400">
          Trigger live requests to observe symptoms in real-time
        </span>
      </div>

      {/* Button Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Test Health */}
        <button
          onClick={() => executeTest('/health', 'GET')}
          disabled={loading}
          className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 transition-all text-left"
        >
          <div>
            <span className="text-xs font-semibold text-slate-200 block">Health Check</span>
            <span className="text-[11px] font-mono text-slate-400">GET /health</span>
          </div>
          <Play className="w-4 h-4 text-emerald-400 shrink-0" />
        </button>

        {/* Test DB Products */}
        <button
          onClick={() => executeTest('/api/products', 'GET')}
          disabled={loading}
          className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 transition-all text-left"
        >
          <div>
            <span className="text-xs font-semibold text-slate-200 block">Fetch DB Catalog</span>
            <span className="text-[11px] font-mono text-slate-400">GET /api/products</span>
          </div>
          <Play className="w-4 h-4 text-cyan-400 shrink-0" />
        </button>

        {/* Test Latency-Sensitive Checkout */}
        <button
          onClick={() =>
            executeTest('/api/checkout', 'POST', {
              product_id: 'p-101',
              quantity: 1,
              customer_email: 'tester@orderflow.demo',
              payment_method: 'credit_card',
            })
          }
          disabled={loading}
          className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 transition-all text-left"
        >
          <div>
            <span className="text-xs font-semibold text-slate-200 block">Process Checkout</span>
            <span className="text-[11px] font-mono text-slate-400">POST /api/checkout</span>
          </div>
          <Play className="w-4 h-4 text-amber-400 shrink-0" />
        </button>
      </div>

      {/* Result Display */}
      {result && (
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-300 font-bold">{result.endpoint}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span className={result.durationMs > 1000 ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                  {result.durationMs}ms
                </span>
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  result.status === 200
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                HTTP {result.status} {result.statusText}
              </span>
            </div>
          </div>
          <pre className="max-h-48 overflow-y-auto text-slate-300 pt-2 whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
