import time
from typing import Dict, Any, List
from collections import deque
from datetime import datetime, timezone


def get_current_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class LatencySample:
    __slots__ = ("timestamp", "endpoint", "method", "status_code", "duration_ms", "is_error")

    def __init__(self, endpoint: str, method: str, status_code: int, duration_ms: float):
        self.timestamp = time.time()
        self.endpoint = endpoint
        self.method = method
        self.status_code = status_code
        self.duration_ms = duration_ms
        self.is_error = status_code >= 400


class TelemetryCollector:
    """Collects real-time request metrics, latency percentiles, and error rates."""

    def __init__(self, window_seconds: int = 120):
        self.window_seconds = window_seconds
        self.start_time = time.time()
        self.samples: deque[LatencySample] = deque()

        # Cumulative totals
        self.total_requests = 0
        self.successful_requests = 0  # 2xx, 3xx
        self.client_error_requests = 0  # 4xx
        self.server_error_requests = 0  # 5xx

        # Endpoint aggregates
        self.endpoint_stats: Dict[str, Dict[str, Any]] = {}

        # Dependency stats
        self.db_operations = 0
        self.db_failures = 0
        self.db_total_duration_ms = 0.0

    def record_request(self, endpoint: str, method: str, status_code: int, duration_ms: float):
        self.total_requests += 1
        if 200 <= status_code < 400:
            self.successful_requests += 1
        elif 400 <= status_code < 500:
            self.client_error_requests += 1
        else:
            self.server_error_requests += 1

        sample = LatencySample(endpoint, method, status_code, duration_ms)
        self.samples.append(sample)
        self._prune_samples()

        # Update per-endpoint cumulative stats
        key = f"{method} {endpoint}"
        if key not in self.endpoint_stats:
            self.endpoint_stats[key] = {
                "total_requests": 0,
                "error_requests": 0,
                "total_duration_ms": 0.0,
                "min_latency_ms": duration_ms,
                "max_latency_ms": duration_ms,
            }
        stats = self.endpoint_stats[key]
        stats["total_requests"] += 1
        if status_code >= 400:
            stats["error_requests"] += 1
        stats["total_duration_ms"] += duration_ms
        stats["min_latency_ms"] = min(stats["min_latency_ms"], duration_ms)
        stats["max_latency_ms"] = max(stats["max_latency_ms"], duration_ms)

    def record_db_operation(self, duration_ms: float, success: bool):
        self.db_operations += 1
        self.db_total_duration_ms += duration_ms
        if not success:
            self.db_failures += 1

    def _prune_samples(self):
        cutoff = time.time() - self.window_seconds
        while self.samples and self.samples[0].timestamp < cutoff:
            self.samples.popleft()

    def get_metrics_summary(self) -> Dict[str, Any]:
        self._prune_samples()
        uptime_seconds = round(time.time() - self.start_time, 1)

        # Calculate percentiles from rolling window
        durations = [s.duration_ms for s in self.samples]
        durations.sort()

        if durations:
            avg_latency = round(sum(durations) / len(durations), 2)
            p50 = round(durations[int(len(durations) * 0.50)], 2)
            p90 = round(durations[int(len(durations) * 0.90)], 2)
            p95 = round(durations[min(int(len(durations) * 0.95), len(durations) - 1)], 2)
            p99 = round(durations[min(int(len(durations) * 0.99), len(durations) - 1)], 2)
            max_latency = round(durations[-1], 2)
        else:
            avg_latency = 0.0
            p50 = 0.0
            p90 = 0.0
            p95 = 0.0
            p99 = 0.0
            max_latency = 0.0

        # Window error counts
        window_errors = sum(1 for s in self.samples if s.is_error)
        window_total = len(self.samples)
        window_error_rate = (
            round((window_errors / window_total) * 100, 2) if window_total > 0 else 0.0
        )

        cumulative_errors = self.client_error_requests + self.server_error_requests
        cumulative_error_rate = (
            round((cumulative_errors / self.total_requests) * 100, 2)
            if self.total_requests > 0
            else 0.0
        )

        # Endpoint breakdowns
        endpoints_summary = {}
        for ep, ep_stat in self.endpoint_stats.items():
            ep_reqs = ep_stat["total_requests"]
            ep_errs = ep_stat["error_requests"]
            endpoints_summary[ep] = {
                "total_calls": ep_reqs,
                "error_calls": ep_errs,
                "error_rate_pct": round((ep_errs / ep_reqs) * 100, 2) if ep_reqs > 0 else 0.0,
                "avg_latency_ms": round(ep_stat["total_duration_ms"] / ep_reqs, 2)
                if ep_reqs > 0
                else 0.0,
                "max_latency_ms": round(ep_stat["max_latency_ms"], 2),
            }

        # DB dependency stats
        db_avg_latency = (
            round(self.db_total_duration_ms / self.db_operations, 2)
            if self.db_operations > 0
            else 0.0
        )
        db_error_rate = (
            round((self.db_failures / self.db_operations) * 100, 2)
            if self.db_operations > 0
            else 0.0
        )

        return {
            "timestamp": get_current_utc_iso(),
            "uptime_seconds": uptime_seconds,
            "traffic": {
                "total_requests": self.total_requests,
                "successful_requests": self.successful_requests,
                "client_errors_4xx": self.client_error_requests,
                "server_errors_5xx": self.server_error_requests,
                "error_rate_percent": cumulative_error_rate,
            },
            "rolling_window_120s": {
                "requests": window_total,
                "errors": window_errors,
                "error_rate_percent": window_error_rate,
            },
            "latency_ms": {
                "avg": avg_latency,
                "p50": p50,
                "p90": p90,
                "p95": p95,
                "p99": p99,
                "max": max_latency,
            },
            "dependencies": {
                "database": {
                    "total_queries": self.db_operations,
                    "failed_queries": self.db_failures,
                    "error_rate_percent": db_error_rate,
                    "avg_duration_ms": db_avg_latency,
                }
            },
            "endpoints": endpoints_summary,
        }

    def reset(self):
        self.samples.clear()
        self.total_requests = 0
        self.successful_requests = 0
        self.client_error_requests = 0
        self.server_error_requests = 0
        self.endpoint_stats.clear()
        self.db_operations = 0
        self.db_failures = 0
        self.db_total_duration_ms = 0.0
        self.start_time = time.time()


# Global telemetry instance
telemetry = TelemetryCollector()
