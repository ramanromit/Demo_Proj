import os
import time
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field


def get_current_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ConfigChangeRecord(BaseModel):
    id: str
    timestamp: str
    change_type: str  # "release_deployment", "config_update", "rollback"
    version: str
    author: str
    description: str
    previous_state: Dict[str, Any]
    new_state: Dict[str, Any]
    status: str = "applied"


class AppSettings:
    """Runtime configuration manager with sanitized inspection and change history tracking."""

    def __init__(self):
        self.app_name: str = os.getenv("APP_NAME", "OrderFlow Demo Service")
        self.environment: str = os.getenv("ENVIRONMENT", "demo-staging")
        self.release_version: str = os.getenv("RELEASE_VERSION", "v2.4.0")
        self.log_level: str = os.getenv("LOG_LEVEL", "INFO")
        self.port: int = int(os.getenv("PORT", "8080"))

        # Database Configuration
        self.db_driver: str = os.getenv("DB_DRIVER", "sqlite3")
        self.db_path: str = os.getenv("DB_PATH", "demo_data.db")
        self.db_pool_size: int = int(os.getenv("DB_POOL_SIZE", "10"))
        self.db_timeout_seconds: float = float(os.getenv("DB_TIMEOUT_SECONDS", "5.0"))

        # Downstream Service Configuration (Payment Gateway)
        self.payment_gateway_url: str = os.getenv(
            "PAYMENT_GATEWAY_URL", "https://api.payment-gateway.internal/v1/charge"
        )
        self.payment_gateway_token: str = os.getenv(
            "PAYMENT_GATEWAY_TOKEN", "pg_live_demo_984729487239487"
        )
        self.payment_timeout_ms: int = int(os.getenv("PAYMENT_TIMEOUT_MS", "800"))
        self.payment_retry_attempts: int = int(os.getenv("PAYMENT_RETRY_ATTEMPTS", "3"))

        # Baseline change history
        self.change_history: List[ConfigChangeRecord] = [
            ConfigChangeRecord(
                id="chg-001",
                timestamp="2026-10-12T09:00:00Z",
                change_type="release_deployment",
                version="v2.3.9",
                author="release-bot@infra.internal",
                description="Initial stable baseline release with OrderFlow catalog",
                previous_state={},
                new_state={"release_version": "v2.3.9", "payment_timeout_ms": 1000},
                status="completed"
            ),
            ConfigChangeRecord(
                id="chg-002",
                timestamp="2026-10-14T08:30:00Z",
                change_type="release_deployment",
                version="v2.4.0",
                author="deploy-pipeline@infra.internal",
                description="Production Release v2.4.0: Added inventory validation and performance tuning",
                previous_state={"release_version": "v2.3.9"},
                new_state={"release_version": "v2.4.0", "payment_timeout_ms": 800},
                status="active"
            )
        ]

    def record_change(
        self,
        change_type: str,
        version: str,
        author: str,
        description: str,
        previous_state: Dict[str, Any],
        new_state: Dict[str, Any]
    ) -> ConfigChangeRecord:
        record = ConfigChangeRecord(
            id=f"chg-{int(time.time() * 1000)}",
            timestamp=get_current_utc_iso(),
            change_type=change_type,
            version=version,
            author=author,
            description=description,
            previous_state=previous_state,
            new_state=new_state,
            status="active"
        )
        self.change_history.insert(0, record)
        return record

    def get_sanitized_config(self) -> Dict[str, Any]:
        """Returns safe runtime configuration for AI agent diagnostic consumption without leaking raw secrets."""
        masked_token = (
            self.payment_gateway_token[:6] + "..." + self.payment_gateway_token[-3:]
            if len(self.payment_gateway_token) > 9
            else "[REDACTED]"
        )
        return {
            "application": {
                "name": self.app_name,
                "environment": self.environment,
                "release_version": self.release_version,
                "log_level": self.log_level,
                "server_time_utc": get_current_utc_iso(),
            },
            "database": {
                "driver": self.db_driver,
                "pool_size": self.db_pool_size,
                "timeout_seconds": self.db_timeout_seconds,
                "storage_type": "embedded_isolated_sqlite",
            },
            "downstream_services": {
                "payment_gateway": {
                    "endpoint_url": self.payment_gateway_url,
                    "auth_token": masked_token,
                    "timeout_ms": self.payment_timeout_ms,
                    "retry_attempts": self.payment_retry_attempts,
                }
            }
        }

    def get_change_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        return [record.model_dump() for record in self.change_history[:limit]]


# Singleton settings instance
settings = AppSettings()
