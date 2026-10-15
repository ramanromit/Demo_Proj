import time
from fastapi import APIRouter, Response, status
from app.config import settings, get_current_utc_iso
from app.database import db
from app.logger import app_logger

router = APIRouter(tags=["Health & Probes"])


@router.get("/health")
def get_health(response: Response):
    """
    Application and dependency health check endpoint.
    Returns status: healthy, degraded, or unhealthy.
    """
    db_health = db.check_health()
    overall_healthy = db_health["status"] == "healthy"

    # Check configuration validity
    config_healthy = True
    config_issues = []
    if "invalid-payment-gateway" in settings.payment_gateway_url:
        config_healthy = False
        config_issues.append("Downstream payment gateway host is unresolvable")
    if settings.payment_timeout_ms < 100:
        config_healthy = False
        config_issues.append(f"Payment timeout {settings.payment_timeout_ms}ms is below operational threshold (100ms)")

    overall_status = "healthy"
    if not overall_healthy and not config_healthy:
        overall_status = "unhealthy"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    elif not overall_healthy or not config_healthy:
        overall_status = "degraded"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    else:
        response.status_code = status.HTTP_200_OK

    return {
        "status": overall_status,
        "timestamp": get_current_utc_iso(),
        "release_version": settings.release_version,
        "environment": settings.environment,
        "dependencies": {
            "database": db_health,
            "downstream_services": {
                "payment_gateway": {
                    "status": "healthy" if config_healthy else "degraded",
                    "target_endpoint": settings.payment_gateway_url,
                    "issues": config_issues
                }
            }
        }
    }


@router.get("/health/live")
def get_liveness():
    """Kubernetes liveness probe: indicates whether service process is running."""
    return {"status": "alive", "timestamp": get_current_utc_iso()}


@router.get("/health/ready")
def get_readiness(response: Response):
    """Kubernetes readiness probe: indicates whether service is ready to accept traffic."""
    db_health = db.check_health()
    if db_health["status"] != "healthy":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "not_ready",
            "reason": "Database dependency unreachable",
            "timestamp": get_current_utc_iso()
        }

    return {"status": "ready", "timestamp": get_current_utc_iso()}
