import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.fault_engine import fault_engine


@pytest.fixture(autouse=True)
def clean_state():
    fault_engine.reset_all_to_healthy()
    yield
    fault_engine.reset_all_to_healthy()


@pytest.mark.asyncio
async def test_diagnostic_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health
        health_resp = await client.get("/api/diagnostics/health")
        assert health_resp.status_code == 200
        health = health_resp.json()
        assert "components" in health
        assert "database" in health["components"]

        # 2. Metrics
        metrics_resp = await client.get("/api/diagnostics/metrics")
        assert metrics_resp.status_code == 200
        metrics = metrics_resp.json()
        assert "traffic" in metrics
        assert "latency_ms" in metrics

        # 3. Config (sanitized)
        config_resp = await client.get("/api/diagnostics/config")
        assert config_resp.status_code == 200
        cfg = config_resp.json()
        # Verify secrets are masked
        token = cfg["downstream_services"]["payment_gateway"]["auth_token"]
        assert "..." in token or token == "[REDACTED]"
        assert "pg_live_demo_984729487239487" not in token

        # 4. Changes
        changes_resp = await client.get("/api/diagnostics/changes")
        assert changes_resp.status_code == 200
        changes = changes_resp.json()
        assert "recent_changes" in changes
        assert len(changes["recent_changes"]) > 0

        # 5. Overview
        overview_resp = await client.get("/api/diagnostics/overview")
        assert overview_resp.status_code == 200
        overview = overview_resp.json()
        assert "health_summary" in overview
        assert "telemetry_summary" in overview
