import asyncio
import time
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from app.config import settings
from app.logger import app_logger


class DatabaseConnectionError(Exception):
    """Raised when the database connection fails or pool is exhausted."""
    pass


class PaymentGatewayConfigError(Exception):
    """Raised when downstream payment gateway cannot be reached due to invalid runtime configuration."""
    pass


class HighLatencyConfig(BaseModel):
    enabled: bool = False
    endpoint: str = "/api/checkout"
    delay_ms: int = Field(default=2500, ge=100, le=15000)


class DatabaseFaultConfig(BaseModel):
    enabled: bool = False
    failure_type: str = "connection_refused"  # "connection_refused" or "pool_exhausted"
    error_message: str = "sqlite3.OperationalError: unable to open database file: connection pool exhausted [Errno 104: Connection reset by peer]"


class ReleaseFaultConfig(BaseModel):
    enabled: bool = False
    target_version: str = "v2.4.1-rc2"
    invalid_payment_url: str = "https://invalid-payment-gateway.internal:9999/v1/charge"
    invalid_timeout_ms: int = 25
    invalid_token: str = "EXPIRED_OR_MALFORMED_TOKEN_DEMO"


class FaultEngine:
    """Internal fault controller. State is isolated from the AI Agent diagnostic view."""

    def __init__(self):
        self.db_fault = DatabaseFaultConfig()
        self.latency_fault = HighLatencyConfig()
        self.release_fault = ReleaseFaultConfig()
        self.last_fault_injected_at: Optional[str] = None
        self.last_reset_at: Optional[str] = None

    # --- Database Fault Controls ---
    def inject_database_fault(self, failure_type: str = "connection_refused") -> Dict[str, Any]:
        self.db_fault.enabled = True
        self.db_fault.failure_type = failure_type
        self.last_fault_injected_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        app_logger.warning(
            f"Fault Controller: Injected database fault '{failure_type}' into connection manager.",
            service="fault-controller",
            details={"failure_type": failure_type}
        )
        return {
            "status": "success",
            "message": "Database connection failure injected successfully.",
            "fault": "database_failure",
            "active": True
        }

    def clear_database_fault(self) -> Dict[str, Any]:
        self.db_fault.enabled = False
        app_logger.info(
            "Fault Controller: Database connection fault cleared. Database pool restored.",
            service="fault-controller"
        )
        return {"status": "success", "message": "Database fault cleared.", "active": False}

    # --- Latency Fault Controls ---
    def inject_latency_fault(self, delay_ms: int = 2500, endpoint: str = "/api/checkout") -> Dict[str, Any]:
        self.latency_fault.enabled = True
        self.latency_fault.delay_ms = delay_ms
        self.latency_fault.endpoint = endpoint
        self.last_fault_injected_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        app_logger.warning(
            f"Fault Controller: Injected artificial delay of {delay_ms}ms on {endpoint}.",
            service="fault-controller",
            details={"delay_ms": delay_ms, "target_endpoint": endpoint}
        )
        return {
            "status": "success",
            "message": f"High latency fault injected ({delay_ms}ms on {endpoint}).",
            "fault": "high_latency",
            "active": True,
            "delay_ms": delay_ms,
            "target_endpoint": endpoint
        }

    def clear_latency_fault(self) -> Dict[str, Any]:
        self.latency_fault.enabled = False
        app_logger.info(
            "Fault Controller: High latency fault cleared. Artificial delay removed.",
            service="fault-controller"
        )
        return {"status": "success", "message": "Latency fault cleared.", "active": False}

    # --- Faulty Release / Config Controls ---
    def inject_faulty_release(
        self,
        target_version: str = "v2.4.1-rc2",
        invalid_url: str = "https://invalid-payment-gateway.internal:9999/v1/charge",
        timeout_ms: int = 25
    ) -> Dict[str, Any]:
        prev_state = {
            "release_version": settings.release_version,
            "payment_gateway_url": settings.payment_gateway_url,
            "payment_timeout_ms": settings.payment_timeout_ms
        }

        self.release_fault.enabled = True
        self.release_fault.target_version = target_version
        self.release_fault.invalid_payment_url = invalid_url
        self.release_fault.invalid_timeout_ms = timeout_ms

        # Mutate runtime configuration
        settings.release_version = target_version
        settings.payment_gateway_url = invalid_url
        settings.payment_timeout_ms = timeout_ms
        settings.payment_gateway_token = self.release_fault.invalid_token

        new_state = {
            "release_version": target_version,
            "payment_gateway_url": invalid_url,
            "payment_timeout_ms": timeout_ms
        }

        # Record this deployment in change history
        settings.record_change(
            change_type="release_deployment",
            version=target_version,
            author="github-actions[bot]@ci.internal",
            description=f"Release {target_version}: Deployed updated payment routing endpoint and aggressive timeout policy",
            previous_state=prev_state,
            new_state=new_state
        )

        self.last_fault_injected_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        app_logger.warning(
            f"Fault Controller: Deployed faulty release {target_version} with invalid payment gateway URL: {invalid_url}",
            service="fault-controller",
            details={"version": target_version, "gateway_url": invalid_url, "timeout_ms": timeout_ms}
        )
        return {
            "status": "success",
            "message": f"Faulty release {target_version} deployed and active.",
            "fault": "faulty_release",
            "active": True,
            "version": target_version
        }

    def clear_faulty_release(self) -> Dict[str, Any]:
        if not self.release_fault.enabled and settings.release_version == "v2.4.0":
            return {"status": "success", "message": "Baseline release already active.", "active": False}

        prev_state = {
            "release_version": settings.release_version,
            "payment_gateway_url": settings.payment_gateway_url,
            "payment_timeout_ms": settings.payment_timeout_ms
        }

        self.release_fault.enabled = False
        settings.release_version = "v2.4.0"
        settings.payment_gateway_url = "https://api.payment-gateway.internal/v1/charge"
        settings.payment_gateway_token = "pg_live_demo_984729487239487"
        settings.payment_timeout_ms = 800

        new_state = {
            "release_version": "v2.4.0",
            "payment_gateway_url": settings.payment_gateway_url,
            "payment_timeout_ms": settings.payment_timeout_ms
        }

        settings.record_change(
            change_type="rollback",
            version="v2.4.0",
            author="sre-oncall@infra.internal",
            description="Emergency Rollback: Reverted to known-good baseline v2.4.0 and restored production payment gateway settings",
            previous_state=prev_state,
            new_state=new_state
        )

        app_logger.info(
            "Fault Controller: Rollback completed. Restored stable release v2.4.0 and payment config.",
            service="fault-controller"
        )
        return {
            "status": "success",
            "message": "Rolled back to stable baseline v2.4.0.",
            "active": False,
            "version": "v2.4.0"
        }

    # --- Reset All Faults ---
    def reset_all_to_healthy(self) -> Dict[str, Any]:
        """Restores healthy baseline across all subsystems."""
        self.clear_database_fault()
        self.clear_latency_fault()
        self.clear_faulty_release()
        self.last_reset_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        app_logger.info(
            "Fault Controller: Safe reset executed. All injected faults cleared and baseline restored.",
            service="fault-controller"
        )
        return {
            "status": "success",
            "message": "Application safely reset to healthy baseline state.",
            "active_faults": {
                "database_failure": False,
                "high_latency": False,
                "faulty_release": False
            },
            "release_version": settings.release_version,
            "timestamp": self.last_reset_at
        }

    # --- Internal State Inspection (For Admin/Dashboard ONLY) ---
    def get_internal_control_status(self) -> Dict[str, Any]:
        """Internal controller state for the dashboard controls. NOT for the AI diagnostic API."""
        return {
            "faults": {
                "database_failure": {
                    "active": self.db_fault.enabled,
                    "failure_type": self.db_fault.failure_type if self.db_fault.enabled else None,
                    "target": "demo_data.db (SQLite pool)"
                },
                "high_latency": {
                    "active": self.latency_fault.enabled,
                    "delay_ms": self.latency_fault.delay_ms if self.latency_fault.enabled else 0,
                    "target_endpoint": self.latency_fault.endpoint if self.latency_fault.enabled else None
                },
                "faulty_release": {
                    "active": self.release_fault.enabled,
                    "current_version": settings.release_version,
                    "is_faulty_version": self.release_fault.enabled
                }
            },
            "last_fault_injected_at": self.last_fault_injected_at,
            "last_reset_at": self.last_reset_at
        }


# Global fault engine instance
fault_engine = FaultEngine()
