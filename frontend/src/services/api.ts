// API Client for the OrderFlow Incident Demo Application

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  release_version: string;
  environment: string;
  dependencies: {
    database: {
      status: string;
      connected: boolean;
      latency_ms: number;
      driver?: string;
      error?: string;
    };
    downstream_services: {
      payment_gateway: {
        status: string;
        target_endpoint: string;
        issues: string[];
      };
    };
  };
}

export interface TelemetryMetrics {
  timestamp: string;
  uptime_seconds: number;
  traffic: {
    total_requests: number;
    successful_requests: number;
    client_errors_4xx: number;
    server_errors_5xx: number;
    error_rate_percent: number;
  };
  rolling_window_120s: {
    requests: number;
    errors: number;
    error_rate_percent: number;
  };
  latency_ms: {
    avg: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
  };
  dependencies: {
    database: {
      total_queries: number;
      failed_queries: number;
      error_rate_percent: number;
      avg_duration_ms: number;
    };
  };
  endpoints: Record<
    string,
    {
      total_calls: number;
      error_calls: number;
      error_rate_pct: number;
      avg_latency_ms: number;
      max_latency_ms: number;
    }
  >;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  service: string;
  endpoint?: string;
  method?: string;
  status_code?: number;
  message: string;
  error_type?: string;
  traceback?: string;
  details?: Record<string, any>;
}

export interface ControlStatus {
  faults: {
    database_failure: {
      active: boolean;
      failure_type?: string;
      target: string;
    };
    high_latency: {
      active: boolean;
      delay_ms: number;
      target_endpoint?: string;
    };
    faulty_release: {
      active: boolean;
      current_version: string;
      is_faulty_version: boolean;
    };
  };
  last_fault_injected_at?: string;
  last_reset_at?: string;
}

export interface ChangeRecord {
  id: string;
  timestamp: string;
  change_type: string;
  version: string;
  author: string;
  description: string;
  previous_state: Record<string, any>;
  new_state: Record<string, any>;
  status: string;
}

export interface SanitizedConfig {
  application: {
    name: string;
    environment: string;
    release_version: string;
    log_level: string;
    server_time_utc: string;
  };
  database: {
    driver: string;
    pool_size: number;
    timeout_seconds: number;
    storage_type: string;
  };
  downstream_services: {
    payment_gateway: {
      endpoint_url: string;
      auth_token: string;
      timeout_ms: number;
      retry_attempts: number;
    };
  };
}

const BASE_URL = ''; // Relative via Vite proxy

export const api = {
  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${BASE_URL}/health`);
    return res.json();
  },

  async getControlStatus(): Promise<ControlStatus> {
    const res = await fetch(`${BASE_URL}/api/control/status`);
    return res.json();
  },

  async getMetrics(): Promise<TelemetryMetrics> {
    const res = await fetch(`${BASE_URL}/api/diagnostics/metrics`);
    return res.json();
  },

  async getLogs(params?: {
    level?: string;
    search?: string;
    limit?: number;
  }): Promise<{ count: number; logs: LogEntry[] }> {
    const query = new URLSearchParams();
    if (params?.level) query.append('level', params.level);
    if (params?.search) query.append('search', params.search);
    if (params?.limit) query.append('limit', String(params.limit));

    const res = await fetch(`${BASE_URL}/api/diagnostics/logs?${query.toString()}`);
    return res.json();
  },

  async getConfig(): Promise<SanitizedConfig> {
    const res = await fetch(`${BASE_URL}/api/diagnostics/config`);
    return res.json();
  },

  async getChanges(): Promise<{ total_records: number; active_release: string; recent_changes: ChangeRecord[] }> {
    const res = await fetch(`${BASE_URL}/api/diagnostics/changes`);
    return res.json();
  },

  // Fault Controls
  async injectDatabaseFault(failureType: string = 'connection_refused') {
    const res = await fetch(`${BASE_URL}/api/control/inject/database`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ failure_type: failureType }),
    });
    return res.json();
  },

  async injectLatencyFault(delayMs: number = 2500, endpoint: string = '/api/checkout') {
    const res = await fetch(`${BASE_URL}/api/control/inject/latency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delay_ms: delayMs, endpoint }),
    });
    return res.json();
  },

  async injectFaultyRelease(targetVersion: string = 'v2.4.1-rc2') {
    const res = await fetch(`${BASE_URL}/api/control/inject/faulty-release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_version: targetVersion }),
    });
    return res.json();
  },

  async resetToHealthy() {
    const res = await fetch(`${BASE_URL}/api/control/reset`, {
      method: 'POST',
    });
    return res.json();
  },

  async resetMetrics() {
    const res = await fetch(`${BASE_URL}/api/control/metrics/reset`, {
      method: 'POST',
    });
    return res.json();
  },

  async getTrafficStatus(): Promise<{ running: boolean; requests_generated: number; interval_seconds: number }> {
    const res = await fetch(`${BASE_URL}/api/control/traffic/status`);
    return res.json();
  },

  async toggleTraffic() {
    const res = await fetch(`${BASE_URL}/api/control/traffic/toggle`, {
      method: 'POST',
    });
    return res.json();
  },

  // Interactive Test Execution
  async testEndpoint(endpoint: string, method: string = 'GET', body?: any) {
    const startTime = performance.now();
    try {
      const options: RequestInit = { method };
      if (body) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
      }
      const res = await fetch(`${BASE_URL}${endpoint}`, options);
      const elapsed = Math.round(performance.now() - startTime);
      const data = await res.json().catch(() => ({}));
      return {
        status: res.status,
        statusText: res.statusText,
        durationMs: elapsed,
        data,
      };
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      return {
        status: 0,
        statusText: 'Client Network Error',
        durationMs: elapsed,
        data: { error: err.message },
      };
    }
  },
};
