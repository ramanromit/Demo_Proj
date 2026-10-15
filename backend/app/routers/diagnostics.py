from typing import Optional
from fastapi import APIRouter, Query
from app.config import settings, get_current_utc_iso
from app.database import db
from app.logger import app_logger
from app.metrics import telemetry

router = APIRouter(prefix="/api/diagnostics", tags=["Diagnostic API (For DevOps Agent)"])


@router.get("/health")
def get_diagnostic_health():
    """
    Diagnostic endpoint providing detailed health assessment of all subsystems
    for DevOps Incident-Response Agent inspection.
    """
    db_health = db.check_health()

    config_issues = []
    if "invalid-payment-gateway" in settings.payment_gateway_url:
        config_issues.append("Downstream payment gateway host DNS lookup failure / connection refused")
    if settings.payment_timeout_ms < 100:
        config_issues.append(f"Payment timeout {settings.payment_timeout_ms}ms is below operational safety threshold (100ms)")

    overall_status = "healthy"
    if db_health["status"] != "healthy" and config_issues:
        overall_status = "unhealthy"
    elif db_health["status"] != "healthy" or config_issues:
        overall_status = "degraded"

    return {
        "status": overall_status,
        "checked_at": get_current_utc_iso(),
        "release_version": settings.release_version,
        "environment": settings.environment,
        "components": {
            "database": {
                "status": db_health["status"],
                "connected": db_health["connected"],
                "latency_ms": db_health["latency_ms"],
                "driver": db_health.get("driver", "sqlite3"),
                "error_details": db_health.get("error")
            },
            "downstream_services": {
                "payment_gateway": {
                    "status": "healthy" if not config_issues else "degraded",
                    "target_endpoint": settings.payment_gateway_url,
                    "diagnostics": config_issues if config_issues else ["Configured endpoint responding normally"]
                }
            }
        }
    }


@router.get("/logs")
def get_diagnostic_logs(
    level: Optional[str] = Query(None, description="Filter by log level: DEBUG, INFO, WARNING, ERROR, CRITICAL"),
    endpoint: Optional[str] = Query(None, description="Filter logs touching a specific endpoint pattern"),
    search: Optional[str] = Query(None, description="Search keyword in message or traceback"),
    since: Optional[str] = Query(None, description="ISO timestamp cutoff for logs"),
    limit: int = Query(50, ge=1, le=500, description="Max logs to return")
):
    """
    Retrieves chronological, structured application logs with severity, error types,
    and stack traces for incident investigation.
    """
    logs = app_logger.get_logs(
        level=level,
        endpoint=endpoint,
        search=search,
        since=since,
        limit=limit
    )
    return {
        "count": len(logs),
        "requested_level": level,
        "filter_applied": bool(level or endpoint or search or since),
        "logs": logs
    }


@router.get("/metrics")
def get_diagnostic_metrics():
    """
    Retrieves real-time application telemetry including request counts,
    failed requests, error rates, and p50/p90/p95/max latency percentiles.
    """
    return telemetry.get_metrics_summary()


@router.get("/config")
def get_diagnostic_config():
    """
    Inspects permitted runtime configuration (sanitized).
    Exposes timeouts, pool sizes, endpoints, and release version while masking sensitive secrets.
    """
    return settings.get_sanitized_config()


@router.get("/changes")
def get_diagnostic_changes(limit: int = Query(10, ge=1, le=50)):
    """
    Inspects recent configuration and release deployment history.
    Enables incident agent to correlate anomalous behavior with recent changes.
    """
    history = settings.get_change_history(limit=limit)
    return {
        "total_records": len(history),
        "active_release": settings.release_version,
        "recent_changes": history
    }


@router.get("/overview")
def get_diagnostic_overview():
    """
    Aggregated single-call triage overview for the external incident agent.
    Combines health status, key telemetry, recent error count, and latest release.
    """
    metrics = telemetry.get_metrics_summary()
    recent_errors = app_logger.get_logs(level="ERROR", limit=5)
    recent_changes = settings.get_change_history(limit=2)

    return {
        "service": settings.app_name,
        "environment": settings.environment,
        "release_version": settings.release_version,
        "timestamp": get_current_utc_iso(),
        "health_summary": get_diagnostic_health(),
        "telemetry_summary": {
            "total_requests": metrics["traffic"]["total_requests"],
            "server_errors_5xx": metrics["traffic"]["server_errors_5xx"],
            "error_rate_percent": metrics["traffic"]["error_rate_percent"],
            "p95_latency_ms": metrics["latency_ms"]["p95"],
            "avg_latency_ms": metrics["latency_ms"]["avg"]
        },
        "recent_errors_sample": recent_errors,
        "latest_deployment": recent_changes[0] if recent_changes else None
    }
