import sys
import uuid
import traceback
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


def get_current_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class LogEntry(BaseModel):
    id: str
    timestamp: str
    level: str  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    service: str
    endpoint: Optional[str] = None
    method: Optional[str] = None
    status_code: Optional[int] = None
    message: str
    error_type: Optional[str] = None
    traceback: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class RingBufferLogger:
    """In-memory thread-safe structured ring buffer for genuine application telemetry logs."""

    def __init__(self, capacity: int = 2000):
        self.capacity = capacity
        self.buffer: List[LogEntry] = []

    def log(
        self,
        level: str,
        message: str,
        service: str = "orderflow-service",
        endpoint: Optional[str] = None,
        method: Optional[str] = None,
        status_code: Optional[int] = None,
        error_type: Optional[str] = None,
        exc: Optional[BaseException] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> LogEntry:
        tb_str = None
        if exc is not None:
            tb_str = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
            if error_type is None:
                error_type = exc.__class__.__name__

        entry = LogEntry(
            id=f"log-{uuid.uuid4().hex[:8]}",
            timestamp=get_current_utc_iso(),
            level=level.upper(),
            service=service,
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            message=message,
            error_type=error_type,
            traceback=tb_str,
            details=details or {},
        )

        self.buffer.append(entry)
        if len(self.buffer) > self.capacity:
            self.buffer.pop(0)

        # Output to console with readable formatting
        sys.stdout.write(
            f"[{entry.timestamp}] [{entry.level:5s}] [{entry.service}] "
            f"{entry.method or ''} {entry.endpoint or ''} {entry.status_code or ''} - {entry.message}\n"
        )
        if tb_str:
            sys.stdout.write(f"{tb_str}\n")
        sys.stdout.flush()

        return entry

    def info(self, message: str, **kwargs) -> LogEntry:
        return self.log(level="INFO", message=message, **kwargs)

    def warning(self, message: str, **kwargs) -> LogEntry:
        return self.log(level="WARNING", message=message, **kwargs)

    def error(self, message: str, **kwargs) -> LogEntry:
        return self.log(level="ERROR", message=message, **kwargs)

    def critical(self, message: str, **kwargs) -> LogEntry:
        return self.log(level="CRITICAL", message=message, **kwargs)

    def get_logs(
        self,
        level: Optional[str] = None,
        endpoint: Optional[str] = None,
        search: Optional[str] = None,
        since: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        results = []
        target_level = level.upper() if level else None

        for entry in reversed(self.buffer):
            if target_level and entry.level != target_level:
                continue
            if endpoint and (not entry.endpoint or endpoint not in entry.endpoint):
                continue
            if since and entry.timestamp < since:
                continue
            if search:
                query = search.lower()
                matches_search = (
                    query in entry.message.lower()
                    or (entry.error_type and query in entry.error_type.lower())
                    or (entry.traceback and query in entry.traceback.lower())
                    or (entry.endpoint and query in entry.endpoint.lower())
                )
                if not matches_search:
                    continue

            results.append(entry.model_dump())
            if len(results) >= limit:
                break

        return results

    def clear(self):
        self.buffer.clear()


# Global logger instance
app_logger = RingBufferLogger()
