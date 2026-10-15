from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter
from app.fault_engine import fault_engine
from app.database import db
from app.metrics import telemetry
from app.config import get_current_utc_iso

router = APIRouter(prefix="/api/control", tags=["Demo Fault Controls"])


class LatencyInjectionRequest(BaseModel):
    delay_ms: int = Field(default=2500, ge=100, le=15000, description="Delay in milliseconds")
    endpoint: str = Field(default="/api/checkout", description="Target endpoint")


class DatabaseFaultRequest(BaseModel):
    failure_type: str = Field(default="connection_refused", description="Type of DB failure to simulate")


class ReleaseFaultRequest(BaseModel):
    target_version: str = Field(default="v2.4.1-rc2")
    invalid_url: str = Field(default="https://invalid-payment-gateway.internal:9999/v1/charge")
    timeout_ms: int = Field(default=25, ge=1, le=1000)


@router.get("/status")
def get_control_status():
    """
    Returns internal fault injection status for the demo dashboard UI.
    Isolated from the external AI Agent's diagnostic interface.
    """
    return fault_engine.get_internal_control_status()


@router.post("/inject/database")
def inject_database_fault(req: Optional[DatabaseFaultRequest] = None):
    """Injects a database connection failure."""
    failure_type = req.failure_type if req else "connection_refused"
    return fault_engine.inject_database_fault(failure_type=failure_type)


@router.post("/inject/latency")
def inject_latency_fault(req: Optional[LatencyInjectionRequest] = None):
    """Injects artificial latency on a latency-sensitive API endpoint."""
    delay_ms = req.delay_ms if req else 2500
    endpoint = req.endpoint if req else "/api/checkout"
    return fault_engine.inject_latency_fault(delay_ms=delay_ms, endpoint=endpoint)


@router.post("/inject/faulty-release")
def inject_faulty_release(req: Optional[ReleaseFaultRequest] = None):
    """Deploys an intentionally faulty release (v2.4.1-rc2) with bad configuration."""
    version = req.target_version if req else "v2.4.1-rc2"
    url = req.invalid_url if req else "https://invalid-payment-gateway.internal:9999/v1/charge"
    timeout_ms = req.timeout_ms if req else 25
    return fault_engine.inject_faulty_release(target_version=version, invalid_url=url, timeout_ms=timeout_ms)


@router.post("/reset")
def reset_to_healthy():
    """
    Safely resets all faults, rolls back config to baseline v2.4.0,
    and runs a real verification check to confirm recovery.
    """
    reset_result = fault_engine.reset_all_to_healthy()
    # Execute actual verification check on database
    verify_db = db.check_health()

    return {
        "status": "success",
        "message": "Reset completed. All injected faults cleared and baseline restored.",
        "details": reset_result,
        "verification": {
            "database_healthy": verify_db["status"] == "healthy",
            "active_release": reset_result["release_version"],
            "verified_at": get_current_utc_iso()
        }
    }


@router.post("/metrics/reset")
def reset_metrics():
    """Resets accumulated telemetry metrics."""
    telemetry.reset()
    return {"status": "success", "message": "Telemetry metrics reset."}


@router.get("/traffic/status")
def get_traffic_status():
    """Returns background traffic simulator status."""
    from app.traffic_gen import traffic_simulator
    return traffic_simulator.get_status()


@router.post("/traffic/toggle")
def toggle_traffic():
    """Toggles background traffic simulator on or off."""
    from app.traffic_gen import traffic_simulator
    if traffic_simulator.is_running:
        traffic_simulator.stop()
    else:
        traffic_simulator.start()
    return {
        "status": "success",
        "traffic_running": traffic_simulator.is_running,
        "details": traffic_simulator.get_status()
    }

